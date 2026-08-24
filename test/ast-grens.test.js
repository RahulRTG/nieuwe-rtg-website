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

   EN HIJ KOST 262 SECONDEN, dus hij rekent niet twee keer hetzelfde uit. De
   uitputtende variant loopt de hele functie-body af voor ELKE indexnaam; over
   90+ routebestanden is dat vier en een halve minuut, en in een ronde van
   achttien minuten is dat het op een na duurste bestand. De uitkomst hangt aan
   precies drie dingen: de inhoud van server/routes/, de twee implementaties in
   scripts/ast/regels.js, en de parser eronder. Verandert daar niets, dan
   verandert de uitslag niet.

   Dat gaat dus door de bronkas (server/lib/bronkas.js), met een sleutel over
   precies die drie. De BEWERINGEN veranderen daar niet van: een uitslag uit de
   kas wordt net zo hard gesteld als een verse. Wat er verandert is dat een ronde
   die niets aan routes of aan de regels heeft veranderd, die 262 seconden niet
   nog eens betaalt.

   EN DE SLEUTEL IS BEWEZEN, NIET BELOOFD. Een kas met een sleutel die een
   wijziging mist, is een SECURITY-scanner die stil op een oude uitslag blijft
   staan -- het ergste wat hier kan gebeuren. De tweede toets hieronder muteert
   daarom een routebestand en de regels-module in een wegwerpkopie en eist dat de
   sleutel meebeweegt. Zonder die mutatie zou een sleutel die altijd hetzelfde
   getal geeft er ook mee door komen.

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

const kas = require('../server/lib/bronkas');

/* DE SLEUTEL: precies de drie dingen waar de uitslag aan hangt.

   Losse functie met de paden als ARGUMENT, want anders is hij niet te muteren:
   de toets hieronder maakt een wegwerpkopie van een paar routebestanden en van
   regels.js, verandert er een byte in, en eist dat het getal meebeweegt. Een
   sleutel die je alleen op de echte boom kunt stellen, kun je alleen geloven. */
function sleutelVoor(routesMap, modules) {
  return kas.sleutelUit([
    kas.manifestVan(routesMap, (p) => p.endsWith('.js'), 'astgrens', { vers: true }),
    kas.leesVersie(modules),
    'astgrens-v1'
  ]);
}
const AST_MODULES = ['regels', 'parser', 'walk', 'lexer']
  .map(n => path.join(WORTEL, 'scripts', 'ast', n + '.js'));

/* De vergelijking zelf. Geeft terug WAT er is vergeleken en WAT er verschilde --
   niet of het goed was. Dat oordeel hoort in de toets, ook als de uitslag uit de
   kas komt: een kas die zelf beslist of iets slaagt, is een toets die zichzelf
   groenverklaart. */
function vergelijkAlles(bestanden) {
  const verschillen = [];
  let vergeleken = 0;
  for (const bestand of bestanden) {
    let boom;
    try { boom = parse(fs.readFileSync(bestand, 'utf8')); } catch (e) { continue; }
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
        if (heeftGrens(node, naam) !== heeftGrens_(node, naam)) {
          verschillen.push(path.relative(WORTEL, bestand) + ' regel ' + (node.lijn || '?') + ': "' + naam + '"');
        }
      }
    });
  }
  return { vergeleken, verschillen };
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

  /* Uit de kas als de invoer niet is veranderd, anders vers. Een onbruikbare
     uitslag (geen getal, geen lijst) laat de kas opnieuw rekenen in plaats van
     stil nul te melden -- LAT-regel 3. */
  const uit = kas.geheugen({
    naam: 'astgrens',
    sleutel: sleutelVoor(path.join(WORTEL, 'server', 'routes'), AST_MODULES),
    bereken: () => vergelijkAlles(bestanden),
    naarTekst: (u) => JSON.stringify(u),
    vanTekst: (t) => {
      const u = JSON.parse(t);
      return (u && Number.isFinite(u.vergeleken) && Array.isArray(u.verschillen)) ? u : null;
    }
  });
  const { vergeleken, verschillen } = uit;

  /* Er MOET vergeleken zijn. Nul vergelijkingen zou groen geven zonder iets te
     hebben aangetoond -- dezelfde valkuil als een lege bestandenlijst, en met een
     kas erbij ook de manier waarop een lege kasuitslag ongemerkt zou slagen. */
  assert.ok(vergeleken > 100, 'er zijn genoeg gevallen vergeleken (' + vergeleken + ')');
  assert.deepEqual(verschillen.slice(0, 20), [],
    'de twee implementaties zijn het overal eens (' + verschillen.length + ' verschillen van ' +
    vergeleken + ' gevallen):\n  ' + verschillen.slice(0, 20).join('\n  '));
});

