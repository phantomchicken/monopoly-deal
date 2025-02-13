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
  ngOnInit(): void {
  }

  setup(){
    this.gameService.setup(this.name, this.numberOfPlayers);
    this.players = this.gameService.game.players;
    this.start = true;
    this.deck = this.gameService.game.deck;
  }

}
