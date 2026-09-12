#!/usr/bin/env node
/* DE GELDKAART: welke wegen bewegen waarde, en gaat elke beweging door de
   waardepoort?

   WAAROM DEZE METER BESTAAT. De vraag "werkt het betaalsysteem breed" was hier
   niet te beantwoorden. Er staan 322 scripts in package.json en geen ervan meet
   geld. De poort staat (kern/pay/poort.js), de toetsen zijn groen, en toch wist
   niemand of ELKE geldbeweging erlangs komt -- en dat is precies de vraag waar
   een betaalbedrijf op staat of valt.

   ==================== WAT ER EERST MISLUKTE, EN WAAROM ====================
   De eerste opzet was statisch: volg de aanroepgraaf van elke route naar
   kern/pay. Uitkomst: NUL routes raken de betaallaag. Dat is onzin, en de fout
   zat in de meter. AANROEPGRAAF.json heeft 23.716 kanten en er wijst er EEN naar
   server/kern/pay/, omdat routes hun `pay` uit de KERNZAK krijgen
   (server/routes/pay.js regel 7) en een statische lezer die injectie niet volgt.
   Een meter die daarop antwoordt meldt nul geldpaden en ziet er gezond uit.

   Dat is geen anekdote maar de reden voor de vorm hieronder. Deze kaart leidt
   niets af uit imports. Hij meet twee dingen langs twee onafhankelijke wegen, en
   telt ze NOOIT bij elkaar op.

   ==================== AS 1: DE KAART (structureel) ====================
   Welke ROUTES bewegen waarde. Niet geraden maar samengesteld uit twee bronnen
   die er al zijn: IDEMPROEF.json heeft per route GEMETEN welke collecties er
   bewogen, en kern/isolatie/effectcollecties.js zegt per collectie of zij geld
   draagt, met een grond per regel. De keten is dus
   route --(gemeten)--> collectie --(register)--> GELD_BEWEGEN.

   HET PLAFOND STAAT IN DE UITSLAG, want zonder plafond is dit getal misleidend:
   alleen routes waar de idempotentieproef werkelijk langskwam hebben een gemeten
   collectie. Een route die geen wereld had, staat hier niet -- en dat is iets
   anders dan een route die geen geld beweegt.

   ==================== AS 2: DE POORT (dynamisch) ====================
   De vraag die As 1 NIET beantwoordt: gaat zo'n schrijfactie door de poort? Dat
   is alleen te zien op het moment zelf, en daarvoor draait scripts/lib/geldwacht.js
   mee als preload: elke property-set op een geldcollectie wordt genoteerd met de
   stack erbij. Loopt die stack door kern/pay/boeking.js -- de guard waar de
   waardepoort in hangt -- dan heet de schrijfactie `beheerst`, anders
   `buiten-kern`.

   `buiten-kern` IS GEEN BESCHULDIGING, en wie dat verwart maakt een lijst die
   niemand meer leest. Een seed die de wereld opzet, een idempotentie-administratie
   en de herstart-aanvulling van het weergavevenster staan er allemaal terecht in.
   De kaart meldt ze met bestand en regelnummer zodat een mens ze kan wegstrepen;
   het oordeel is mensenwerk.

   WAT WEL EEN BEVINDING IS, en waar dit script op zakt: een schrijfactie op de
   KERNBAKKEN -- `paySaldi` (de saldostand) en `payBoekingen` (het grootboek) --
   die niet door de poort ging. Daar is de poort per definitie omzeild.

   ==================== WAT DEZE METER NIET BEWIJST ====================
   Hij ziet alleen wat er TIJDENS DE DRAAI is uitgevoerd. Een geldpad dat geen
   enkele toets aanroept, komt hier niet voorbij. Daarom staat de noemer altijd in
   de uitslag: `0 buiten de poort` betekent "geen gevonden onder N waargenomen
   schrijfacties", nooit "er zijn er geen". Een nul zonder noemer is een
   geruststelling zonder grond.

   Draai los:  npm run geldkaart        (kaart + poortproef)
               npm run geldkaart -- --snel   (alleen As 1, geen toetsen)  */
'use strict';

const fs = require('fs');
const path = require('path');
const { spawnSync } = require('child_process');

const WORTEL = path.join(__dirname, '..');
const SNEL = process.argv.includes('--snel');
const WACHTBESTAND = path.join(WORTEL, '.geldwacht.jsonl');

