/* Kantoren, deel "geld/commercie": de knoppen van de commerciele kern -- de
   ronde, het abonnement van de zaken, de handhavingsregels met hun schaduwstand,
   en wat er nog openstaat.

   AFGESPLITST VAN ../geld.js toen die over de omvangregel ging, en de naad is
   echt: ../geld.js gaat over WAT IETS KOST (pasprijzen, tarieven, korting,
   claims) en dit bestand over WAT ER MET DE AFSPRAKEN GEBEURT. De eerste kant
   verandert als het product verandert, deze als de administratie verandert.

   DE HANDHAVINGSREGELS ZIJN HIER HET INTERESSANTST. Dit is de plek waar een mens
   de vraag beantwoordt die kern/commercie/schaduw.js openlaat: kan die regel aan?
   Het tegenfeit rekent voor wat aanzetten doet, en zegt het NIET als er te weinig
   is meegelopen -- een precies ogend getal uit een lege week is hier de duurste
   verleiding.

   Gemount vanuit ../geld.js, met dezelfde context. */
const tegenfeit = require('../../../kern/commercie/tegenfeit');

module.exports = (ctx) => {
  const { app, officeAuth, boardroomAuth, veilig, afdelingen, kern, db } = ctx;

  /* DE COMMERCIELE RONDE. Draait vanzelf (kern/opzet/kernlaag3.js), maar is ook
     met de hand te trekken -- dat is het verschil tussen "hij hoort te draaien"
     en "ik zie hem draaien". De uitslag zegt per stap wat er gebeurde EN wat er
     nog openstaat; dat laatste getal bestond niet toen deze verplichtingen nog
     door niemand werden opgepakt. */
  app.post('/api/office/commercie/ronde', officeAuth, async (req, res) => {
    try {
      if (!kern || !kern.commercieRonde) return res.status(503).json({ error: 'De ronde is niet gemount.' });
      res.json({ ok: true, uitslag: await kern.commercieRonde.draai() });
    } catch (e) { console.error('[commercie-ronde]', e); res.status(500).json({ error: 'De ronde liep vast.' }); }
  });
  /* HET ABONNEMENT VAN DE ZAKEN. Het getal dat ertoe doet staat vooraan: hoeveel
     zaken draaien op de gedocumenteerde terugval omdat ze van voor de ladder
     zijn? Een terugval die je niet kunt tellen, is een gat dat er over een jaar
     nog is en dat niemand meer ziet. */
  app.post('/api/office/commercie/zaakabonnementen', officeAuth, (req, res) => veilig(res, () => {
    if (!kern || !kern.zaakAbonnement) return { status: 503, error: 'Niet gemount.' };
    const codes = (db && db.data && db.data.suppliers || []).map(s => s.code);
    return { status: 200, ok: true,
      vastgelegd: kern.zaakAbonnement.lijst(),
      opTerugval: kern.zaakAbonnement.zonderAbonnement(codes) };
  }));
  app.post('/api/office/commercie/zaakabonnement/zet', boardroomAuth, (req, res) => veilig(res, () => {
    if (!kern || !kern.zaakAbonnement) return { status: 503, error: 'Niet gemount.' };
    const b = req.body || {};
    const r = kern.zaakAbonnement.zet(b.code, b.pas, b.naam || 'boardroom');
    if (r.ok) afdelingen.audit(b.naam || 'boardroom', 'Zaakabonnement ' + r.code + ' gezet op ' + r.pas);
    return r;
  }));

  /* DE HANDHAVINGSREGELS EN HUN SCHADUWSTAND. Dit is de plek waar een mens de
     vraag beantwoordt die kern/commercie/schaduw.js openlaat: kan die regel aan?
     Het tegenfeit (kern/commercie/tegenfeit.js) rekent voor wat aanzetten doet,
     en zegt het NIET als er te weinig is meegelopen -- een precies ogend getal
     uit een lege week is hier de duurste verleiding. */
  /* DE VOORNEMENS. Het getal dat ertoe doet staat vooraan: wat is er HALVERWEGE
     blijven steken? Een voornemen op BEZIG is een economische handeling die
     niemand heeft afgemaakt -- drie van de vijf hotels geboekt -- en dat is
     precies het geval waarvoor deze laag bestaat. Zichtbaar houden, niet
     wegstoppen. */
  app.post('/api/office/voornemens', officeAuth, (req, res) => veilig(res, () => {
    if (!kern || !kern.voornemens) return { status: 503, error: 'De voornemenslaag is niet gemount.' };
    const b = req.body || {};
    return { status: 200, ok: true,
      halverwege: kern.voornemens.halverwege(),
      ...kern.voornemens.lijst({ stand: b.stand, limit: b.limit }) };
  }));
  /* Aftekenen is een MENSENHANDELING en staat daarom achter de boardroom-poort,
     met een naam die in het journaal komt. De laag zelf weigert een handtekening
     van dezelfde persoon die het voornemen opstelde; hier komt daar de vraag
     bij WIE er tekent. */
  app.post('/api/office/voornemen/teken', boardroomAuth, (req, res) => veilig(res, () => {
    if (!kern || !kern.voornemens) return { status: 503, error: 'De voornemenslaag is niet gemount.' };
    const b = req.body || {};
    const wie = String(b.naam || '').slice(0, 60);
    if (!wie) return { status: 400, error: 'Een tweede handtekening hoort een naam te dragen.' };
    const r = kern.voornemens.tekenAf(b.id, { door: wie });
    if (r.ok) afdelingen.audit(wie, 'Voornemen ' + b.id + ' afgetekend (' +
      ((r.voornemen && r.voornemen.totaalCenten) / 100).toFixed(2) + ' euro)');
    return r;
  }));
  app.post('/api/office/voornemen/staak', boardroomAuth, (req, res) => veilig(res, () => {
    if (!kern || !kern.voornemens) return { status: 503, error: 'De voornemenslaag is niet gemount.' };
    const b = req.body || {};
    const wie = String(b.naam || 'boardroom').slice(0, 60);
    const r = kern.voornemens.staak(b.id, b.reden || 'gestaakt vanuit de boardroom', wie);
    if (r.ok) afdelingen.audit(wie, 'Voornemen ' + b.id + ' gestaakt');
    return r;
  }));

  /* HET RECHTENBORD VAN EEN ZAAK. Drie kolommen naast elkaar: wat het
     productprofiel zegt, wat er vandaag werkelijk gebeurt, en of er iets is dat
     het bewaakt. `afwijkend` staat vooraan -- dat is het gat tussen de belofte
     en de handhaving, en daar begon dit hele traject mee. */
  app.post('/api/office/rechten', officeAuth, (req, res) => veilig(res, () => {
    if (!kern || !kern.commercieRechten) return { status: 503, error: 'Het rechtenbord is niet gemount.' };
    const b = req.body || {};
    if (b.code) return { status: 200, ok: true, bord: kern.commercieRechten.voorZaak(b.code) };
    if (b.pas) return { status: 200, ok: true, bord: kern.commercieRechten.voorLid(b.pas) };
    /* Zonder code of pas: het overzicht over alle zaken. Een scheur die over
       ALLE zaken loopt is geen zaakprobleem maar een regel die nog niet
       afdwingt, en dat staat er dan ook apart bij. */
    const codes = (db && db.data && db.data.suppliers || []).map(s => s.code);
    return { status: 200, ok: true, scheuren: kern.commercieRechten.scheuren(codes), zaken: codes.length };
  }));

  /* Hoe het met elk ONDERDEEL gaat, en de knoppen om er een dicht te zetten.
     Een eigen bestand: zie ./gezondheid.js. */
  require('./capgezondheid')(ctx);

  app.post('/api/office/handhaving', officeAuth, (req, res) => veilig(res, () => {
    if (!kern || !kern.handhavingSchaduw) return { status: 503, error: 'De schaduwlaag is niet gemount.' };
    const regels = kern.handhavingSchaduw.lijst().map(r => ({ ...r, tegenfeit: tegenfeit.vanSchaduw(r) }));
    return { status: 200, ok: true, regels,
      /* De twee getallen die zichtbaar horen te blijven: een vrijstelling die je
         niet kunt tellen is over een jaar de regel, en een regel die al maanden
         meeloopt is een besluit dat niemand neemt. */
      vrijgesteld: kern.handhavingSchaduw.vrijgesteld(),
      blijftInSchaduw: kern.handhavingSchaduw.blijftInSchaduw(30) };
  }));
  app.post('/api/office/handhaving/zet', boardroomAuth, (req, res) => veilig(res, () => {
    if (!kern || !kern.handhavingSchaduw) return { status: 503, error: 'De schaduwlaag is niet gemount.' };
    const b = req.body || {};
    const wie = b.naam || 'boardroom';
    const r = kern.handhavingSchaduw.zetModus(b.id, b.modus, wie);
    if (r.ok) afdelingen.audit(wie, 'Handhavingsregel ' + b.id + ' op ' + String(b.modus).toUpperCase());
    return r;
  }));

  app.post('/api/office/commercie/openstaand', officeAuth, (req, res) => veilig(res, () =>
    (kern && kern.commercieVerrekening
      ? { status: 200, ok: true, ...kern.commercieVerrekening.openstaand() }
      : { status: 503, error: 'De verrekening is niet gemount.' })));
};
