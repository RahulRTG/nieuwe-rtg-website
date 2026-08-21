'use strict';
/* IS ELKE MODULE DIE IETS REGISTREERT OOK ECHT INGELADEN?

   WAAR DIT UIT KOMT. Bij de samenvoeging van 24 takken (18-21 augustus 2026)
   viel de mountregel van server/routes/office/rendezvous.js weg. Het bestand
   stond er nog, de kern eronder ook, en alle drie zijn adressen gaven 404 --
   "Onbekend eindpunt". Vier toetsen in test/rendezvous.test.js zakten daarop,
   en geen enkele meting zag het aankomen: een module die niemand inlaadt heeft
   geen dekking om te verliezen. Hij staat in geen enkele teller, dus hij kan
   ook nergens uit verdwijnen.

   Dezelfde vorm trof school/: vier deelmodules leken ongemount tot bleek dat
   hun OUDER ze inlaadt. Vandaar dat dit bestand require's echt OPLOST in plaats
   van op naam te zoeken -- './zorg' vindt zorg.js, './wacht' vindt
   wacht/index.js, en beide tellen als ingeladen.

   WAT DIT NIET IS. Geen dekkingsmeter en geen routekaart: het antwoordt op een
   veel kleinere vraag, en juist daarom in milliseconden in plaats van in een
   suite van twee uur. Vraag: is er een pad van server.js naar dit bestand?

   WAT DIT NIET ZIET. Een require die op runtime wordt samengesteld
   (`require(map + '/' + naam)`). Die bestaan hier; ze staan hieronder als
   ONBEKEND geteld en maken de uitkomst BREDER, niet smaller -- want wie zo'n
   require heeft, kan alles inladen en dus is niets met zekerheid wees. Dat is
   de regel uit PROOF-INCREMENTAL.md par. 3.2: wat niet als irrelevant te
   bewijzen is, telt als relevant.
   ========================================================================== */
const fs = require('fs');
const path = require('path');
/* COMMENTAAR EN DEZE METING.

   Een kop die uitlegt hoe `require(..)` werkt is geen require, en zonder iets
   te doen meldde deze meter twee commentaarregels als onbekende kant.

   Maar scripts/lib/bereik.js zijn `zonderCommentaar` is hier te grof: op
   server/opzet/aanbouw2.js haalt hij 5,6 van de 9,6 kB weg en eet daarbij de
   ECHTE mountregel van routes/doos op -- waarna twee gemounte routebestanden
   als wees werden gemeld. Een poort die op zijn eigen stripper struikelt, is
   erger dan geen poort.

   (En let op de vorm van deze alinea zelf: een voorbeeld met een letterlijke
   require erin laat keuringsregel 7 zakken, die elke relatieve require in de
   BRONTEKST natrekt. Dezelfde valkuil, andere kant op.)

   Daarom hier de lichtste vorm die werkt, en alleen waar hij nodig is:
   - voor het VINDEN van kanten blijft de rauwe bron staan. Een require in
     commentaar voegt dan een kant toe die er niet is, en dat maakt de graaf
     RUIMER -- de veilige kant voor een weesmeting;
   - voor het noteren van een ONBEKENDE kant wordt de regel zelf bekeken:
     begint hij met //, * of /*, dan is het proza. */
const COMMENTAARREGEL = /^\s*(?:\/\/|\*|\/\*)/;

const WORTEL = path.join(__dirname, '..', '..');

function bestanden(map, uit) {
  let rij;
  try { rij = fs.readdirSync(map, { withFileTypes: true }); } catch (e) { return uit; }
  for (const n of rij) {
    const p = path.join(map, n.name);
    if (n.isDirectory()) { if (n.name !== 'node_modules') bestanden(p, uit); }
    else if (n.name.endsWith('.js')) uit.push(p);
  }
  return uit;
}

/* Een require oplossen zoals Node dat doet: eerst het pad zelf, dan met .js,
   dan als map met index.js. Meer heeft dit huis niet nodig -- er zijn geen
   package.json-mappen binnen server/. */