test('de sleutel van de kas beweegt mee met ELKE invoer -- bewezen, niet beloofd', (t) => {
  /* EEN KAS OP EEN SECURITY-SCANNER IS ALLEEN ZO GOED ALS ZIJN SLEUTEL.

     Mist die sleutel een wijziging, dan blijft deze toets groen op een uitslag
     van gisteren terwijl er vandaag een route bij is gekomen die de regel breekt.
     Dat is stiller en erger dan een trage toets. Dus wordt de sleutel hier
     GEMUTEERD in plaats van vertrouwd: een wegwerpkopie van de invoer, een byte
     anders, en het getal moet veranderen.

     Er staan drie mutaties, want de sleutel heeft drie ingangen en een sleutel
     die er maar twee ziet is net zo blind als een die er een ziet. */
  const os = require('os');
  const tijdelijk = fs.mkdtempSync(path.join(os.tmpdir(), 'rtg-astgrens-'));
  t.after(() => { try { fs.rmSync(tijdelijk, { recursive: true, force: true }); } catch (e) {} });

  const routes = path.join(tijdelijk, 'routes');
  fs.mkdirSync(routes);
  fs.writeFileSync(path.join(routes, 'een.js'), 'module.exports = (req) => lijst[req.query.i];\n');
  fs.writeFileSync(path.join(routes, 'twee.js'), 'module.exports = (req) => andere[req.body.k];\n');
  const regels = path.join(tijdelijk, 'regels.js');
  fs.copyFileSync(path.join(WORTEL, 'scripts', 'ast', 'regels.js'), regels);

  const begin = sleutelVoor(routes, [regels]);
  assert.match(String(begin), /^[0-9a-f]{16,}$/, 'een sleutel hoort een hash te zijn, geen leeg getal');
  assert.equal(sleutelVoor(routes, [regels]), begin, 'dezelfde invoer geeft dezelfde sleutel');

  /* MUTATIE 1: een routebestand verandert. */
  fs.writeFileSync(path.join(routes, 'een.js'), 'module.exports = (req) => lijst[req.query.i] || null;\n');
  const naWijziging = sleutelVoor(routes, [regels]);
  assert.notEqual(naWijziging, begin,
    'een gewijzigd routebestand hoort de sleutel te verzetten. Doet hij dat niet, dan blijft deze ' +
    'toets groen op een uitslag van voor die wijziging -- op een SECURITY-scanner.');

  /* MUTATIE 2: er komt een routebestand BIJ. Dat is de gevaarlijkste, want een
     sleutel die alleen bestaande bestanden hasht, mist precies de nieuwe route
     die niemand nog heeft nagekeken. */
  fs.writeFileSync(path.join(routes, 'drie.js'), 'module.exports = (req) => derde[req.params.n];\n');
  const naNieuw = sleutelVoor(routes, [regels]);
  assert.notEqual(naNieuw, naWijziging, 'een NIEUW routebestand hoort de sleutel te verzetten');

  /* MUTATIE 3: de implementatie zelf verandert. Dan is de oude uitslag over een
     andere scanner gegaan en zegt hij niets over deze. */
  fs.appendFileSync(regels, '\n// opzettelijke wijziging voor de sleutelproef\n');
  assert.notEqual(sleutelVoor(routes, [regels]), naNieuw,
    'een gewijzigde regels.js hoort de sleutel te verzetten: de oude uitslag ging over een andere scanner');

  /* EN DE TEGENPROEF. Zonder deze zou een sleutel die bij ELKE aanroep een ander
     getal geeft alle drie de mutaties halen -- en dan is de kas nooit raak en
     betaal je hem elke ronde zonder er iets voor terug te krijgen. */
  const rust = sleutelVoor(routes, [regels]);
  assert.equal(sleutelVoor(routes, [regels]), rust,
    'zonder wijziging hoort de sleutel STIL te staan; beweegt hij altijd, dan is de kas nooit raak');
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
