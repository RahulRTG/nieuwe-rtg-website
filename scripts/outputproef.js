#!/usr/bin/env node
/* ============================================================================
   DE OUTPUT-PROEF -- KIJKT IEMAND NAAR DE INHOUD VAN HET ANTWOORD?

   DE AS DIE NOOIT EEN INSTRUMENT HAD. In de bewijsmatrix stond OUTPUT voor ALLE
   4185 routes op ongemeten, met als reden: "de liegpoort per ROUTE i.p.v. per
   toetsbestand". Dat leest als "er moet nog iets gebouwd worden", en dat klopte
   maar half: het bewijs LAG er al, alleen op het verkeerde niveau.

   WAT ER AL WAS. server/opzet/liegpoort.js vervangt met RTG_LIEG=/api/ het
   antwoord van elk endpoint door iets geldigs maar leegs. scripts/mutatie.js
   draait daarmee elk servertoetsbestand twee keer -- eerlijk en liegend -- en
   noteert of hij zakt. Blijft een toets groen terwijl alles liegt, dan kijkt hij
   nergens naar de inhoud. Dat is precies de OUTPUT-vraag, maar het antwoord
   staat per TOETSBESTAND en de matrix vraagt het per ROUTE.

   WAT ONTBRAK. De koppeling route -> toets. Het routejournaal noteerde alleen
   DAT een route was geraakt, niet door wie. Sinds server/routelog.js ook een
   TOETS-regel schrijft, is die koppeling er.

   HET OORDEEL, EN ZIJN GRENS. Dit is de eerlijkste vorm die uit deze data valt
   te halen, en hij is smaller dan je zou willen:

     bewezen     minstens een INHOUDGEVOELIG toetsbestand raakt deze route, en
                 dat bestand raakt GEEN ANDERE /api/-route. Dan is de gevoeligheid
                 aan deze route toe te schrijven en aan niets anders.
     onbeslist   inhoudgevoelige toetsen raken hem wel, maar ze raken er meer.
                 Zo'n toets kan op de inhoud van een ANDERE route zijn gezakt.
                 Dat is geen bewijs over deze route, en het als bewijs tellen zou
                 dezelfde fout zijn die de AUTH-as al 294 cellen kostte.
     blind       alleen toetsen die groen bleven terwijl alles loog. Die kijken
                 aantoonbaar nergens naar de inhoud. Dat is GEEN bewijs dat de
                 route stuk is -- het is bewijs over de TOETSEN.
     ongemeten   geen enkele toets raakt deze route, of de mutatiemotor kent het
                 toetsbestand niet.

   Draai:  node scripts/outputproef.js
           node scripts/outputproef.js --lees <journaal>
   ========================================================================== */
'use strict';
const fs = require('fs');
const path = require('path');
const { stempel } = require('./lib/stempel');

const WORTEL = path.join(__dirname, '..');
const argv = process.argv.slice(2);
const JOURNAAL = (argv.find(a => a.startsWith('--lees=')) || '').slice(7) ||
  (argv.includes('--lees') ? argv[argv.indexOf('--lees') + 1] : '') ||
  path.join(WORTEL, '.routejournaal');
const UITSLAG = path.join(WORTEL, 'OUTPUTPROEF.json');

/* Route -> de toetsbestanden die hem raakten, uit de TOETS-regels van het
   journaal. Vorm: `TOETS METHODE /pad toetsnaam`. */
function koppeling(pad) {
  let tekst = '';
  try { tekst = fs.readFileSync(pad, 'utf8'); } catch (e) { return null; }
  const perRoute = new Map();
  const perToets = new Map();
  for (const regel of tekst.split('\n')) {
    const r = regel.trim();
    if (!r.startsWith('TOETS ')) continue;
    const v = r.slice(6).split(' ').filter(Boolean);
    if (v.length < 3) continue;
    const methode = v[0], route = v[1], toets = v.slice(2).join(' ');
    const sleutel = methode + ' ' + route;
    if (!perRoute.has(sleutel)) perRoute.set(sleutel, new Set());
    perRoute.get(sleutel).add(toets);
    if (!perToets.has(toets)) perToets.set(toets, new Set());
    perToets.get(toets).add(sleutel);
  }
  return { perRoute, perToets };
}

/* Welke toetsbestanden zijn INHOUDGEVOELIG volgens de mutatiemotor: een
   servertoets die zakte terwijl alleen zijn eigen domein loog en de deuren open
   bleven. `scherp: 'gezakt'` is precies dat oordeel; 'overleefd' is het
   tegendeel en telt hier als blind. */
