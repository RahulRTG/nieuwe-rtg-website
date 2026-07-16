/* De zorgvolle keten: het zorgprofiel van de gast (allergenen, dieet en
   medische aandachtspunten) en het live meekijken met de locatie.

   Twee harde regels:
   1. De gast bepaalt. Het zorgprofiel reist alleen mee met bestellingen en
      verblijven als de gast delen heeft aangezet, en de live locatie is
      alleen zichtbaar voor zaken die de gast zelf heeft aangewezen.
   2. Niet langer dan nodig. De zaak zet het meekijken uit zodra het niet
      meer nodig is; de gast kan het altijd zelf stoppen. Beide kanten
      krijgen daar meteen een melding van. */
module.exports = ({ db, save, crypto, schoon, notify, notifySupplier, sseToSupplier, sseToCustomer, findSupplier, haversine, etaMinutes }) => {
  const lijsten = () => {
    if (!db.data.zorgProfielen) db.data.zorgProfielen = {};   // per gast: allergenen, dieet, medisch + delen-schakelaar
    if (!db.data.locatieDelen) db.data.locatieDelen = [];      // toestemmingen om live mee te kijken, per gast en zaak
  };
  const nu = () => new Date().toISOString();

  /* ---- het zorgprofiel ---- */
  function zorgVan(key) {
    lijsten();
    return db.data.zorgProfielen[key] || { allergenen: [], dieet: '', medisch: '', delen: false };
  }
  function zorgZet(key, body) {
    lijsten();
    const allergenen = (Array.isArray(body.allergenen) ? body.allergenen : String(body.allergenen || '').split(','))
      .map(a => schoon(a, 30)).filter(Boolean).slice(0, 12);
    const p = { allergenen, dieet: schoon(body.dieet, 60), medisch: schoon(body.medisch, 200), delen: body.delen === true };
    db.data.zorgProfielen[key] = p;
    save();
    return { ok: true, zorg: p };
  }
  // wat de keten mag zien: alleen met toestemming, en alleen als er iets in staat
  function zorgVoor(key) {
    const p = zorgVan(key);
    if (!p.delen) return null;
    if (!p.allergenen.length && !p.dieet && !p.medisch) return null;
    return { allergenen: p.allergenen, dieet: p.dieet, medisch: p.medisch };
  }

  /* ---- live meekijken met toestemming ---- */
  const publiekDeel = d => ({ id: d.id, supplierCode: d.supplierCode, supplierName: d.supplierName, codenaam: d.codenaam, status: d.status, at: d.at, stoppedAt: d.stoppedAt, gestoptDoor: d.gestoptDoor });

  function locDeel(key, codenaam, supplierCodeIn) {
    lijsten();
    const s = findSupplier(String(supplierCodeIn || '').trim().toUpperCase());
    if (!s) return { status: 404, error: 'Zaak niet gevonden.' };
    const al = db.data.locatieDelen.find(x => x.key === key && x.supplierCode === s.code && x.status === 'actief');
    if (al) return { ok: true, deel: publiekDeel(al) };
    const d = {
      id: crypto.randomBytes(4).toString('hex'), key, codenaam,
      supplierCode: s.code, supplierName: s.name,
      status: 'actief', at: nu(), stoppedAt: null, gestoptDoor: null
    };
    db.data.locatieDelen.unshift(d);
    db.data.locatieDelen = db.data.locatieDelen.slice(0, 20000);
    save();
    notifySupplier(s.code, { icon: '📍', title: 'Gast deelt live locatie', body: codenaam + ' deelt de live locatie met u. Zet het uit zodra u het niet meer nodig heeft.' });
    sseToSupplier(s.code, 'sync', { scope: 'gastloc' });
    return { ok: true, deel: publiekDeel(d) };
  }
  function locStopKlant(key, id) {
    lijsten();
    const d = db.data.locatieDelen.find(x => x.id === String(id || '') && x.key === key && x.status === 'actief');
    if (!d) return { status: 404, error: 'Deze deling is er niet (meer).' };
    d.status = 'gestopt'; d.stoppedAt = nu(); d.gestoptDoor = 'de gast';
    save();
    notifySupplier(d.supplierCode, { icon: '📍', title: 'Live meekijken gestopt', body: d.codenaam + ' deelt de locatie niet meer met u.' });
    sseToSupplier(d.supplierCode, 'sync', { scope: 'gastloc' });
    return { ok: true, deel: publiekDeel(d) };
  }
  // de zaak heeft het niet meer nodig: meekijken stopt, de gast hoort het meteen
  function locStopZaak(s, id, wie) {
    lijsten();
    const d = db.data.locatieDelen.find(x => x.id === String(id || '') && x.supplierCode === s.code && x.status === 'actief');
    if (!d) return { status: 404, error: 'Deze deling is er niet (meer).' };
    d.status = 'gestopt'; d.stoppedAt = nu(); d.gestoptDoor = schoon(wie, 40) || s.name;
    save();
    try { notify(d.key, { icon: '📍', title: s.name, body: 'heeft het live meekijken beeindigd (niet meer nodig). Uw locatie wordt daar niet meer getoond.', scope: 'privacy' }); } catch (e) {}
    sseToCustomer(d.key, 'sync', { scope: 'gastloc' });
    sseToSupplier(s.code, 'sync', { scope: 'gastloc' });
    return { ok: true, deel: publiekDeel(d) };
  }
  // het scherm van de zaak: elke gast die toestemming gaf, met de gps-positie
  // (en het zorgprofiel als de gast ook dat deelt)
  function locVoorZaak(s) {
    lijsten();
    const gasten = db.data.locatieDelen
      .filter(d => d.supplierCode === s.code && d.status === 'actief')
      .map(d => {
        const L = (db.data.live || {})[d.key];
        const loc = L && L.active && Number.isFinite(L.lat) ? { lat: L.lat, lng: L.lng } : null;
        const afstand = loc && s.loc ? haversine(loc, s.loc) : null;
        return {
          ...publiekDeel(d), loc,
          km: afstand != null ? Math.round(afstand / 100) / 10 : null,
          etaMin: etaMinutes(afstand, (L && L.mode) || 'driving'),
          wachtOpLocatie: !loc,
          zorg: zorgVoor(d.key)
        };
      })
      .sort((a, b) => (a.etaMin == null ? 999 : a.etaMin) - (b.etaMin == null ? 999 : b.etaMin));
    return { ok: true, gasten };
  }
  function locMijn(key) {
    lijsten();
    const van = db.data.locatieDelen.filter(d => d.key === key);
    return {
      ok: true,
      actief: van.filter(d => d.status === 'actief').map(publiekDeel),
      gestopt: van.filter(d => d.status !== 'actief').slice(0, 8).map(publiekDeel)
    };
  }

  return { zorgVan, zorgZet, zorgVoor, locDeel, locStopKlant, locStopZaak, locVoorZaak, locMijn };
};
