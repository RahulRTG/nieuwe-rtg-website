/* ============================================================================
   DE BUNDEL -- een versie is een ONVERANDERLIJK pakket met een hash.

   WAAROM EEN HASH EN NIET EEN VERSIENUMMER. Een versienummer is wat een uitgever
   OPSCHRIJFT; een hash is wat er werkelijk in zit. Dit huis kiest voor de tweede
   op elke plek waar het ertoe doet, want alleen dan is de vraag "draait het lid
   nog wat wij hebben goedgekeurd" te beantwoorden in plaats van te vertrouwen.

   Die keuze levert drie dingen tegelijk op, en dat is precies waarom hij hier
   staat en niet ergens als optie:

     VEILIG   -- wat van schijf komt wordt bij ELKE lezing tegen zijn hash
                 gehouden. Een gewijzigd bestand komt er niet uit; het gaat luid
                 stuk in plaats van stil door (LAT-regel 5).
     SNEL     -- de hash staat IN het pad, dus de browser mag hem voor altijd
                 bewaren (immutable). Een tweede opening van een app is nul
                 verzoeken. Wat toch over de lijn gaat, is bij het AANNEMEN al
                 gecomprimeerd, niet per verzoek opnieuw.
     EERLIJK  -- publiceren is een hash aanwijzen, en intrekken is hem loslaten.
                 Er is geen toestand waarin "de app" iets anders is dan een
                 bepaalde, gekeurde bundel.

   WAAROM OP SCHIJF EN NIET IN DE DATABASE. db.json wordt in zijn geheel gelezen
   en geschreven; er zestig bestanden per versie in leggen maakt elke schrijfslag
   van het hele huis langzamer voor iets wat nooit hoeft te worden doorzocht.
   ========================================================================== */
'use strict';

const fs = require('fs');
const path = require('path');
const zlib = require('zlib');
const crypto = require('crypto');
const { PAD_VORM } = require('./manifest');
const { TOEGESTAAN, TEKSTSOORT } = require('./keuring');

const MAX_RUW = 3 * 1024 * 1024;  // wat een enkel bestand VOOR de keuring mag zijn
const sha = (buf) => crypto.createHash('sha256').update(buf).digest('hex');
const ext = (p) => { const i = p.lastIndexOf('.'); return i < 0 ? '' : p.slice(i).toLowerCase(); };

/* Wat er binnenkomt is JSON: [{ pad, inhoud, codering }]. `codering` is 'tekst'
   of 'base64'. Alles wat er niet als tekst uitziet (beeld, lettertype) komt als
   base64 binnen; dat is de enige vorm die door een JSON-body past. */
function neem(ruw) {
  const fouten = [];
  const uit = [];
  if (!Array.isArray(ruw) || !ruw.length) {
    return { ok: false, bestanden: [], fouten: [{ pad: null, wat: 'Er zijn geen bestanden meegestuurd. Een bundel is een lijst van { pad, inhoud, codering }.' }] };
  }
  if (ruw.length > 200) return { ok: false, bestanden: [], fouten: [{ pad: null, wat: 'Meer dan 200 bestanden wordt niet eens gelezen.' }] };

  for (const r of ruw) {
    const pad = String((r && r.pad) || '').trim();
    if (!PAD_VORM.test(pad)) {
      fouten.push({ pad, wat: 'Dit pad kan niet: kleine letters, cijfers, punt, streepje en liggend streepje, hooguit drie mappen diep, geen ".." en geen pad dat met / begint.' });
      continue;
    }
    if (!TOEGESTAAN[ext(pad)]) { fouten.push({ pad, wat: 'De soort "' + (ext(pad) || 'zonder extensie') + '" hoort niet in een bundel. Toegestaan: ' + Object.keys(TOEGESTAAN).join(' ') + '.' }); continue; }
    let buf;
    try {
      buf = String(r.codering || 'tekst') === 'base64'
        ? Buffer.from(String(r.inhoud || ''), 'base64')
        : Buffer.from(String(r.inhoud == null ? '' : r.inhoud), 'utf8');
    } catch (e) { fouten.push({ pad, wat: 'De inhoud is niet te lezen als ' + (r.codering || 'tekst') + '.' }); continue; }
    if (buf.length > MAX_RUW) { fouten.push({ pad, wat: 'Dit bestand is groter dan ' + Math.round(MAX_RUW / 1024) + ' kB en wordt niet eens gekeurd.' }); continue; }
    uit.push({ pad, buf });
  }
  if (fouten.length) return { ok: false, bestanden: [], fouten };
  return { ok: true, bestanden: uit.sort((a, b) => (a.pad < b.pad ? -1 : 1)), fouten: [] };
}

/* De hash van de hele bundel: over de paden EN de inhoud, in vaste volgorde.
   Het pad gaat mee omdat dezelfde bytes op een andere plek een andere app zijn. */
