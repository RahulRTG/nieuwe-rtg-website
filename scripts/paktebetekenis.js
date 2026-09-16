/* WELKE BETEKENISSEN PERST `pakte` SAMEN?

   DE AANLEIDING. KETENBEREIK.json liet zien dat /api/fluister MET een model
   niets van de uitvoeringsmachine raakt en ZONDER model wel. De poort ertussen
   is een boolean: `if (stuurLus && (!r.pakte || r.stuurMagKijken))` in
   server/routes/member/persoonlijk-rahul.js. Alles hangt dus aan de vraag wat
   `pakte` op elke schrijfplek BETEKENT -- en dat is nooit vastgesteld.

   WAT DEZE METER NIET DOET: hij repareert niets en stelt geen nieuwe namen
   voor. Hij stelt vast hoeveel ONDERSCHEIDEN uitkomsten er vandaag onder
   dezelfde `pakte: true` vallen. Pas met dat getal is splitsen een besluit in
   plaats van een gevoel.

   ZES LAGEN, en per laag staat erbij HOE hij is waargenomen -- want een laag
   die je afleidt uit een andere laag telt niet mee als bewijs:

     TAAL_BEGREPEN        de zin kwam niet op de algemene terugval uit.
                          AFGELEID (uit de antwoordtekst), dus graad `vermoed`.
     ANTWOORD_GEMAAKT     er staat tekst in het antwoord. GEMETEN.
     PLAN_GEMAAKT         `voorstel` staat aan: er wacht iets op "ja". GEMETEN.
     UITVOERING_GESTART   `gedaan` staat aan. GEMETEN -- maar dat is wat de
                          ROUTE zegt, niet wat de opslag zag; vandaar de volgende.
     EFFECT_BEREIKT       de kop X-RTG-Effect (server/effectmeter.js) telde een
                          schrijfactie op het ene choke point. GEMETEN.
     NACONTROLE_GESLAAGD  de schakel `nacontrole` is aangeraakt, gezien door
                          scripts/lib/ketenspoor.js. GEMETEN.

   DE VALKUIL DIE DEZE METER ZELF MOEST LEREN: `klaar()` in kern/fluister/
   gesprek.js roept save() aan voor het gespreksgeheugen. ELK antwoord schrijft
   dus, ook een kale helptekst. `opslag > 0` betekent hier daarom niet "er is
   iets gebeurd" -- en dat is geen tekort van de meter maar een eigenschap van
   de route. De uitslag draagt daarom BEIDE: het rauwe getal en het verschil met
   de ijkzin, met de reden erbij.

   Draai: npm run paktebetekenis        (meet en rapporteert)
          npm run paktebetekenis:vast   (schrijft PAKTEBETEKENIS.json) */
'use strict';

const fs = require('fs');
const os = require('os');
const path = require('path');
const W = require('./lib/ketenwereld');
const { stempel } = require('./lib/stempel');

const DOEL = path.join(W.WORTEL, 'PAKTEBETEKENIS.json');

/* De ijkzin: zo nietszeggend mogelijk, zodat hij gegarandeerd op de algemene
   terugval uitkomt (gesprek.js regel 135, de enige plek met `pakte = false`).
   Zijn opslagtelling is de VLOER: wat elk antwoord sowieso wegschrijft. */
const IJKZIN = 'zzq onbestaanbare wartaal zzq';

/* Per geval: welke schrijfplek van `pakte` hij hoort te raken. De verwijzing is
   geen versiering -- zonder die kolom is niet na te gaan of het corpus de
   schrijfplekken werkelijk dekt, en dan meet je een steekproef die je voor een
   inventaris aanziet. */
