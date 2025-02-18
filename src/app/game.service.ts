import { Injectable } from '@angular/core';
import { Game } from './classes/game';
import { of } from 'rxjs';
import { Player } from './classes/player';
import { Card, PropertyCard } from './classes/card';
import { CardService } from 'src/app/card.service';
import { BehaviorSubject, Observable } from 'rxjs';

@Injectable({
  providedIn: 'root'
})
export class GameService {

  constructor(private cardService: CardService) { }

  public game: Game = new Game();
  public playerNames = ['Myra', 'Ariana', 'Bojan', 'Kemal' ];
  public playerIndex: number = 0;
  public currentPlayer: Player | undefined;
  public actions:number = 3;

  statusMessage: string | null | undefined = null;
  decisionState: 'playing' | 'paying' | null = null;
  selectedCard: Card | null = null;
  paymentState: { from: Player, to: Player, amount: number } | null = null;
  paymentQueue: { from: Player, to: Player, amount: number }[] = [];


  // ✅ BehaviorSubject holds and emits deck state changes
  private deckSubject = new BehaviorSubject<Card[]>([]);
  deck$ = this.deckSubject.asObservable();  // Expose as Observable

  private discardSubject = new BehaviorSubject<Card[]>([]);
  discard$ = this.discardSubject.asObservable();  // Expose as Observable

  private currentPlayerSubject = new BehaviorSubject<Player | undefined>(undefined);
  currentPlayer$ = this.currentPlayerSubject.asObservable();

  private paymentStateSubject = new BehaviorSubject<{ from: Player, to: Player, amount: number } | null>(null);
  paymentState$ = this.paymentStateSubject.asObservable();

  private statusMessageSubject = new BehaviorSubject<string | null>(null);
  statusMessage$ = this.statusMessageSubject.asObservable();

  private paymentQueueSubject = new BehaviorSubject<{ from: Player, to: Player, amount: number }[]>([]);
  paymentQueue$ = this.paymentQueueSubject.asObservable();

  private isDebtCollectorSelectableSubject = new BehaviorSubject<boolean>(false);
  isDebtCollectorSelectable$ = this.isDebtCollectorSelectableSubject.asObservable();

  private selectedDebtPlayerSubject = new BehaviorSubject<Player | null>(null);
  selectedDebtPlayer$ = this.selectedDebtPlayerSubject.asObservable();

  private isPropertySelectableSubject = new BehaviorSubject<boolean>(false);
  propertySelectable$ = this.isPropertySelectableSubject.asObservable();

  private isForcedDealActiveSubject = new BehaviorSubject<boolean>(false);
  forcedDealActive$ = this.isForcedDealActiveSubject.asObservable();

  private selectedPropertySubject = new BehaviorSubject<PropertyCard | null>(null);
  selectedProperty$ = this.selectedPropertySubject.asObservable();

  private selectedTargetPlayerSubject = new BehaviorSubject<Player | null>(null);
  selectedTargetPlayer$ = this.selectedTargetPlayerSubject.asObservable();


  setup (name:string, numberOfPlayers:number){
    if (this.game.players.length == 0) { // for easy drawing TODO replace
      this.playerNames.unshift(name);

      for (let i=0; i<numberOfPlayers; i++){
        let playerName = this.playerNames[i];
        this.game.players.push(new Player(i+1, playerName));
      }
    }

    // ✅ Fetch cards from API using Observable instead of Promise
    this.cardService.getCards().subscribe((cards) => {
      this.game.deck = this.shuffle(cards);
      this.deckSubject.next(this.game.deck); // ✅ Emit new deck state
      
      for (let i=0; i<numberOfPlayers; i++){
        this.draw(this.game.players[i], 5);
      }
      
      this.playerIndex = 0;
      this.currentPlayerSubject.next(this.game.players[0]);
    });
  }


  turn (player:Player){
    if (player.hand.length == 0){
      this.draw(player, 5);
    }
    
    this.playerIndex = (this.playerIndex + 1) % this.game.players.length;
    const nextPlayer = this.game.players[this.playerIndex];
    this.currentPlayerSubject.next(nextPlayer)
  }
  
  playCard(player:Player,card:Card){
    switch(card.type){
      case 'property':
        card = card as PropertyCard;
        player.properties.push(card); // 🔹 Keep a flat list of all properties
        //player.properties.sort((a, b) => a.currentColor.localeCompare(b.currentColor));
        break;
      case 'money':
        player.bank.push(card);
        break;
      case 'action':
        this.playActionCard(card);
        this.game.discard.push(card);
        this.discardSubject.next(this.game.discard);
        break;
    }
    player.hand.splice(player.hand.indexOf(card), 1);
  }

