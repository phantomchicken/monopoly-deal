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


  setup (name:string, numberOfPlayers:number){
    this.playerNames.unshift(name);

    for (let i=0; i<numberOfPlayers; i++){
      let playerName = this.playerNames[i];
      this.game.players.push(new Player(i+1, playerName));
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
        let colors = name.split(" & ");

        let properties1 = currentPlayer.properties.filter(p => colors.includes(p.colors[0]));
        let properties2 = currentPlayer.properties.filter(p => colors.includes(p.colors[1]));

        if (properties1.length == 0 && properties2.length == 0){
          return
        }

        let pay1 = properties1[0]?.rentValues[properties1.length-1] || 0;
        let pay2 = properties2[0]?.rentValues[properties2.length-1] || 0;
        let pay =  pay1 >= pay2 ? pay1 : pay2;

        otherPlayers.forEach(p => {
          this.paymentQueue.push({ from: p, to: currentPlayer, amount: pay });
        });

        this.paymentQueueSubject.next(this.paymentQueue); // ✅ Notify subscribers
        this.processNextPayment();
 
    }
  }

  delay(ms: number) {
    return new Promise( resolve => setTimeout(resolve, ms) );
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
        return `Payment complete! ${to.name} received the payment.`;
      } else {
        this.statusMessageSubject.next(`${from.name}, continue selecting cards to cover ${this.paymentQueue[0].amount}.`);
        return `${from.name}, continue selecting cards to cover ${this.paymentQueue[0].amount}.`;
      }
    }
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
  

}
