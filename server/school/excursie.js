/* School (deelmodule): de excursie -- het schoolreisje, veilig geregeld.
   Twee afspraken maken dit anders dan een volg-app:
   - GPS bestaat ALLEEN tijdens een actieve excursie, en alleen voor kinderen
     van wie een ouder vooraf toestemming gaf. Bij de stop wordt elke locatie
     meteen gewist: bewaren duurt precies zo lang als het uitje.
   - Elke blik van de leraar of de directie op de kaart wordt gelogd, en het
     gezin leest die log mee. Kijken mag, stiekem kijken bestaat niet. */
module.exports = (sctx) => {
  const { router, save, rid, nu, schoon, K, S, eigenVeld, klasVan, gezinSessie, leerlingVan } = sctx;

  const lijst = (k) => { if (!Array.isArray(k.excursies)) k.excursies = []; return k.excursies; };
  const vanId = (k, id) => lijst(k).find(e => e.id === String(id || ''));

  // wie kijkt er? (voor de kijklog): de directie of een personeelslid op naam
  function kijker(req, k) {
    const tok = String(req.body.leraarToken || req.body.personeelToken || req.body.beheerToken || '');
    const sch = k.schoolCode ? S()[k.schoolCode] : null;
    if (sch && sch.token === tok) return 'de directie';
    const p = sch && Object.values(sch.personeel || {}).find(x => x.token === tok);
    return p ? p.naam : (k.leraar || 'de leraar');
  }

  router.post('/school/excursie/maak', (req, res) => {
    const k = klasVan(req, res); if (!k) return;
    const titel = schoon(req.body.titel, 80);
    if (!titel) return res.status(400).json({ error: 'Geef de excursie een naam.' });
    const e = { id: rid(4), titel, bestemming: schoon(req.body.bestemming, 80),
      van: schoon(req.body.van, 10), tot: schoon(req.body.tot, 10),
      status: 'gepland', toestemming: {}, gps: {}, kijklog: [], at: nu() };
    lijst(k).unshift(e); k.excursies = k.excursies.slice(0, 50);
    save();
    res.json({ ok: true, excursie: { id: e.id, titel: e.titel, status: e.status } });
  });

  /* de ouder beslist vooraf over de locatie van het eigen kind; het kind zelf
     niet, en de school al helemaal niet */
  router.post('/school/excursie/toestemming', (req, res) => {
    const s = gezinSessie(req, res); if (!s) return;
    if (!s.beheerder) return res.status(403).json({ error: 'Alleen een ouder of verzorger beslist over locatie-delen.' });
    const k = eigenVeld(K(), String(req.body.klasCode || '').trim().toUpperCase());
    const l = k && leerlingVan(k, s.g, String(req.body.profielId || ''));
    if (!l) return res.status(403).json({ error: 'Dit kind zit niet in deze klas.' });
    const e = vanId(k, req.body.excursieId);
    if (!e) return res.status(404).json({ error: 'Excursie niet gevonden.' });
    e.toestemming[l.sleutel] = { akkoord: req.body.akkoord === true, door: schoon(s.p.naam, 60), at: nu() };
    if (req.body.akkoord !== true) delete e.gps[l.sleutel]; // intrekken = ook meteen weg
    save();
    res.json({ ok: true, akkoord: req.body.akkoord === true });
  });

  router.post('/school/excursie/start', (req, res) => {
    const k = klasVan(req, res); if (!k) return;
    const e = vanId(k, req.body.excursieId);
    if (!e) return res.status(404).json({ error: 'Excursie niet gevonden.' });
    if (e.status === 'afgerond') return res.status(400).json({ error: 'Deze excursie is al afgerond.' });
    e.status = 'actief'; e.gestartAt = nu();
    save();
    res.json({ ok: true, status: e.status });
  });

  // stop = wissen: de locaties bestaan precies zo lang als de excursie duurt
  router.post('/school/excursie/stop', (req, res) => {
    const k = klasVan(req, res); if (!k) return;
    const e = vanId(k, req.body.excursieId);
    if (!e || e.status !== 'actief') return res.status(400).json({ error: 'Deze excursie is niet actief.' });
    e.status = 'afgerond'; e.gps = {}; e.gestoptAt = nu();
    save();
    res.json({ ok: true, status: e.status, gewist: true });
  });

  // een plek doorgeven: een begeleider (personeel), of het kind zelf met
  // toestemming van de ouder; ieder toestel geeft alleen de eigen plek door
  router.post('/school/excursie/gps', (req, res) => {
    const lat = Number(req.body.lat), lng = Number(req.body.lng);
    if (!(lat >= -90 && lat <= 90 && lng >= -180 && lng <= 180))
      return res.status(400).json({ error: 'Geen geldige locatie.' });
    const tok = String(req.body.leraarToken || req.body.personeelToken || req.body.beheerToken || '');
    if (tok) {
      const k = klasVan(req, res); if (!k) return;
      const e = vanId(k, req.body.excursieId);
      if (!e || e.status !== 'actief') return res.status(400).json({ error: 'Deze excursie is niet actief.' });
      const wie = kijker(req, k);
      e.gps['begeleider:' + wie] = { lat, lng, naam: wie, rol: 'begeleider', at: nu() };
      save();
      return res.json({ ok: true });
    }
    const s = gezinSessie(req, res); if (!s) return;
    const k = eigenVeld(K(), String(req.body.klasCode || '').trim().toUpperCase());
    const l = k && leerlingVan(k, s.g, s.p.id);
    if (!l) return res.status(403).json({ error: 'Je zit niet in deze klas.' });
    const e = vanId(k, req.body.excursieId);
    if (!e || e.status !== 'actief') return res.status(400).json({ error: 'Deze excursie is niet actief.' });
    const t = e.toestemming[l.sleutel];
    if (!t || !t.akkoord) return res.status(403).json({ error: 'Er is nog geen toestemming van je ouders voor locatie-delen.' });
    e.gps[l.sleutel] = { lat, lng, naam: l.naam, rol: 'leerling', at: nu() };
    save();
    res.json({ ok: true });
  });

  /* de lijst voor de leraar: bewust ZONDER locaties. Plekken zien kan alleen
     via de kaart-route, en die logt elke blik. */
  router.post('/school/excursie/lijst', (req, res) => {
    const k = klasVan(req, res); if (!k) return;
    res.json({ ok: true, excursies: lijst(k).map(e => ({
      id: e.id, titel: e.titel, bestemming: e.bestemming, van: e.van, tot: e.tot, status: e.status,
      toestemmingen: Object.values(e.toestemming).filter(t => t.akkoord).length,
      leerlingen: (k.leerlingen || []).length, kijkbeurten: e.kijklog.length })) });
  });

  // de kaart: alle plekken van dit moment -- en elke blik wordt gelogd
  router.post('/school/excursie/kaart', (req, res) => {
    const k = klasVan(req, res); if (!k) return;
    const e = vanId(k, req.body.excursieId);
    if (!e || e.status !== 'actief') return res.status(400).json({ error: 'Deze excursie is niet actief; er zijn geen locaties.' });
    e.kijklog.unshift({ naam: kijker(req, k), at: nu() });
    e.kijklog = e.kijklog.slice(0, 300);
    save();
    res.json({ ok: true, titel: e.titel, plekken: Object.values(e.gps),
      zonderToestemming: (k.leerlingen || []).filter(l => !(e.toestemming[l.sleutel] || {}).akkoord).map(l => l.naam) });
  });

  /* het gezin: de excursies, de eigen toestemming, de plek van het eigen kind
     en -- net zo belangrijk -- wie er wanneer op de kaart keek */
  router.post('/school/excursie/mijn', (req, res) => {
    const s = gezinSessie(req, res); if (!s) return;
    const k = eigenVeld(K(), String(req.body.klasCode || '').trim().toUpperCase());
    if (!k) return res.status(404).json({ error: 'Klas niet gevonden.' });
    const mijnIds = s.beheerder ? Object.keys(s.g.profielen) : [s.p.id];
    const eigen = (k.leerlingen || []).filter(l => l.gezinCode === s.g.code && mijnIds.includes(l.profielId));
    if (!eigen.length) return res.status(403).json({ error: 'Geen kind van jullie in deze klas.' });
    res.json({ ok: true, excursies: lijst(k).map(e => ({
      id: e.id, titel: e.titel, bestemming: e.bestemming, van: e.van, tot: e.tot, status: e.status,
      kinderen: eigen.map(l => ({ profielId: l.profielId, naam: l.naam,
        toestemming: e.toestemming[l.sleutel] || null,
        plek: e.status === 'actief' ? (e.gps[l.sleutel] || null) : null })),
      kijklog: e.kijklog.slice(0, 30)
    })) });
  });
};
