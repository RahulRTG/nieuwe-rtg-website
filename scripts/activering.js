#!/usr/bin/env node
/* ============================================================================
   DE ACTIVERING -- wat wordt er wakker als ik deze functie aanzet?

   WAAROM DIT ER IS

   Stap 2 van de keten naar een binnenpoort. VERSTRENGELING.json zegt welke
   delen van RTG elkaar kunnen wakker maken; dit zegt het per FUNCTIE -- de
   eenheid waarin de schakelkast (server/functies/toegang.js) en de treden van
   LAUNCH.md denken. Een trede aanzetten is namelijk alleen een kleine handeling
   als achter die trede ook werkelijk weinig wakker wordt, en dat wist niemand.

   De vier vragen die het platformregister al beantwoordt -- wat is het, wat doet
   het, staat het aan, wat weten we ervan -- misten er een: WAT RAAKT HET. Dit
   voegt die vijfde toe en verzint er geen nieuwe lijst functies bij (LAT-regel
   4): de catalogus blijft server/functies/register.

   HOE DE ENVELOP WORDT BEPAALD

     1. De app wordt gestart met een ingepakte router, zodat elke route zijn
        eigen ophangbestand meekrijgt (scripts/lib/routeherkomst.js). Statisch
        uit de bron lezen kan hier niet -- zie de kop van dat bestand.
     2. Elke route krijgt zijn functie via functieVoorPad(), precies zoals de
        schakelkast dat bij een echt verzoek doet. Geen tweede padregel.
     3. Uit die ophangbestanden worden de KERN-SLEUTELS gelezen die ze
        gebruiken, en die worden via de bijdragenkaart van het opstarten
        (scripts/lib/routeherkomst.js) teruggebracht tot het bestand dat ze
        levert. Zonder deze stap is de meting fictie: de meeste route-bestanden
        van dit huis hebben NUL requires en krijgen hun hele domein via de tas.
        server/routes/gewoonten.js leek zo een eiland van EEN bestand, terwijl
        het kern/gewoonten.js aanroept.
     4. Vanaf die twee samen (ophangbestand + leveranciers van zijn sleutels)
        wordt de require-graaf dichtgetrokken. Wat je zo bereikt, is de envelop.

   WAT ER NIET IN MEEGETELD WORDT, EN WAAROM DAT EEN EIGEN UITSLAG IS

   Een route die rechtstreeks in de BEDRADING hangt (server.js, server/opzet/)
   krijgt geen envelop. De sluiting vanaf een bedradingsbestand is het hele huis:
   /api/stream hangt in server.js, en de eerste ronde meldde daardoor dat de
   functie kern-live 814 van de 849 knopen raakt -- 96%, en volledig een
   artefact van waar de route hangt. Zulke functies dragen de graad
   `deels-niet-toe-te-rekenen` met het aantal erbij. Een onmeetbaar ding is geen
   groot getal; het is een andere soort antwoord.

   WAT DIT GETAL WEL EN NIET IS -- ALLEBEI BELANGRIJK

     TE HOOG   een require is nog geen aanroep. Een module die geladen wordt
               omdat hij bovenin een bestand staat, doet daarmee nog niets. De
               envelop is dus wat er WAKKER KAN WORDEN, niet wat er draait.
     TE LAAG   en tegelijk mist hij alles wat niet via require loopt: de bus
               (kern/envelop.js), een cron, een AI-gereedschap, een webhook.
               Dat is de gevaarlijkste soort, want dat is precies de weg waarop
               een uitgezette functie alsnog werk kan beginnen.

   Wie hier "functie X raakt N% van RTG" van maakt zonder die twee erbij, meet
   een grens die er niet is. Daarom staan ze in de uitslag zelf, per meting.

   DE DERDE UITSLAG DIE ERUIT VALT

   Routes zonder functie. functieAan() in server/functies/toegang.js begint met
   `if (!f) return true` -- een pad dat geen functie kent, is nergens uit te
   zetten. Het platformregister verklaart daar een deel van als BEDIENING (de
   besturing van het platform zelf; een schakelaar die de schakelkast uitzet is
   geen schakelaar). Wat daarna overblijft is de inventaris voor stap 4 van de
   keten, en die telt dit script hier mee omdat hij hier gratis uit valt.

   Draai: npm run activering            (rapport)
          npm run activering:vast       (schrijft ACTIVERING.json)
   ========================================================================== */
