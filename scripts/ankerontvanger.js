#!/usr/bin/env node
/* ============================================================================
   DE ANKERONTVANGER -- een REFERENTIE voor de tweede machine (audit P1-3).

   server/lib/ankerpost.js brengt het ankerblok weg naar RTG_ANKERPOST_URL en
   haalt het laatst weggebrachte terug; server/lib/ankertimer.js doet dat
   periodiek en vergelijkt eerst. Zonder iets aan de andere kant is die keten
   niet te draaien. Dit script is die andere kant, zo klein mogelijk, zodat de
   keten van begin tot eind te beproeven is. Het is NIET de bestemming zelf: die
   hoort op een andere machine, onder een ander beheer, met opslag die het
   besturingssysteem of de opslagdienst onveranderlijk houdt (WORM / Object
   Lock). Dat besluit hoort bij een mens; zie ankerpost.js punt 5.

   WAT HIJ AFDWINGT, en wat een ontvanger minimaal moet doen:
     1. ALLEEN BIJSCHRIJVEN. Het bestand wordt in append-modus geopend; er is
        geen route die iets wist of overschrijft.
     2. GEEN TERUGGANG. Een blok waarin een journaal een LAGER volgnummer heeft
        dan het laatst bewaarde, of hetzelfde nummer met een andere hash, wordt
        geweigerd (409). Zo kan een aanvaller die de kop van een journaal
        afknipte, het anker niet "bijwerken" naar zijn ingekorte stand.
     3. EEN SLEUTEL. Met RTG_ANKERPOST_SLEUTEL moet de afzender die als bearer
        meesturen. Met RTG_ANKER_PUBLIEK (base64, 32 bytes Ed25519) moet het blok
        daarmee getekend zijn; zonder die instelling wordt de sleutel van het
        EERSTE blok vastgepind en daarna geen andere meer aangenomen.
     4. HET LAATSTE TERUG. GET /anker/laatste geeft het laatst aangenomen blok,
        of 404 als er nog niets ligt -- de ankertimer leest 404 als "eerste
        ronde" en niet als storing.

   Draai: RTG_ANKER_MAP=/pad/naar/worm PORT=8443 node scripts/ankerontvanger.js
   (achter TLS; de ankerpost weigert http zonder RTG_ANKERPOST_ONVEILIG=1).
   ========================================================================== */
'use strict';

const http = require('http');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const SPKI_ED25519 = Buffer.from('302a300506032b6570032100', 'hex');

function kanoniek(v) {
  if (Array.isArray(v)) return '[' + v.map(kanoniek).join(',') + ']';
  if (v && typeof v === 'object')
    return '{' + Object.keys(v).sort().map(k => JSON.stringify(k) + ':' + kanoniek(v[k])).join(',') + '}';
  return JSON.stringify(v === undefined ? null : v);
}

