import { Component, OnInit } from '@angular/core';
import { CardServiceService } from 'src/card-service.service';
import { Card } from '../classes/card';

@Component({
  selector: 'app-cards',
  templateUrl: './cards.component.html',
  styleUrls: ['./cards.component.css']
})
export class CardsComponent implements OnInit {

  constructor(private cardService: CardServiceService) { }

  public cards: Card[] = [];
  ngOnInit(): void {
    var cards = this.cardService.getCards().then(cards => {
      console.log(cards);
      this.cards = cards;
    });
  }

}
