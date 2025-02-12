const router = require('express').Router();
const ctrlCards = require('../controllers/cards');

router.route('/card')
    .post(ctrlCards.addCard)
router.route('/cards')
    .get(ctrlCards.getCards)
router.route('/card/:idCard')
    .get(ctrlCards.getCard)
    .put(ctrlCards.updateCard) //auth?
    .delete(ctrlCards.deleteCard) //auth?

module.exports = router;