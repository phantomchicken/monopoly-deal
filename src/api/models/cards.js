const mongoose = require('mongoose');

const cardSchema = new mongoose.Schema({
    type: {
        type: String,
        required: true,
        enum: ["money", "property", "action"] 
    },
    name: {
        type: String,
        required: true
    },
    imageName: {
        type: String
    }
}, { discriminatorKey: 'type' });  // 'type' field will act as the discriminator

// Define the base Card model

const moneyCardSchema = new mongoose.Schema({
    value: {
        type: Number,
        required: true
    }
});

const propertyCardSchema = new mongoose.Schema({
    value: {
        type: Number,
        required: true
    },
    colors: {
        type: [String],
        required: true
    },
    currentColor: {
        type: String,
        required: true
    },
    setSize: {
        type: Number,
        required: true
    },
    rentValues: {
        type: [Number],
        required: true
    }
});

const actionCardSchema = new mongoose.Schema({
    effect: {
        type: String,
        required: true
    }
});

var Card = mongoose.model('Card', cardSchema, 'Cards');
var PropertyCard = Card.discriminator('property', propertyCardSchema);
var MoneyCard = Card.discriminator('money', moneyCardSchema);
var ActionCard = Card.discriminator('action', actionCardSchema);

module.exports = { Card, MoneyCard, PropertyCard, ActionCard };
