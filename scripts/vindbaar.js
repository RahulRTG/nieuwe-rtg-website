#!/usr/bin/env node
/* ============================================================================
   VINDBAAR -- kun je een functie vinden met het woord dat er zelf op staat?

   WAAROM DIT NAAST scripts/tikken.js STAAT. Die meter zegt of iets te BEREIKEN
   is; hij kent het verschil niet tussen vijf tikken die vanzelf gaan en vijf
   die je moet zoeken. Deze meter pakt het deel van dat verschil dat wel
   objectief te meten is: de woorden.

   De aanleiding is een echte misser. In de sprong vond "pay" niets, terwijl de
   app RTG Pay heet -- de rij heet daar "Betalen". Een mens typt het woord dat
   hij op het scherm heeft zien staan, niet het woord dat wij in een lijst
   hebben gezet.

   HOE ER GEMETEN WORDT. Voor elke bestemming uit public/shared/sprongindex.json
   worden de woorden verzameld die een lid van dat scherm KENT: de <title>, de
   eerste <h1>, en de naam uit de appcatalogus van de server. Daarna wordt exact
   de filter van de sprong nagedaan (naam + wereld + sleutel + adres + woorden,
   kleine letters, deelreeks). Elk woord dat niet tot zijn eigen scherm leidt,
   is een gat.

   WAT DIT NIET MEET, en dat is de grotere helft: of iemand op het idee komt om
   dat woord te typen, of hij de greep ziet staan, en of de lijst hem niet
   overweldigt. Daar is een mens voor nodig; deze meter is een ondergrens.

   Draai: node scripts/vindbaar.js
          node scripts/vindbaar.js --controle   (zakt onder de vloer)
   ========================================================================== */
'use strict';
const fs = require('fs');
const path = require('path');
const { stempel } = require('./lib/stempel');

const WORTEL = path.join(__dirname, '..');
const DOEL = path.join(WORTEL, 'VINDBAAR.json');
/* De wacht: dit script schrijft een register, dus het start niet bij het
   requiren (een laadcontrole schreef zo ooit ROLPROEF.json terug naar 292
   routes; scripts/meetkeuring.js houdt dit vast). */
if (require.main !== module) return;

const controle = process.argv.includes('--controle');

/* WELKE WOORDEN MOETEN WERKEN, en welke met opzet niet.

   Niet elk woord op een scherm hoort ernaartoe te leiden. "Goedemiddag",
   "staat", "vandaag" en "rahul" staan op tientallen schermen; wie die afdwingt,
   dwingt ruis af -- dan vindt elke zoekopdracht alles, en dat is hetzelfde als
   niets vinden. Gemeten worden daarom alleen de ONDERSCHEIDENDE woorden: een
   woord dat op hooguit DREMPEL bestemmingen voorkomt. Dat is precies het woord
   waarmee een mens dit ene scherm terugzoekt.

   De vloer gaat omhoog als hij gehaald wordt, nooit omlaag om een meting te
   redden. Hij staat op 60% en niet hoger omdat de eerste meting 41% was: een
   vloer die je vandaag niet haalt, wordt binnen een week uitgezet. */
const VLOER = 0.60;
const DREMPEL = 3;

/* Dezelfde lezer die de index vult (scripts/lib/schermwoorden.js). Zou deze
   meter zijn eigen woorden verzamelen, dan meet hij iets anders dan het huis
   toont -- en zo'n meter staat altijd groen. */
const { woordenUit, vanScherm, vanSchermBreed } = require('./lib/schermwoorden');

/* Exact de filter van shared/sprong.js. Loopt die uit de pas, dan meet dit
   script iets anders dan het huis doet -- vandaar dat hij hier in EEN functie
   staat en niet verspreid door de meting. */
function vindt(item, woord) {
  const hooi = [item.naam, item.wereld, item.sleutel, item.url, (item.woorden || []).join(' ')]
    .filter(Boolean).join(' ').toLowerCase();
  return hooi.indexOf(woord) >= 0;
}

/* De tweede weg: de handelingindex. Wie "fooi" typt komt niet uit bij een app
   die zo heet, maar bij de handeling die zo heet -- en die woont in Horeca.
   Deze meter hoort dezelfde twee wegen te kennen als de sprong, anders meet hij
   een huis dat niet bestaat. */
function handelingWijst(handelingen, woord, url) {
  return handelingen.some((h) => h.url === url && (h.label + ' ' + h.app).toLowerCase().includes(woord));
}

