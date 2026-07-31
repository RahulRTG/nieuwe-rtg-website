/* Member-voertuigen (deelmodule): de Salon-ontmoetingen: aan/uit, plek, keuze, date en SOS.
   Krijgt de gedeelde context een keer bij het opstarten vanuit
   routes/member/voertuigen.js. */
const { coord } = require('../../../kern/util');
module.exports = (vctx) => {
  const { app, auth, crypto, db, eisAccount,
    express, findSupplier, geborenVan, leeftijdVan, liveCodename,
    notifySupplier, save, schoon, sseToOffice, sseToSupplier,
    salonZichtbaar, ontmoetZet, ontmoetPos, ontmoetKies, ontmoetTeken,
    ontmoetHier, ontmoetStop, ontmoetSos, ontmoetSignaalKantoor, ontmoetMijnState,
    avShowroom, avAanbevolen, avProefrit, avKoop, avInruil,
    avTeken, avMijnDeals, zorgVoor, zorgContact, media,
    boekingMetRef, boekingenVanZaak, boekingenVoegToe, openLijn } = vctx;
function ontmoetKey(req, res) { if (!eisAccount(req, res)) return null; return req.session.key; }

app.post('/api/ontmoeten/state', auth, (req, res) => {
  const key = ontmoetKey(req, res); if (!key) return;
  res.json(ontmoetMijnState(key));
});
app.post('/api/ontmoeten/aan', auth, (req, res) => {
  const key = ontmoetKey(req, res); if (!key) return;
  const r = ontmoetZet(key, req.body.aan === true);
  if (r.error) return res.status(r.status).json({ error: r.error });
  res.json({ ok: true, aan: r.aan, state: ontmoetMijnState(key) });
});
app.post('/api/ontmoeten/hier', auth, (req, res) => {
  const key = ontmoetKey(req, res); if (!key) return;
  const r = ontmoetPos(key, coord(req.body.lat, 90), coord(req.body.lng, 180));
  if (r.error) return res.status(r.status).json({ error: r.error });
  res.json({ ok: true, nieuwe: r.nieuwe, state: ontmoetMijnState(key) });
});
app.post('/api/ontmoeten/kies', auth, (req, res) => {
  const key = ontmoetKey(req, res); if (!key) return;
  const r = ontmoetKies(key, String(req.body.voorstelId || ''), String(req.body.keuze || ''));
  if (r.error) return res.status(r.status).json({ error: r.error });
  res.json({ ok: true, status: r.status2, activiteit: r.activiteit || null, dateId: r.dateId || null, state: ontmoetMijnState(key) });
});
app.post('/api/ontmoeten/teken', auth, (req, res) => {
  const key = ontmoetKey(req, res); if (!key) return;
  const r = ontmoetTeken(key, String(req.body.dateId || ''));
  if (r.error) return res.status(r.status).json({ error: r.error });
  res.json({ ok: true, status: r.status2, state: ontmoetMijnState(key) });
});
app.post('/api/ontmoeten/hier-date', auth, (req, res) => {
  const key = ontmoetKey(req, res); if (!key) return;
  const r = ontmoetHier(key, String(req.body.dateId || ''), coord(req.body.lat, 90), coord(req.body.lng, 180));
  if (r.error) return res.status(r.status).json({ error: r.error });
  res.json({ ok: true });
});
app.post('/api/ontmoeten/stop', auth, (req, res) => {
  const key = ontmoetKey(req, res); if (!key) return;
  const r = ontmoetStop(key, String(req.body.dateId || ''));
  if (r.error) return res.status(r.status).json({ error: r.error });
  res.json({ ok: true, status: r.status2, state: ontmoetMijnState(key) });
});
app.post('/api/ontmoeten/sos', auth, (req, res) => {
  const key = ontmoetKey(req, res); if (!key) return;
  const r = ontmoetSos(key, String(req.body.dateId || ''), req.body.bericht, coord(req.body.lat, 90), coord(req.body.lng, 180));
  if (r.error) return res.status(r.status).json({ error: r.error });
  res.json({ ok: true, sosId: r.sosId });
});
// WebRTC-signaal van het lid naar RTG-kantoor (live meekijken bij een SOS)
app.post('/api/ontmoeten/signaal', auth, (req, res) => {
  const key = ontmoetKey(req, res); if (!key) return;
  const r = ontmoetSignaalKantoor(key, String(req.body.dateId || ''), req.body.payload || null);
  if (r.error) return res.status(r.status).json({ error: r.error });
  res.json({ ok: true });
});

};
