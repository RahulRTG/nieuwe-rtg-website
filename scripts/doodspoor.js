#!/usr/bin/env node
'use strict';
/* ============================================================================
   HET DODE SPOOR -- heeft elke handeling van een actor een ontvanger?

   WAAR DIT UIT KOMT. MAATSTAF.md par. 3 zet "geen dood spoor" als de duurste
   nieuwe regel van het huis: de eerste handeling is uitgevoerd, en niemand
   bezit wat daarna moet gebeuren. Die zin stond al op vijf plekken in de code
   (mailaanname, gift, rtfwallet, webplatform, rtmail-schrijf), telkens lokaal
   en telkens anders geformuleerd. Nergens werd hij gemeten. Dit script meet hem.

   WAT HIJ MEET, en dat is smaller dan de regel:

     bron        een route die in de idempotentieproef (IDEMPROEF.json) werk
                 deed (eerste status 2xx) en een collectie AANRAAKTE
     collectie   wat die route veranderde -- het `opslag`-veld van de proef,
                 gemeten en niet geraden (kern/stuur/gevolg.js leest hetzelfde)
     ontvanger   een route van een ANDERE actorgroep die diezelfde collectie
                 aanraakt (zet-stand, gemeten) of leest (leest, uit de bron en
                 daarom VERMOED)

   Vier actorgroepen, afgeleid uit de rol die de proef hanteerde:
     consument   member, openbaar, eigen-poort
     aanbieder   supplier, werkplekbaas
     kantoor     office, boardroom, kantoor-op-naam
     platform    techniek, scim, omgeving

   Een handoff is dan een van VIER dingen, en er is met opzet geen schaal:
     gesloten    een andere groep zet een stand op dezelfde collectie (gemeten)
     gezien      een andere groep leest hem alleen; niemand zet er iets op
                 (vermoed, want uit de brontekst)
     eigen       de collectie is per definitie van een mens en heeft geen
                 tweede partij; staat in EIGEN met de reden
     open        geen ontvanger gevonden en geen verklaring

   "Eigen" is een VERKLARING en geen afwezigheid: een agenda heeft geen
   ontvanger nodig, maar dat hoort iemand te hebben opgeschreven. Een reden die
   niemand meer nodig heeft, laat de controle zakken (dezelfde vorm als
   MET_REDEN in scripts/tikken.js).

   WAT HIJ NIET ZIET, en dat staat er in de uitslag bij:
     - een ontvanger die NIET via een collectie loopt (een mail, een sms, een
       webhook) -- die staat in de kostenmeters, niet hier;
     - een route die in de proef geen werk deed (404/409) -- die is niet
       gemeten en telt niet als open, want niet gemeten is geen oordeel;
     - eigenaar, termijn en verval van een stand -- dat is het statuscontract
       uit MAATSTAF.md par. 4 en dat bestaat nog niet;
     - de terugrichting (platform -> zaak) wordt wel geteld in de matrix maar
       is met dezelfde smalle lens gemeten.

   DE EERSTE RONDE IS EEN METING EN GEEN POORT. Pas als de betekenis van "open"
   schoon is (legitieme uitzonderingen in EIGEN, verkeerde koppelingen
   gerepareerd) mag de regel hard worden. Tot die tijd exitcode 0, en de
   getallen gaan naar DOODSPOOR.json en van daar in MAATSTAF.md.

   Draaien:  npm run doodspoor           (print)
             npm run doodspoor:vast      (schrijft DOODSPOOR.json)
             npm run doodspoor:controle  (zakt op een verlopen reden)
   ============================================================================ */
const fs = require('fs');
const path = require('path');

const WORTEL = path.join(__dirname, '..');
const DOEL = path.join(WORTEL, 'DOODSPOOR.json');

const GROEPEN = {
  consument: ['member', 'openbaar', 'eigen-poort'],
  aanbieder: ['supplier', 'werkplekbaas'],
  kantoor: ['office', 'boardroom', 'kantoor-op-naam'],
  platform: ['techniek', 'scim', 'omgeving']
};

/* Collecties die geen OBJECT zijn waar een ontvanger op handelt, maar
   infrastructuur die elke aanroep aanraakt. Ze tellen niet als handoff en
   ook niet als dood spoor. Elke regel draagt zijn reden. */
