#!/usr/bin/env node
/* ============================================================================
   RTG SDK -- de typings en de documentatie, GEGENEREERD uit de code.

   WAAROM GEGENEREERD EN NIET GESCHREVEN. Een met de hand bijgehouden `.d.ts`
   loopt uit de pas op de dag dat er een zevende methode bij komt, en dan is de
   SDK een tweede waarheid over wat de brug kan (LAT-regel 4). Alles hieronder
   komt daarom uit de bron:

     de methodes      kern/appstore/brug.js       (METHODES)
     de mutatieklasse kern/mutatie.js             (per methode)
     de machtigingen  kern/appstore/machtigingen.js
     de foutcodes     kern/platformfout.js
     de grenzen       kern/appstore/brug.js       (GRENS)
     het budget       kern/appstore/keuring.js    (BUDGET)

   EN WAT ER NIET IS, STAAT ER OOK. Dat is het stuk waar dit huis van de meeste
   platforms verschilt: `machtigingen.NIET_GEBOUWD` en `platformfout.NOG_GEEN_CODE`
   dragen per ontbrekend ding de REDEN, en die hoort in de documentatie onder een
   eigen kop. Een ontwikkelaar die zoekt naar push-berichten hoort te lezen waarom
   ze er niet zijn -- niet te concluderen dat hij ze over het hoofd ziet.

   Draai: rtg sdk [--uit <map>]        (standaard: ./rtg-sdk)
   ========================================================================== */
'use strict';
const fs = require('fs');
const path = require('path');

const WORTEL = path.join(__dirname, '..');
const { maakBrug } = require(path.join(WORTEL, 'server/kern/appstore/brug'));
const { MACHTIGINGEN, DOELEN, NIET_GEBOUWD } = require(path.join(WORTEL, 'server/kern/appstore/machtigingen'));
const platformfout = require(path.join(WORTEL, 'server/kern/platformfout'));
const mutatie = require(path.join(WORTEL, 'server/kern/mutatie'));
const { BUDGET } = require(path.join(WORTEL, 'server/kern/appstore/keuring'));

/* De brug wordt echt opgebouwd, met een opslag in het geheugen. Dat is geen
   omweg: zo komen de namen, de grenzen en de mutatieklassen uit de draaiende
   code en niet uit een regex over de bron. Een generator die zijn eigen bron
   parseert, kan iets vinden wat er niet is. */
function bron() {
  const staat = { opslag: {}, bakjes: {} };
  const brug = maakBrug({ S: () => staat, save() {}, boek() {},
    nu: () => new Date().toISOString(), eigen: (o, k) => o[k] });
  return { brug, methodes: brug.mutaties, GRENS: brug.GRENS };
}

/* De vormen en de machtiging-per-methode komen uit kern/appstore/naslag.js.
   Ze stonden hier, en dat werkte zolang de CLI de enige lezer was -- maar het
   uitgeversbureau toont nu hetzelfde, en twee lijstjes lopen een keer uiteen
   (LAT-regel 4). */
const { VORMEN, machtigingVan } = require(path.join(WORTEL, 'server/kern/appstore/naslag'));