function meet() {
  const index = JSON.parse(fs.readFileSync(path.join(WORTEL, 'public/shared/sprongindex.json'), 'utf8'));
  const catalogus = [].concat(require(path.join(WORTEL, 'server/kern/appcatalogus-rijen/deel1')),
                              require(path.join(WORTEL, 'server/kern/appcatalogus-rijen/deel2')));
  const perUrl = new Map(catalogus.map((r) => [r[3], r[1]]));
  const handelingen = JSON.parse(fs.readFileSync(path.join(WORTEL, 'public/shared/handelingindex.json'), 'utf8')).items;

  /* Eerst tellen op hoeveel bestemmingen elk woord voorkomt: pas daarna is te
     zeggen welk woord onderscheidend is. */
  const bestemmingen = index.items.filter((i) => i.url && !i.huis);
  const kandidaatPer = new Map();
  const telling = new Map();
  for (const item of bestemmingen) {
    const woorden = [...new Set(vanSchermBreed(WORTEL, item.url)
      .concat(woordenUit(perUrl.get(item.url) || ''), vanScherm(WORTEL, item.url)))];
    kandidaatPer.set(item, woorden);
    for (const w of woorden) telling.set(w, (telling.get(w) || 0) + 1);
  }

  /* WANNEER IS EEN WOORD GEDEKT. Niet: "leidt het naar het scherm waar het
     toevallig stond". Het huis van LivingOS noemt Vluchten, Wallet en Camera bij
     naam; die woorden horen naar DIE apps te leiden en niet naar het huis. De
     vraag van een mens is eenvoudiger en die stellen we hier ook: typ ik dit
     woord, kom ik dan uit bij een scherm waar het werkelijk op staat?

     Zo kan de meter nog steeds zakken -- een woord dat NERGENS heen leidt is een
     gat -- zonder dat hij ruis afdwingt. */
  const rijen = [];
  for (const item of bestemmingen) {
    const kandidaten = kandidaatPer.get(item).filter((w) => telling.get(w) <= DREMPEL);
    const mist = kandidaten.filter((w) => {
      if (handelingWijst(handelingen, w, item.url)) return false;   // via de handelingindex
      const treffers = bestemmingen.filter((b) => vindt(b, w));
      if (!treffers.length) return true;                            // leidt nergens heen
      /* Gedekt als het woord uitkomt bij iets dat ER OOK ZO HEET (het huis van
         LivingOS noemt Wallet bij naam; dat woord hoort naar Wallet te leiden),
         of bij een scherm waar het woord werkelijk op staat. */
      return !treffers.some((b) =>
        (b.naam + ' ' + b.sleutel + ' ' + b.url).toLowerCase().includes(w) ||
        (kandidaatPer.get(b) || []).includes(w));
    });
    rijen.push({ naam: item.naam, url: item.url, woorden: kandidaten.length,
      gevonden: kandidaten.length - mist.length, mist });
  }
  const woorden = rijen.reduce((n, r) => n + r.woorden, 0);
  const gevonden = rijen.reduce((n, r) => n + r.gevonden, 0);
  return { stempel: stempel(),
    uitleg: 'Per bestemming in de sprong: welk aandeel van de ONDERSCHEIDENDE woorden van dat scherm (woorden uit zijn koppen die op hooguit ' + DREMPEL + ' bestemmingen voorkomen) er ook naartoe leidt in de zoekfilter van shared/sprong.js. Meet woorden, geen mensen: of iemand op het idee komt dat woord te typen, weet deze meter niet.',
    vloer: VLOER, drempel: DREMPEL, bestemmingen: rijen.length, woorden, gevonden,
    dekking: woorden ? Number((gevonden / woorden).toFixed(4)) : 1,
    perBestemming: rijen.sort((a, b) => b.mist.length - a.mist.length) };
}

const uit = meet();
fs.writeFileSync(DOEL, JSON.stringify(uit, null, 2) + '\n');
const pct = (uit.dekking * 100).toFixed(1);
console.log('VINDBAAR.json: ' + uit.gevonden + ' van ' + uit.woorden + ' eigen woorden leiden naar hun scherm (' + pct + '%), vloer ' + (VLOER * 100) + '%.');
const ergste = uit.perBestemming.filter((r) => r.mist.length).slice(0, 8);
for (const r of ergste) console.log('  ' + r.naam.padEnd(24) + ' mist: ' + r.mist.join(', '));
if (controle && uit.dekking < VLOER) { console.error('onder de vloer'); process.exit(1); }
