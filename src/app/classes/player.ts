import { Card, MoneyCard } from "./card";

export class Player {
    id: number = 0;
    name:string = "";
    hand: Card[] = [];
    bank: MoneyCard[] = [];
    properties: Card[] = [];

    constructor(id: number, name: string) {
        this.id = id;
        this.name = name;
    }
}