/* De toetsen die de poortproef aandrijven. GEEN eigen routeloper: de suite
   bestaat al en legt de geldwegen af zoals ze werkelijk worden aangeroepen, met
   echte inlog, echte idempotentiesleutels en echte volgorde. Een zelfgebouwde
   loper zou een tweede definitie van "een betaling doen" invoeren, en die twee
   lopen binnen een maand uiteen.

   De keuze is breed maar niet alles: de bankkant, de waardelaag, het tegoed, de
   terugweg, de zaakkant en de providernaad. Wie er een geldpad bij bouwt, hoort
   zijn toets hier bij te zetten -- en de uitslag zegt hoeveel er langskwam, dus
   een vergeten toets is aan het dalende aantal te zien. */
const AANDRIJVING = [
  'test/pay.test.js', 'test/pay-grootboek.test.js', 'test/waarde.test.js',
  'test/paytegoed.test.js', 'test/payterug.test.js', 'test/paybudget.test.js',
  'test/payvooraf.test.js', 'test/tegoed.test.js', 'test/bank.test.js',
  'test/geldbeleid.test.js', 'test/geldgrens.test.js', 'test/txgeld.test.js',
  'test/betaalproviders.test.js', 'test/betaalopdracht.test.js'
].filter(f => fs.existsSync(path.join(WORTEL, f)));

/* DE KERNBAKKEN, EN WELKE POORT ER BIJ HOORT. Vier bakken dragen een grootboek
   en ze horen bij TWEE verschillende poorten -- zie de uitleg in
   scripts/lib/geldwacht.js. Een schrijfactie op zo'n bak zonder de EIGEN poort is
   de bevinding waarvoor deze meter bestaat.

   De koppeling staat er per bak en niet als "een van beide poorten is goed",
   want dan zou een boeking die het bankgrootboek via de betaalpoort schrijft
   ongemerkt doorglippen -- en dat is nou juist de vermenging die een gedeelde
   geldlaag moet voorkomen, niet veroorzaken.

   De overige geldcollecties (codes, verzoeken, facturen, aanslagen) zijn
   administratie rondom een geldbeweging. Ze worden gemeld in de triagelijst maar
   laten de meter niet zakken: wie ze even hard maakt, krijgt een rode meter die
   niets meer onderscheidt. */
const KERNBAKKEN = Object.freeze({
  paySaldi: 'pay', payBoekingen: 'pay',
  bankSaldi: 'bank', bankBoekingen: 'bank'
});

/* HET STEMPEL KOMT UIT scripts/lib/stempel.js EN IS NIET ZELFGEMAAKT. De eerste
   versie zette hier datum + commit, en dat ziet er compleet uit terwijl het veld
   ontbreekt waar het om draait: `boomVuil`. Een meting uit een werkboom met
   ongecommitte code is NIET te herhalen, en een register dat daarover zwijgt
   leest als een reproduceerbare meting. De norm telt zulke registers apart
   (`registersUitVuileBoom`) -- en dat werkt alleen als het veld er staat. */
const { stempel } = require('./lib/stempel');

/* ---------------------------------------------------------------- AS 1 */
function kaart() {
  const uit = { geldcollecties: 0, routesMetGemetenOpslag: 0, geldroutes: [], perCollectie: {} };
  let PER_COLLECTIE;
  try { ({ PER_COLLECTIE } = require(path.join(WORTEL, 'server/kern/isolatie/effectcollecties.js'))); }
  catch (e) { uit.klacht = 'effectcollecties.js niet leesbaar: ' + e.message; return uit; }
  const GELD = new Set(Object.keys(PER_COLLECTIE).filter(k => PER_COLLECTIE[k][0] === 'GELD_BEWEGEN'));
  uit.geldcollecties = GELD.size;
  uit.gronden = {};
  for (const k of GELD) uit.gronden[k] = PER_COLLECTIE[k][1];

  let proef;
  try { proef = JSON.parse(fs.readFileSync(path.join(WORTEL, 'IDEMPROEF.json'), 'utf8')); }
  catch (e) { uit.klacht = 'IDEMPROEF.json niet leesbaar: ' + e.message; return uit; }

  for (const [sleutel, v] of Object.entries(proef.perRoute || {})) {
    const o = v.opslag;
    if (!o || !o.a) continue;
    uit.routesMetGemetenOpslag++;
    /* EEN COLLECTIE IS GESCHREVEN als haar stand tussen de drie oproepen van de
       idempotentieproef VERSCHILT. Gelijk blijven bewijst niets: een route kan
       een waarde hebben overschreven met dezelfde waarde. Dit is dus opnieuw een
       ONDERgrens, en die staat als zodanig in de uitslag. */
    const namen = new Set([...Object.keys(o.a || {}), ...Object.keys(o.b || {}), ...Object.keys(o.c || {})]);
    const geld = [];
    for (const n of namen) {
      if (!GELD.has(n)) continue;
      const a = JSON.stringify(o.a && o.a[n]), b = JSON.stringify(o.b && o.b[n]), c = JSON.stringify(o.c && o.c[n]);
      if (a !== b || b !== c) geld.push(n);
    }
    if (!geld.length) continue;
    uit.geldroutes.push({ route: sleutel, methode: v.methode, pad: v.pad, rol: v.rol,
      collecties: geld.sort(), idempotentie: v.idempotentie || 'ongemeten' });
    for (const g of geld) uit.perCollectie[g] = (uit.perCollectie[g] || 0) + 1;
  }
  uit.geldroutes.sort((a, b) => (a.pad || '').localeCompare(b.pad || ''));
  return uit;
}