'use strict';
const fs = require('fs');
const path = require('path');

const WORTEL = path.join(__dirname, '..');
const V = require('./verstrengeling');

/* ------------------------------------------------------- de bestandsgraaf -- */

/* Een require wijst naar een pad zonder extensie. Drie vormen, in de volgorde
   die node zelf aanhoudt. Lost er geen op, dan bestaat het doel niet (of het is
   een map zonder index) en valt de rand weg -- met een teller erop, want een
   graaf die stilletjes randen verliest meet te weinig. */
function resolveer(p) {
  for (const kandidaat of [p, p + '.js', path.join(p, 'index.js')]) {
    try { if (fs.statSync(path.join(WORTEL, kandidaat)).isFile()) return kandidaat.replace(/\\/g, '/'); }
    catch { /* volgende vorm */ }
  }
  return null;
}

function bestandsgraaf(ruweRanden) {
  const graaf = new Map();
  let onvindbaar = 0;
  for (const r of ruweRanden) {
    const naar = resolveer(r.naar);
    if (!naar) { onvindbaar++; continue; }
    if (!graaf.has(r.van)) graaf.set(r.van, new Set());
    graaf.get(r.van).add(naar);
  }
  return { graaf, onvindbaar };
}

/* De transitieve sluiting vanaf een reeks startbestanden. */
function sluiting(graaf, start) {
  const gezien = new Set();
  const rij = [...start];
  while (rij.length) {
    const b = rij.pop();
    if (!b || gezien.has(b)) continue;
    gezien.add(b);
    for (const n of graaf.get(b) || []) if (!gezien.has(n)) rij.push(n);
  }
  return gezien;
}

/* ------------------------------------------- waar komt een sleutel vandaan -- */

/* NIET ELKE SLEUTEL DIE EEN ROUTEBESTAND UITPAKT, KOMT UIT DE KERN-TAS.

   Dat was de aanname onder de eerste ronden, en hij klopte voor 1672 sleutels
   en niet voor 217. Die 217 kwamen uit vier constructies, en pas toen ze op een
   rij stonden was te zien dat het er VIER waren en geen tweehonderd:

     OUDER-REQUIRE     server/routes/supplier/horeca.js doet
                       `const horeca = require('../../kern/horeca')(kern)` en
                       geeft `Object.assign({}, kern, { horeca, ... })` door aan
                       zijn deelbestanden. De sleutel draagt dus wel degelijk een
                       afhankelijkheid -- die van de OUDER.
     OUDER-LOKAAL      server/routes/supplier/charter.js bouwt BOOT_TYPES,
                       isCharter, charterVan en getal ter plekke en geeft ze door.
                       Zulke sleutels dragen GEEN externe afhankelijkheid: ze
                       staan in hetzelfde bestand van dezelfde functie.
     ZUSTER-TOEWIJZING een deelbestand schrijft in de gedeelde context
                       (`kern.horecaBord = bord` in horeca/keuken.js) en een
                       zuster leest hem. De bron is die zuster.
     TAS-ZONDER-BRON   de sleutel staat wel in de tas maar is niet te herleiden;
                       die drie soorten staan in scripts/lib/routeherkomst.js.

   DE VIERDE MOET BEGRENSD ZIJN, en dat is geen netheid. Een kale zoektocht naar
   `.getal =` over de hele boom vond server/betaal/synthetisch.js -- een bestand
   dat niets met charters te maken heeft. Een gedeelde context bestaat alleen
   tussen bestanden die van dezelfde ouder komen, dus daar wordt gezocht en
   nergens anders. */
const DIEPTE = 5;

