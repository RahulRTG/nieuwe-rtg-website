/* Routes van Payroll OS: HET LOONCOMPONENTENREGISTER.

   ZONDER DEZE ROUTES WAS HET REGISTER ONBEREIKBAAR. De hele belofte van
   kern/payroll/componenten.js is dat een looncomponent een REGEL is en geen
   veld: een horecabedrijf voegt fooien toe, een vervoerder wachttijd, een
   school een eindejaarsuitkering -- een rij in het register, niet een tak in de
   code. Maar `zet()` had geen route en geen scherm, dus de elf uit de basisset
   waren alles wat er ooit zou zijn. De belofte stond in de kop van het bestand
   en werkte nergens.

   ALLEEN HET KANTOOR. Een component bepaalt welke GRONDSLAGEN een bedrag raakt
   -- telt hij mee voor de loonheffing, voor de premies, voor het vakantiegeld --
   en dat is de loonadministratie en niet de werkgever. Wie zijn eigen
   grondslagen mag zetten, kan zijn eigen premies wegzetten.

   Afgesplitst van ./payroll-os.js, dat over de 10 KB ging. */
'use strict';

module.exports = (kern) => {
  const { app, officeAuth, payrollOS, schoon } = kern;
  if (!payrollOS) return;

  const antwoord = (res, r) => (r && r.error) ? res.status(r.status || 400).json(r) : res.json(r);
  const wie = (req) => (req.actor && req.actor.name) || 'onbekend';

  /* ---------- het looncomponentenregister ----------
     ZONDER DEZE ROUTES WAS HET REGISTER ONBEREIKBAAR. De hele belofte van
     kern/payroll/componenten.js is dat een looncomponent een REGEL is en geen
     veld: een horecabedrijf voegt fooien toe, een vervoerder wachttijd, een
     school een eindejaarsuitkering -- een rij in het register, niet een tak in
     de code. Maar `zet()` had geen route en geen scherm, dus de elf uit de
     basisset waren alles wat er ooit zou zijn. De belofte stond in de kop van
     het bestand en werkte nergens.

     Alleen het kantoor: een component bepaalt welke GRONDSLAGEN een bedrag
     raakt (telt hij mee voor de loonheffing, voor de premies, voor het
     vakantiegeld). Dat is de loonadministratie en niet de werkgever. */
  app.post('/api/office/payroll/componenten', officeAuth, (req, res) => {
    const dag = String((req.body || {}).opDatum || '').slice(0, 10);
    res.json({ ok: true,
      componenten: dag ? payrollOS.componenten.geldigOp(dag) : payrollOS.componenten.alle(),
      soorten: payrollOS.componenten.SOORTEN, bronnen: payrollOS.componenten.BRONNEN,
      goedkeuring: payrollOS.componenten.GOEDKEURING });
  });

  /* Toevoegen EN wijzigen op dezelfde route, want het is dezelfde handeling:
     de sleutel bepaalt of het een nieuwe rij is. Een bestaande rij verdwijnt
     nooit -- oude stroken moeten leesbaar blijven -- maar hij kan wel per datum
     vervallen (geldigTot), en dan telt hij niet meer mee in nieuwe runs. */
  app.post('/api/office/payroll/component', officeAuth, (req, res) => {
    const b = req.body || {};
    antwoord(res, payrollOS.componenten.zet({
      sleutel: String(b.sleutel || '').trim().toLowerCase(),
      naam: schoon(b.naam, 60), soort: String(b.soort || ''),
      belast: b.belast === true, bijzonder: b.bijzonder === true,
      grondslagen: Array.isArray(b.grondslagen) ? b.grondslagen.map(String) : [],
      pensioengevend: b.pensioengevend === true,
      vakantiegeldgevend: b.vakantiegeldgevend === true,
      invoerbron: String(b.invoerbron || ''), goedkeuring: String(b.goedkeuring || ''),
      grootboek: schoon(b.grootboek, 20) || null,
      geldigVan: b.geldigVan || null, geldigTot: b.geldigTot || null
    }, wie(req)));
  });

};