/* ---------------------------------------------------------------- AS 2 */
function poortproef() {
  const uit = { gedraaid: false, toetsbestanden: AANDRIJVING.length, toetsen: null,
    schrijfacties: 0, beheerst: 0, buitenKern: 0, kernBuitenPoort: [], buiten: [], perCollectie: {} };
  if (SNEL) { uit.reden = '--snel: de poortproef is overgeslagen'; return uit; }
  if (!AANDRIJVING.length) { uit.reden = 'geen van de aandrijvende toetsbestanden bestaat'; return uit; }

  try { fs.unlinkSync(WACHTBESTAND); } catch (e) { /* stond er niet */ }
  const r = spawnSync(process.execPath, ['--test', ...AANDRIJVING], {
    cwd: WORTEL, encoding: 'utf8', timeout: 15 * 60 * 1000,
    env: { ...process.env,
      RTG_GELDWACHT_UIT: WACHTBESTAND,
      NODE_OPTIONS: [process.env.NODE_OPTIONS || '', '--require ' + path.join(WORTEL, 'scripts/lib/geldwacht.js')].join(' ').trim() }
  });
  uit.gedraaid = true;
  const tekst = (r.stdout || '') + (r.stderr || '');
  const pak = n => { const m = tekst.match(new RegExp('^# ' + n + ' (\\d+)$', 'm')); return m ? Number(m[1]) : null; };
  uit.toetsen = { totaal: pak('tests'), geslaagd: pak('pass'), gezakt: pak('fail') };

  let regels = [];
  try {
    regels = fs.readFileSync(WACHTBESTAND, 'utf8').trim().split('\n')
      .map(s => { try { return JSON.parse(s); } catch (e) { return null; } }).filter(Boolean);
  } catch (e) { uit.reden = 'de geldwacht schreef niets: ' + e.message; return uit; }

  const processen = regels.filter(x => x.soort === 'proces');
  uit.processen = processen.length;
  uit.klachten = processen.map(p => p.klacht).filter(Boolean);
  const w = regels.filter(x => x.soort !== 'proces');
  uit.schrijfacties = w.length;
  uit.uitgezonderd = 0; uit.container = 0;
  uit.perPoort = {};
  for (const x of w) {
    if (x.stand === 'beheerst') { uit.beheerst++; uit.perPoort[x.poort] = (uit.perPoort[x.poort] || 0) + 1; }
    else if (x.stand === 'uitgezonderd') uit.uitgezonderd++;
    else if (x.stand === 'container') uit.container++;
    else uit.buitenKern++;
    const c = uit.perCollectie[x.collectie] ||
      (uit.perCollectie[x.collectie] = { beheerst: 0, buitenKern: 0, uitgezonderd: 0, container: 0, poorten: {} });
    if (x.stand === 'beheerst') { c.beheerst++; c.poorten[x.poort] = (c.poorten[x.poort] || 0) + 1; }
    else if (x.stand === 'uitgezonderd') c.uitgezonderd++;
    else if (x.stand === 'container') c.container++;
    else c.buitenKern++;
  }
  /* De containerschrijvers apart, want `container` is GEEN vrijbrief: hier hoort
     een mens te kijken of er een saldostand tussen zit die in een keer wordt
     vervangen (kern/pay/opladen.js doet dat bij een herstart in motor-modus, en
     dat verandert wel degelijk geld). */
  const cbak = new Map();
  for (const x of w) {
    if (x.stand !== 'container') continue;
    const k = x.collectie + '|' + x.door;
    const b = cbak.get(k) || { collectie: x.collectie, door: x.door, aantal: 0, kernbak: !!KERNBAKKEN[x.collectie] };
    b.aantal++; cbak.set(k, b);
  }
  uit.containerSchrijvers = [...cbak.values()].sort((a, b) => b.aantal - a.aantal);
  /* Samengevoegd per (collectie, schrijver): honderd keer dezelfde regel is een
     bevinding en geen honderd bevindingen. */
  const bak = new Map();
  for (const x of w) {
    if (x.stand !== 'buiten-kern') continue;
    const k = x.collectie + '|' + x.door;
    const b = bak.get(k) || { collectie: x.collectie, door: x.door, aantal: 0, stack: x.stack,
      kernbak: !!KERNBAKKEN[x.collectie] };
    b.aantal++; bak.set(k, b);
  }
  uit.buiten = [...bak.values()].sort((a, b) => b.aantal - a.aantal);
  uit.kernBuitenPoort = uit.buiten.filter(b => b.kernbak);
  /* DE VERKEERDE POORT is een eigen bevinding naast "geen poort": een bankboeking
     die door de betaalpoort komt is bewaakt maar door de verkeerde regels, en die
     vermenging is precies wat onzichtbaar blijft als je alleen op `beheerst` telt. */
  uit.verkeerdePoort = [];
  for (const [collectie, c] of Object.entries(uit.perCollectie)) {
    const hoort = KERNBAKKEN[collectie];
    if (!hoort) continue;
    for (const [poort, aantal] of Object.entries(c.poorten))
      if (poort !== hoort) uit.verkeerdePoort.push({ collectie, poort, hoort, aantal });
  }
  return uit;
}