function herleidSleutel({ sleutel, bestand, ouders, kinderen, leesBestand }) {
  const isRequire = new RegExp('const\\s+' + sleutel + '\\s*=\\s*require\\(\\s*[\'"]([^\'"]+)');
  /* EN DE GEDESTRUCTUREERDE VORM, want die is hier de gewone:
     `const { eigenVeld } = require('../kern/util')`. Zonder deze regel bleef
     eigenVeld in 76 envelopen onvindbaar terwijl zijn herkomst in het
     ouderbestand staat -- dezelfde constructie, andere schrijfwijze. */
  const isRequireUitpak = new RegExp('(?:const|let|var)\\s*\\{[^}]*\\b' + sleutel + '\\b[^}]*\\}\\s*=\\s*require\\(\\s*[\'"]([^\'"]+)');
  /* EN DE VORM IN TWEE STAPPEN, want die is in dit huis de gewone:
       const ctx = require('./foundation/basis')();
       const { db, save, eigenVeld, ... } = ctx;
     De sleutel wordt uit een LOKALE variabele gehaald die zelf uit een require
     komt. Zonder deze stap eindigt het spoor bij de variabele en heet de sleutel
     onvindbaar, terwijl zijn bestand twee regels hoger staat. */
  const isUitpakVanVar = new RegExp('(?:const|let|var)\\s*\\{[^}]*\\b' + sleutel + '\\b[^}]*\\}\\s*=\\s*([A-Za-z0-9_$]+)\\s*;');
  const isLokaal = new RegExp('(?:const|let|var|function)\\s+' + sleutel + '\\s*[=(]');
  const isToewijzing = new RegExp('\\.' + sleutel + '\\s*=[^=]');

  const gezien = new Set([bestand]);
  let laag = [bestand];
  for (let d = 0; d < DIEPTE && laag.length; d++) {
    const volgende = [];
    for (const f of laag) {
      for (const p of (ouders.get(f) || [])) {
        if (gezien.has(p)) continue;
        gezien.add(p);
        const bron = leesBestand(p) || '';
        const m = bron.match(isRequire) || bron.match(isRequireUitpak);
        if (m) return { hoe: 'ouder-require', ouder: p, pad: m[1], klasse: 'herleid' };
        const v = bron.match(isUitpakVanVar);
        if (v) {
          const via = bron.match(new RegExp('(?:const|let|var)\\s+' + v[1] + '\\s*=\\s*require\\(\\s*[\'"]([^\'"]+)'));
          if (via) return { hoe: 'ouder-require-via-variabele', ouder: p, pad: via[1], klasse: 'herleid' };
        }
        if (isLokaal.test(bron)) return { hoe: 'ouder-lokaal', ouder: p, klasse: 'herleid' };
        /* De zusters van deze ouder: alleen daar kan een gedeelde context leven. */
        for (const z of (kinderen.get(p) || [])) {
          if (z === bestand) continue;
          if (isToewijzing.test(leesBestand(z) || '')) return { hoe: 'zuster-toewijzing', zuster: z, klasse: 'herleid' };
        }
        volgende.push(p);
      }
    }
    laag = volgende;
  }
  return null;
}

/* --------------------------------------------------------- de kern-tas -- */

/* WELKE SLEUTELS VAN DE KERN-TAS GEBRUIKT DIT BESTAND.

   Het patroon van dit huis: `module.exports = (kern) => { const { app, auth,
   gewoontenVan } = kern; ... }`. De naam van de parameter verschilt per bestand
   (kern, k, ctx), dus die wordt eerst gelezen en daarna gebruikt -- een vaste
   naam aannemen levert stil nul sleutels op, en dat ziet er precies zo uit als
   een bestand dat de tas niet gebruikt.

   Ook `kern.foo` telt mee: niet elk bestand pakt zijn sleutels uit. */
