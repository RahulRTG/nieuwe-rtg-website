/* Supplier-submodule "gebouwpand": RTG Enterprise voor het HELE pand.
   Wat een hoogstaand kantoorgebouw verder nog draait naast verhuur en
   receptie: installaties met keuringsbewaking (lift, klimaat, brandmeld),
   de mailroom (post en pakketten per huurder), parkeerplekken en
   BHV-/ontruimingsoefeningen met verbeterpunten.
   Opslag in db.data.gebouwPand[code]; signalen sluiten aan op gebouwplus. */
module.exports = (kern) => {
  const { app, db, save, supplierAuth, managerOnly, logActivity, sseToSupplier, crypto } = kern;

  const rid = () => crypto.randomBytes(4).toString('hex');
  const txt = (v, n) => String(v == null ? '' : v).trim().slice(0, n);
  const DATUM = /^\d{4}-\d{2}-\d{2}$/;
  const MAX = 300;
  const INSTALLATIES = ['lift', 'klimaat', 'brandmeld', 'noodverlichting', 'toegang', 'zonwering'];

  function bak(code) {
    if (!db.data.gebouwPand) db.data.gebouwPand = {};
    if (!db.data.gebouwPand[code]) db.data.gebouwPand[code] = { installaties: [], post: [], parkeer: [], bhv: [] };
    return db.data.gebouwPand[code];
  }
  /* KIJKEN ZONDER SCHEPPEN, en dat onderscheid is hier geen netheid.

     `bak()` zet het pandvak neer voor een zaak die er nog geen had. Op de weg
     die werkelijk iets TOEVOEGT hoort dat ook zo, en op elke andere weg is het
     verkeerd: wie een zending of een installatie opzoekt die niet bestaat
     krijgt een 404, en dan hoort er niets achter te blijven -- anders zeggen de
     statuscode en de database twee verschillende dingen over hetzelfde verzoek.

     Bestaat het vak wel, dan geeft dit de ECHTE lijsten terug en geen kopie: een
     keuringsdatum die je hier vindt en bijwerkt, landt gewoon in de opslag.
     Bestaat het niet, dan krijg je een lege vorm die nergens aan vastzit, en
     loopt elke zoektocht dood op een nette 404. */
  const lees = (code) => (db.data.gebouwPand && db.data.gebouwPand[code])
    || { installaties: [], post: [], parkeer: [], bhv: [] };
  const cap = l => { if (l.length > MAX) l.length = MAX; };
  const vandaag = () => new Date().toISOString().slice(0, 10);
  const overDagen = d => new Date(Date.now() + d * 86400000).toISOString().slice(0, 10);

  /* Signalen over het pand: keuringen die (bijna) verlopen zijn, pakketten
     die al dagen op de mailroom liggen en een BHV-oefening die te lang
     geleden is (of er nooit was). */
  function signalen(b) {
    const s = [];
    for (const i of b.installaties) {
      if (!i.keuringTot) continue;
      if (i.keuringTot < vandaag()) s.push({ soort: 'keuring', tekst: 'De keuring van ' + i.naam + ' is verlopen (' + i.keuringTot + '); plan de herkeuring vandaag.' });
      else if (i.keuringTot <= overDagen(30)) s.push({ soort: 'keuring', tekst: 'De keuring van ' + i.naam + ' verloopt op ' + i.keuringTot + '.' });
    }
    const oud = b.post.filter(p => p.status === 'aangekomen' && p.dag < overDagen(-3)).length;
    if (oud) s.push({ soort: 'post', tekst: oud + ' pakket(ten) liggen langer dan drie dagen op de mailroom; herinner de huurders.' });
    const laatste = b.bhv.length ? b.bhv[0].dag : null;
    if (!laatste || laatste < overDagen(-365)) s.push({ soort: 'bhv', tekst: 'De laatste ontruimingsoefening is meer dan een jaar geleden; plan er een.' });
    return s.slice(0, 12);
  }

  app.post('/api/supplier/gebouwpand/overzicht', supplierAuth, (req, res) => {
    if (!managerOnly(req, res)) return;
    const b = bak(req.supplier.code);
    res.json({ ok: true, installaties: b.installaties.slice(0, 40), post: b.post.slice(0, 80),
      parkeer: b.parkeer.slice(0, 80), bhv: b.bhv.slice(0, 20), signalen: signalen(b), soorten: INSTALLATIES });
  });

  /* ---- installaties: het pand keurt zichzelf niet ---- */
  app.post('/api/supplier/gebouwpand/installatie', supplierAuth, (req, res) => {
    if (!managerOnly(req, res)) return;
    const soort = INSTALLATIES.includes(req.body.soort) ? req.body.soort : null;
    const naam = txt(req.body.naam, 60);
    if (!soort || !naam) return res.status(400).json({ error: 'Kies een soort en geef de installatie een naam.' });
    if (!DATUM.test(req.body.keuringTot)) return res.status(400).json({ error: 'Tot wanneer is de keuring geldig (jjjj-mm-dd)?' });
    const i = { id: rid(), soort, naam, keuringTot: req.body.keuringTot, notitie: txt(req.body.notitie, 120) };
    const b = bak(req.supplier.code);
    b.installaties.unshift(i); cap(b.installaties); save();
    sseToSupplier(req.supplier.code, 'sync', { scope: 'gebouw' });
    res.json({ ok: true, installatie: i });
  });

  app.post('/api/supplier/gebouwpand/installatie/keuring', supplierAuth, (req, res) => {
    if (!managerOnly(req, res)) return;
    const i = lees(req.supplier.code).installaties.find(x => x.id === req.body.id);
    if (!i) return res.status(404).json({ error: 'Installatie niet gevonden.' });
    if (!DATUM.test(req.body.keuringTot) || req.body.keuringTot <= i.keuringTot)
      return res.status(400).json({ error: 'Kies een nieuwe keuringsdatum na de huidige.' });
    i.keuringTot = req.body.keuringTot; save();
    logActivity(req.supplier.code, req.actor, 'werkte de keuring van ' + i.naam + ' bij tot ' + i.keuringTot);
    sseToSupplier(req.supplier.code, 'sync', { scope: 'gebouw' });
    res.json({ ok: true, installatie: i });
  });

  /* ---- de mailroom: aannemen, melden, ophalen ---- */
  app.post('/api/supplier/gebouwpand/post', supplierAuth, (req, res) => {
    const voorWie = txt(req.body.voorWie, 60), omschrijving = txt(req.body.omschrijving, 80);
    if (!voorWie) return res.status(400).json({ error: 'Voor welke huurder is dit?' });
    const p = { id: rid(), voorWie, omschrijving: omschrijving || 'pakket', dag: vandaag(), status: 'aangekomen' };
    const b = bak(req.supplier.code);
    b.post.unshift(p); cap(b.post); save();
    sseToSupplier(req.supplier.code, 'sync', { scope: 'gebouw' });
    res.json({ ok: true, post: p });
  });

  app.post('/api/supplier/gebouwpand/post/opgehaald', supplierAuth, (req, res) => {
    const p = lees(req.supplier.code).post.find(x => x.id === req.body.id);
    if (!p) return res.status(404).json({ error: 'Zending niet gevonden.' });
    p.status = 'opgehaald'; save();
    sseToSupplier(req.supplier.code, 'sync', { scope: 'gebouw' });
    res.json({ ok: true, post: p });
  });

  /* ---- parkeren: vaste plekken per huurder ---- */
  app.post('/api/supplier/gebouwpand/parkeer', supplierAuth, (req, res) => {
    if (!managerOnly(req, res)) return;
    const plek = txt(req.body.plek, 12), huurder = txt(req.body.huurder, 60);
    if (!plek) return res.status(400).json({ error: 'Welke plek (bijv. P1-04)?' });
    const b = bak(req.supplier.code);
    const bestaand = b.parkeer.find(x => x.plek === plek);
    if (bestaand) { bestaand.huurder = huurder; }
    else b.parkeer.unshift({ id: rid(), plek, huurder });
    cap(b.parkeer); save();
    sseToSupplier(req.supplier.code, 'sync', { scope: 'gebouw' });
    res.json({ ok: true, parkeer: b.parkeer.slice(0, 80) });
  });

  /* ---- BHV en ontruiming: oefenen, opkomst en verbeterpunten ---- */
  app.post('/api/supplier/gebouwpand/bhv', supplierAuth, (req, res) => {
    if (!managerOnly(req, res)) return;
    const b = bak(req.supplier.code);
    const dag = DATUM.test(req.body.dag) ? req.body.dag : vandaag();
    const opkomst = Math.max(0, Math.min(100, Math.round(Number(req.body.opkomst)) || 0));
    const o = { id: rid(), dag, opkomst, verbeterpunten: txt(req.body.verbeterpunten, 300) };
    b.bhv.unshift(o); b.bhv.sort((a, x) => x.dag.localeCompare(a.dag)); cap(b.bhv); save();
    logActivity(req.supplier.code, req.actor, 'legde de ontruimingsoefening van ' + dag + ' vast');
    sseToSupplier(req.supplier.code, 'sync', { scope: 'gebouw' });
    res.json({ ok: true, oefening: o });
  });
};
