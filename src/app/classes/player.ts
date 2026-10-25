import { Card, MoneyCard, PropertyCard } from "./card";

export type PlayerControl = 'human' | 'ai';
export interface PlayerSetup {
    name: string;
    control: PlayerControl;
}

export class Player {
    id: number = 0;
    name:string = "";
    hand: Card[] = [];
    bank: Card[] = [];
    properties: PropertyCard[] = [];

    constructor(id: number, name: string, public control: PlayerControl = 'human') {
        this.id = id;
        this.name = name;
        this.hand = [];
        this.bank = [];
        this.properties = [];
    }
}
