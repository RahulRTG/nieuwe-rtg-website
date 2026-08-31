#!/usr/bin/env node
/* ============================================================================
   DE SPRONGINDEX -- waar de universele sprong (shared/sprong.js) uit put.

   WAAROM GEGENEREERD EN NIET GESCHREVEN. De sprong staat op ELKE pagina, ook
   op pagina's die app-main niet laden; hij kan dus niet bij MAPPEN. Een eigen
   lijst intypen zou een tweede waarheid maken over wat er bestaat, en dat is
   precies de fout van LAT.md regel 4 -- die het huis met de bank al een keer
   heeft gemaakt (WERELD.md, het tweede kopje "Software").

   Dus wordt deze lijst AFGELEID uit MAPPEN, via dezelfde lezer die
   test/wereldregister.test.js en scripts/wereldlijst.js gebruiken. Verandert
   MAPPEN, dan verandert de sprong mee; loopt dit bestand achter, dan zakt
   scripts/sprongindex.js --controle (en daarmee de keuring).

   WAT ER PER ITEM IN STAAT, en wat bewust niet. Naam, wereld, soort en waar de
   tik heen gaat. GEEN oordeel over uw pas: of iets premium is staat er als
   LABEL bij (net als op het huis van LivingOS), en niet als filter. Een lijst
   die dingen weglaat die u niet mag, is niet vindbaar; een lijst die belooft
   wat u niet krijgt, is een leugen. Een label is geen van beide.

   Draai: node scripts/sprongindex.js            (schrijft public/shared/sprongindex.json)
          node scripts/sprongindex.js --controle (zakt als hij achterloopt)
   ========================================================================== */
'use strict';
const fs = require('fs');
const path = require('path');
const reg = require('./lib/wereldregister');
const { vanScherm, woordenUit } = require('./lib/schermwoorden');

const DOEL = path.join(reg.WORTEL, 'public', 'shared', 'sprongindex.json');
const controle = process.argv.includes('--controle');

/* De premiumlijst uit app-main: dezelfde bron, dezelfde spelling. Vindt hij
   hem niet, dan is er GEEN label in plaats van een verzonnen label. */
function premiumSet() {
  const bron = reg.BRON;
  const m = /const PREMIUM = new Set\(\[([\s\S]*?)\]\)/.exec(bron);
  if (!m) return new Set();
  return new Set((m[1].match(/'([^']+)'/g) || []).map(s => s.slice(1, -1)));
}

/* De naam die de appcatalogus van de server aan hetzelfde adres geeft. Twee
   namen voor een ding is hier geen dubbeling maar juist de winst: allebei zijn
   het woorden waarmee een mens zoekt. */
function catalogusnamen() {
  const rijen = [].concat(require(path.join(reg.WORTEL, 'server/kern/appcatalogus-rijen/deel1')),
                          require(path.join(reg.WORTEL, 'server/kern/appcatalogus-rijen/deel2')));
  return new Map(rijen.map((r) => [r[3], r[1]]));
}

function bouw() {
  const premium = premiumSet();
  const catalogusnaam = catalogusnamen();
  const volgorde = new Map(reg.MAPPEN.map((m, i) => [m.naam, i]));
  const items = [];
  const gezien = new Set();
  for (const map of reg.MAPPEN) {
    for (const sleutel of map.items) {
      const l = reg.los(sleutel);
      if (!l || !l.naam) continue;
      if (gezien.has(sleutel)) continue;
      gezien.add(sleutel);
      const rij = { naam: l.naam, wereld: map.naam, soort: l.soort, sleutel: l.sleutel };
      /* Een link gaat naar een adres. Een tab en een os-app wonen IN de
         leden-app; die dragen geen adres maar de sleutel waarmee de app ze
         opent, zodat de sprong nooit een adres verzint dat niet bestaat. */
      if (l.soort === 'link') rij.url = l.url;
      if (premium.has(l.sleutel)) rij.label = 'Lifestyle';
      /* DE WOORDEN DIE OP HET SCHERM ZELF STAAN. Een mens typt wat hij heeft
         zien staan, niet wat wij in deze lijst hebben gezet: "pay" vond niets
         terwijl de app RTG Pay heet en de rij hier "Betalen". Ze komen uit de
         titel en de eerste kop van het scherm en uit de naam in de
         appcatalogus -- niet verzonnen, en gemeten door scripts/vindbaar.js.
         Woorden die al in de naam staan hoeven er niet bij. */
      const eigen = rij.url ? vanScherm(reg.WORTEL, rij.url) : [];
      const uitCatalogus = woordenUit(catalogusnaam.get(rij.url) || '');
      const extra = [...new Set(eigen.concat(uitCatalogus))]
        .filter((w) => rij.naam.toLowerCase().indexOf(w) < 0).slice(0, 12);
      if (extra.length) rij.woorden = extra;
      items.push(rij);
    }
    /* Het huis van de wereld zelf is ook een bestemming. */
    if (map.wereld) items.push({ naam: map.naam, wereld: map.naam, soort: 'link', sleutel: map.sleutel, url: map.wereld, huis: true });
  }
  return { uitleg: 'Gegenereerd door scripts/sprongindex.js uit MAPPEN. Bewerk dit bestand niet met de hand.',
    /* DE VOLGORDE VAN MAPPEN BLIJFT STAAN. De werelden staan in de bank in die
       volgorde, en een lijst die ze alfabetiseert zet FoundationOS boven
       LivingOS -- twee schermen die hetzelfde tonen in een andere volgorde. Op
       naam sorteren gebeurt alleen BINNEN een wereld. */
    items: items.sort((a, b) => (volgorde.get(a.wereld) - volgorde.get(b.wereld)) || a.naam.localeCompare(b.naam)) };
}

const nieuw = JSON.stringify(bouw(), null, 2) + '\n';
if (controle) {
  const oud = fs.existsSync(DOEL) ? fs.readFileSync(DOEL, 'utf8') : '';
  if (oud !== nieuw) { console.error('public/shared/sprongindex.json loopt achter op MAPPEN. Draai: npm run sprongindex'); process.exit(1); }
  console.log('sprongindex: gelijk aan MAPPEN.');
} else {
  fs.writeFileSync(DOEL, nieuw);
  console.log('public/shared/sprongindex.json geschreven (' + JSON.parse(nieuw).items.length + ' bestemmingen).');
}
