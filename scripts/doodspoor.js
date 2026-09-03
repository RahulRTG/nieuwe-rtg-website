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
                 (vermoed uit de brontekst, of aangewezen door een mens)
     tussen      de ontvanger is een ANDER LID, en dat kan dit groepenmodel
                 principieel niet zien; staat in TUSSEN met de tegenroute
     terminaal   de collectie wacht op niemand -- van een mens, van het huis,
                 of een boeking; staat in TERMINAAL met de soort en de reden
     open        geen ontvanger gevonden en geen verklaring

   "Terminaal" is een VERKLARING en geen afwezigheid: een agenda heeft geen
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
  kassaIdem: 'idempotentiesleutels van de kassa; idem',
  kassaIdemAfdruk: 'afdrukken bij die sleutels; idem',
  wervingIdem: 'idempotentiesleutels van de werving; idem',
  wervingIdemAfdruk: 'afdrukken bij die sleutels; idem',
  contactPinSecurity: 'de rem op de contactpin (LINK.md); geen object maar een teller',
  onboarding: 'de onboardingsstand van een sessie; hoort bij de mens en niet bij een zaak'
};

/* TERMINAAL -- een collectie die op niemand wacht, met de SOORT erbij.

   Dit heette eerst EIGEN en dekte alleen "van een mens". De triage van 3
   september 2026 liep daar in een uur op vast: `zelfzorg` is van het KANTOOR
   (het platform onderhoudt zijn eigen machine) en `paySaldi` is van NIEMAND --
   het is een positie in het grootboek. Alle drie zijn ze terminaal en geen dood
   spoor, maar wie ze onder een woord schuift, verliest juist de reden waarom.
   Vandaar drie soorten, en een vierde erbij verzinnen is een besluit:

     mens     het eigen dossier van een lid; een tweede partij hoort er niet
     huis     RTG onderhoudt zijn eigen machine; de ontvanger is dit huis zelf
     boeking  een grootboekregel of positie -- hij IS het bewijs dat een handoff
              plaatsvond en wacht daarom op niemand (WAARDE.md)

   De grens bij `huis` is smal en met opzet: hij geldt voor de machine, nooit
   voor een zaak of een lid. Een kantoorroute die iets doet MET een klant is
   geen zelfzorg, en die staat hier dus niet. */
