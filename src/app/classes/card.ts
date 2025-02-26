export interface BaseCard {
    _id: string;
    type: string;
    name: string;
    imageName: string;
    value: number;
}

export interface ActionCard extends BaseCard {
    type: "action";
    effect: string;
}

export interface MoneyCard extends BaseCard {
    type: "money";
}

export interface PropertyCard extends BaseCard {
    type: "property";
    colors: string[];
    currentColor: string;
    setSize: number;
    rentValues: number[];
    buildings?: {house: Card | null, hotel: Card | null};
}

export type Card = ActionCard | MoneyCard | PropertyCard;