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
  const { app, supplierAuth, payrollOS, accounts, schoon } = kern;
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

  /* ---------- contracten ----------
     ZONDER DEZE ROUTES DRAAIT ER NOOIT EEN LOONSTROOK. Dat was geen theorie:
     /api/office/payroll/run/open slaat iedereen over die geen contract heeft
     (`if (!contract) continue;` -- terecht, want een uurloon verzinnen is
     erger dan een lege run), en er was geen enkele manier om er een vast te
     leggen. De hele loonlaag stond klaar en kon per definitie niets opleveren.

     De werkgever legt zijn eigen contracten vast: hij is de partij die ze heeft
     afgesloten. Een manager, want dit is het bedrag waar alles op rekent. Het
     RTG-kantoor kan het ook, want het voert de loonadministratie VOOR de zaken
     en typt in de praktijk het papier over dat de werkgever aanlevert -- die
     route staat in ./payroll-os.js, met de zaakcode erbij omdat het kantoor
     niet aan een zaak vastzit.

     Wijzigen is een VERSIE toevoegen -- de laag eronder overschrijft nooit, en
     meldt het als een wijziging terugwerkt. */
  app.post('/api/supplier/payroll/contract', supplierAuth, (req, res) => {
    if (!req.actor.manager) return res.status(403).json({ error: 'Alleen een manager legt een contract vast.' });
    const b = req.body || {};
    const staff = accounts.getStaffById(Number(b.staffId));
    if (!staff || String(staff.supplier_code).toUpperCase() !== String(req.supplier.code).toUpperCase())
      return res.status(404).json({ error: 'Deze medewerker werkt niet bij uw zaak.' });
    antwoord(res, payrollOS.contracten.leg(req.supplier.code, staff.id, {
      vanaf: String(b.vanaf || ''), tot: b.tot ? String(b.tot) : null,
      soort: String(b.soort || ''), betaling: b.betaling ? String(b.betaling) : 'maand',
      uurloonCenten: Number(b.uurloonCenten),
      urenPerWeek: b.urenPerWeek != null ? Number(b.urenPerWeek) : null,
      functie: schoon(b.functie, 80) || null
    }, req.actor.name, b.nr != null ? Number(b.nr) : 1));
  });

  /* De geschiedenis, en niet alleen de huidige versie. Wie wil weten waarom de
     strook van juni anders is dan die van juli, kijkt hier. */
  app.post('/api/supplier/payroll/contracten', supplierAuth, (req, res) => {
    const staff = accounts.getStaffById(Number((req.body || {}).staffId));
    if (!staff || String(staff.supplier_code).toUpperCase() !== String(req.supplier.code).toUpperCase())
      return res.status(404).json({ error: 'Deze medewerker werkt niet bij uw zaak.' });
    const uit = {};
    for (const nr of payrollOS.contracten.nummersVan(req.supplier.code, staff.id))
      uit[nr] = payrollOS.contracten.geschiedenis(req.supplier.code, staff.id, nr);
    res.json({ ok: true, staffId: staff.id, contracten: uit });
  });

  /* De aangifte over de eigen zaak: LEZEN, niet indienen. De werkgever heeft er
     recht op te zien wat er namens hem wordt aangegeven -- hij betaalt het --
     maar RTG voert de administratie en tekent ervoor. Twee partijen die allebei
     kunnen indienen, is twee aangiftes over dezelfde periode. */
  app.post('/api/supplier/payroll/aangiftes', supplierAuth, (req, res) =>
    res.json({ ok: true, aangiftes: payrollOS.aangifte.vanZaak(req.supplier.code,
      (req.body || {}).periode || null) }));

  /* ---------- verzuim voor de PLANNING ----------
     `voorPlanning()` stond in kern/payroll/verzuim.js en werd door niemand
     aangeroepen. Dat is precies de functie waar die hele module voor is
     gebouwd: een leidinggevende mag weten DAT iemand er niet is en WAT hij nog
     kan, en niet WAT hij heeft.

     Het verschil zit in het antwoord: bij ziekte staat er "afwezig" en niet
     "ziek", en er staat bij wat iemand nog wel kan (niets / aangepast / deels /
     volledig). Dat tweede is wat een rooster nodig heeft en wat nergens te zien
     was -- terwijl het al die tijd werd vastgelegd. */
  app.post('/api/supplier/verzuim/planning', supplierAuth, (req, res) => {
    const b = req.body || {};
    const van = String(b.van || '').slice(0, 10), tot = String(b.tot || '').slice(0, 10);
    if (!/^\d{4}-\d{2}-\d{2}$/.test(van) || !/^\d{4}-\d{2}-\d{2}$/.test(tot))
      return res.status(400).json({ error: 'Geef een begin- en einddatum (JJJJ-MM-DD).' });
    const uit = [];
    for (const m of accounts.listStaff(req.supplier.code)) {
      const regels = payrollOS.verzuim.voorPlanning(req.supplier.code, m.id, van, tot);
      if (regels.length) uit.push({ staffId: m.id, naam: m.name, func: m.func || null, regels });
    }
    res.json({ ok: true, van, tot, afwezig: uit,
      let: 'Bij ziekte staat er "afwezig" en niet wat iemand heeft. Wat iemand nog wel kan, staat er wel: daar plant u mee.' });
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

  /* De MEDEWERKERSKANT (zijn eigen stroken, zijn eigen dossier, zijn eigen
     inzagespoor) staat in ./payroll-os-mens.js. Een eigen onderwerp met een
     eigen poort -- daar komt niets uit een zaakcode maar alles uit de koppeling
     met zijn RTG-account -- en dit bestand ging over de 10 KB. */
  require('./payroll-os-mens')(kern);
};