const TERMINAAL = {
  agendas: { soort: 'mens', reden: 'de eigen agenda van een lid (LIVING); een afspraak MET iemand loopt via sociaal' },
  bankPassen: { soort: 'mens', reden: 'de eigen pas van een lid: bevriezen en limiet zijn eigen instellingen; uitgeven loopt via de poort' },
  bankRekeningen: { soort: 'mens', reden: 'de eigen rekening en spaardoelen van een lid' },
  bankTerugkerend: { soort: 'mens', reden: 'eigen terugkerende overboekingen; de uitvoering loopt via bankBoekingen' },
  gedachten: { soort: 'mens', reden: 'het gedachtenboek; met opzet ongedeeld' },
  appstore: { soort: 'mens', reden: 'de eigen tijdlijn en machtigingen van een lid (APPSTORE.md: het dossier staat bij het LID)' },
  gewoonten: { soort: 'mens', reden: 'de eigen gewoonten van een lid; er is geen tweede partij die ze bijhoudt' },
  boeken: { soort: 'mens', reden: 'de leesvoortgang van een lid' },
  rahulStemming: { soort: 'mens', reden: 'hoe een lid zijn eigen Rahul wil horen; een toon is geen taak voor een ander' },
  noodkaarten: { soort: 'mens', reden: 'de eigen noodkaart van een lid; het DELEN ervan is een aparte handeling met een eigen route' },
  levensbeleid: { soort: 'mens', reden: 'de eigen keuzes van een lid in LEVEN.md; sturen mag daar juist niet' },
  fluister: { soort: 'mens', reden: 'het geheugen van Rahul over een lid -- weetjes die het lid zelf vertelde en de focus die het zelf opbouwde (kern/fluister.js: "allebei van de gebruiker zelf", wisbaar per stuk)' },
  geldbeleid: { soort: 'mens', reden: 'de eigen geldgrens van een lid (kern/geldbeleid/grens.js); die weigert, en weigeren is geen overdracht' },

  zelfzorg: { soort: 'huis', reden: 'het platform ruimt zichzelf op, beschermt en repareert zichzelf (kern/zelfzorg/index.js); wat een mens moet beslissen wordt daar al een ADVIES en dat loopt langs een andere collectie' },
  zandbakken: { soort: 'huis', reden: 'de zandbakken van de ops-cockpit (kern/command/zandbak.js); een proefomgeving heeft geen klant' },
  sondeMonsters: { soort: 'huis', reden: 'de monsters van de sonde (kern/command/sonde.js); een meting van de machine zelf' },
  apiPoort: { soort: 'huis', reden: 'de stand van de eigen API-poort (kern/command/apipoort.js)' },
  onderzoeker: { soort: 'huis', reden: 'de tweede AI van het RTG Kantoor, gebouwd door de eerste (kern/rtgonderzoeker.js)' },
  boardroom: { soort: 'huis', reden: 'de uitrolregie van RTG zelf (kern/command/uitrolregie.js)' },

  paySaldi: { soort: 'boeking', reden: 'de saldopositie in RTG Pay; een positie wacht op niemand -- wie eraan moet doen, staat in payVerzoeken' },
  payBoekingen: { soort: 'boeking', reden: 'de grootboekregels van RTG Pay (WAARDE.md: dubbel geboekt, een correctie is een nieuwe regel)' },
  bankSaldi: { soort: 'boeking', reden: 'de saldopositie van de bank' },
  bankBoekingen: { soort: 'boeking', reden: 'de grootboekregels van de bank' }
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

/* TUSSEN -- de blinde vlek van de vier groepen, uitgeschreven in plaats van
   weggewerkt.

   Vier actorgroepen kunnen een handoff van EEN LID NAAR EEN ANDER LID niet
   zien: beide zijn `consument`, dus de meter noemt de ontvanger "dezelfde
   groep" en zet de bron op open. Dat is geen randgeval maar precies wat een
   betaalverzoek is: `/api/pay/verzoek` maakt hem, `/api/pay/verzoek/betaal`
   voldoet hem, en dat zijn twee mensen. Een groepenmodel fijner maken zou de
   meting niet redden -- twee leden zijn per definitie dezelfde soort actor.

   De verklaring draagt daarom de TEGENROUTE, en die wordt getoetst tegen de
   routelijst van de server: bestaat hij niet, dan is de verklaring verlopen en
   zakt de naloop. Of de proef hem heeft kunnen MÉTEN is een tweede vraag, en
   het antwoord staat apart in de uitslag: `/api/member/pin/zoek` bestaat en gaf
   in de proef 400, omdat er geen geldige pin was om te zoeken. Niet gemeten is
   geen oordeel (LAT.md regel 12), dus dat wordt gemeld en niet verzwegen. */
const TUSSEN = {
  payVerzoeken: { tegenroute: 'POST /api/pay/verzoek/betaal', reden: 'lid A vraagt, lid B betaalt; twee mensen en een object dat op de tweede wacht' },
  contactPins: { tegenroute: 'POST /api/member/pin/zoek', reden: 'een lid geeft zijn RTG-code, een ander zoekt hem op (LINK.md); de pin-deur is de ontvanger' },
  residentie: { tegenroute: 'POST /api/residentie/pols', reden: 'De Residence is een gedeelde ruimte: wie binnenloopt of een emote doet, wordt gezien door de andere leden in dezelfde zaal -- pols() geeft de staat van de kamer terug' },
  contactPinRetired: { tegenroute: 'POST /api/member/pin/zoek', reden: 'een ingetrokken pin blijft opzoekbaar zodat een oude code niet stil bij iemand anders uitkomt' }
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

  /* TUSSEN: de tegenroute moet in de ROUTELIJST van de server staan. Of de
     proef hem kon meten is een tweede vraag en wordt apart gemeld. */
  const tussen = new Map();
  const tussenOngemeten = [];
  const verlopenTegenroute = [];
  const kentRoute = new Set(routes.map(r => r.methode + ' ' + r.pad));
  const proefIndex = new Map(proef.perRoute.map(r => [r.methode + ' ' + r.pad, r]));
  for (const [c, d] of Object.entries(TUSSEN)) {
    const bekend = routes.length ? kentRoute.has(d.tegenroute) : proefIndex.has(d.tegenroute);
    if (!bekend) { verlopenTegenroute.push(c + ' -> ' + d.tegenroute + ' (deze route bestaat niet)'); continue; }
    tussen.set(c, d);
    const pr = proefIndex.get(d.tegenroute);
    if (!pr || !deedWerk(pr)) tussenOngemeten.push(c + ' -> ' + d.tegenroute +
      (pr ? ' (de proef kreeg status ' + pr.statussen[0] + ')' : ' (staat niet in de proefronde)'));
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
      else if (tussen.has(c)) { stand = 'tussen'; graad = 'verklaard'; }
      else if (TERMINAAL[c]) { stand = 'terminaal'; graad = TERMINAAL[c].soort; }
      else { stand = 'open'; graad = null; }
      for (const h of Object.keys(zet)) matrix[groep][h]++;
      if (!perCollectie.has(c)) perCollectie.set(c, { collectie: c, bronnen: 0, stand, graad, zetStand: zet, leest: lees,
        reden: (TERMINAAL[c] && TERMINAAL[c].reden) || (TUSSEN[c] && TUSSEN[c].reden) || null });
      perCollectie.get(c).bronnen++;
      return { collectie: c, stand, graad, zetStand: Object.keys(zet), leest: Object.keys(lees) };
    });
    /* De stand van een route is de ZWAKSTE van zijn collecties: een gesloten
       collectie naast een open collectie is nog steeds een dood spoor. */
    const standen = cs.map(x => x.stand);
    const stand = ['open', 'tussen', 'gezien', 'gesloten', 'terminaal'].find(x => standen.includes(x));
    perRoute.push({ methode: r.methode, pad: r.pad, rol: r.rol, groep, stand, collecties: cs });
  }

  const telling = { bronroutes: perRoute.length, gesloten: 0, gezien: 0, tussen: 0, terminaal: 0, open: 0, openCollecties: 0 };
  for (const r of perRoute) telling[r.stand]++;
  const perGroep = {};
  for (const g of Object.keys(GROEPEN)) {
    perGroep[g] = { bronroutes: 0, gesloten: 0, gezien: 0, tussen: 0, terminaal: 0, open: 0 };
    for (const r of perRoute) if (r.groep === g) { perGroep[g].bronroutes++; perGroep[g][r.stand]++; }
  }

  const gebruikt = new Set(perCollectie.keys());
  const verlopenTerminaal = Object.keys(TERMINAAL).filter(c => !gebruikt.has(c));
  const verlopenTussen = Object.keys(TUSSEN).filter(c => !gebruikt.has(c));
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
    terminaalVerklaard: Object.keys(TERMINAAL).length,
    tussenVerklaard: Object.keys(TUSSEN).length,
    aangewezen: Object.keys(ONTVANGER).length,
    tussenOngemeten,
    verlopen: { terminaal: verlopenTerminaal, tussen: verlopenTussen, tegenroute: verlopenTegenroute,
      infra: verlopenInfra, ontvanger: verlopenOntvanger },
    openCollecties,
    perCollectie: [...perCollectie.values()].sort((a, b) => a.collectie.localeCompare(b.collectie)),
    perRoute: perRoute.sort((a, b) => a.pad.localeCompare(b.pad))
  };
}

