#!/usr/bin/env node
/* ============================================================================
   HET VERANDERBEREIK -- van welke toets weten we WELKE BRONBESTANDEN hij dekt?

   WAAROM DIT ER IS

   Het aantrekkelijke plan heet Affected Proof Selection: classificeer een
   commit en draai alleen het bewijs dat hij raakt. Dit huis heeft dat plan al
   een keer tegengehouden, en met reden. `scripts/impactbereik.js` mat de
   statische kant en vond een blinde vlek van 56%: ruim de helft van de
   toetsbestanden heeft GEEN require-kant naar server/ -- ze starten de server
   als apart proces en raken de oppervlakte over HTTP. Een planner op die graaf
   slaat ze over en meldt groen, "de stilste vorm van kapot die dit huis kent".

   Wat er sindsdien bij is gekomen, is de andere helft. Drie bronnen bestaan en
   niemand heeft ze aan elkaar geknoopt:

     scripts/attributie.js   welke ROUTES een toets aanraakte -- gemeten, niet
                             gelezen, uit het routejournaal, met de toetsnaam
                             erbij sinds test/toetsnaam.js hem per toetsproces
                             zet. Die meter zegt zelf in `nietGemeten` dat hij
                             geen BRONBESTANDEN kent, en noemt dat een tekort.
     ROUTEBRON.json          welke route in welk BRONBESTAND wordt afgehandeld
                             -- 4942 routes, uit de ROUTER en niet uit de
                             bronboom.
     de require-graaf        welk bronbestand welk ander bronbestand nodig heeft
                             (scripts/lib/werkelijkheid.js, via impactbereik).

   Route -> bestand is precies de schakel die attributie.js miste. Deze meter
   legt hem, en meet wat dat oplevert. Dat is de hele opzet: AANSLUITEN, niet
   uitvinden.

   WAT DIT UITDRUKKELIJK NIET IS -- en dit is geen slag om de arm maar de grens
   van de laag.

   Dit is GEEN selector. Er wordt hier niets overgeslagen. `KEURING.md` zegt:
   volledige dekking is de uitgangstoestand, en versmalling is een recht dat per
   effect verdiend moet worden -- "zekerheid mag snelheid toestaan; onzekerheid
   mag nooit snelheid afdwingen". Deze meter levert de zekerheidskant van die
   zin en beslist zelf niets. Wie hem aan een draaier hangt zonder dat
   `zonderBereik` nul is, bouwt exact de keuring die toetsen overslaat omdat de
   meting ontbrak.

   TWEE ASSEN, EN ZE WORDEN NOOIT OPGETELD TOT EEN CIJFER. Ze missen namelijk
   verschillende dingen, en een samengesteld getal verbergt welke van de twee
   bewoog -- dezelfde reden waarom scripts/tredeproef.js zuiver en beproefd
   apart meldt, en scripts/machinedekking.js zijn twee assen apart houdt.

     STATISCH    de omgekeerde require-graaf. Compleet voor wat hij ziet, en
                 hij ziet een spawn niet. Kost niets en draait altijd.
     WAARGENOMEN het routejournaal van een ECHTE ronde. Ziet de spawn wel, en
                 ziet alleen wat er die ronde gedraaid heeft.

   DE VEILIGHEIDSRICHTING STAAT IN DE UITVOER EN NIET IN EEN LATER HOOFD. Elke
   toets waarvan geen van beide assen het bereik bepaalt, draagt
   `volleRing: true`. Een onvolledig journaal duwt toetsen dus naar de VOLLE
   ring en nooit eruit: de meter faalt naar "alles draaien" en niet naar
   "overslaan". Dat is de enige kant waarop hij fout mag gaan.

   EN EEN AFWEZIGE TOETS IS GEEN NUL. `ongemeten` betekent dat er niets over
   bewezen is, nooit dat de toets niets aanraakt -- de regel van attributie.js,
   hier onverkort. Een toets die volledig in het proces draait raakt geen route
   en hoort gewoon als ongemeten te staan.

   DRAAIEN

     npm run veranderbereik                       (leest .routejournaal)
     npm run veranderbereik -- --lees a.log --lees b.log
     npm run veranderbereik -- --raakt server/kern/pay/poort.js
     npm run veranderbereik:vastleggen
     npm run veranderbereik:controle              (normtand: mag alleen dalen)
   ========================================================================== */