function kernSleutelsVan(bron) {
  const uit = new Set();
  const m = bron.match(/module\.exports\s*=\s*(?:function\s*[A-Za-z0-9_$]*\s*)?\(?\s*([A-Za-z0-9_$]+)/);
  if (!m) return uit;
  const naam = m[1];
  const esc = naam.replace(/\$/g, '\\$');
  for (const d of bron.matchAll(new RegExp('(?:const|let|var)\\s*\\{([^}]*)\\}\\s*=\\s*' + esc + '\\s*[;,\n]', 'g'))) {
    for (const stuk of d[1].split(',')) {
      const naamDeel = stuk.split(':')[0].split('=')[0].trim();
      if (/^[A-Za-z0-9_$]+$/.test(naamDeel)) uit.add(naamDeel);
    }
  }
  for (const d of bron.matchAll(new RegExp(esc + '\\.([A-Za-z0-9_$]+)', 'g'))) uit.add(d[1]);
  return uit;
}

/* Hangt deze route in de bedrading in plaats van in een module? */
const isBedrading = b => b === 'server/server.js' || b.startsWith('server/opzet/');

/* ---------------------------------------------------------- de envelopen -- */

/* Puur: krijgt de routes, de graaf en de padregel mee, en levert per functie
   haar envelop. Alles wat de app moet starten gebeurt in meet(). */
function envelopen({ routes, graaf, functieVoorPad, onbekendeRanden = new Set(),
  kernBron = {}, kernOnbekend = {}, ouders = new Map(), kinderen = new Map(),
  leesBestand = () => '', resolveerPad = (p) => p }) {
  const perFunctie = new Map();
  const zonderFunctie = [];
  for (const r of routes) {
    const f = functieVoorPad(r.pad);
    if (!f) { zonderFunctie.push(r); continue; }
    if (!perFunctie.has(f.id)) perFunctie.set(f.id, { functie: f, routes: [], bestanden: new Set() });
    const e = perFunctie.get(f.id);
    e.routes.push(r.methode + ' ' + r.pad);
    if (r.bestand) e.bestanden.add(r.bestand);
  }

  const uit = [];
  for (const e of perFunctie.values()) {
    const alle = [...e.bestanden];
    const bedrading = alle.filter(isBedrading);
    const eigen = alle.filter(b => !isBedrading(b));
    /* De leveranciers van de kern-sleutels die deze bestanden gebruiken. */
    const leveranciers = new Set();
    const onbekendeSleutels = new Set();
    const uitBedrading = new Set();
    /* DRIE KLASSEN NAAST 'HERLEID', en ze zijn niet uitwisselbaar:
         WAARDE      gegevens (een constante, een lijst, een Map). Daar IS geen
                     module om naar te wijzen -- dit wordt nooit preciezer, en
                     dat is geen tekort van de meter.
         ONVINDBAAR  hier zou NIEUWE broninformatie helpen.
         SAMENGESTELD  bronnen spreken elkaar tegen: ONBEPAALD, en met opzet niet
                     bij een van de twee andere geteld. */
    const perKlasse = { WAARDE: [], ONVINDBAAR: [], SAMENGESTELD: [] };
    for (const b of eigen) {
      const bronTekst = leesBestand(b) || '';
      /* EEN SLEUTEL DIE DE TAS ZELF IS. `const wctx = { kern }` in de ouder en
         `const { kern } = wctx` in het deelbestand: dan is `kern` geen sleutel
         maar de hele tas onder een andere naam, en zijn `kern.x` wél echte
         sleutels. Dat wordt niet aangenomen maar NAGEGAAN: alleen als de meeste
         van die x-en bekende tas-sleutels zijn, telt de alias als de tas.
         Anders zou `const { db } = kern` van db.data een sleutel maken. */
      const sleutels = kernSleutelsVan(bronTekst);
      for (const sl of [...sleutels]) {
        if (kernBron[sl]) continue;
        const leden = [...new Set([...bronTekst.matchAll(new RegExp('\\b' + sl + '\\.([A-Za-z0-9_$]+)', 'g'))].map(m => m[1]))];
        if (leden.length < 3) continue;
        const bekend = leden.filter(x => kernBron[x]).length;
        if (bekend >= 3 && bekend >= leden.length / 2) {
          sleutels.delete(sl);
          for (const x of leden) sleutels.add(x);
        }
      }
      for (const sl of sleutels) {
        const bron = kernBron[sl];
        if (!bron) {
          /* Eerst de vier constructies, dan pas de restpost. */
          const h = herleidSleutel({ sleutel: sl, bestand: b, ouders, kinderen, leesBestand });
          if (h) {
            /* WAT ER WEL EN NIET DE ENVELOP IN GAAT, en dit is precies de plek
               waar de eerste poging het mis had: `member` sprong van 43% naar
               97% omdat de OUDER werd meegenomen, en een ouder requiret al zijn
               deelbestanden. De sleutel draagt de afhankelijkheid van de ouder
               niet -- hij draagt hooguit die van wat de ouder ERVOOR laadde.

                 ouder-lokaal       de sleutel is ter plekke gebouwd: NIETS erbij.
                                    Geen externe afhankelijkheid, dus ook geen
                                    knoop.
                 ouder-require      alleen het gerequirede bestand, niet de ouder.
                 zuster-toewijzing  alleen de zuster die de waarde zette.

               En nooit de bedrading, om dezelfde reden als bij de tas-sleutels:
               een enkele sleutel uit server.js zou het hele huis binnenhalen. */
            if (h.hoe === 'ouder-require' || h.hoe === 'ouder-require-via-variabele') {
              const doel = resolveerPad(path.normalize(path.join(path.dirname(h.ouder), h.pad)).replace(/\\/g, '/'));
              if (doel && !isBedrading(doel)) leveranciers.add(doel);
            } else if (h.hoe === 'zuster-toewijzing' && !isBedrading(h.zuster)) leveranciers.add(h.zuster);
            continue;
          }
          const diag = kernOnbekend[sl];
          if (diag && perKlasse[diag.soort]) perKlasse[diag.soort].push(sl);
          else perKlasse.ONVINDBAAR.push(sl);
          onbekendeSleutels.add(sl);
          continue;
        }
        /* EEN LEVERANCIER UIT DE BEDRADING TREKT ZIJN EIGEN SLUITING NIET MEE.
           Dezelfde fout als bij een route die in server.js hangt, maar langs een
           andere weg: `app` en `auth` komen uit server.js, en dat ene sleuteltje
           blies de envelop weer op tot het hele huis. Een toets ving het. */
        if (isBedrading(bron)) uitBedrading.add(sl); else leveranciers.add(bron);
      }
    }
    const bereikt = sluiting(graaf, [...eigen, ...leveranciers]);
    const knopen = new Set();
    for (const b of bereikt) { const k = V.knoopVan(b); if (k) knopen.add(k.laag + ':' + k.domein); }
    const perLaag = {};
    for (const k of knopen) { const l = k.split(':')[0]; perLaag[l] = (perLaag[l] || 0) + 1; }
    /* De onverklaarde randen die BINNEN deze envelop vallen. Dat is het getal
       dat een trede onveilig maakt: niet hoe groot de envelop is, maar hoeveel
       ervan niemand kan uitleggen. */
    const onverklaard = [...onbekendeRanden].filter(s => {
      const [van, naar] = s.split(' -> ');
      return knopen.has(van) && knopen.has(naar);
    });
    uit.push({
      id: e.functie.id, naam: e.functie.naam, categorie: e.functie.categorie,
      standaard: e.functie.standaard !== false,
      routes: e.routes.length,
      /* DRIE GRADEN, EN ZE ZIJN NIET UITWISSELBAAR. Een envelop met een sleutel
         die nergens op uitkomt is een ONDERGRENS: er hangt meer aan, we weten
         alleen niet wat. Dat als 'gemeten' laten doorgaan is precies de fout
         die deze meter twee ronden lang maakte, en toen las 'raakt bijna niets'
         als een klein ding in plaats van als een blinde vlek. */
      /* VIER GRADEN NU, en de volgorde is de strengheid. `onbepaald` staat
         boven `ondergrens`: tegenstrijdige bronnen zijn erger dan onbekende, en
         wie ze samentelt kan onzekerheid verstoppen door preciezer te worden. */
      graad: bedrading.length ? 'deels-niet-toe-te-rekenen'
        : perKlasse.SAMENGESTELD.length ? 'onbepaald'
        : perKlasse.ONVINDBAAR.length ? 'ondergrens'
        : 'gemeten',
      sleutelsWaarde: [...new Set(perKlasse.WAARDE)].sort(),
      sleutelsOnvindbaar: [...new Set(perKlasse.ONVINDBAAR)].sort(),
      sleutelsSamengesteld: [...new Set(perKlasse.SAMENGESTELD)].sort(),
      /* ELKE RESTERENDE ONZEKERHEID DRAAGT HAAR REDEN, machineleesbaar. Een
         graad zonder reden is een cijfer waar niemand iets mee kan: dan weet je
         dat het onvolledig is en niet waarom, en dus ook niet of er iets aan te
         doen valt. */
      redenen: Object.fromEntries([...new Set([...perKlasse.ONVINDBAAR, ...perKlasse.SAMENGESTELD, ...perKlasse.WAARDE])]
        .sort().map(k => [k, (kernOnbekend[k] && kernOnbekend[k].reden) ||
          'staat niet in de kern-tas en is langs geen van de zeven constructies te herleiden'])),
      inBedrading: bedrading.length,
      ophangbestanden: alle.sort(),
      leveranciers: [...leveranciers].sort(),
      sleutelsUitBedrading: [...uitBedrading].sort(),
      sleutelsOnbekend: [...onbekendeSleutels].sort(),
      bestandenBereikt: bereikt.size,
      knopen: knopen.size, perLaag,
      domeinen: [...knopen].filter(k => k.startsWith('domein:')).sort(),
      onverklaardeRanden: onverklaard.sort()
    });
  }
  return { envelopen: uit.sort((a, b) => b.knopen - a.knopen), zonderFunctie };
}

/* ------------------------------------------------------------------ meten -- */

function meet() {
  const herkomst = require('./lib/routeherkomst').lees();
  const { functieVoorPad } = require(path.join(WORTEL, 'server', 'functies', 'toegangpad'));
  const { prefixLengte } = require(path.join(WORTEL, 'server', 'functies', 'toegangpad'));
  const BEDIENING = require(path.join(WORTEL, 'server', 'kern', 'platformregister', 'bediening'));

  const verstrengeling = V.meet();
  const onbekendeRanden = new Set(verstrengeling.alle.filter(r => r.soort === 'ONBEKEND').map(r => r.van + ' -> ' + r.naar));
  const ruw = V.lees();
  const { graaf, onvindbaar } = bestandsgraaf(ruw);
  /* De omgekeerde graaf (wie requiret dit bestand) en de voorwaartse per ouder:
     samen zijn dat de ouder- en zusterrelaties waarop herleidSleutel() zoekt. */
  const ouders = new Map(), kinderen = new Map();
  for (const r of ruw) {
    const naar = resolveer(r.naar);
    if (!naar) continue;
    if (!ouders.has(naar)) ouders.set(naar, new Set());
    ouders.get(naar).add(r.van);
    if (!kinderen.has(r.van)) kinderen.set(r.van, new Set());
    kinderen.get(r.van).add(naar);
  }

  const leesCache = new Map();
  const leesBestand = b => {
    if (!leesCache.has(b)) {
      try { leesCache.set(b, fs.readFileSync(path.join(WORTEL, b), 'utf8')); }
      catch { leesCache.set(b, ''); }
    }
    return leesCache.get(b);
  };
  const r = envelopen({ routes: herkomst.routes, graaf, functieVoorPad, onbekendeRanden,
    kernBron: herkomst.kernBron, kernOnbekend: herkomst.kernOnbekend || {},
    ouders, kinderen, leesBestand, resolveerPad: resolveer });

  /* De routes zonder functie, gesplitst in wat het platformregister als
     BEDIENING verklaart en wat daarna overblijft. Die tweede groep is de
     inventaris voor stap 4 (default-dicht) en hoort niet als een getal langs
     te komen: een route die nergens uit te zetten is, is een voordeur zonder
     naam. */
  const isBediening = pad => BEDIENING.some(b => prefixLengte(pad, b[0]) > 0);
  const bediening = r.zonderFunctie.filter(x => isBediening(x.pad));
  const onbenoemd = r.zonderFunctie.filter(x => !isBediening(x.pad));

  const alleKnopen = verstrengeling.knopen;
  const meting = r.envelopen.map(e => e.knopen).sort((a, b) => a - b);
  const mediaan = meting.length ? meting[Math.floor(meting.length / 2)] : 0;

  return {
    gemetenOp: new Date().toISOString().slice(0, 10),
    grondslag: 'require-sluiting vanaf het bestand dat de route ophangt',
    teHoog: 'een require is geen aanroep: dit is wat er wakker KAN worden, niet wat er draait',
    teLaag: 'de bus (kern/envelop.js), cron, AI-gereedschap en webhooks lopen niet via require en staan hier niet in',
    kernSleutels: herkomst.kernSleutels,
    kernSleutelsViaTekst: herkomst.kernSleutelsViaTekst,
    kernSleutelsViaMethoden: herkomst.kernSleutelsViaMethoden,
    kernOnbekend: herkomst.kernOnbekend,
    kernSleutelsHoe: 'via het merken bij require, via de waarde bij een letterlijk object, achteraf over de tas zelf, en als laatste door de brontekst van de functie letterlijk terug te zoeken (alleen bij precies EEN treffer)',
    kernTasGevonden: herkomst.kernTasGevonden,
    routes: herkomst.routes.length,
    routeLagen: herkomst.lagen,
    routesZonderEigenaar: herkomst.zonderEigenaar,
    randenOnvindbaar: onvindbaar,
    knopenTotaal: alleKnopen,
    /* DE OMGEKEERDE INDEX: welke FUNCTIES raken iets kwijt als dit domein er
       niet is. VERSTRENGELING.json beantwoordt dezelfde vraag hard (een require
       naar iets dat er niet is, faalt bij het LADEN); dit beantwoordt hem zacht
       (een route die zijn domein via de kern-tas krijgt, laadt gewoon en valt om
       bij de eerste aanroep). Twee soorten breuk, met opzet niet opgeteld -- ze
       vragen verschillende reparaties en ze vallen op verschillende momenten.

       Dit is het getal waar een trede op staat of valt: het zegt of RTG Horeca
       zichtbaar kan zijn terwijl Mobility uit de runtime verdwijnt. */
    perDomein: (() => {
      const kaart = new Map();
      for (const e of r.envelopen) for (const d of e.domeinen) {
        if (!kaart.has(d)) kaart.set(d, []);
        kaart.get(d).push(e.id);
      }
      return [...kaart].map(([domein, functies]) => ({ domein, functies: functies.length, welke: functies.sort() }))
        .sort((a, b) => b.functies - a.functies);
    })(),
    functiesMetEnvelop: r.envelopen.length,
    perGraad: r.envelopen.reduce((a, e) => { a[e.graad] = (a[e.graad] || 0) + 1; return a; }, {}),
    /* De twee getallen apart, en met opzet NIET opgeteld: preciezer worden mag
       nooit betekenen dat onzekerheid van de ene naar de andere emmer schuift. */
    ondergrens: r.envelopen.filter(e => e.graad === 'ondergrens').length,
    onbepaald: r.envelopen.filter(e => e.graad === 'onbepaald').length,
    zonderReden: r.envelopen.filter(e => (e.graad === 'ondergrens' || e.graad === 'onbepaald') &&
      [...(e.sleutelsOnvindbaar || []), ...(e.sleutelsSamengesteld || [])].some(k => !(e.redenen || {})[k])).length,
    functiesNietToeTeRekenen: r.envelopen.filter(e => e.graad === 'deels-niet-toe-te-rekenen').length,
    sleutelsOnopgelost: [...new Set(r.envelopen.flatMap(e => e.sleutelsOnbekend))].sort(),
    grootste: r.envelopen[0] ? { id: r.envelopen[0].id, knopen: r.envelopen[0].knopen,
      pct: Math.round(r.envelopen[0].knopen / alleKnopen * 100) } : null,
    mediaanKnopen: mediaan,
    mediaanPct: Math.round(mediaan / alleKnopen * 100),
    routesZonderFunctie: r.zonderFunctie.length,
    bediening: bediening.length,
    onbenoemd: onbenoemd.length,
    onbenoemdeRoutes: onbenoemd.map(x => x.methode + ' ' + x.pad + '  [' + (x.bestand || 'geen eigenaar') + ']').sort(),
    envelopen: r.envelopen
  };
}

/* ---------------------------------------------------------------- rapport -- */

function rapport(r) {
  const L = [];
  L.push('DE ACTIVERING -- ' + r.gemetenOp);
  L.push('');
  L.push(`  ${r.routes} routes uit ${r.routeLagen} lagen, ${r.routesZonderEigenaar} zonder eigenaar.`);
  L.push(`  ${r.functiesMetEnvelop} functies dragen routes. Het huis telt ${r.knopenTotaal} knopen.`);
  L.push(`  De kern-tas leverde ${r.kernSleutels} herleidbare sleutels, waarvan ${r.kernSleutelsViaTekst}`);
  L.push('  door de brontekst van de functie letterlijk terug te zoeken (uniek, anders onbekend).');
  L.push('  PER GRAAD: ' + Object.entries(r.perGraad).map(([g, n]) => `${n} ${g}`).join(', ') + '.');
  L.push(`  'ondergrens' (${r.ondergrens}) betekent: er hangt meer aan dan hier staat, en NIEUWE`);
  L.push(`  broninformatie zou helpen. 'onbepaald' (${r.onbepaald}) betekent: bronnen spreken elkaar tegen.`);
  L.push(`  Die twee worden nooit opgeteld. Envelopen met een onzekerheid ZONDER reden: ${r.zonderReden}.`);
  L.push('');
  L.push(`  GROOTSTE ENVELOP: ${r.grootste.id} raakt ${r.grootste.knopen} knopen (${r.grootste.pct}%).`);
  L.push(`  MEDIAAN: een functie raakt ${r.mediaanKnopen} knopen (${r.mediaanPct}%).`);
  L.push('');
  L.push('  BREEDSTE FUNCTIES (knopen = wat er wakker kan worden)');
  for (const e of r.envelopen.slice(0, 15))
    L.push(`    ${String(e.knopen).padStart(4)}  ${e.id.padEnd(22)} ${String(e.routes).padStart(4)} routes  ` +
      `${e.graad === 'gemeten' ? '' : '[' + e.graad + '] '}` +
      `${e.onverklaardeRanden.length ? e.onverklaardeRanden.length + ' onverklaarde rand(en)' : ''}`);
  L.push('');
  L.push('  SMALSTE FUNCTIES (de kandidaten voor een eerste trede -- let op de graad:');
  L.push('  een ondergrens is geen kleine envelop maar een onvolledige)');
  for (const e of r.envelopen.slice(-12).reverse())
    L.push(`    ${String(e.knopen).padStart(4)}  ${e.id.padEnd(22)} ${String(e.routes).padStart(4)} routes`);
  L.push('');
  L.push('  WELKE FUNCTIES RAKEN IETS KWIJT ALS DIT DOMEIN UIT DE RUNTIME GAAT');
  L.push('  (zacht: via de kern-tas, dus het breekt bij de AANROEP en niet bij het laden.');
  L.push('  De harde kant staat in VERSTRENGELING.json onder uitneembaar.)');
  for (const d of r.perDomein.slice(0, 10))
    L.push(`      ${d.domein.padEnd(30)} ${String(d.functies).padStart(3)} functies`);
  const alleen = r.perDomein.filter(d => d.functies === 1).length;
  L.push(`      ... en ${alleen} domeinen die maar EEN functie raken -- dat zijn de kandidaten`);
  L.push('      om als eerste zichtbaar te maken of als eerste uit te zetten.');
  L.push('');
  L.push(`  ROUTES ZONDER FUNCTIE: ${r.routesZonderFunctie}`);
  L.push(`    ${r.bediening} verklaard als BEDIENING door het platformregister (de besturing zelf)`);
  L.push(`    ${r.onbenoemd} ONBENOEMD -- nergens uit te zetten, want functieAan() geeft true bij een onbekende id.`);
  L.push('    Dat is de inventaris voor stap 4 van de keten, en de eerste twintig zijn:');
  for (const p of r.onbenoemdeRoutes.slice(0, 20)) L.push('      ' + p);
  L.push('');
  L.push('  WAT DIT GETAL NIET IS');
  L.push('    te hoog: ' + r.teHoog);
  L.push('    te laag: ' + r.teLaag);
  return L.join('\n');
}

/* ------------------------------------------------------------------ start -- */

if (require.main === module) {
  const args = process.argv.slice(2);
  const r = meet();
  if (args.includes('--json')) process.stdout.write(JSON.stringify(r, null, 2) + '\n');
  else if (args.includes('--vastleggen')) {
    fs.writeFileSync(path.join(WORTEL, 'ACTIVERING.json'), JSON.stringify(r, null, 2) + '\n');
    process.stdout.write(rapport(r) + '\n\nVastgelegd in ACTIVERING.json\n');
  } else process.stdout.write(rapport(r) + '\n');
  process.exit(0);
}

module.exports = { resolveer, bestandsgraaf, sluiting, envelopen, meet, rapport, kernSleutelsVan, isBedrading, herleidSleutel };
