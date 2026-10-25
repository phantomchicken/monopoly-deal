import { Injectable } from '@angular/core';
import { Game } from './classes/game';
import { Player } from './classes/player';
import { Card, PropertyCard } from './classes/card';
import { CardService } from 'src/app/card.service';
import { BehaviorSubject, Observable } from 'rxjs';
import { COLOR_RENT_MAP } from './color-rent-map';

export interface JustSayNoState {
  from: Player;             // Target / victim player who has Just Say No
  to: Player;               // Attacking player who played the action
  amount: number;           // Payment amount (if rent / birthday / debt)
  fromCards: PropertyCard[];// Properties being targeted from victim
  toCards: PropertyCard[];  // Properties offered in swap (for Forced Deal)
  actionType: 'payment' | 'sly-deal' | 'forced-deal' | 'dealbreaker';
}

@Injectable({
  providedIn: 'root'
})
export class GameService {

  constructor(private cardService: CardService) { }

  public game: Game = new Game();
  public playerNames = ['Myra', 'Ariana', 'Bojan', 'Kemal'];
  public playerIndex: number = 0;
  public currentPlayer: Player | undefined;
  public propertySetSizes = require('../assets/sets.json');
  public discardAmount: number = 0;

  decisionState: 'playing' | 'paying' | null = null;
  selectedCard: Card | null = null;
  paymentState: { from: Player, to: Player, amount: number } | null = null;
  paymentQueue: { from: Player, to: Player, amount: number }[] = [];
  propertySetSizeMap: Map<string, number> = new Map<string, number>();
  isDoubleTheRent: boolean = false;
  pendingBuildingCard: Card | null = null;
  currentActionCard: Card | null = null;

  // Actions counter as Single Source of Truth
  private actionsSubject = new BehaviorSubject<number>(3);
  actions$ = this.actionsSubject.asObservable();

  get actions(): number {
    return this.actionsSubject.value;
  }

  set actions(val: number) {
    this.actionsSubject.next(val);
  }

  private deckSubject = new BehaviorSubject<Card[]>([]);
  deck$ = this.deckSubject.asObservable();

  private discardSubject = new BehaviorSubject<Card[]>([]);
  discard$ = this.discardSubject.asObservable();

  private currentPlayerSubject = new BehaviorSubject<Player | undefined>(undefined);
  currentPlayer$ = this.currentPlayerSubject.asObservable();

  private paymentStateSubject = new BehaviorSubject<{ from: Player, to: Player, amount: number } | null>(null);
  paymentState$ = this.paymentStateSubject.asObservable();

  private statusMessageSubject = new BehaviorSubject<string | null>(null);
  statusMessage$ = this.statusMessageSubject.asObservable();

  private paymentQueueSubject = new BehaviorSubject<{ from: Player, to: Player, amount: number }[]>([]);
  paymentQueue$ = this.paymentQueueSubject.asObservable();

  private isDebtCollectorSelectableSubject = new BehaviorSubject<boolean>(false);
  isDebtCollectorSelectable$ = this.isDebtCollectorSelectableSubject.asObservable();

  private selectedDebtPlayerSubject = new BehaviorSubject<Player | null>(null);
  selectedDebtPlayer$ = this.selectedDebtPlayerSubject.asObservable();

  private isPropertySelectableSubject = new BehaviorSubject<boolean>(false);
  propertySelectable$ = this.isPropertySelectableSubject.asObservable();

  private isForcedDealActiveSubject = new BehaviorSubject<boolean>(false);
  forcedDealActive$ = this.isForcedDealActiveSubject.asObservable();

  private selectedPropertySubject = new BehaviorSubject<PropertyCard | null>(null);
  selectedProperty$ = this.selectedPropertySubject.asObservable();

  private selectedTargetPlayerSubject = new BehaviorSubject<Player | null>(null);
  selectedTargetPlayer$ = this.selectedTargetPlayerSubject.asObservable();

  public actionCompleteSubject = new BehaviorSubject<boolean>(false);
  actionComplete$ = this.actionCompleteSubject.asObservable();

