#!/usr/bin/env node
/* INLINE STIJL NAAR EEN HULPKLASSE, ZONDER EEN PIXEL TE VERSCHUIVEN.

   5927 style="..."-attributen houden `style-src-attr` open in de CSP. Ze zijn
   niet in een ronde weg te werken -- 1976 unieke waarden, en de vijftig meest
   voorkomende dekken maar 31% -- maar de KOP is wel mechanisch: `flex:1` en de
   margin-top-familie zijn samen ruim twaalfhonderd attributen met precies een
   declaratie erin.

   WAT DIT SCRIPT WEL EN NIET DOET. Alleen een style-attribuut dat UIT EEN
   DECLARATIE bestaat en exact overeenkomt met een hulpklasse. `style="margin-
   top:.5rem;font-size:.8rem"` blijft staan: half omzetten is erger dan niet
   omzetten, want dan staat dezelfde regel op twee plekken.

   EN ALLEEN EEN TAG DIE OP EEN REGEL AFGEMAAKT IS. Deze markup staat in
   JS-strings die over regels aan elkaar geplakt worden; een tag waarvan het
   sluitteken op een andere regel staat, kan dit script niet veilig lezen -- het
   zou een class kunnen toevoegen aan een element dat er al een heeft, en dan
   wint de eerste en verdwijnt de marge stilzwijgend. Die slaan we over.

   WAAROM DIT GEEN GEDRAG VERANDERT, nagemeten en niet aangenomen:
     - geen enkele CSS-regel in dit huis zet margin-top of de flex-korthand met
       !important, dus de hulpklasse (die dat wel doet) kan alleen verliezen van
       iets wat er niet is;
     - de JS die margin-top of flex dynamisch zet, doet dat op elementen die hij
       zelf net heeft gemaakt (createElement) of op de panelen van de verdeler --
       nooit op markup die een style-attribuut draagt. De drie bestanden waar
       allebei in voorkomt, slaat dit script over;
     - niets in de CSS of de JS richt zich op het style-ATTRIBUUT zelf.

   WAT DIT NIET AANRAAKT: display:none. Dat wordt op 425 plekken door JS gezet,
   en een klasse met !important zou dan winnen van el.style.display. Precies het
   soort stille verandering waar dit script omheen hoort te lopen.

   Draai:  node scripts/hulpklassen-omzet.js --proef   (telt, schrijft niets)
           node scripts/hulpklassen-omzet.js           (zet om)
   ========================================================================== */
'use strict';
const fs = require('fs');
const path = require('path');

const WORTEL = path.join(__dirname, '..');
const PUB = path.join(WORTEL, 'public');

/* De hulpklasse per waarde. De sleutel is de genormaliseerde declaratie: zonder
   spaties, zonder sluitende puntkomma. `.5rem` en `0.5rem` zijn hetzelfde. */
const KLASSE = {
  'flex:1': 'h-flex1',
  'margin-top:0': 'h-mt0',
  'margin-top:0.15rem': 'h-mt15', 'margin-top:0.2rem': 'h-mt20',
  'margin-top:0.25rem': 'h-mt25', 'margin-top:0.3rem': 'h-mt30',
  'margin-top:0.35rem': 'h-mt35', 'margin-top:0.4rem': 'h-mt40',
  'margin-top:0.45rem': 'h-mt45', 'margin-top:0.5rem': 'h-mt50',
  'margin-top:0.55rem': 'h-mt55', 'margin-top:0.6rem': 'h-mt60',
  'margin-top:0.7rem': 'h-mt70', 'margin-top:0.8rem': 'h-mt80',
  'margin-top:0.9rem': 'h-mt90', 'margin-top:1rem': 'h-mt100',
  'margin-top:1.1rem': 'h-mt110', 'margin-top:1.2rem': 'h-mt120',
  'margin-top:1.4rem': 'h-mt140', 'margin-top:1.5rem': 'h-mt150'
};

