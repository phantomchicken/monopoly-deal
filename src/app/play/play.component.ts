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

  isDebtCollectorSelectable = false;
  selectedDebtPlayer: Player | null = null;

  isPropertySelectable = false;
  isForcedDealActive = false;
  selectedProperty: PropertyCard | null = null;

  isSelectingPropertySetForBuilding = false;
  buildingType: string | null = null;

  targetPlayerForJustSayNo: Player | null = null;
  pendingActionCard: Card | null = null;
  
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

    this.gameService.isDebtCollectorSelectable$.subscribe(isSelectable => {
      this.isDebtCollectorSelectable = isSelectable;
    });

    this.gameService.selectedDebtPlayer$.subscribe(player => {
      this.selectedDebtPlayer = player;
    });

    this.gameService.propertySelectable$.subscribe(isSelectable => {
      this.isPropertySelectable = isSelectable;
    });

    this.gameService.forcedDealActive$.subscribe(isActive => {
      this.isForcedDealActive = isActive;
    });

    this.gameService.selectedProperty$.subscribe(property => {
      this.selectedProperty = property;
    });
  
    this.gameService.actionComplete$.subscribe(complete => {
      if (complete) {
        this.decrementActions();
        this.gameService.actionCompleteSubject.next(false); // Reset the flag
      }
    });

    this.gameService.isSelectingPropertySetForBuilding$.subscribe(isSelecting => {
      this.isSelectingPropertySetForBuilding = isSelecting;
    });
    
    this.gameService.buildingType$.subscribe(type => {
      this.buildingType = type;
    });

    this.gameService.isJustSayNoActive$.subscribe(isActive => {
      if (isActive) {
        this.targetPlayerForJustSayNo = isActive?.from ?? null;
      }
    })
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

    const wasLastDiscard = this.gameService.discardAmount === 1;
    const isInteractiveCard = this.gameService.isInteractiveCard(card);

    this.gameService.playCard(player, card);
    
    if (!wasLastDiscard && !isInteractiveCard && this.decisionState !== "paying") {
      this.decrementActions()
    }
  }

  decrementActions() {
    if (this.gameService.discardAmount === 0) {
      this.actions--;
      if (this.actions == 0){
        this.endTurn();
      }
    }
  }

  pay() {
    if (!this.from || !this.to || !this.amount) return;
    this.statusMessage = this.gameService.pay(this.from, this.to, this.amount);
    this.decisionState = "paying";
  }
  
  selectCard(player: Player, card: Card) {
    // If we're in payment mode
    if (this.decisionState === 'paying') {
      this.gameService.selectCardForPayment(player, card);
    }
    // If we're selecting property for Forced Deal
    else if (this.isPropertySelectable && card.type === 'property') {
      // If selecting target property
      if (!this.selectedProperty) {
        this.gameService.selectTargetProperty(player, card as PropertyCard);
      }
      // If selecting own property for swap
      else if (this.isForcedDealActive && player === this.currentPlayer) {
        this.gameService.selectOwnProperty(card as PropertyCard);
      }
    } else if (this.isSelectingPropertySetForBuilding && player === this.currentPlayer && card.type === 'property') {
      this.gameService.selectPropertySetForBuilding(card as PropertyCard);
    }
  }

  sortProperties(player:Player){
    return player.properties.sort((a, b) => this.gameService.getCurrentColor(a).localeCompare(this.gameService.getCurrentColor(b)));
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

  selectDebtCollector(player: Player) {
    this.gameService.selectDebtCollector(player);
  }

  selectTargetProperty(player: Player, property: PropertyCard) {
    this.gameService.selectTargetProperty(player, property);
  }

  selectOwnProperty(property: PropertyCard) {
    this.gameService.selectOwnProperty(property);
  }

  flip(card: Card){
    this.gameService.flip(card)
  }

  isFlipped(card:Card){
    const propertyCard = card as PropertyCard;
    propertyCard.currentColor ??= propertyCard.colors[0]; // set to first color initially
    return propertyCard.currentColor === propertyCard.colors[1];
  }

  isWildcard(card:Card){
    let name = card.name.toLowerCase();
    return /wildcard/.test(name) && /&/.test(name);
  }

  isWildcardProper(card: Card): boolean {
    const name = card.name.toLowerCase();
    const propertyCard = card as PropertyCard;
    return /wildcard/.test(name) && propertyCard.colors.length > 2; // True wildcards have more than 2 colors
  }
  
  changeColor(card: Card, color: string) {
    this.gameService.changeCurrentColor(card, color);
  }

  sayNo(useJustSayNo: boolean) {
    // if (!this.targetPlayerForJustSayNo) return;
    
    // Pass the decision to the service
    this.gameService.sayNo(useJustSayNo);
    
    // Reset local state
    this.targetPlayerForJustSayNo = null;
  }
  
}
