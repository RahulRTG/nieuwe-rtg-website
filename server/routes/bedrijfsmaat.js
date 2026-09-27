/* De bedrijfsmaten van RTG als onderneming (server/kern/bedrijfsmaat/stand.js),
   en het banksaldo van RTG eronder (server/kern/bankpositie.js).

   DE BEDRIJFSMATEN: EEN ROUTE, LEZEND, ACHTER DE BOARDROOM. Wat hier staat, gaat over de hele
   onderneming, en dat is de kamer van de eigenaar. Elk getal dat over mensen
   optelt is al langs de groepspoort geweest: onder de grens staat er
   TE_KLEINE_GROEP met de grens en de reden, en geen waarde en geen aantal.

   Het kantoorstuur mag deze route lezen (besluit C2: tonen), en krijgt daarbij
   niets meer dan de mens die het vraagt -- de boardroomdeur geldt voor beide. */
'use strict';
const { BESLUITEN } = require('../kern/bedrijfsmaat/besluiten');

module.exports = (kern) => {
  const { app, boardroomAuth, boardroomWie, bedrijfsmaat, bankpositie, bankpositieZet } = kern;
  app.post('/api/office/bedrijfsmaat', boardroomAuth, (req, res) => {
    const uit = bedrijfsmaat.stand({ maand: (req.body || {}).maand });
    res.json(Object.assign({ ok: true, besluiten: BESLUITEN.map(b => ({ id: b.id, naam: b.naam, kort: b.kort })) }, uit));
  });

  /* HET BANKSALDO VAN RTG (kern/bankpositie.js, besluit C4): lezen en, op naam,
     het saldo van een maand zetten met het afschrift als bron. Wie het zette komt
     uit de sessie en nooit uit het verzoek. */
  app.post('/api/office/bankpositie', boardroomAuth, (req, res) =>
    res.json(Object.assign({ ok: true }, bankpositie((req.body || {}).maand))));
  app.post('/api/office/bankpositie/zet', boardroomAuth, (req, res) => {
    const wie = boardroomWie(req);
    if (!wie) return res.status(403).json({ error: 'Een saldo zet een mens op naam, niet de gedeelde kantoorcode.' });
    const b = req.body || {};
    const r = bankpositieZet({ maand: b.maand, centen: b.centen, peildatum: b.peildatum, bron: b.bron, wie });
    if (r.error) return res.status(r.status || 400).json({ error: r.error });
    res.json(r);
  });
};