  playActionCard(card:Card){
    let currentPlayer = this.game.players[this.playerIndex];
    let otherPlayers = this.game.players.filter(p => p !== currentPlayer);
    switch(card.name){
      case 'Pass Go':
        this.draw(currentPlayer, 2);
        break;
      case "It's My Birthday":
        otherPlayers.forEach(p => {
          this.paymentQueue.push({ from: p, to: currentPlayer, amount: 2 });
        });

        this.paymentQueueSubject.next(this.paymentQueue); // ✅ Notify subscribers
        this.processNextPayment();
        break;
      case /Rent/.test(card.name) && card.name:
        let name = card.name?.toLowerCase().replace("rent ", "");
        let colors = name == "wildcard" ? ["red", "orange", "dark green", "light green", "black", "dark blue", "light blue", "yellow", "pink", "brown"] : name.split(" & ");

        // Filter properties based on the colors from the Rent wildcard card
        let ownedProperties = currentPlayer.properties.filter(p => colors.some(color => p.colors.includes(color)));

        if (ownedProperties.length === 0) {
            return; // No matching properties to pay rent
        }

        // Find the highest rent value from the owned properties
        let maxRent = Math.max(
            ...ownedProperties.map(p => Math.max(...p.rentValues)) // Find the max rent value from rent values of each property
        );

        // Make the other players pay the highest rent value
        otherPlayers.forEach(p => {
            this.paymentQueue.push({ from: p, to: currentPlayer, amount: maxRent });
        });

        this.paymentQueueSubject.next(this.paymentQueue); // ✅ Notify subscribers
        this.processNextPayment();
        break;
      case 'Debt Collector':
        this.isDebtCollectorSelectableSubject.next(true);
        this.statusMessageSubject.next('Choose a player to pay you 5M.');
        break;
      case 'Sly Deal':
        if (otherPlayers.every(p => p.properties.length == 0)) break;
        this.isPropertySelectableSubject.next(true);
        this.isForcedDealActiveSubject.next(false);
        this.statusMessageSubject.next('Select a property to steal from another player');
        break;

      case 'Forced Deal':
        if (currentPlayer.properties.length == 0) break;
        this.isPropertySelectableSubject.next(true);
        this.isForcedDealActiveSubject.next(true);
        this.statusMessageSubject.next('Select a property to steal from another player');
        break;
    }
  }


  selectDebtCollector(player: Player) {
    const currentPlayer = this.game.players[this.playerIndex];
    
    if (!this.isDebtCollectorSelectableSubject.value || player === currentPlayer) {
      return;
    }

    this.selectedDebtPlayerSubject.next(player);
    this.initiateDebtCollection(player, currentPlayer);
    this.isDebtCollectorSelectableSubject.next(false);
  }

  private initiateDebtCollection(from: Player, to: Player) {
    this.paymentQueue.push({ from, to, amount: 5 });
    this.paymentQueueSubject.next(this.paymentQueue);
    this.processNextPayment();
  }

  draw(player: Player, numberOfCards: number){
    if (numberOfCards > this.game.deck.length){
      this.game.deck = this.game.deck.concat(this.game.discard);
      this.game.discard = [];
    }
    let cards = this.game.deck.slice(0, numberOfCards);
    player.hand = player.hand.concat(cards);
    this.game.deck = this.game.deck.slice(numberOfCards);
    this.deckSubject.next(this.game.deck);
  }
    

  shuffle(cards: Card[]): Card[]{
    var currentIndex = cards.length;
    while (currentIndex > 1){
      currentIndex--;
      var randomIndex = Math.floor(Math.random() * currentIndex);
      [cards[currentIndex], cards[randomIndex]] = [cards[randomIndex], cards[currentIndex]]; // swap cards 
    }
    return cards;
  }

  endTurn() {
    this.playerIndex = (this.playerIndex + 1) % this.game.players.length;
    const nextPlayer = this.game.players[this.playerIndex];

    // ✅ Draw 5 cards if the player has an empty hand
    if (nextPlayer.hand.length === 0) {
        this.draw(nextPlayer, 5);
    }

    this.currentPlayerSubject.next(nextPlayer); // Notify subscribers
    this.actions = 3; // Reset actions
  }

