/* De bedrijfsmaten van RTG als onderneming (server/kern/bedrijfsmaat/stand.js).

   EEN ROUTE, LEZEND, ACHTER DE BOARDROOM. Wat hier staat, gaat over de hele
   onderneming, en dat is de kamer van de eigenaar. Elk getal dat over mensen
   optelt is al langs de groepspoort geweest: onder de grens staat er
   TE_KLEINE_GROEP met de grens en de reden, en geen waarde en geen aantal.

   Het kantoorstuur mag deze route lezen (besluit C2: tonen), en krijgt daarbij
   niets meer dan de mens die het vraagt -- de boardroomdeur geldt voor beide. */
'use strict';
const { BESLUITEN } = require('../kern/bedrijfsmaat/besluiten');

module.exports = (kern) => {
  const { app, boardroomAuth, bedrijfsmaat } = kern;
  app.post('/api/office/bedrijfsmaat', boardroomAuth, (req, res) => {
    const uit = bedrijfsmaat.stand({ maand: (req.body || {}).maand });
    res.json(Object.assign({ ok: true, besluiten: BESLUITEN.map(b => ({ id: b.id, naam: b.naam, kort: b.kort })) }, uit));
  });
};
