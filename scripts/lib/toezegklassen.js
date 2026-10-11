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
  let proza = 0, standOnbekend = 0;
  let inCode = false, kop = null, standKol = -1;
  for (let i = 0; i < regels.length; i++) {
    const r = regels[i];
    if (/^\s*```/.test(r)) { inCode = !inCode; kop = null; continue; }
    if (inCode) continue;
    if (r.trimStart().startsWith('|')) {
      const cellen = celSplits(r.trim());
      if (!kop) {
        kop = cellen;
        standKol = cellen.findIndex((c) => /^(stand|status|staat)$/i.test(celKaal(c)));
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
      if (stand) {
        /* Een eerste kolom met alleen een nummer ("103", "U40", "B4") is geen
           onderdeel maar een kenmerk: dan draagt het onderdeel beide. */
        const overig = cellen.filter((c, k) => k !== standCel && celKaal(c)).map(celKaal);
        const isKenmerk = (c) => /^[#A-Z]{0,4}-?\d+[a-z]?\.?$/.test(c);
        const onderdeel = overig.length > 1 && isKenmerk(overig[0])
          ? (overig[0] + ' ' + overig[1]).slice(0, 160) : (overig[0] || '');
        if (onderdeel) {
          items.push({ document: naam, regel: i + 1, citaat: r.trim(), onderdeel, stand,
            klasse: STAND_NAAR_KLASSE[stand], herkomst: 'tabel' });
          continue;
        }
      }
      if (MARKERING.test(r)) proza++;
      continue;
    }
    kop = null; standKol = -1;
    const k = /^#{1,6}\s+(.*?)\s+[\u2014\u2013-]{1,2}\s+\*\*([^*]+)\*\*/.exec(r);
    if (k) {
      const stand = normaliseerStand(k[2]);
      if (stand) {
        items.push({ document: naam, regel: i + 1, citaat: r.trim(),
          onderdeel: celKaal(k[1].replace(/^\d+[a-z]?(\.\d+)*\.?\s+/i, '')),
          stand, klasse: STAND_NAAR_KLASSE[stand], herkomst: 'kop' });
        continue;
      }
    }
    if (MARKERING.test(r)) proza++;
  }
  return { items, proza, standOnbekend };
}

function documentNamen(wortel) {
  return fs.readdirSync(wortel).filter((n) => n.endsWith('.md')).sort();
}

/* Het besluitbestand: valideren en elk citaat in zijn document terugvinden. */
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
    const sleutel = b.document + '|' + b.citaat;
    if (gezien.has(sleutel)) { fouten.push(wie + ' -- dubbel'); continue; }
    gezien.add(sleutel);
    const tekst = teksten[b.document];
    const regel = tekst === undefined ? -1 : tekst.split('\n').findIndex((r) => r.includes(b.citaat));
    if (regel < 0) {
      rot.push({ document: b.document, citaat: b.citaat, klasse: b.klasse, onderdeel: b.onderdeel,
        reden: tekst === undefined ? 'het document bestaat niet' : 'het citaat staat niet (meer) letterlijk in het document' });
      continue;
    }
    items.push({ document: b.document, regel: regel + 1, citaat: b.citaat, onderdeel: b.onderdeel,
      stand: null, klasse: b.klasse, herkomst: 'besluitbestand', reden: b.reden || null,
      voorwaarde: b.voorwaarde || null, eigenaar: b.eigenaar || null });
  }
  return { fouten, rot, items };
}

function inventaris(wortel = WORTEL) {
  const namen = documentNamen(wortel);
  const teksten = {};
  const hash = crypto.createHash('sha256');
  for (const n of namen) {
    teksten[n] = fs.readFileSync(path.join(wortel, n), 'utf8');
    /* Een levend getal (<!--getal:..-->) telt niet mee in de vingerafdruk: dat
       is een uitkomst van een register (ook van dit blok zelf, via
       scripts/getallen.js), en meetellen maakte het blok na elke
       getallenronde vanzelf verouderd. */
    hash.update(n + '\0' + teksten[n].replace(/(<!--getal:[a-zA-Z0-9._-]+-->)[\s\S]*?<!--\/getal-->/g, '$1') + '\0');
  }
  hash.update(fs.readFileSync(path.join(wortel, BESLUITBESTAND), 'utf8'));
  let proza = 0, standOnbekend = 0;
  const gelezen = [];
  for (const n of namen) {
    const d = leesDocument(n, teksten[n]);
    gelezen.push(...d.items); proza += d.proza; standOnbekend += d.standOnbekend;
  }
  const besluiten = leesBesluiten(wortel, teksten);
  /* Het besluitbestand wint op dezelfde regel: een mens heeft daar geoordeeld. */
  const opRegel = new Map(gelezen.map((it) => [it.document + ':' + it.regel, it]));
  const items = [...gelezen];
  for (const b of besluiten.items) {
    const g = opRegel.get(b.document + ':' + b.regel);
    if (g) Object.assign(g, { klasse: b.klasse, herkomst: 'tabel+besluitbestand', reden: b.reden,
      voorwaarde: b.voorwaarde, eigenaar: b.eigenaar, onderdeel: b.onderdeel || g.onderdeel });
    else items.push(b);
  }
  items.sort((a, b) => a.document.localeCompare(b.document) || a.regel - b.regel);

  const telling = Object.fromEntries(Object.keys(KLASSEN).map((k) => [k, 0]));
  const perStand = {};
  const perDocument = {};
  for (const it of items) {
    telling[it.klasse]++;
    if (it.stand) perStand[it.stand] = (perStand[it.stand] || 0) + 1;
    perDocument[it.document] = perDocument[it.document] || Object.fromEntries(Object.keys(KLASSEN).map((k) => [k, 0]));
    perDocument[it.document][it.klasse]++;
  }
  const kort = (it) => ({ document: it.document, regel: it.regel, onderdeel: it.onderdeel, citaat: it.citaat,
    reden: it.reden || null, voorwaarde: it.voorwaarde || null, eigenaar: it.eigenaar || null });
  return {
    uitleg: 'De toezeggingen uit de documenten in de wortel, in vier gesloten klassen (AFBOUWPROGRAMMA.md). ' +
      'Markeringen in tabellen en koppen worden deterministisch gelezen; afgewezen en extern zijn een oordeel en staan in ' +
      BESLUITBESTAND + ', met een citaat dat letterlijk in de bron moet staan. Een rot citaat telt niet mee en laat de toets zakken.',
    hoe: 'node scripts/appwerkt.js --inventaris  (--inventaris --controle zakt als het blok achterloopt, een citaat rot is of een klasse buiten de vier valt)',
    grens: 'Deze inventaris zegt in welke KLASSE een onderdeel valt, niet of het werkt. "toegezegd" met stand "staat" is een bewering van het document; ' +
      'bewezen is het pas via de acht bewijzen (de regels in dit register) of een ketenproef. Markeringen in lopende tekst worden niet gelezen, ' +
      'omdat niet af te lezen is over welk onderdeel ze gaan: zie nietGeteld.',
    klassen: KLASSEN,
    standNaarKlasse: STAND_NAAR_KLASSE,
    bron: { documenten: namen.length, besluitbestand: BESLUITBESTAND, vingerafdruk: hash.digest('hex').slice(0, 16) },
    telling,
    perStand,
    nietGeteld: { prozaMarkeringen: proza, standOnbekend,
      uitleg: 'prozaMarkeringen: een vetgedrukte stand in lopende tekst of een tabelrij zonder onderdeel; standOnbekend: een cel in een stand-kolom die geen van de vier standen is (bv. "gedekt", "proven", "half"). Beide worden niet geraden.' },
    perDocument,
    geblokkeerd: {
      'vraagt-besluit': items.filter((i) => i.klasse === 'vraagt-besluit').map(kort),
      extern: items.filter((i) => i.klasse === 'extern').map(kort)
    },
    afgewezen: items.filter((i) => i.klasse === 'afgewezen-met-grens').map(kort),
    rot: besluiten.rot,
    fouten: besluiten.fouten,
    items
  };
}

module.exports = { KLASSEN, STAND_NAAR_KLASSE, BESLUITBESTAND, normaliseerStand, leesDocument, leesBesluiten, inventaris };