/* DE KLASSE MOET ER OOK ECHT LIGGEN, EN DAT IS BIJNA MISGEGAAN.

   public/shared/rtg-hulpklassen.css wordt door EEN van de 259 pagina's geladen:
   apps/leverancier.html. Een omzetting over heel public/ zou dus op 258
   pagina's een marge weghalen en er niets voor terugzetten -- geen fout, geen
   melding, alleen opmaak die stilletjes verschuift. Precies de vorm van schade
   waar geen enkele toets in dit huis op zakt.

   Daarom rekent dit script zijn eigen bereik uit in plaats van het aan te nemen:
   een bestand doet mee als ELKE pagina die het laadt ook het stijlblad laadt.
   Voor een pagina is dat de pagina zelf; voor een script zijn dat alle pagina's
   met een scripttag erop, en voor een bundeldeel de pagina's van zijn bundel.
   Komt het stijlblad ooit ergens anders te liggen, dan groeit het bereik vanzelf
   mee -- en tot die tijd blijft de rest onaangeroerd. */
const { HULPCSS, paginaDraagt } = require('./lib/hulpcss');

function paginaBereik() {
  const { bundels } = require('./bundel');
  const deelVanBundel = new Map();          // 'apps/leverancier/leverancier-28.js' -> 'apps/leverancier.js'
  for (const [bundel, map] of Object.entries(bundels)) {
    const dir = path.join(PUB, map);
    if (!fs.existsSync(dir)) continue;
    for (const n of fs.readdirSync(dir)) if (n.endsWith('.js')) deelVanBundel.set(map + '/' + n, bundel);
  }
  const paginas = [];
  (function loop(d) {
    for (const e of fs.readdirSync(d, { withFileTypes: true })) {
      const p = path.join(d, e.name);
      if (e.isDirectory()) { if (e.name !== 'dist') loop(p); continue; }
      if (e.name.endsWith('.html')) paginas.push(p);
    }
  })(PUB);

  const gedekt = new Set(), ongedekt = new Set();
  for (const pagina of paginas) {
    const bron = fs.readFileSync(pagina, 'utf8');
    const rel = path.relative(PUB, pagina).replace(/\\/g, '/');
    const heeft = paginaDraagt(bron, pagina, PUB);
    (heeft ? gedekt : ongedekt).add(rel);
    const map = path.posix.dirname(rel);
    for (const m of bron.matchAll(/<script[^>]*\ssrc="([^"]+)"/g)) {
      const src = m[1].split('?')[0];
      const doel = src.startsWith('/') ? src.slice(1) : path.posix.normalize(path.posix.join(map, src));
      (heeft ? gedekt : ongedekt).add(doel);
      for (const [deel, bundel] of deelVanBundel) if (bundel === doel) (heeft ? gedekt : ongedekt).add(deel);
    }
  }
  /* Wie op EEN pagina zonder stijlblad staat, doet niet mee -- ook niet als hij
     daarnaast op een pagina staat die hem wel heeft. */
  for (const p of ongedekt) gedekt.delete(p);
  return gedekt;
}

/* Bestanden die margin-top OOK via JS zetten: daar zou een klasse met
   !important van el.style.marginTop kunnen winnen. Niet aankomen. */
const OVERSLAAN = new Set([
  'apps/dispatch.html', 'apps/klankwerk/zaal.js', 'apps/ov.html'
]);

function normaliseer(waarde) {
  return waarde.trim().replace(/;\s*$/, '').replace(/\s+/g, '')
    .replace(/(^|:)\.(\d)/g, '$10.$2');           // .5rem -> 0.5rem
}

/* Een tag die op deze regel begint en eindigt. Geen < of > ertussen, dus een
   tag die door een JS-plakwerk wordt afgebroken valt er vanzelf buiten. */
const TAG = /<[a-zA-Z][a-zA-Z0-9-]*\b[^<>]*>/g;