function gevoeligheid() {
  let t;
  try { t = JSON.parse(fs.readFileSync(path.join(WORTEL, 'MUTATIES.json'), 'utf8')).toetsen; }
  catch (e) { return null; }
  const gevoelig = new Set(), blind = new Set();
  for (const [naam, v] of Object.entries(t || {})) {
    if (v.soort !== 'server') continue;
    if (v.scherp === 'gezakt') gevoelig.add(naam);
    else if (v.scherp === 'overleefd' || v.staat === 'overleefd') blind.add(naam);
  }
  return { gevoelig, blind };
}

/* HET OORDEEL ALS PURE FUNCTIE, en dat is geen netheid maar noodzaak.

   Toen dit nog binnen meet() zat -- dat een journaalbestand en MUTATIES.json van
   schijf leest -- was het alleen te toetsen door de regel in de toets NA TE
   BOUWEN. Zo'n toets kan per definitie niet zakken als het instrument verandert:
   hij toetst zijn eigen kopie (LAT.md regel 9). De mutatieproef ving dat: de
   toerekening weghalen liet de suite groen.

   Nu neemt hij zijn vier ingangen als argument en is hij zonder schijf, zonder
   server en zonder journaal te beproeven. */
/* ---- WELKE ROUTES ZIJN INFRASTRUCTUUR ----

   De toerekening vroeg eerst: raakt deze gevoelige toets GEEN ANDERE route? Dat
   leverde NUL bewezen routes op, en dat was geen strengheid maar een regel die
   niet kan vuren: elke toets raakt ook de gezondheidscontrole en de inlog. Een
   regel die nooit `bewezen` kan opleveren meet niets (LAT.md regel 9).

   Wat infrastructuur is, wordt GEMETEN en niet opgesomd: een route die door meer
   dan de helft van alle toetsbestanden wordt geraakt, is niet waar een van die
   toetsen over gaat. Gemeten op deze suite zijn dat er drie -- /api/health
   (540/540), /api/ready (504/540) en /api/auth/register (301/540).

   De drempel is bewust niet afgesteld op de uitkomst: bij 50%, 30% en 20% komt
   er 7, 7 en 8 uit. Een cijfer dat nauwelijks van de grens afhangt is een cijfer
   over de suite en niet over de grens. */
function infrastructuur(perToets, deel) {
  const tel = new Map();
  for (const s of perToets.values()) for (const r of s) tel.set(r, (tel.get(r) || 0) + 1);
  const grens = perToets.size * (deel || 0.5);
  return new Set([...tel].filter(([, c]) => c > grens).map(([r]) => r));
}

function oordeel(perRoute, perToets, gevoelig, blind, gemeten) {
  const infra = infrastructuur(perToets);
  const perRouteUit = {};
  const telling = { bewezen: 0, onbeslist: 0, blind: 0, ongemeten: 0 };
  for (const [route, toetsen] of perRoute) {
    const gevoelige = [...toetsen].filter(t => gevoelig.has(t));
    if (!gevoelige.length) {
      const blinde = [...toetsen].filter(t => blind.has(t));
      const staat = blinde.length ? 'blind' : 'ongemeten';
      perRouteUit[route] = { staat, toetsen: [...toetsen].slice(0, 6),
        reden: blinde.length
          ? 'alleen toetsen die groen bleven terwijl alles loog; die kijken niet naar de inhoud'
          : 'geen enkele toets die deze route raakt is door de mutatiemotor gemeten' };
      telling[staat]++;
      continue;
    }
    /* DE TOEREKENING. Een inhoudgevoelige toets die ook tien andere routes
       raakt, kan op de inhoud van een van die tien zijn gezakt. Alleen als hij
       er precies EEN raakt, valt de gevoeligheid aan deze route toe te
       schrijven. */
    /* Een gerichte meting (--meet) slaat alles over: daar is over DEZE route
       gelogen en gekeken of een toets het merkte. Dat is direct bewijs en geen
       toerekening. */
    const direct = gemeten && gemeten[route];
    if (direct) {
      perRouteUit[route] = direct.merkt
        ? { staat: 'bewezen', bron: 'outputproef (gericht)', toetsen: [direct.toets],
            reden: 'er is over DEZE route gelogen en ' + direct.toets + ' zakte daarop' }
        : { staat: 'blind', bron: 'outputproef (gericht)', toetsen: [direct.toets],
            reden: 'er is over DEZE route gelogen en ' + direct.toets + ' bleef groen; ' +
              'geen enkele toets kijkt naar deze inhoud' };
      telling[perRouteUit[route].staat]++;
      continue;
    }
    const alleen = gevoelige.filter(t => {
      const eigen = [...(perToets.get(t) || [])].filter(x => !infra.has(x));
      return eigen.length === 1;
    });
    if (alleen.length) {
      perRouteUit[route] = { staat: 'bewezen', bron: 'outputproef', toetsen: alleen.slice(0, 6),
        reden: 'deze toets(en) zakken als het antwoord leeg wordt, en raken geen andere route' };
      telling.bewezen++;
    } else {
      const kleinste = Math.min(...gevoelige.map(t =>
        [...(perToets.get(t) || [])].filter(x => !infra.has(x)).length));
      perRouteUit[route] = { staat: 'onbeslist', toetsen: gevoelige.slice(0, 6),
        reden: 'inhoudgevoelige toetsen raken deze route, maar elk daarvan raakt er meer ' +
          '(de smalste: ' + kleinste + '); de gevoeligheid is niet aan deze route toe te schrijven' };
      telling.onbeslist++;
    }
  }
  return { telling, perRoute: perRouteUit };
}

