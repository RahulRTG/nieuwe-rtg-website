#!/usr/bin/env node
/* ============================================================================
   RTG DEV -- je app in een echte cel, op je eigen machine.

   DE REDEN DAT DIT TE VERTROUWEN IS: hij bouwt niets na.

     de brug      kern/appstore/brug.js        -- de ECHTE, met de echte grenzen
     de CSP       kern/appstore/brugklant.js   -- dezelfde die de cel zet
     de brugklant kern/appstore/brugklant.js   -- hetzelfde script, geinjecteerd
     de poort     kern/appstore/keuring.js     -- via `rtg check`

   Een emulator die de regels NABOUWT, liegt vroeg of laat over precies de grens
   waarop een app stukloopt: 32 sleutels, 4 kB per waarde, 64 kB totaal, vijf
   berichten per dag, 120 aanroepen per minuut. Die getallen staan hier nergens
   -- ze komen uit `brug.GRENS`, omdat de echte brug hier draait op een opslag in
   het geheugen.

   DE TWEEDE REGEL, EN DIE IS NET ZO BELANGRIJK: hij doet nooit alsof een
   capability bestaat die er niet is. `RTG.roep('bericht.push')` weigert hier met
   dezelfde tekst als in productie, inclusief de reden en het alternatief. Een
   emulator die behulpzaam meedoet met iets wat straks weigert, is de duurste
   vorm van behulpzaamheid die er is.

   WAT ER SYNTHETISCH IS, en dat staat op het scherm zodat niemand het vergeet:
   het lid (een codenaam, een taal, een pas), de opslag (leeg bij elke start) en
   de verlening (jij zet de vinkjes). Verder niets.

   Draai: rtg dev [map] [--poort 4321]
   ========================================================================== */
'use strict';
const fs = require('fs');
const http = require('http');
const path = require('path');

const WORTEL = path.join(__dirname, '..');
const { maakBrug } = require(path.join(WORTEL, 'server/kern/appstore/brug'));
const { BRUGKLANT, celCsp, metBrug } = require(path.join(WORTEL, 'server/kern/appstore/brugklant'));
const { MACHTIGINGEN, NIET_GEBOUWD, toonbaar } = require(path.join(WORTEL, 'server/kern/appstore/machtigingen'));
const { TOEGESTAAN } = require(path.join(WORTEL, 'server/kern/appstore/keuring'));
const manifestLezer = require(path.join(WORTEL, 'server/kern/appstore/manifest'));

const esc = (t) => String(t == null ? '' : t).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

/* Het synthetische lid. Drie waarden, en meer krijgt een app ook in productie
   niet (machtigingen.js, profiel.basis). Ze staan hier zodat een ontwikkelaar
   kan zien dat er niets anders in zit -- geen naam, geen e-mail, geen id. */
const LID = { key: 'dev-lid', codenaam: 'Havik', taal: 'nl', pas: 'lifestyle' };