/* SCHILLEN WAAR EEN KORTHAND-MARGE MET !important OVERHEEN LIGT.

   Drie stijlbladen zetten `margin:0!important` op de schil van een scherm:
   ios.css op .ios-nav, horeca-command.css op html/body/.hq-main/.hq-top/
   .hq-stage en horeca-enterprise-modules.css op .hq-module. Een INLINE marge
   verloor daarvan (inline zonder !important verliest van !important); een
   hulpklasse mét !important zou op gelijke voet komen, en dan beslist de
   volgorde van de bladen in plaats van de bedoeling.

   Bij `.hq-module>.kaart` beschermt specificiteit ons al (twee selectoren tegen
   een klasse), maar bij `.ios-nav` is het gelijkspel. Dus laten we die
   elementen met rust in plaats van uit te rekenen wie wint. Het gaat om
   schilelementen die vrijwel nooit een losse marge dragen -- de telling
   hieronder zegt hoeveel het er werkelijk zijn. */
const SCHILKLASSEN = /\b(ios-nav|hq-main|hq-top|hq-stage|hq-module)\b/;

function zetOm(bron) {
  let raak = 0, overgeslagen = 0, schil = 0;
  const uit = bron.split('\n').map(regel => regel.replace(TAG, tag => {
    const st = /\sstyle="([^"]*)"/.exec(tag);
    if (!st) return tag;
    const klasse = KLASSE[normaliseer(st[1])];
    if (!klasse) return tag;
    if (/^<(html|body)\b/i.test(tag) || SCHILKLASSEN.test(tag)) { schil++; return tag; }
    /* Twee class-attributen op een tag is stil verlies: de browser leest de
       eerste. Kan het niet in EEN, dan doen we niets. */
    const classen = tag.match(/\sclass="[^"]*"/g) || [];
    if (classen.length > 1) { overgeslagen++; return tag; }
    let nieuw = tag.replace(st[0], '');
    if (classen.length === 1) {
      nieuw = nieuw.replace(/\sclass="([^"]*)"/, (m, c) => ' class="' + (c ? c + ' ' : '') + klasse + '"');
    } else {
      nieuw = nieuw.replace(/^<([a-zA-Z][a-zA-Z0-9-]*)/, '<$1 class="' + klasse + '"');
    }
    raak++;
    return nieuw;
  })).join('\n');
  return { uit, raak, overgeslagen, schil };
}

function bestanden() {
  const uit = [];
  (function loop(d) {
    for (const e of fs.readdirSync(d, { withFileTypes: true })) {
      const p = path.join(d, e.name);
      if (e.isDirectory()) { if (e.name !== 'dist') loop(p); continue; }
      if (/\.(html|js)$/.test(e.name)) uit.push(p);
    }
  })(PUB);
  return uit;
}

function main() {
  const proef = process.argv.includes('--proef');
  const bereik = paginaBereik();
  let totaal = 0, over = 0, geraakt = 0, buitenBereik = 0, schillen = 0;
  for (const pad of bestanden()) {
    const rel = path.relative(PUB, pad).replace(/\\/g, '/');
    if (OVERSLAAN.has(rel)) continue;
    if (!bereik.has(rel)) { buitenBereik++; continue; }
    const bron = fs.readFileSync(pad, 'utf8');
    const r = zetOm(bron);
    if (!r.raak && !r.overgeslagen && !r.schil) continue;
    totaal += r.raak; over += r.overgeslagen; schillen += r.schil;
    if (r.raak) { geraakt++; if (!proef) fs.writeFileSync(pad, r.uit); }
  }
  console.log((proef ? '[proef] ' : '') + totaal + ' attributen omgezet in ' + geraakt +
    ' bestanden; ' + over + ' overgeslagen (twee class-attributen op een tag); ' +
    buitenBereik + ' bestanden buiten bereik (hun pagina laadt ' + HULPCSS + ' niet); ' +
    schillen + ' schilelementen met rust gelaten.');
  return 0;
}

module.exports = { zetOm, normaliseer, KLASSE, paginaBereik };
if (require.main === module) process.exit(main());