  private isSelectingPropertySetForBuildingSubject = new BehaviorSubject<boolean>(false);
  isSelectingPropertySetForBuilding$ = this.isSelectingPropertySetForBuildingSubject.asObservable();

  private buildingTypeSubject = new BehaviorSubject<string | null>(null);
  buildingType$ = this.buildingTypeSubject.asObservable();

  private isJustSayNoActiveSubject = new BehaviorSubject<JustSayNoState | undefined>(undefined);
  isJustSayNoActive$ = this.isJustSayNoActiveSubject.asObservable();

  setup(name: string, numberOfPlayers: number) {
    if (this.game.players.length === 0) {
      this.playerNames.unshift(name);

      for (let i = 0; i < numberOfPlayers; i++) {
        let playerName = this.playerNames[i];
        this.game.players.push(new Player(i + 1, playerName));
      }

      this.propertySetSizeMap = new Map(
        this.propertySetSizes.map((p: { color: string; setSize: number }) => [p.color, p.setSize])
      );
    }

    this.cardService.getCards().subscribe((cards) => {
      this.game.deck = this.shuffle([...cards]);
      this.deckSubject.next(this.game.deck);

      this.draw(this.game.players[0], 7);
      for (let i = 1; i < numberOfPlayers; i++) {
        this.draw(this.game.players[i], 5);
      }

      this.playerIndex = 0;
      this.currentPlayer = this.game.players[0];
      this.currentPlayerSubject.next(this.game.players[0]);
      this.actionsSubject.next(3);
      this.statusMessageSubject.next(`Game started! ${this.currentPlayer.name}'s turn.`);
    });
  }

  decrementAction() {
    // Discarding after turn never consumes player actions
    if (this.discardAmount > 0) return;

    const remaining = this.actionsSubject.value - 1;
    this.actionsSubject.next(remaining);

    if (remaining <= 0) {
      this.endTurn();
    }
  }

  endTurn() {
    const current = this.game.players[this.playerIndex];

    // If player has more than 7 cards, prompt to discard excess cards before advancing
    if (current && current.hand.length > 7) {
      this.discardAmount = current.hand.length - 7;
      this.statusMessageSubject.next(`${current.name} has more than 7 cards (${current.hand.length}). Please discard ${this.discardAmount} card(s).`);
      return;
    }

    this.discardAmount = 0;
    this.playerIndex = (this.playerIndex + 1) % this.game.players.length;
    const nextPlayer = this.game.players[this.playerIndex];

    // Draw cards for the new player's turn (5 if hand is empty, else 2)
    if (nextPlayer.hand.length === 0) {
      this.draw(nextPlayer, 5);
    } else {
      this.draw(nextPlayer, 2);
    }

    this.currentPlayer = nextPlayer;
    this.currentPlayerSubject.next(nextPlayer);
    this.actionsSubject.next(3);
    this.isDoubleTheRent = false;
    this.resetPropertySelection();
    this.isJustSayNoActiveSubject.next(undefined);
    this.decisionState = 'playing';
    this.statusMessageSubject.next(`${nextPlayer.name}'s turn!`);
  }

