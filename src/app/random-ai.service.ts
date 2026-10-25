import { Injectable, OnDestroy } from '@angular/core';
import { Subscription } from 'rxjs';
import { GameService } from './game.service';
import { GameMove, PendingDecision } from './game-move';
import { Card, PropertyCard } from './classes/card';
import { Player } from './classes/player';
import { COLOR_RENT_MAP } from './color-rent-map';

/** Simple local heuristics, using its own hand and the public board. Ties stay random. */
@Injectable()
export class RandomAiService implements OnDestroy {
  private timer: ReturnType<typeof setTimeout> | undefined;
  private subscriptions = new Subscription();
  private running = false;
  private readonly keepActions = new Set([
    'Pass Go', 'Debt Collector', "It's My Birthday", 'Just Say No', 'Deal Breaker', 'Double The Rent'
  ]);

  constructor(private game: GameService) {}

  start(): void {
    this.stop();
    this.running = true;
    this.subscriptions = new Subscription();
    this.subscriptions.add(this.game.resets$.subscribe(() => this.cancelTimer()));
    this.subscriptions.add(this.game.changes$.subscribe(() => this.schedule()));
    this.subscriptions.add(this.game.winner$.subscribe(winner => {
      if (winner) this.cancelTimer();
    }));
    this.schedule();
  }

  stop(): void {
    this.running = false;
    this.cancelTimer();
    this.subscriptions.unsubscribe();
  }

  ngOnDestroy(): void { this.stop(); }

  private cancelTimer(): void {
    if (this.timer !== undefined) clearTimeout(this.timer);
    this.timer = undefined;
  }

  private schedule(): void {
    this.cancelTimer();
    if (!this.running || this.game.pendingDecision?.player.control !== 'ai') return;
    this.timer = setTimeout(() => {
      this.timer = undefined;
      const decision = this.game.pendingDecision;
      if (!this.running || decision?.player.control !== 'ai') return;
      const move = this.chooseMove(decision);
      if (!move) return;
      this.game.executeMove(move, 'ai');
    }, 1000);
  }

  private chooseMove(decision: PendingDecision): GameMove | undefined {
    // Evaluate wildcard colors as part of playing the card, without free recolor loops.
    const choices = decision.choices.flatMap(move =>
      move.type === 'play' && move.card.type === 'property'
        ? move.card.colors.map(color => ({ ...move, color })) : [move]);
    let bestScore = -Infinity;
    let best: GameMove[] = [];
    for (const move of choices) {
      const score = this.scoreMove(move, decision.player);
      if (score === -Infinity) continue;
      if (score > bestScore) { bestScore = score; best = [move]; }
      else if (score === bestScore) best.push(move);
    }
    return best[Math.floor(Math.random() * best.length)];
  }

  private colorCount(player: Player, color: string): number {
    return player.properties.filter(property => this.game.getCurrentColor(property) === color).length;
  }

  private propertyGain(player: Player, color: string): number {
    const count = this.colorCount(player, color);
    const size = COLOR_RENT_MAP.get(color)?.setSize || 0;
    if (!size || count >= size) return 5;
    if (count + 1 === size) return this.game.fullSets(player) >= 2 ? 250 : 110;
    return 40 + count * 15;
  }

  private propertyLoss(player: Player, card: PropertyCard): number {
    const color = this.game.getCurrentColor(card);
    const count = this.colorCount(player, color);
    const size = COLOR_RENT_MAP.get(color)?.setSize || 0;
    return (size && count === size ? 180 : 20 + Math.min(count, size) * 10) +
      (card.colors.length > 1 ? 20 : 0) +
      (card.buildings?.house ? 20 : 0) + (card.buildings?.hotel ? 30 : 0);
  }

  private opponents(player: Player): Player[] {
    return this.game.game.players.filter(other => other !== player);
  }

  private rentAmount(player: Player, card: Card): number {
    const colors = card.name.toLowerCase().replace('rent ', '');
    let amount = 0;
    COLOR_RENT_MAP.forEach((info, color) => {
      if (colors !== 'wildcard' && !colors.split(' & ').includes(color)) return;
      const properties = player.properties.filter(p => this.game.getCurrentColor(p) === color);
      if (!properties.length) return;
      const buildings = properties[0].buildings;
      const rent = info.rentValues[Math.min(properties.length, info.setSize) - 1] +
        (buildings?.house ? 3 : 0) + (buildings?.hotel ? 4 : 0);
      amount = Math.max(amount, rent);
    });
    return amount * (this.game.isDoubleTheRent ? 2 : 1);
  }

  private collectible(player: Player, amount: number): number {
    return this.opponents(player).reduce((sum, other) =>
      sum + Math.min(amount, this.game.getTotalPayableAmount(other)), 0);
  }

