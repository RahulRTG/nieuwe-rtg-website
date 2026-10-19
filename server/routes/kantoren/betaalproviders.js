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
    if (!kern.betaalWaarheid) return { status: 503, error: 'De betaalwaarheid draait hier niet.' };
    const b = req.body || {};
    const r = await kern.betaalWaarheid.terugAfhandelen({ betalingId: b.betalingId, opdrachtId: b.opdrachtId,
      uitkomst: b.uitkomst, reden: b.reden, door: wie(req) });
    if (r.ok && afdelingen && afdelingen.audit) afdelingen.audit(wie(req), 'Vastgelopen terugbetaling ' + r.opdrachtId +
      ' afgehandeld: ' + (b.uitkomst === 'terug' ? 'het geld is terug' : 'het geld is niet terug'));
    return r;
  }));
};
