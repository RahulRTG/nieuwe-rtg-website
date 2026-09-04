/* Member-submodule: onderweg. De live reis (start, positie-updates met
   automatische aankomst, stop, stand opvragen) en ritten aanvragen/betalen.
   Gemount vanuit routes/member.js. */
const { coord, coordPaar } = require('../../kern/util');
module.exports = (kern) => {
  const { app, auth, db, save, findSupplier, notifySupplier, notify, pushLive,
    liveStateFor, liveCodename, haversine, vraagRitVoor, betaalRitVoor, ledenInhoudVan } = kern;
  // laatste durende opslag van de live locatie per lid (throttle tegen GPS-storm)
  const liveSaveAt = new Map();

  app.post('/api/live/start', auth, (req, res) => {
    if (req.session.tier === 'guest') return res.status(403).json({ error: 'Alleen voor leden.' });
    const key = req.session.key;
    const destCode = req.body.destCode ? String(req.body.destCode).trim().toUpperCase() : null;
    const dest = destCode ? findSupplier(destCode) : null;
    const mode = ['walking', 'driving', 'flying'].includes(req.body.mode) ? req.body.mode : 'driving';
    // Startpositie: meegegeven, anders het hotel op de bestemming, anders vlakbij de bestemming.
    let start = coordPaar(req.body.lat, req.body.lng);
    // het hotel op de bestemming van de EIGEN reis (stond op db.data.trip: de
    // demo-bestemming, en dat viel om zodra een lid geen demo-reis meer erft)
    const eigenReis = (ledenInhoudVan ? (ledenInhoudVan(key) || {}) : {}).trip || null;
    if (!start && eigenReis) { const hotel = db.data.suppliers.find(s => s.type === 'hotel' && s.city === eigenReis.dest); if (hotel && hotel.loc) start = { lat: hotel.loc.lat, lng: hotel.loc.lng }; }
    if (!start && dest && dest.loc) start = { lat: dest.loc.lat + 0.012, lng: dest.loc.lng - 0.014 };
    db.data.live[key] = {
      key, tier: req.session.tier, codename: liveCodename(req.session),
      active: true, mode, destCode,
      lat: start ? start.lat : null, lng: start ? start.lng : null,
      updatedAt: new Date().toISOString(), startedAt: new Date().toISOString(), arrived: false
    };
    save();
    if (dest) notifySupplier(dest.code, { icon: 'gps', title: 'Gast onderweg', body: db.data.live[key].codename + ' is naar u onderweg.' });
    pushLive(key);
    res.json({ ok: true, live: liveStateFor(key, req.body.lang) });
  });

  app.post('/api/live/update', auth, (req, res) => {
    const key = req.session.key;
    const L = db.data.live[key];
    if (!L || !L.active) return res.status(409).json({ error: 'U bent niet onderweg.' });
    const lat = coord(req.body.lat, 90), lng = coord(req.body.lng, 180);
    if (Number.isFinite(lat) && Number.isFinite(lng)) { L.lat = lat; L.lng = lng; L.updatedAt = new Date().toISOString(); }
    // automatische aankomst binnen ~150 m van de bestemming
    const dest = L.destCode ? findSupplier(L.destCode) : null;
    let aangekomen = false;
    if (dest && dest.loc && !L.arrived) {
      const d = haversine({ lat: L.lat, lng: L.lng }, dest.loc);
      if (d != null && d < 150) {
        L.arrived = true; aangekomen = true;
        notifySupplier(dest.code, { icon: 'ster', title: 'Gast gearriveerd', body: L.codename + ' is bij u aangekomen.' });
        notify(L.tier, { icon: 'gps', title: 'Aangekomen', body: 'U bent bij ' + dest.name + '.', scope: 'live' });
      }
    }
    // De live locatie is vluchtig en komt vele keren per minuut per lid binnen; een
    // durende opslag PER ping zou de datastore overbelasten (elke save serialiseert
    // de hele kast). We sturen de positie altijd live via SSE door, maar bewaren
    // hooguit eens per 3 s per lid, en meteen bij een echte statuswijziging (aankomst).
    const nu = Date.now();
    if (aangekomen || nu - (liveSaveAt.get(key) || 0) > 3000) { liveSaveAt.set(key, nu); save(); }
    pushLive(key);
    res.json({ ok: true, live: liveStateFor(key, req.body.lang) });
  });

  app.post('/api/live/stop', auth, (req, res) => {
    const key = req.session.key;
    const L = db.data.live[key];
    if (L) { L.active = false; save(); pushLive(key); }
    res.json({ ok: true, live: liveStateFor(key, req.body.lang) });
  });

  app.post('/api/live/state', auth, (req, res) => {
    res.json({ live: liveStateFor(req.session.key, req.body.lang) });
  });

  app.post('/api/ride/request', auth, (req, res) => {
    const r = vraagRitVoor(req.session, req.body);
    if (r.error) return res.status(r.status).json({ error: r.error });
    /* DE APPBRUG: dezelfde aanvraag wordt ook een vervoersOPDRACHT, zodat de
       vervoerder hem op zijn dispatchbord ziet in plaats van alleen als
       melding (kern/mobiliteit/appbrug.js, en het besluit erachter staat in
       MAATSTAF.md par. 7.5).

       Lukt dat niet -- een bestemming die alleen een tekst is, een module die
       hier uitstaat -- dan blijft de rit precies zoals hij was, met de reden
       erbij. Een besluit uitvoeren mag geen aanvragen weigeren die gisteren nog
       gewoon doorgingen. */
    if (kern.appbrug && r.ride) {
      /* Dezelfde terugval als de rit zelf: live locatie, anders waar de auto
         staat. Zie de kop van appbrug.js. */
      const L = db.data.live && db.data.live[req.session.key];
      const zaak = findSupplier(r.ride.supplierCode);
      const vanaf = (L && Number.isFinite(L.lat)) ? L : (zaak && zaak.loc) || null;
      /* Neemt deze vervoerder ritten zonder bestemming aan? Zo ja, dan krijgt
         ook zo'n rit een opdracht -- met een expliciet onbekende bestemming.
         De rit zelf is dan al langs dezelfde optie gekomen in
         kern/lidacties/ritten.js; hier gaat het alleen om het dispatchbord. */
      const magZonder = zaak ? kern.optieAan(zaak, 'rittenZonderDoel') : false;
      const b = kern.appbrug.opdrachtBijRit(r.ride, req.session, req.body || {}, vanaf, magZonder);
      if (b.ok) { r.ride.opdrachtRef = b.ref; r.opdrachtRef = b.ref; }
      else { r.ride.opdrachtReden = b.reden; r.opdrachtReden = b.reden; }
      save();
    }
    res.json(r);
  });

  app.post('/api/ride/pay', auth, async (req, res) => {
    const r = await betaalRitVoor(req.session, req.body);
    if (r.error) return res.status(r.status).json({ error: r.error });
    res.json(r);
  });
};