const CORPUS = [
  { id: 'ijk0', zin: IJKZIN, plek: 'basislijn: alleen om de beginstand vast te leggen' },
  { id: 'ijk', zin: IJKZIN, plek: 'gesprek.js: r.pakte = false (algemene terugval)' },
  { id: 'onthoud', zin: 'onthoud dat ik van sushi hou', plek: 'gesprek.js: geleerd, pakte: true' },
  { id: 'watweetje', zin: 'wat weet je over mij', plek: 'gesprek.js: pakte: true (opsomming)' },
  { id: 'watkunje', zin: 'wat kun je', plek: 'gesprek.js: pakte: true (helptekst)' },
  { id: 'sparren', zin: 'spar even met me over mijn idee voor een nieuwe dienst', plek: 'gesprek.js: klaar(...) in sparmodus' },
  { id: 'zoeken', zin: 'zoek sushi', plek: 'intent.js -> bevestig.zoek, via klaar()' },
  { id: 'bestellen', zin: 'bestel 2 sangria bij Sunset Ibiza', plek: 'intent.js -> betalen.bestel, drempel -> voorstel' },
  { id: 'bevestig', zin: 'ja', plek: 'intent.js -> bevestig.ja (voert het voorstel uit)' },
  { id: 'stand', zin: 'hoe staat het ervoor', plek: 'gesprek.js: klaar(stand/seintjes)' },
  { id: 'vergeet', zin: 'vergeet alles', plek: 'gesprek.js: geleerd, pakte: true (wist alles)' }
];

/* De zes lagen van EEN waarneming. `null` betekent niet waargenomen en nooit
   `false` -- dat verschil is de hele reden dat deze meter bestaat. */
function lagen(w, basislijn) {
  const lijf = w.lijf || {};
  const effect = ontleedEffect(w.effectKop);
  /* EFFECT_BEREIKT OP NAAM EN NIET OP EEN GETAL, en dat is een reparatie van
     deze meter zelf. De eerste versie trok een opslagVLOER af (wat een kaal
     antwoord kost) en noemde de rest effect. Dat was fout: `wat weet je over
     mij` keert terug zonder klaar() en schrijft dus MINDER dan de ijkzin, en
     `onthoud` schrijft er precies evenveel terwijl het een weetje vastlegt. Een
     basislijn die per codepad verschilt, is geen basislijn.

     Nu: welke COLLECTIES veranderden (X-RTG-Staat, stand 2 met een hash per
     collectie), min de collecties die ook bij een kaal antwoord bewegen. Die
     laatste staan bij NAAM in `basislijn` -- na te trekken, in tegenstelling
     tot een afgetrokken getal. */
  const eigen = w.veranderd === null ? null : w.veranderd.filter(c => !basislijn.includes(c));
  /* DRIE UITKOMSTEN EN GEEN TWEE, en die derde is door het meten afgedwongen.
     `fluister` is EEN collectie die zowel het gespreksgeheugen als de weetjes
     van het lid draagt. Op collectieniveau is "ik heb deze beurt onthouden"
     dus niet te onderscheiden van "ik heb jouw weetje opgeslagen" of "ik heb
     al je gegevens gewist" -- alle drie bewegen `fluister` en verder niets.

     `false` daarop zetten zou een bewering zijn die de meting niet draagt, en
     wel in het voordeel van het huis. Veranderde er ALLEEN iets binnen de
     basislijn, dan is de uitslag `null` (onbepaald) met de collecties erbij.
     Alleen wie er een fijner instrument onder legt, mag daar `false` van maken. */
  const binnenBasislijn = w.veranderd === null ? null
    : w.veranderd.filter(c => basislijn.includes(c));
  const effectBereikt = eigen === null ? null
    : (eigen.length > 0 ? true : (binnenBasislijn.length > 0 ? null : false));
  return {
    TAAL_BEGREPEN: w.id.startsWith('ijk') ? false : (lijf.pakte === true),
    ANTWOORD_GEMAAKT: !!(lijf.antwoord && String(lijf.antwoord).trim()),
    PLAN_GEMAAKT: lijf.voorstel === true,
    UITVOERING_GESTART: lijf.gedaan === true,
    EFFECT_BEREIKT: effectBereikt,
    NACONTROLE_GESLAAGD: w.schakels.includes('nacontrole'),
    /* Niet een laag maar het bewijs eronder: wat er dan precies veranderde. */
    _collecties: eigen, _binnenBasislijn: binnenBasislijn,
    _schrijfacties: effect ? effect.opslag : null
  };
}

