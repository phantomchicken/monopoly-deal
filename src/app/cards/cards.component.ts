import { Component, OnInit } from '@angular/core';
import { CardService } from 'src/app/card.service';
import { Card } from '../classes/card';

@Component({
  selector: 'app-cards',
  templateUrl: './cards.component.html',
  styleUrls: ['./cards.component.css']
})
export class CardsComponent implements OnInit {

  constructor(private cardService: CardService) { }

  public cards: Card[] = [];
  ngOnInit(): void {
    var cards = this.cardService.getCards().then(cards => {
      this.cards = this.shuffle(cards);
    });
  }

  isActionCard(card: Card): boolean {
    return false;
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