function versiehash(bestanden) {
  const regels = bestanden.map(b => b.pad + ':' + sha(b.buf)).sort();
  return sha(Buffer.from(regels.join('\n'), 'utf8')).slice(0, 32);
}

/* De schijfkant. Een versie woont in <dir>/appstore/<sleutel>/<hash>/ en draagt
   daar zijn eigen index. De index is de waarheid over wat er hoort te staan; de
   bestanden eromheen zijn wat er staat. Die twee worden bij elke lezing tegen
   elkaar gehouden. */
function maakOpslag({ dir, log }) {
  const wortel = path.join(dir, 'appstore');
  const map = (sleutel, hash) => path.join(wortel, sleutel, hash);
  const meld = (t) => { try { (log || console.warn)(t); } catch (e) {} };

  /* Een pad binnen de versiemap, en nergens anders. PAD_VORM houdt ".." al
     tegen, maar deze controle staat er omdat hij de LAATSTE is voordat er een
     bestand van schijf komt -- en de laatste controle hoort niet te vertrouwen
     op de eerste. */
  function veiligPad(sleutel, hash, pad) {
    const basis = map(sleutel, hash);
    const vol = path.resolve(basis, pad);
    return vol.startsWith(basis + path.sep) ? vol : null;
  }

  function schrijf(sleutel, hash, bestanden) {
    const basis = map(sleutel, hash);
    fs.mkdirSync(basis, { recursive: true });
    const index = {};
    for (const b of bestanden) {
      const vol = veiligPad(sleutel, hash, b.pad);
      if (!vol) throw new Error('pad buiten de versiemap: ' + b.pad);
      fs.mkdirSync(path.dirname(vol), { recursive: true });
      fs.writeFileSync(vol, b.buf);
      /* Comprimeren bij het AANNEMEN en niet per verzoek: een versie wordt een
         keer aangenomen en daarna duizenden keren gelezen. Alleen tekst, en
         alleen als het echt kleiner wordt -- een gz die groter is dan het
         origineel is twee bestanden voor niets. */
      let gz = false;
      if (TEKSTSOORT.has(ext(b.pad)) && b.buf.length > 512) {
        const p = zlib.gzipSync(b.buf, { level: 9 });
        if (p.length < b.buf.length * 0.9) { fs.writeFileSync(vol + '.gz', p); gz = true; }
      }
      index[b.pad] = { sha256: sha(b.buf), bytes: b.buf.length, gz };
    }
    fs.writeFileSync(path.join(basis, 'bundel.json'), JSON.stringify({ sleutel, hash, bestanden: index }, null, 1));
    return index;
  }

  function indexVan(sleutel, hash) {
    try { return JSON.parse(fs.readFileSync(path.join(map(sleutel, hash), 'bundel.json'), 'utf8')).bestanden || null; }
    catch (e) { return null; }
  }

  /* Lezen MET integriteitscontrole. Klopt de hash niet, dan komt er niets uit en
     staat het luid in het log: dit is het ene geval waarin stil doorgaan zou
     betekenen dat een lid ongekeurde code draait. */
  function lees(sleutel, hash, pad, magGz) {
    const index = indexVan(sleutel, hash);
    if (!index) return null;
    const regel = Object.prototype.hasOwnProperty.call(index, pad) ? index[pad] : null;
    if (!regel) return null;
    const vol = veiligPad(sleutel, hash, pad);
    if (!vol) return null;
    let buf;
    try { buf = fs.readFileSync(vol); } catch (e) { meld('[appstore] bestand weg uit een gepubliceerde versie: ' + sleutel + '/' + hash + '/' + pad); return null; }
    if (sha(buf) !== regel.sha256) {
      meld('[appstore] INTEGRITEIT: ' + sleutel + '/' + hash + '/' + pad + ' wijkt af van wat er is goedgekeurd. Niet uitgeleverd.');
      return null;
    }
    if (magGz && regel.gz) {
      try {
        const p = fs.readFileSync(vol + '.gz');
        return { buf: p, gz: true, mime: TOEGESTAAN[ext(pad)] || 'application/octet-stream', bytes: regel.bytes };
      } catch (e) { /* de gz is een kopie; ontbreekt hij, dan gaat het origineel */ }
    }
    return { buf, gz: false, mime: TOEGESTAAN[ext(pad)] || 'application/octet-stream', bytes: regel.bytes };
  }

  function weg(sleutel, hash) {
    try { fs.rmSync(map(sleutel, hash), { recursive: true, force: true }); return true; }
    catch (e) { meld('[appstore] kon versiemap niet opruimen: ' + sleutel + '/' + hash); return false; }
  }

  return { schrijf, lees, weg, indexVan, bestaat: (s, h) => !!indexVan(s, h) };
}

module.exports = { neem, versiehash, maakOpslag, sha, ext, MAX_RUW };
