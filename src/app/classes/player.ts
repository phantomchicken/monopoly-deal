import { Card, MoneyCard } from "./card";

export class Player {
    id: string = "";
    name:string = "";
    hand: Card[] = [];
    bank: MoneyCard[] = [];
    properties: Card[] = [];
}
