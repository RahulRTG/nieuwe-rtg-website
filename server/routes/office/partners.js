/* Backoffice (deelmodule): partner- en schoolbesluiten en het vertrouwenskanaal met het personeel.
   Draait op de gedeelde kern; gemount vanuit routes/office.js. */
const { datum: klokDatum } = require('../../lib/klok');

module.exports = (octx) => {
  const { kern, officeQueryMag } = octx;
  const { app, boardroomAuth, boardroomWie, db, findSupplier,
          forgetSession, logActivity, officeAuth, save, sessions, schoon,
          sseClients, sseSend, sseToOffice, sseToSupplier,
          ondernemingRegie, ondernemingProvisioningZet, ondernemingBijdrageZet, rechtsvormwacht } = kern;
/* Een partnerschap openen en sluiten is boardroomwerk: het maakt of verbreekt
   toegang tot een volledige bedrijfswerkplek. Een schorsing trekt daarom niet
   alleen nieuwe logins dicht, maar wist ook alle bestaande sessies en sluit
   open liveverbindingen. De centrale supplierAuth controleert de status bij
   ieder verzoek als tweede slot voor processen met oud sessiegeheugen. */
app.post('/api/office/partner/status', boardroomAuth, (req, res) => {
  const code = String((req.body || {}).code || '').trim().toUpperCase();
  const status = String((req.body || {}).status || '').trim().toLowerCase();
  const reden = schoon((req.body || {}).reden, 240);
  if (!['actief', 'geschorst', 'beeindigd'].includes(status))
    return res.status(400).json({ error: 'Kies actief, geschorst of beeindigd.' });
  const s = findSupplier(code);
  if (!s) return res.status(404).json({ error: 'Partner niet gevonden.' });
  if (status !== 'actief' && !reden)
    return res.status(400).json({ error: 'Leg vast waarom deze partnerwerkplek wordt gesloten.' });

  const vorige = s.partnerStatus || 'actief';
  s.partnerStatus = status;
  s.partnerStatusAt = klokDatum().toISOString();
  s.partnerStatusDoor = boardroomWie(req);
  s.partnerStatusReden = reden || null;
  if (status !== 'actief') s.online = false;

  let ingetrokken = 0;
  if (status !== 'actief') {
    const hashes = [];
    for (const [hash, sess] of sessions)
      if (sess && sess.role === 'supplier' && String(sess.code || '').toUpperCase() === code) hashes.push(hash);
    for (const hash of hashes) { forgetSession(hash); ingetrokken += 1; }
    for (let i = sseClients.length - 1; i >= 0; i--) {
      const client = sseClients[i];
      if (!client || String(client.sup || '').toUpperCase() !== code) continue;
      try { sseSend(client.res, 'toegang-ingetrokken', { status }); } catch (e) {}
      try { client.res.end(); } catch (e) {}
      sseClients.splice(i, 1);
    }
  }
  save();
  logActivity(code, { name: 'Boardroom' }, status === 'actief'
    ? 'hief de partnerschorsing op'
    : 'zette de partnerwerkplek op ' + status + ': ' + reden);
  sseToSupplier(code, 'partner-status', { status, at: s.partnerStatusAt });
  sseToOffice('sync', { scope: 'partners', code, status });
  res.json({ ok: true, code, vorige, status, ingetrokken, sessiesIngetrokken: ingetrokken });
});

/* ---------- RTF School: RTG keurt schoolaanmeldingen goed ----------
   Een school meldt zich aan via de RTFoundation-app en staat dan op 'wacht'.
   Pas als RTG hem hier goedkeurt (status 'actief') kan de school personeel
   toelaten en klassen maken. Dezelfde beoordeling als bij partner-aanvragen. */
function scholen() {
  const f = db.data.foundation || (db.data.foundation = {});
  if (!f.scholen) f.scholen = {};
  return f.scholen;
}
app.post('/api/office/schools', officeAuth, (req, res) => {
  const lijst = Object.values(scholen()).map(s => ({
    code: s.code, naam: s.naam, plaats: s.plaats, status: s.status || 'actief', at: s.at,
    personeel: Object.keys(s.personeel || {}).length
  })).sort((a, b) => String(b.at || '').localeCompare(String(a.at || '')));
  res.json({ schools: lijst });
});
app.post('/api/office/school/decide', officeAuth, (req, res) => {
  const s = scholen()[String(req.body.code || '').trim().toUpperCase()];
  if (!s) return res.status(404).json({ error: 'School niet gevonden.' });
  if ((s.status || 'actief') !== 'wacht') return res.status(409).json({ error: 'Deze school is al beoordeeld.' });
  if (req.body.action === 'goedkeuren') {
    s.status = 'actief'; s.goedgekeurdAt = klokDatum().toISOString();
  } else {
    s.status = 'afgewezen'; s.afgewezenAt = klokDatum().toISOString();
  }
  save();
  sseToOffice('sync', { scope: 'schools' });
  res.json({ ok: true, status: s.status });
});

app.post('/api/office/trust', officeAuth, (req, res) => {
  res.json({ threads: db.data.trustLine.slice(0, 40).map(t => ({
    id: t.id, company: t.company, anon: t.anon,
    name: t.anon ? 'Anoniem' : t.name,
    open: t.open, lastAt: t.lastAt,
    messages: t.messages.slice(-30)
  })) });
});

app.post('/api/office/trust/reply', officeAuth, (req, res) => {
  const t = db.data.trustLine.find(x => x.id === req.body.id);
  if (!t) return res.status(404).json({ error: 'Gesprek niet gevonden.' });
  const text = schoon(req.body.text, 800);
  if (!text) return res.status(400).json({ error: 'Leeg bericht.' });
  t.messages.push({ from: 'rtg', text, at: klokDatum().toISOString() });
  t.messages = t.messages.slice(-60);
  t.open = false;
  t.lastAt = klokDatum().toISOString();
  save();
  // alleen een seintje om te verversen; de inhoud gaat uitsluitend via de persoonlijke login
  sseToSupplier(t.code, 'sync', { scope: 'trust' });
  res.json({ ok: true });
});

  /* ---- de ondernemersregie: twee knoppen van de boardroom ----
     Achter de kantoorpoort, en elke wijziging komt met een naam in het
     journaal. Zie kern/onderneming/regie.js voor waarom soepeler zetten een
     naam vraagt en strenger zetten niet. */
  app.post('/api/office/ondernemersregie', officeAuth, (req, res) => {
    res.json({ ok: true, regie: ondernemingRegie() });
  });

  app.post('/api/office/ondernemersregie/provisioning', officeAuth, (req, res) => {
    const r = ondernemingProvisioningZet(String((req.body || {}).stand || ''), boardroomWie(req));
    res.status(r.status || 200).json(r);
  });

  app.post('/api/office/ondernemersregie/bijdrage', officeAuth, (req, res) => {
    const r = ondernemingBijdrageZet(req.body || {}, boardroomWie(req));
    res.status(r.status || 200).json(r);
  });

  /* ---- de rechtsvormwacht ----
     De stand van het rechtsvormenregister en een handmatige controle. Zetten
     kan ook met de hand, maar langs dezelfde gevalideerde weg als een bron:
     een tweede, soepelere ingang zou de grendels omzeilen die er juist voor de
     bron staan. Zie kern/onderneming/rechtsvormwacht.js. */
  app.post('/api/office/rechtsvormwacht', officeAuth, (req, res) => {
    res.json({ ok: true, wacht: rechtsvormwacht.status() });
  });

  app.post('/api/office/rechtsvormwacht/check', officeAuth, async (req, res) => {
    const r = await rechtsvormwacht.check();
    res.json(Object.assign({ ok: true }, r, { wacht: rechtsvormwacht.status() }));
  });

  app.post('/api/office/rechtsvormwacht/zet', officeAuth, (req, res) => {
    const r = rechtsvormwacht.pasToe(req.body || {}, 'kantoor: ' + boardroomWie(req));
    res.json(Object.assign({}, r, { wacht: rechtsvormwacht.status() }));
  });
};
