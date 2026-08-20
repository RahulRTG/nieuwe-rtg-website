/* Staff (deelmodule): de dienstlaag: Fluister voor de vloer (eigen geheugen
   per personeelslid), het eigen overzicht, verlof en ziekmelden en de
   vertrouwenspersoon. Krijgt de gedeelde context een keer bij het opstarten
   vanuit routes/staff.js.

   IN- EN UITKLOKKEN STAAT IN ./dienst-klok.js. Die knip kwam toen dit bestand
   over de leesgrens ging, en de naad lag er al: hier staat wat er gebeurt als je
   er NIET bent (verlof, ziek, wat kan ik nog wel, de vertrouwenspersoon), daar
   staat wat er gebeurt als je er WEL bent (de klok, de pauze, en sinds
   PLAATS.md fase 2 de aanwezigheid bij het hek van de zaak). */
module.exports = (actx) => {
  const { DEMO, accounts, app, checkCred, crypto, db, findStaffPartner, hasCred, klokVan, logActivity, managerOnly, notifySupplier, publicPartner, save, schoon, sseClients, sseSend, sseToOffice, sseToSupplier, supplierAuth, trustVan, stuurLus, werkbeleidPauzeStand, WERKBELEID_PAUZE_MINUTEN,
    /* payrollOS: een ziekmelding heeft twee kanten. De bezetting van vandaag
       (deze laag) en de loondoorbetaling (kern/payroll/verzuim). Die tweede
       stond gebouwd en werd door niets aangeroepen: de loonrun wist niet dat
       iemand ziek was. Hij mag ontbreken (een kaal testproces mount de loonlaag
       niet), dus elke aanroep hieronder controleert dat. */
    payrollOS, plaats, codenaamVan } = actx;
  const fluister = actx.fluister;
  const { fluisterZeg, fluisterVergeet, fluisterFocus, fluisterProfiel } = fluister;
/* Fluister voor de vloer staat in ./dienst-fluister.js: dat stuk praat met een
   modelaanbieder en de rest van deze laag niet, dus de vraag wat er naar buiten
   gaat hoort daar bij elkaar. */
require('./dienst-fluister')({ app, accounts, supplierAuth, fluister, stuurLus });
// de klok, de pauze en de aanwezigheid: zie de kop hierboven
require('./dienst-klok')(actx);

app.post('/api/staff/mine', supplierAuth, (req, res) => {
  if (!req.actor.staffId) return res.status(403).json({ error: 'Alleen met een persoonlijke login.' });
  res.json({
    klok: klokVan(req.supplier.code, req.actor.staffId),
    verlof: (db.data.verlof[req.supplier.code] || []).filter(v => v.staffId === req.actor.staffId).slice(0, 10),
    pauze: werkbeleidPauzeStand(req.supplier.code, req.actor.staffId),
    trust: trustVan(req.supplier.code, req.actor.staffId)
  });
});

app.post('/api/staff/leave/request', supplierAuth, (req, res) => {
  if (!req.actor.staffId) return res.status(403).json({ error: 'Alleen met een persoonlijke login.' });
  const soort = req.body.soort === 'ziek' ? 'ziek' : 'verlof';
  const van = schoon(req.body.van, 10), tot = schoon(req.body.tot, 10);
  const geldig = d => /^\d{4}-\d{2}-\d{2}$/.test(d);
  if (soort === 'verlof' && (!geldig(van) || !geldig(tot) || tot < van))
    return res.status(400).json({ error: 'Kies een geldige begin- en einddatum.' });

  /* EEN ZIEKMELDING DRAAGT GEEN REDEN. Die stond hier wel: `reden` werd
     gewoon overgenomen en het HR-scherm van de werkgever toonde hem achter de
     naam. Dat is een gezondheidsgegeven van een werknemer in een
     personeelssysteem, zichtbaar voor de leidinggevende -- precies de lijn die
     de Autoriteit Persoonsgegevens trekt, en precies waar
     kern/payroll/verzuim.js voor is gebouwd. Die laag weigerde het al; deze
     route wist er niets van.

     WEIGEREN EN NIET OPSCHONEN. Wie het veld stilzwijgend leegmaakt, laat de
     invoerder denken dat het is aangekomen -- en de volgende keer probeert hij
     het opnieuw, of belt hij het door. De melding hoort te stuiten, met de
     reden erbij. De app stuurt bij een ziekmelding sowieso geen reden mee, dus
     dit breekt niets; het sluit een deur die openstond. */
  if (soort === 'ziek' && schoon(req.body.reden, 140))
    return res.status(422).json({ error: 'Een ziekmelding draagt geen omschrijving. Wat je hebt, hoort bij de arbodienst; hier staat alleen dat je er niet bent en wat je nog kunt.' });
  const lijst = db.data.verlof[req.supplier.code] = db.data.verlof[req.supplier.code] || [];
  const entry = {
    id: crypto.randomBytes(4).toString('hex'),
    staffId: req.actor.staffId, name: req.actor.name, soort,
    van: soort === 'ziek' ? new Date().toISOString().slice(0, 10) : van,
    tot: soort === 'ziek' ? null : tot,
    reden: schoon(req.body.reden, 140),
    status: soort === 'ziek' ? 'gemeld' : 'nieuw',
    at: new Date().toISOString()
  };
  lijst.unshift(entry);
  db.data.verlof[req.supplier.code] = lijst.slice(0, 2000);

  /* Dezelfde melding ook naar de verzuimlaag van Payroll OS. Die kent de
     doorbetalingspercentages per verlofsoort en weet wanneer het UWV eraan te
     pas komt; zonder deze regel wist de loonrun niet dat iemand ziek was en
     betaalde hij honderd procent door.

     EEN SCHRIJFPAD, TWEE GEZICHTEN -- en dat is met opzet geen tweede invoer.
     `db.data.verlof` hierboven is de goedkeuringsstroom van de zaak-app (nieuw
     -> goedgekeurd/afgewezen); de verzuimlaag is wat de payroll ervan moet
     weten. Zou een mens ze allebei moeten invullen, dan lopen ze uiteen en
     klopt de loondoorbetaling niet met het rooster. */
  if (payrollOS && payrollOS.verzuim) {
    const v = payrollOS.verzuim.meld(req.supplier.code, req.actor.staffId, {
      soort: soort === 'ziek' ? 'ziek' : 'vakantie', van: entry.van, tot: entry.tot
    }, req.actor.name);
    // een bezwaar hier is een fout in ONZE vertaling, niet in de invoer van de
    // medewerker; hij hoort zichtbaar te zijn en de melding niet te blokkeren
    if (v && v.error) console.error('[verzuim] melding niet vastgelegd:', v.error, v.bezwaren || '');
  }
  save();
  if (soort === 'ziek') {
    logActivity(req.supplier.code, req.actor, 'meldde zich ziek');
    notifySupplier(req.supplier.code, { icon: 'zorg', title: 'Ziekmelding', body: req.actor.name + ' heeft zich ziek gemeld. Denk aan de bezetting van vandaag.' });
  } else {
    logActivity(req.supplier.code, req.actor, 'vroeg verlof aan (' + entry.van + ' t/m ' + entry.tot + ')');
    notifySupplier(req.supplier.code, { icon: 'parasol', title: 'Verlofaanvraag', body: req.actor.name + ': ' + entry.van + ' t/m ' + entry.tot + (entry.reden ? ' · ' + entry.reden : '') });
  }
  sseToSupplier(req.supplier.code, 'sync', { scope: 'verlof' });
  res.json({ ok: true, entry });
});

/* WAT KAN IK NOG WEL. Dit is de andere helft van een ziekmelding, en hij
   ontbrak: de melding legde vast DAT je er niet bent, en `inzetbaarheid` bleef
   staan op "niets" omdat niemand hem ooit kon veranderen. Daardoor kwam er uit
   de planningslaag nooit iets bruikbaars -- en die laag is juist gebouwd om je
   leidinggevende te laten plannen zonder te weten wat je hebt.

   JIJ ZEGT HET, NIET JE WERKGEVER. Dit is de enige plek waar deze waarde wordt
   gezet, en het is jouw eigen route. Een manager die kan invullen dat jij
   "deels inzetbaar" bent, heeft een oordeel over je gezondheid gegeven; dat
   hoort bij jou en de arbodienst.

   En er is nog steeds GEEN veld voor waarom. Vier standen, meer niet. */
};
