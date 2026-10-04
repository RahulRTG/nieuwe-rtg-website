/* Member-submodule: onderweg. De live reis (start, positie-updates, een
   bevestigde aankomst, stop, stand opvragen) en ritten aanvragen/betalen.
   Gemount vanuit routes/member.js. */
const { coord, coordPaar } = require('../../kern/util');
const { wie: envelopWie } = require('../../opzet/envelop');
module.exports = (kern) => {
  const { app, auth, db, save, findSupplier, notifySupplier, pushLive,
    liveStateFor, liveCodename, haversine, vraagRitVoor, betaalRitVoor, bevestigAankomst } = kern;
  const liveSave = () => typeof save.sleutels === 'function' ? save.sleutels(['live']) : save();

  app.post('/api/live/start', auth, (req, res) => {
    if (req.session.tier === 'guest') return res.status(403).json({ error: 'Alleen voor leden.' });
    const key = req.session.key;
    const destCode = req.body.destCode ? String(req.body.destCode).trim().toUpperCase() : null;
    const dest = destCode ? findSupplier(destCode) : null;
    const mode = ['walking', 'driving', 'flying'].includes(req.body.mode) ? req.body.mode : 'driving';
    /* Startpositie: alleen wat het lid zelf meestuurt. Hier stond een terugval
       op het hotel van de eigen reis en daarna op de bestemming plus een vaste
       verschuiving -- een VERZONNEN positie van een mens, die daarna als zijn
       live-positie werd gebruikt voor afstand, aankomsttijd en de zaak
       (NAVIGATIE.md par. 12, gebrek 11). Geen positie is geen positie; de
       eerste echte komt binnen via /api/live/update. */
    const start = coordPaar(req.body.lat, req.body.lng);
    db.data.live[key] = {
      key, tier: req.session.tier, codename: liveCodename(req.session),
      active: true, mode, destCode,
      lat: start ? start.lat : null, lng: start ? start.lng : null,
      updatedAt: new Date().toISOString(), startedAt: new Date().toISOString(), arrived: false
    };
    liveSave();
    if (dest) notifySupplier(dest.code, { icon: 'gps', title: 'Gast onderweg', body: db.data.live[key].codename + ' is naar u onderweg.' });
    pushLive(key);
    res.json({ ok: true, live: liveStateFor(key, req.body.lang) });
  });

  app.post('/api/live/update', auth, (req, res) => {
    const key = req.session.key;
    const L = db.data.live[key];
    if (!L || !L.active) return res.status(409).json({ error: 'U bent niet onderweg.' });
    const lat = coord(req.body.lat, 90), lng = coord(req.body.lng, 180);
    let gewijzigd = false;
    if (Number.isFinite(lat) && Number.isFinite(lng)) {
      L.lat = lat; L.lng = lng; L.updatedAt = new Date().toISOString(); gewijzigd = true;
    }
    /* NABIJ IS EEN VOORSTEL (NAVIGATIE.md N13). Binnen ~150 m van de bestemming
       vraagt het scherm "Bent u er?"; de aankomst zelf bevestigt het lid of de
       zaak (/api/live/aangekomen en /api/supplier/guest/aangekomen). Hier ging
       eerst een automatische aankomst af, met een melding aan de zaak en een
       deur die daarop openging -- bewezen uit een opgeslagen positie (N3). */
    const dest = L.destCode ? findSupplier(L.destCode) : null;
    let aangekomen = false;
    if (dest && dest.loc && !L.arrived && Number.isFinite(L.lat)) {
      const d = haversine({ lat: L.lat, lng: L.lng }, dest.loc);
      const nabij = d != null && d < 150;
      if (nabij !== !!L.nabij) { L.nabij = nabij; aangekomen = true; }
    }
    /* Iedere gewijzigde positie neemt deel aan de requestcommit. De JSON-motor
       bundelt zulke save()-signalen nog steeds in zijn write-behind, terwijl
       PostgreSQL alleen deze collectie commit. Een proceslokale tijdgrendel is
       hier onveilig: gelijktijdige requests werken op geisoleerde kopieen en
       zouden dan wel 200 antwoorden, maar hun positie na het antwoord verliezen. */
    if (gewijzigd || aangekomen) liveSave();
    pushLive(key);
    res.json({ ok: true, live: liveStateFor(key, req.body.lang) });
  });

  /* Het lid bevestigt zelf dat het er is (NAVIGATIE.md N13). Geen positie
     nodig: een bevestiging is het bewijs, niet de coordinaat. */
  app.post('/api/live/aangekomen', auth, (req, res) => {
    /* Wie de aankomst bevestigt, komt uit de envelop van het verzoek -- de ene
       plek die zegt wie er handelt (AUTHORITY.md: de actor van een spoor komt uit
       de sessie en nooit uit het lijf). Voor een lid is dat de sessiesleutel. */
    const key = envelopWie(req) || req.session.key;
    const r = bevestigAankomst(key, 'lid');
    if (r.error) return res.status(r.status).json({ error: r.error });
    if (!r.al) {
      liveSave();
      const dest = findSupplier(r.L.destCode);
      if (dest) notifySupplier(dest.code, { icon: 'ster', title: 'Gast gearriveerd', body: r.L.codename + ' meldt dat hij bij u is.' });
    }
    pushLive(key);
    res.json({ ok: true, live: liveStateFor(key, req.body.lang) });
  });

  app.post('/api/live/stop', auth, (req, res) => {
    const key = req.session.key;
    const L = db.data.live[key];
    /* WISSEN BIJ STOPPEN (NAVIGATIE.md N14). Stoppen zette alleen `active` op
       false, en de positie bleef dan zeven dagen staan tot de bewaarveger kwam.
       De taak is voorbij, dus de positie ook; de veger blijft als vangnet voor
       wie nooit op stop drukt. Bestemming en modus blijven: die zijn geen positie. */
    if (L) { L.active = false; delete L.lat; delete L.lng; liveSave(); pushLive(key); }
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