  private scoreMove(move: GameMove, player: Player): number {
    switch (move.type) {
      case 'pass': return 0;
      case 'bank':
        // Keep these even when they currently have no useful target.
        if (this.keepActions.has(move.card.name)) return -Infinity;
        if (this.game.canPlayCard(player, move.card)) return 5;
        return 15 + move.card.value;
      case 'play': {
        const card = move.card;
        if (card.type === 'property') return this.propertyGain(player, move.color || this.game.getCurrentColor(card));
        if (card.type === 'money') {
          const bank = player.bank.reduce((sum, cash) => sum + cash.value, 0);
          return (bank < 5 ? 60 : 20) + card.value;
        }
        switch (card.name) {
          case 'Pass Go': return this.game.actions > 1 && player.hand.length < 6 ? 85 : 30;
          case 'Debt Collector': {
            const assets = Math.max(0, ...this.opponents(player).map(other => this.game.getTotalPayableAmount(other)));
            return assets > 0 ? 50 + Math.min(5, assets) : -Infinity;
          }
          case "It's My Birthday": {
            const amount = this.collectible(player, 2);
            return amount > 0 ? 50 + amount : -Infinity;
          }
          case 'Double The Rent': {
            if (this.game.actions < 2 || this.game.isDoubleTheRent) return -Infinity;
            const rents = player.hand.filter(card => /Rent/.test(card.name) && card.name !== 'Double The Rent' &&
              this.game.canPlayCard(player, card));
            const amount = Math.max(0, ...rents.map(card => this.collectible(player, this.rentAmount(player, card))));
            return amount > 0 ? 70 + amount : -Infinity;
          }
          case 'Deal Breaker': return this.game.fullSets(player) >= 2 ? 300 : 140;
          case 'Sly Deal': return 90;
          case 'Forced Deal': {
            // Do not start a swap that sacrifices a valuable set for little gain.
            const gain = Math.max(0, ...this.opponents(player).flatMap(other => other.properties
              .filter(card => this.colorCount(other, this.game.getCurrentColor(card)) <
                (COLOR_RENT_MAP.get(this.game.getCurrentColor(card))?.setSize || 0))
              .map(card => this.propertyGain(player, this.game.getCurrentColor(card)))));
            const loss = Math.min(...player.properties.map(card => this.propertyLoss(player, card)));
            return gain > loss ? 65 + gain - loss : -Infinity;
          }
          case 'House': case 'Hotel': return 55;
          default: {
            if (!/Rent/.test(card.name)) return -Infinity;
            const amount = this.collectible(player, this.rentAmount(player, card));
            return amount > 0 ? (this.game.isDoubleTheRent ? 120 : 55) + amount : -Infinity;
          }
        }
      }
      case 'debt': return Math.min(5, this.game.getTotalPayableAmount(move.player));
      case 'target': {
        const color = this.game.getCurrentColor(move.card);
        if (this.game.currentActionCard?.name === 'Deal Breaker') {
          const newSet = this.colorCount(player, color) < (COLOR_RENT_MAP.get(color)?.setSize || 0);
          return (newSet ? 200 : 0) + this.game.fullSets(move.player) * 10;
        }
        return this.propertyGain(player, color);
      }
      case 'swap': return -this.propertyLoss(player, move.card);
      case 'build': {
        const color = this.game.getCurrentColor(move.card);
        const rentValues = COLOR_RENT_MAP.get(color)?.rentValues || [0];
        return rentValues[rentValues.length - 1];
      }
      case 'pay': {
        if (move.card.value <= 0) return -Infinity;
        const amount = this.game.paymentQueue[0]?.amount || 0;
        const overpayment = Math.max(0, move.card.value - amount);
        const source = player.bank.includes(move.card) ? 2000
          : move.card.type === 'property' ? 200 - this.propertyLoss(player, move.card) : 600;
        return source - overpayment * 20 + Math.min(amount, move.card.value);
      }
      case 'respond': {
        const amount = this.game.paymentQueue[0]?.amount || 0;
        const bank = player.bank.reduce((sum, card) => sum + card.value, 0);
        const shouldBlock = !this.game.paymentQueue.length || amount >= 5 || bank < amount;
        return move.useJustSayNo === shouldBlock ? 1 : 0;
      }
      case 'discard': {
        const card = move.card;
        if (this.keepActions.has(card.name)) return -100 - card.value;
        if (card.type === 'property') {
          return -Math.max(...card.colors.map(color => this.propertyGain(player, color)));
        }
        if (card.type === 'money') return -card.value;
        return 10 - card.value;
      }
      case 'color': return -Infinity;
    }
  }
}
