/* Routes van Payroll OS: de nieuwe loonlaag (server/kern/payroll/).

   DE POORTEN VOLGEN DE ROLLEN, NIET ANDERSOM. Wie wat mag, ligt vast in wie
   welk token heeft, en dat was al zo voordat deze laag bestond:

     officeAuth    het RTG-kantoor draait de loonadministratie VOOR de zaken:
                   regelpakketten aanmerken, runs openen, definitief maken,
                   journaal en betaalbestand.
     supplierAuth  de werkgever keurt goed en handelt de bevindingen af over
                   ZIJN eigen mensen. Een manager ziet zijn zaak en niet die
                   van de buurman -- dat komt uit req.supplier en niet uit een
                   parameter die de client meestuurt.
     auth          de medewerker ziet zijn eigen loonstroken. Niet die van een
                   ander, ook niet met een gok naar een ander personeelsnummer.

   Er is BEWUST geen route die een run definitief maakt vanaf de werkgeverskant.
   Vier ogen betekent dat de tweede handtekening bij de administratie ligt; een
   knop die beide zet, is een formulier. */
'use strict';

module.exports = (kern) => {
  const { app, officeAuth, supplierAuth, auth, payrollOS, findSupplier, accounts, schoon } = kern;
  if (!payrollOS) return; // de laag is niet gemount (bijv. in een kaal testproces)

  const antwoord = (res, r) => (r && r.error) ? res.status(r.status || 400).json(r) : res.json(r);
  const wie = (req) => (req.actor && req.actor.name) || 'onbekend';

  /* ---------- regelpakketten (kantoor) ---------- */
  app.post('/api/office/payroll/regels', officeAuth, (req, res) => {
    const land = String((req.body || {}).land || 'NL').toUpperCase();
    res.json({ ok: true, land, pakketten: payrollOS.regels.alle(land),
      tekenen: payrollOS.bijwerken.tekenen(land) });
  });

  /* Aanmerken: hierna mag er een definitieve run op. Dat is de enige plek waar
     een mens zegt "deze tarieven kloppen", en de naam blijft eraan hangen. */
  app.post('/api/office/payroll/regels/keur', officeAuth, (req, res) => {
    const b = req.body || {};
    antwoord(res, payrollOS.regels.merkAan(String(b.land || 'NL'), String(b.versie || ''), wie(req)));
  });

  app.post('/api/office/payroll/regels/haal', officeAuth, async (req, res) => {
    try { res.json({ ok: true, uitslag: await payrollOS.bijwerken.ronde() }); }
    catch (e) { res.status(500).json({ error: 'De bijwerkronde liep vast: ' + e.message }); }
  });

  /* Het LOONCOMPONENTENREGISTER staat in ./payroll-os-register.js -- een eigen
     onderwerp (wat IS een looncomponent) naast het draaien van een run, en dit
     bestand ging over de 10 KB. */
  require('./payroll-os-register')(kern);

  /* De DEKKING (waar kan er wereldwijd loon draaien, en welke bron levert het
     regelpakket van welk land) staat in ./payroll-os-dekking.js -- een eigen
     onderwerp, en dit bestand ging over de 10 KB. */
  require('./payroll-os-dekking')(kern);

  /* ---------- contracten (kantoor) ----------
     Het kantoor voert de loonadministratie voor de zaken; daar hoort het
     overtypen van een arbeidscontract bij. De zaakcode staat hier WEL in het
     verzoek, anders dan aan de werkgeverskant: een kantoormedewerker zit niet
     aan een zaak vast, dat is nu juist zijn werk. De poort is officeAuth.

     De medewerkerslijst zit erbij, want een contract vastleggen begint met het
     kiezen van een persoon, en een personeelsnummer uit het hoofd intypen is
     hoe je het contract van de verkeerde persoon wijzigt. */
  app.post('/api/office/payroll/personeel', officeAuth, (req, res) => {
    const s = findSupplier((req.body || {}).code);
    if (!s) return res.status(404).json({ error: 'Zaak niet gevonden.' });
    const dag = String((req.body || {}).opDatum || '').slice(0, 10);
    res.json({ ok: true, code: s.code, zaak: s.name, land: (s.settings && s.settings.land) || 'NL',
      staff: accounts.listStaff(s.code).map(m => ({ id: m.id, naam: m.name, func: m.func || null,
        manager: m.role === 'manager',
        contract: dag ? payrollOS.contracten.opDatum(s.code, m.id, dag) : null })) });
  });

  app.post('/api/office/payroll/contract', officeAuth, (req, res) => {
    const b = req.body || {};
    const s = findSupplier(b.code);
    if (!s) return res.status(404).json({ error: 'Zaak niet gevonden.' });
    const staff = accounts.getStaffById(Number(b.staffId));
    if (!staff || String(staff.supplier_code).toUpperCase() !== s.code.toUpperCase())
      return res.status(404).json({ error: 'Deze medewerker werkt niet bij deze zaak.' });
    antwoord(res, payrollOS.contracten.leg(s.code, staff.id, {
      vanaf: String(b.vanaf || ''), tot: b.tot ? String(b.tot) : null,
      soort: String(b.soort || ''), betaling: b.betaling ? String(b.betaling) : 'maand',
      uurloonCenten: Number(b.uurloonCenten),
      urenPerWeek: b.urenPerWeek != null ? Number(b.urenPerWeek) : null,
      functie: schoon(b.functie, 80) || null
    }, wie(req), b.nr != null ? Number(b.nr) : 1));
  });

  /* ---------- de loonrun ---------- */
  /* Openen doet het kantoor: het draait de administratie. De uren komen uit de
     klok van de zaak zelf, dus de client levert ze NIET aan -- anders is de
     invoer van een loonrun iets wat je kunt meesturen.

     DE INVOER BEGINT BIJ HET CONTRACT EN NIET BIJ DE KLOK, en die regel stond
     hier niet. Deze route liep over de geklokte feiten heen, dus wie niet
     prikte kwam niet in de run: iedereen met een maandsalaris viel er stil uit.
     Het samenstellen staat nu in kern/payroll/samenstellen.js -- daar is het te
     toetsen zonder server, en daar staat ook waarom ziekte doorbetaald hoort te
     worden in plaats van het loon te verlagen. */
  app.post('/api/office/payroll/run/open', officeAuth, (req, res) => {
    const b = req.body || {};
    const s = findSupplier(b.code);
    if (!s) return res.status(404).json({ error: 'Zaak niet gevonden.' });
    const periode = String(b.periode || '');
    if (!/^\d{4}-\d{2}$/.test(periode)) return res.status(400).json({ error: 'Kies een periode als 2026-07.' });

    const personeel = accounts.listStaff(s.code).map(m => ({ id: m.id, naam: m.name }));
    const opzet = payrollOS.samenstellen.stel({ code: s.code, periode, personeel,
      toeslagen: b.toeslagen, leeftijdsgroep: b.leeftijdsgroep });

    const r = payrollOS.run.open({ code: s.code, zaak: s.name, periode,
      land: (s.settings && s.settings.land) || 'NL', regels: opzet.regels, door: wie(req) });
    if (r.error) return res.status(r.status || 400).json(r);

    /* Meteen nalopen: een run zonder bevindingenlijst nodigt uit om hem over te
       slaan. De contracten gaan mee, zodat "loon zonder contract" echt gemeten
       wordt en niet als vals alarm afgaat (zie kern/payroll/controles.js). */
    const vorige = payrollOS.run.lijst(s.code).find(x => x.periode !== periode && x.stand === 'definitief');
    const bev = payrollOS.controles.loop(payrollOS.run.haal(r.run.id), {
      urenBevindingen: opzet.bevindingen, contracten: opzet.contracten,
      vorigeRun: vorige ? payrollOS.run.haal(vorige.id) : null });
    res.json(Object.assign(r, { bevindingen: bev.bevindingen, hoogOpen: bev.hoogOpen }));
  });

  app.post('/api/office/payroll/run/lijst', officeAuth, (req, res) =>
    res.json({ ok: true, runs: payrollOS.run.lijst((req.body || {}).code) }));

  app.post('/api/office/payroll/run/een', officeAuth, (req, res) => {
    const r = payrollOS.run.haal(String((req.body || {}).runId || ''));
    if (!r) return res.status(404).json({ error: 'Deze loonrun kennen we niet.' });
    res.json({ ok: true, run: r, bevindingen: payrollOS.controles.van(r.id) });
  });

  /* Goedkeuren: de administrateur tekent hier, de manager aan de zaakkant. */
  app.post('/api/office/payroll/run/keur', officeAuth, (req, res) => {
    const b = req.body || {};
    antwoord(res, payrollOS.run.keurGoed(String(b.runId || ''), 'administrateur', wie(req), null));
  });

  /* Definitief: pas als de bevindingen zijn afgehandeld EN beide handtekeningen
     staan. De controle op de bevindingen staat hier en niet in run.js, omdat
     run.js niets van de controlelaag hoort te weten -- maar hij hoort wel te
     gelden, dus staat hij op de enige plek waar definitief wordt gemaakt. */
  app.post('/api/office/payroll/run/definitief', officeAuth, (req, res) => {
    const runId = String((req.body || {}).runId || '');
    const mag = payrollOS.controles.magDefinitief(runId);
    if (mag.error) return res.status(mag.status).json(mag);
    antwoord(res, payrollOS.run.maakDefinitief(runId, wie(req)));
  });

  app.post('/api/office/payroll/run/verklaar', officeAuth, (req, res) => {
    const b = req.body || {};
    antwoord(res, payrollOS.controles.verklaar(String(b.runId || ''), String(b.soort || ''),
      b.staffId != null ? Number(b.staffId) : null, schoon(b.verklaring, 400), wie(req)));
  });

  app.post('/api/office/payroll/run/corrigeer', officeAuth, (req, res) => {
    const b = req.body || {};
    antwoord(res, payrollOS.run.corrigeer({ runId: String(b.runId || ''), regels: b.regels,
      door: wie(req), reden: schoon(b.reden, 300) }));
  });

  /* De DRIE UITGANGEN uit een definitieve run -- de boeking, het betaalbestand
     en de loonaangifte -- staan in ./payroll-os-uitgang.js. Ze horen bij elkaar
     (ze moeten alle drie hetzelfde zeggen) en dit bestand ging over de 10 KB. */
  require('./payroll-os-uitgang')(kern);

  /* De werkgevers- en medewerkerskant staat in ./payroll-os-zaak.js: een
     eigen onderwerp (wie keurt goed, wie ziet zijn eigen strook) en dit
     bestand ging over de 10 KB-lat. */
  require('./payroll-os-zaak')(kern);
};