function typings({ methodes, GRENS }) {
  const overloads = methodes.map(m => {
    const v = VORMEN[m.naam];
    const args = v && v.args ? ', args: ' + v.args : '';
    const uit = v ? v.uit : 'unknown';
    return `  /** ${m.uitleg}\n   *  mutatie: ${m.mutatie} -- ${m.herhaalbaar ? 'herhalen mag' : 'nooit automatisch herhalen'} */\n`
      + `  roep(methode: '${m.naam}'${args}): Promise<${uit}>;`;
  }).join('\n');

  const foutvelden = platformfout.overzicht().map(f => `  | '${f.code}'`).join('\n');

  return `/* rtg.d.ts -- GEGENEREERD door scripts/rtg-sdk.js. Niet met de hand wijzigen:
   draai \`rtg sdk\` opnieuw. De bron is de code, niet dit bestand. */

/** Een weigering van de brug. Draagt meer dan een zin: de code is stabiel, en
 *  bij een machtigingsfout staat erbij wat het lid WEL gaf en hoe het op te
 *  lossen is. Alleen \`herhaalbaar\` mag een taakloper als sein lezen. */
export interface RTGFout extends Error {
  naam: 'RTGFout';
  code: RTGFoutcode;
  herhaalbaar: boolean;
  methode?: string;
  machtiging?: string;
  verleend?: string[];
  gevraagd?: string[];
  hoe?: string;
}

export type RTGFoutcode =
${foutvelden};

export interface RTGBrug {
${overloads}
  /** Elke andere methode bestaat niet en weigert met RTG_METHODE_ONBEKEND. */
  roep(methode: string, args?: Record<string, unknown>): Promise<unknown>;
  versie: 1;
  /** Wat een app NIET van de brug krijgt, met de reden. */
  nietGebouwd: Record<string, string>;
}

declare global {
  /** Staat er al voordat je eigen code draait: de cel zet de brugklant in de
   *  <head>. Je hoeft hem niet te laden en je kunt hem niet vervangen. */
  const RTG: RTGBrug;
}

/** De grenzen van de brug, zoals ze op de server worden gerekend. */
export declare const GRENZEN: {
  opslagSleutels: ${GRENS.opslagSleutels};
  opslagSleutelLengte: ${GRENS.opslagSleutelLengte};
  opslagWaarde: ${GRENS.opslagWaarde};
  opslagTotaal: ${GRENS.opslagTotaal};
  berichtLengte: ${GRENS.berichtLengte};
  berichtenPerDag: ${GRENS.berichtenPerDag};
  roepenPerMinuut: ${GRENS.roepenPerMinuut};
};

export {};
`;
}

