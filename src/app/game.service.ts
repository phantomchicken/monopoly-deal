import { Injectable } from '@angular/core';
import { Game } from './classes/game';
import { Player, PlayerSetup } from './classes/player';
import { GameMove, PendingDecision } from './game-move';
import { Card, PropertyCard } from './classes/card';
import { CardService } from 'src/app/card.service';
import { BehaviorSubject, Subject } from 'rxjs';
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
  public static cardsData: Card[] = require('../assets/cards.json');
  public discardAmount: number = 0;
  public winner: Player | null = null;
  public paymentHistory: string[] = [];
  public lastAiPlay: {
    playerName: string;
    card: Pick<Card, 'name' | 'imageName'>;
    description: string;
  } | null = null;

  private recordPayment(message: string): void {
    this.paymentHistory = [message, ...this.paymentHistory].slice(0, 8);
  }
  private resolvingCard = false;

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

  private winnerSubject = new BehaviorSubject<Player | null>(null);
  winner$ = this.winnerSubject.asObservable();

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

  readonly changes$ = new Subject<void>();
  readonly resets$ = new Subject<void>();

  setup(seats: PlayerSetup[]) {
    if (seats.length < 2 || seats.length > 5 ||
        !seats.some(seat => seat.control === 'human') ||
        seats.some(seat => seat.control !== 'human' && seat.control !== 'ai')) {
      throw new Error('Choose 2-5 players, including at least one human.');
    }
    this.resets$.next();
    this.paymentHistory = [];
    this.lastAiPlay = null;
    this.paymentState = null;
    this.paymentStateSubject.next(null);
    this.selectedCard = null;
    this.pendingBuildingCard = null;
    this.isSelectingPropertySetForBuildingSubject.next(false);
    this.buildingTypeSubject.next(null);
    this.isDebtCollectorSelectableSubject.next(false);
    this.selectedDebtPlayerSubject.next(null);
    this.isDoubleTheRent = false;
    this.actionCompleteSubject.next(false);
    this.winner = null;
    this.winnerSubject.next(null);
    this.discardAmount = 0;
    this.game.discard = [];
    this.discardSubject.next(this.game.discard);
    this.paymentQueue = [];
    this.paymentQueueSubject.next(this.paymentQueue);
    this.isJustSayNoActiveSubject.next(undefined);
    this.resetPropertySelection();
    this.decisionState = 'playing';

    this.game.players = seats.map((seat, i) =>
      new Player(i + 1, seat.name.trim() || `Player ${i + 1}`, seat.control));

    this.propertySetSizeMap = new Map(
      this.propertySetSizes.map((p: { color: string; setSize: number }) => [p.color, p.setSize])
    );

    // Initialize deck synchronously with cloned cards for immediate, rock-solid readiness
    const freshCards: Card[] = JSON.parse(JSON.stringify(GameService.cardsData));
    this.game.deck = this.shuffle(freshCards);
    this.deckSubject.next(this.game.deck);

    this.draw(this.game.players[0], 7);
    for (let i = 1; i < seats.length; i++) {
      this.draw(this.game.players[i], 5);
    }

    this.playerIndex = 0;
    this.currentPlayer = this.game.players[0];
    this.currentPlayerSubject.next(this.game.players[0]);
    this.actionsSubject.next(3);
    this.statusMessageSubject.next(`Game started! ${this.currentPlayer.name}'s turn.`);
    this.changes$.next();
  }

  decrementAction() {
    if (this.winner) return;
    if (this.discardAmount > 0) return;

    const remaining = this.actionsSubject.value - 1;
    this.actionsSubject.next(remaining);

    if (remaining <= 0 && !this.resolvingCard) {
      this.endTurn();
    }
  }

  endTurn() {
    if (this.winner || !this.currentPlayer || this.hasPendingAction) return;

    const current = this.game.players[this.playerIndex];

    if (current && current.hand.length > 7) {
      this.discardAmount = current.hand.length - 7;
      this.statusMessageSubject.next(`${current.name} has more than 7 cards (${current.hand.length}). Please discard ${this.discardAmount} card(s).`);
      return;
    }

    this.discardAmount = 0;
    this.playerIndex = (this.playerIndex + 1) % this.game.players.length;
    const nextPlayer = this.game.players[this.playerIndex];

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
    if (player !== this.currentPlayer || !player.hand.includes(card) || this.hasPendingAction) return;
    if (!this.discardAmount && !this.canPlayCard(player, card)) return;
    if (this.winner) {
      this.statusMessageSubject.next(`Game over! ${this.winner.name} won! Please restart above.`);
      return;
    }

    // Discard mode (when hand > 7 at turn end)
    if (this.discardAmount > 0) {
      this.recordPayment(`${player.name} discarded ${card.name} to meet the hand limit.`);
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
        this.recordPayment(`${player.name} played ${propCard.name} (${this.getCurrentColor(propCard)}).`);
        this.statusMessageSubject.next(`${player.name} played ${propCard.name}.`);
        this.checkWinCondition(player);
        this.decrementAction();
        break;
      }
      case 'money': {
        player.bank.push(card);
        player.hand.splice(cardIndex, 1);
        this.recordPayment(`${player.name} added ${card.value}M to their bank.`);
        this.statusMessageSubject.next(`${player.name} added ${card.value}M to bank.`);
        this.decrementAction();
        break;
      }
      case 'action': {
        // Remove before an effect can draw, recycle discards, or advance the turn.
        player.hand.splice(cardIndex, 1);
        this.resolvingCard = true;
        let success: boolean;
        try {
          success = this.resolveActionCard(card);
        } finally {
          this.resolvingCard = false;
        }
        if (!success) {
          player.hand.splice(cardIndex, 0, card);
          return;
        }
        if (card.name !== 'House' && card.name !== 'Hotel') {
          this.game.discard.push(card);
          this.discardSubject.next(this.game.discard);
        }
        if (this.actions <= 0 && !this.hasPendingAction) this.endTurn();
        break;
      }
    }

    this.checkWinCondition(player);
  }

  checkWinCondition(player: Player): boolean {
    if (this.winner) return true;
    const sets = this.fullSets(player);
    if (sets >= 3) {
      this.winner = player;
      this.winnerSubject.next(player);
      this.statusMessageSubject.next(`🏆 ${player.name} has three completed full sets and has WON THE GAME! 🎉`);
      return true;
    }
    return false;
  }

  bankActionCard(player: Player, card: Card) {
    if (!player.hand.includes(card) || this.hasPendingAction) return;
    if (this.winner) return;
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
      this.recordPayment(`${player.name} banked ${card.name} as ${card.value}M.`);
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
    const player = this.currentPlayer;
    if (!player || card.type !== 'action' || !this.canPlayCard(player, card)) return false;
    this.playCard(player, card);
    return true;
  }

  private resolveActionCard(card: Card): boolean {
    if (this.winner) return false;

    const currentPlayer = this.game.players[this.playerIndex];
    const otherPlayers = this.game.players.filter(p => p !== currentPlayer);
    this.recordPayment(`${currentPlayer.name} played ${card.name}.`);

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
        otherPlayers.forEach(p => {
          if (this.getTotalPayableAmount(p) > 0) {
            this.paymentQueue.push({ from: p, to: currentPlayer, amount: 2 });
          } else {
            this.recordPayment(`${p.name} has no assets in play and pays nothing to ${currentPlayer.name} for Birthday.`);
          }
        });

        this.statusMessageSubject.next(`It's ${currentPlayer.name}'s Birthday! Everyone owes 2M.`);
        this.paymentQueueSubject.next(this.paymentQueue);
        this.processNextPayment();
        return true;

      case 'Debt Collector': {
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
            return count < setSize;
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
        if (/Rent/.test(card.name)) {
          let name = card.name.toLowerCase().replace('rent ', '');
          let colors = name === 'wildcard'
            ? ['red', 'orange', 'dark green', 'light green', 'black', 'dark blue', 'light blue', 'yellow', 'pink', 'brown']
            : name.split(' & ');

          let ownedProperties = currentPlayer.properties.filter(p => colors.includes(this.getCurrentColor(p)));

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
    if (!this.isLegalChoice({ type: 'debt', player })) return;
    if (this.winner) return;

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
    if (numberOfCards > this.game.deck.length && this.game.discard.length > 0) {
      const recycled = this.shuffle([...this.game.discard]);
      this.game.deck = this.game.deck.concat(recycled);
      this.game.discard = [];
      this.discardSubject.next(this.game.discard);
      this.recordPayment(`Shuffled ${recycled.length} discarded cards back into the draw pile.`);
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
      let randomIndex = Math.floor(Math.random() * (currentIndex + 1));
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
    if (this.pendingDecision?.player !== player || !this.isLegalChoice({ type: 'pay', card })) return;
    if (this.winner) return;
    if (!this.paymentQueue.length || this.paymentQueue[0].from !== player) return;

    let { from, to, amount } = this.paymentQueue[0];
    let cardValue = card.value || 0;
    let paid = false;
    const destination = card.type === 'property' ? 'properties' : 'bank';

    if (from.bank.includes(card)) {
      from.bank = from.bank.filter(c => c !== card);
      to.bank.push(card);
      paid = true;
    } else if (from.properties.includes(card as PropertyCard)) {
      from.properties = from.properties.filter(c => c !== card);
      to.properties.push(card as PropertyCard);
      paid = true;
    } else if (this.payableCards(from).includes(card)) {
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
      this.recordPayment(`${from.name} gave ${card.name} (${cardValue}M) to ${to.name}'s ${destination}.`);
      this.paymentQueue[0].amount -= cardValue;
      this.checkWinCondition(to);
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
  }

  processNextPayment() {
    while (this.paymentQueue.length && this.getTotalPayableAmount(this.paymentQueue[0].from) === 0) {
      const skipped = this.paymentQueue.shift();
      this.statusMessageSubject.next(`${skipped?.from.name} has nothing to pay.`);
      if (skipped) this.recordPayment(`${skipped.from.name} has no assets in play and pays nothing to ${skipped.to.name}.`);
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
      this.resetPropertySelection();
      this.actionCompleteSubject.next(true);
      this.decrementAction();
    }
  }

  getTotalPayableAmount(player: Player): number {
    let bankTotal = player.bank.reduce((sum, card) => sum + (card.value || 0), 0);
    let propertyTotal = player.properties.reduce((sum, card) => sum + (card.value || 0), 0);
    const buildingTotal = player.properties.reduce((sum, property) =>
      sum + (property.buildings?.house?.value || 0) + (property.buildings?.hotel?.value || 0), 0);
    return bankTotal + propertyTotal + buildingTotal;
  }

  selectTargetProperty(player: Player, property: PropertyCard) {
    if (!this.isLegalChoice({ type: 'target', player, card: property })) return;
    if (this.winner) return;
    if (!this.isPropertySelectableSubject.value) return;

    const currentPlayer = this.game.players[this.playerIndex];
    if (player === currentPlayer) return;

    const color = this.getCurrentColor(property);
    const setSize = this.propertySetSizeMap.get(color) || COLOR_RENT_MAP.get(color)?.setSize || 0;
    const sameColorProps = player.properties.filter(p => this.getCurrentColor(p) === color);
    const isFullSet = sameColorProps.length >= setSize;

    // Deal Breaker
    if (this.currentActionCard?.name === 'Deal Breaker') {
      if (!isFullSet) {
        this.statusMessageSubject.next('You can only steal a FULL completed set with Deal Breaker!');
        return;
      }

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
        player.properties = player.properties.filter(p => this.getCurrentColor(p) !== color);
        currentPlayer.properties.push(...sameColorProps);
        this.statusMessageSubject.next(`${currentPlayer.name} stole the complete ${color} set from ${player.name}!`);
        this.resetPropertySelection();
        this.checkWinCondition(currentPlayer);
        this.decrementAction();
      }
      return;
    }

    if (isFullSet) {
      this.statusMessageSubject.next('Cannot steal or swap cards from a completed full set!');
      return;
    }

    // Forced Deal - Step 1: Select opponent property
    if (this.currentActionCard?.name === 'Forced Deal') {
      this.selectedTargetPlayerSubject.next(player);
      this.selectedPropertySubject.next(property);
      this.statusMessageSubject.next(`Selected ${property.name}. Now select one of your properties to swap.`);
      return;
    }

    // Sly Deal
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
        this.checkWinCondition(currentPlayer);
        this.decrementAction();
      }
    }
  }

  selectOwnProperty(property: PropertyCard) {
    if (!this.isLegalChoice({ type: 'swap', card: property })) return;
    if (this.winner) return;
    if (!this.isForcedDealActiveSubject.value || !this.selectedPropertySubject.value) return;

    const currentPlayer = this.game.players[this.playerIndex];
    const targetPlayer = this.selectedTargetPlayerSubject.value;
    const targetProperty = this.selectedPropertySubject.value;

    if (targetPlayer && targetProperty) {
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
        currentPlayer.properties = currentPlayer.properties.filter(p => p !== property);
        targetPlayer.properties = targetPlayer.properties.filter(p => p !== targetProperty);
        currentPlayer.properties.push(targetProperty);
        targetPlayer.properties.push(property);

        this.statusMessageSubject.next(`${currentPlayer.name} swapped ${property.name} for ${targetPlayer.name}'s ${targetProperty.name}.`);
        this.resetPropertySelection();
        this.checkWinCondition(currentPlayer);
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
    if (card.type !== 'property' || card.colors.length !== 2) return;
    this.changeCurrentColor(card, card.colors.find(color => color !== this.getCurrentColor(card))!);
  }

  getCurrentColor(card: PropertyCard): string {
    return card.currentColor && card.colors.includes(card.currentColor) ? card.currentColor : card.colors[0];
  }

  changeCurrentColor(card: Card, newColor: string) {
    if (card.type !== 'property' || !this.canChangeColor(card) || !card.colors.includes(newColor)) return;
    if (this.winner) return;
    const propCard = card as PropertyCard;
    if (propCard.colors.includes(newColor)) {
      propCard.currentColor = newColor;
      const colorInfo = COLOR_RENT_MAP.get(newColor);
      if (colorInfo) {
        propCard.rentValues = colorInfo.rentValues;
        propCard.setSize = colorInfo.setSize;
      }
    }
    this.checkWinCondition(this.game.players[this.playerIndex]);
  }

  selectPropertySetForBuilding(property: PropertyCard) {
    if (!this.isLegalChoice({ type: 'build', card: property })) return;
    if (this.winner) return;

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
    this.resetPropertySelection();
    this.decrementAction();
  }

  sayNo(useJustSayNo: boolean) {
    if (!this.isLegalChoice({ type: 'respond', useJustSayNo })) return;
    if (this.winner) return;

    const activeState = this.isJustSayNoActiveSubject.value;
    if (!activeState) return;

    const { from, to, amount, fromCards, toCards, actionType } = activeState;

    if (useJustSayNo) {
      const jsnIdx = from.hand.findIndex(c => c.name === 'Just Say No');
      if (jsnIdx !== -1) {
        const [jsnCard] = from.hand.splice(jsnIdx, 1);
        this.game.discard.push(jsnCard);
        this.discardSubject.next(this.game.discard);
      }

      const responseMessage = actionType === 'payment'
        ? `${from.name} discarded Just Say No to cancel their ${amount}M payment to ${to.name}.`
        : `${from.name} discarded Just Say No to block ${to.name}'s action.`;
      this.statusMessageSubject.next(responseMessage);
      this.recordPayment(responseMessage);

      if (actionType === 'payment') {
        this.paymentQueue = this.paymentQueue.filter(p => !(p.from === from && p.to === to && p.amount === amount));
        this.paymentQueueSubject.next(this.paymentQueue);
        this.isJustSayNoActiveSubject.next(undefined);
        this.processNextPayment();
      } else {
        this.resetPropertySelection();
        this.isJustSayNoActiveSubject.next(undefined);
        this.decrementAction();
      }
    } else {
      this.isJustSayNoActiveSubject.next(undefined);

      if (actionType === 'payment') {
        this.statusMessageSubject.next(`${from.name}, select a card to pay ${amount}M to ${to.name}.`);
      } else if (actionType === 'dealbreaker') {
        const color = this.getCurrentColor(fromCards[0]);
        from.properties = from.properties.filter(p => this.getCurrentColor(p) !== color);
        to.properties.push(...fromCards);
        this.statusMessageSubject.next(`${to.name} stole the ${color} set from ${from.name}!`);
        this.resetPropertySelection();
        this.checkWinCondition(to);
        this.decrementAction();
      } else if (actionType === 'sly-deal') {
        const stolen = fromCards[0];
        from.properties = from.properties.filter(p => p !== stolen);
        to.properties.push(stolen);
        this.statusMessageSubject.next(`${to.name} stole ${stolen.name} from ${from.name}!`);
        this.resetPropertySelection();
        this.checkWinCondition(to);
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
        this.checkWinCondition(to);
        this.decrementAction();
      }
    }
  }

  get hasPendingAction(): boolean {
    return !!(this.isJustSayNoActiveSubject.value || this.paymentQueue.length ||
      this.isDebtCollectorSelectableSubject.value || this.isPropertySelectableSubject.value ||
      this.isSelectingPropertySetForBuildingSubject.value);
  }

  canChangeColor(card: PropertyCard): boolean {
    return !this.winner && !this.hasPendingAction && !this.discardAmount &&
      !!this.currentPlayer?.properties.includes(card) && card.colors.length > 1;
  }

  private isFullColor(player: Player, property: PropertyCard): boolean {
    const color = this.getCurrentColor(property);
    const size = this.propertySetSizeMap.get(color);
    return !!size && player.properties.filter(p => this.getCurrentColor(p) === color).length >= size;
  }

  private targets(action: string): { player: Player; card: PropertyCard }[] {
    if (!['Sly Deal', 'Forced Deal', 'Deal Breaker'].includes(action)) return [];
    return this.game.players.filter(p => p !== this.currentPlayer).flatMap(player =>
      player.properties.filter(card => action === 'Deal Breaker'
        ? this.isFullColor(player, card) : !this.isFullColor(player, card))
        .map(card => ({ player, card })));
  }

  private buildingTargets(name: string): PropertyCard[] {
    const player = this.currentPlayer;
    if (!player) return [];
    return player.properties.filter((property, _index, properties) => {
      const color = this.getCurrentColor(property);
      if (color === 'black' || color === 'light green' || !this.isFullColor(player, property)) return false;
      const set = properties.filter(p => this.getCurrentColor(p) === color);
      // A single canonical property holds the buildings for each color.
      if (set[0] !== property) return false;
      return name === 'House' ? !property.buildings?.house
        : name === 'Hotel' && !!property.buildings?.house && !property.buildings?.hotel;
    });
  }

  payableCards(player: Player): Card[] {
    return [...player.bank, ...player.properties, ...player.properties.flatMap(property =>
      [property.buildings?.house, property.buildings?.hotel].filter((card): card is Card => !!card))];
  }

  canPlayCard(player: Player, card: Card): boolean {
    if (this.winner || this.hasPendingAction || this.discardAmount || this.actions <= 0 ||
        player !== this.currentPlayer || !player.hand.includes(card)) return false;
    if (card.type !== 'action') return true;
    switch (card.name) {
      case 'Pass Go': case 'Double The Rent': case "It's My Birthday": return true;
      case 'Debt Collector': return this.game.players.some(p => p !== player);
      case 'Forced Deal': return player.properties.length > 0 && this.targets(card.name).length > 0;
      case 'Sly Deal': case 'Deal Breaker': return this.targets(card.name).length > 0;
      case 'House': case 'Hotel': return this.buildingTargets(card.name).length > 0;
      default:
        if (!/Rent/.test(card.name)) return false;
        const colors = card.name.toLowerCase().replace('rent ', '');
        return player.properties.some(p => colors === 'wildcard' || colors.split(' & ').includes(this.getCurrentColor(p)));
    }
  }

  get pendingDecision(): PendingDecision | null {
    const player = this.currentPlayer;
    if (this.winner || !player) return null;
    const response = this.isJustSayNoActiveSubject.value;
    if (response) return { type: 'response', player: response.from, choices: [
      { type: 'respond', useJustSayNo: false },
      ...(this.playerHasJustSayNo(response.from) ? [{ type: 'respond' as const, useJustSayNo: true }] : [])
    ] };
    if (this.paymentQueue.length) {
      const payer = this.paymentQueue[0].from;
      return { type: 'payment', player: payer, choices: this.payableCards(payer).map(card => ({ type: 'pay', card })) };
    }
    if (this.discardAmount) return { type: 'discard', player,
      choices: player.hand.map(card => ({ type: 'discard', card })) };
    if (this.isDebtCollectorSelectableSubject.value) return { type: 'debt', player,
      choices: this.game.players.filter(p => p !== player).map(player => ({ type: 'debt', player })) };
    if (this.isSelectingPropertySetForBuildingSubject.value) return { type: 'building', player,
      choices: this.buildingTargets(this.buildingTypeSubject.value || '').map(card => ({ type: 'build', card })) };
    if (this.isPropertySelectableSubject.value) {
      if (this.currentActionCard?.name === 'Forced Deal' &&
          this.isForcedDealActiveSubject.value && this.selectedPropertySubject.value) return {
        type: 'swap', player, choices: player.properties.map(card => ({ type: 'swap', card })) };
      return { type: 'target', player, choices: this.targets(this.currentActionCard?.name || '')
        .map(target => ({ type: 'target', ...target })) };
    }
    const choices: GameMove[] = [];
    for (const card of player.hand) {
      if (this.canPlayCard(player, card)) choices.push({ type: 'play', card });
      if (card.type === 'action' && this.actions > 0) choices.push({ type: 'bank', card });
    }
    choices.push({ type: 'pass' });
    return { type: 'turn', player, choices };
  }

  isLegalChoice(move: GameMove): boolean {
    if (move.type === 'play' && move.color !== undefined &&
        (move.card.type !== 'property' || !move.card.colors.includes(move.color))) return false;
    if (move.type === 'color') return this.canChangeColor(move.card) && move.card.colors.includes(move.color);
    return !!this.pendingDecision?.choices.some(choice => choice.type === move.type &&
      (!('card' in move) || ('card' in choice && choice.card === move.card)) &&
      (!('player' in move) || ('player' in choice && choice.player === move.player)) &&
      (!('useJustSayNo' in move) || ('useJustSayNo' in choice && choice.useJustSayNo === move.useJustSayNo)));
  }

  /** Both UI and AI submit decisions through the same validation boundary. */
  executeMove(move: GameMove, source: 'human' | 'ai' = 'human'): boolean {
    const decision = this.pendingDecision;
    if (!decision || decision.player.control !== source || !this.isLegalChoice(move)) return false;
    const player = decision.player;
    if (source === 'ai') {
      const card = move.type === 'play' || move.type === 'bank' ? move.card
        : move.type === 'respond' && move.useJustSayNo ? player.hand.find(card => card.name === 'Just Say No') : undefined;
      if (card) this.lastAiPlay = {
        playerName: player.name,
        card: { name: card.name, imageName: card.imageName },
        description: move.type === 'bank' ? `Banked as ${card.value}M` : 'Played'
      };
    }
    switch (move.type) {
      case 'play':
        if (move.card.type === 'property') {
          const color = move.color || this.getCurrentColor(move.card);
          move.card.currentColor = color;
          const info = COLOR_RENT_MAP.get(color);
          if (info) { move.card.rentValues = info.rentValues; move.card.setSize = info.setSize; }
        }
        this.playCard(player, move.card);
        break;
      case 'discard': this.playCard(player, move.card); break;
      case 'bank': this.bankActionCard(player, move.card); break;
      case 'pay': this.selectCardForPayment(player, move.card); break;
      case 'target': this.selectTargetProperty(move.player, move.card); break;
      case 'swap': this.selectOwnProperty(move.card); break;
      case 'build': this.selectPropertySetForBuilding(move.card); break;
      case 'debt': this.selectDebtCollector(move.player); break;
      case 'respond': this.sayNo(move.useJustSayNo); break;
      case 'pass':
        this.recordPayment(`${player.name} passed their turn.`);
        this.endTurn();
        break;
      case 'color': this.changeCurrentColor(move.card, move.color); break;
    }
    this.changes$.next();
    return true;
  }

}
