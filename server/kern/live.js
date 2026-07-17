/* De live-/geo-laag: waar een reizend lid is, welke partners op dit moment met
   dat lid te maken hebben, en de live-toestand die het lid en de betrokken
   partners realtime zien (afstand, ETA, lopende bestelling of rit).

   Alles draait om db.data.live[key]. De functies dragen state (db, de bus, de
   SSE-routers, geo-helpers en i18n) en komen uit maakLive(state), zodat de
   logica los te testen is en server.js dun blijft. */

function maakLive({ db, bus, nextSseId, PERSONAS, sseToSupplier, sseToOffice, findSupplier, haversine, etaMinutes, i18n }) {
  function sseToCustomer(key, event, data) {
    bus.publish('sse', { doel: 'key', match: key, event, data, id: nextSseId() });
  }

  function liveCodename(session) {
    if (!session) return null;
    if (session.account) return session.account.codename;
    // Defensief: een sessie zonder bekende persona-tier (bijv. een leverancier-
    // of kantoor-token dat per ongeluk op een leden-route belandt) mag nooit een
    // crash geven. De leden-auth weert die al, dit is de tweede lijn.
    const p = PERSONAS[session.tier];
    return p ? p.codename : null;
  }

  // Partners die op dit moment met dit reizende lid te maken hebben: de bestemming,
  // plus elke partner met een lopende bestelling of rit.
  function connectedSupplierCodes(key) {
    const set = new Set();
    const L = db.data.live[key];
    if (L && L.destCode) set.add(L.destCode);
    if (L) for (const c of (L.connected || [])) set.add(c);
    for (const o of db.data.orders)
      if ((o.customerKey || o.customerTier) === key && !['terugbetaald', 'geserveerd', 'geweigerd', 'bezorgd', 'opgehaald'].includes(o.status)) set.add(o.supplierCode);
    for (const r of db.data.rides)
      if ((r.customerKey || r.customerTier) === key && !['gearriveerd', 'afgerond', 'geweigerd'].includes(r.status)) set.add(r.supplierCode);
    return [...set];
  }

  // Duw een live-signaal naar het lid zelf, naar alle betrokken partners en de backoffice.
  function pushLive(key) {
    sseToCustomer(key, 'sync', { scope: 'live' });
    for (const code of connectedSupplierCodes(key)) sseToSupplier(code, 'sync', { scope: 'live' });
    sseToOffice('sync', { scope: 'live' });
  }

  // Volledige live-toestand voor het lid: eigen positie plus elke partner met afstand en ETA.
  function liveStateFor(key, lang) {
    const L = db.data.live[key];
    const active = !!(L && L.active);
    const me = L && Number.isFinite(L.lat) ? { lat: L.lat, lng: L.lng, at: L.updatedAt } : null;
    const mode = (L && L.mode) || 'driving';
    const partners = connectedSupplierCodes(key).map(code => {
      const s = findSupplier(code); if (!s) return null;
      const t = db.data.supplierTypes[s.type] || {};
      const dist = me && s.loc ? haversine(me, s.loc) : null;
      const order = db.data.orders.find(o => (o.customerKey || o.customerTier) === key && o.supplierCode === code && !['terugbetaald', 'geserveerd', 'geweigerd', 'bezorgd', 'opgehaald'].includes(o.status));
      const ride = db.data.rides.find(r => (r.customerKey || r.customerTier) === key && r.supplierCode === code && r.status !== 'gearriveerd' && r.status !== 'geweigerd');
      return {
        code: s.code, name: s.name, type: s.type, typeLabel: t.label, icon: t.icon,
        loc: s.loc ? { ...s.loc, label: i18n.localize(s.loc.label, lang) } : null,
        hasDoors: (s.doors || []).length > 0,
        isDest: !!(L && L.destCode === code),
        distance: dist,
        etaMin: etaMinutes(dist, mode),
        // voor een rit telt de ETA van het voertuig naar het lid
        taxiEtaMin: ride && me && s.loc ? etaMinutes(haversine(s.loc, me), 'driving') : null,
        order: order ? { ref: order.ref, status: order.status, items: order.items.reduce((n, i) => n + i.qty, 0), total: order.total, paid: order.paid } : null,
        ride: ride ? { ref: ride.ref, status: ride.status, to: ride.to, quote: ride.quote, km: ride.km,
                       passengers: ride.passengers, driver: ride.driver ? ride.driver.name : null,
                       vehicle: ride.vehicle ? ride.vehicle.name + (ride.vehicle.plate ? ' · ' + ride.vehicle.plate : '') : null,
                       paid: !!ride.paid,
                       pickupEtaMin: ride.pickupEtaMin, dropEtaMin: ride.dropEtaMin } : null
      };
    }).filter(Boolean);
    const destCode = L && L.destCode ? L.destCode : null;
    return { active, mode, me, arrived: !!(L && L.arrived), destCode, dest: destCode ? (partners.find(p => p.code === destCode) || null) : null, partners };
  }

  // Reizende leden die op dit moment met deze partner te maken hebben (voor de leverancier-app).
  function guestsFor(code) {
    const out = [];
    const s = findSupplier(code);
    for (const key of Object.keys(db.data.live || {})) {
      const L = db.data.live[key];
      if (!L || !L.active) continue;
      if (!connectedSupplierCodes(key).includes(code)) continue;
      const me = Number.isFinite(L.lat) ? { lat: L.lat, lng: L.lng } : null;
      const dist = me && s && s.loc ? haversine(me, s.loc) : null;
      const order = db.data.orders.find(o => (o.customerKey || o.customerTier) === key && o.supplierCode === code && !['terugbetaald', 'geserveerd', 'geweigerd', 'bezorgd', 'opgehaald'].includes(o.status));
      const ride = db.data.rides.find(r => (r.customerKey || r.customerTier) === key && r.supplierCode === code && r.status !== 'gearriveerd' && r.status !== 'geweigerd');
      out.push({
        codename: L.codename, distance: dist, etaMin: etaMinutes(dist, L.mode),
        loc: me, mode: L.mode,
        heading: L.destCode === code, arrived: !!L.arrived,
        orderRef: order ? order.ref : null, rideRef: ride ? ride.ref : null
      });
    }
    return out.sort((a, b) => (a.etaMin == null ? 999 : a.etaMin) - (b.etaMin == null ? 999 : b.etaMin));
  }

  return { sseToCustomer, liveCodename, connectedSupplierCodes, pushLive, liveStateFor, guestsFor };
}

module.exports = { maakLive };
