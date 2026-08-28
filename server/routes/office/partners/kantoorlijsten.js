/* Backoffice (deelmodule van ./partners.js): de schoolbesluiten, het
   vertrouwenskanaal met het personeel, de ondernemersregie en de
   rechtsvormwacht.

   AFGESPLITST TOEN ../partners.js OVER DE OMVANGREGEL GING. De naad is echt en
   niet alleen een byte-knip: ../partners.js gaat over EEN besluit -- laat RTG
   deze zaak toe als partner, en op welke trede -- terwijl alles hier
   losstaande kantoorlijsten zijn die toevallig dezelfde poort delen.

   Gemount vanuit ../partners.js, met dezelfde octx. */
const { datum: klokDatum } = require('../../../lib/klok');

module.exports = (octx) => {
  const { kern } = octx;
  const { app, db, officeAuth, save, schoon, sseToOffice, sseToSupplier } = kern;

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

  /* De ondernemersregie staat sinds deze ronde in ../ondernemers.js -- zie de
     kop daar. Hij stond hier ook, en dan wint de eerste registratie en draait
     de tweede nooit meer (check-regel 31). */

  /* De rechtsvormwacht staat sinds deze ronde in ../ondernemers.js -- zie de
     kop daar. Hij stond hier ook, en dan wint de eerste registratie. */

};
