/* Financien leest de betaalregie. Besluiten en technische wijzigingen lopen
   via de zwaarder beveiligde Boardroom-/Techniekdeur; een gedeelde kantoorcode
   mag nooit een provider live kunnen zetten. */
'use strict';

module.exports = ({ app, officeAuth, veilig, afdelingen, kern }) => {
  app.post('/api/office/betalingen/status', officeAuth, (req, res) =>
    veilig(res, () => kern.betaalRegie.overzicht()));

  /* EEN VASTGELOPEN TERUGBETALING AFHANDELEN (eigenaarsbesluit 19 oktober
     2026): de regel "terugbetaling vastgelopen" op de lijst hierboven, met een
     knop. Achter naamAuth: wie het geld terug verklaart, is een mens op naam en
     nooit de gedeelde kantoorcode. De naam komt uit de sessie, nooit uit de body
     (dezelfde regel als routes/uitgifte.js). */
  const wie = (req) => String(req.kantoorKey || (req.eigenaar ? req.officeKey : '') || '');
  app.post('/api/office/betalingen/terug/afhandel', kern.naamAuth, (req, res) => veilig(res, async () => {
    const b = req.body || {};
    const r = await kern.betaalRegie.terugAfhandelen({ betalingId: b.betalingId, opdrachtId: b.opdrachtId,
      uitkomst: b.uitkomst, reden: b.reden, door: wie(req) });
    if (r.ok && afdelingen && afdelingen.audit) afdelingen.audit(wie(req), 'Vastgelopen terugbetaling ' + r.opdrachtId +
      ' afgehandeld: ' + (b.uitkomst === 'terug' ? 'het geld is terug' : 'het geld is niet terug'));
    return r;
  }));

  /* EEN BETALING OP CONTROLE AFRONDEN (eigenaarsbesluit 19 oktober 2026, derde
     reeks): de regel "betaling op controle" op dezelfde lijst. Zelfde deur en
     dezelfde naamregel; de overgang zelf staat in kern/betaalwaarheid/controle.js. */
  app.post('/api/office/betalingen/controle/afrond', kern.naamAuth, (req, res) => veilig(res, async () => {
    const b = req.body || {};
    const r = await kern.betaalRegie.controleAfronden({ betalingId: b.betalingId, reden: b.reden, door: wie(req) });
    if (r.ok && afdelingen && afdelingen.audit) afdelingen.audit(wie(req), 'Controle afgerond van betaling ' + r.betalingId + ': terug naar ' + r.stand);
    return r;
  }));
};
