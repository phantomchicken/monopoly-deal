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

  // ✅ BehaviorSubject holds and emits deck state changes
  private deckSubject = new BehaviorSubject<Card[]>([]);
  deck$ = this.deckSubject.asObservable();  // Expose as Observable

  private discardSubject = new BehaviorSubject<Card[]>([]);
  discard$ = this.discardSubject.asObservable();  // Expose as Observable

  private currentPlayerSubject = new BehaviorSubject<Player | undefined>(undefined);
  currentPlayer$ = this.currentPlayerSubject.asObservable();

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
    this.turn (nextPlayer);
  }
  
  playCard(player:Player,card:Card){
    switch(card.type){
      case 'property':
        card = card as PropertyCard;
        player.properties.push(card); // 🔹 Keep a flat list of all properties
        //player.properties.sort((a, b) => a.currentColor.localeCompare(b.currentColor));
        player.hand.splice(player.hand.indexOf(card), 1);
        break;
      case 'money':
        player.bank.push(card);
        player.hand.splice(player.hand.indexOf(card), 1);
        break;
      case 'action':
        this.playActionCard(card);
        this.game.discard.push(card);
        this.discardSubject.next(this.game.discard);
        player.hand.splice(player.hand.indexOf(card), 1);
        break;
    }
    console.log(player);
  }

  playActionCard(card:Card){
    switch(card.name){
      case 'Pass Go':
        this.draw(this.game.players[this.playerIndex], 2);
        break;
 
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
    this.delay(1000);
    this.deckSubject.next(this.game.deck);
  }
    

  shuffle(cards: Card[]): Card[]{
    var currentIndex = cards.length;
    while (currentIndex > 0){
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

}
