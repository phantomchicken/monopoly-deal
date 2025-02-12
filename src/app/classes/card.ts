export type CardType = "money" | "property" | "action";
export class Card {
    _id: string = "" ;
    type: string = "";
    name: string = "";
}

export class MoneyCard extends Card{
    override type: string = "money";
    value: number = 0;
}

export class PropertyCard extends Card{
    override type: string = "property";
    value: number = 0;
    colors: string[] = [];
    currentColor: string = "";
    setSize: number = 3;
    rentValues: number[] = [];
}

export class ActionCard extends Card{
    override type: string = "action";
    effect: string = "";
}