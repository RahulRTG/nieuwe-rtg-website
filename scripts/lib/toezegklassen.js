/* ============================================================================
   DE TOEZEGKLASSEN -- wat heeft RTG toegezegd, wat is afgewezen, en wat wacht
   op een besluit of op de buitenwereld?

   WAAROM DIT ER IS. Het eigenaarsbesluit van 11 oktober 2026 (AFBOUWPROGRAMMA.md)
   zegt: alles wat RTG daadwerkelijk heeft TOEGEZEGD wordt afgebouwd en bewezen --
   niet alles wat ooit in een document is genoemd. Dat vraagt een lijst die zegt
   welk onderdeel in welke van vier klassen valt, en die lijst mag geen mening
   zijn. Zodra een mens hem met de hand bijhoudt, loopt hij binnen een maand uit
   de documenten weg, en dan bouwt iemand iets dat afgewezen was.

   DE VIER KLASSEN, gesloten:

     toegezegd            het huis heeft het beloofd; het wordt gebouwd en bewezen
     afgewezen-met-grens  het komt er NIET, en de grens die dat zegt staat erbij
     vraagt-besluit       geblokkeerd tot een besluit van de eigenaar aantoonbaar
                          genomen is
     extern               geblokkeerd tot een voorwaarde BUITEN de code vervuld is
                          (juridisch, vergunning, leverancier, netwerk, sleutel)

   TWEE BRONNEN, en ze zijn met opzet verschillend van aard:

   1. DE MARKERINGEN, deterministisch gelezen. De richtingsdocumenten dragen al
      per onderdeel een stand -- **staat**, **een stap weg**, **vraagt een
      besluit**, **jaren weg** -- in een tabel met een stand-kolom, als cel in
      een tabelrij, of achter een kop ("## 6. Het betaalmandaat -- **vraagt een
      besluit**"). Die worden gelezen; de stand bepaalt de klasse (staat, een
      stap weg en jaren weg zijn TOEGEZEGD, met de stand erbij als tweede as;
      vraagt een besluit is VRAAGT-BESLUIT). Een markering in lopende tekst wordt
      NIET gelezen: daar is niet af te lezen over WELK onderdeel hij gaat, en een
      onderdeel raden is precies de fout die dit bestand moet voorkomen. Hoeveel
      er zo blijven liggen, staat er als getal bij (`nietGeteld`).

   2. HET BESLUITBESTAND (TOEZEGKLASSEN.json), met de hand en klein. Afgewezen en
      extern zijn een OORDEEL en geen markering. Elk item draagt een citaat dat
      LETTERLIJK op een regel van zijn document moet staan. Staat het er niet
      meer, dan is het item ROT -- en het telt dan niet stil mee, het staat in
      `rot` en de toets (test/toezegklassen.test.js) zakt. Valt een item op
      dezelfde regel als een gelezen markering, dan wint het besluitbestand en
      zegt het item waarom.

   EEN REGEL ZONDER CITAAT BESTAAT NIET. Elk item draagt `document`, `regel` en
   `citaat`, en het citaat is de letterlijke tekst van die regel (of, voor het
   besluitbestand, het stuk dat erop staat).

   WAT DIT NIET IS. Geen tweede register naast APPWERKT.json: het blok wordt in
   APPWERKT.json geschreven (`node scripts/appwerkt.js --inventaris`). En geen
   tweede belofteregister: BELOFTE.json zegt of de BESTANDEN achter een belofte
   bestaan, dit zegt in welke KLASSE een onderdeel valt. Het beoordeelt ook niet
   of iets werkt -- dat doen de acht bewijzen.

   GEEN DATUM IN DE UITVOER: de vingerafdruk over de bronnen zegt of het blok
   bij deze documenten hoort, en dat is na te rekenen; een datum niet.
   ========================================================================== */
