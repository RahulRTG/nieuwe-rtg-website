/* Routes van Payroll OS: de kant van de WERKGEVER en de MEDEWERKER.

   Afgesplitst van ./payroll-os.js (dat het kantoor bedient) om twee redenen.
   De praktische: dat bestand ging over de 10 KB-lat. De echte: dit is een
   ander onderwerp met andere poorten. Het kantoor DRAAIT de administratie;
   hier keurt de werkgever goed over zijn eigen mensen, en ziet een medewerker
   zijn eigen strook.

   TWEE GRENZEN DIE HIER NIET MOGEN VERVAGEN:

   1. DE ZAAK KOMT UIT HET TOKEN, niet uit het verzoek. Een zaakcode in het lijf
      zou betekenen dat elke manager de loonrun van de buurman kan opvragen.
   2. HET PERSONEELSNUMMER VAN DE MEDEWERKER KOMT UIT DE KOPPELING met zijn
      RTG-account, niet uit een parameter. Anders is andermans loonstrook een
      kwestie van een ander getal invullen.

   En er is bewust GEEN route die hier een run definitief maakt: vier ogen
   betekent dat de tweede handtekening bij de administratie ligt. */
'use strict';

module.exports = (kern) => {
  const { app, supplierAuth, auth, payrollOS, accounts, schoon } = kern;
  if (!payrollOS) return;

  const antwoord = (res, r) => (r && r.error) ? res.status(r.status || 400).json(r) : res.json(r);

  /* ---------- de werkgever ---------- */
  /* Alleen de eigen zaak, en dat komt uit het token. Een code in het lijf zou
     betekenen dat elke manager de loonrun van de buurman kan opvragen. */
  app.post('/api/supplier/payroll/runs', supplierAuth, (req, res) =>
    res.json({ ok: true, runs: payrollOS.run.lijst(req.supplier.code) }));

  app.post('/api/supplier/payroll/bevindingen', supplierAuth, (req, res) => {
    const r = payrollOS.run.haal(String((req.body || {}).runId || ''));
    if (!r || r.code !== req.supplier.code) return res.status(404).json({ error: 'Deze loonrun kennen we niet.' });
    res.json({ ok: true, run: payrollOS.run.lijst(req.supplier.code).find(x => x.id === r.id),
      bevindingen: payrollOS.controles.van(r.id) });
  });

  app.post('/api/supplier/payroll/keur', supplierAuth, (req, res) => {
    if (!req.actor.manager) return res.status(403).json({ error: 'Alleen een manager keurt de loonrun goed.' });
    const r = payrollOS.run.haal(String((req.body || {}).runId || ''));
    if (!r || r.code !== req.supplier.code) return res.status(404).json({ error: 'Deze loonrun kennen we niet.' });
    // wieBenIk: het personeelsnummer van de goedkeurder, zodat niemand zijn
    // eigen loon aftekent
    antwoord(res, payrollOS.run.keurGoed(r.id, 'manager', req.actor.name, req.actor.staffId));
  });

  /* De identiteit van het eigen personeel: standaard alleen ja/nee. */
  app.post('/api/supplier/identiteit', supplierAuth, (req, res) =>
    res.json({ ok: true, standen: payrollOS.identiteit.standen(accounts.listStaff(req.supplier.code)) }));

  app.post('/api/supplier/identiteit/opvraag', supplierAuth, (req, res) => {
    const b = req.body || {};
    const staff = accounts.getStaffById(Number(b.staffId));
    antwoord(res, payrollOS.identiteit.opvraag({ supplierCode: req.supplier.code,
      supplierNaam: req.supplier.name, staff, niveau: String(b.niveau || 'gegevens'),
      reden: schoon(b.reden, 300), door: req.actor.name,
      doorRol: req.actor.manager ? 'manager' : 'staff' }));
  });

  /* ---------- de medewerker ---------- */
  /* Zijn eigen stroken, en de uitleg erbij. Het personeelsnummer komt uit de
     koppeling met het RTG-account, niet uit het verzoek. */
  app.post('/api/member/loonstroken', auth, (req, res) => {
    const lid = req.session && req.session.account ? req.session.account : null;
    if (!lid) return res.status(403).json({ error: 'Meld u aan met uw eigen RTG-account.' });
    const uit = [];
    for (const s of (accounts.staffPositions ? accounts.staffPositions(lid.id) : [])) {
      for (const st of payrollOS.run.strokenVan(s.supplier_code, s.id)) {
        uit.push(Object.assign({ zaak: s.supplier_naam || s.supplier_code }, st,
          { uitleg: legUit(st.strook) }));
      }
    }
    res.json({ ok: true, stroken: uit });
  });

  /* "Je nettoloon is deze periode hoger door 12 nachturen en vakantiegeld."
     Een loonstrook die alleen bedragen toont, laat mensen raden; een zin die
     zegt WAAROM is het verschil tussen een pdf en een antwoord. */
  function legUit(strook) {
    const zinnen = [];
    for (const r of strook.regels) {
      if (r.soort !== 'bruto' || r.component === 'gewerkte_uren') continue;
      zinnen.push(r.aantal != null
        ? r.aantal + ' ' + r.naam.toLowerCase() + ' (' + (r.centen / 100).toFixed(2) + ')'
        : r.naam.toLowerCase() + ' (' + (r.centen / 100).toFixed(2) + ')');
    }
    const basis = strook.regels.find(r => r.component === 'gewerkte_uren');
    const kop = basis ? basis.aantal + ' gewerkte uren' : 'uw vaste loon';
    return zinnen.length
      ? 'Dit bedrag komt uit ' + kop + ', plus ' + zinnen.join(' en ') + '. Daarvan gaat de loonheffing af.'
      : 'Dit bedrag komt uit ' + kop + '. Daarvan gaat de loonheffing af.';
  }
};
