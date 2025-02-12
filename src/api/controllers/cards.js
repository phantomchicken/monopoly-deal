const mongoose = require('mongoose');
const Card = require('../models/cards').Card; // Import the Card model

// Add a new card
const addCard = async (req, res) => {
    try {
        const cardData = req.body; // Get the data from the request body
        const newCard = new Card(cardData); // Create a new instance of the Card model
        await newCard.save(); // Save the card to the database
        res.status(201).json(newCard); // Return the created card with a 201 status
    } catch (error) {
        res.status(400).json({ error: error.message }); // Handle any errors
    }
};

// Get all cards
const getCards = async (req, res) => {
    try {
      const cards = await Card.find(); // Get all cards from the database
        res.status(200).json(cards); // Return all cards
    } catch (error) {
        res.status(500).json({ error: error.message }); // Handle any errors
    }
};

// Get a specific card by ID
const getCard = async (req, res) => {
    try {
        const { idCard } = req.params; // Get the card ID from the request parameters
        const card = await Card.findById(idCard); // Find the card by its ID
        if (!card) {
            return res.status(404).json({ error: 'Card not found' }); // Handle case where card doesn't exist
        }
        res.status(200).json(card); // Return the found card
    } catch (error) {
        res.status(500).json({ error: error.message }); // Handle any errors
    }
};

// Update a card by ID
const updateCard = async (req, res) => {
    try {
        const { idCard } = req.params; // Get the card ID from the request parameters
        const cardData = req.body; // Get the updated data from the request body
        const updatedCard = await Card.findByIdAndUpdate(idCard, cardData, { new: true }); // Update the card in the database
        if (!updatedCard) {
            return res.status(404).json({ error: 'Card not found' }); // Handle case where card doesn't exist
        }
        res.status(200).json(updatedCard); // Return the updated card
    } catch (error) {
        res.status(500).json({ error: error.message }); // Handle any errors
    }
};

// Delete a card by ID
const deleteCard = async (req, res) => {
    try {
        const { idCard } = req.params; // Get the card ID from the request parameters
        const deletedCard = await Card.findByIdAndDelete(idCard); // Delete the card from the database
        if (!deletedCard) {
            return res.status(404).json({ error: 'Card not found' }); // Handle case where card doesn't exist
        }
        res.status(200).json({ message: 'Card deleted successfully' }); // Return success message
    } catch (error) {
        res.status(500).json({ error: error.message }); // Handle any errors
    }
};

// Export the controller methods
module.exports = {
    addCard,
    getCards,
    getCard,
    updateCard,
    deleteCard
};
