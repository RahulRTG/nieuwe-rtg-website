/* ============================================================================
   DE BESTEMMINGEN van een anker -- plekken BUITEN de PostgreSQL-trustgrens.

   Een anker in dezelfde database is een tweede regel om te wijzigen (zie
   lib/keten-anker.js). Daarom schrijft het auditboek zijn anker naar een
   `sink`: iets waar de beheerder van de database niet bij kan. Twee soorten:

     mapSink   een map die als write-once bestemming is gemount (een offsite
               share, een WORM-volume, een object-lock mount). Elk anker is een
               EIGEN bestand dat met `wx` wordt aangemaakt en daarna alleen-lezen
               is: een tweede schrijfpoging voor hetzelfde volgnummer faalt,
               tenzij de bytes identiek zijn.
     httpSink  een HTTPS-dienst met POST (toevoegen) en GET (alles teruglezen),
               bedoeld voor een transparantielogboek of object-lock-opslag.

   WAT DEZE LAAG NIET KAN. Ze kan niet vaststellen dat een map echt ver van de
   database ligt of dat de dienst echt niets kan overschrijven. Dat is een
   inrichtingsvraag; AUDITBOEK.md zegt welke eigenschappen de eigenaar moet
   garanderen. Wel dwingt de verificatie af dat het ANKER zelf niet te vervalsen
   valt (handtekening met een sleutel die niet in de database staat) en dat een
   sink die iets kwijtraakt wordt gezien (twee sinks vergelijken elkaar).
   ========================================================================== */
'use strict';
const fs = require('fs');
const path = require('path');
const { kanoniek } = require('./regel');

const BESTAND = /^anker-(\d{12})\.json$/;
const naam = nr => 'anker-' + String(nr).padStart(12, '0') + '.json';

function mapSink(dir) {
  return {
    soort: 'map', naam: 'map:' + path.basename(dir),
    async append(v) {
      fs.mkdirSync(dir, { recursive: true, mode: 0o750 });
      const doel = path.join(dir, naam(v.ankerNr));
      const bytes = kanoniek(v) + '\n';
      let fd;
      try { fd = fs.openSync(doel, 'wx', 0o444); }
      catch (e) {
        if (e.code !== 'EEXIST') throw e;
        if (fs.readFileSync(doel, 'utf8') === bytes) return 'bestond-al:' + naam(v.ankerNr);
        throw Object.assign(new Error('anker ' + v.ankerNr + ' bestaat al met andere inhoud'), { code: 'ANKER_BOTSING' });
      }
      try { fs.writeSync(fd, bytes); fs.fsyncSync(fd); } finally { fs.closeSync(fd); }
      try { const d = fs.openSync(dir, 'r'); try { fs.fsyncSync(d); } finally { fs.closeSync(d); } } catch (e) { /* map-fsync is best-effort */ }
      return naam(v.ankerNr);
    },
    async list() {
      let namen;
      try { namen = fs.readdirSync(dir); } catch (e) { if (e.code === 'ENOENT') return []; throw e; }
      return namen.filter(n => BESTAND.test(n)).sort().map(n => {
        const v = JSON.parse(fs.readFileSync(path.join(dir, n), 'utf8'));
        if (naam(v.ankerNr) !== n) throw Object.assign(new Error('bestandsnaam wijkt af van inhoud: ' + n), { code: 'ANKER_ONGELDIG' });
        return v;
      });
    }
  };
}

function httpSink(url, { token, timeoutMs = 5000 } = {}) {
  if (!/^https:\/\//.test(url) && !/^http:\/\/(127\.0\.0\.1|localhost)(:|\/)/.test(url))
    throw new Error('Een anker-sink gaat alleen over https (of loopback voor een toets).');
  const kop = { 'Content-Type': 'application/json', ...(token ? { Authorization: 'Bearer ' + token } : {}) };
  const vraag = async (opties) => {
    const ac = new AbortController(); const t = setTimeout(() => ac.abort(), timeoutMs);
    try { return await fetch(url, { ...opties, headers: kop, signal: ac.signal }); } finally { clearTimeout(t); }
  };
  return {
    soort: 'http', naam: 'http:' + new URL(url).host,
    async append(v) {
      const r = await vraag({ method: 'POST', body: kanoniek(v) });
      if (r.status !== 200 && r.status !== 201) throw new Error('anker-sink antwoordde ' + r.status);
      const j = await r.json().catch(() => ({}));
      if (typeof j.ontvangst !== 'string' || !j.ontvangst) throw new Error('anker-sink gaf geen ontvangstbewijs');
      return j.ontvangst;
    },
    async list() {
      const r = await vraag({ method: 'GET' });
      if (r.status !== 200) throw new Error('anker-sink antwoordde ' + r.status);
      const j = await r.json();
      if (!Array.isArray(j.verklaringen)) throw new Error('anker-sink gaf geen lijst');
      return j.verklaringen;
    }
  };
}

/* Alleen voor toetsen: een sink in het geheugen die een storing kan spelen. */
function geheugenSink(naamTekst = 'geheugen') {
  const opslag = new Map();
  const s = { soort: 'geheugen', naam: naamTekst, kapot: false, opslag,
    async append(v) {
      if (s.kapot) throw new Error('sink onbeschikbaar');
      const b = kanoniek(v), oud = opslag.get(v.ankerNr);
      if (oud && oud !== b) throw Object.assign(new Error('anker bestaat al'), { code: 'ANKER_BOTSING' });
      opslag.set(v.ankerNr, b); return 'mem:' + v.ankerNr;
    },
    async list() { if (s.kapot) throw new Error('sink onbeschikbaar'); return [...opslag.entries()].sort((a, b) => a[0] - b[0]).map(([, b]) => JSON.parse(b)); }
  };
  return s;
}

/* Sinks uit de omgeving. Geen enkele = leeg; de aanroeper beslist wat dat betekent. */
function sinksUitOmgeving(env = process.env) {
  const uit = [];
  for (const d of String(env.RTG_AUDIT_ANKER_DIRS || '').split(',').map(x => x.trim()).filter(Boolean)) uit.push(mapSink(d));
  for (const u of String(env.RTG_AUDIT_ANKER_URLS || '').split(',').map(x => x.trim()).filter(Boolean))
    uit.push(httpSink(u, { token: env.RTG_AUDIT_ANKER_TOKEN || '' }));
  return uit;
}

module.exports = { mapSink, httpSink, geheugenSink, sinksUitOmgeving, naam };
