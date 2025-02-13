import { Card } from "./card";
import { Player } from "./player";

export class Game {
    players: Player[] = [];
    turn: number = 0;
    deck: Card[] = [];
    discard: Card[] = [];
}
