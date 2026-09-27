/* Het boek van RTG zelf (server/kern/rtgboek.js, besluiten C8 tot en met C11).

   Twee deuren, allebei achter de kantoorinlog: de kamer Financiën leest en vult
   het boek. Wie een bedrag zet komt uit de sessie en nooit uit het lichaam, en
   op de gedeelde kantoorcode weigert de kern (een bedrag waar een marge en een
   runway op rusten, hoort bij een mens op naam). Er beweegt hier geen geld. */
'use strict';

module.exports = (kern) => {
  const { app, officeAuth, boardroomWie, rtgBoek, rtgBoekZet, RTGBOEK_DELEN } = kern;
  const stuur = (res, r) => (r.error ? res.status(r.status || 400).json({ error: r.error }) : res.json(r));

  app.post('/api/office/rtgboek', officeAuth, (req, res) =>
    res.json({ ok: true, boek: rtgBoek((req.body || {}).maand), delen: RTGBOEK_DELEN }));

  app.post('/api/office/rtgboek/zet', officeAuth, (req, res) => {
    const b = req.body || {};
    stuur(res, rtgBoekZet({ maand: b.maand, deel: String(b.deel || ''), post: String(b.post || ''),
      centen: b.centen, bron: b.bron, wie: boardroomWie(req) }));
  });
};
