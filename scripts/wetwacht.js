#!/usr/bin/env node
'use strict';

/* DE WETWACHT -- de enige onderhoudspost hier die NIET mag repareren.

   De andere wachters mogen een fix voorstellen. Deze niet, en dat is geen
   voorzichtigheid maar een grens: CONCERN.md legt vast dat de AI hier geen
   juridische autoriteit is, en een model dat zelf besluit dat de DPIA
   bijgewerkt moet worden produceert precies de compliance die TOEZICHT.md
   afwijst -- lege vakjes die niets aantonen.

   Wat deze wacht dus wel doet: hij merkt op DAT een bron veranderd is, en hij
   zegt WELK document in dit huis daaraan hangt. De vertaalslag van "de tekst
   is gewijzigd" naar "en dus moeten wij dit anders doen" blijft mensenwerk.
   Dat is de hele scope, met opzet.

   HOE HIJ MEET. Per regeling staat er een bron in WETBRONNEN.json met een
   vingerafdruk van de laatst geziene tekst. De wacht haalt de bron op,
   normaliseert hem (scripts, opmaak, wisselende sessiedingen eruit) en
   vergelijkt de afdruk. Verschilt hij, dan is dat een bevinding met de
   documenten erbij die eraan hangen.

   WAT DIT NIET IS: een juridische dienst. Een vingerafdruk die verandert kan
   ook een nieuwe voettekst op de site van de uitgever zijn. Vals alarm is
   hier het goede soort fout -- een gemiste wetswijziging kost meer dan een
   keer kijken.

   Draaien:
     node scripts/wetwacht.js                 (meten en melden)
     node scripts/wetwacht.js --vastleggen    (de nieuwe afdrukken opslaan)

   EXITCODES:
     0  niets veranderd
     1  een bron is veranderd -- een mens moet kijken
     2  de wacht KON NIET METEN (bron onbereikbaar, register weg) */

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const WORTEL = path.join(__dirname, '..');
const REGISTER = path.join(WORTEL, 'WETBRONNEN.json');

/* ---------- puur: van pagina naar afdruk -------------------------------- */

/* Alles eruit wat verandert zonder dat de wet verandert. Zonder deze stap
   slaat de wacht elke week uit op een sessie-id of een datum in de voettekst,
   en een wacht die altijd piept wordt uitgezet.

   De opmaak gaat er met een LINEAIRE scanner uit, niet met regex. De eerste
   versie deed dit met /<script[\s\S]*?<\/script>/-achtige patronen over de
   rauwe, van buiten opgehaalde HTML; CodeQL merkte dat terecht aan -- zulke
   paar-patronen op andermans invoer zijn de klassieke weg naar polynomiale
   looptijd en half werkende filtering. Een scanner die elk teken één keer
   ziet heeft geen van beide problemen, en de bedoeling hier is toch geen
   sanitatie maar een stabiele vingerafdruk. De kleine patronen verderop
   (entiteiten, datums, hexsleutels) draaien op de al ontdane tekst en zijn
   allemaal lineair. */
function zonderOpmaak(html) {
  const t = String(html);
  const kleiner = t.toLowerCase();
  let uit = '';
  let i = 0;
  while (i < t.length) {
    if (t[i] !== '<') { uit += t[i]; i++; continue; }
    // commentaar: <!-- ... -->
    if (kleiner.startsWith('<!--', i)) {
      const eind = kleiner.indexOf('-->', i + 4);
      i = eind < 0 ? t.length : eind + 3;
      uit += ' ';
      continue;
    }
    // script/style: de hele inhoud overslaan tot en met de sluittag
    let overgeslagen = false;
    for (const tag of ['script', 'style']) {
      if (kleiner.startsWith('<' + tag, i)) {
        const sluit = kleiner.indexOf('</' + tag, i);
        const eind = sluit < 0 ? -1 : kleiner.indexOf('>', sluit);
        i = eind < 0 ? t.length : eind + 1;
        uit += ' ';
        overgeslagen = true;
        break;
      }
    }
    if (overgeslagen) continue;
    // een gewone tag: tot de eerstvolgende >
    const eind = kleiner.indexOf('>', i);
    i = eind < 0 ? t.length : eind + 1;
    uit += ' ';
  }
  return uit;
}