function los(vanaf, spec) {
  if (!spec.startsWith('.')) return null;                 // een kernmodule
  const basis = path.resolve(path.dirname(vanaf), spec);
  for (const kandidaat of [basis, basis + '.js', path.join(basis, 'index.js')]) {
    try { if (fs.statSync(kandidaat).isFile()) return kandidaat; } catch (e) { /* volgende */ }
  }
  return null;
}

const REQUIRE_RE = /require\(\s*(['"])([^'"]+)\1\s*\)/g;
const SAMENGESTELD_RE = /require\(\s*[^'")\s]/;           // require(iets dat geen letterlijke string is

/* SAMENGESTELD, MAAR MET EEN LETTERLIJKE LIJST ERNAAST. De domeinroutes worden
   zo geladen:

       const ALLE_DOMEINEN = ['auth', 'member', 'supplier', ...];
       require('../routes/' + naam)(grens(naam));

   Dat is geen onbekende: de lijst staat in hetzelfde bestand en is letterlijk.
   Wie hier stopt bij "samengesteld, dus onbekend" meldt zes grote
   routebestanden als wees terwijl ze elk verzoek bedienen -- en zes valse
   alarmen maken een poort waardeloos.

   Wat hier NIET wordt opgelost: een lijst die uit een ander bestand komt, of
   een naam die uit een omgevingsvariabele valt. Die blijven ONBEKEND, en dat
   getal staat in de uitslag. */
const SAMEN_RE = /require\(\s*(['"])([^'"]+)\1\s*\+\s*([A-Za-z_$][\w$]*)\s*\)/g;
const LIJST_RE = /(?:const|let|var)\s+([A-Za-z_$][\w$]*)\s*=\s*\[([^\]]*)\]/g;
/* require(path.join(iets, 'server/kern/...')) -- het tweede stuk is letterlijk
   en wijst vanaf de wortel, dus dit is geen onbekende maar een omweg. */
const JOIN_RE = /require\(\s*path\.join\(\s*[^,)]+,\s*(['"])([^'"]+)\1\s*\)\s*\)/g;

function letterlijkeLijsten(bron) {
  const uit = new Map();
  LIJST_RE.lastIndex = 0;
  let m;
  while ((m = LIJST_RE.exec(bron))) {
    const stukken = [...m[2].matchAll(/(['"])([^'"]*)\1/g)].map((x) => x[2]);
    if (stukken.length) uit.set(m[1], stukken);
  }
  return uit;
}

/* WELKE BESTANDEN TELLEN MEE? Alles onder server/routes/ -- op de MAP en niet
   op de inhoud.

   Hier stond een regex die zocht naar `app.post(` en dergelijke, en
   keuringsregel 56 sloeg daar terecht op aan: "geen nieuwe prive-routelijst,
   EEN plek bepaalt welke routes er zijn". Dat is precies de regel die
   PROOF-INCREMENTAL.md par. 11 zelf oplegt -- er komt geen tweede waarheid bij
   -- en dit bestand was hem aan het overtreden binnen een dag na het opschrijven.

   De map is een beter antwoord dan de tekst: wat onder server/routes/ staat IS
   een routemodule, dat is de afspraak van dit huis, en er valt niets af te
   leiden. Staat er een hulpbestand dat niemand inlaadt, dan is dat ook een
   melding waard. */
const ONDER_ROUTES = /(?:^|\/)server\/routes\//;

/* HET REGELNUMMER VAN EEN TREFFER, uit de index in de brontekst. Goedkoper dan
   de bron opknippen per treffer, en nauwkeurig genoeg voor een verwijzing. */
function lijnVan(bron, index) {
  let n = 1;
  for (let i = 0; i < index && i < bron.length; i++) if (bron[i] === '\n') n++;
  return n;
}

/* WELKE CONSTRUCTIE IS DIT? De vorm bepaalt hoe ver een impactzone moet worden
   opgerekt, en dus of hij ooit te sluiten is. Ze staan hier met naam omdat een
   toekomstige planner erop moet kunnen sturen -- een maplader is iets anders
   dan een naam die uit een omgevingsvariabele valt. */
function vormVan(regel) {
  if (/require\(\s*path\.join\(/.test(regel)) return 'path.join met een variabele';
  if (/require\(\s*`/.test(regel)) return 'template-literal';
  if (/require\(\s*[A-Za-z_$][\w$]*\s*\)/.test(regel)) return 'kale variabele';
  if (/require\(\s*['"][^'"]*['"]\s*\+/.test(regel)) return 'voorvoegsel + uitdrukking';
  if (/require\(\s*\(/.test(regel)) return 'uitdrukking';
  return 'onbekende vorm';
}

/* EN WAAROM HIJ NIET OP TE LOSSEN IS -- in woorden, niet als code. Dit is het
   veld dat iemand over een half jaar leest als hij deze onbekende wil sluiten. */
function redenVan(regel) {
  if (/require\(\s*path\.join\(\s*[A-Za-z_$]/.test(regel))
    return 'de map komt uit een variabele; welke bestanden erin zitten is pas op runtime bekend';
  if (/require\(\s*[A-Za-z_$][\w$]*\s*\)/.test(regel))
    return 'het pad staat in een variabele die van buiten dit bestand komt';
  if (/require\(\s*`/.test(regel))
    return 'een template-literal met een invulling die hier niet vaststaat';
  return 'de uitdrukking is pas op runtime te bepalen';
}

/* DE ANALYSE VAN EEN ENKEL BESTAND, apart en zonder schijf.

   WAAROM DIT LOS STAAT. Deze laag mag straks zeggen "twintigduizend bewijzen
   hoeven niet opnieuw". Dan hoort hij tot de zwaarst getoetste code van dit
   huis, en dat kan alleen als hij te toetsen IS op een string in plaats van op
   een map vol bestanden. test/bedrading.test.js is het regressiecorpus: per
   constructie een voorbeeld, inclusief de drie vormen waar deze analyser bij
   het bouwen zelf op struikelde (commentaar, een doorlopend blokcommentaar, en
   een voorbeeld-require in een kop).

   `vanaf` is het absolute pad waar de requires vandaan worden opgelost; `pad`
   is de naam die in de uitslag komt. In de toets zijn die twee verschillend. */
function analyseer(bron, vanaf, pad) {
  const uit = { ingeladen: new Set(), opgelost: 0, benaderd: [], onbekend: [] };
    REQUIRE_RE.lastIndex = 0;
  let m;
  while ((m = REQUIRE_RE.exec(bron))) {
    const doel = los(vanaf, m[2]);
    if (doel) { uit.ingeladen.add(doel); uit.opgelost++; }
  }
  /* En de samengestelde met een letterlijke lijst ernaast. RUIM benaderd, en
     met opzet: de lus loopt vaak over een AFGELEIDE variabele --

         const ALLE_DOMEINEN = ['auth', 'member', ...];
         const gekozen = (process.env.RTG_DOMAINS || ALLE_DOMEINEN.join(',')).split(',');
         for (const naam of gekozen) require('../routes/' + naam)(...)

     -- en die keten narekenen is een dataflow-motor bouwen voor een vraag die
     dat niet verdient. Dus: elke letterlijke tekstlijst in ditzelfde bestand
     wordt tegen het voorvoegsel gehouden. Dat maakt de verzameling INGELADEN
     ruimer en dus het aantal wezen KLEINER, en die kant is hier de veilige:
     een vals alarm op een module die wel degelijk draait, maakt deze poort
     waardeloos. Een gemist geval kost een 404 die de suite alsnog vindt. */
  const lijsten = letterlijkeLijsten(bron);
  const rel = pad.replace(/\\/g, '/');
  let benaderdHier = 0;
  SAMEN_RE.lastIndex = 0;
  while ((m = SAMEN_RE.exec(bron))) {
    const eigen = lijsten.get(m[3]);
    const kandidaten = eigen || [...lijsten.values()].flat();
    if (!kandidaten.length) continue;
    benaderdHier++;
    const geraakt = [];
    for (const w of kandidaten) {
      const doel = los(vanaf, m[2] + w);
      if (doel) { uit.ingeladen.add(doel); geraakt.push(path.relative(WORTEL, doel).replace(/\\/g, '/')); }
    }
    /* EEN BENADERING ZONDER GRENS IS GEEN BENADERING. "Het is een van deze
       drie modules" en "het zit ergens onder routes/" zijn allebei
       conservatief, maar hun impactradius scheelt een orde van grootte. Wie
       later veilig wil verbreden, heeft de VERZAMELING nodig en niet het
       aantal. */
    uit.benaderd.push({
      bestand: rel, lijn: lijnVan(bron, m.index),
      vorm: eigen ? 'voorvoegsel + eigen lijst' : 'voorvoegsel + lijst uit ditzelfde bestand',
      voorvoegsel: m[2], kandidaten: geraakt.sort(),
      grens: geraakt.length ? null : 'subtree(' + m[2] + '**)'
    });
  }
  JOIN_RE.lastIndex = 0;
  while ((m = JOIN_RE.exec(bron))) {
    const doel = los(path.join(WORTEL, 'x.js'), './' + m[2]);
    if (doel) { uit.ingeladen.add(doel); uit.opgelost++; benaderdHier++; }
  }

  /* Wat samengesteld is en NIET met een lijst te benaderen viel, is onbekend.
     Dat wordt bij naam genoteerd en niet alleen geteld: een getal zonder
     namen is geen meting maar een gevoel. */
  if (SAMENGESTELD_RE.test(bron) && !benaderdHier) {
    /* Ook een VERVOLGREGEL binnen een blokcommentaar is proza, en die begint
       niet met een teken dat hem verraadt -- in dit huis lopen koppen over
       tien regels door. Vandaar dat de blokstaat wordt meegelopen. */
    let inBlok = false;
    const regels = bron.split('\n');
    for (let i = 0; i < regels.length; i++) {
      const r = regels[i];
      const opent = r.includes('/*') && !r.includes('*/');
      if (inBlok) { if (r.includes('*/')) inBlok = false; continue; }
      if (opent) { inBlok = true; continue; }
      if (COMMENTAARREGEL.test(r)) continue;
      if (!SAMENGESTELD_RE.test(r)) continue;
      /* IEDERE ONBEKENDE HEEFT IDENTITEIT: bestand, regel, constructie en
         waarom hij niet op te lossen is. Een kaal getal is geen meting -- wie
         het later wil sluiten, moet weten waar hij moet kijken en wat hem in
         de weg staat. */
      uit.onbekend.push({
        bestand: rel, lijn: i + 1,
        vorm: vormVan(r),
        code: r.trim().slice(0, 90),
        reden: redenVan(r)
      });
    }
  }
  return uit;
}

/* VERTROUWEN PER GEBIED, EN WAAROM DAT MOET.

   Eén obscure maplader in de spellenmap mag niet betekenen dat het HELE
   platform permanent in "onzeker" hangt. Wat je wilt kunnen zeggen is dit:

       algemeen : 99,95%
       identity : 100%
       money    : 100%
       security : 100%

   Dan is een gevoelige capability aantoonbaar volledig begrepen, ook als er
   ergens in een hoek nog onzekerheid zit -- en kan een planner daar later op
   sturen in plaats van op één plat cijfer.

   DE GRENZEN ZIJN PADEN EN GEEN GEVOEL. Ze staan hier bij elkaar zodat je ze
   kunt lezen en betwisten; een gebied dat hier ontbreekt valt onder `algemeen`
   en krijgt dus de zachte eis. Wie een nieuw geldpad maakt en het hier vergeet,
   verliest de harde eis -- daarom worden deze drie ook in de keuring genoemd. */
const GEBIEDEN = [
  ['identity', [/^server\/accounts\//, /^server\/accounts\.js$/, /^server\/kern\/paspoort/,
    /^server\/kern\/rtgid/, /^server\/routes\/auth\//, /^server\/kern\/identiteit/,
    /^server\/kern\/vakbewijs/, /^server\/kern\/persoonseis/]],
  ['money', [/^server\/kern\/pay\//, /^server\/kern\/commercie\//, /^server\/kern\/geld/,
    /^server\/routes\/bank/, /^server\/routes\/betaal/, /^server\/routes\/member\/betalen/,
    /^server\/kern\/facturatie/, /^server\/kern\/tegoed/]],
  ['security', [/^server\/middleware\//, /^server\/kern\/bevoegdheid\//, /^server\/rem\.js$/,
    /^server\/kern\/beveiliging\//, /^server\/kern\/stuur\//, /^server\/schild/]]
];

function gebiedVan(rel) {
  for (const [naam, patronen] of GEBIEDEN) {
    for (const p of patronen) if (p.test(rel)) return naam;
  }
  return 'algemeen';
}

function meet(mappen) {
  const alle = [];
  for (const m of mappen || ['server']) bestanden(path.join(WORTEL, m), alle);

  const ingeladen = new Set();
  /* DRIE KLASSEN, EN ZE WORDEN GETELD (PROOF-INCREMENTAL.md par. 3.2).

       opgeloste kanten  een letterlijke require die naar een bestaand bestand wijst
       benaderde kanten  samengesteld, maar met een letterlijke lijst in hetzelfde
                         bestand -- we nemen alle kandidaten mee en weten niet welke
       onbekende kanten  samengesteld zonder enig houvast in dit bestand

   Een graaf die zegt "nul onzekerheden" moet dat kunnen bewijzen; daarom staan
   deze drie getallen in de uitslag en niet alleen het eindoordeel. */
  const kanten = { opgelost: 0, benaderd: [], onbekend: [] };
  const perGebied = {};
  for (const f of alle) {
    let bron;
    try { bron = fs.readFileSync(f, 'utf8'); } catch (e) { continue; }
    const rel = path.relative(WORTEL, f).replace(/\\/g, '/');
    const r = analyseer(bron, f, rel);
    for (const d of r.ingeladen) ingeladen.add(d);
    kanten.opgelost += r.opgelost;
    kanten.benaderd.push(...r.benaderd);
    kanten.onbekend.push(...r.onbekend);
    const g = gebiedVan(rel);
    const bak = perGebied[g] || (perGebied[g] = { opgelost: 0, benaderd: 0, onbekend: 0 });
    bak.opgelost += r.opgelost;
    bak.benaderd += r.benaderd.length;
    bak.onbekend += r.onbekend.length;
  }

  /* De ingangen zelf worden door niemand ge-require'd en zijn dat ook niet:
     server.js is het beginpunt, en de andere drie worden door een script of
     door de vloot gestart. */
  const INGANGEN = ['server/server.js', 'server/poort.js', 'server/vloot.js',
    'server/trio.js', 'server/nood.js', 'server/foundation.js', 'server/school.js'];
  for (const i of INGANGEN) ingeladen.add(path.join(WORTEL, i));

  const wezen = [];
  for (const f of alle) {
    if (ingeladen.has(f)) continue;
    const rel = path.relative(WORTEL, f).replace(/\\/g, '/');
    if (!ONDER_ROUTES.test('/' + rel)) continue;          // buiten routes/: andere vraag
    wezen.push(rel);
  }

  /* Het vertrouwen per gebied: welk deel van de kanten daar EXACT is opgelost.
     Benaderd telt bewust niet als opgelost -- conservatief is niet hetzelfde als
     zeker, en dit getal moet het verschil laten zien. */
  const vertrouwen = {};
  for (const [g, b] of Object.entries(perGebied)) {
    const totaal = b.opgelost + b.benaderd + b.onbekend;
    vertrouwen[g] = { ...b, totaal,
      pct: totaal ? Math.round((b.opgelost / totaal) * 10000) / 100 : 100 };
  }
  return { gekeken: alle.length, kanten, vertrouwen, wezen: wezen.sort() };
}

module.exports = { meet, los, analyseer, vormVan, redenVan };