  playCard(player: Player, card: Card) {
    // 1. Discard mode (when hand > 7 at turn end)
    if (this.discardAmount > 0) {
      this.game.discard.push(card);
      this.discardSubject.next(this.game.discard);
      const cardIdx = player.hand.indexOf(card);
      if (cardIdx !== -1) {
        player.hand.splice(cardIdx, 1);
      }
      this.discardAmount--;
      if (this.discardAmount === 0) {
        this.statusMessageSubject.next(null);
        this.endTurn();
      } else {
        this.statusMessageSubject.next(`${player.name} must discard ${this.discardAmount} more card(s).`);
      }
      return;
    }

    if (this.actionsSubject.value <= 0) {
      this.statusMessageSubject.next('No actions remaining! Please pass your turn.');
      return;
    }

    if (this.decisionState === 'paying') {
      this.statusMessageSubject.next('Please finish resolving active payments first.');
      return;
    }

    const cardIndex = player.hand.indexOf(card);
    if (cardIndex === -1) return;

    switch (card.type) {
      case 'property': {
        const propCard = card as PropertyCard;
        player.properties.push(propCard);
        player.hand.splice(cardIndex, 1);
        this.statusMessageSubject.next(`${player.name} played ${propCard.name}.`);
        this.decrementAction();
        break;
      }
      case 'money': {
        player.bank.push(card);
        player.hand.splice(cardIndex, 1);
        this.statusMessageSubject.next(`${player.name} added ${card.value}M to bank.`);
        this.decrementAction();
        break;
      }
      case 'action': {
        const success = this.playActionCard(card);
        if (!success) {
          // Card could not be played, keep it in hand
          return;
        }
        player.hand.splice(cardIndex, 1);
        if (card.name !== 'House' && card.name !== 'Hotel') {
          this.game.discard.push(card);
          this.discardSubject.next(this.game.discard);
        }
        break;
      }
    }

    if (this.fullSets(player) >= 3) {
      this.statusMessageSubject.next(`${player.name} has three completed full sets and has won the game! 🎉`);
    }
  }

  bankActionCard(player: Player, card: Card) {
    if (player.id !== this.game.players[this.playerIndex]?.id) {
      this.statusMessageSubject.next('Not your turn!');
      return;
    }
    if (this.discardAmount > 0) {
      this.statusMessageSubject.next('You must discard cards to end your turn!');
      return;
    }
    if (this.actionsSubject.value <= 0) {
      this.statusMessageSubject.next('No actions left!');
      return;
    }
    if (card.type === 'action') {
      player.bank.push(card);
      player.hand = player.hand.filter(c => c !== card);
      this.statusMessageSubject.next(`${player.name} banked ${card.name} as ${card.value}M.`);
      this.decrementAction();
    }
  }

  fullSets(player: Player): number {
    let sets = 0;
    this.propertySetSizeMap.forEach((setSize, color) => {
      const count = player.properties.filter(p => this.getCurrentColor(p) === color).length;
      if (count >= setSize) {
        sets++;
      }
    });
    return sets;
  }

  playerHasJustSayNo(player: Player): boolean {
    return player.hand.some(card => card.name === 'Just Say No');
  }