'use strict';
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
/* Soort, afwijzing in de rij en voorziening: de tweede en derde as (ronde 2). */
const as2 = require('./toezegsoort');
/* De afdrukken (BEWIJS.md, FUNCTIES.md, ...) hebben EEN lijst in dit huis, die van
   de kennisindex; hier wordt hij gebruikt en niet overgetypt. Een afdruk wordt
   uit een register geschreven, draagt geen eigen toezegging en hoort dus niet in
   de vingerafdruk: anders veroudert dit blok bij elke registerronde vanzelf. */
const { AFDRUKKEN, AFDRUKKOP } = require('../kennisindex');

const WORTEL = path.join(__dirname, '..', '..');
const BESLUITBESTAND = 'TOEZEGKLASSEN.json';

const KLASSEN = {
  toegezegd: 'het huis heeft het beloofd: het wordt gebouwd, geintegreerd en bewezen met de acht bewijzen uit BETROUWBAARHEID.md',
  'afgewezen-met-grens': 'het komt er niet; de grens die dat zegt staat erbij, en waar een functie botst met een grens vervalt de functie',
  'vraagt-besluit': 'geblokkeerd tot een besluit van de eigenaar aantoonbaar genomen is; tot dan wordt er niet omheen gebouwd',
  extern: 'geblokkeerd tot een voorwaarde buiten de code aantoonbaar vervuld is (juridisch, vergunning, certificering, leverancier, netwerk, sleutel)'
};

/* De stand zoals het document hem schrijft, en de klasse die eruit volgt. */
const STAND_NAAR_KLASSE = {
  staat: 'toegezegd',
  'een-stap-weg': 'toegezegd',
  'jaren-weg': 'toegezegd',
  'vraagt-besluit': 'vraagt-besluit'
};

/* Een celwaarde of een vetgedrukte kopstaart naar een stand, of null. Streng:
   een gemengde waarde ("staat (zaak) / ontbreekt (lid)"), een doorgestreepte of
   een met "niet" erin is geen stand -- die blijft liggen en wordt geteld. */
function normaliseerStand(ruw) {
  if (typeof ruw !== 'string') return null;
  if (ruw.includes('~~')) return null;
  let v = ruw.replace(/[*`]/g, '').toLowerCase().trim();
  if (!v) return null;
  if (/\s\/\s|\bniet\b|ontbreekt|\bhalf\b|\bdeels\b/.test(v)) return null;
  const kaal = v.replace(/\(.*?\)/g, '').replace(/[.,:;\u2014\u2013-]+\s*$/, '').trim();
  if (/^(staat|gebouwd)\b/.test(kaal)) return 'staat';
  if (/^(een )?stap( weg)?\b/.test(kaal)) return 'een-stap-weg';
  if (/^jaren( weg)?\b/.test(kaal)) return 'jaren-weg';
  if (/^(vraagt (een )?besluit|een besluit( nodig| vraagt)?|besluit( nodig)?)$/.test(kaal)) return 'vraagt-besluit';
  return null;
}

function celKaal(c) {
  return c.replace(/[*`]/g, '').replace(/\[([^\]]*)\]\([^)]*\)/g, '$1').replace(/\s+/g, ' ').trim().slice(0, 160);
}

function celSplits(regel) {
  return regel.split('|').slice(1, -1).map((s) => s.trim());
}

const MARKERING = /\*\*(staat|een stap weg|vraagt een besluit|een besluit vraagt|een besluit nodig|jaren weg)\*\*/i;

/* Lees een document: de items uit tabellen en koppen, en een telling van wat
   er bewust niet gelezen is. */