function druk(u) {
  const t = u.telling;
  console.log('doodspoor: ' + t.bronroutes + ' bronroutes met gemeten werk -- ' +
    t.gesloten + ' gesloten (gemeten), ' + t.gezien + ' gezien (vermoed), ' +
    t.tussen + ' tussen leden, ' + t.terminaal + ' terminaal, ' + t.open + ' open.');
  for (const [g, x] of Object.entries(u.perGroep)) if (x.bronroutes)
    console.log('  ' + g.padEnd(10) + x.bronroutes + ' bron, ' + x.gesloten + ' gesloten, ' + x.gezien + ' gezien, ' +
      x.tussen + ' tussen, ' + x.terminaal + ' terminaal, ' + x.open + ' open');
  console.log('  matrix (bron -> ontvanger, gesloten relaties per collectie):');
  for (const [g, rij] of Object.entries(u.matrix))
    console.log('    ' + g.padEnd(10) + Object.entries(rij).map(([h, n]) => h + ' ' + n).join('  '));
  console.log('  niet gezien: ' + u.nietGezien.zonderRol + ' routes zonder groep, ' + u.nietGezien.nietGemeten + ' routes die in de proef geen werk deden' +
    (u.nietGezien.lezers ? '; ' + u.nietGezien.lezers : ''));
  if (u.openCollecties.length) {
    console.log('  open collecties (' + u.openCollecties.length + '), meeste bronroutes eerst:');
    for (const x of u.openCollecties.slice(0, 25)) console.log('    ' + x.collectie.padEnd(28) + x.bronroutes);
  }
  if (u.tussenOngemeten.length)
    console.log('  tegenroute bestaat maar de proef kon hem niet meten: ' + u.tussenOngemeten.join('; '));
  const v = u.verlopen;
  if (Object.values(v).some(x => x.length))
    console.log('  VERLOPEN redenen: ' + Object.entries(v).filter(([, x]) => x.length)
      .map(([k, x]) => k + ' ' + JSON.stringify(x)).join(', '));
}

module.exports = { meet, GROEPEN, INFRA, TERMINAAL, TUSSEN, ONTVANGER, groepVan, deedWerk, collectiesVan, DOEL };

if (require.main === module) {
  const argv = process.argv.slice(2);
  const controle = argv.includes('--controle');
  if (controle) {
    /* De naloop: geen meting, alleen de redenen tegen het register houden. */
    let j;
    try { j = JSON.parse(fs.readFileSync(DOEL, 'utf8')); }
    catch (e) { console.error('DOODSPOOR.json bestaat niet; draai eerst npm run doodspoor:vast'); process.exit(1); }
    const klachten = [];
    if (j.verlopen.terminaal.length) klachten.push('een terminaal-reden die niemand meer nodig heeft: ' + j.verlopen.terminaal.join(', '));
    if (j.verlopen.tussen.length) klachten.push('een tussen-reden die niemand meer nodig heeft: ' + j.verlopen.tussen.join(', '));
    if (j.verlopen.tegenroute.length) klachten.push('een tegenroute die niet bestaat: ' + j.verlopen.tegenroute.join(', '));
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