const INFRA = {
  sessions: 'de sessietabel; elke aanroep raakt hem',
  wacht: 'de wachtrij van de rem (pin-deur); geen zaakobject',
  techniek: 'de technische status; geen zaakobject',
  bankIdem: 'idempotentiesleutels van de bank; bewijs van herhaling, geen object',
  bankIdemAfdruk: 'afdrukken bij die sleutels; idem',
  betaalIdem: 'idempotentiesleutels van de betaalpoort; idem',
  payIdem: 'idempotentiesleutels van RTG Pay (kern/pay/poort.js); idem',
  payIdemAfdruk: 'afdrukken bij die sleutels; idem',
  contactPinSecurity: 'de rem op de contactpin (LINK.md); geen object maar een teller',
  onboarding: 'de onboardingsstand van een sessie; hoort bij de mens en niet bij een zaak'
};

/* Collecties die per definitie EEN mens toebehoren en geen tweede partij
   hebben. Een agenda-item heeft geen ontvanger nodig; dat is geen dood spoor
   maar de aard van het object. Dit is een verklaring, dus met reden, en een
   reden zonder collectie in de meting is verlopen. */
const EIGEN = {
  agendas: 'de eigen agenda van een lid (LIVING); een afspraak MET iemand loopt via sociaal',
  bankPassen: 'de eigen pas van een lid: bevriezen en limiet zijn eigen instellingen; uitgeven loopt via de poort',
  bankRekeningen: 'de eigen rekening en spaardoelen van een lid',
  bankTerugkerend: 'eigen terugkerende overboekingen; de uitvoering loopt via bankBoekingen',
  gedachten: 'het gedachtenboek; met opzet ongedeeld',
  appstore: 'de eigen tijdlijn en machtigingen van een lid (APPSTORE.md: het dossier staat bij het LID)'
};

/* Een ontvanger die de meter NIET kan zien, door een mens aangewezen -- met de
   route als bewijs. De lezer-index volgt requires, en dit huis geeft zijn
   kernmodules via een context door (octx), dus een kantoorroute die een
   collectie leest via kern/rechterhand staat voor de index onzichtbaar.
   Gemeten: routes/office/concierge.js bereikt data.lifestyle op geen enkele
   diepte. Een verklaring hier wordt GETOETST: de route moet bestaan, in een
   andere groep zitten en in de proef werk hebben gedaan; anders is hij
   verlopen en zakt de naloop. Dit is de brug uit EXECUTIE.md blok 0: een
   aanwijzing wordt tegen de echte routes gehouden, nooit geloofd. */
const ONTVANGER = {
  lifestyle: { route: 'POST /api/office/concierge', reden: 'het conciergebureau (De Rechterhand) leest de vragen van Lifestyle-leden via kern/rechterhand, dat via octx binnenkomt' }
};

function leesProef() {
  try { return JSON.parse(fs.readFileSync(path.join(WORTEL, 'IDEMPROEF.json'), 'utf8')); }
  catch (e) { return null; }
}

function groepVan(rol) {
  for (const [g, rollen] of Object.entries(GROEPEN)) if (rollen.includes(rol)) return g;
  return null;
}

function deedWerk(r) {
  return Array.isArray(r.statussen) && r.statussen.length > 0 && r.statussen[0] >= 200 && r.statussen[0] < 300;
}

function collectiesVan(r) {
  const a = (r.opslag && r.opslag.a) || {};
  return Object.keys(a).filter(k => !INFRA[k]);
}

/* ---- STATISCHE LEZERS: welk bronbestand (plus een hop requires) leest
   `data.<collectie>`? Vermoed en geen meting, en zo gelabeld. ---- */
