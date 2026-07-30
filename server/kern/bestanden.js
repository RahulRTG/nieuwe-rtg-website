/* RTG Bestanden, de kluis: mappen, uploaden met een eerlijk quotum, en de
   bytes ALTIJD versleuteld op schijf (zelfde aanpak als server/media.js) met
   alleen een korte verwijzing in de database. Delen, versies en de
   prullenbak staan in ./bestanden-delen.js; dit deel is de basis. */
const fs = require('fs');
const path = require('path');
const kluis = require('../kluis');
const { maakBestandenDelen } = require('./bestanden-delen');

const QUOTUM = 200 * 1024 * 1024;       // per lid, alles bij elkaar (ook de prullenbak)
const MAX_BESTAND = 15 * 1024 * 1024;   // per bestand; groot genoeg voor kantoorwerk
const MAX_ITEMS = 500;
const MAX_MAPPEN = 100;
const MAX_VERSIES = 10;                 // per bestand; de oudste valt eraf
const PRULLENBAK_DAGEN = 30;
const MAX_NAAM = 120;

function maakBestanden({ db, save, crypto, schoon, keyVanCodenaam, codenaamVan, sseToCustomer, dir }) {
  const OPSLAG = path.join(dir, 'bestanden');
  const id = () => 'b' + crypto.randomBytes(6).toString('hex');
  const nu = () => new Date().toISOString();

  function borden() {
    if (!db.data.bestanden || typeof db.data.bestanden !== 'object') db.data.bestanden = {};
    return db.data.bestanden;
  }
  function bord(key) {
    const alle = borden();
    const k = 'lid:' + key;
    if (!alle[k]) alle[k] = { mappen: [], items: [] };
    return alle[k];
  }
  // Over alle borden heen zoeken: nodig om een gedeeld bestand terug te vinden.
  function vind(bid) {
    for (const k of Object.keys(borden())) {
      const it = borden()[k].items.find(x => x.id === bid);
      if (it) return { eigenaar: k.replace(/^lid:/, ''), item: it, bord: borden()[k] };
    }
    return null;
  }
  function magErbij(key, v) {
    if (!v) return false;
    if (v.eigenaar === key) return true;
    const code = codenaamVan(key);
    return !!(code && (v.item.gedeeldMet || []).includes(code));
  }

  /* ---- de bytes: versleuteld wegschrijven en teruglezen ---- */
  function schrijfBytes(buf) {
    try { fs.mkdirSync(OPSLAG, { recursive: true, mode: 0o700 }); } catch (e) {}
    const naam = crypto.randomBytes(16).toString('hex') + '.bin';
    fs.writeFileSync(path.join(OPSLAG, naam), kluis.versleutelBestand(buf, naam), { mode: 0o600 });
    return naam;
  }
  function leesBytes(ref) {
    // de naam is de context: een omgewisseld blob gaat niet open
    try { const n = path.basename(String(ref || '')); return kluis.ontsleutelBestand(fs.readFileSync(path.join(OPSLAG, n)), n); }
    catch (e) { return null; }
  }
  function wisBytes(ref) {
    try { fs.unlinkSync(path.join(OPSLAG, path.basename(String(ref || '')))); } catch (e) {}
  }
  // Alle verwijzingen van een item (huidige + versies) opruimen.
  function wisItem(it) { wisBytes(it.ref); for (const v of (it.versies || [])) wisBytes(v.ref); }

  function gebruik(key) {
    let n = 0;
    for (const it of bord(key).items) { n += it.bytes || 0; for (const v of (it.versies || [])) n += v.bytes || 0; }
    return n;
  }
  const schoonNaam = n => schoon(String(n || ''), MAX_NAAM).replace(/[/\\]/g, '-').trim();

  /* ---- mappen: plat opgeslagen, genest via 'ouder' ---- */
  function mapNieuw(key, naam, ouder) {
    const b = bord(key);
    if (b.mappen.length >= MAX_MAPPEN) return { status: 409, error: 'U heeft het maximum van ' + MAX_MAPPEN + ' mappen.' };
    naam = schoonNaam(naam);
    if (!naam) return { status: 400, error: 'Geef de map een naam.' };
    ouder = String(ouder || '') || null;
    if (ouder && !b.mappen.find(m => m.id === ouder)) return { status: 404, error: 'Die bovenliggende map bestaat niet.' };
    const m = { id: id(), naam, ouder, op: nu() };
    b.mappen.push(m); save();
    return { id: m.id };
  }
  function mapWijzig(key, mid, wat) {
    const b = bord(key);
    const m = b.mappen.find(x => x.id === String(mid || ''));
    if (!m) return { status: 404, error: 'Die map bestaat niet.' };
    if (wat.naam !== undefined) { const n = schoonNaam(wat.naam); if (!n) return { status: 400, error: 'Geef de map een naam.' }; m.naam = n; }
    if (wat.weg) {
      // de inhoud verhuist netjes een niveau omhoog; er verdwijnt niets stiekem
      for (const kind of b.mappen) if (kind.ouder === m.id) kind.ouder = m.ouder;
      for (const it of b.items) if (it.map === m.id) it.map = m.ouder;
      b.mappen = b.mappen.filter(x => x.id !== m.id);
    }
    save();
    return { ok: true };
  }

  /* ---- uploaden: een data-URL in, een verwijzing terug ---- */
  function upload(key, { naam, map, dataUrl }) {
    const b = bord(key);
    if (b.items.length >= MAX_ITEMS) return { status: 409, error: 'U heeft het maximum van ' + MAX_ITEMS + ' bestanden; ruim eerst op.' };
    const m = /^data:([\w.+-]+\/[\w.+-]+);base64,([A-Za-z0-9+/=]+)$/.exec(String(dataUrl || ''));
    if (!m) return { status: 400, error: 'Dat is geen leesbaar bestand.' };
    let buf; try { buf = Buffer.from(m[2], 'base64'); } catch (e) { return { status: 400, error: 'Dat is geen leesbaar bestand.' }; }
    if (!buf.length) return { status: 400, error: 'Het bestand is leeg.' };
    if (buf.length > MAX_BESTAND) return { status: 413, error: 'Een bestand mag hooguit 15 MB zijn.' };
    if (gebruik(key) + buf.length > QUOTUM) return { status: 413, error: 'Uw kluis van 200 MB is vol; ruim eerst op (de prullenbak telt mee).' };
    naam = schoonNaam(naam);
    if (!naam) return { status: 400, error: 'Geef het bestand een naam.' };
    map = String(map || '') || null;
    if (map && !b.mappen.find(x => x.id === map)) map = null;
    const it = { id: id(), naam, map, mime: m[1], bytes: buf.length, ref: schrijfBytes(buf),
      versies: [], gedeeldMet: [], ster: false, weg: false, wegOp: null, op: nu(), gewijzigd: nu() };
    b.items.push(it); save();
    return { id: it.id, bytes: it.bytes };
  }

  function wijzig(key, bid, wat) {
    const b = bord(key);
    const it = b.items.find(x => x.id === String(bid || ''));
    if (!it) return { status: 404, error: 'Dat bestand staat niet in uw kluis.' };
    if (wat.naam !== undefined) { const n = schoonNaam(wat.naam); if (!n) return { status: 400, error: 'Geef het bestand een naam.' }; it.naam = n; }
    if (wat.map !== undefined) { const doel = String(wat.map || '') || null; it.map = doel && b.mappen.find(x => x.id === doel) ? doel : null; }
    if (wat.ster !== undefined) it.ster = !!wat.ster;
    it.gewijzigd = nu(); save();
    return { ok: true };
  }

  /* ---- de lijst: het hele bord in een keer, plus de Office-spiegel ---- */
  function lijst(key) {
    const b = bord(key);
    veegPrullenbak(b);
    const eigen = b.items.map(it => toon(it, true));
    const code = codenaamVan(key);
    const gedeeld = [];
    for (const k of Object.keys(borden())) {
      if (k === 'lid:' + key) continue;
      for (const it of borden()[k].items) {
        if (!it.weg && code && (it.gedeeldMet || []).includes(code)) gedeeld.push(toon(it, false));
      }
    }
    // RTG Office-documenten als alleen-lezen spiegel: kijken kan hier, werken doet u daar
    const office = Object.values(db.data.officeDocs || {}).filter(d => d.key === key)
      .map(d => ({ id: d.id, titel: d.titel, soort: d.soort, gewijzigd: d.gewijzigd || d.gemaakt }));
    return { mappen: b.mappen, items: eigen, gedeeld, office,
      gebruik: gebruik(key), quotum: QUOTUM };
  }
  function toon(it, vanMij) {
    return { id: it.id, naam: it.naam, map: vanMij ? it.map : null, mime: it.mime, bytes: it.bytes,
      versies: (it.versies || []).length, gedeeldMet: it.gedeeldMet || [], ster: !!it.ster,
      weg: !!it.weg, wegOp: it.wegOp || null, op: it.op, gewijzigd: it.gewijzigd, vanMij: !!vanMij };
  }
  // De prullenbak leegt zichzelf na 30 dagen; lui geveegd bij elke lijst-aanroep.
  function veegPrullenbak(b) {
    const grens = Date.now() - PRULLENBAK_DAGEN * 864e5;
    const oud = b.items.filter(it => it.weg && it.wegOp && Date.parse(it.wegOp) < grens);
    if (!oud.length) return;
    for (const it of oud) wisItem(it);
    b.items = b.items.filter(it => !oud.includes(it)); save();
  }

  const basis = { db, save, crypto, schoon, keyVanCodenaam, codenaamVan, sseToCustomer,
    bord, borden, vind, magErbij, schrijfBytes, leesBytes, wisBytes, wisItem, gebruik, nu,
    QUOTUM, MAX_BESTAND, MAX_VERSIES };
  const delen = maakBestandenDelen(basis);
  // grote bestanden komen in stukken binnen (bestanden-stukken.js) en lopen
  // aan het eind gewoon door dezelfde upload-weg, met quotum en al
  const stukken = require('./bestanden-stukken').maakStukken(basis, upload, delen.bestandenVersieNieuw);
  return Object.assign({ bestandenLijst: lijst, bestandenMapNieuw: mapNieuw, bestandenMapWijzig: mapWijzig,
    bestandenUpload: upload, bestandenWijzig: wijzig }, delen, stukken);
}

module.exports = { maakBestanden };
