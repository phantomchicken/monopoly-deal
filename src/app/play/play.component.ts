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

  statusMessage: string | null = null;
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
    this.actions--;
    if (this.actions == 0){
      this.endTurn();
    }
  }

  pay() {
  if (!this.from || !this.to || !this.amount || this.getTotalPayableAmount(this.from) == 0) return;
  
  this.statusMessage = `${this.from.name}, select a card from your properties or bank to pay ${this.amount} to ${this.to.name}.`;
  this.decisionState = "paying"; 
}

  selectCard(player: Player, card: Card) {
    if (this.decisionState !== "paying" || !this.from || !this.to) return;
    if (player.id !== this.from.id) return; // Only the paying player can choose
    
    let cardValue = card.value || 0;
    let paid = false;

    if (this.from.bank.includes(card)) {
      this.from.bank = this.from.bank.filter(c => c !== card);
      this.to.bank.push(card);
      paid = true;
    } else if (this.from.properties.includes(card as PropertyCard)) {
      this.from.properties = this.from.properties.filter(c => c !== card);
      this.to.properties.push(card as PropertyCard);
      paid = true;
    }

    if (paid) {
      this.amount -= cardValue;
      if (this.amount <= 0) {
        // Payment completed
        this.statusMessage = `Payment complete! ${this.to.name} received payment.`;
        this.decisionState = null;
        this.selectedCard = null;
      } else if (this.getTotalPayableAmount(this.from) === 0) {
        // Not enough to pay full amount, but player has no more payment options
        this.statusMessage = `Payment complete! ${this.to.name} received what was available.`;
        this.decisionState = null;
        this.selectedCard = null;
      }
    }
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


}
