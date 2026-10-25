import { Component, OnInit, OnDestroy } from '@angular/core';
import { GameService } from '../game.service';
import { Player, PlayerSetup } from '../classes/player';
import { RandomAiService } from '../random-ai.service';
import { GameMove } from '../game-move';
import { Subject } from 'rxjs';
import { takeUntil } from 'rxjs/operators';
import { Card, PropertyCard } from '../classes/card';
import confetti from 'canvas-confetti';

@Component({
  selector: 'app-play',
  providers: [RandomAiService],
  templateUrl: './play.component.html',
  styleUrls: ['./play.component.css']
})
export class PlayComponent implements OnInit, OnDestroy {

  constructor(public gameService: GameService, private ai: RandomAiService) { }

  public numberOfPlayers: number = 3;
  public seats: PlayerSetup[] = [
    { name: 'Nino', control: 'human' }, { name: 'Ariana', control: 'human' },
    { name: 'Bojan', control: 'human' }, { name: 'Kemal', control: 'human' },
    { name: 'Myra', control: 'human' }
  ];
  setupError: string | null = null;
  private destroyed$ = new Subject<void>();
  private confettiTimer: ReturnType<typeof setInterval> | undefined;
  public start = false;
  public players: Player[] = [];
  public deck: Card[] = [];
  public discard: Card[] = [];
  public currentPlayerIndex: number = 0;
  public currentPlayer: Player | undefined;
  public actions: number = 3;
  public winner: Player | null = null;
  public victoryDismissed = false;

  public from: Player | undefined;
  public to: Player | undefined;
  public amount: number = 2;

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

    this.gameService.deck$.pipe(takeUntil(this.destroyed$)).subscribe(deck => {
      this.deck = deck;
    });

    this.gameService.discard$.pipe(takeUntil(this.destroyed$)).subscribe(discard => {
      this.discard = discard;
    });

    this.gameService.currentPlayer$.pipe(takeUntil(this.destroyed$)).subscribe(player => {
      this.currentPlayer = player;
    });

    this.gameService.actions$.pipe(takeUntil(this.destroyed$)).subscribe(actions => {
      this.actions = actions;
    });

    this.gameService.winner$.pipe(takeUntil(this.destroyed$)).subscribe(winner => {
      this.winner = winner;
      this.victoryDismissed = false;
      if (winner) {
        this.triggerVictoryConfetti();
      }
    });

    this.gameService.paymentQueue$.pipe(takeUntil(this.destroyed$)).subscribe(queue => {
      if (queue.length) {
        this.from = queue[0].from;
        this.to = queue[0].to;
        this.amount = queue[0].amount;
        this.decisionState = "paying";
      } else {
        this.decisionState = null;
      }
    });

    this.gameService.statusMessage$.pipe(takeUntil(this.destroyed$)).subscribe(msg => {
      this.statusMessage = msg;
    });

    this.gameService.isDebtCollectorSelectable$.pipe(takeUntil(this.destroyed$)).subscribe(isSelectable => {
      this.isDebtCollectorSelectable = isSelectable;
    });

    this.gameService.selectedDebtPlayer$.pipe(takeUntil(this.destroyed$)).subscribe(player => {
      this.selectedDebtPlayer = player;
    });

    this.gameService.propertySelectable$.pipe(takeUntil(this.destroyed$)).subscribe(isSelectable => {
      this.isPropertySelectable = isSelectable;
    });

    this.gameService.forcedDealActive$.pipe(takeUntil(this.destroyed$)).subscribe(isActive => {
      this.isForcedDealActive = isActive;
    });

    this.gameService.selectedProperty$.pipe(takeUntil(this.destroyed$)).subscribe(property => {
      this.selectedProperty = property;
    });

    this.gameService.isSelectingPropertySetForBuilding$.pipe(takeUntil(this.destroyed$)).subscribe(isSelecting => {
      this.isSelectingPropertySetForBuilding = isSelecting;
    });
    
    this.gameService.buildingType$.pipe(takeUntil(this.destroyed$)).subscribe(type => {
      this.buildingType = type;
    });

    this.gameService.isJustSayNoActive$.pipe(takeUntil(this.destroyed$)).subscribe(activeState => {
      this.targetPlayerForJustSayNo = activeState?.from ?? null;
    });