function maakOntvanger({ map, sleutel, publiek } = {}) {
  if (!map) throw new Error('ankerontvanger: RTG_ANKER_MAP ontbreekt');
  fs.mkdirSync(map, { recursive: true });
  const bestand = path.join(map, 'ankers.jsonl');

  function alles() {
    let tekst = '';
    try { tekst = fs.readFileSync(bestand, 'utf8'); } catch (e) { return []; }
    return tekst.split('\n').filter(Boolean).map(r => JSON.parse(r));
  }
  const laatste = () => { const a = alles(); return a.length ? a[a.length - 1] : null; };

  function handtekeningGoed(blok, pin) {
    const h = blok && blok.handtekening;
    if (!h || h.alg !== 'ed25519') return 'het blok is niet getekend';
    const sleutelB64 = publiek || pin || h.publiek;
    if (pin && h.publiek !== pin) return 'het blok is getekend met een andere sleutel dan de vastgepinde';
    if (publiek && h.publiek !== publiek) return 'het blok is getekend met een andere sleutel dan RTG_ANKER_PUBLIEK';
    try {
      const pub = crypto.createPublicKey({ key: Buffer.concat([SPKI_ED25519, Buffer.from(sleutelB64, 'base64')]), format: 'der', type: 'spki' });
      const ok = crypto.verify(null, Buffer.from(kanoniek({ at: blok.at, punten: blok.punten, zegel: blok.zegel }), 'utf8'),
        pub, Buffer.from(h.waarde, 'base64'));
      return ok ? null : 'de handtekening klopt niet';
    } catch (e) { return 'de handtekening is onleesbaar'; }
  }

  function terugGang(oud, nieuw) {
    for (const [naam, p] of Object.entries((oud && oud.punten) || {})) {
      if (!p) continue;
      const n = nieuw.punten[naam];
      if (!n) return naam + ' ontbreekt in het nieuwe blok';
      if (Number(n.nr) < Number(p.nr)) return naam + ' gaat terug van ' + p.nr + ' naar ' + n.nr;
      if (Number(n.nr) === Number(p.nr) && n.hash !== p.hash) return naam + ' heeft op ' + p.nr + ' een andere hash';
    }
    return null;
  }

  function neemAan(lijf) {
    const blok = lijf && lijf.blok;
    if (!blok || !blok.punten || typeof blok.punten !== 'object') return { status: 400, error: 'geen ankerblok' };
    const vorige = laatste();
    const pin = vorige && vorige.blok && vorige.blok.handtekening ? vorige.blok.handtekening.publiek : null;
    const fout = handtekeningGoed(blok, pin);
    if (fout) return { status: 400, error: fout };
    const terug = vorige ? terugGang(vorige.blok, blok) : null;
    if (terug) return { status: 409, error: 'geweigerd, geen teruggang: ' + terug };
    const regel = { ontvangen: new Date().toISOString(), blok };
    const fd = fs.openSync(bestand, 'a', 0o600);           // ALLEEN bijschrijven
    try { fs.writeSync(fd, JSON.stringify(regel) + '\n'); fs.fsyncSync(fd); } finally { fs.closeSync(fd); }
    return { status: 200, ok: true, nr: alles().length };
  }

  const server = http.createServer((req, res) => {
    const stuur = (status, obj) => { res.writeHead(status, { 'content-type': 'application/json' }); res.end(JSON.stringify(obj)); };
    if (sleutel && req.headers.authorization !== 'Bearer ' + sleutel) return stuur(401, { error: 'sleutel ontbreekt of klopt niet' });
    const pad = new URL(req.url, 'http://x').pathname.replace(/\/+$/, '');
    if (req.method === 'GET' && pad.endsWith('/anker/laatste')) {
      const l = laatste();
      return l ? stuur(200, { blok: l.blok, ontvangen: l.ontvangen }) : stuur(404, { error: 'er ligt nog geen anker' });
    }
    if (req.method === 'POST' && pad.endsWith('/anker')) {
      let ruw = '';
      req.on('data', d => { ruw += d; if (ruw.length > 1e6) req.destroy(); });
      req.on('end', () => {
        let lijf; try { lijf = JSON.parse(ruw); } catch (e) { return stuur(400, { error: 'geen json' }); }
        const uit = neemAan(lijf);
        stuur(uit.status, uit);
      });
      return;
    }
    stuur(404, { error: 'onbekend' });
  });
  return { server, neemAan, laatste, bestand };
}

if (require.main === module) {
  const o = maakOntvanger({ map: process.env.RTG_ANKER_MAP, sleutel: process.env.RTG_ANKERPOST_SLEUTEL || null,
    publiek: process.env.RTG_ANKER_PUBLIEK || null });
  const poort = Number(process.env.PORT || 8443);
  o.server.listen(poort, () => console.log('[ankerontvanger] luistert op ' + poort + ', bewaart in ' + o.bestand));
}

module.exports = { maakOntvanger };
