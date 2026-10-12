/* Staff (deelmodule): VIDEOBELLEN op de werkvloer. Uit ./collega.js gelicht toen
   de server zelf ging beslissen wie een signaal krijgt (tegenlezing PR #584):
   dat is een eigen onderwerp, en ./collega.js liep tegen de omvanggrens. */
'use strict';
module.exports = (actx) => {
  const { app, klokVan, logActivity, sseToSupplier, supplierAuth } = actx;
/* Videobellen op de werkvloer (WebRTC). De server geeft alleen signalen door
   (bel, aannemen, offer/answer/ice); het beeld en geluid lopen rechtstreeks
   tussen de toestellen (peer-to-peer). 1-op-1 belt op staffId en alleen wie
   is ingeklokt is bereikbaar; de teamcall is een groepsgesprek per zaak
   (kamer "team"), waarin ieder toestel rechtstreeks met de anderen verbindt
   (mesh) tot de kamergrens van 100 deelnemers. */
// de teamkamer per zaak: wie er binnen is (in het geheugen, net als de aanwezigheid in kern/comm)
const teamKamer = new Map();
app.post('/api/staff/call', supplierAuth, (req, res) => {
  if (!req.actor.staffId) return res.status(403).json({ error: 'Alleen met een persoonlijke login.' });
  const kind = String(req.body.kind || '');
  if (!['ring', 'accept', 'decline', 'offer', 'answer', 'ice', 'hangup', 'join', 'leave'].includes(kind))
    return res.status(400).json({ error: 'Onbekend signaal.' });
  const naar = req.body.staffId != null && req.body.staffId !== '' ? parseInt(req.body.staffId, 10) : null;
  if (kind === 'ring') {
    if (!naar || naar === req.actor.staffId) return res.status(400).json({ error: 'Kies een collega.' });
    // ingeklokt: uit klokVan, zodat dit bestand geen eigen greep in de database heeft
    if (!klokVan(req.supplier.code, naar).open) return res.status(409).json({ error: 'Deze collega is niet ingeklokt en dus niet bereikbaar.' });
    logActivity(req.supplier.code, req.actor, 'belde een ingeklokte collega (video)');
  }
  /* WIE HET SIGNAAL KRIJGT, BESLIST DE SERVER (tegenlezing PR #584): een
     signaal draagt een SDP/ICE met IP-adressen en zegt wie wie belt. Met een
     `naar` gaat het alleen naar die collega (ook niet naar een manager); in de
     teamkamer alleen naar wie er is binnengekomen. Wat nergens heen hoort, gaat
     nergens heen. */
  const kamer = String(req.body.kamer || '') || null;
  const leden = teamKamer.get(req.supplier.code) || new Set();
  teamKamer.set(req.supplier.code, leden);
  if (kamer && kind === 'join') leden.add(String(req.actor.staffId));
  if (kamer && kind === 'leave') leden.delete(String(req.actor.staffId));
  const bericht = { kind, van: req.actor.staffId, vanNaam: req.actor.name, naar,
    video: req.body.video !== false, payload: req.body.payload || null, kamer };
  const ontvangers = naar != null ? (kamer && !leden.has(String(naar)) ? [] : [naar])
    : kamer ? [...leden].filter(id => id !== String(req.actor.staffId)) : [];
  for (const id of ontvangers) sseToSupplier(req.supplier.code, 'rtc', bericht, { staffId: id, zonderManager: true });
  res.json({ ok: true });
});

};
