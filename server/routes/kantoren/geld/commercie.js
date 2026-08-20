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
