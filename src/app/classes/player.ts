import { Card, MoneyCard, PropertyCard } from "./card";

export class Player {
    id: number = 0;
    name:string = "";
    hand: Card[] = [];
    bank: Card[] = [];
    properties: PropertyCard[] = [];

    constructor(id: number, name: string) {
        this.id = id;
        this.name = name;
        this.hand = [];
        this.bank = [];
        this.properties = [];
    }
}
