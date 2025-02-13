import { Injectable } from '@angular/core';
import { Game } from './classes/game';
import { of } from 'rxjs';
import { Player } from './classes/player';
import { Card } from './classes/card';
import { CardService } from 'src/app/card.service';

@Injectable({
  providedIn: 'root'
})
export class GameService {

  constructor(private cardService: CardService) { }

  public game: Game = new Game();
  public playerNames = ['Myra', 'Ariana', 'Bojan', 'Kemal' ];

  setup (name:string, numberOfPlayers:number){
    this.playerNames.unshift(name);

    for (let i=0; i<numberOfPlayers; i++){
      let playerName = this.playerNames[i];
      this.game.players.push(new Player(i+1, playerName));
    }

    this.cardService.getCards().then((cards)=> {
      this.game.deck = this.shuffle(cards);
      console.log(this.game.deck)
    });
    
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
}