/* `geen` is een uitslag en een ontbrekende kop niet. Zonder dat onderscheid
   leest een route die zijn koppen al had verstuurd als "niets gebeurd". */
function ontleedEffect(kop) {
  if (kop == null) return null;
  if (kop === 'geen') return { opslag: 0, mail: 0, sms: 0 };
  const uit = { opslag: 0, mail: 0, sms: 0 };
  for (const stuk of String(kop).split(',')) {
    const [k, v] = stuk.split('=');
    if (Object.prototype.hasOwnProperty.call(uit, k)) uit[k] = Number(v) || 0;
  }
  return uit;
}

const SLEUTEL = (l) => ['TAAL_BEGREPEN', 'ANTWOORD_GEMAAKT', 'PLAN_GEMAAKT',
  'UITVOERING_GESTART', 'EFFECT_BEREIKT', 'NACONTROLE_GESLAAGD']
  .map(k => k + '=' + (l[k] === null ? '?' : (l[k] ? 'J' : 'n'))).join(' ');

module.exports = { CORPUS, lagen, ontleedEffect, SLEUTEL, IJKZIN };
module.exports.tel = (...a) => tel(...a);
module.exports.main = (...a) => main(...a);

/* ------------------------------------------------------------------------- */

const R = require('./lib/pakteronde');

const STANDEN = [
  { id: 'zonder-model', extra: { RTG_AI_UIT: '1' } },
  { id: 'met-lokaal-model', nepModel: true }
];

/* DE EIGENLIJKE UITSLAG. Niet "hoe vaak staat pakte aan" maar: hoeveel
   ONDERSCHEIDEN uitkomsten dragen dezelfde `pakte: true`? Twee zinnen met
   dezelfde zes-lagen-handtekening zijn voor de poort hetzelfde geval; twee met
   een andere handtekening zijn dat niet, en de poort ziet het verschil niet. */
function tel(waarnemingen, basislijnPerStand) {
  const perSleutel = new Map();
  let metPakte = 0;
  for (const w of waarnemingen) {
    const l = lagen(w, basislijnPerStand[w.stand]);
    const paktte = w.lijf.pakte === true;
    if (!paktte) continue;
    metPakte++;
    const s = SLEUTEL(l);
    if (!perSleutel.has(s)) perSleutel.set(s, { sleutel: s, lagen: l, zinnen: [] });
    perSleutel.get(s).zinnen.push({ id: w.id, stand: w.stand, plek: w.plek });
  }
  return { waarnemingenMetPakte: metPakte, onderscheiden: perSleutel.size,
    betekenissen: [...perSleutel.values()] };
}

