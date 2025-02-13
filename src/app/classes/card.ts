export interface BaseCard {
    _id: string;
    type: string;
    name: string;
    imageName: string;
}

export interface ActionCard extends BaseCard {
    type: "action";
    effect: string;
}

export interface MoneyCard extends BaseCard {
    type: "money";
    value: number;
}

export interface PropertyCard extends BaseCard {
    type: "property";
    value: number;
    colors: string[];
    currentColor: string;
    setSize: number;
    rentValues: number[];
}

export type Card = ActionCard | MoneyCard | PropertyCard;