function lezerIndex(routes) {
  const tekst = new Map();
  function lees(rel) {
    if (tekst.has(rel)) return tekst.get(rel);
    let t = null;
    try { t = fs.readFileSync(path.join(WORTEL, rel), 'utf8'); } catch (e) { t = ''; }
    tekst.set(rel, t);
    return t;
  }
  function hop(rel) {
    const t = lees(rel);
    const uit = [rel];
    for (const m of t.matchAll(/require\(\s*'(\.[^']+)'\s*\)/g)) {
      let doel = path.posix.normalize(path.posix.join(path.posix.dirname(rel), m[1]));
      if (!doel.endsWith('.js')) {
        if (fs.existsSync(path.join(WORTEL, doel + '.js'))) doel += '.js';
        else if (fs.existsSync(path.join(WORTEL, doel, 'index.js'))) doel += '/index.js';
        else continue;
      }
      if (doel.startsWith('server/')) uit.push(doel);
    }
    return uit;
  }
  const perBestand = new Map();   // bestand -> Set(collecties gelezen)
  for (const r of routes) {
    if (!r.bestand || perBestand.has(r.bestand)) continue;
    const gelezen = new Set();
    for (const rel of hop(r.bestand)) {
      const t = lees(rel);
      for (const m of t.matchAll(/\bdata\.([A-Za-z_$][\w$]*)/g)) gelezen.add(m[1]);
    }
    perBestand.set(r.bestand, gelezen);
  }
  return perBestand;
}

/* ---- DE METING ----
   proef:  IDEMPROEF.json (of een nagebootste, voor de toetsen)
   routes: alleRoutes() met bestand per route (of []: dan geen lezers, en dat
           staat in de uitslag als nietGezien.lezers) */
