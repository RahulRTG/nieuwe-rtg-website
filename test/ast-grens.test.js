/* ============================================================================
   DE SNELLE EN DE UITPUTTENDE VARIANT MOETEN HETZELFDE ZEGGEN.

   WAAROM DEZE TOETS ER IS

   scripts/ast-scan.js kwam lokaal in negen minuten niet rond, terwijl hij in CI
   een blokkerende stap is (TAKEN 4.6). De oorzaak lag niet bij de grootte van de
   bestanden: server.js van 212 kilobyte deed 38 milliseconde, en een bestand van
   vier kilobyte bijna twee seconden. Twee dingen liepen uit de hand:

   1. `onder()` was een recursieve generator met `yield*`. Daarbij gaat elke
      knoop door de hele delegatieketen terug naar boven, dus een knoop op
      diepte D kost D stappen. Bij een diep geneste expressie -- lange ketens
      van string-concatenaties, en daar staan er hier veel -- wordt dat N x D.
      In vonk/index.js kostte EEN knoop 2285 van de 2156 milliseconde van het
      hele bestand.
   2. `heeftGrens()` en `naamUitBuiten()` liepen allebei de hele functie-body af,
      opnieuw voor elke indexnaam in die functie.

   Nu doet `onder()` het met een stapel (N stappen) en berekent `analyse()` per
   functie in EEN doorloop welke namen uit het verzoek komen en welke een grens
   hebben. De scan rondt in tweeendertig seconden.

   EN DAAROM DEZE TOETS. Een optimalisatie die sneller is maar iets anders zegt,
   is geen optimalisatie maar een stille versoepeling van een SECURITY-scanner.
   Bij de eerste poging gebeurde dat ook echt: de herschreven versie miste de
   derde vorm van een grens (`if (!lijst[i]) return`), en de scan keurde twee
   correcte routes af. Dat viel op omdat de scan eindelijk rond kwam -- maar het
   had net zo goed andersom kunnen uitpakken, met een scanner die stilletjes
   minder ziet.

   Deze toets houdt de twee implementaties tegen elkaar op de ECHTE code van
   server/routes/ -- geen verzonnen voorbeelden, en juist daar komt verzoekdata
   binnen.

   EN HIJ VOND METEEN IETS. Op 23 van de 1980 gevallen was de snelle variant
   STRENGER, en dat bleek geen fout in de nieuwe maar een gat in de oude: de
   eerste tak van heeftGrens keurde `a.length > b.length` goed als grens voor
   ELKE naam, ook als die naam er niet in voorkwam. Een zo'n vergelijking
   ergens in een functie zette daarmee de hele index-controle voor die functie
   uit -- en zulke vergelijkingen staan er echt (server/kern/agent.js). Dat gat
   is nu in beide varianten gedicht.
   ========================================================================== */
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');

const WORTEL = path.join(__dirname, '..');
const { parse } = require('../scripts/ast/parser');
const { loop } = require('../scripts/ast/walk');
const { heeftGrens, heeftGrens_, onder } = require('../scripts/ast/regels');

function jsBestanden(wortel) {
  const uit = [];
  (function ga(d) {
    for (const e of fs.readdirSync(d, { withFileTypes: true })) {
      const p = path.join(d, e.name);
      if (e.isDirectory()) { if (['node_modules', '.git', 'data'].includes(e.name)) continue; ga(p); }
      else if (e.name.endsWith('.js')) uit.push(p);
    }
  })(wortel);
  return uit.sort();
}