  playActionCard(card: Card): boolean {
    const currentPlayer = this.game.players[this.playerIndex];
    const otherPlayers = this.game.players.filter(p => p !== currentPlayer);

    switch (card.name) {
      case 'Pass Go':
        this.draw(currentPlayer, 2);
        this.statusMessageSubject.next(`${currentPlayer.name} played Pass Go and drew 2 cards.`);
        this.decrementAction();
        return true;

      case 'Double The Rent':
        this.isDoubleTheRent = true;
        this.statusMessageSubject.next(`${currentPlayer.name} is doubling their next rent card!`);
        this.decrementAction();
        return true;

      case "It's My Birthday":
        this.currentActionCard = card;
        let anyPayers = false;
        otherPlayers.forEach(p => {
          if (this.getTotalPayableAmount(p) > 0) {
            this.paymentQueue.push({ from: p, to: currentPlayer, amount: 2 });
            anyPayers = true;
          }
        });

        this.statusMessageSubject.next(`It's ${currentPlayer.name}'s Birthday! Everyone owes 2M.`);
        this.paymentQueueSubject.next(this.paymentQueue);
        this.processNextPayment();
        return true;

      case 'Debt Collector': {
        const canPay = otherPlayers.some(p => this.getTotalPayableAmount(p) > 0);
        if (otherPlayers.length === 0) {
          this.statusMessageSubject.next('No opponents available!');
          return false;
        }
        this.currentActionCard = card;
        this.isDebtCollectorSelectableSubject.next(true);
        this.statusMessageSubject.next('Choose a player to pay you 5M.');
        return true;
      }

      case 'Sly Deal': {
        const anyStealable = otherPlayers.some(p => {
          return p.properties.some(prop => {
            const color = this.getCurrentColor(prop);
            const setSize = this.propertySetSizeMap.get(color) || COLOR_RENT_MAP.get(color)?.setSize || 0;
            const count = p.properties.filter(cp => this.getCurrentColor(cp) === color).length;
            return count < setSize; // Can only steal if not part of a full set
          });
        });

        if (!anyStealable) {
          this.statusMessageSubject.next('No opponents have stealable properties outside completed sets!');
          return false;
        }

        this.currentActionCard = card;
        this.isPropertySelectableSubject.next(true);
        this.isForcedDealActiveSubject.next(false);
        this.statusMessageSubject.next('Select an opponent property to steal (cannot steal from full sets).');
        return true;
      }

      case 'Forced Deal': {
        if (currentPlayer.properties.length === 0) {
          this.statusMessageSubject.next('You need at least one property of your own to make a swap!');
          return false;
        }
        const anyStealable = otherPlayers.some(p => {
          return p.properties.some(prop => {
            const color = this.getCurrentColor(prop);
            const setSize = this.propertySetSizeMap.get(color) || COLOR_RENT_MAP.get(color)?.setSize || 0;
            const count = p.properties.filter(cp => this.getCurrentColor(cp) === color).length;
            return count < setSize;
          });
        });

        if (!anyStealable) {
          this.statusMessageSubject.next('No opponents have eligible properties to swap!');
          return false;
        }

        this.currentActionCard = card;
        this.isPropertySelectableSubject.next(true);
        this.isForcedDealActiveSubject.next(true);
        this.statusMessageSubject.next('Select an opponent property to swap.');
        return true;
      }

      case 'Deal Breaker': {
        const anyFullSet = otherPlayers.some(p => this.fullSets(p) > 0);
        if (!anyFullSet) {
          this.statusMessageSubject.next('No opponents have completed full sets to steal!');
          return false;
        }
        this.currentActionCard = card;
        this.isPropertySelectableSubject.next(true);
        this.isForcedDealActiveSubject.next(false);
        this.statusMessageSubject.next('Select a property from a completed set to steal the entire set.');
        return true;
      }

      case 'House':
      case 'Hotel': {
        if (this.fullSets(currentPlayer) < 1) {
          this.statusMessageSubject.next(`You must have at least one full property set to play a ${card.name}!`);
          return false;
        }
        this.currentActionCard = card;
        this.pendingBuildingCard = card;
        this.isSelectingPropertySetForBuildingSubject.next(true);
        this.buildingTypeSubject.next(card.name);
        this.statusMessageSubject.next(`Select a completed property set to add ${card.name} to.`);
        return true;
      }

      case 'Just Say No':
        this.statusMessageSubject.next('Just Say No can only be played in response to an action, or banked as money (4M).');
        return false;

      default:
        // Handle Rent cards (e.g., "Rent Pink & Orange", "Rent Wildcard")
        if (/Rent/.test(card.name)) {
          let name = card.name.toLowerCase().replace('rent ', '');
          let colors = name === 'wildcard'
            ? ['red', 'orange', 'dark green', 'light green', 'black', 'dark blue', 'light blue', 'yellow', 'pink', 'brown']
            : name.split(' & ');

          let ownedProperties = currentPlayer.properties.filter(p => colors.some(color => p.colors.includes(color)));

          if (ownedProperties.length === 0) {
            this.statusMessageSubject.next(`You do not own any properties matching ${card.name}!`);
            return false;
          }

          let maxRent = 0;
          const propertiesByColor = new Map<string, PropertyCard[]>();
          ownedProperties.forEach((property) => {
            const color = this.getCurrentColor(property);
            propertiesByColor.set(color, [...(propertiesByColor.get(color) || []), property]);
          });

          propertiesByColor.forEach((properties, color) => {
            const propertyCount = properties.length;
            const colorInfo = COLOR_RENT_MAP.get(color);
            const rentValues = colorInfo?.rentValues || properties[0].rentValues || [];
            const maxIdx = Math.min(propertyCount, colorInfo?.setSize || rentValues.length) - 1;
            const baseRent = rentValues[maxIdx] || 0;
            let bonus = 0;

            const setBuildings = properties[0].buildings;
            if (setBuildings?.house) bonus += 3;
            if (setBuildings?.hotel) bonus += 4;

            const totalRent = baseRent + bonus;
            if (totalRent > maxRent) maxRent = totalRent;
          });

          if (this.isDoubleTheRent) {
            maxRent *= 2;
            this.isDoubleTheRent = false;
          }

          if (maxRent <= 0) {
            this.statusMessageSubject.next('Rent amount is 0M.');
            this.decrementAction();
            return true;
          }

          this.currentActionCard = card;
          otherPlayers.forEach(p => {
            if (this.getTotalPayableAmount(p) > 0) {
              this.paymentQueue.push({ from: p, to: currentPlayer, amount: maxRent });
            }
          });

          this.statusMessageSubject.next(`${currentPlayer.name} charged ${maxRent}M rent!`);
          this.paymentQueueSubject.next(this.paymentQueue);
          this.processNextPayment();
          return true;
        }
        return false;
    }
  }

