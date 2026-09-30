/* Horeca OS (deellaag): DE BON aan de zaakkant -- uitgeven, opzoeken,
   intrekken en roteren (deur horeca.bon_en_polsbandsaldo; de kern staat in
   kern/horeca/bon.js). Inwisselen loopt via horeca/betalen.js, de polsband via
   horeca/club.js.

   DE CODE bestaat kaal alleen in het antwoord op `bon/maak` en `bon/roteer`
   (lib/eenmalig-geheim-routes.js: no-store en buiten elke retrycache). Daarna
   noemt de zaak de bon bij zijn ID: opzoeken met de code geeft saldo en
   mutaties, nooit de code of de hash terug. */
module.exports = (kern) => {
  const { app, supplierAuth, managerOnly, logActivity, horeca } = kern;
  const { heleCenten, uitEuro } = horeca;
  const bon = () => horeca.bonlaag;
  const fout = (res, r) => res.status(r.status || 409).json({ error: r.error, code: r.code || null });
  const tekst = (v, n) => String(v == null ? '' : v).slice(0, n);

  app.post('/api/supplier/horeca/bon/maak', supplierAuth, async (req, res) => {
    const b = req.body || {};
    const bedrag = b.centen != null ? heleCenten(b.centen) : uitEuro(b.bedrag);
    if (!bedrag) return res.status(400).json({ error: 'Voor welk bedrag?' });
    const r = await bon().maak({ zaak: req.supplier.code, soort: b.soort, centen: bedrag, naam: tekst(b.naam, 60),
      geldigTot: tekst(b.geldigTot, 10), door: req.actor.name, idem: b.idem });
    if (!r.ok) return fout(res, r);
    // de code gaat nooit het activiteitenlog in
    logActivity(req.supplier.code, req.actor, 'gaf een ' + r.bon.soort + ' uit van ' + (bedrag / 100).toFixed(2));
    if (r.herhaald) return res.json(Object.assign({}, r, {
      uitleg: 'De code is alleen bij de eerste keer getoond. Kwijt? Roteer de bon; de oude code vervalt dan.' }));
    res.json({ ok: true, eenmalig: true, bon: Object.assign({}, r.bon, { code: r.code }),
      let: 'Deze code wordt maar een keer getoond: druk hem af of geef hem mee. Daarna heet de bon ' + r.bon.id + '.' });
  });

  /* OPZOEKEN IS KIJKEN: de zaak ziet saldo en de laatste mutaties. */
  app.post('/api/supplier/horeca/bon', supplierAuth, async (req, res) => {
    const code = tekst((req.body || {}).bonCode, 80);
    if (!code) return res.status(400).json({ error: 'Scan of typ de code van de bon.' });
    const r = await bon().lees({ zaak: req.supplier.code, code });
    if (!r.ok) return fout(res, r);
    res.json({ ok: true, bon: r.bon });
  });

  /* Intrekken mag elke medewerker (een gestolen bon dichtzetten hoort geen
     drempel te hebben); het saldo blijft staan, want het is geld van de houder. */
  app.post('/api/supplier/horeca/bon/intrek', supplierAuth, async (req, res) => {
    const b = req.body || {};
    const r = await bon().intrek({ zaak: req.supplier.code, id: tekst(b.id, 40), door: 'zaak:' + req.supplier.code,
      reden: tekst(b.reden, 120) || null });
    if (!r.ok) return fout(res, r);
    logActivity(req.supplier.code, req.actor, 'trok de code van bon ' + r.bon.id + ' in');
    res.json(r);
  });

  /* Roteren is werk van de manager: wie roteert, krijgt een code met saldo in
     handen. Ook de polsband roteert zo (zijn bon-ID staat op het clubscherm). */
  app.post('/api/supplier/horeca/bon/roteer', supplierAuth, async (req, res) => {
    if (!managerOnly(req, res)) return;
    const b = req.body || {};
    const r = await bon().roteer({ zaak: req.supplier.code, id: tekst(b.id, 40), door: 'zaak:' + req.supplier.code, idem: b.idem });
    if (!r.ok) return fout(res, r);
    logActivity(req.supplier.code, req.actor, 'gaf bon ' + r.bon.id + ' een nieuwe code');
    res.json(r);
  });
};