'use strict';
const fs = require('fs');
const path = require('path');
const { stempel } = require('./lib/stempel');
const { bouw, ISTOETS } = require('./impactbereik');

const WORTEL = path.join(__dirname, '..');
const DOEL = path.join(WORTEL, 'VERANDERBEREIK.json');
/* DE MONTAGEWORTEL, en waarom hij apart geteld wordt.

   server/server.js en server/opzet/ MONTEREN de code; ze gebruiken hem niet.
   Daardoor staan ze in de omgekeerde sluiting van vrijwel elk bronbestand --
   verander kern/pay/poort.js en server.js hangt eraan, want die laadt de laag
   waar de poort in zit. Maar server.js handelt zelf ook 18 routes af
   (/api/health voorop), en die raakt bijna elke toets aan. Gemeten: langs die
   ene band groeide `raakt kern/pay/poort.js` van 6 toetsen naar 342.

   Dat is dezelfde vorm die scripts/machinedekking.js met zijn hubgrens
   tegenhoudt ("een hub in de kern-tas zette 4162 routes op idempotent").

   ER WORDT NIETS AFGETROKKEN. Te ruim is de veilige kant voor een bewijskeuze,
   dus deze toetsen blijven gewoon in `samen` staan. Wat er wel gebeurt is dat
   ze APART worden geteld, want anders leest een breed getal als precisie --
   en dan lijkt de graaf scherper dan hij is. Wie deze band wegstreept, maakt
   van een veilige overschatting een stille onderschatting.  */
const MONTAGE = /^server\/(server\.js$|opzet\/)/;

const K = { rood: '\x1b[31m', groen: '\x1b[32m', geel: '\x1b[33m', grijs: '\x1b[2m', reset: '\x1b[0m' };

/* De toetsbestanden die er ZIJN. De noemer komt uit de map en niet uit het
   journaal: een percentage over je eigen waarnemingen staat altijd op 100. */
function alleToetsen() {
  return fs.readdirSync(path.join(WORTEL, 'test'))
    .filter((n) => /\.(test|e2e)\.js$/.test(n)).sort();
}

/* ROUTE -> BRONBESTAND. De schakel die attributie.js miste.
   Alleen `perRoute` uit ROUTEBRON.json; dat register komt uit de ROUTER, dus
   het beschrijft wat er werkelijk gemonteerd is en niet wat de bronboom lijkt
   te zeggen. Ontbreekt het register, dan is dat GEEN lege kaart maar een
   kapotte opstelling -- zie main(). */
function routeKaart() {
  const rb = JSON.parse(fs.readFileSync(path.join(WORTEL, 'ROUTEBRON.json'), 'utf8'));
  const kaart = new Map();
  for (const r of rb.perRoute || []) if (r.route && r.bestand) kaart.set(r.route, r.bestand);
  return { kaart, stempel: rb.stempel || null };
}

/* WELKE TOETSEN DRAAIDEN ER IN DEZE RONDE. Het duurregister (.toetsduur,
   geschreven door test/toetsnaam.js) noteert ELK toetsbestand dat is
   uitgevoerd -- ook een dat geen enkele route raakte. Zonder die lijst zijn
   twee volstrekt verschillende dingen niet te onderscheiden:

     draaide, raakte geen route   een EIGENSCHAP. Dit is een in-proces toets,
                                  en daarover is wel degelijk iets bewezen.
     draaide niet in deze ronde   een MEETGAT. Hierover is niets bewezen.

   CLAUDE.md zegt over kern/stuur/gevolg.js dat `geen-effect-gemeten` en
   `onbekend` nooit door elkaar mogen lopen: "de proef kwam er niet bij" is
   iets anders dan "er gebeurt niets", en een plan dat "raakt niets aan" meldt
   terwijl niemand keek is een geruststelling zonder grond. Hier geldt dat
   onverkort.

   ALLEBEI HOUDEN ZE HUN VOLLE RING. Het onderscheid maakt de METING eerlijker,
   niet de versmalling ruimer: ook van een in-proces toets weten we niet welke
   BRONBESTANDEN hij dekt (node schrijft lcov per groep, niet per bestand). */