  selectDebtCollector(player: Player) {
    const currentPlayer = this.game.players[this.playerIndex];
    if (!this.isDebtCollectorSelectableSubject.value || player === currentPlayer) {
      return;
    }

    this.selectedDebtPlayerSubject.next(player);
    this.isDebtCollectorSelectableSubject.next(false);

    if (this.getTotalPayableAmount(player) === 0) {
      this.statusMessageSubject.next(`${player.name} has no money or properties to pay!`);
      this.decrementAction();
      return;
    }

    this.paymentQueue.push({ from: player, to: currentPlayer, amount: 5 });
    this.paymentQueueSubject.next(this.paymentQueue);
    this.processNextPayment();
  }

  draw(player: Player, numberOfCards: number) {
    if (numberOfCards > this.game.deck.length) {
      const recycled = this.shuffle([...this.game.discard]);
      this.game.deck = this.game.deck.concat(recycled);
      this.game.discard = [];
      this.discardSubject.next(this.game.discard);
    }
    let cards = this.game.deck.slice(0, numberOfCards);
    player.hand = player.hand.concat(cards);
    this.game.deck = this.game.deck.slice(numberOfCards);
    this.deckSubject.next(this.game.deck);
  }

  shuffle(cards: Card[]): Card[] {
    let currentIndex = cards.length;
    while (currentIndex > 1) {
      currentIndex--;
      let randomIndex = Math.floor(Math.random() * currentIndex);
      [cards[currentIndex], cards[randomIndex]] = [cards[randomIndex], cards[currentIndex]];
    }
    return cards;
  }

  pay(from: Player, to: Player, amount: number) {
    if (!from || !to || amount <= 0 || this.getTotalPayableAmount(from) === 0) return;
    this.paymentState = { from, to, amount };
    this.paymentStateSubject.next(this.paymentState);
    this.statusMessageSubject.next(`${from.name}, select a card to pay ${amount}M to ${to.name}.`);
    return `${from.name}, select a card to pay ${amount}M to ${to.name}.`;
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
    } else if (card.name === 'Hotel' || card.name === 'House') {
      for (let property of from.properties) {
        if (property.buildings?.hotel === card) {
          property.buildings.hotel = null;
        }
        if (property.buildings?.house === card) {
          property.buildings.house = null;
        }
      }
      to.bank.push(card);
      paid = true;
    }

