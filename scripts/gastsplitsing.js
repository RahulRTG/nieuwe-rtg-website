/* ============================================================================
   DE GAST IS TWEE MENSEN -- en wat zegt elke deur tegen welke?
   SAMENLEVING.md par. 11.1 en stap 5 van par. 12.

   `tier === 'guest'` draagt twee mensen: een BEZOEKER zonder account (de
   demo-inlog, die `geenGast()` weigert) en een RTG Community-lid MET een gratis
   account (`session.account`). De code maakt het onderscheid al -- maar alleen
   waar hij `account` leest. Deze meter loopt elke plek in server/ na die op de
   gast toetst, en zet er twee dingen naast elkaar: wat de CODE doet (maakt hij
   het onderscheid, weigert hij, of vertakt hij alleen) en wat de WEIGERING
   zegt dat er nodig is.

   DE BEVINDING DIE ERTOE DOET is een tegenspraak tussen die twee: een weigering
   die zegt dat een ACCOUNT of PROFIEL volstaat, op een plek die ook het gratis
   account weigert. Dan belooft de tekst iets wat de code niet waarmaakt, en de
   mens met een gratis account leest een weg naar binnen die er niet is.

   WAT DEZE METER NIET BESLIST. Of een deur voor een gratis account open HOORT
   te staan, is een productvraag en staat in SAMENLEVING.md en de verklaring van
   de bodem (scripts/lib/onvervreemdbaar-verklaring.js). Een weigering "voor
   leden" is hier geen fout: `leden` staat apart omdat het woord zelf
   dubbelzinnig is (een Community-lid heet ook lid), en dat is een
   formuleringsvraag, geen toegangsvraag.

   graad: `vermoed` -- de indeling is lexicaal. De dynamische kant (komt een
   gratis account er werkelijk langs?) meten `npm run onvervreemdbaar` en
   `npm run doelgroepbereik`; deze meter wijst aan WAAR je moet kijken.
   ========================================================================== */
'use strict';

const fs = require('fs');
const path = require('path');
const { zonderCommentaar } = require('./lib/bron');
const { stempel, eisSchoneBoom } = require('./lib/stempel');

const WORTEL = path.join(__dirname, '..');
const DOEL = path.join(WORTEL, 'GASTSPLITSING.json');

/* De toets op de gast, in beide richtingen en in elke schrijfwijze die het huis
   gebruikt (`req.session.tier`, `sess.tier`, `tier`, ...). */
const TOETS = /\b[\w.]*tier\s*([!=]==?)\s*'guest'|'guest'\s*([!=]==?)\s*[\w.]*tier\b/;

/* Wat een weigering zegt dat er nodig is. De volgorde telt: een tekst die een
   betalende pas noemt, is een pas-eis, ook als het woord "account" erin staat. */
