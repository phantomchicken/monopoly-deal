import { Component, OnInit } from '@angular/core';
import { GameService } from '../game.service';
import { Player } from '../classes/player';
import { Card } from '../classes/card';

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
    this.gameService.playCard(player, card);
    this.actions--;
    if (this.actions == 0){
      this.endTurn();
    }
  }

  endTurn(){
    this.gameService.endTurn();
  }

  getBankTotal(player: Player): number {
    return player.bank.reduce((sum, card) => sum + (card.value || 0), 0);
  }

  // getDiscardImageName(){}

}
