/* Kantoren, deel "geld/terugval": de zaken die nog op de gedocumenteerde
   terugval draaien, met per zaak een VOORSTEL en een knop om het te bevestigen.

   DIT BESTAND IS DE ENIGE PLEK DIE DE ZAAKVORM KENT, en dat is met opzet.
   kern/commercie/voorstel.js krijgt een telling per capability binnen en weet
   niet waar kassa-artikelen of personeelsrijen wonen; hier staat die vertaling.

   EN HIER STAAT OOK WAT WE NIET KUNNEN ZIEN. `GEMETEN` is de lijst capabilities
   waar deze adapter werkelijk naar kijkt. Wat er niet in staat, telt in de
   voorstellaag als NODIG -- want een nul uit "niet gemeten" ziet er precies zo
   uit als een nul uit "niet gebruikt", en op die eerste een onderdeel intrekken
   is geen voorstel maar een gok. Het gevolg is zichtbaar en niet stil: zolang
   deze lijst kort is, valt er zelden een lagere trede voor te stellen, en dat
   staat dan in `ongemeten` bij het voorstel.

   Groeit de lijst -- omdat er een teller bij komt voor governance of Werk OS --
   dan worden de voorstellen vanzelf scherper. Dat is de juiste volgorde: eerst
   meten, dan voorstellen. */
module.exports = (ctx) => {
  const { app, officeAuth, boardroomAuth, veilig, afdelingen, kern, db } = ctx;
  /* De personeelskast staat niet in ctx maar wel in de kern; laat gebonden, want
     deze module draait pas bij een verzoek. Is hij er niet, dan is `personeel`
     niet nul maar ONGEMETEN -- zie `gemetenNu()` hieronder, en de kop over
     waarom dat verschil hier alles uitmaakt. */
  const accountsVan = () => (kern && kern.accounts) || null;
  const { maakVoorstellen } = require('../../../kern/commercie/voorstel');

  /* Waar deze adapter WERKELIJK naar kijkt. Twee dingen, en allebei staan ze op
     de zaak zelf of in de personeelskast; de rest van de capabilities heeft geen
     teller die hier te lezen is. */
  const GEMETEN = ['can_use_pos', 'can_manage_staff'];

  /* Wat er VANDAAG werkelijk te meten valt. Ontbreekt de personeelskast, dan
     valt `can_manage_staff` uit de lijst -- en niet stil op nul. Dat is het hele
     punt van deze adapter: een teller die er niet is, mag geen bewijs worden. */
  function gemetenNu() {
    const a = accountsVan();
    return GEMETEN.filter(c => c !== 'can_manage_staff' || (a && typeof a.countStaff === 'function'));
  }

  function gebruikVan(s) {
    const kassa = (s && s.kassa && Array.isArray(s.kassa.artikelen)) ? s.kassa.artikelen.length : 0;
    const a = accountsVan();
    let personeel = 0;
    try { personeel = (a && a.countStaff) ? Number(a.countStaff(s.code)) || 0 : 0; } catch (e) { personeel = 0; }
    return { can_use_pos: kassa, can_manage_staff: personeel };
  }

  const laag = () => maakVoorstellen({ zaakAbonnement: kern.zaakAbonnement });

  app.post('/api/office/terugval', officeAuth, (req, res) => veilig(res, () => {
    if (!kern || !kern.zaakAbonnement) return { status: 503, error: 'De abonnementslaag is niet gemount.' };
    const zaken = (db && db.data && db.data.suppliers || [])
      .map(s => ({ code: s.code, gebruik: gebruikVan(s), gemeten: gemetenNu() }));
    return { status: 200, ok: true, gemeten: gemetenNu(), ...laag().lijst(zaken) };
  }));

  /* BEVESTIGEN. De enige weg waarlangs een zaak van de terugval af komt, en hij
     vraagt een naam die in het journaal komt. De laag zelf weigert een
     bevestiging voor een andere trede dan de voorgestelde. */
  app.post('/api/office/terugval/bevestig', boardroomAuth, (req, res) => veilig(res, () => {
    if (!kern || !kern.zaakAbonnement) return { status: 503, error: 'De abonnementslaag is niet gemount.' };
    const b = req.body || {};
    const wie = String(b.naam || '').slice(0, 60);
    const s = (db && db.data && db.data.suppliers || []).find(x => x.code === String(b.code || '').toUpperCase());
    if (!s) return { status: 404, error: 'Deze zaak bestaat niet.' };

    const r = laag().bevestig(s.code, b.pas, wie, gebruikVan(s), gemetenNu());
    if (r.ok) afdelingen.audit(wie, 'Zaak ' + s.code + ' van de terugval naar ' + b.pas);
    return r;
  }));
};