test('de snelle heeftGrens zegt hetzelfde als de uitputtende, over alle routes', () => {
  /* WAAROM ALLEEN server/routes/ EN server/kern/. De uitputtende variant is
     uitputtend: hij loopt de hele functie-body af voor ELKE indexnaam, en dat
     is precies het werk dat de scan onbruikbaar traag maakte. Hem over de hele
     boom draaien duurt minuten en dat hoort niet in een toets.

     server/routes/ is geen willekeurige steekproef maar de plek waar de regel
     over GAAT: daar komt verzoekdata binnen en wordt hij als index gebruikt.
     Met server/kern/ erbij duurde deze toets zes minuten; alleen routes/ is een
     halve. De keuze is dus tussen dekking en bruikbaarheid, en een toets die
     niemand draait dekt niets. */
  const bestanden = jsBestanden(path.join(WORTEL, 'server', 'routes'));
  /* Een lege lijst is geen "alles goed" maar een kapotte meting (LAT.md regel
     3). Zonder deze regel zou een verplaatste map netjes nul bestanden vinden
     en groen geven. */
  assert.ok(bestanden.length > 80, 'de scan vindt de bestanden (' + bestanden.length + ')');

  const verschillen = [];
  let vergeleken = 0;
  for (const bestand of bestanden) {
    let boom;
    try { boom = parse(fs.readFileSync(bestand, 'utf8')); } catch (e) { continue; }

    /* Per functie: alle namen die er als index gebruikt worden. Precies de
       vraag die de regel stelt, dus precies waar de twee het over eens moeten
       zijn. */
    loop(boom, (node) => {
      if (!/Function/.test(node.type) || !node.body) return;
      const namen = new Set();
      for (const n of onder(node.body)) {
        if (n.type === 'MemberExpression' && n.computed && n.property && n.property.type === 'Identifier') {
          namen.add(n.property.name);
        }
      }
      for (const naam of namen) {
        vergeleken++;
        const snel = heeftGrens(node, naam);
        const traag = heeftGrens_(node, naam);
        if (snel !== traag) {
          verschillen.push(path.relative(WORTEL, bestand) + ' regel ' + (node.lijn || '?') +
            ': "' + naam + '" -> snel=' + snel + ' uitputtend=' + traag);
        }
      }
    });
  }

  /* Er MOET vergeleken zijn. Nul vergelijkingen zou groen geven zonder iets te
     hebben aangetoond -- dezelfde valkuil als een lege bestandenlijst. */
  assert.ok(vergeleken > 100, 'er zijn genoeg gevallen vergeleken (' + vergeleken + ')');
  assert.deepEqual(verschillen.slice(0, 20), [],
    'de twee implementaties zijn het overal eens (' + verschillen.length + ' verschillen van ' +
    vergeleken + ' gevallen):\n  ' + verschillen.slice(0, 20).join('\n  '));
});

test('onder() bezoekt precies dezelfde knopen als een gewone recursie', () => {
  /* De tweede helft van dezelfde belofte: de stapel-wandeling mag geen knoop
     overslaan en er geen dubbel tellen. Vergelijken met een kale recursie op
     een echt bestand -- de parser van dit huis zelf, want daar zitten de diepe
     expressies in die de oude versie lieten ontsporen. */
  function* recursief(node) {
    if (!node || typeof node !== 'object') return;
    yield node;
    for (const k of Object.keys(node)) {
      if (k === 'type' || k === 'lijn') continue;
      const v = node[k];
      if (Array.isArray(v)) { for (const x of v) if (x && typeof x === 'object' && x.type) yield* recursief(x); }
      else if (v && typeof v === 'object' && v.type) yield* recursief(v);
    }
  }
  for (const rel of ['scripts/ast/parser.js', 'server/kern/vonk/index.js', 'server/kern/overheid/pda/bode.js']) {
    const boom = parse(fs.readFileSync(path.join(WORTEL, rel), 'utf8'));
    const a = [...onder(boom)];
    const b = [...recursief(boom)];
    assert.equal(a.length, b.length, rel + ': evenveel knopen (' + a.length + ' tegen ' + b.length + ')');
    for (let i = 0; i < a.length; i++) {
      if (a[i] !== b[i]) assert.fail(rel + ': knoop ' + i + ' verschilt (' + a[i].type + ' tegen ' + b[i].type + ')');
    }
  }
});