function meet({ proef, routes } = {}) {
  proef = proef || leesProef();
  if (!proef || !Array.isArray(proef.perRoute)) return { fout: 'IDEMPROEF.json ontbreekt -- draai eerst: npm run idemproef' };
  routes = routes || [];
  const bestandVan = new Map(routes.map(r => [r.methode + ' ' + r.pad, r.bestand]));
  const lezers = routes.length ? lezerIndex(routes) : new Map();

  const gemeten = proef.perRoute.filter(r => r && r.pad && deedWerk(r));
  const zonderRol = gemeten.filter(r => !groepVan(r.rol)).length;
  const bronnen = gemeten.filter(r => groepVan(r.rol) && collectiesVan(r).length);

  /* wie ZET een stand op een collectie, per groep -- gemeten uit de proef */
  const zetters = new Map();   // collectie -> Map(groep -> Set(pad))
  for (const r of gemeten) {
    const g = groepVan(r.rol);
    if (!g) continue;
    for (const c of collectiesVan(r)) {
      if (!zetters.has(c)) zetters.set(c, new Map());
      const m = zetters.get(c);
      if (!m.has(g)) m.set(g, new Set());
      m.get(g).add(r.methode + ' ' + r.pad);
    }
  }
  /* wie LEEST een collectie, per groep -- vermoed uit de bron; alleen routes
     met een rol, want zonder rol is er geen groep en dus geen handoff */
  const lezend = new Map();    // collectie -> Map(groep -> Set(pad))
  for (const r of proef.perRoute) {
    const g = groepVan(r && r.rol);
    if (!g) continue;
    const b = bestandVan.get(r.methode + ' ' + r.pad);
    const set = b && lezers.get(b);
    if (!set) continue;
    for (const c of set) {
      if (INFRA[c]) continue;
      if (!lezend.has(c)) lezend.set(c, new Map());
      const m = lezend.get(c);
      if (!m.has(g)) m.set(g, new Set());
      m.get(g).add(r.methode + ' ' + r.pad);
    }
  }

  /* de aangewezen ontvangers, getoetst tegen de proef */
  const aangewezen = new Map();   // collectie -> { groep, route }
  const verlopenOntvanger = [];
  for (const [c, d] of Object.entries(ONTVANGER)) {
    const [methode, pad] = String(d.route).split(' ');
    const r = proef.perRoute.find(x => x && x.methode === methode && x.pad === pad);
    if (!r || !groepVan(r.rol) || !deedWerk(r)) { verlopenOntvanger.push(c + ' -> ' + d.route); continue; }
    aangewezen.set(c, { groep: groepVan(r.rol), route: d.route });
  }

  function andere(map, groep) {
    const uit = {};
    if (!map) return uit;
    for (const [g, set] of map) if (g !== groep && set.size) uit[g] = [...set].sort();
    return uit;
  }

  const perCollectie = new Map();
  const perRoute = [];
  const matrix = {};
  for (const g of Object.keys(GROEPEN)) { matrix[g] = {}; for (const h of Object.keys(GROEPEN)) if (h !== g) matrix[g][h] = 0; }

  for (const r of bronnen) {
    const groep = groepVan(r.rol);
    const cs = collectiesVan(r).map(c => {
      const zet = andere(zetters.get(c), groep);
      const lees = andere(lezend.get(c), groep);
      let stand, graad;
      if (Object.keys(zet).length) { stand = 'gesloten'; graad = 'gemeten'; }
      else if (Object.keys(lees).length) { stand = 'gezien'; graad = 'vermoed'; }
      else if (aangewezen.has(c) && aangewezen.get(c).groep !== groep) { stand = 'gezien'; graad = 'aangewezen'; lees[aangewezen.get(c).groep] = [aangewezen.get(c).route]; }
      else if (EIGEN[c]) { stand = 'eigen'; graad = 'verklaard'; }
      else { stand = 'open'; graad = null; }
      for (const h of Object.keys(zet)) matrix[groep][h]++;
      if (!perCollectie.has(c)) perCollectie.set(c, { collectie: c, bronnen: 0, stand, graad, zetStand: zet, leest: lees, reden: EIGEN[c] || null });
      perCollectie.get(c).bronnen++;
      return { collectie: c, stand, graad, zetStand: Object.keys(zet), leest: Object.keys(lees) };
    });
    const standen = cs.map(x => x.stand);
    const stand = standen.includes('open') ? 'open'
      : standen.includes('gezien') ? 'gezien'
        : standen.includes('gesloten') ? 'gesloten' : 'eigen';
    perRoute.push({ methode: r.methode, pad: r.pad, rol: r.rol, groep, stand, collecties: cs });
  }

  const telling = { bronroutes: perRoute.length, gesloten: 0, gezien: 0, eigen: 0, open: 0, openCollecties: 0 };
  for (const r of perRoute) telling[r.stand]++;
  const perGroep = {};
  for (const g of Object.keys(GROEPEN)) {
    perGroep[g] = { bronroutes: 0, gesloten: 0, gezien: 0, eigen: 0, open: 0 };
    for (const r of perRoute) if (r.groep === g) { perGroep[g].bronroutes++; perGroep[g][r.stand]++; }
  }

  const gebruikteEigen = new Set([...perCollectie.keys()].filter(c => EIGEN[c]));
  const verlopenEigen = Object.keys(EIGEN).filter(c => !gebruikteEigen.has(c));
  const alleCollecties = new Set();
  for (const r of gemeten) for (const k of Object.keys((r.opslag && r.opslag.a) || {})) alleCollecties.add(k);
  const verlopenInfra = Object.keys(INFRA).filter(c => !alleCollecties.has(c));
  const gebruikteAangewezen = new Set([...perCollectie.values()].filter(x => x.graad === 'aangewezen').map(x => x.collectie));
  for (const c of aangewezen.keys()) if (!gebruikteAangewezen.has(c)) verlopenOntvanger.push(c + ' -> ' + aangewezen.get(c).route + ' (niet meer nodig: de meter ziet de ontvanger zelf)');

  const openCollecties = [...perCollectie.values()].filter(x => x.stand === 'open')
    .sort((a, b) => b.bronnen - a.bronnen || a.collectie.localeCompare(b.collectie))
    .map(x => ({ collectie: x.collectie, bronroutes: x.bronnen }));
  telling.openCollecties = openCollecties.length;

  return {
    stempel: new Date().toISOString().slice(0, 10),
    uitleg: 'Gemeten met scripts/doodspoor.js uit IDEMPROEF.json (wie raakt welke collectie aan, per rol) plus de brontekst (wie leest hem). Een handoff is gesloten, gezien, eigen of open; er is geen schaal. "gezien" is vermoed en "open" is geen oordeel over een route die niet gemeten is. Zie MAATSTAF.md par. 3.',
    grens: 'Dit meet alleen handoffs die via een collectie lopen. Mail, sms en webhooks als ontvanger vallen erbuiten; eigenaar, termijn en verval van een stand ook (statuscontract, nog niet gebouwd). De eerste ronde is een meting en geen poort.',
    telling,
    perGroep,
    matrix,
    nietGezien: {
      zonderRol: zonderRol,
      nietGemeten: proef.perRoute.length - gemeten.length,
      lezers: routes.length ? null : 'geen routelijst meegegeven: de stand "gezien" kon niet worden vastgesteld'
    },
    infra: Object.keys(INFRA).length,
    eigenVerklaard: Object.keys(EIGEN).length,
    aangewezen: Object.keys(ONTVANGER).length,
    verlopen: { eigen: verlopenEigen, infra: verlopenInfra, ontvanger: verlopenOntvanger },
    openCollecties,
    perCollectie: [...perCollectie.values()].sort((a, b) => a.collectie.localeCompare(b.collectie)),
    perRoute: perRoute.sort((a, b) => a.pad.localeCompare(b.pad))
  };
}