function documentatie({ methodes, GRENS }) {
  const r = [];
  const R = (s) => r.push(s);
  R('# De RTG-brug\n');
  R('> GEGENEREERD door `scripts/rtg-sdk.js` uit de code. Wat hier staat, staat in de brug.\n');
  R('Een app van derden draait in een **cel**: geen netwerk, geen cookies, een naamloze');
  R('herkomst. De enige weg naar RTG is `RTG.roep()`, en die controleert bij elke aanroep');
  R('wat het lid heeft **verleend** -- niet wat je manifest heeft gevraagd.\n');

  R('## De methodes\n');
  R('| methode | machtiging | mutatie | tweede aanroep |');
  R('|---|---|---|---|');
  for (const m of methodes) {
    const mach = (MACHTIGINGEN.find(x => x.id === machtigingVan(m.naam)) || {}).id || '-';
    R('| `' + m.naam + '` | `' + mach + '` | `' + m.mutatie + '` | '
      + (m.herhaalbaar ? 'laat dezelfde stand achter' : 'is een tweede gebeurtenis') + ' |');
  }
  R('');
  R('De kolom **mutatie** is geen versiering: hij zegt of een taakloper deze aanroep uit');
  R('zichzelf mag herhalen. `nietHerhaalbaar` betekent dat twee aanroepen twee dingen doen,');
  R('en dat dat de bedoeling is -- er valt niets recht te zetten omdat er niets fout ging.\n');

  R('## De grenzen\n');
  R('Ze worden op de server gerekend en niet vertrouwd; `rtg dev` rekent dezelfde.\n');
  R('| grens | waarde |');
  R('|---|---|');
  R('| sleutels in je eigen opslag, per lid | ' + GRENS.opslagSleutels + ' |');
  R('| lengte van een sleutel | ' + GRENS.opslagSleutelLengte + ' tekens |');
  R('| lengte van een waarde | ' + GRENS.opslagWaarde + ' tekens |');
  R('| je opslag bij een lid in totaal | ' + Math.round(GRENS.opslagTotaal / 1024) + ' kB |');
  R('| lengte van een bericht | ' + GRENS.berichtLengte + ' tekens |');
  R('| berichten per dag, per lid | ' + GRENS.berichtenPerDag + ' |');
  R('| aanroepen per minuut | ' + GRENS.roepenPerMinuut + ' |');
  R('| bestanden in je bundel | ' + BUDGET.bestanden + ' |');
  R('| je bundel in totaal | ' + Math.round(BUDGET.totaal / 1024) + ' kB |');
  R('| al je scriptcode samen | ' + Math.round(BUDGET.script / 1024) + ' kB |');
  R('| al je stijl samen | ' + Math.round(BUDGET.stijl / 1024) + ' kB |');
  R('');

  R('## De machtigingen\n');
  for (const m of MACHTIGINGEN) {
    R('### `' + m.id + '` -- ' + m.label + '\n');
    R('- **geeft:** ' + m.geeft);
    R('- **nooit:** ' + m.nooit);
    R('- **doelen:** ' + m.doelen.map(d => '`' + d + '` (' + DOELEN[d] + ')').join(', '));
    R('');
  }
  R('Elke machtiging in je manifest draagt een **doel** uit die gesloten lijst. Dat is');
  R('waar een lid werkelijk op beslist, en het is het enige waarop een update te');
  R('vergelijken valt: dezelfde machtiging voor een ander doel is een andere vraag.\n');

  R('## Bewust niet beschikbaar\n');
  R('Wat hieronder staat, ontbreekt niet -- het is besloten. Per regel staat waarom, en');
  R('wat de weg wel is. Een regel verdwijnt hier pas als de brug hem uitvoert.\n');
  for (const [wat, waarom] of Object.entries(NIET_GEBOUWD)) {
    R('- **' + wat + '** -- ' + waarom);
  }
  R('');

  R('## De foutentaal\n');
  R('Een weigering draagt een stabiele `code`, de zin voor een mens in `error`, en');
  R('`herhaalbaar`. Bij een machtigingsfout komen `machtiging`, `verleend`, `gevraagd`');
  R('en `hoe` mee -- samen zeggen die welke van de vier oorzaken je voor je hebt.\n');
  R('| code | status | herhaalbaar | wat het betekent |');
  R('|---|---|---|---|');
  for (const f of platformfout.overzicht()) {
    R('| `' + f.code + '` | ' + f.status + ' | ' + (f.herhaalbaar ? 'ja' : 'nee') + ' | ' + f.uitleg + ' |');
  }
  R('');
  R('### Codes die er (nog) niet zijn\n');
  for (const [code, waarom] of Object.entries(platformfout.NOG_GEEN_CODE)) {
    R('- **`' + code + '`** -- ' + waarom);
  }
  R('');
  return r.join('\n');
}

module.exports = function sdk(argv, hulp) {
  const uitArg = argv.indexOf('--uit');
  const uitMap = path.resolve(uitArg >= 0 ? argv[uitArg + 1] : 'rtg-sdk');
  const b = bron();

  fs.mkdirSync(uitMap, { recursive: true });
  const dts = path.join(uitMap, 'rtg.d.ts');
  const md = path.join(uitMap, 'BRUG.md');
  fs.writeFileSync(dts, typings(b));
  fs.writeFileSync(md, documentatie(b));

  const vet = (s) => hulp && hulp.kleur ? '\x1b[1m' + s + '\x1b[0m' : s;
  const grijs = (s) => hulp && hulp.kleur ? '\x1b[90m' + s + '\x1b[0m' : s;
  console.log('\n  ' + vet('rtg.d.ts') + '  ' + grijs(b.methodes.length + ' methodes, '
    + platformfout.overzicht().length + ' foutcodes, ' + MACHTIGINGEN.length + ' machtigingen'));
  console.log('  ' + vet('BRUG.md') + '   ' + grijs('met "bewust niet beschikbaar": '
    + Object.keys(NIET_GEBOUWD).length + ' machtigingen en ' + Object.keys(platformfout.NOG_GEEN_CODE).length + ' foutcodes'));
  console.log('\n  ' + grijs(uitMap) + '\n');
  return 0;
};

module.exports.typings = typings;
module.exports.documentatie = documentatie;
module.exports.bron = bron;
module.exports.VORMEN = VORMEN;
