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
  kernBron = {}, leesBestand = () => '' }) {
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
    for (const b of eigen) {
      for (const sl of kernSleutelsVan(leesBestand(b) || '')) {
        const bron = kernBron[sl];
        if (!bron) { onbekendeSleutels.add(sl); continue; }
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
      graad: bedrading.length ? 'deels-niet-toe-te-rekenen'
        : (onbekendeSleutels.size ? 'ondergrens' : 'gemeten'),
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
  const { graaf, onvindbaar } = bestandsgraaf(V.lees());

  const leesCache = new Map();
  const leesBestand = b => {
    if (!leesCache.has(b)) {
      try { leesCache.set(b, fs.readFileSync(path.join(WORTEL, b), 'utf8')); }
      catch { leesCache.set(b, ''); }
    }
    return leesCache.get(b);
  };
  const r = envelopen({ routes: herkomst.routes, graaf, functieVoorPad, onbekendeRanden,
    kernBron: herkomst.kernBron, leesBestand });

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
  L.push(`  'ondergrens' betekent: er hangt meer aan dan hier staat. ${r.sleutelsOnopgelost.length} sleutels`);
  L.push('  komen nergens op uit -- de meeste uit server.js zelf (officeAuth, PERSONAS, anthropic).');
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

module.exports = { resolveer, bestandsgraaf, sluiting, envelopen, meet, rapport, kernSleutelsVan, isBedrading };
