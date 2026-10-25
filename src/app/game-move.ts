import { Card, PropertyCard } from './classes/card';
import { Player } from './classes/player';

export type GameMove =
  | { type: 'play'; card: Card; color?: string }
  | { type: 'bank' | 'discard' | 'pay'; card: Card }
  | { type: 'target'; player: Player; card: PropertyCard }
  | { type: 'swap' | 'build'; card: PropertyCard }
  | { type: 'debt'; player: Player }
  | { type: 'respond'; useJustSayNo: boolean }
  | { type: 'pass' }
  | { type: 'color'; card: PropertyCard; color: string };

export interface PendingDecision {
  type: 'turn' | 'discard' | 'payment' | 'response' | 'debt' | 'target' | 'swap' | 'building';
  player: Player;
  choices: GameMove[];
}
