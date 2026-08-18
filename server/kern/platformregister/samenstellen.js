/* Het platformregister (deelmodule): DE SAMENSTELLING.

   ../platformregister.js draagt de soorten, de bedieningslijst en de statusregel.
   Hier worden de vier bronnen tot EEN recordvorm gemaakt. Elk record:

     soort    functie | bediening | scherm | control
     id       stabiele sleutel binnen zijn soort
     naam     WAT HET IS
     doet     WAT HET DOET
     schakel  AAN OF UIT  -- { schakelbaar, stand, reden }
     status   STATUS      -- { staat, pct, ... } plus de getallen eronder
     waar     de routes of het pad, zodat het na te lopen is

   `schakelbaar: false` draagt ALTIJD een reden. Dat is dezelfde regel als bij de
   bewakerskaart: een ding dat niet te schakelen valt is geen ontbrekende
   schakelaar, en zonder reden leest het wel zo. */
'use strict';
const pr = require('../platformregister');
const { prefixLengte } = require('../../functies/toegang');

/* Welke functie hoort bij een pad: langste prefix wint, net als
   functies/toegang.js functieVoorPad(). Die functie zelf is hier niet te
   gebruiken -- hij kent alleen de catalogus en wij moeten OOK weten wat er
   buiten valt. Dezelfde regel, andere vraag. */
function padWijzer(paren) {
  /* DEZELFDE REGEL ALS DE SCHAKELKAST, uit dezelfde functie. Hier stond een
     eigen kopie met een derde tak (`pad.startsWith(p)`) zonder grens, en die
     was niet strenger of soepeler maar STUK: met '/' in de lijst viel elke route
     eronder, dus kwam er nooit iets als onbenoemd terug en kon de toets die daar
     op let niet zakken (LAT.md regel 4 en 9). De mutatieproef ving dat.

     Langste prefix wint, net als functieVoorPad(). Zouden die twee uiteenlopen,
     dan zegt dit register dat een route bij functie X hoort terwijl de
     schakelkast hem onder Y schakelt. */
  return (pad) => {
    let beste = null, besteLen = 0;
    for (const [p, w] of paren) {
      const len = prefixLengte(pad, p);
      if (len > besteLen) { besteLen = len; beste = w; }
    }
    return beste;
  };
}

/* De rijen van de bewijsmatrix, gegroepeerd op het ding waar ze bij horen. Een
   route hoort bij precies EEN ding; hoort hij nergens bij, dan komt hij terug
   als onbenoemd en dat is een bevinding (zie samenstel()). */
function verdeelRoutes(rijen, functies) {
  const paren = [];
  for (const f of functies) for (const p of (f.paden || [])) paren.push([String(p), { soort: 'functie', id: f.id }]);
  for (const [prefix, naam] of pr.BEDIENING) paren.push([prefix, { soort: 'bediening', id: prefix, naam }]);
  const wijs = padWijzer(paren);

  const perDing = new Map();
  const onbenoemd = [];
  for (const r of rijen) {
    const w = wijs(r.pad);
    if (!w) { onbenoemd.push(r.methode + ' ' + r.pad); continue; }
    const sleutel = w.soort + ':' + w.id;
    const bij = perDing.get(sleutel) || [];
    bij.push(r);
    perDing.set(sleutel, bij);
  }
  return { perDing, onbenoemd };
}

/* ---- WAT ONTBREEKT ER OM DIT DING TE KUNNEN BEWIJZEN ----

   "ONGEMETEN" IS EERLIJK EN ONBRUIKBAAR. Het noemt geen voorwaarde, dus er valt
   geen werk van te maken -- alleen een getal om je zorgen over te maken. Sinds
   scripts/waarom.js bestaat, zegt elke route in zijn EIGEN woorden wat eraan
   ontbreekt: een bestaand object, andere velden, een andere rol, een dienst die
   aan staat. Hier wordt dat opgeteld naar het niveau waarop een mens denkt.

   ALLEEN DE GROOTSTE GROEP, en met het aantal erbij. Een ding met veertig routes
   heeft zelden een enkele oorzaak; drie soorten naast elkaar leest als ruis, en
   een gemiddelde bestaat hier niet. Wie het precies wil weten, heeft het
   routedossier.

   ONTBREEKT WAAROM.json, dan staat er NIETS -- geen "onbekend" en geen lege
   streep. Een veld dat er altijd is maar soms niets betekent, wordt gelezen als
   een meting (LAT.md regel 3 en 12). */
