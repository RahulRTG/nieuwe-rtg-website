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
  const { app, officeAuth, payrollOS, findSupplier, accounts, schoon } = kern;
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
    /* `ondanks` + `reden` zijn er voor een pakket dat zelf meldt dat het
       ongecontroleerd is: aanmerken kan dan alleen uitdrukkelijk, en de reden
       blijft eraan hangen. Zie kern/payroll/regelpakket.js. */
    antwoord(res, payrollOS.regels.merkAan(String(b.land || 'NL'), String(b.versie || ''), wie(req),
      { ondanks: b.ondanks === true, reden: b.reden }));
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

  /* De loonrun staat in ./payroll-os-run.js. De regelpakketten en de
     contracten hierboven zijn INRICHTING (wat geldt er); een run is UITVOERING
     (wat gebeurt er deze maand). Zelfde reden als bij ./payroll-os-zaak.js. */
  require('./payroll-os-run')(kern);

  /* De werkgevers- en medewerkerskant staat in ./payroll-os-zaak.js: een
     eigen onderwerp (wie keurt goed, wie ziet zijn eigen strook) en dit
     bestand ging over de 10 KB-lat. */
  require('./payroll-os-zaak')(kern);
};
