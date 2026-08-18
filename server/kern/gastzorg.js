const klok = require('../lib/klok');
/* De zorgvolle keten: het zorgprofiel van de gast (allergenen, dieet en
   medische aandachtspunten) en het live meekijken met de locatie.

   Twee harde regels:
   1. De gast bepaalt. Het zorgprofiel reist alleen mee met bestellingen en
      verblijven als de gast delen heeft aangezet, en de live locatie is
      alleen zichtbaar voor zaken die de gast zelf heeft aangewezen.
   2. Niet langer dan nodig. De zaak zet het meekijken uit zodra het niet
      meer nodig is; de gast kan het altijd zelf stoppen. Beide kanten
      krijgen daar meteen een melding van. */
const inzagelog = require('../inzagelog');
const { idVanKey } = require('../lib/lidsleutel');

/* Hoe vaak eenzelfde zaak in het journaal komt voor hetzelfde profiel: een keer
   per dag. Een restaurant dekt een tafel meerdere keren per avond, en zonder
   deze rem verdrinkt het echte signaal -- "die zaak heeft mijn allergieen
   gezien" -- in vijftig regels van dezelfde zaak op dezelfde avond. De grens
   staat op een dag omdat dat is wat een lid zou zeggen: gisteren, vandaag. */
const INZAGE_STIL_MS = 24 * 60 * 60 * 1000;

module.exports = ({ db, save, crypto, schoon, notify, notifySupplier, sseToSupplier, sseToCustomer, findSupplier, haversine, etaMinutes }) => {
  const lijsten = () => {
    if (!db.data.zorgProfielen) db.data.zorgProfielen = {};   // per gast: allergenen, dieet, medisch + delen-schakelaar
    if (!db.data.locatieDelen) db.data.locatieDelen = [];      // toestemmingen om live mee te kijken, per gast en zaak
  };
  const nu = () => klok.datum().toISOString();

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
  /* Wat de keten mag zien: alleen met toestemming, en alleen als er iets in
     staat.

     EN WIE HET ZAG KOMT IN HET JOURNAAL. Dat ontbrak, en het was het gat met de
     zwaarste inhoud: allergieen, dieet en medische aandachtspunten zijn de
     gevoeligste gegevens die dit huis kent, en ze reisden mee zonder dat het lid
     ooit kon zien welke zaak ze had gelezen. De deel-schakelaar stond wel op het
     toestemmingsscherm ("wat er nu mag"), maar de andere helft -- wie er
     werkelijk keek -- nergens.

     EEN AANROEPER DIE EEN ZAAK NOEMT, WORDT GENOTEERD; een aanroeper die niets
     noemt niet. Dat verschil is geen slordigheid maar dezelfde regel als in
     server/inzagelog.js: je eigen profiel lezen is geen inzage. De schermen van
     het lid zelf (zijn bestelling, zijn rit, zijn zorgkaart) vragen het profiel
     voor hem, niet over hem. */
  function zorgVoor(key, door) {
    const p = zorgVan(key);
    if (!p.delen) return null;
    if (!p.allergenen.length && !p.dieet && !p.medisch) return null;
    if (door && door.zaak) noteerInzage(key, door);
    return { allergenen: p.allergenen, dieet: p.dieet, medisch: p.medisch };
  }

  function noteerInzage(key, door) {
    const id = idVanKey(key);
    if (id == null) return;                       // een gast of persona heeft geen dossier
    const zaak = String(door.zaak || '').slice(0, 40);
    lijsten();
    if (!db.data.zorgInzageStil || typeof db.data.zorgInzageStil !== 'object') db.data.zorgInzageStil = {};
    const sleutel = key + '|' + zaak;
    const nu = klok.nu();
    if (nu - (db.data.zorgInzageStil[sleutel] || 0) < INZAGE_STIL_MS) return;
    db.data.zorgInzageStil[sleutel] = nu;
    const s = findSupplier ? findSupplier(zaak) : null;
    try {
      inzagelog.noteer({ door: (s && s.name) || zaak, over: { id },
        waarom: door.reden || 'zorgprofiel gelezen bij een bestelling of verblijf',
        bron: 'zorgprofiel' });
    } catch (e) {}
    save();
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
    notifySupplier(s.code, { icon: 'gps', title: 'Gast deelt live locatie', body: codenaam + ' deelt de live locatie met u. Zet het uit zodra u het niet meer nodig heeft.' });
    sseToSupplier(s.code, 'sync', { scope: 'gastloc' });
    return { ok: true, deel: publiekDeel(d) };
  }
  function locStopKlant(key, id) {
    lijsten();
    const d = db.data.locatieDelen.find(x => x.id === String(id || '') && x.key === key && x.status === 'actief');
    if (!d) return { status: 404, error: 'Deze deling is er niet (meer).' };
    d.status = 'gestopt'; d.stoppedAt = nu(); d.gestoptDoor = 'de gast';
    save();
    notifySupplier(d.supplierCode, { icon: 'gps', title: 'Live meekijken gestopt', body: d.codenaam + ' deelt de locatie niet meer met u.' });
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
    try { notify(d.key, { icon: 'gps', title: s.name, body: 'heeft het live meekijken beeindigd (niet meer nodig). Uw locatie wordt daar niet meer getoond.', scope: 'privacy' }); } catch (e) {}
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