function ontbrekendeVoorwaarde(rijen, waarom) {
  if (!waarom || !rijen.length) return null;
  const per = new Map();
  for (const r of rijen) {
    const w = waarom[r.methode + ' ' + r.pad];
    if (!w || !w.soort || w.soort === 'bereikt') continue;
    const bij = per.get(w.soort) || { soort: w.soort, aantal: 0, voorbeeld: null };
    bij.aantal++;
    if (!bij.voorbeeld) bij.voorbeeld = r.methode + ' ' + r.pad + ' -- ' + w.omdat;
    per.set(w.soort, bij);
  }
  if (!per.size) return null;
  return [...per.values()].sort((a, b) => b.aantal - a.aantal)[0];
}

/* ---- SOORT 1: DE FUNCTIES ---- */
function functieRecords(functies, perDing, standVan, waarom) {
  return functies.map(f => {
    const rijen = perDing.get('functie:' + f.id) || [];
    const stand = standVan ? standVan(f.id) : null;
    return {
      soort: 'functie',
      id: f.id,
      naam: f.naam,
      doet: f.uitleg || '',
      groep: f.categorie || '',
      schakel: { schakelbaar: true, stand, reden: null,
        standaard: f.standaard !== false, doelgroepen: f.doelgroepen || [] },
      status: pr.statusUitCellen(rijen),
      ontbreekt: ontbrekendeVoorwaarde(rijen, waarom),
      waar: (f.paden || []).slice()
    };
  });
}

/* ---- SOORT 2: DE BEDIENING ---- */
function bedieningRecords(perDing, waarom) {
  return pr.BEDIENING.map(([prefix, naam, doet, reden]) => ({
    soort: 'bediening',
    id: prefix,
    naam,
    doet,
    groep: 'Bediening',
    /* De reden staat hier en niet in een voetnoot: dit is het veld dat het
       verschil maakt tussen "vergeten te schakelen" en "hoort niet te kunnen". */
    schakel: { schakelbaar: false, stand: 'altijd aan', reden },
    status: pr.statusUitCellen(perDing.get('bediening:' + prefix) || []),
    ontbreekt: ontbrekendeVoorwaarde(perDing.get('bediening:' + prefix) || [], waarom),
    waar: [prefix]
  }));
}

/* ---- SOORT 3: DE SCHERMEN ----

   Een scherm heeft geen schakelaar (de functie waar hij bij hoort wel) en zijn
   status is een andere vraag dan die van een route: is hij door een toets
   GEOPEND. `alleen geveegd` staat er apart in, want een veegtoets die langs
   honderd pagina's loopt bewijst dat ze laden en niet dat ze werken. */
