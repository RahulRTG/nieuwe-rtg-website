#!/usr/bin/env node
/* DE STAND VAN DE VRIJGAVEPOORT, per capability, op vijf assen.

   Geen tabel met de hand: iedere regel komt uit de LEVENDE evaluator
   (server/kern/vrijgave/), dezelfde die een route bij een verzoek vraagt.

   Twee manieren:
     npm run vrijgave:stand
         rekent in DIT proces, op de datamap (RTG_DATA_DIR) en de bewijsbestanden
         van deze werkboom. De bevoegdheidslaag leeft in de kern-tas van een
         draaiende server en is hier NIET gekoppeld; een capability die op een
         bevoegdheidsvermogen rust staat dan op niet-geautoriseerd, met die reden
         erbij. Dat is de veilige kant: buiten de server weten we het niet.
     npm run vrijgave:stand -- --url https://host --token <boardroomsessie>
         vraagt het aan een draaiende server (/api/office/vrijgave), met de
         bevoegdheidslaag erin. Het token komt uit de omgeving
         (RTG_VRIJGAVE_TOKEN) als het niet op de regel staat.

   AVAILABLE is hier "beschikbaar voor een rechthebbende": de actor-as hoort bij
   een verzoek en niet bij een rapport. Staat er nee, dan staat de reden erbij.
   Uitgang 2 bij een configuratiefout (onleesbaar of ongeldig standbestand of
   register): dan is alles dicht, en dat hoort een pijplijn te zien.

   DE BASELINE-KOLOM (server/kern/vrijgave/baseline.js): per capability wat de
   eigenaar voor V1 besloot (in-baseline, niet, besluit-open) en of dat in deze
   stand KLOPT. Een capability die per verzoek een provider kiest, staat in de
   baseline met de provider waarover hij beloofd is ("in-baseline via stripe"),
   en de AVAILABLE-kolom toont dan het oordeel OVER die provider.

     npm run vrijgave:stand -- --controle
         de V1-baseline in de RELEASEconfiguratie (NODE_ENV=production, wat de
         omgeving ook zegt; scripts/lib/vrijgave-baseline.js): uitgang 1 als een
         baselinecapability niet beschikbaar is of een capability buiten de
         baseline open staat. Dezelfde controle als in scripts/golive.js. */
'use strict';
const path = require('node:path');

function arg(naam) { const i = process.argv.indexOf(naam); return i > 0 ? process.argv[i + 1] : null; }

async function haal() {
  const url = arg('--url') || process.env.RTG_VRIJGAVE_URL;
  if (!url) {
    const v = require(path.join(__dirname, '..', 'server', 'kern', 'vrijgave')).standaard();
    const val = v.valideer();
    return { bron: 'dit proces (bevoegdheidslaag niet gekoppeld)', overzicht: v.overzicht(), validatie: val };
  }
  const token = arg('--token') || process.env.RTG_VRIJGAVE_TOKEN || '';
  const r = await fetch(url.replace(/\/+$/, '') + '/api/office/vrijgave', { method: 'POST',
    headers: { 'content-type': 'application/json', authorization: 'Bearer ' + token }, body: '{}' });
  if (r.status !== 200) throw new Error('de server gaf ' + r.status + ' op /api/office/vrijgave');
  const o = await r.json();
  return { bron: url, overzicht: o, validatie: { ok: !o.configuratiefout, fouten: o.configuratiefout ? [o.configuratiefout] : [] } };
}

function tabel(o) {
  const B = require(path.join(__dirname, '..', 'server', 'kern', 'vrijgave', 'baseline'));
  const ja = b => (b ? 'ja' : 'NEE');
  const rijen = [['capability', 'IMPLEMENTED', 'VERIFIED', 'AUTHORIZED', 'ENABLED', 'AVAILABLE', 'stand', 'BASELINE ' + B.NAAM, 'reden als AVAILABLE nee is']];
  const laatste = rijen[0].length - 1;
  for (const c of o.capabilities) {
    const b = B.BASELINE[c.id] || null;
    /* Voor een per-verzoek-capability in de baseline telt het oordeel OVER de
       belofte-provider; zonder provider is hij per definitie dicht. */
    const x = b && b.via && c.perProvider && c.perProvider[b.via] ? c.perProvider[b.via] : c;
    const open = x.beschikbaarVoorRechthebbende === true;
    const klopt = !b ? 'ONBEKEND' : (b.soort === 'in-baseline' ? (open ? 'klopt' : 'NIET GEHAALD') : (open ? 'OPEN TERWIJL NIET' : 'klopt'));
    rijen.push([c.id, ja(x.geimplementeerd), ja(x.geverifieerd), ja(x.geautoriseerd), ja(x.ingeschakeld), ja(open),
      (c.stand || '?') + (c.standBron === 'lokale-standaard' ? ' (lokaal)' : ''), (b ? b.soort + (b.via ? ' via ' + b.via : '') : '-') + ' (' + klopt + ')',
      open ? '' : ((x.code || c.code) + ': ' + (x.intern || c.intern))]);
  }
  const breed = rijen[0].map((_, i) => Math.max(...rijen.map(r => i === laatste ? 0 : String(r[i]).length)));
  return rijen.map(r => r.map((x, i) => i === laatste ? x : String(x).padEnd(breed[i])).join('  ')).join('\n');
}

if (require.main === module && process.argv.includes('--controle')) {
  require('./lib/vrijgave-baseline').beoordeelRelease({ url: arg('--url'), token: arg('--token') }).then(u => {
    console.log('Vrijgavepoort -- ' + (u.baseline || 'V1') + '-baseline in de releaseconfiguratie; bron: ' + (u.bron || '?'));
    for (const r of u.regels || []) console.log('  ' + (r.beschikbaar ? 'open ' : 'dicht') + '  ' + r.id.padEnd(30) + ' ' +
      String(r.baseline) + (r.via ? ' via ' + r.via : '') + (r.ontbrekendeAssen && r.ontbrekendeAssen.length && !r.beschikbaar ? '  ontbreekt: ' + r.ontbrekendeAssen.join(', ') : ''));
    if (u.ok) { console.log('\nBASELINE GEHAALD.'); return; }
    console.error('\nBASELINE NIET GEHAALD:\n  ' + u.fouten.join('\n  '));
    process.exitCode = 1;
  }).catch(e => { console.error('[vrijgave:stand --controle] ' + e.message); process.exitCode = 1; });
} else if (require.main === module) {
  haal().then(({ bron, overzicht, validatie }) => {
    console.log('Vrijgavepoort -- bron: ' + bron + ', standversie: ' + (overzicht.versie == null ? '?' : overzicht.versie));
    console.log(tabel(overzicht));
    console.log('\nBesluiten: ' + overzicht.besluiten.map(b => b.besluit + '=' + (b.vastgelegd ? 'vastgelegd' : 'ONTBREEKT')).join(', '));
    if (!validatie.ok) { console.error('\nCONFIGURATIEFOUT -- alles staat dicht:\n  ' + validatie.fouten.join('\n  ')); process.exitCode = 2; }
  }).catch(e => { console.error('[vrijgave:stand] ' + e.message); process.exitCode = 1; });
}

module.exports = { haal, tabel };