module.exports = function dev(argv, hulp) {
  const map = path.resolve(argv.find(a => !a.startsWith('--')) || '.');
  const poortArg = argv.find(a => a.startsWith('--poort'));
  const poort = Number((poortArg || '').split('=')[1] || argv[argv.indexOf('--poort') + 1] || 4321) || 4321;

  const g = hulp.leesBundel(map);
  if (g.error) { console.error(g.error); return 2; }
  const m = manifestLezer.lees(g.manifest);
  if (!m.ok) {
    console.error('\n  Het manifest klopt nog niet; draai `rtg check` voor de details.\n');
    for (const f of m.fouten) console.error('    ' + f.veld + ': ' + f.wat);
    console.error('');
    return 1;
  }
  const manifest = m.manifest;

  /* De opslag van de echte brug, in het geheugen. Leeg bij elke start, en dat is
     met opzet: een ontwikkelaar hoort te zien wat er gebeurt bij een lid dat
     zijn app voor het eerst opent. */
  const staat = { opslag: {}, bakjes: {} };
  const brug = maakBrug({
    S: () => staat, save() {}, boek() {},
    nu: () => new Date().toISOString(), eigen: (o, k) => o[k]
  });

  /* Wat het synthetische lid heeft verleend. Begint met alles wat het manifest
     vraagt -- want dat is het geval dat een ontwikkelaar het vaakst wil zien --
     en is per machtiging uit te zetten. Juist dat uitzetten is waar dit
     gereedschap voor is: de weg waarop een app weigert, is de weg die niemand
     test. */
  let verleend = manifest.machtigingen.slice();

  const bestandVan = (pad) => g.bestanden.find(b => b.pad === pad);
  const bufVan = (b) => Buffer.from(b.inhoud, b.codering === 'base64' ? 'base64' : 'utf8');

  const server = http.createServer((req, res) => {
    const u = new URL(req.url, 'http://localhost:' + poort);
    const pad = u.pathname;
    const herkomst = 'http://localhost:' + poort;

    const stuur = (status, type, body, koppen) => {
      res.writeHead(status, Object.assign({ 'Content-Type': type }, koppen || {}));
      res.end(body);
    };
    const json = (status, o) => stuur(status, 'application/json; charset=utf-8', JSON.stringify(o));

    // ---- de brug: dezelfde aanroep als /api/appstore/brug in productie ----
    if (req.method === 'POST' && pad === '/api/brug') {
      let body = '';
      req.on('data', (c) => { body += c; if (body.length > 65536) req.destroy(); });
      req.on('end', () => {
        let d = {};
        try { d = JSON.parse(body || '{}'); } catch (e) { return json(400, { error: 'geen geldige JSON' }); }
        const r = brug.roep({
          key: LID.key, sleutel: manifest.sleutel, methode: d.methode, args: d.args,
          codenaam: LID.codenaam, taal: LID.taal, pas: LID.pas,
          verleend, vraagt: manifest.machtigingen
        });
        const merk = r.status >= 400 ? '\x1b[31m' + r.code + '\x1b[0m' : '\x1b[32mok\x1b[0m';
        console.log('  ' + merk + '  ' + String(d.methode) + (r.status >= 400 ? '  ' + r.error : ''));
        json(r.status || 200, r);
      });
      return;
    }

    // ---- de machtigingenschakelaar ----
    if (req.method === 'POST' && pad === '/api/verleen') {
      let body = '';
      req.on('data', (c) => { body += c; });
      req.on('end', () => {
        let d = {};
        try { d = JSON.parse(body || '{}'); } catch (e) { return json(400, { error: 'geen geldige JSON' }); }
        const id = String(d.id || '');
        if (!manifest.machtigingen.includes(id)) return json(400, { error: 'je app vraagt deze machtiging niet' });
        verleend = d.aan ? [...new Set(verleend.concat([id]))] : verleend.filter(x => x !== id);
        console.log('  \x1b[33mverlening\x1b[0m  ' + id + ' staat nu ' + (d.aan ? 'AAN' : 'UIT'));
        json(200, { verleend });
      });
      return;
    }

    // ---- de brugklant: hetzelfde script als in de cel ----
    if (pad === '/appcel/brug.js') {
      return stuur(200, 'text/javascript', BRUGKLANT, {
        'Content-Security-Policy': celCsp(herkomst),
        'Cross-Origin-Resource-Policy': 'cross-origin'
      });
    }

    // ---- de cel: de bundel zelf, met de echte CSP ----
    if (pad.startsWith('/cel/')) {
      const binnen = decodeURIComponent(pad.slice(5)) || manifest.start;
      const b = bestandVan(binnen);
      if (!b) return stuur(404, 'text/plain; charset=utf-8', 'Dit bestand zit niet in je bundel: ' + binnen);
      const ext = path.extname(binnen).toLowerCase();
      const koppen = {
        'Content-Security-Policy': celCsp(herkomst),
        'Cross-Origin-Resource-Policy': 'cross-origin',
        'X-Content-Type-Options': 'nosniff',
        'Referrer-Policy': 'no-referrer',
        'Cache-Control': 'no-store'          // anders zie je je eigen wijziging niet
      };
      if (ext !== '.html') return stuur(200, TOEGESTAAN[ext] || 'application/octet-stream', bufVan(b), koppen);
      return stuur(200, 'text/html; charset=utf-8', metBrug(bufVan(b).toString('utf8')), koppen);
    }

    /* ---- de gastheer: de RTG-kant, zoals /apps/appcel.html ----
       `?start=` wijst het kader naar een ANDERE pagina uit dezelfde bundel. Dat
       is er voor `rtg a11y`, die elke HTML in de bundel wil meten en niet alleen
       de startpagina -- een tweede scherm heeft dezelfde knoppen en velden, en
       die zijn anders nooit gemeten. Alleen paden die echt in de bundel zitten:
       anders is dit een open deur naar een willekeurig bestand. */
    if (pad === '/' || pad === '/index.html') {
      const gevraagd = u.searchParams.get('start');
      const start = gevraagd && bestandVan(gevraagd) && gevraagd.endsWith('.html') ? gevraagd : manifest.start;
      return stuur(200, 'text/html; charset=utf-8', gastheer(start));
    }
    stuur(404, 'text/plain; charset=utf-8', 'niets hier');
  });

  /* De gastheerpagina. Hij doet precies wat appcel.html doet -- een iframe met
     `sandbox="allow-scripts"` en niets erbij, en een brug die postMessage naar
     een aanroep vertaalt -- plus de twee dingen die alleen hier bestaan: de
     schakelaars en het venster waarin je ziet wat er over de brug ging. */
  function gastheer(start) {
    const rijen = toonbaar(manifest.machtigingen, manifest.doelen).map(m => `
      <label class="m"><input type="checkbox" data-id="${esc(m.id)}" checked>
        <span><b>${esc(m.label)}</b>
        ${m.waarvoor ? '<i>waarvoor: ' + esc(m.waarvoor) + '</i>' : ''}
        <i>geeft: ${esc(m.geeft)}</i>
        <i class="nooit">nooit: ${esc(m.nooit)}</i></span></label>`).join('');
    const nietRijen = Object.entries(NIET_GEBOUWD).map(([k, v]) =>
      `<li><b>${esc(k)}</b> ${esc(v)}</li>`).join('');
    return `<!doctype html><html lang="nl"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>${esc(manifest.naam)} · rtg dev</title>
<style>
 :root{color-scheme:dark;--l:#2a2a28;--g:#8A8680;--goud:#A98F1C;}
 *{box-sizing:border-box;margin:0;padding:0}
 body{background:#0C0C0B;color:#fff;font:14px/1.5 system-ui,sans-serif;display:grid;grid-template-columns:1fr 22rem;height:100vh}
 .doek{display:flex;flex-direction:column;border-right:1px solid var(--l)}
 .kop{padding:.7rem 1rem;border-bottom:1px solid var(--l);display:flex;gap:.6rem;align-items:baseline}
 .kop b{font-weight:600}.kop span{color:var(--g);font-size:.8rem}
 iframe{flex:1;border:0;background:#fff;width:100%}
 aside{overflow:auto;padding:1rem;display:flex;flex-direction:column;gap:1.2rem}
 h2{font-size:.62rem;letter-spacing:.22em;text-transform:uppercase;color:var(--goud);font-weight:600}
 .m{display:flex;gap:.5rem;align-items:flex-start;padding:.45rem 0;border-bottom:1px solid var(--l);cursor:pointer}
 .m i{display:block;color:var(--g);font-style:normal;font-size:.74rem}
 .m .nooit{color:#C23A5E}
 .lid{color:var(--g);font-size:.8rem}.lid b{color:#fff}
 ul{list-style:none;font-size:.74rem;color:var(--g)}li{padding:.3rem 0;border-bottom:1px solid var(--l)}li b{color:#fff}
 #log{font:11px/1.45 ui-monospace,monospace;background:#000;border:1px solid var(--l);border-radius:6px;padding:.5rem;max-height:16rem;overflow:auto;white-space:pre-wrap}
 .ok{color:#4C9A75}.nee{color:#C23A5E}
 .let{font-size:.72rem;color:var(--g);border-left:2px solid var(--goud);padding-left:.6rem}
</style></head><body>
<div class="doek">
  <div class="kop"><b>${esc(manifest.naam)}</b><span>${esc(manifest.sleutel)} ${esc(manifest.versie)}</span>
    <span style="margin-left:auto">cel · geen netwerk · naamloze herkomst</span></div>
  <iframe id="cel" sandbox="allow-scripts" allow="" src="/cel/${esc(start || manifest.start)}" title="${esc(manifest.naam)}"></iframe>
</div>
<aside>
  <div><h2>Synthetisch lid</h2><p class="lid">codenaam <b>${esc(LID.codenaam)}</b> · taal ${esc(LID.taal)} · pas ${esc(LID.pas)}</p>
  <p class="let">Dit is alles wat een app van derden over een mens te zien krijgt. Geen naam, geen e-mail, geen adres — ook niet hier.</p></div>
  <div><h2>Wat het lid verleent</h2>${rijen || '<p class="lid">Je app vraagt niets.</p>'}
  <p class="let">Zet er een uit en kijk wat je app doet. Dat is de weg die niemand test.</p></div>
  <div><h2>Wat er bewust niet is</h2><ul>${nietRijen}</ul></div>
  <div><h2>Over de brug</h2><div id="log"></div></div>
</aside>
<script>
const cel = document.getElementById('cel'), log = document.getElementById('log');
function regel(k, t){ const d=document.createElement('div'); d.className=k; d.textContent=t; log.prepend(d); }
window.addEventListener('message', async (e) => {
  if (e.source !== cel.contentWindow) return;
  const d = e.data; if (!d || d.rtgcel !== 1 || typeof d.nr !== 'number') return;
  const stuur = (o) => cel.contentWindow.postMessage(Object.assign({rtgcel:1,nr:d.nr},o),'*');
  regel('', '→ ' + d.methode + ' ' + JSON.stringify(d.args||{}));
  try {
    const r = await fetch('/api/brug',{method:'POST',headers:{'Content-Type':'application/json'},
      body: JSON.stringify({methode:d.methode,args:d.args})}).then(x=>x.json());
    if (r.error) { regel('nee','← ' + r.code + '  ' + r.error + (r.hoe ? '\\n   ' + r.hoe : '')); stuur({fout:r}); }
    else { regel('ok','← ' + JSON.stringify(r.uit)); stuur({uit:r.uit}); }
  } catch (err) { regel('nee','← ' + err.message); stuur({fout:{error:err.message}}); }
});
document.querySelectorAll('input[data-id]').forEach(v => v.addEventListener('change', async () => {
  await fetch('/api/verleen',{method:'POST',headers:{'Content-Type':'application/json'},
    body: JSON.stringify({id:v.dataset.id, aan:v.checked})});
  regel('', (v.checked?'+ ':'- ') + v.dataset.id);
}));
</script></body></html>`;
  }

  server.listen(poort, () => {
    /* `stil` is er voor rtg a11y, die deze server als motor gebruikt: die wil
       zijn eigen uitslag tonen en niet de opstartregels van een ander gereedschap
       ertussen. Onderdrukken door de aanroeper werkt hier niet -- dit blok draait
       pas als listen() klaar is, dus nadat die zijn console weer heeft teruggezet. */
    if (hulp && hulp.stil) return;
    const G = brug.GRENS;
    console.log('\n  \x1b[1m' + manifest.naam + '\x1b[0m  \x1b[90m' + manifest.sleutel + ' ' + manifest.versie + '\x1b[0m');
    console.log('  \x1b[90mdraait op\x1b[0m  http://localhost:' + poort + '\n');
    console.log('  \x1b[32m✓\x1b[0m de echte brug        \x1b[90m' + brug.METHODES.length + ' methodes\x1b[0m');
    console.log('  \x1b[32m✓\x1b[0m de echte grenzen     \x1b[90m' + G.opslagSleutels + ' sleutels, ' + Math.round(G.opslagTotaal / 1024)
      + ' kB opslag, ' + G.berichtenPerDag + ' berichten/dag, ' + G.roepenPerMinuut + ' aanroepen/min\x1b[0m');
    console.log('  \x1b[32m✓\x1b[0m de echte CSP         \x1b[90mconnect-src \'none\', sandbox allow-scripts\x1b[0m');
    console.log('  \x1b[32m✓\x1b[0m synthetisch lid      \x1b[90mcodenaam ' + LID.codenaam + ', verder niets\x1b[0m');
    console.log('  \x1b[32m✓\x1b[0m eigen opslag         \x1b[90mleeg bij elke start\x1b[0m');
    console.log('\n  \x1b[90mWat hier weigert, weigert straks ook -- en met dezelfde tekst.\x1b[0m\n');
  });
  server.on('error', (e) => {
    console.error(e.code === 'EADDRINUSE'
      ? '  Poort ' + poort + ' is bezet. Kies een andere met --poort.'
      : '  ' + e.message);
    process.exit(2);
  });
  return server;
};