const PAS = /betalend|lidmaatschap|word lid|abonnement|\bpas\b|passen\b/i;
const ACCOUNT = /account|profiel|registreer|aanmeld|inloggen|log in/i;
const ONDERSCHEID = /\baccount\b|\bidGeverifieerd\(/;
const LEDEN = /\bleden\b|\blid\b|ledendossier/i;

function bestanden(map) {
  const uit = [];
  for (const naam of fs.readdirSync(map, { withFileTypes: true })) {
    const vol = path.join(map, naam.name);
    if (naam.isDirectory()) { if (naam.name !== 'data' && naam.name !== 'node_modules') uit.push(...bestanden(vol)); }
    else if (naam.name.endsWith('.js')) uit.push(vol);
  }
  return uit.sort();
}

/* De weigertekst die bij een toets hoort: de eerste string na `error:` of in
   een `klaar(...)`, op de regel zelf of in de drie regels erna. */
function weigertekst(regels, i) {
  const stuk = regels.slice(i, i + 4).join('\n');
  const m = stuk.match(/error\s*:\s*(['"`])((?:\\.|(?!\1).)*)\1/) || stuk.match(/klaar\(\s*(['"`])((?:\\.|(?!\1).)*)\1/);
  return m ? m[2] : null;
}

function weigert(regels, i) {
  const stuk = regels.slice(i, i + 4).join('\n');
  return /status\(\s*40[13]\s*\)|status\s*:\s*40[13]|\bklaar\(|error\s*:/.test(stuk);
}

function indeling(tekst) {
  if (!tekst) return 'zonder-tekst';
  if (PAS.test(tekst)) return 'pas-eis';
  if (ACCOUNT.test(tekst)) return 'account-belofte';
  if (LEDEN.test(tekst)) return 'leden';
  return 'anders';
}

function meet() {
  const plekken = [];
  let bekeken = 0;
  for (const bestand of bestanden(path.join(WORTEL, 'server'))) {
    const ruw = fs.readFileSync(bestand, 'utf8');
    if (!/'guest'/.test(ruw)) continue;
    bekeken++;
    const regels = zonderCommentaar(ruw, { regelsHeel: true }).split('\n');
    const rel = path.relative(WORTEL, bestand).split(path.sep).join('/');
    regels.forEach((regel, i) => {
      const m = regel.match(TOETS);
      if (!m) return;
      const gelijk = (m[1] || m[2]).startsWith('=');
      /* Het onderscheid: leest DEZELFDE voorwaarde (of de regel erboven, waar
         een meerregelige voorwaarde begint) ook het account -- rechtstreeks, of
         via een poort die alleen een account kan halen (`idGeverifieerd`: RTG
         zag het paspoort, en een bezoeker heeft er geen)? */
      const omgeving = (regels[i - 1] || '') + '\n' + regel;
      const onderscheidt = ONDERSCHEID.test(omgeving);
      let soort, zegt = null;
      if (onderscheidt) soort = 'onderscheidt';
      else if (gelijk && weigert(regels, i)) { zegt = weigertekst(regels, i); soort = indeling(zegt); }
      else soort = 'vertakt';
      plekken.push({ plek: rel + ':' + (i + 1), soort, zegt });
    });
  }
  const tel = {};
  for (const p of plekken) tel[p.soort] = (tel[p.soort] || 0) + 1;
  const tegenspraak = plekken.filter(p => p.soort === 'account-belofte');
  return {
    graad: 'vermoed',
    grens: 'Lexicaal ingedeeld. Dit zegt NIET of een gratis account er werkelijk langs komt (dat meet npm run doelgroepbereik, ' +
      'met een echte gratis-accountsessie), en NIET of een deur voor een gratis account open hoort te staan -- dat is een ' +
      'productvraag (SAMENLEVING.md, de verklaring van de bodem). `leden` is geen fout: het woord is dubbelzinnig omdat een ' +
      'Community-lid ook lid heet. Een toets die het onderscheid via een andere poort maakt dan account of idGeverifieerd, ' +
      'telt hier als weigering.',
    uitleg: 'Per plek in server/ die op de gast toetst: maakt de code het onderscheid tussen bezoeker en gratis account, en wat zegt de weigering dat er nodig is. account-belofte = de tekst zegt dat een account of profiel volstaat, terwijl de code ook het gratis account weigert.',
    gemeten: {
      bestanden: bekeken,
      plekken: plekken.length,
      perSoort: tel,
      tegenspraak: tegenspraak.length
    },
    tegenspraak,
    plekken
  };
}

function toon(stand) {
  const g = stand.gemeten;
  console.log('\nDE GAST IS TWEE MENSEN -- SAMENLEVING.md stap 5\n');
  console.log('  ' + g.plekken + ' toetsen op de gast in ' + g.bestanden + ' bestanden');
  for (const [s, n] of Object.entries(g.perSoort).sort((a, b) => b[1] - a[1])) console.log('    ' + String(n).padStart(4) + '  ' + s);
  console.log('\n  --- tegenspraak: de tekst belooft een account, de code vraagt meer ---');
  for (const p of stand.tegenspraak) console.log('    ' + p.plek + '\n        "' + p.zegt + '"');
  console.log('\n  graad: ' + stand.graad + ' -- lexicaal ingedeeld; of een gratis account er werkelijk langs komt, meet npm run doelgroepbereik.\n');
}

if (require.main === module) {
  const stand = meet();
  if (process.argv.includes('--vastleggen')) {
    const poort = eisSchoneBoom('gastsplitsing');
    if (!poort.ok) { console.error('[gastsplitsing] ' + poort.reden); process.exit(2); }
    fs.writeFileSync(DOEL, JSON.stringify(Object.assign({ stempel: stempel() }, stand), null, 2) + '\n');
    console.log('GASTSPLITSING.json geschreven.');
  }
  toon(stand);
}

module.exports = { meet, indeling };