function leesRonde(paden) {
  /* EEN RONDE IS DE UNIE VAN DE SCHERVEN. In CI schrijft elke scherf zijn eigen
     duurregister; wie er maar een leest, noemt vier vijfde van de suite
     "niet gedraaid" en blaast de schuld op met zijn eigen tekort. */
  const lijst = (Array.isArray(paden) ? paden : [paden]).filter(Boolean);
  const bronnen = lijst.length ? lijst : [path.join(WORTEL, '.toetsduur')];
  const uit = new Set();
  let gelezen = 0;
  for (const p of bronnen) {
    let tekst;
    try { tekst = fs.readFileSync(p, 'utf8'); } catch (e) { continue; }
    gelezen++;
    for (const r of tekst.split('\n')) {
      const naam = r.split('\t')[0].trim();
      if (naam) uit.add(naam);
    }
  }
  /* GEEN ENKEL REGISTER GELEZEN IS GEEN LEGE RONDE. Dan weet deze meter niet
     wie er draaide, en dat hoort `null` te heten en niet nul. */
  return gelezen ? uit : null;
}

/* Het journaal, in dezelfde vorm als scripts/attributie.js hem leest. Die vorm
   staat op EEN plek beschreven (server/routelog.js) en wordt hier niet
   opnieuw bedacht; wijkt hij, dan hoort dat daar gerepareerd te worden. */
function leesJournalen(paden) {
  const perToets = new Map();
  let zonderEigenaar = 0, regels = 0;
  for (const p of paden) {
    let tekst = '';
    try { tekst = fs.readFileSync(p, 'utf8'); } catch (e) { continue; }
    for (const regel of tekst.split('\n')) {
      const r = regel.trim();
      if (!r.startsWith('TOETS ')) continue;
      const v = r.split(' ').filter(Boolean);
      if (v.length < 4) continue;
      const toets = v[v.length - 1];
      const route = v[1] + ' ' + v.slice(2, -1).join(' ');
      regels++;
      if (toets === 'onbekend') { zonderEigenaar++; continue; }
      if (!perToets.has(toets)) perToets.set(toets, new Set());
      perToets.get(toets).add(route);
    }
  }
  return { perToets, zonderEigenaar, regels };
}

/* De omgekeerde require-sluiting: welke bestanden hangen (transitief) aan dit
   bestand. Een BENADERDE kant telt mee, net als in scripts/lib/bedrading.js --
   we weten niet welke kandidaat het is, dus nemen we ze allemaal. Dat maakt de
   verzameling RUIMER, en ruimer is hier de veilige kant. */
function afhankelijken(omgekeerd, start) {
  const gezien = new Set([start]);
  const stapel = [start];
  while (stapel.length) {
    for (const o of (omgekeerd.get(stapel.pop()) || [])) {
      if (!gezien.has(o)) { gezien.add(o); stapel.push(o); }
    }
  }
  return gezien;
}

