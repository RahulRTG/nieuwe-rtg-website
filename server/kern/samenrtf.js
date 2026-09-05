/* FoundationOS Samen. De kale deelcode opent uitsluitend de eerste toetreding.
   Daarna gebruikt elk gezinsprofiel een niet-geheime kamer-id. Iedere
   beslissing en mutatie staat onder hetzelfde collectieslot; gezin of actuele
   bevestigde vriendschap blijft naast de bearer een verplichte tweede poort. */
'use strict';

module.exports = ({ db, save, bewerkCollectie, crypto, schoon, zijnVrienden,
  tijd = () => Date.now() }) => {
  const eigen = require('./eigencollectie')({ db, domein: 'kern/samenrtf',
    bezit: { samenRtfKamers: 'kaart' } });
  const iso = () => new Date(tijd()).toISOString();
  const toegang = require('./samenrtf-toegang')({ crypto, nu: iso });
  const MAX_KAMERS = 5000;
  const MAX_EIGEN = 20;
  const BEWAAR_MS = 90 * 86400000;
  const bak = () => eigen.bak('samenRtfKamers');
  const afdruk = waarde => crypto.createHash('sha256')
    .update(String(waarde || '')).digest('hex');
  const gezinHash = code => afdruk('rtf-samen-gezin|' +
    String(code || '').trim().toUpperCase());
  const lidVan = (k, handle) => (k.leden || [])
    .find(l => l.handle === handle) || null;

  function veiligPad(waarde) {
    const p = String(waarde || '');
    if (!p || p.length > 200 || p !== p.trim() ||
        /[?#\\\u0000-\u001f]/.test(p) || !p.startsWith('/apps/foundation/')) return null;
    try {
      const u = new URL(p, 'https://samen.invalid');
      return u.origin === 'https://samen.invalid' && u.pathname === p &&
        !u.search && !u.hash ? u.pathname : null;
    } catch (e) { return null; }
  }

  function publiek(k, sess) {
    return { id: k.id, gastheer: k.gastheerNaam,
      leden: (k.leden || []).map(l => l.codenaam), pad: k.pad,
      titel: k.titel, door: k.door || null, volg: k.volg || 0,
      chat: (k.chat || []).slice(-30), at: k.at,
      toegang: toegang.publiek(k),
      benGastheer: sess ? k.gastheer === sess.handle : undefined,
      now: tijd() };
  }

  function familieVan(sess) { return gezinHash(sess && sess.g && sess.g.code); }
  function relatieGeldig(k, sess) {
    if (!k || !sess || !sess.handle) return false;
    if (k.gastheer === sess.handle) return true;
    if (k.gastheerGezinHash && k.gastheerGezinHash === familieVan(sess)) return true;
    try { return !!(zijnVrienden && zijnVrienden(sess.handle, k.gastheer)); }
    catch (e) { return false; }
  }

  function normaliseer(k) {
    if (!k || typeof k !== 'object') return;
    if (k.gastheerGezin && !k.gastheerGezinHash)
      k.gastheerGezinHash = gezinHash(k.gastheerGezin);
    delete k.gastheerGezin;
    if (!k.gastheerNaam) k.gastheerNaam = k.gastheer || 'Gezinslid';
    k.leden = Array.isArray(k.leden) ? k.leden : [];
    for (const lid of k.leden) {
      if (lid.gezin && !lid.gezin_hash) lid.gezin_hash = gezinHash(lid.gezin);
      delete lid.gezin;
    }
    if (k.pad && !veiligPad(k.pad)) { k.pad = null; k.titel = null; }
    k.chat = Array.isArray(k.chat) ? k.chat : [];
  }

  function onderhoud(kamers) {
    toegang.migreerLegacy(kamers);
    const nu = tijd();
    for (const [id, k] of Object.entries(kamers)) {
      if (!k) { delete kamers[id]; continue; }
      normaliseer(k);
      const reden = !k.gesloten_at && toegang.reden(k);
      if (reden && reden !== 'ingetrokken' && reden !== 'opgebruikt') {
        k.gesloten_at = iso();
        toegang.intrekken(k, 'systeem', 'verlopen');
      }
      if (k.gesloten_at && nu - Date.parse(k.gesloten_at) > BEWAAR_MS)
        delete kamers[id];
    }
  }

  function transactie(werk) {
    const doe = kamers => {
      if (!kamers || typeof kamers !== 'object' || Array.isArray(kamers))
        throw new Error('samenRtfKamers hoort een kaart te zijn');
      onderhoud(kamers);
      return werk(kamers);
    };
    if (typeof bewerkCollectie === 'function')
      return bewerkCollectie('samenRtfKamers', doe);
    const kamers = bak(), voor = JSON.stringify(kamers);
    try {
      const r = doe(kamers);
      if (r && typeof r.then === 'function')
        throw new Error('samenRtfKamers-transactie mag niet asynchroon zijn');
      if (JSON.stringify(kamers) !== voor) save();
      return r;
    } catch (e) {
      const oud = JSON.parse(voor);
      for (const id of Object.keys(kamers)) delete kamers[id];
      Object.assign(kamers, oud);
      throw e;
    }
  }

  const handel = werk => Promise.resolve(transactie(werk));
  const kamer = (kamers, id) => kamers[String(id || '')] || null;
  const actiefVoor = (kamers, id, sess) => {
    const k = kamer(kamers, id);
    return k && !k.gesloten_at && lidVan(k, sess.handle) &&
      relatieGeldig(k, sess) ? k : null;
  };
  const idempotentie = require('./samenrtf-idem')({ afdruk, iso });

  function maak(sess, idem) {
    const idemWaarde = String(idem || '').trim().slice(0, 200);
    if (!idemWaarde) return Promise.resolve({ status: 400,
      error: 'Een idempotentiesleutel is verplicht om een Samen-code te maken.' });
    return handel(kamers => {
      const actief = Object.values(kamers).filter(k => k && !k.gesloten_at);
      if (actief.length >= MAX_KAMERS)
        return { status: 503,
          error: 'Alle samen-kamers zijn even bezet; probeer het zo weer.' };
      if (actief.filter(k => k.gastheer === sess.handle).length >= MAX_EIGEN)
        return { status: 409, error: 'Ruim eerst een oude Samen-kamer op.' };
      const vinger = afdruk('rtf-samen-maak|' + sess.handle);
      const idemHash = afdruk('rtf-samen-maak-idem|' + sess.handle + '|' +
        idemWaarde);
      const bestaand = actief.find(k => k.uitgifte &&
        k.uitgifte.idem_hash === idemHash);
      if (bestaand) return { status: 409, herhaald: true,
        error: 'Deze Samen-code is al eenmalig getoond. Vernieuw haar vanuit de kamer.',
        kamer: publiek(bestaand, sess) };
      const id = 'rsk' + crypto.randomBytes(16).toString('hex');
      const k = { id, gastheer: sess.handle, gastheerNaam: sess.codenaam,
        gastheerGezinHash: familieVan(sess), leden: [{ handle: sess.handle,
          gezin_hash: familieVan(sess), codenaam: sess.codenaam }],
        pad: null, titel: null, door: null, volg: 0, chat: [], at: tijd(),
        gesloten_at: null, toegang_historie: [], uitgifte: {
          idem_hash: idemHash, fingerprint_hash: vinger, at: iso()
        } };
      const gemaakt = toegang.nieuw(kamers, k, sess.codenaam || sess.handle);
      if (!gemaakt) return { status: 500,
        error: 'Kon geen unieke Samen-code maken.' };
      k.toegang = gemaakt.toegang;
      kamers[id] = k;
      return { status: 200, ok: true, deelcode: gemaakt.code,
        eenmalig: true, kamer: publiek(k, sess) };
    });
  }

  function doeMee(sess, deelcode) {
    const raw = String(deelcode || '').trim().toUpperCase().slice(0, 100);
    return handel(kamers => {
      const k = toegang.zoek(kamers, raw);
      if (!k || k.gesloten_at || !relatieGeldig(k, sess))
        return { status: 404, error: 'Deze Samen-code is niet bruikbaar.' };
      if (lidVan(k, sess.handle))
        return { status: 200, ok: true, al: true, kamer: publiek(k, sess) };
      if (toegang.reden(k))
        return { status: 404, error: 'Deze Samen-code is niet bruikbaar.' };
      if (k.leden.length >= 12)
        return { status: 409, error: 'Deze kamer zit vol (12 personen).' };
      k.leden.push({ handle: sess.handle, gezin_hash: familieVan(sess),
        codenaam: sess.codenaam });
      k.at = tijd();
      toegang.gebruik(k);
      return { status: 200, ok: true, kamer: publiek(k, sess) };
    });
  }

  function roteer(sess, id, idem) {
    const idemWaarde = String(idem || '').trim().slice(0, 200);
    if (!idemWaarde) return Promise.resolve({ status: 400,
      error: 'Een idempotentiesleutel is verplicht om de Samen-code te vernieuwen.' });
    return handel(kamers => {
      const k = actiefVoor(kamers, id, sess);
      if (!k) return { status: 404, error: 'Deze kamer bestaat niet (meer).' };
      if (k.gastheer !== sess.handle)
        return { status: 403, error: 'Alleen de gastheer vernieuwt de deelcode.' };
      const idemHash = afdruk('rtf-samen-code-idem|' + sess.handle + '|' +
        id + '|' + idemWaarde);
      const laatst = k.laatste_rotatie;
      if (laatst && laatst.idem_hash === idemHash)
        return { status: 409, herhaald: true,
          error: 'De nieuwe Samen-code is al eenmalig getoond en wordt niet herhaald.',
          kamer: publiek(k, sess) };
      const gemaakt = toegang.roteer(kamers, k,
        sess.codenaam || sess.handle);
      if (!gemaakt) return { status: 500,
        error: 'Kon geen unieke Samen-code maken.' };
      k.laatste_rotatie = { idem_hash: idemHash,
        at: iso() };
      k.at = tijd();
      return { status: 200, ok: true, deelcode: gemaakt.code,
        eenmalig: true, kamer: publiek(k, sess) };
    });
  }

  const kamerhandelingen = require('./samenrtf-kamer')({ schoon, tijd, iso,
    veiligPad, lidVan, actiefVoor, kamer, toegang, publiek, handel,
    relatieGeldig, idempotentie });
  const ruimOp = () => handel(() => ({ ok: true }));
  /* De opstartpoort heeft een opslagafhankelijke vorm nodig: lokaal commit de
     collectietransactie synchroon vóór de server luistert, terwijl PostgreSQL
     een Promise teruggeeft nadat de autoritatieve rij is gecommitte. Houd dit
     los van ruimOp(), waarvan het publieke onderhoudscontract altijd async is. */
  const migreerAlles = () => transactie(() => ({ ok: true }));
  return { samenRtf: Object.assign({ maak, doeMee, roteer, ruimOp,
    migreerAlles },
    kamerhandelingen) };
};