/* ---------------------------------------------------------------- uitslag */
/* DE WACHT, en waarom hij hier hoort. scripts/meetkeuring.js eist dat een
   instrument zijn werk achter `require.main` zet, en die regel komt uit een
   echte fout in dit huis: een laadcontrole van de rolproef startte een VOLLEDIGE
   ronde en schreef ROLPROEF.json van 3377 beproefde routes terug naar 292.
   Zonder deze wacht doet dit script hetzelfde -- wie `require('./geldkaart')`
   schrijft om bij bouw() te komen, draait veertien toetsbestanden en overschrijft
   GELDKAART.json. De keuring wees dit bestand aan zodra het in versheid.js
   kwam te staan, en dat was terecht. */
if (require.main === module) hoofd();

function hoofd() {
const as1 = kaart();
const as2 = poortproef();

const register = {
  soort: 'meting',
  uitleg: 'De geldkaart: welke wegen waarde bewegen (As 1, structureel uit ' +
    'IDEMPROEF.json x effectcollecties.js) en of elke beweging door de waardepoort ' +
    'ging (As 2, dynamisch gemeten met scripts/lib/geldwacht.js).',
  stempel: stempel(),
  grens: 'De twee assen worden NOOIT opgeteld. As 1 telt routes en is een ONDERgrens: ' +
    'alleen routes waar de idempotentieproef langskwam hebben een gemeten collectie, en ' +
    'een collectie die tussen drie oproepen gelijk bleef geldt als niet geschreven. As 2 ' +
    'telt schrijfacties tijdens een draai en ziet alleen wat er werkelijk is uitgevoerd: ' +
    'nul buiten de poort betekent "geen gevonden onder de waargenomen schrijfacties", ' +
    'nooit "er zijn er geen". Daarom staat de noemer altijd in de uitslag.',
  graad: { as1: 'gemeten', as2: as2.gedraaid ? 'gemeten' : 'onbekend',
    toelichting: 'As 1 leunt op een gemeten register maar erft zijn plafond; As 2 is een ' +
      'waarneming op de schrijfkant en erft de dekking van de aandrijvende toetsen.' },
  as1Kaart: as1,
  as2Poort: as2,
  nietGemeten: {
    externeRails: 'Geen enkele providersleutel staat gezet, dus betaal.js weigert fail-closed ' +
      'en geen enkel extern betaalpad is in deze meting uitgevoerd.',
    reconciliatie: 'Er is geen meting van intern grootboek tegen providerstand; die bestaat niet.',
    ongedektePaden: 'Geldpaden die geen enkele aandrijvende toets aanroept, zijn niet waargenomen.'
  }
};

fs.writeFileSync(path.join(WORTEL, 'GELDKAART.json'), JSON.stringify(register, null, 2) + '\n');

/* ---------------------------------------------------------------- scherm */
const g = n => String(n).padStart(5);
console.log('\nRTG GELDKAART   ' + String(register.stempel.op).slice(0, 10) + '  ' + register.stempel.commit);
console.log('─'.repeat(64));
console.log('AS 1  de kaart (structureel, ONDERgrens)');
console.log('  geldcollecties in het register   ' + g(as1.geldcollecties));
console.log('  routes met een gemeten opslag    ' + g(as1.routesMetGemetenOpslag));
console.log('  routes die waarde bewegen        ' + g(as1.geldroutes.length));
if (as1.geldroutes.length) {
  const idem = {};
  for (const r of as1.geldroutes) idem[r.idempotentie] = (idem[r.idempotentie] || 0) + 1;
  console.log('    waarvan idempotent bewezen     ' + g(idem.beschermd || 0));
  console.log('    waarvan ongemeten              ' + g(idem.ongemeten || 0));
}
if (as1.klacht) console.log('  KLACHT: ' + as1.klacht);

console.log('\nAS 2  de poortproef (dynamisch, ' + (as2.gedraaid ? 'gedraaid' : 'niet gedraaid') + ')');
if (!as2.gedraaid) {
  console.log('  ' + (as2.reden || 'overgeslagen'));
} else {
  console.log('  aandrijvende toetsbestanden      ' + g(as2.toetsbestanden));
  if (as2.toetsen) console.log('  toetsen geslaagd / gezakt        ' + g(as2.toetsen.geslaagd) + ' /' + g(as2.toetsen.gezakt));
  console.log('  waargenomen schrijfacties        ' + g(as2.schrijfacties));
  console.log('    beheerst (door een poort)      ' + g(as2.beheerst) +
    '   [' + Object.entries(as2.perPoort || {}).map(([k, v]) => k + ':' + v).join(' ') + ']');
  console.log('    uitgezonderd, met reden        ' + g(as2.uitgezonderd));
  console.log('    containerschrijfacties         ' + g(as2.container) + '   (hele bak, geen waarde erin)');
  console.log('    buiten de kern                 ' + g(as2.buitenKern));
  console.log('\n  de kernbakken (elk met zijn EIGEN poort):');
  for (const [bak, hoort] of Object.entries(KERNBAKKEN)) {
    const c = as2.perCollectie[bak];
    if (!c) { console.log('    ' + bak.padEnd(16) + 'niet waargenomen'); continue; }
    console.log('    ' + bak.padEnd(16) + 'poort ' + hoort.padEnd(6) +
      g(c.beheerst) + ' beheerst,' + String(c.uitgezonderd).padStart(3) + ' uitgez.,' +
      String(c.container).padStart(3) + ' cont.,' + String(c.buitenKern).padStart(3) + ' buiten');
  }
  if (as2.buiten.length) {
    console.log('\n  buiten de kern, per schrijver (triage, geen oordeel):');
    for (const b of as2.buiten.slice(0, 15))
      console.log('    ' + String(b.aantal).padStart(4) + '  ' + b.collectie.padEnd(18) + b.door + (b.kernbak ? '   << KERNBAK' : ''));
  }
  if (as2.containerSchrijvers && as2.containerSchrijvers.some(c => c.kernbak)) {
    console.log('\n  containerschrijvers op een kernbak (nakijken, geen oordeel):');
    for (const c of as2.containerSchrijvers.filter(x => x.kernbak))
      console.log('    ' + String(c.aantal).padStart(4) + '  ' + c.collectie.padEnd(18) + c.door);
  }
  if (as2.klachten && as2.klachten.length) console.log('\n  KLACHTEN: ' + as2.klachten.join('; '));
}
console.log('\nniet gemeten: rails uit, geen reconciliatie, ongedekte paden onbekend');
console.log('geschreven: GELDKAART.json\n');

/* DE METER ZAKT op een schrijfactie op de kernbakken buiten de poort, en op een
   gezakte aandrijftoets -- want dan zegt de poortproef niets over een huis dat
   werkt. Niet op `buiten-kern` in het algemeen: dat is een triagelijst. */
let fout = 0;
if (as2.verkeerdePoort && as2.verkeerdePoort.length) {
  for (const v of as2.verkeerdePoort)
    console.error('ZAKT: ' + v.collectie + ' werd ' + v.aantal + 'x geschreven via de ' +
      v.poort + '-poort terwijl de ' + v.hoort + '-poort erbij hoort.');
  fout = 1;
}
if (as2.kernBuitenPoort && as2.kernBuitenPoort.length) {
  console.error('ZAKT: ' + as2.kernBuitenPoort.length + ' schrijver(s) raken een kernbak buiten de waardepoort.');
  fout = 1;
}
if (as2.gedraaid && as2.toetsen && as2.toetsen.gezakt) {
  console.error('ZAKT: ' + as2.toetsen.gezakt + ' aandrijvende toets(en) gezakt; de poortproef draaide op een kapot huis.');
  fout = 1;
}
process.exit(fout);
}

/* Wat dit bestand WEL naar buiten geeft: de twee assen als functie, zodat een
   toets ze kan draaien zonder de hele ronde te starten. */
module.exports = { kaart, poortproef };