    if (paid) {
      this.paymentQueue[0].amount -= cardValue;
      if (this.paymentQueue[0].amount <= 0 || this.getTotalPayableAmount(from) === 0) {
        this.statusMessageSubject.next(`Payment complete! ${to.name} received payment.`);
        this.paymentQueue.shift();
        this.paymentQueueSubject.next(this.paymentQueue);
        this.processNextPayment();
      } else {
        this.statusMessageSubject.next(`${from.name}, continue selecting cards to cover ${this.paymentQueue[0].amount}M.`);
        this.decisionState = 'paying';
      }
    }
    this.resetPropertySelection();
  }

  processNextPayment() {
    // Purge any debtor with nothing left to pay
    while (this.paymentQueue.length && this.getTotalPayableAmount(this.paymentQueue[0].from) === 0) {
      const skipped = this.paymentQueue.shift();
      this.statusMessageSubject.next(`${skipped?.from.name} has nothing to pay.`);
    }

    this.paymentQueueSubject.next(this.paymentQueue);

    if (this.paymentQueue.length) {
      let { from, to, amount } = this.paymentQueue[0];
      this.decisionState = 'paying';
      this.statusMessageSubject.next(`${from.name}, select a card to pay ${amount}M to ${to.name}.`);

      if (this.playerHasJustSayNo(from)) {
        this.isJustSayNoActiveSubject.next({
          from,
          to,
          amount,
          fromCards: [],
          toCards: [],
          actionType: 'payment'
        });
      } else {
        this.isJustSayNoActiveSubject.next(undefined);
      }
    } else {
      this.statusMessageSubject.next(null);
      this.isJustSayNoActiveSubject.next(undefined);
      this.decisionState = 'playing';
      this.actionCompleteSubject.next(true);
      this.decrementAction();
    }
  }

  getTotalPayableAmount(player: Player): number {
    let bankTotal = player.bank.reduce((sum, card) => sum + (card.value || 0), 0);
    let propertyTotal = player.properties.reduce((sum, card) => sum + (card.value || 0), 0);
    return bankTotal + propertyTotal;
  }

  selectTargetProperty(player: Player, property: PropertyCard) {
    if (!this.isPropertySelectableSubject.value) return;

    const currentPlayer = this.game.players[this.playerIndex];
    if (player === currentPlayer) return;

    const color = this.getCurrentColor(property);
    const setSize = this.propertySetSizeMap.get(color) || COLOR_RENT_MAP.get(color)?.setSize || 0;
    const sameColorProps = player.properties.filter(p => this.getCurrentColor(p) === color);
    const isFullSet = sameColorProps.length >= setSize;

    // Handle Deal Breaker
    if (this.currentActionCard?.name === 'Deal Breaker') {
      if (!isFullSet) {
        this.statusMessageSubject.next('You can only steal a FULL completed set with Deal Breaker!');
        return;
      }

      // Check if target player has Just Say No
      if (this.playerHasJustSayNo(player)) {
        this.isJustSayNoActiveSubject.next({
          from: player,
          to: currentPlayer,
          amount: 0,
          fromCards: [...sameColorProps],
          toCards: [],
          actionType: 'dealbreaker'
        });
        this.statusMessageSubject.next(`${currentPlayer.name} wants to steal ${player.name}'s ${color} set. Say No?`);
      } else {
        // Execute set steal immediately
        player.properties = player.properties.filter(p => this.getCurrentColor(p) !== color);
        currentPlayer.properties.push(...sameColorProps);
        this.statusMessageSubject.next(`${currentPlayer.name} stole the complete ${color} set from ${player.name}!`);
        this.resetPropertySelection();
        this.decrementAction();
      }
      return;
    }

    // For Sly Deal and Forced Deal, stealing from a full set is NOT allowed
    if (isFullSet) {
      this.statusMessageSubject.next('Cannot steal or swap cards from a completed full set!');
      return;
    }

    // Handle Forced Deal - Step 1: Select opponent property
    if (this.currentActionCard?.name === 'Forced Deal') {
      this.selectedTargetPlayerSubject.next(player);
      this.selectedPropertySubject.next(property);
      this.statusMessageSubject.next(`Selected ${property.name}. Now select one of your properties to swap.`);
      return;
    }

    // Handle Sly Deal - Steal single property
    if (this.currentActionCard?.name === 'Sly Deal') {
      if (this.playerHasJustSayNo(player)) {
        this.isJustSayNoActiveSubject.next({
          from: player,
          to: currentPlayer,
          amount: 0,
          fromCards: [property],
          toCards: [],
          actionType: 'sly-deal'
        });
        this.statusMessageSubject.next(`${currentPlayer.name} wants to steal ${property.name} from ${player.name}. Say No?`);
      } else {
        player.properties = player.properties.filter(p => p !== property);
        currentPlayer.properties.push(property);
        this.statusMessageSubject.next(`${currentPlayer.name} stole ${property.name} from ${player.name}!`);
        this.resetPropertySelection();
        this.decrementAction();
      }
    }
  }

  selectOwnProperty(property: PropertyCard) {
    if (!this.isForcedDealActiveSubject.value || !this.selectedPropertySubject.value) return;

    const currentPlayer = this.game.players[this.playerIndex];
    const targetPlayer = this.selectedTargetPlayerSubject.value;
    const targetProperty = this.selectedPropertySubject.value;

    if (targetPlayer && targetProperty) {
      // Check if target player (victim) has Just Say No
      if (this.playerHasJustSayNo(targetPlayer)) {
        this.isJustSayNoActiveSubject.next({
          from: targetPlayer,
          to: currentPlayer,
          amount: 0,
          fromCards: [targetProperty],
          toCards: [property],
          actionType: 'forced-deal'
        });
        this.statusMessageSubject.next(`${currentPlayer.name} wants to swap ${property.name} for ${targetPlayer.name}'s ${targetProperty.name}. Say No?`);
      } else {
        // Execute swap immediately
        currentPlayer.properties = currentPlayer.properties.filter(p => p !== property);
        targetPlayer.properties = targetPlayer.properties.filter(p => p !== targetProperty);
        currentPlayer.properties.push(targetProperty);
        targetPlayer.properties.push(property);

        this.statusMessageSubject.next(`${currentPlayer.name} swapped ${property.name} for ${targetPlayer.name}'s ${targetProperty.name}.`);
        this.resetPropertySelection();
        this.decrementAction();
      }
    }
  }

  public resetPropertySelection() {
    this.isPropertySelectableSubject.next(false);
    this.isForcedDealActiveSubject.next(false);
    this.selectedPropertySubject.next(null);
    this.selectedTargetPlayerSubject.next(null);
    this.currentActionCard = null;
  }

  isInteractiveCard(card: Card): boolean {
    if (card.type !== 'action') return false;
    switch (card.name) {
      case 'Debt Collector':
      case 'Sly Deal':
      case 'Forced Deal':
      case 'Deal Breaker':
      case 'House':
      case 'Hotel':
        return true;
      default:
        return false;
    }
  }

  flip(card: Card) {
    const propertyCard = card as PropertyCard;
    if (!propertyCard.currentColor) {
      propertyCard.currentColor = propertyCard.colors[0];
    }
    propertyCard.currentColor = propertyCard.currentColor === propertyCard.colors[0] ? propertyCard.colors[1] : propertyCard.colors[0];

    const colorInfo = COLOR_RENT_MAP.get(propertyCard.currentColor);
    if (colorInfo) {
      propertyCard.rentValues = colorInfo.rentValues;
      propertyCard.setSize = colorInfo.setSize;
    }
  }

  getCurrentColor(card: PropertyCard): string {
    let name = card.name.toLowerCase();
    if (/wildcard/.test(name)) {
      if (!card.currentColor) {
        card.currentColor = card.colors[0];
      }
      return card.currentColor;
    } else {
      return card.colors[0];
    }
  }

  changeCurrentColor(card: Card, newColor: string) {
    const propCard = card as PropertyCard;
    if (propCard.colors.includes(newColor)) {
      propCard.currentColor = newColor;
      const colorInfo = COLOR_RENT_MAP.get(newColor);
      if (colorInfo) {
        propCard.rentValues = colorInfo.rentValues;
        propCard.setSize = colorInfo.setSize;
      }
    }
  }

  selectPropertySetForBuilding(property: PropertyCard) {
    const currentPlayer = this.game.players[this.playerIndex];
    const color = this.getCurrentColor(property);

    if (color === 'black' || color === 'light green') {
      this.statusMessageSubject.next('Houses and Hotels cannot be added to Railroads or Utilities!');
      return;
    }

    const setProperties = currentPlayer.properties.filter(p => this.getCurrentColor(p) === color);
    const setSize = this.propertySetSizeMap.get(color) || COLOR_RENT_MAP.get(color)?.setSize || 0;

    if (setProperties.length < setSize) {
      this.statusMessageSubject.next('This is not a full property set!');
      return;
    }

    const targetProperty = setProperties[0];
    if (!targetProperty.buildings) {
      targetProperty.buildings = { house: null, hotel: null };
    }

    const buildingType = this.buildingTypeSubject.value;

    if (buildingType === 'House') {
      if (targetProperty.buildings.house) {
        this.statusMessageSubject.next('This set already has a House!');
        return;
      }
      targetProperty.buildings.house = this.pendingBuildingCard;
    } else if (buildingType === 'Hotel') {
      if (!targetProperty.buildings.house) {
        this.statusMessageSubject.next('You must have a House on this set before adding a Hotel!');
        return;
      }
      if (targetProperty.buildings.hotel) {
        this.statusMessageSubject.next('This set already has a Hotel!');
        return;
      }
      targetProperty.buildings.hotel = this.pendingBuildingCard;
    }

    this.pendingBuildingCard = null;
    this.isSelectingPropertySetForBuildingSubject.next(false);
    this.statusMessageSubject.next(`Added ${buildingType} to ${color} set!`);
    this.buildingTypeSubject.next(null);
    this.decrementAction();
  }

  sayNo(useJustSayNo: boolean) {
    const activeState = this.isJustSayNoActiveSubject.value;
    if (!activeState) return;

    const { from, to, amount, fromCards, toCards, actionType } = activeState;

    if (useJustSayNo) {
      // Discard Just Say No from defender's hand
      const jsnIdx = from.hand.findIndex(c => c.name === 'Just Say No');
      if (jsnIdx !== -1) {
        const [jsnCard] = from.hand.splice(jsnIdx, 1);
        this.game.discard.push(jsnCard);
        this.discardSubject.next(this.game.discard);
      }

      this.statusMessageSubject.next(`${from.name} played Just Say No! The action was cancelled.`);

      if (actionType === 'payment') {
        // Remove defender from payment queue
        this.paymentQueue = this.paymentQueue.filter(p => !(p.from === from && p.to === to && p.amount === amount));
        this.paymentQueueSubject.next(this.paymentQueue);
        this.isJustSayNoActiveSubject.next(undefined);
        this.processNextPayment();
      } else {
        // The action card attack was negated; attacker still used their action
        this.resetPropertySelection();
        this.isJustSayNoActiveSubject.next(undefined);
        this.decrementAction();
      }
    } else {
      // Defender accepts the action
      this.isJustSayNoActiveSubject.next(undefined);

      if (actionType === 'payment') {
        this.statusMessageSubject.next(`${from.name}, select a card to pay ${amount}M to ${to.name}.`);
      } else if (actionType === 'dealbreaker') {
        const color = this.getCurrentColor(fromCards[0]);
        from.properties = from.properties.filter(p => this.getCurrentColor(p) !== color);
        to.properties.push(...fromCards);
        this.statusMessageSubject.next(`${to.name} stole the ${color} set from ${from.name}!`);
        this.resetPropertySelection();
        this.decrementAction();
      } else if (actionType === 'sly-deal') {
        const stolen = fromCards[0];
        from.properties = from.properties.filter(p => p !== stolen);
        to.properties.push(stolen);
        this.statusMessageSubject.next(`${to.name} stole ${stolen.name} from ${from.name}!`);
        this.resetPropertySelection();
        this.decrementAction();
      } else if (actionType === 'forced-deal') {
        const targetProp = fromCards[0];
        const attackerProp = toCards[0];
        to.properties = to.properties.filter(p => p !== attackerProp);
        from.properties = from.properties.filter(p => p !== targetProp);
        to.properties.push(targetProp);
        from.properties.push(attackerProp);
        this.statusMessageSubject.next(`${to.name} swapped ${attackerProp.name} for ${from.name}'s ${targetProp.name}.`);
        this.resetPropertySelection();
        this.decrementAction();
      }
    }
  }

}