    // Automatically initialize game on first load so the user lands on a fully ready game!
    this.setup();
    this.ai.start();
  }

  ngOnDestroy(): void {
    this.ai.stop();
    this.destroyed$.next();
    this.destroyed$.complete();
    if (this.confettiTimer !== undefined) clearInterval(this.confettiTimer);
  }

  fireConfetti(options?: any) {
    const fn = (confetti as any)?.default || confetti;
    if (typeof fn === 'function') {
      fn(options);
    }
  }

  triggerVictoryConfetti() {
    const duration = 4 * 1000;
    const animationEnd = Date.now() + duration;
    const colors = ['#bb0000', '#ffffff', '#00bb00', '#0000bb', '#ffd700'];

    if (this.confettiTimer !== undefined) clearInterval(this.confettiTimer);
    this.confettiTimer = setInterval(() => {
      const timeLeft = animationEnd - Date.now();
      if (timeLeft <= 0) {
        return clearInterval(this.confettiTimer);
      }
      const particleCount = 40 * (timeLeft / duration);
      this.fireConfetti({
        particleCount,
        angle: 60,
        spread: 60,
        origin: { x: 0, y: 0.7 },
        colors
      });
      this.fireConfetti({
        particleCount,
        angle: 120,
        spread: 60,
        origin: { x: 1, y: 0.7 },
        colors
      });
    }, 250);
  }

  setup() {
    if (!Number.isInteger(this.numberOfPlayers) || this.numberOfPlayers < 2 || this.numberOfPlayers > 5) {
      this.setupError = 'Choose between 2 and 5 players.';
      return;
    }
    try {
      this.gameService.setup(this.seats.slice(0, this.numberOfPlayers));
    } catch (error) {
      this.setupError = error instanceof Error ? error.message : 'Invalid player setup.';
      return;
    }
    this.setupError = null;
    if (this.confettiTimer !== undefined) clearInterval(this.confettiTimer);
    this.players = this.gameService.game.players;
    this.currentPlayer = this.gameService.currentPlayer;
    this.deck = this.gameService.game.deck;
    this.start = true;
  }

  restartGame() {
    this.setup();
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  closeVictory(): void {
    this.victoryDismissed = true;
    if (this.confettiTimer !== undefined) clearInterval(this.confettiTimer);
  }

  get humanDecision(): boolean {
    return this.gameService.pendingDecision?.player.control === 'human';
  }

  get aiThinking(): boolean {
    return this.gameService.pendingDecision?.player.control === 'ai';
  }

  get displayStatusMessage(): string | null | undefined {
    const decision = this.gameService.pendingDecision;
    const attacker = this.currentPlayer;
    if (decision?.type === 'response' && decision.player.control === 'ai' && attacker?.control === 'ai') {
      return `${decision.player.name} is responding to ${attacker.name}'s action.`;
    }
    return this.statusMessage;
  }

  get humanPayment() {
    return this.humanDecision && this.gameService.pendingDecision?.type === 'payment'
      ? this.gameService.paymentQueue[0] : null;
  }

  get paymentChoices(): Card[] {
    if (!this.humanPayment) return [];
    return this.gameService.pendingDecision!.choices.flatMap(move => move.type === 'pay' ? [move.card] : []);
  }

  get awaitingHumanResponse(): boolean {
    return this.humanDecision && this.gameService.pendingDecision?.type === 'response';
  }

  paymentSource(card: Card): string {
    return this.humanPayment?.from.bank.includes(card) ? 'Bank'
      : card.type === 'property' ? 'Property' : 'Building';
  }

  choosePayment(card: Card): void {
    this.gameService.executeMove({ type: 'pay', card });
  }

  canMove(move: GameMove): boolean {
    return this.humanDecision && this.gameService.isLegalChoice(move);
  }

  handVisible(player: Player): boolean {
    return player.control === 'human' && player === this.currentPlayer;
  }

  canChangeColor(card: PropertyCard): boolean {
    return this.humanDecision && this.gameService.canChangeColor(card);
  }

  playCard(player: Player, card: Card) {
    if (player !== this.currentPlayer) return;
    this.gameService.executeMove({ type: this.gameService.discardAmount ? 'discard' : 'play', card });
  }

  selectCard(player: Player, card: Card) {
    const decision = this.gameService.pendingDecision;
    if (!decision || !this.humanDecision) return;
    let move: GameMove | undefined;
    if (decision.type === 'payment' && decision.player === player) move = { type: 'pay', card };
    if (card.type === 'property') {
      if (decision.type === 'target') move = { type: 'target', player, card };
      if (decision.type === 'swap' && player === this.currentPlayer) move = { type: 'swap', card };
      if (decision.type === 'building' && player === this.currentPlayer) {
        move = decision.choices.find(choice => choice.type === 'build' &&
          this.gameService.getCurrentColor(choice.card) === this.gameService.getCurrentColor(card));
      }
    }
    if (move) this.gameService.executeMove(move);
  }

  sortProperties(player: Player) {
    return [...player.properties].sort((a, b) => this.gameService.getCurrentColor(a).localeCompare(this.gameService.getCurrentColor(b)));
  }

  getTotalPayableAmount(player: Player): number {
    let bankTotal = player.bank.reduce((sum, card) => sum + (card.value || 0), 0);
    let propertyTotal = player.properties.reduce((sum, card) => sum + (card.value || 0), 0);
    return bankTotal + propertyTotal;
  }

  endTurn() {
    if (this.winner) return;
    this.gameService.executeMove({ type: 'pass' });
  }

  getBankTotal(player: Player): number {
    return player.bank.reduce((sum, card) => sum + (card.value || 0), 0);
  }

  getFullSetCount(player: Player): number {
    return this.gameService.fullSets(player);
  }

  addToBank(player: Player, card: Card) {
    if (player === this.currentPlayer) this.gameService.executeMove({ type: 'bank', card });
  }

  selectDebtCollector(player: Player) {
    this.gameService.executeMove({ type: 'debt', player });
  }

  flip(card: Card) {
    if (card.type !== 'property' || card.colors.length !== 2) return;
    const color = card.colors.find(color => color !== this.gameService.getCurrentColor(card));
    if (color) this.changeColor(card, color);
  }

  isFlipped(card: Card) {
    const propertyCard = card as PropertyCard;
    return this.gameService.getCurrentColor(propertyCard) === propertyCard.colors[1];
  }

  isWildcard(card: Card) {
    let name = card.name.toLowerCase();
    return /wildcard/.test(name) && /&/.test(name);
  }

  isWildcardProper(card: Card): boolean {
    const name = card.name.toLowerCase();
    const propertyCard = card as PropertyCard;
    return /wildcard/.test(name) && propertyCard.colors.length > 2;
  }
  
  changeColor(card: Card, color: string) {
    if (this.winner) return;
    if (card.type === 'property') this.gameService.executeMove({ type: 'color', card, color });
  }

  sayNo(useJustSayNo: boolean) {
    if (this.winner) return;
    this.gameService.executeMove({ type: 'respond', useJustSayNo });
  }
}