/* De gerichte metingen uit een eerdere ronde. Ze STAPELEN: elke ronde meet er
   een paar honderd bij, en wat al gemeten is hoeft niet opnieuw. Zonder dit is
   gericht meten zinloos werk -- de volgende ronde gooit het weg. */
function eerderGemeten() {
  try {
    const j = JSON.parse(fs.readFileSync(UITSLAG, 'utf8'));
    return j.gericht || {};
  } catch (e) { return {}; }
}

/* `versGericht` is de uitslag van een gerichte ronde die NOG NIET op schijf
   staat. Zonder die parameter liep elke batch een ronde achter: meet() las de
   gerichte metingen van schijf, terwijl de verse pas NA meet() in het bestand
   belandden. Het register was daardoor intern tegenstrijdig -- `gericht` zei
   merkt, `perRoute` zei onbeslist -- en de telling (en de bewijsmatrix erop)
   telde 18 gemeten routes een ronde lang niet mee. */
function meet(versGericht) {
  const k = koppeling(JOURNAAL);
  if (!k) return { fout: 'geen journaal op ' + JOURNAAL + '; draai de suite met RTG_ROUTELOG' };
  const g = gevoeligheid();
  if (!g) return { fout: 'geen MUTATIES.json; draai npm run mutatie' };
  if (!k.perRoute.size) {
    return { fout: 'het journaal bevat geen TOETS-regels. Die schrijft server/routelog.js ' +
      'sinds de OUTPUT-as bestaat; een journaal van voor die tijd kan deze vraag niet beantwoorden.' };
  }

  const o = oordeel(k.perRoute, k.perToets, g.gevoelig, g.blind, versGericht || eerderGemeten());
  const perRoute = o.perRoute;
  const telling = o.telling;

  return { stempel: stempel({ journaal: path.relative(WORTEL, JOURNAAL) }),
    uitleg: 'Per route: kijkt een toets naar de INHOUD van het antwoord. Gemeten door de ' +
      'liegpoort (RTG_LIEG) per toetsbestand te koppelen aan de routes die dat bestand raakt. ' +
      'Alleen een toets die GEEN andere route raakt levert bewijs over DEZE route.',
    grens: 'zegt niets over routes die geen enkele toets raakt, en niets over de vraag of de ' +
      'inhoud KLOPT -- alleen of iemand ernaar kijkt.',
    gemeten: telling, routes: Object.keys(perRoute).length, perRoute };
}

/* ---- GERICHT METEN: LIEG OVER EEN ROUTE EN KIJK WIE HET MERKT ----

   De toerekening hierboven is een AFLEIDING: een gevoelige toets die maar een
   route raakt, zakt waarschijnlijk op die route. Dat levert er tien op, en voor
   de andere 4170 valt niets af te leiden.

   Dit is de directe meting, en hij kan pas sinds het journaal TOETS-regels
   draagt: zet de liegpoort op EEN route en draai alleen de toetsen die hem
   raken. Zakt er een, dan kijkt die toets aantoonbaar naar de inhoud van DEZE
   route -- geen afleiding meer, maar een waarneming.

   WAAROM DIT NIET IN EEN KEER KAN. Per route een toetsbestand draaien kost
   seconden tot een minuut; 4170 routes is dagen. Daarom stapelt hij: elke ronde
   meet er een paar honderd bij en bewaart de uitslag in `gericht`. Wat al
   gemeten is, wordt niet opnieuw gedaan. Zo groeit deze as met het werk mee in
   plaats van te wachten op een ronde die niemand ooit start.

   DE KEUZE VAN DE TOETS is de smalste die de route raakt: die gaat er het meest
   waarschijnlijk over, en hij is het snelst. Blijft hij groen, dan is de
   uitspraak "geen enkele toets die deze route raakt kijkt naar zijn inhoud" te
   sterk -- er is er EEN geprobeerd. Daarom heet dat hier `blind` met de naam van
   de toets erbij, en niet "bewezen dat niemand kijkt". */