function meet(paden, rondePaden) {
  const aanwezig = (paden || []).filter((p) => fs.existsSync(p));
  const { perToets, zonderEigenaar, regels } = leesJournalen(aanwezig);
  const { kaart, stempel: rbStempel } = routeKaart();
  const { ix, omgekeerd } = bouw();
  const toetsen = alleToetsen();
  const ronde = leesRonde(rondePaden);

  /* AS 1 -- statisch. Heeft deze toets een require-kant die in server/ uitkomt? */
  const statisch = new Set();
  for (const t of toetsen) {
    const b = ix.bestanden.get('test/' + t);
    if (b && b.kanten.opgelost.some((d) => d.startsWith('server/'))) statisch.add(t);
  }

  /* AS 2 -- waargenomen. Route -> bestand, per toets. */
  const routesGezien = new Set();
  const routesOnopgelost = new Set();
  const per = {};
  let waargenomen = 0, beide = 0, zonderBereik = 0;
  let draaideZonderRoute = 0, nietInDezeRonde = 0;

  for (const t of toetsen) {
    const routes = perToets.get(t) || new Set();
    const bestanden = new Set();
    for (const r of routes) {
      routesGezien.add(r);
      const b = kaart.get(r);
      if (b) bestanden.add(b); else routesOnopgelost.add(r);
    }
    const heeftStatisch = statisch.has(t);
    const heeftRuntime = bestanden.size > 0;
    if (heeftRuntime) waargenomen++;
    if (heeftRuntime && heeftStatisch) beide++;

    let stand;
    if (heeftStatisch && heeftRuntime) stand = 'beide';
    else if (heeftStatisch) stand = 'statisch';
    else if (heeftRuntime) stand = 'waargenomen';
    else {
      zonderBereik++;
      /* DE SPLITSING DIE NIET MAG VERVALLEN. Beide zijn 'geen bereik', maar het
         ene is een eigenschap van de toets en het andere een tekort van deze
         ronde. Zonder ronde-register weten we het verschil niet en heet het
         eerlijk 'ongemeten'. */
      if (!ronde) { stand = 'ongemeten'; }
      else if (ronde.has(t)) { stand = 'draaideZonderRoute'; draaideZonderRoute++; }
      else { stand = 'nietInDezeRonde'; nietInDezeRonde++; }
    }

    per[t] = {
      stand,
      routes: routes.size,
      bronbestanden: bestanden.size,
      /* De volle ring is de veiligheidsrichting, niet een oordeel over de
         toets: zolang zijn bereik niet vaststaat, is versmallen geen recht. */
      volleRing: heeftStatisch === false && heeftRuntime === false
    };
  }

  const blindVoor = toetsen.length - statisch.size;

  return {
    soort: 'meting',
    uitleg: 'Van welke toets staat het BRONBESTANDbereik vast, langs de statische ' +
      'as (require) of de waargenomen as (routejournaal -> ROUTEBRON). Twee assen, ' +
      'nooit opgeteld. `ongemeten` betekent dat er niets over bewezen is -- nooit ' +
      'dat de toets niets aanraakt. Dit is geen selector: zolang zonderBereik niet ' +
      'nul is, is versmallen geen recht (KEURING.md par. 1).',
    hoe: 'npm run veranderbereik -- --lees <journaal>',
    stempel: stempel(),
    bronnen: {
      routebron: rbStempel,
      journalen: aanwezig.map((p) => path.relative(WORTEL, p)),
      rondeRegisters: (Array.isArray(rondePaden) ? rondePaden : [rondePaden]).filter(Boolean)
        .map((p) => path.relative(WORTEL, p)),
      ontbrekend: (paden || []).filter((p) => !aanwezig.includes(p)).map((p) => path.relative(WORTEL, p))
    },
    gemeten: {
      toetsbestanden: toetsen.length,
      statischBereik: statisch.size,
      waargenomenBereik: waargenomen,
      beideAssen: beide,
      /* DE SCHULD. Alleen deze mag de normtand niet omhoog zien gaan. */
      zonderBereik,
      zonderBereikPct: Number((100 * zonderBereik / toetsen.length).toFixed(1)),
      /* Wat de runtime-as aan de statische blinde vlek DICHT. Geen percentage:
         een percentage stijgt ook als er toetsen bijkomen die niets doen. */
      blindeVlekStatisch: blindVoor,
      blindeVlekNaKoppeling: zonderBereik,
      gedichtDoorWaarneming: blindVoor - zonderBereik,
      routesWaargenomen: routesGezien.size,
      routesZonderBronbestand: routesOnopgelost.size,
      journaalregels: regels,
      kantenZonderEigenaar: zonderEigenaar,
      /* DE RONDE. Zonder dit getal leest 'zonderBereik' als een uitspraak over
         de hele suite, terwijl een halve ronde hem vanzelf opblaast. */
      toetsenInDezeRonde: ronde ? ronde.size : null,
      /* HEEFT DE RONDE DE HELE SUITE GEDRAAID? Zonder dit kan niemand zien of
         `zonderBereik` een schuld is of een tekort van de ronde. */
      /* LIDMAATSCHAP EN NIET AANTAL, en dat verschil is echt gebleken. De eerste
         versie vroeg `ronde.size >= toetsen.length`, en de keten meldde daarop
         "1901 van 1900 toetsbestanden gedraaid": de duurregisters dragen een naam
         die niet op schijf staat (test/meterijk.test.js zet tijdens zijn ijking
         een toetsbestand neer en haalt het weer weg). Met een teller kan een
         ronde dus een ECHT bestand missen en toch volledig heten, zolang er maar
         een vreemde naam tegenover staat. Een gelijkheidstoets op aantallen heeft
         een blinde vlek die eruitziet als succes. */
      rondeVolledig: ronde ? toetsen.every((t) => ronde.has(t)) : false,
      /* Namen in de ronde die geen toetsbestand op schijf zijn. Hoort klein te
         zijn en verklaarbaar; een groeiend getal betekent dat de ronde over iets
         anders gaat dan deze meter denkt. */
      rondeVreemdeNamen: ronde ? [...ronde].filter((n) => !toetsen.includes(n)).length : null,
      rondeGemist: ronde ? toetsen.filter((t) => !ronde.has(t)).length : null,
      draaideZonderRoute,
      nietInDezeRonde
    },
    nietGemeten: {
      transitieveSluitingVanEenRoute:
        'de waargenomen as levert het BESTAND waarin de route wordt afgehandeld, ' +
        'niet alles wat dat bestand verderop aanroept. Voor de omgekeerde vraag ' +
        '(--raakt) wordt die sluiting er wel bij gerekend; in het register per ' +
        'toets staat bewust het gemeten bestand en geen afgeleide wolk.',
      toetsZonderRoute:
        'een toets die volledig in het proces draait raakt geen route. Die staat ' +
        'hier als ongemeten en dat is juist -- maar het is een tekort van deze ' +
        'meting en geen nul.',
      rondeIsGeenSuite:
        'toetsenInDezeRonde zegt hoeveel toetsbestanden er in het gelezen ' +
        'duurregister staan. Is dat minder dan het totaal, dan gaat zonderBereik ' +
        'over DEZE ronde en niet over de suite -- de meter telt dan te veel volle ' +
        'ringen, en dat is de veilige kant.',
      dekkingPerBronbestand:
        'welke REGELS een toets dekt is hier niet gemeten; node schrijft lcov per ' +
        'groep en niet per toetsbestand (scripts/test-runner.js). Dezelfde ' +
        'beperking die scripts/attributie.js noemt.'
    },
    per,
    _intern: { omgekeerd, kaart, perToets, statisch }
  };
}