function schermRecords(schermen, gids, waarneming) {
  /* `waarneming` is wat scripts/schermen.js uit .schermjournaal haalt:
       afgelegd  scherm -> toetsen die er ECHT naartoe navigeerden
       neven     scherm -> toetsen die hem alleen ophaalden
       vegers    toetsen die langs een kwart van alle schermen lopen
     Ontbreekt het journaal, dan is `waarneming` null en is de status ONGEMETEN.
     Alle schermen dan op "nooit geopend" zetten zou een meting verzinnen uit een
     ontbrekend bestand (LAT.md regel 3) -- en juist dat gebeurde hier: 260 van de
     260 kwamen als nooit geopend terug omdat geopendeSchermen() zonder pad werd
     aangeroepen en netjes null gaf. */
  /* EEN RONDE DIE NIET HEEFT GEDRAAID IS GEEN RONDE MET EEN SLECHTE UITSLAG.
     De e2e-ronde van 2026-08-18 viel op alle 122 browsertoetsen om omdat de
     omgeving een andere chromium had dan playwright vroeg. Het journaal zag er
     daarna uit als dat van een geslaagde ronde waarin niemand een scherm opende,
     en dit register zou 262 schermen "nooit geopend" hebben genoemd -- een
     uitspraak over de schermen op grond van een storing in de meetopstelling.
     scripts/schermen.js rondeVerslag() kent het verschil; hier wordt het
     doorgegeven met de reden erbij. */
  const w = waarneming && waarneming.af === false ? null : waarneming;
  const onaf = waarneming && waarneming.af === false ? waarneming.reden : null;
  return schermen.map(pad => {
    const g = (gids && gids[pad]) || null;
    let staat;
    if (!w) staat = 'ongemeten';
    else {
      const toetsen = w.afgelegd.get(pad);
      const eigen = toetsen && [...toetsen].some(t => !w.vegers.has(t));
      staat = eigen ? 'beproefd'
        : toetsen ? 'alleen geveegd'
          : w.neven.has(pad) ? 'alleen opgehaald' : 'nooit geopend';
    }
    return {
      soort: 'scherm',
      id: pad,
      naam: pad.replace(/^\/apps\//, '').replace(/\.html$/, ''),
      doet: g ? g.wat : '',
      groep: pad.startsWith('/apps/foundation/') ? 'RTFoundation'
        : pad.startsWith('/apps/juridisch/') ? 'Juridisch' : 'Apps',
      schakel: { schakelbaar: false, stand: 'via zijn functie',
        reden: 'een pagina is geen schakelaar; wat hem aan- of uitzet is de functie erachter' },
      status: { staat, pct: null, routes: 0, cellen: 0, bewezen: 0, ongemeten: 0, gezakt: 0, reden: onaf },
      /* ZONDER GIDSTEKST IS EEN SCHERM ONBESCHREVEN, en dat hoort op te vallen:
         "wat doet dit" is een van de vier vragen die dit register beantwoordt. */
      onbeschreven: !g,
      waar: [pad]
    };
  });
}

/* ---- SOORT 4: DE CONTROLS ----

   Ze dragen hun eigen beschrijving al (het CONTROL-object bij elk instrument).
   Hun status is of hun register er LIGT: een control met een instrument maar
   zonder register heeft niets gemeten, hoe goed het instrument ook is. */
function controlRecords(controls, versheidVan) {
  return controls.map(c => {
    const reg = (c.dekking && c.dekking.register) || null;
    /* BESTAAN IS NIET GENOEG. Hier stond `registerBestaat(reg)`: ligt het bestand
       er, dan heette de control "levert bewijs". Maar een register van drie
       maanden geleden ligt er ook, en die zag er precies zo geruststellend uit --
       dat is de fout waar scripts/versheid.js voor is gemaakt. Een control met
       een verouderd register levert geen bewijs over DEZE code. */
    const v = reg ? versheidVan(reg) : null;
    const staat = !reg ? 'geen register'
      : !v ? 'register ontbreekt'
        : v.vers ? 'levert bewijs' : 'verouderd bewijs';
    return {
      soort: 'control',
      id: c.control,
      naam: c.control,
      doet: c.wat || '',
      groep: c.eigenaar || 'Techniek',
      schakel: { schakelbaar: false, stand: 'altijd aan',
        reden: 'een beheersmaatregel die je kunt uitzetten is geen beheersmaatregel' },
      status: { staat, pct: null, routes: 0, cellen: 0, bewezen: 0, ongemeten: 0, gezakt: 0,
        /* De reden waarom het bewijs verouderd is, hoort mee: "verouderd" zonder
           waarom leidt tot een tweede onderzoek. */
        reden: v ? v.reden : null },
      /* De GRENS is het eerlijkste veld van een control: wat hij NIET aantoont.
         Zonder dat leest elke control als een dekkende garantie. */
      grens: c.grens || '',
      bewijsstuk: c.bewijsstuk || '',
      waar: reg ? [reg] : []
    };
  });
}

module.exports = { padWijzer, verdeelRoutes, functieRecords, bedieningRecords, schermRecords, controlRecords,
  ontbrekendeVoorwaarde };
