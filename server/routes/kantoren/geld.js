/* Kantoren, deel "geld": de geld-regie van RTG (pasprijzen, partnervergoeding,
   betaaldienst-tarief, ledenvoordeel) en de eigen-AI-dataset. Alles achter de
   boardroom-poort, behalve de publieke pasprijzen -- wat de boardroom zet, is
   meteen overal het geldende bedrag. Afgesplitst uit ./regie zodat elk deel
   onder de 10 KB blijft; de bedrading komt via dezelfde context binnen. */
const allocatie = require('../../kern/commercie/allocatie');

module.exports = (ctx) => {
  const { app, officeAuth, boardroomAuth, veilig, stuur, afdelingen, kern,
    geldOverzicht, geldPasprijzen, geldPasprijsZet, geldCommissieZet, geldKortingZet } = ctx;

  /* De geld-regie: RTG bepaalt de pasprijzen, de partnervergoeding (per genre
     of per zaak) en het ledenvoordeel per genre. De pasprijzen zijn publiek:
     wat hier gezet wordt is meteen overal het geldende bedrag. */
  app.post('/api/pasprijzen', (req, res) => stuur(res, geldPasprijzen()));
  app.get('/api/pasprijzen', (req, res) => stuur(res, geldPasprijzen()));

  /* Het betaaldiensttarief is PUBLIEK, om dezelfde reden als de pasprijzen: het
     staat in de partnervoorwaarden, en een bedrag dat in een juridisch document
     staat mag niet los kunnen lopen van het bedrag dat de code rekent. Dat was
     precies hoe "0% commissie" naast een commissieknop kon blijven bestaan.
     Alleen lezen; zetten blijft achter de boardroom-poort. */
  const tarief = () => {
    const t = kern.geldBetaaldienst ? kern.geldBetaaldienst() : { vastCenten: 10, pct: 1 };
    return { status: 200, betaaldienst: { ...t,
      grondslag: 'per transactie, direct verrekend op de partnerrekening',
      overOmzet: false } };
  };
  app.get('/api/betaaldiensttarief', (req, res) => stuur(res, tarief()));
  app.post('/api/betaaldiensttarief', (req, res) => stuur(res, tarief()));

  /* DE SOCIALE VERANTWOORDING. Wat is gereserveerd, wat kan weg, wat is er uit
     -- per deel en per regelversie. Achter de kantoorpoort: het gaat over
     bedragen per bron, en die staan op codenaam maar horen niet publiek.

     De REGELS zelf (30%, 20 lokaal, 10 foundation, met per deel waaróm) zijn
     wel publiek: die staan in de voorwaarden en horen daar live vandaan te
     komen in plaats van als los getal in een document (COMMERCIE.md par. 9). */
  app.post('/api/office/sociaal', officeAuth, (req, res) => veilig(res, () =>
    (ctx.fonds && ctx.fonds.socialeStand ? ctx.fonds.socialeStand(req.body || {})
      : { status: 503, error: 'Het fonds is niet gemount.' })));
  const socialeRegels = () => ({ status: 200, huidig: allocatie.HUIDIGE_VERSIE,
    regels: Object.values(allocatie.REGELS).map(r => ({ versie: r.versie, vanaf: r.vanaf,
      totaalDeel: r.totaalDeel, exBtw: r.exBtw,
      delen: r.delen.map(d => ({ id: d.id, deel: d.deel, label: d.label, waarom: d.waarom })) })) });
  app.get('/api/sociaalbeleid', (req, res) => stuur(res, socialeRegels()));
  app.post('/api/sociaalbeleid', (req, res) => stuur(res, socialeRegels()));
  app.post('/api/office/geld', boardroomAuth, (req, res) => veilig(res, () => geldOverzicht()));
  app.post('/api/office/geld/pasprijs', boardroomAuth, (req, res) => veilig(res, () => {
    const r = geldPasprijsZet(req.body || {});
    if (r.ok) afdelingen.audit(req.body.naam || 'boardroom', 'Pasprijs ' + r.pas + ' gezet op € ' + (r.maandCenten / 100).toFixed(2) + ' per maand (ex btw)');
    return r;
  }));
  /* De commissie-knop is weg (20 augustus 2026): de partnervergoeding over omzet
     is nul en dat is een eigenschap van het product, geen instelling. Het
     endpoint blijft bestaan en weigert met uitleg -- een verdwenen endpoint
     geeft 404 en dat leest als een storing, terwijl dit een besluit is. Er valt
     dus ook niets meer te auditen: een geweigerde zet verandert niets. */
  app.post('/api/office/geld/commissie', boardroomAuth, (req, res) => veilig(res, () => geldCommissieZet(req.body || {})));
  // de betaaldienst: het tarief dat per kassabetaling DIRECT met de zaak wordt verrekend
  app.post('/api/office/geld/betaaldienst', boardroomAuth, (req, res) => veilig(res, () =>
    (req.body && (req.body.vastCenten != null || req.body.pct != null))
      ? kern.geldBetaaldienstZet(req.body) : { status: 200, ok: true, ...kern.geldBetaaldienst() }));
  app.post('/api/office/geld/korting', boardroomAuth, (req, res) => veilig(res, () => {
    const r = geldKortingZet(req.body || {});
    if (r.ok) afdelingen.audit(req.body.naam || 'boardroom', 'Ledenvoordeel ' + r.genre + ' gezet op ' + r.pct + '%');
    return r;
  }));

  /* De eigen-AI-dataset: het bord (hoeveel records per bron) en de knop die
     alles als JSONL-bestand bewaart. Op codenamen; de kluis blijft dicht.
     Elke export komt in het auditlog. */
  app.post('/api/office/aidata', officeAuth, (req, res) => veilig(res, () => kern.aidataOverzicht()));
  app.post('/api/office/aidata/export', boardroomAuth, (req, res) => {
    try {
      const r = kern.aidataExport();
      afdelingen.audit(req.body.naam || 'boardroom', 'AI-dataset geexporteerd: ' + r.aantal + ' records (JSONL)');
      res.setHeader('Content-Type', 'application/jsonl; charset=utf-8');
      res.setHeader('Content-Disposition', 'attachment; filename="rtg-ai-dataset-' + new Date().toISOString().slice(0, 10) + '.jsonl"');
      res.send(r.jsonl);
    } catch (e) { console.error('[aidata]', e); res.status(500).json({ error: 'Er ging iets mis. Probeer het opnieuw.' }); }
  });
};