async function main() {
  const werkmap = fs.mkdtempSync(path.join(os.tmpdir(), 'paktebetekenis-'));
  const nep = await W.startNepModel();
  const rondes = [];
  try {
    for (const stand of STANDEN) {
      const dataDir = path.join(werkmap, 'data-' + stand.id);
      fs.mkdirSync(dataDir, { recursive: true });
      rondes.push(await R.ronde({
        standId: stand.id, corpus: CORPUS,
        spoorPad: path.join(werkmap, stand.id + '.jsonl'), dataDir,
        extra: stand.nepModel
          ? { LOCAL_AI_URL: nep.url, LOCAL_AI_MODEL: 'nepmodel', RTG_EXTERNE_AI_UIT: '1' }
          : stand.extra
      }));
    }
  } finally { await nep.stop(); }

  const alle = rondes.flatMap(r => r.waarnemingen);
  /* De basislijn per stand: welke collecties een KAAL antwoord al aanraakt.
     klaar() in kern/fluister/gesprek.js schrijft het gespreksgeheugen weg, dus
     zonder deze lijst leest elke zin als "er is iets gebeurd". Op naam, zodat
     iemand kan nakijken of de juiste dingen zijn weggestreept. */
  const basislijn = {};
  for (const r of rondes) {
    const ijk = r.waarnemingen.find(w => w.id === 'ijk');
    basislijn[r.stand] = (ijk && ijk.veranderd) ? ijk.veranderd : [];
  }

  return {
    soort: 'meting',
    uitleg: 'Hoeveel ONDERSCHEIDEN betekenissen draagt de boolean `pakte` van kern/fluister/gesprek.js, gemeten aan een echte server. De poort die erop beslist staat in server/routes/member/persoonlijk-rahul.js:66.',
    grens: 'Vijf dingen die dit NIET zegt. (0) EFFECT_BEREIKT kent DRIE uitkomsten: bewezen wel, bewezen niet, en ONBEPAALD. Dat laatste is geen slordigheid maar de uitslag zelf -- `fluister` draagt het gespreksgeheugen EN de weetjes van het lid in EEN collectie, dus "ik onthield deze beurt", "ik sloeg jouw weetje op" en "ik wiste al je gegevens" zien er op dit meetniveau identiek uit. Lezen van de code zegt dat onthoud en vergeet wel degelijk muteren; dat is graad `vermoed` en staat hier bewust niet als `gemeten`. (1) TAAL_BEGREPEN is AFGELEID uit het antwoord en niet uit de handler zelf -- graad `vermoed`, de andere vijf zijn gemeten. (2) De opslagvloer komt van EEN ijkzin per stand; een antwoord dat toevallig meer gespreksgeheugen wegschrijft, zou als effect kunnen lezen. (3) server/effectmeter.js telt met opzet geen bestandsschrijfacties en geen externe aanroepen -- die staan in `effectNietGemeten` en niet als nul. (4) Dit is het corpus van EEN route (/api/fluister); over /api/ai en /api/chat/send zegt het niets.',
    basislijn: basislijn,
    corpus: CORPUS,
    telling: tel(alle, basislijn),
    waarnemingen: alle.map(w => Object.assign({}, w, { lagen: lagen(w, basislijn[w.stand]) }))
  };
}

if (require.main === module) {
  main().then((uit) => {
    const vast = process.argv.includes('--vastleggen');
    if (vast) fs.writeFileSync(DOEL, JSON.stringify(Object.assign({ stempel: stempel() }, uit), null, 2) + '\n');
    console.log(vast ? '\nPAKTEBETEKENIS.json geschreven.\n' : '\nGEMETEN, NIET GESCHREVEN (npm run paktebetekenis:vast legt vast).\n');
    console.log('  basislijn (collecties die een KAAL antwoord al raakt):');
    for (const [st, cs] of Object.entries(uit.basislijn))
      console.log('    ' + st.padEnd(18) + (cs.length ? cs.join(', ') : '(geen)'));
    console.log('');
    for (const w of uit.waarnemingen) {
      const l = w.lagen;
      const vlag = (k) => l[k] === null ? '?' : (l[k] ? 'J' : '.');
      console.log('  ' + w.stand.padEnd(17) + w.id.padEnd(12) +
        ' pakte=' + String(w.lijf.pakte === true ? 'J' : (w.lijf.pakte === false ? 'n' : '?')) +
        '  taal=' + vlag('TAAL_BEGREPEN') + ' antw=' + vlag('ANTWOORD_GEMAAKT') +
        ' plan=' + vlag('PLAN_GEMAAKT') + ' uitv=' + vlag('UITVOERING_GESTART') +
        ' effect=' + vlag('EFFECT_BEREIKT') + ' nacon=' + vlag('NACONTROLE_GESLAAGD') +
        '  [' + (l._collecties === null ? 'niet waargenomen'
          : (l._collecties.length ? l._collecties.join('+')
            : (l._binnenBasislijn && l._binnenBasislijn.length
              ? 'alleen ' + l._binnenBasislijn.join('+') : '-'))) + ']');
    }
    const t = uit.telling;
    console.log('\n  ONDERSCHEIDEN BETEKENISSEN ONDER DEZELFDE `pakte: true`: ' + t.onderscheiden +
      '  (over ' + t.waarnemingenMetPakte + ' waarnemingen)');
    for (const b of t.betekenissen)
      console.log('    ' + b.sleutel + '\n      <- ' + b.zinnen.map(z => z.id + '/' + z.stand).join(', '));
    console.log('');
    process.exit(0);
  }).catch((e) => { console.error('paktebetekenis: ' + (e && e.stack || e)); process.exit(1); });
}