/* DE OMGEKEERDE VRAAG, en de eigenlijke bedoeling van deze laag: als DIT
   bestand verandert, welke toetsen hebben er dan aantoonbaar iets mee te
   maken -- en, even hard, over hoeveel toetsen zegt dit niets. */
function raakt(u, bestand) {
  const { omgekeerd, kaart, perToets, statisch } = u._intern;
  const sluiting = afhankelijken(omgekeerd, bestand);

  const langsStatisch = new Set();
  for (const p of sluiting) if (ISTOETS.test(p)) langsStatisch.add(p.replace(/^test\//, ''));

  const langsWaarneming = new Set();
  const viaMontage = new Set();
  const perBestand = {};
  for (const [t, routes] of perToets) {
    let echt = false, montage = false;
    for (const r of routes) {
      const b = kaart.get(r);
      if (!b || !sluiting.has(b)) continue;
      perBestand[b] = (perBestand[b] || 0) + 1;
      if (MONTAGE.test(b)) montage = true; else echt = true;
    }
    if (echt || montage) langsWaarneming.add(t);
    /* alleen via de montagewortel binnengekomen: geteld, niet afgetrokken */
    if (montage && !echt) viaMontage.add(t);
  }

  const samen = new Set([...langsStatisch, ...langsWaarneming]);
  const alle = alleToetsen();
  const volleRing = alle.filter((t) => !statisch.has(t) && !(perToets.get(t) || new Set()).size);

  return {
    bestand,
    inSluiting: sluiting.size,
    langsStatisch: [...langsStatisch].sort(),
    langsWaarneming: [...langsWaarneming].sort(),
    /* Hoeveel van die toetsen ALLEEN via de montagewortel binnenkwamen. Ze
       blijven in `samen` staan -- te ruim is veilig -- maar een groot getal hier
       betekent dat deze sluiting nauwelijks iets zegt over DIT bestand. */
    viaMontage: [...viaMontage].sort(),
    perBestand,
    samen: [...samen].sort(),
    /* Dit getal is het hele punt. Zolang het niet nul is, dekt "samen" de vraag
       niet en mag er niets worden overgeslagen. */
    volleRing: volleRing.length
  };
}

function toon(u) {
  const g = u.gemeten;
  console.log('\nVERANDERBEREIK  (' + g.toetsbestanden + ' toetsbestanden, ' +
    g.journaalregels + ' journaalregels)\n');
  console.log('  statische as (require)      ' + String(g.statischBereik).padStart(5) +
    '  (' + (100 * g.statischBereik / g.toetsbestanden).toFixed(1) + '%)');
  console.log('  waargenomen as (journaal)   ' + String(g.waargenomenBereik).padStart(5) +
    '  (' + (100 * g.waargenomenBereik / g.toetsbestanden).toFixed(1) + '%)');
  console.log('  beide                       ' + String(g.beideAssen).padStart(5));
  console.log('\n  blinde vlek statisch alleen ' + String(g.blindeVlekStatisch).padStart(5));
  console.log('  gedicht door waarneming     ' + String(g.gedichtDoorWaarneming).padStart(5) +
    (g.gedichtDoorWaarneming > 0 ? K.groen + '  <- de winst van de koppeling' + K.reset : ''));
  console.log('  ' + (g.zonderBereik ? K.geel : K.groen) + 'zonder bereik (volle ring)  ' +
    String(g.zonderBereik).padStart(5) + '  (' + g.zonderBereikPct + '%)' + K.reset);
  if (g.toetsenInDezeRonde === null) {
    console.log('    ' + K.grijs + 'geen ronde-register: het verschil tussen "raakte geen route" en\n' +
      '    "draaide niet mee" is hier niet te zien, dus alles heet ongemeten.' + K.reset);
  } else {
    console.log('      draaide, raakte geen route' + String(g.draaideZonderRoute).padStart(5) +
      '   -> een in-proces toets; dat is een eigenschap');
    console.log('      draaide niet in deze ronde ' + String(g.nietInDezeRonde).padStart(5) +
      '   -> hierover is niets gemeten');
    console.log('    ' + K.grijs + 'ronde: ' + (g.toetsbestanden - g.rondeGemist) + ' van ' +
      g.toetsbestanden + ' toetsbestanden gedraaid' +
      (g.rondeVreemdeNamen ? ', plus ' + g.rondeVreemdeNamen + ' naam/namen die niet op schijf staan' : '') +
      K.reset);
  }
  console.log('\n  routes waargenomen          ' + String(g.routesWaargenomen).padStart(5));
  console.log('  waarvan zonder bronbestand  ' + String(g.routesZonderBronbestand).padStart(5) +
    (g.routesZonderBronbestand ? '   -> ROUTEBRON.json kent deze route niet' : ''));
  if (g.kantenZonderEigenaar) {
    console.log('  sporen zonder eigenaar      ' + String(g.kantenZonderEigenaar).padStart(5) +
      '   -> een proces zonder RTG_TOETS; zie test/toetsnaam.js');
  }
  if (!u.bronnen.journalen.length) {
    console.log('\n  ' + K.rood + 'Geen journaal gelezen: de waargenomen as staat op nul omdat er niet ' +
      'gekeken is,\n  niet omdat er niets is. Draai de suite met RTG_ROUTELOG.' + K.reset);
  }
  console.log('\n  ' + K.grijs + 'Dit is geen selector. Zolang `zonderBereik` niet nul is, dekt geen enkel\n' +
    '  impactplan de suite -- versmallen is een recht dat verdiend moet worden.' + K.reset + '\n');
}

function main() {
  const argv = process.argv.slice(2);
  const paden = [];
  const rondePaden = [];
  for (let i = 0; i < argv.length; i++) {
    if (argv[i] === '--lees') paden.push(path.resolve(WORTEL, argv[++i]));
    else if (argv[i] === '--ronde') rondePaden.push(path.resolve(WORTEL, argv[++i]));
  }
  if (!paden.length) paden.push(path.join(WORTEL, '.routejournaal'));

  /* EEN ONTBREKEND ROUTEBRON IS EEN KAPOTTE OPSTELLING EN GEEN LEGE KAART.
     Zonder dat register lost geen enkele route naar een bestand op, en dan
     meldt deze meter een blinde vlek die hij zelf heeft gemaakt. */
  if (!fs.existsSync(path.join(WORTEL, 'ROUTEBRON.json'))) {
    console.error('\n  ROUTEBRON.json ontbreekt; draai eerst `npm run routebron`.' +
      '\n  Zonder die kaart is route -> bestand niet te leggen en zegt deze meting niets.\n');
    return 2;
  }

  const u = meet(paden, rondePaden);
  const raaktArg = argv.indexOf('--raakt');
  if (raaktArg > -1 && argv[raaktArg + 1]) {
    const r = raakt(u, argv[raaktArg + 1]);
    console.log('\nRAAKT  ' + r.bestand + '\n');
    console.log('  bestanden in de omgekeerde sluiting  ' + String(r.inSluiting).padStart(5));
    console.log('  toetsen langs de statische as        ' + String(r.langsStatisch.length).padStart(5));
    console.log('  toetsen langs de waargenomen as      ' + String(r.langsWaarneming.length).padStart(5));
  if (r.viaMontage.length) {
    console.log('  ' + K.geel + 'waarvan alleen via de montagewortel  ' +
      String(r.viaMontage.length).padStart(5) + K.reset +
      '   -> die band zegt niets over dit bestand');
  }
    console.log('  samen                                ' + String(r.samen.length).padStart(5));
    console.log('  ' + K.geel + 'toetsen met een volle ring           ' + String(r.volleRing).padStart(5) +
      K.reset + '   -> hierover zegt dit niets');
    console.log('\n  ' + r.samen.slice(0, 25).join('\n  ') + (r.samen.length > 25 ? '\n  ... en ' + (r.samen.length - 25) + ' meer' : ''));
    console.log('');
    return 0;
  }

  if (argv.includes('--json')) {
    const kaal = { ...u }; delete kaal._intern;
    console.log(JSON.stringify(kaal, null, 1));
    return 0;
  }

  toon(u);

  if (argv.includes('--vastleggen')) {
    /* EEN HALVE RONDE LEGT ZICHZELF NIET STIL VAST. `zonderBereik` is dan geen
       schuld maar een tekort van de ronde, en een register dat dat verschil niet
       toont is exact de bewering-over-het-verleden die deze meter moest
       repareren. Wie het toch wil, zegt het hardop met --onvolledig; dan staat
       het in het register en niet alleen in iemands hoofd. */
    if (!u.gemeten.rondeVolledig && !argv.includes('--onvolledig')) {
      console.error(K.rood + '\n  GEWEIGERD: de ronde dekte ' +
        (u.gemeten.toetsenInDezeRonde === null ? 'geen enkel' : u.gemeten.toetsenInDezeRonde) +
        ' van ' + u.gemeten.toetsbestanden + ' toetsbestanden.' + K.reset +
        '\n  zonderBereik is dan geen schuld maar een tekort van deze ronde.' +
        '\n  Draai de hele suite, of leg het bewust vast met --onvolledig.\n');
      return 1;
    }
    const kaal = { ...u }; delete kaal._intern;
    fs.writeFileSync(DOEL, JSON.stringify(kaal, null, 1) + '\n');
    console.log('  vastgelegd in VERANDERBEREIK.json' +
      (u.gemeten.rondeVolledig ? '' : K.geel + '  (ONVOLLEDIGE ronde -- rondeVolledig: false)' + K.reset) + '\n');
    return 0;
  }

  /* DE NORMTAND hangt aan een ABSOLUUT getal en niet aan een percentage: een
     percentage daalt ook als er toetsen bijkomen die niets bewijzen. */
  if (argv.includes('--controle')) {
    let oud;
    try { oud = JSON.parse(fs.readFileSync(DOEL, 'utf8')); }
    catch (e) {
      console.error('GEZAKT: VERANDERBEREIK.json ontbreekt. Draai eerst --vastleggen.');
      return 1;
    }
    /* TWEE RONDES VAN VERSCHILLENDE OMVANG ZIJN NIET TE VERGELIJKEN. Een kleinere
       ronde laat de schuld vanzelf stijgen; dat is een leeftijdsverschil en geen
       verslechtering -- dezelfde regel als `verouderd` naast `tegenspraak` in
       scripts/routebron.js. */
    if (!u.gemeten.rondeVolledig || !oud.gemeten.rondeVolledig) {
      console.log('  overgeslagen: een van beide rondes is onvolledig (' +
        oud.gemeten.toetsenInDezeRonde + ' tegen ' + u.gemeten.toetsenInDezeRonde +
        ' van ' + u.gemeten.toetsbestanden + ').');
      console.log('  Deze tand vergelijkt alleen volle rondes; anders meet hij de ronde en niet de schuld.');
      return 0;
    }
    const was = oud.gemeten.zonderBereik, nu = u.gemeten.zonderBereik;
    if (typeof was === 'number' && nu > was) {
      console.error(K.rood + 'GEZAKT: zonderBereik ' + was + ' -> ' + nu +
        '. Deze teller mag alleen dalen: een toets waarvan het bereik vaststond,\n' +
        'hoort niet stil terug te vallen op een volle ring.' + K.reset);
      return 1;
    }
    console.log('  in orde: zonderBereik ' + nu + ' (was ' + was + ')');
  }
  return 0;
}

if (require.main === module) process.exit(main());
module.exports = { meet, raakt, alleToetsen, afhankelijken, routeKaart };
