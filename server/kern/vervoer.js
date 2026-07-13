/* De vervoerslaag: de ritstatus loopt via een vaste, logische keten met nette
   meldingen naar de gast, plus de slimme toewijzing (vrije chauffeur + vrij
   voertuig). RIT_KETEN/RIT_LEGACY/RIT_MELDING zijn pure data; de rekenende
   functies dragen db + de realtime-helpers en komen uit maakVervoer(state). */

// vaste statusketen; oude namen (rijdt/gearriveerd) blijven werken voor bestaande data
const RIT_KETEN = ['aangevraagd', 'geaccepteerd', 'onderweg', 'aangekomen', 'aan-boord', 'afgerond'];
const RIT_LEGACY = { rijdt: 'aan-boord', gearriveerd: 'afgerond' };
const RIT_MELDING = {
  geaccepteerd: 'Uw rit is bevestigd.',
  onderweg: 'Uw chauffeur is onderweg naar u.',
  aangekomen: 'Uw chauffeur staat voor.',
  'aan-boord': 'Goede reis!',
  afgerond: 'U bent gearriveerd. Dank voor het reizen met RTG.',
  geweigerd: 'De rit kon helaas niet worden aangenomen.'
};

function maakVervoer({ db, etaMinutes, haversine, save, broadcastSync, sseToCustomer, sseToOffice, notify, logActivity }) {
  function ritVerder(req, res, r, status) {
    r.status = status;
    const gastLoc = (() => { const L = db.data.live[r.customerKey || r.customerTier]; return L && Number.isFinite(L.lat) ? { lat: L.lat, lng: L.lng } : null; })();
    if (status === 'onderweg') r.pickupEtaMin = etaMinutes(haversine(req.supplier.loc, gastLoc), 'driving') || 6;
    if (status === 'aan-boord') { r.boardedAt = new Date().toISOString(); r.dropEtaMin = r.km ? etaMinutes(r.km * 1000, r.type === 'jet' ? 'flying' : 'driving') : 12; }
    if (status === 'afgerond') r.finishedAt = new Date().toISOString();
    save();
    broadcastSync([r.customerTier], 'orders');
    sseToCustomer(r.customerKey || r.customerTier, 'sync', { scope: 'live' });
    sseToOffice('sync', { scope: 'orders' });
    notify(r.customerTier, { icon: r.type === 'jet' ? '✈️' : '🚗', title: req.supplier.name, body: RIT_MELDING[status] || ('Uw rit is nu: ' + status + '.'), scope: 'orders' });
    logActivity(req.supplier.code, req.actor, 'zette rit ' + r.ref + ' op "' + status + '"');
    res.json({ ok: true, ride: r });
  }

  // Slimme toewijzing: de eerste vrije chauffeur en een passend, vrij voertuig.
  function ritBezetting(code) {
    const actief = db.data.rides.filter(r => r.supplierCode === code && ['geaccepteerd', 'onderweg', 'aangekomen', 'aan-boord'].includes(RIT_LEGACY[r.status] || r.status));
    return {
      drukkeChauffeurs: new Set(actief.filter(r => r.driver).map(r => r.driver.staffId)),
      bezetteVoertuigen: new Set(actief.filter(r => r.vehicle).map(r => r.vehicle.id))
    };
  }

  return { ritVerder, ritBezetting };
}

module.exports = { RIT_KETEN, RIT_LEGACY, RIT_MELDING, maakVervoer };
