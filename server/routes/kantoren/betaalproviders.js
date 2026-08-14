/* Financien leest de betaalregie. Besluiten en technische wijzigingen lopen
   via de zwaarder beveiligde Boardroom-/Techniekdeur; een gedeelde kantoorcode
   mag nooit een provider live kunnen zetten. */
'use strict';

module.exports = ({ app, officeAuth, veilig, kern }) => {
  app.post('/api/office/betalingen/status', officeAuth, (req, res) =>
    veilig(res, () => kern.betaalRegie.overzicht()));
};