/* ---- WELKE ROUTES KUNNEN NOG GERICHT GEMETEN WORDEN ----

   Losgetrokken uit gerichteRonde(), zodat de parallelle band (scripts/
   outputband.js) dezelfde selectie gebruikt als de seriele ronde. Een tweede
   kopie van "welke route is de moeite waard" zou binnen een week uiteenlopen
   (LAT.md regel 4).

   `al` mag worden meegegeven, want de band weet welke routes al bezig zijn en
   die horen niet nog een keer te worden uitgedeeld. */
function kiesKandidaten(al) {
  const { DEUREN } = require('./mutatie');
  const deuren = DEUREN.split(',');
  const isDeur = (pad) => deuren.some(d => pad === d || pad.startsWith(d));
  const k = koppeling(JOURNAAL);
  const g = gevoeligheid();
  if (!k || !g) return null;
  const infra = infrastructuur(k.perToets);
  const gedaan = al || eerderGemeten();

  const kandidaten = [];
  for (const [route, toetsen] of k.perRoute) {
    if (gedaan[route] || infra.has(route)) continue;
    if (isDeur(route.slice(route.indexOf(' ') + 1))) continue;
    const gevoelig = [...toetsen].filter(t => g.gevoelig.has(t));
    if (!gevoelig.length) continue;
    const smalste = gevoelig
      .map(t => ({ t, n: [...(k.perToets.get(t) || [])].filter(x => !infra.has(x)).length }))
      .sort((a, b) => a.n - b.n)[0];
    if (smalste.n === 1) continue;          // die is al via toerekening bewezen
    kandidaten.push({ route, toets: smalste.t, breedte: smalste.n });
  }
  kandidaten.sort((a, b) => a.breedte - b.breedte);
  return kandidaten;
}

/* ---- EEN ROUTE METEN, MET DE CONTROLERUN ----

   Liegt over EEN route en kijkt of de smalste toets erop het merkt. Zakt hij,
   dan draait dezelfde toets nog een keer ZONDER leugen: alleen als hij dan groen
   is bewijst de zakking iets over de inhoud (zie de controlerun-uitleg hieronder).
   Geeft { staat: 'merkt' | 'blind' | 'stoornis' } terug. Een pure meting: geen
   register, geen schijf -- de aanroeper (seriele ronde of parallelle band) legt
   vast. */
function meetEen(route, toets, opties) {
  const { draaiToets, DEUREN } = require('./mutatie');
  const o = opties || {};
  /* DE BASISLIJN, EEN KEER GEMETEN IN PLAATS VAN PER ROUTE. De controlerun
     hieronder vraagt "is deze toets groen ZONDER leugen". Voor de honderden
     routes die dezelfde toets delen (auth-rol.test.js raakt er 194) is dat
     honderden keren dezelfde vraag. Wie een `basisGroen` meegeeft -- een Set of
     Map van toetsen die in een eerste ronde groen bleken -- slaat de controlerun
     over: staat de toets erin, dan is een zakking onder de leugen toe te
     rekenen; staat hij er NIET in (hij was al rood), dan is het stoornis en valt
     er niets aan de leugen toe te schrijven. Zo blijft het onderscheid uit de
     controlerun overeind, maar zonder hem duizenden keren te herhalen. */
  const kentBasis = o.basisGroen !== undefined && o.basisGroen !== null;
  const heeft = (t) => o.basisGroen instanceof Set ? o.basisGroen.has(t)
    : o.basisGroen instanceof Map ? o.basisGroen.get(t) : !!(o.basisGroen && o.basisGroen[t]);
  if (kentBasis && !heeft(toets)) return { staat: 'stoornis' };   // was al rood in de basislijn

  const pad = route.slice(route.indexOf(' ') + 1);
  const r = draaiToets(path.join(WORTEL, 'test', toets),
    { RTG_LIEG: pad, RTG_LIEG_NIET: DEUREN }, 240000);
  if ((r.gezakt || 0) === 0) return { staat: 'blind' };
  if (kentBasis) return { staat: 'merkt' };   // basislijn zei groen, leugen maakt rood: toe te rekenen

  /* DE CONTROLERUN (zonder basislijn). Een toets die onder de leugen zakt, kan
     ook zakken door iets anders -- een trage machine, een poortbotsing, een toets
     die net vandaag stuk is. Dat als MERKT tellen maakt een valse bewezen-cel in
     de matrix, precies het bewijs dat niemand ooit nakijkt (LAT.md regel 10).
     Alleen als dezelfde toets ZONDER leugen groen is, bewijst de zakking iets
     over de inhoud. */
  const controle = draaiToets(path.join(WORTEL, 'test', toets), {}, 240000);
  return { staat: (controle.gezakt || 0) > 0 ? 'stoornis' : 'merkt' };
}

