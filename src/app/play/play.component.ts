import { Component, OnInit } from '@angular/core';
import { GameService } from '../game.service';
import { Player } from '../classes/player';
import { Card, PropertyCard } from '../classes/card';

@Component({
  selector: 'app-play',
  templateUrl: './play.component.html',
  styleUrls: ['./play.component.css']
})
export class PlayComponent implements OnInit {

  constructor(private gameService: GameService) { }

  public numberOfPlayers:number = 3;
  public name:string = "Nino";
  public start = false;
  public players:Player[] = [];
  public deck:Card[] = [];
  public discard:Card[] = [];
  public currentPlayerIndex: number = 0;
  public currentPlayer: Player | undefined;
  public actions:number = 3;

  public from:Player | undefined;
  public to:Player | undefined;
  public amount:number = 2;

  statusMessage: string | undefined | null;
  decisionState: 'playing' | 'paying' | null = null;
  selectedCard: Card | null = null;
  
  ngOnInit(): void {
    this.gameService.deck$.subscribe(deck => {
      this.deck = deck;
    });

    this.gameService.discard$.subscribe(discard => {
      this.discard = discard;
    });

    this.gameService.currentPlayer$.subscribe(player => {
      this.currentPlayer = player;
    });

    this.gameService.paymentQueue$.subscribe(queue => {
      if (queue.length) {
          this.from = queue[0].from;
          this.to = queue[0].to;
          this.amount = queue[0].amount;
          this.decisionState = "paying";
      } else {
          this.decisionState = null;
      }
    });


    this.gameService.statusMessage$.subscribe(msg => {
        this.statusMessage = msg;
    });

  
  }

  setup(){
    this.gameService.setup(this.name, this.numberOfPlayers);
    this.players = this.gameService.game.players;
    this.start = true;
    this.deck = this.gameService.game.deck;
  }

  playCard(player:Player, card:Card){
    if (player.id != this.currentPlayer?.id) {
      console.log("not your turn");
      return
    }
    this.gameService.playCard(player, card);
    this.decrementActions()
  }

  decrementActions() {
    this.actions--;
    if (this.actions == 0){
      this.endTurn();
    }
  }

  pay() {
    if (!this.from || !this.to || !this.amount) return;
    this.statusMessage = this.gameService.pay(this.from, this.to, this.amount);
    this.decisionState = "paying";
  }
  
  selectCard(player: Player, card: Card) {
    this.gameService.selectCardForPayment(player, card);
}

  // Helper function to get the total available money/property a player can pay
  getTotalPayableAmount(player: Player): number {
    let bankTotal = player.bank.reduce((sum, card) => sum + (card.value || 0), 0);
    let propertyTotal = player.properties.reduce((sum, card) => sum + (card.value || 0), 0);
    return bankTotal + propertyTotal;
  }

  endTurn(){
    this.actions = 3;
    this.gameService.endTurn();
  }

  getBankTotal(player: Player): number {
    return player.bank.reduce((sum, card) => sum + (card.value || 0), 0);
  }

  addToBank(player: Player, card: Card) {
    if (player.id != this.currentPlayer?.id) {
      console.log("not your turn");
      return
    }
    if (card.type === 'action') {
      player.bank.push(card);
      player.hand = player.hand.filter(c => c !== card); 
      this.decrementActions()
    }
  }

}
