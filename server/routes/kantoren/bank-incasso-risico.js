/* Kantoren, deel "bank-incasso-risico": DE RISICOGOEDKEURING VAN EEN INCASSORONDE.

   AFGESPLITST VAN ./bank-incasso.js (10 KB-regel). Eigenaarsbesluit 2C (11 oktober
   2026): een incassoronde boven de omkeerbaarheidsgrens is niet terug te draaien
   (kern/commercie/geldomkeer.js) en mag alleen door met een risicogoedkeuring per
   ronde (kern/commercie/risicouitzondering.js). ./bank-incasso.js zet zo'n ronde klaar
   ZONDER deurticket; dit bestand geeft de goedkeuring en opent daarna het ticket.

   Gemount vanuit ./bank-incasso.js, met dezelfde context. */
'use strict';

const { BELEID } = require('../../kern/commercie/besluit');
const geldomkeer = require('../../kern/commercie/geldomkeer');

module.exports = (ctx) => {
  const { app, kluisAuth, veilig, kern, naam, tweedeHand, zwaar, boardroomUser } = ctx;

  /* DE RISICOGOEDKEURING VAN EEN RONDE (eigenaarsbesluit 2C). Een andere mens dan de
     aanvrager, op naam en met zijn passkey zonder terugval, voor precies dit voornemen;
     daarna gaat het deurticket voor de tweede mens open, op naam van de AANVRAGER, zodat
     de bestaande deur blijft weigeren dat hij zijn eigen ronde aftekent. Drie mensen, drie
     verschillende vragen: aanvragen, risico dragen, bevoegd tekenen. */
  app.post('/api/office/bank/incasso/risico/opties', kluisAuth, async (req, res) => {
    const vid = String((req.body || {}).voornemen || '');
    if (!vid) return res.status(400).json({ error: 'Voor welke ronde? Het voornemen ontbreekt.' });
    const r = await zwaar.opties(boardroomUser(req), 'bank.incasso.risico', 'risico:' + vid, req);
    if (r.error) return res.status(r.status || 400).json({ error: r.error });
    res.json(r);
  });
  /* mutatie: hooguitEens -- een tweede goedkeuring op hetzelfde voornemen weigert (409): een
     toestandscontrole en geen idempotentie. */
  app.post('/api/office/bank/incasso/risico', kluisAuth, async (req, res) => {
    const ketenlaag = kern.geldketen;
    if (!ketenlaag) return veilig(res, () => ({ status: 503, error: 'De geldketen is niet gemount.' }));
    const b = req.body || {};
    const vid = String(b.voornemen || '');
    const v = vid && kern.voornemens ? kern.voornemens.vind(vid) : null;
    if (!v || v.handeling !== 'GELD_INNEN') return veilig(res, () => ({ status: 404, error: 'Er is geen incassoronde met dit voornemen.' }));
    if (String(b.reden || '').trim().length < 10)
      return veilig(res, () => ({ status: 400, error: 'Een risicogoedkeuring draagt een reden van ten minste tien tekens.' }));
    const zw = await zwaar.eis(boardroomUser(req), 'bank.incasso.risico', 'risico:' + vid, req,
      'De risicogoedkeuring van een incassoronde', { zonderTerugval: true });
    if (!zw.ok) return zwaar.stuur(res, zw);
    const r = ketenlaag.risicoGoedkeur({ id: vid, door: req.officeKey, naam: naam(req), reden: b.reden });
    if (!r.ok) return veilig(res, () => r);
    const tot = Number(v.stappen && v.stappen[0] && v.stappen[0].gegevens && v.stappen[0].gegevens.tot);
    veilig(res, () => {
      const vraag = tweedeHand.vraag({ actie: 'bank.incasso', lijf: { tot, voornemen: vid },
        onderwerp: 'incassoronde ' + vid + ' (met risicogoedkeuring, € ' + (v.totaalCenten / 100).toFixed(2) + ')',
        door: r.aanvrager || req.officeKey });
      return vraag.ok ? { ...vraag, voornemen: r.voornemen, dossier: r.dossier } : vraag;
    });
  });

  /* Moet deze ronde eerst een risicogoedkeuring hebben? Dan nog GEEN deurticket: de tweede
     mens zou anders tekenen voor een nee. Geeft het antwoord terug, of null. */
  function wacht(klaar, blik) {
    if (!(klaar.voornemen.totaalCenten >= BELEID.omkeerbaarBovenCenten) || geldomkeer.voor('GELD_INNEN').omkeerbaar ||
        klaar.voornemen.risicogoedkeuring) return null;
    return { status: 200, ok: true, wachtOpRisico: true, voornemen: klaar.voornemen, dossier: klaar.dossier, vooruitblik: blik,
      uitleg: 'Boven de grens en niet terug te draaien: een andere collega geeft eerst de risicogoedkeuring (voornemen ' +
        klaar.voornemen.id + '), daarna tekent een tweede mens. Er is nog niets geind.' };
  }

  return { wacht };
};