/* Draait EEN toets zonder leugen en zegt of hij groen was. De basislijn van de
   band leunt hierop; het is dezelfde draaiToets die de controlerun gebruikt. */
function basislijnVan(toets) {
  const { draaiToets } = require('./mutatie');
  const r = draaiToets(path.join(WORTEL, 'test', toets), {}, 240000);
  return { toets, groen: (r.gezakt || 0) === 0, gedraaid: r.gedraaid !== undefined ? r.gedraaid : null };
}

function gerichteRonde(aantal) {
  const kandidaten = kiesKandidaten();
  if (!kandidaten) { console.error('  geen journaal of geen MUTATIES.json'); return null; }
  const doen = kandidaten.slice(0, Math.max(1, aantal));
  console.log('\n  gericht meten: ' + doen.length + ' routes van de ' + kandidaten.length + ' die nog kunnen\n');
  const gericht = Object.assign({}, eerderGemeten());
  let merkt = 0, blind = 0, stoornis = 0;
  for (let i = 0; i < doen.length; i++) {
    const d = doen[i];
    const u = meetEen(d.route, d.toets);
    if (u.staat === 'merkt') merkt++;
    else if (u.staat === 'blind') blind++;
    else stoornis++;
    if (u.staat !== 'stoornis') {
      gericht[d.route] = { toets: d.toets, merkt: u.staat === 'merkt', op: new Date().toISOString() };
    }
    const label = u.staat === 'merkt' ? 'MERKT ' : u.staat === 'blind' ? 'blind ' : 'STOORNIS';
    process.stdout.write('  ' + String(i + 1).padStart(4) + '/' + doen.length + '  ' +
      label + ' ' + d.route.slice(0, 58).padEnd(60) + d.toets + '\n');
  }
  console.log('\n  gemeten: ' + merkt + ' merken de leugen, ' + blind + ' niet' +
    (stoornis ? ', ' + stoornis + ' stoornis (toets faalt ook zonder leugen; niet vastgelegd)' : '') + '.');
  return gericht;
}

module.exports = { meet, oordeel, koppeling, gevoeligheid, infrastructuur, eerderGemeten,
  gerichteRonde, kiesKandidaten, meetEen, basislijnVan };

if (require.main !== module) return;

const MEET = Number((argv.find(a => a.startsWith('--meet=')) || '').slice(7)) || 0;
if (MEET) {
  const gericht = gerichteRonde(MEET);
  if (!gericht) { process.exitCode = 2; return; }
  const na = meet(gericht);
  if (!na.fout) fs.writeFileSync(UITSLAG, JSON.stringify(Object.assign(na, { gericht }), null, 1) + '\n');
  console.log('  weggeschreven in OUTPUTPROEF.json\n');
  process.exitCode = 0;
  return;
}

const uit = meet();
if (uit.fout) { console.error('\n  ' + uit.fout + '\n'); process.exitCode = 2; return; }
if (argv.includes('--json')) { console.log(JSON.stringify(uit, null, 1)); process.exitCode = 0; return; }

fs.writeFileSync(UITSLAG, JSON.stringify(uit, null, 1) + '\n');
console.log('\n=== DE OUTPUT-PROEF ===\n');
console.log('  journaal              : ' + path.relative(WORTEL, JOURNAAL));
console.log('  routes met een toets  : ' + uit.routes);
console.log('');
console.log('  BEWEZEN (een toets zakt op de lege inhoud, en raakt niets anders) : ' + uit.gemeten.bewezen);
console.log('  onbeslist (gevoelige toetsen, maar niet toe te rekenen)          : ' + uit.gemeten.onbeslist);
console.log('  blind (alleen toetsen die niets van de inhoud merken)            : ' + uit.gemeten.blind);
console.log('  ongemeten (geen toets die de mutatiemotor kent)                  : ' + uit.gemeten.ongemeten);
console.log('\n  weggeschreven in OUTPUTPROEF.json\n');
process.exitCode = 0;