function normaliseer(html) {
  return zonderOpmaak(html)
    .replace(/&[a-z]+;|&#\d+;/gi, ' ')
    .replace(/\d{1,2}[-/]\d{1,2}[-/]\d{4}/g, ' ')            // datums in de opmaak
    .replace(/\b[0-9a-f]{16,}\b/gi, ' ')                      // sessie- en cache-sleutels
    .replace(/\s+/g, ' ')
    .trim()
    .toLowerCase();
}

function afdruk(tekst) {
  return crypto.createHash('sha256').update(tekst, 'utf8').digest('hex').slice(0, 32);
}

/* ---------- puur: het oordeel ------------------------------------------- */

/* metingen: { code -> { afdruk } | { fout } }. Geen netwerk hier, zodat elke
   tak echt in een toets omgezet kan worden. */
function vergelijk(register, metingen) {
  const bevindingen = [];
  for (const bron of register.bronnen || []) {
    const m = metingen[bron.code];

    if (!m || m.fout) {
      bevindingen.push({
        code: 'BRON_ONBEREIKBAAR', regeling: bron.code, ernst: 'onmeetbaar',
        wat: `${bron.naam} was niet op te halen${m && m.fout ? ' (' + m.fout + ')' : ''}.`,
        waarom: 'Een wetwacht die groen wordt omdat hij niets kon zien is erger dan geen wetwacht. Dit is nadrukkelijk geen "niets veranderd".',
        raakt: bron.raakt || [], doen: 'Controleer de bron-URL in WETBRONNEN.json en of de runner er bij kan.'
      });
      continue;
    }

    if (!bron.afdruk) {
      bevindingen.push({
        code: 'NOG_GEEN_AFDRUK', regeling: bron.code, ernst: 'zacht',
        wat: `${bron.naam} heeft nog geen vastgelegde afdruk.`,
        waarom: 'De eerste meting kan niets vergelijken. Vanaf de volgende ronde wel.',
        raakt: bron.raakt || [], doen: 'Draai `npm run wetwacht:vast` om de huidige tekst als nulpunt vast te leggen.'
      });
      continue;
    }

    if (m.afdruk !== bron.afdruk) {
      bevindingen.push({
        code: 'BRON_GEWIJZIGD', regeling: bron.code, ernst: 'melden',
        wat: `${bron.naam} is gewijzigd sinds ${bron.gezienOp || 'de vorige ronde'}.`,
        waarom: 'De tekst achter deze bron is niet meer dezelfde. Dat kan een inhoudelijke wijziging zijn of alleen opmaak -- dat onderscheid maakt een mens, niet deze wacht.',
        raakt: bron.raakt || [],
        doen: 'Lees wat er gewijzigd is en loop de genoemde documenten na. Klopt alles nog, leg dan de nieuwe afdruk vast met `npm run wetwacht:vast`.'
      });
    }
  }
  return bevindingen;
}

/* ---------- meten -------------------------------------------------------- */

async function meet(bronnen, haal = standaardHaler) {
  const metingen = {};
  for (const bron of bronnen) {
    try {
      metingen[bron.code] = { afdruk: afdruk(normaliseer(await haal(bron.bron))) };
    } catch (e) {
      metingen[bron.code] = { fout: String((e && e.message) || e).slice(0, 120) };
    }
  }
  return metingen;
}

async function standaardHaler(url) {
  const r = await fetch(url, { headers: { 'user-agent': 'rtg-wetwacht', 'accept-language': 'nl' }, redirect: 'follow' });
  if (!r.ok) throw new Error('HTTP ' + r.status);
  return r.text();
}

function leesRegister(pad = REGISTER) {
  try {
    return JSON.parse(fs.readFileSync(pad, 'utf8'));
  } catch (e) {
    throw Object.assign(new Error('WETBRONNEN.json is niet te lezen: ' + e.message), { code: 'REGISTER_WEG' });
  }
}

/* De slotcode, als pure functie zodat een toets hem echt kan laten omvallen.

   2 -- KON NIET METEN. Niet alleen een onbereikbare bron: ook een bron ZONDER
        nulpunt telt zo, want zonder afdruk is er niets om mee te vergelijken
        en detecteert deze wacht per definitie niets (LAT.md regel 3). De
        eerste versie gaf daar 0 op, en dat was precies het stille groen dat
        dit huis afwijst: een maandronde die niets meet en toch slaagt. Rood
        hier is de bedoeling -- herstel.yml maakt er een issue van, en de
        fix-PR die daaruit komt IS het nulpunt.
   1 -- een bron is echt veranderd; een mens moet kijken.
   0 -- gemeten en niets veranderd. --vastleggen dempt 1 (de nieuwe afdruk
        vastleggen is de afhandeling), maar dempt 2 alleen voor het
        nulpuntgeval: wat onbereikbaar was, is en blijft niet gemeten. */
function slotcode(bevindingen, vastleggen = false) {
  if (bevindingen.some(b => b.ernst === 'onmeetbaar')) return 2;
  if (bevindingen.some(b => b.code === 'NOG_GEEN_AFDRUK') && !vastleggen) return 2;
  if (bevindingen.some(b => b.code === 'BRON_GEWIJZIGD') && !vastleggen) return 1;
  return 0;
}

function toon(bevindingen) {
  if (!bevindingen.length) return 'DE WETWACHT\n\n  Geen van de bronnen is veranderd.';
  const r = ['DE WETWACHT', ''];
  for (const b of bevindingen) {
    r.push(`  [${b.ernst}] ${b.code}: ${b.wat}`);
    r.push(`         waarom: ${b.waarom}`);
    if (b.raakt.length) r.push(`         raakt:  ${b.raakt.join(', ')}`);
    r.push(`         doen:   ${b.doen}`);
  }
  return r.join('\n');
}

if (require.main === module) {
  (async () => {
    const vastleggen = process.argv.includes('--vastleggen');
    const register = leesRegister();
    const metingen = await meet(register.bronnen || []);
    const bevindingen = vergelijk(register, metingen);

    console.log(toon(bevindingen));
    fs.writeFileSync(path.join(WORTEL, 'WETWACHT.json'),
      JSON.stringify({ gemetenOp: new Date().toISOString(), bevindingen }, null, 2) + '\n');

    if (vastleggen) {
      const nu = new Date().toISOString().slice(0, 10);
      for (const bron of register.bronnen || []) {
        const m = metingen[bron.code];
        if (m && m.afdruk) { bron.afdruk = m.afdruk; bron.gezienOp = nu; }
      }
      fs.writeFileSync(REGISTER, JSON.stringify(register, null, 2) + '\n');
      console.log('\nDe afdrukken zijn vastgelegd. Wat onbereikbaar was is NIET vastgelegd.');
    }

    process.exit(slotcode(bevindingen, vastleggen));
  })().catch(e => {
    console.error('DE WETWACHT KON NIET METEN: ' + e.message);
    process.exit(2);
  });
}

module.exports = { normaliseer, zonderOpmaak, afdruk, vergelijk, meet, leesRegister, toon, slotcode };