  pay(from: Player, to: Player, amount: number) {
    if (!from || !to || amount <= 0 || this.getTotalPayableAmount(from) == 0) return;
  
    // Store payment state
    this.paymentState = { from, to, amount };
    this.paymentStateSubject.next(this.paymentState);
    this.statusMessageSubject.next(`${from.name}, select a card to pay ${amount} to ${to.name}.`);

    return `${from.name}, select a card to pay ${amount} to ${to.name}.`;
  }
  
  selectCardForPayment(player: Player, card: Card) {
    if (!this.paymentQueue.length || this.paymentQueue[0].from !== player) return;
    
    let { from, to, amount } = this.paymentQueue[0];
    let cardValue = card.value || 0;
    let paid = false;
  
    if (from.bank.includes(card)) {
      from.bank = from.bank.filter(c => c !== card);
      to.bank.push(card);
      paid = true;
    } else if (from.properties.includes(card as PropertyCard)) {
      from.properties = from.properties.filter(c => c !== card);
      to.properties.push(card as PropertyCard);
      paid = true;
    }
  
    if (paid) {
      this.paymentQueue[0].amount -= cardValue;
      if (this.paymentQueue[0].amount <= 0 || this.getTotalPayableAmount(from) === 0) {
        this.statusMessageSubject.next(`Payment complete! ${to.name} received the payment.`);
        this.paymentQueue.shift(); // Remove completed payment
        this.paymentQueueSubject.next(this.paymentQueue); // ✅ Emit changes
        this.processNextPayment();
      } else {
        this.statusMessageSubject.next(`${from.name}, continue selecting cards to cover ${this.paymentQueue[0].amount}.`);
      }
    }
    this.resetPropertySelection(); // so forced and sly deal still work
    return
  }

  processNextPayment() {
    if (this.paymentQueue.length) {
        let { from, to, amount } = this.paymentQueue[0];
        this.statusMessageSubject.next(`${from.name}, select a card to pay ${amount} to ${to.name}.`);
    } else {
        this.statusMessageSubject.next(null);
    }
  }
  
  getTotalPayableAmount(player: Player): number {
    let bankTotal = player.bank.reduce((sum, card) => sum + (card.value || 0), 0);
    let propertyTotal = player.properties.reduce((sum, card) => sum + (card.value || 0), 0);
    return bankTotal + propertyTotal;
  }
  
  selectTargetProperty(player: Player, property: PropertyCard) {
    if (!this.isPropertySelectableSubject.value) return;

    const currentPlayer = this.game.players[this.playerIndex];
    if (player === currentPlayer) return;

    this.selectedTargetPlayerSubject.next(player);
    this.selectedPropertySubject.next(property);

    if (this.isForcedDealActiveSubject.value) {
      this.statusMessageSubject.next('Select one of your properties to swap');
    } else {
      // For Sly Deal, execute the steal immediately
      this.executePropertySteal(player, currentPlayer, property);
    }
  }

  selectOwnProperty(property: PropertyCard) {
    if (!this.isForcedDealActiveSubject.value || !this.selectedPropertySubject.value) return;
    
    const currentPlayer = this.game.players[this.playerIndex];
    const targetPlayer = this.selectedTargetPlayerSubject.value;
    const targetProperty = this.selectedPropertySubject.value;

    if (targetPlayer && targetProperty) {
      // Execute the swap
      this.executePropertySwap(currentPlayer, targetPlayer, property, targetProperty);
      
      // Reset all selection states
      this.resetPropertySelection();
    }
  }

  private executePropertySteal(from: Player, to: Player, property: PropertyCard) {
    from.properties = from.properties.filter(p => p !== property);
    to.properties.push(property);
    this.statusMessageSubject.next(`${to.name} stole ${property.name} from ${from.name}`);
    this.resetPropertySelection();
  }

  private executePropertySwap(player1: Player, player2: Player, prop1: PropertyCard, prop2: PropertyCard) {
    // Remove properties from current owners
    player1.properties = player1.properties.filter(p => p !== prop1);
    player2.properties = player2.properties.filter(p => p !== prop2);
    
    // Add to new owners
    player1.properties.push(prop2);
    player2.properties.push(prop1);

    // Update status message
    this.statusMessageSubject.next(
      `${player1.name} swapped their ${prop1.name} for ${player2.name}'s ${prop2.name}`
    );
  }

  private resetPropertySelection() {
    this.isPropertySelectableSubject.next(false);
    this.isForcedDealActiveSubject.next(false);
    this.selectedPropertySubject.next(null);
    this.selectedTargetPlayerSubject.next(null);
  }

}