function druk(u) {
  const t = u.telling;
  console.log('doodspoor: ' + t.bronroutes + ' bronroutes met gemeten werk -- ' +
    t.gesloten + ' gesloten (gemeten), ' + t.gezien + ' gezien (vermoed), ' +
    t.eigen + ' eigen (verklaard), ' + t.open + ' open.');
  for (const [g, x] of Object.entries(u.perGroep)) if (x.bronroutes)
    console.log('  ' + g.padEnd(10) + x.bronroutes + ' bron, ' + x.gesloten + ' gesloten, ' + x.gezien + ' gezien, ' + x.eigen + ' eigen, ' + x.open + ' open');
  console.log('  matrix (bron -> ontvanger, gesloten relaties per collectie):');
  for (const [g, rij] of Object.entries(u.matrix))
    console.log('    ' + g.padEnd(10) + Object.entries(rij).map(([h, n]) => h + ' ' + n).join('  '));
  console.log('  niet gezien: ' + u.nietGezien.zonderRol + ' routes zonder groep, ' + u.nietGezien.nietGemeten + ' routes die in de proef geen werk deden' +
    (u.nietGezien.lezers ? '; ' + u.nietGezien.lezers : ''));
  if (u.openCollecties.length) {
    console.log('  open collecties (' + u.openCollecties.length + '), meeste bronroutes eerst:');
    for (const x of u.openCollecties.slice(0, 25)) console.log('    ' + x.collectie.padEnd(28) + x.bronroutes);
  }
  if (u.verlopen.eigen.length || u.verlopen.infra.length || u.verlopen.ontvanger.length)
    console.log('  VERLOPEN redenen: eigen ' + JSON.stringify(u.verlopen.eigen) + ', infra ' + JSON.stringify(u.verlopen.infra) + ', ontvanger ' + JSON.stringify(u.verlopen.ontvanger));
}

module.exports = { meet, GROEPEN, INFRA, EIGEN, ONTVANGER, groepVan, deedWerk, collectiesVan, DOEL };

if (require.main === module) {
  const argv = process.argv.slice(2);
  const controle = argv.includes('--controle');
  if (controle) {
    /* De naloop: geen meting, alleen de redenen tegen het register houden. */
    let j;
    try { j = JSON.parse(fs.readFileSync(DOEL, 'utf8')); }
    catch (e) { console.error('DOODSPOOR.json bestaat niet; draai eerst npm run doodspoor:vast'); process.exit(1); }
    const klachten = [];
    if (j.verlopen.eigen.length) klachten.push('een eigen-reden die niemand meer nodig heeft: ' + j.verlopen.eigen.join(', '));
    if (j.verlopen.infra.length) klachten.push('een infra-reden die niemand meer nodig heeft: ' + j.verlopen.infra.join(', '));
    if (j.verlopen.ontvanger.length) klachten.push('een aangewezen ontvanger die niet klopt of niet meer nodig is: ' + j.verlopen.ontvanger.join(', '));
    if (!j.telling.bronroutes) klachten.push('nul bronroutes: de meter heeft niets gezien en mag niet groen zijn');
    if (klachten.length) { console.error(klachten.join('\n')); process.exit(1); }
    console.log('doodspoor (naloop): ' + j.telling.bronroutes + ' bronroutes, ' + j.telling.open + ' open, alle verklaringen in gebruik.');
    process.exit(0);
  }
  const { alleRoutes } = require('./lib/routes');
  const u = meet({ routes: alleRoutes() });
  if (u.fout) { console.error(u.fout); process.exit(1); }
  if (argv.includes('--json')) { console.log(JSON.stringify(u)); process.exit(0); }
  druk(u);
  if (argv.includes('--vastleggen')) {
    fs.writeFileSync(DOEL, JSON.stringify(u, null, 2) + '\n');
    console.log('geschreven: DOODSPOOR.json');
  }
}