function leesDocument(naam, tekst) {
  const regels = tekst.split('\n');
  const items = [];
  let proza = 0, standOnbekend = 0, legenda = 0;
  let inCode = false, kop = null, standKol = -1, isLegenda = false, sectie = null;
  for (let i = 0; i < regels.length; i++) {
    const r = regels[i];
    if (/^\s*```/.test(r)) { inCode = !inCode; kop = null; continue; }
    if (inCode) continue;
    if (r.trimStart().startsWith('|')) {
      const cellen = celSplits(r.trim());
      if (!kop) {
        kop = cellen;
        standKol = cellen.findIndex((c) => /^(stand|status|staat)$/i.test(celKaal(c)));
        /* Een LEGENDA verklaart de standen zelf ("| **vraagt een besluit** | het
           kan, maar ..."): de tweede kolom is een betekenis en geen onderdeel. */
        isLegenda = cellen.some((c) => /^(betekenis|wat het betekent|betekent|wat dat betekent)$/i.test(celKaal(c)));
        continue;
      }
      if (cellen.length && cellen.every((c) => /^:?-{2,}:?$/.test(c) || c === '')) continue;
      let stand = null, standCel = -1;
      if (standKol >= 0 && cellen[standKol] !== undefined) {
        stand = normaliseerStand(cellen[standKol]);
        standCel = standKol;
        if (!stand && cellen[standKol].trim()) standOnbekend++;
      } else {
        /* Zonder stand-kolom telt alleen een cel die in zijn geheel een
           vetgedrukte markering is, en precies een. */
        const treffers = cellen.map((c, k) => (/^\*\*[^*]+\*\*$/.test(c) ? [k, normaliseerStand(c)] : null))
          .filter((x) => x && x[1]);
        if (treffers.length === 1) [standCel, stand] = treffers[0];
      }
      /* Een legenda zet de stand VOORAAN en verklaart hem in de kolom erna; een
         gewone tabel met een kolom "betekenis" (BENOEMING.md par. 2) zet hem
         achteraan en is een echte lijst onderdelen. */
      if (stand && isLegenda && standCel === 0) { legenda++; continue; }
      if (stand) {
        /* Een eerste kolom met alleen een nummer ("103", "U40", "B4") is geen
           onderdeel maar een kenmerk: dan draagt het onderdeel beide. */
        const overig = cellen.filter((c, k) => k !== standCel && celKaal(c)).map(celKaal);
        const isKenmerk = (c) => /^[#A-Z]{0,4}-?\d+[a-z]?\.?$/.test(c);
        const onderdeel = overig.length > 1 && isKenmerk(overig[0])
          ? (overig[0] + ' ' + overig[1]).slice(0, 160) : (overig[0] || '');
        if (onderdeel) {
          items.push(metAfwijzing({ document: naam, regel: i + 1, citaat: r.trim(), onderdeel, stand,
            klasse: STAND_NAAR_KLASSE[stand], herkomst: 'tabel', sectie }));
          continue;
        }
      }
      if (MARKERING.test(r)) proza++;
      continue;
    }
    kop = null; standKol = -1; isLegenda = false;
    const k = /^#{1,6}\s+(.*?)\s+[\u2014\u2013-]{1,2}\s+\*\*([^*]+)\*\*/.exec(r);
    if (/^#{1,6}\s/.test(r)) sectie = celKaal(r.replace(/^#{1,6}\s+/, ''));
    if (k) {
      const stand = normaliseerStand(k[2]);
      if (stand) {
        items.push(metAfwijzing({ document: naam, regel: i + 1, citaat: r.trim(),
          onderdeel: celKaal(k[1].replace(/^\d+[a-z]?(\.\d+)*\.?\s+/i, '')),
          stand, klasse: STAND_NAAR_KLASSE[stand], herkomst: 'kop', sectie }));
        continue;
      }
    }
    if (MARKERING.test(r)) proza++;
  }
  return { items, proza, standOnbekend, legenda };
}

/* Een toegezegde rij die in dezelfde cel zegt dat het onderdeel er NIET komt, is
   geen toezegging (scripts/lib/toezegsoort.js, punt 1). De zin met de afwijzing
   wordt de reden; de stand van het document blijft erbij staan. */
function metAfwijzing(it) {
  if (it.klasse !== 'toegezegd') return it;
  const m = as2.AFWIJZING.exec(it.citaat);
  if (!m) return it;
  const zin = it.citaat.split(/\s*\|\s*|(?<=[.;:])\s+/).find((z) => as2.AFWIJZING.test(z)) || m[0];
  return Object.assign(it, { klasse: 'afgewezen-met-grens', herkomst: it.herkomst + '+afwijzing',
    reden: 'de rij wijst het onderdeel zelf af: "' + zin.trim().slice(0, 200) + '"' });
}

/* De dichtstbijzijnde kop boven een regel (voor items uit het besluitbestand). */
function sectieBoven(tekst, regel) {
  const r = tekst.split('\n');
  for (let i = regel - 1; i >= 0; i--) if (/^#{1,6}\s/.test(r[i])) return celKaal(r[i].replace(/^#{1,6}\s+/, ''));
  return null;
}

function isAfdruk(naam, tekst) {
  return AFDRUKKEN.has(naam) || AFDRUKKOP.test(String(tekst).slice(0, 600));
}

function documentNamen(wortel) {
  return fs.readdirSync(wortel).filter((n) => n.endsWith('.md')).sort();
}


/* Een citaat letterlijk op een regel van een document terugvinden: regelnummer
   (1-gebaseerd) of 0 als het er niet (meer) staat. */
function vind(teksten, document, citaat) {
  const tekst = teksten[document];
  if (tekst === undefined) return { regel: 0, reden: 'het document bestaat niet' };
  const i = tekst.split('\n').findIndex((r) => r.includes(citaat));
  return i < 0 ? { regel: 0, reden: 'het citaat staat niet (meer) letterlijk in het document' } : { regel: i + 1 };
}

/* Het besluitbestand: valideren en elk citaat in zijn document terugvinden.

   BESLOTEN ELDERS (besluit B4, 11 oktober 2026). Een document kan een onderdeel
   als "vraagt een besluit" markeren terwijl dat besluit in een ANDER document of
   een latere paragraaf al genomen is. Zo'n item draagt `besloten`: het document
   en het letterlijke citaat waar het besluit staat, plus de datum. Ook dat
   citaat moet er letterlijk staan; is het weg, dan is het item rot -- een besluit
   zonder vindbare bron is een bewering. De klasse is wat het besluit OPLEVERT
   (toegezegd, of afgewezen-met-grens), want "besloten" is geen vijfde klasse
   maar een herkomst. */
function leesBesluiten(wortel, teksten) {
  const pad = path.join(wortel, BESLUITBESTAND);
  const bron = JSON.parse(fs.readFileSync(pad, 'utf8'));
  const fouten = [], rot = [], items = [];
  const gezien = new Set();
  for (const [n, b] of (bron.items || []).entries()) {
    const wie = '#' + n + ' ' + (b.document || '?') + ': ' + String(b.citaat || '').slice(0, 60);
    if (!Object.prototype.hasOwnProperty.call(KLASSEN, b.klasse)) { fouten.push(wie + ' -- klasse "' + b.klasse + '" valt buiten de vier'); continue; }
    if (typeof b.citaat !== 'string' || b.citaat.trim().length < 12) { fouten.push(wie + ' -- geen citaat (minstens twaalf tekens)'); continue; }
    if (!b.onderdeel) { fouten.push(wie + ' -- geen onderdeel'); continue; }
    if (b.klasse !== 'toegezegd' && !(b.reden && b.reden.length > 10)) { fouten.push(wie + ' -- een ' + b.klasse + ' zonder reden'); continue; }
    if ((b.klasse === 'vraagt-besluit' || b.klasse === 'extern') && !(b.voorwaarde && b.voorwaarde.length > 10)) {
      fouten.push(wie + ' -- geblokkeerd zonder voorwaarde: wat moet aantoonbaar vervuld zijn?'); continue;
    }
    if (b.soort !== undefined && !Object.prototype.hasOwnProperty.call(as2.SOORTEN, b.soort)) {
      fouten.push(wie + ' -- soort "' + b.soort + '" valt buiten de vier'); continue;
    }
    if (b.besloten !== undefined) {
      const bs = b.besloten;
      if (!bs || typeof bs.document !== 'string' || typeof bs.citaat !== 'string' || bs.citaat.trim().length < 12 || !/^\d{4}-\d{2}-\d{2}$/.test(bs.datum || '')) {
        fouten.push(wie + ' -- besloten zonder document, citaat (minstens twaalf tekens) of datum (JJJJ-MM-DD)'); continue;
      }
      if (b.klasse === 'vraagt-besluit') { fouten.push(wie + ' -- besloten en tegelijk vraagt-besluit: kies wat het besluit oplevert'); continue; }
      if (!(b.reden && b.reden.length > 10)) { fouten.push(wie + ' -- besloten zonder reden'); continue; }
    }
    const sleutel = b.document + '|' + b.citaat;
    if (gezien.has(sleutel)) { fouten.push(wie + ' -- dubbel'); continue; }
    gezien.add(sleutel);
    const plek = vind(teksten, b.document, b.citaat);
    if (!plek.regel) {
      rot.push({ document: b.document, citaat: b.citaat, klasse: b.klasse, onderdeel: b.onderdeel, reden: plek.reden });
      continue;
    }
    let besloten = null;
    if (b.besloten) {
      const bp = vind(teksten, b.besloten.document, b.besloten.citaat);
      if (!bp.regel) {
        rot.push({ document: b.besloten.document, citaat: b.besloten.citaat, klasse: b.klasse, onderdeel: b.onderdeel,
          reden: 'de BRON van het besluit: ' + bp.reden });
        continue;
      }
      /* Een markering is nooit haar eigen besluitbron: wie de gecorrigeerde rij
         zelf citeert ("besloten (...)"), heeft alleen de rij herschreven. */
      if (b.besloten.document === b.document && bp.regel === plek.regel) {
        fouten.push(wie + ' -- besloten met als bron de eigen regel van de markering: een besluit staat elders');
        continue;
      }
      besloten = { document: b.besloten.document, regel: bp.regel, citaat: b.besloten.citaat, datum: b.besloten.datum };
    }
    items.push({ document: b.document, regel: plek.regel, citaat: b.citaat, onderdeel: b.onderdeel,
      stand: null, klasse: b.klasse, herkomst: 'besluitbestand', reden: b.reden || null,
      voorwaarde: b.voorwaarde || null, eigenaar: b.eigenaar || null, besloten,
      soortHand: b.soort || null, sectie: sectieBoven(teksten[b.document], plek.regel) });
  }
  return { fouten, rot, items };
}

const nul = () => Object.fromEntries(Object.keys(KLASSEN).map((k) => [k, 0]));

function inventaris(wortel = WORTEL) {
  const namen = [], afdrukken = [];
  const teksten = {};
  const hash = crypto.createHash('sha256');
  for (const n of documentNamen(wortel)) {
    const tekst = fs.readFileSync(path.join(wortel, n), 'utf8');
    /* Een besluitcitaat mag ook naar een afdruk wijzen; daarom staat de tekst
       wel klaar, maar een afdruk wordt niet gelezen en niet gehasht. */
    teksten[n] = tekst;
    if (isAfdruk(n, tekst)) { afdrukken.push(n); continue; }
    namen.push(n);
    /* Een levend getal (<!--getal:..-->) telt niet mee in de vingerafdruk: dat
       is een uitkomst van een register (ook van dit blok zelf, via
       scripts/getallen.js), en meetellen maakte het blok na elke
       getallenronde vanzelf verouderd. */
    hash.update(n + '\0' + tekst.replace(/(<!--getal:[a-zA-Z0-9._-]+-->)[\s\S]*?<!--\/getal-->/g, '$1') + '\0');
  }
  hash.update(fs.readFileSync(path.join(wortel, BESLUITBESTAND), 'utf8'));
  let proza = 0, standOnbekend = 0, legenda = 0;
  const gelezen = [];
  for (const n of namen) {
    const d = leesDocument(n, teksten[n]);
    gelezen.push(...d.items); proza += d.proza; standOnbekend += d.standOnbekend; legenda += d.legenda;
  }
  const besluiten = leesBesluiten(wortel, teksten);
  /* Het besluitbestand wint op dezelfde regel: een mens heeft daar geoordeeld. */
  const opRegel = new Map(gelezen.map((it) => [it.document + ':' + it.regel, it]));
  const items = [...gelezen];
  for (const b of besluiten.items) {
    const g = opRegel.get(b.document + ':' + b.regel);
    if (g) Object.assign(g, { klasse: b.klasse, herkomst: 'tabel+besluitbestand', reden: b.reden,
      voorwaarde: b.voorwaarde, eigenaar: b.eigenaar, besloten: b.besloten, soortHand: b.soortHand,
      onderdeel: b.onderdeel || g.onderdeel });
    else items.push(b);
  }
  items.sort((a, b) => a.document.localeCompare(b.document) || a.regel - b.regel);

  /* De tweede en derde as. */
  const voorz = new Map();
  for (const it of items) {
    const s = it.soortHand ? { soort: it.soortHand, soortGrond: 'met de hand in ' + BESLUITBESTAND }
      : as2.soortVan(it.onderdeel, it.sectie);
    it.soort = s.soort; it.soortGrond = s.soortGrond;
    it.voorzieningen = as2.voorzieningenVan(it.citaat);
    delete it.soortHand; delete it.sectie;
    if (!it.besloten) delete it.besloten;
    for (const v of it.voorzieningen) {
      if (!voorz.has(v)) voorz.set(v, { voorziening: v, bestaat: as2.voorzieningBestaat(wortel, v), items: 0, perKlasse: nul() });
      const g = voorz.get(v); g.items++; g.perKlasse[it.klasse]++;
    }
  }

  const telling = nul();
  const perStand = {};
  const perDocument = {};
  const perSoort = Object.fromEntries([...Object.keys(as2.SOORTEN), 'onbepaald'].map((s) => [s, nul()]));
  for (const it of items) {
    telling[it.klasse]++;
    perSoort[it.soort][it.klasse]++;
    if (it.stand) perStand[it.stand] = (perStand[it.stand] || 0) + 1;
    perDocument[it.document] = perDocument[it.document] || nul();
    perDocument[it.document][it.klasse]++;
  }
  const som = (o) => Object.values(o).reduce((a, b) => a + b, 0);
  const soortTelling = Object.fromEntries(Object.keys(as2.SOORTEN).map((s) => [s, som(perSoort[s])]));
  const groepen = [...voorz.values()].sort((a, b) => b.items - a.items || a.voorziening.localeCompare(b.voorziening));
  const kort = (it) => ({ document: it.document, regel: it.regel, onderdeel: it.onderdeel, citaat: it.citaat,
    reden: it.reden || null, voorwaarde: it.voorwaarde || null, eigenaar: it.eigenaar || null });
  return {
    uitleg: 'De toezeggingen uit de documenten in de wortel, in vier gesloten klassen (AFBOUWPROGRAMMA.md). ' +
      'Markeringen in tabellen en koppen worden deterministisch gelezen; afgewezen en extern zijn een oordeel en staan in ' +
      BESLUITBESTAND + ', met een citaat dat letterlijk in de bron moet staan. Een rot citaat telt niet mee en laat de toets zakken. ' +
      'Daarnaast twee assen: SOORT (product, functie, integratie, eis, of onbepaald met reden) en VOORZIENING (de module of keten die de rij zelf noemt).',
    hoe: 'node scripts/appwerkt.js --inventaris  (--inventaris --controle zakt als het blok achterloopt, een citaat rot is of een klasse buiten de vier valt; ' +
      'npm run check regel 76 stelt dezelfde vraag)',
    grens: 'Deze inventaris zegt in welke KLASSE een onderdeel valt, niet of het werkt. "toegezegd" met stand "staat" is een bewering van het document; ' +
      'bewezen is het pas via de acht bewijzen (de regels in dit register) of een ketenproef. Markeringen in lopende tekst worden niet gelezen, ' +
      'omdat niet af te lezen is over welk onderdeel ze gaan: zie nietGeteld. De soort is lexicaal en dus een indeling met een regel, geen oordeel.',
    klassen: KLASSEN,
    standNaarKlasse: STAND_NAAR_KLASSE,
    soorten: as2.SOORTEN,
    bron: { documenten: namen.length, afdrukkenUitgesloten: afdrukken, besluitbestand: BESLUITBESTAND,
      vingerafdruk: hash.digest('hex').slice(0, 16) },
    telling,
    soortTelling,
    onbepaald: som(perSoort.onbepaald),
    perSoort,
    beslotenElders: items.filter((i) => i.besloten).length,
    afgewezenInRij: items.filter((i) => /\+afwijzing$/.test(i.herkomst)).length,
    perStand,
    nietGeteld: { prozaMarkeringen: proza, standOnbekend, legenda,
      uitleg: 'prozaMarkeringen: een vetgedrukte stand in lopende tekst of een tabelrij zonder onderdeel; standOnbekend: een cel in een stand-kolom die geen van de vier standen is (bv. "gedekt", "proven", "half", "besloten"); legenda: een rij in een tabel die de standen zelf verklaart. Geen van drie wordt geraden.' },
    voorzieningen: {
      uitleg: 'Per voorziening (module of keten die de rij zelf tussen backticks noemt) hoeveel onderdelen eraan hangen. Een rij kan meer dan een voorziening noemen; ' +
        'zonderVoorziening telt de rijen die er geen noemen -- die krijgen er geen geraden. bestaat: de voorziening is in server/ of scripts/ gevonden.',
      metVoorziening: items.filter((i) => i.voorzieningen.length).length,
      zonderVoorziening: items.filter((i) => !i.voorzieningen.length).length,
      aantal: groepen.length,
      groepen
    },
    perDocument,
    geblokkeerd: {
      'vraagt-besluit': items.filter((i) => i.klasse === 'vraagt-besluit').map(kort),
      extern: items.filter((i) => i.klasse === 'extern').map(kort)
    },
    afgewezen: items.filter((i) => i.klasse === 'afgewezen-met-grens').map(kort),
    besloten: items.filter((i) => i.besloten).map((i) => Object.assign(kort(i), { klasse: i.klasse, besloten: i.besloten })),
    rot: besluiten.rot,
    fouten: besluiten.fouten,
    items
  };
}

/* Het oordeel over het blok, zonder browser. Rot en fouten laten zakken; een
   blok dat achterloopt op de documenten ook, met de weg om het bij te werken.
   Woont hier en niet in appwerkt.js, zodat npm run check (regel 76) dezelfde
   vraag stelt zonder de browsermeter te laden. */
function oordeel(opgeslagen, vers) {
  const bezwaren = [];
  for (const r of vers.rot) bezwaren.push('ROT: ' + r.document + ' -- "' + r.citaat.slice(0, 70) + '" (' + r.reden + ')');
  for (const f of vers.fouten) bezwaren.push('FOUT: ' + f);
  for (const it of vers.items) {
    if (!Object.prototype.hasOwnProperty.call(KLASSEN, it.klasse)) bezwaren.push('KLASSE buiten de vier: ' + it.document + ':' + it.regel + ' ' + it.klasse);
    if (!it.citaat) bezwaren.push('ZONDER CITAAT: ' + it.document + ':' + it.regel);
    if (it.soort !== 'onbepaald' && !Object.prototype.hasOwnProperty.call(as2.SOORTEN, it.soort)) bezwaren.push('SOORT buiten de vier: ' + it.document + ':' + it.regel + ' ' + it.soort);
  }
  if (!opgeslagen) bezwaren.push('APPWERKT.json draagt geen blok toezegklassen -- draai node scripts/appwerkt.js --inventaris');
  else if (JSON.stringify(opgeslagen) !== JSON.stringify(vers)) {
    bezwaren.push('het blok toezegklassen loopt achter op de documenten (vingerafdruk ' +
      (opgeslagen.bron && opgeslagen.bron.vingerafdruk) + ' tegen ' + vers.bron.vingerafdruk + ') -- draai npm run appwerkt:inventaris');
  }
  return bezwaren;
}

module.exports = { KLASSEN, STAND_NAAR_KLASSE, BESLUITBESTAND, normaliseerStand, leesDocument, leesBesluiten, inventaris, oordeel, isAfdruk };
