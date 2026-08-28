#!/usr/bin/env node
/* ============================================================================
   DE WERELDLIJST -- wat er precies in elke wereld hangt.

   HET OPEN PUNT DAT HIERMEE DICHTGAAT. WERELDEN.md beschrijft vier werelden in
   proza ("alles wat van mij is en wat ik op een gewone dag doe: geld, sociaal,
   het huis en het huishouden...") en zei er zelf bij: *"een eerste indeling op
   wat er in de code staat, geen uitputtende lijst."* Zo'n zin is eerlijk maar
   onbruikbaar -- je kunt er geen vraag mee beantwoorden die begint met "zit X
   in LivingOS of in WorkOS?", en je kunt er ook niet mee zien dat er iets is
   weggevallen.

   WAAROM GEGENEREERD EN NIET GESCHREVEN. Zeventig regels met de hand bijhouden
   gaat één keer goed. Dit bestand komt uit `MAPPEN` in de app-main-bundel -- de
   enige lijst werelden (WERELD.md) -- via dezelfde lezer die
   test/wereldregister.test.js gebruikt (scripts/lib/wereldregister.js), zodat er
   geen tweede waarheid ontstaat (LAT.md regel 4).

   WAT DIT WEL EN NIET IS. Dit is de precieze lijst ONDERDELEN per wereld. Het is
   niet de indeling in DOMEINEN: welke onderdelen samen "het huishouden" heten of
   "zorg en gezin" is een ontwerpbesluit en staat nergens in de code. Die namen
   verzinnen en ze hier uitschrijven zou een lijst opleveren die stelliger is dan
   wat het huis werkelijk weet. Wat hier staat is na te rekenen; de laag erboven
   hoort een mens te kiezen.

   GEEN DATUM IN DE UITVOER, met opzet -- een tijdstempel zou de controle elke
   dag laten zakken, en dan wordt de regel binnen een week uitgezet. Wanneer dit
   voor het laatst is bijgewerkt staat in de git-historie.

   Draai: node scripts/wereldlijst.js             (schrijft WERELDLIJST.md)
          node scripts/wereldlijst.js --controle  (zakt als hij achterloopt)
          node scripts/wereldlijst.js --uit       (naar stdout, schrijft niets)
   ========================================================================== */
'use strict';
const fs = require('fs');
const path = require('path');
const reg = require('./lib/wereldregister');

const DOEL = path.join(reg.WORTEL, 'WERELDLIJST.md');

/* HET LANGE STREEPJE UIT EEN CODEPUNT. Regel 3 van scripts/check.js verbiedt em-,
   en- en figure-streepjes in de BRON (huisstijl), en dat is terecht: in code zijn
   ze niet van elkaar te onderscheiden. De UITVOER is een document en leest wel
   met een lang streepje, net als WERELDEN.md. check.js lost dat voor zichzelf op
   dezelfde manier op -- zijn eigen regex is uit codepunten opgebouwd. */
const STREEP = String.fromCharCode(0x2014);

/* De volgorde van MAPPEN blijft staan: dat is de volgorde waarin een lid ze in
   de bank ziet, en die opnieuw sorteren maakt dit document moeilijker te
   vergelijken met het scherm. */
function bouw() {
  const r = [];
  r.push('# De wereldlijst ' + STREEP + ' wat er precies in elke wereld hangt');
  r.push('');
  r.push('**Dit bestand is gegenereerd. Bewerk het niet met de hand.**');
  r.push('Draai `npm run wereldlijst`; `scripts/check.js` zakt als het achterloopt.');
  r.push('');
  r.push('De bron is `MAPPEN` in de app-main-bundel ' + STREEP + ' de enige lijst werelden');
  r.push('(`WERELD.md`). `WERELDEN.md` beschrijft *waarom* de werelden zo lopen;');
  r.push('dit zegt *wat* erin zit.');
  r.push('');
  r.push('Drie soorten onderdeel, en ze gedragen zich verschillend:');
  r.push('');
  r.push('| soort | wat het is |');
  r.push('|---|---|');
  r.push('| `link` | een scherm met een eigen adres |');
  r.push('| `tab` | een stand binnen de ledenapp, geen eigen pagina |');
  r.push('| `os` | een kiezer: hij opent eerst een keuze en daarna pas een scherm |');
  r.push('');

  let totaal = 0;
  const stuk = [];
  for (const w of reg.WERELDEN) {
    totaal += w.items.length;
    const rijen = w.items.map((item) => {
      const l = reg.los(item);
      return { item, ...l };
    });
    const kapot = rijen.filter((x) => !x.bestaat);
    stuk.push({ w, rijen, kapot });
  }

  r.push('| wereld | huis | onderdelen |');
  r.push('|---|---|---|');
  for (const s of stuk) r.push('| **' + s.w.naam + '** | `' + s.w.wereld + '` | ' + s.w.items.length + ' |');
  r.push('| | **samen** | **' + totaal + '** |');
  r.push('');

  for (const s of stuk) {
    r.push('## ' + s.w.naam);
    r.push('');
    r.push('Huis: `' + s.w.wereld + '` ' + STREEP + ' ' + s.w.items.length + ' onderdelen.');
    r.push('');
    r.push('| onderdeel | soort | komt uit op |');
    r.push('|---|---|---|');
    for (const x of s.rijen) {
      const naam = x.naam || '**lost niet op**';
      const waar = x.url ? (x.url.startsWith('/') ? '`' + x.url + '`' : x.url) : '**nergens**';
      r.push('| ' + naam + ' | `' + x.item + '` | ' + waar + ' |');
    }
    r.push('');
    if (s.kapot.length) {
      r.push('> **Deze onderdelen lossen niet op** en tekenen zich op het scherm stil weg: ' +
        s.kapot.map((x) => '`' + x.item + '`').join(', ') + '. Zie `test/wereldregister.test.js`.');
      r.push('');
    }
  }

  /* WAT ER NIET IN EEN WERELD HANGT MAAR WEL BESTAAT. Zonder deze lijst leest
     het document als "dit is alles", en dat is het niet.

     DEZE SECTIE KEEK ALLEEN NAAR TABS, en dat verborg drie onderdelen. Berichten
     (`link:berichten`), Bellen (`os:bellen`) en Videobellen (`os:videobellen`)
     stonden in de registry maar in geen enkele map, en werden hier nooit
     gemeld -- de meting kon het gat dat zij vormden per definitie niet zien.
     Nu lopen alle drie de soorten langs dezelfde vraag: noemt een MAP je?

     EEN MAP EN NIET EEN WERELD, met opzet. `map-instellingen` draagt geen
     `wereld` (RTG Core, het bedieningspaneel in de voet) maar geeft zijn vier
     items wel een vaste plek. Wie alleen op werelden telt, meldt die vier als
     dakloos terwijl ze dat niet zijn -- en dan gaat deze regel binnen een week
     uit. */
  const inMap = new Set();
  for (const m of reg.MAPPEN) for (const it of (m.items || [])) inMap.add(it);
  /* CORE IS EEN BESLUIT EN GEEN RESTPOST. Deze twee horen nergens onder te
     hangen en dat staat hieronder uitgeschreven; al het andere dat hier belandt
     is een gat en hoort ook zo te lezen. De lijst staat hier en niet in de
     bundel: het is een uitspraak van dit document over de code, en de code hoeft
     niet te weten dat er een lijst over hem bestaat. */
  const CORE = { 'tab:home': 'het beginscherm van de ledenapp zelf', 'tab:ai': 'Rahul, die met de mens meereist' };
  const daklozen = [];
  for (const k of Object.keys(reg.LINKS)) if (!inMap.has('link:' + k)) daklozen.push('link:' + k);
  for (const k of Object.keys(reg.OSAPPS)) if (!inMap.has('os:' + k)) daklozen.push('os:' + k);
  for (const k of Object.keys(reg.TABS)) if (!inMap.has('tab:' + k)) daklozen.push('tab:' + k);
  const kern = daklozen.filter((i) => CORE[i]);
  const gat = daklozen.filter((i) => !CORE[i]);
  const toon = (i) => {
    const l = reg.los(i);
    return '`' + i + '`' + (l && l.naam ? ' (' + l.naam + ')' : '');
  };
  r.push('## Wat er buiten de werelden valt');
  r.push('');
  if (kern.length) {
    r.push('Deze onderdelen hangen met opzet in geen enkele wereld:');
    r.push('');
    for (const i of kern) r.push('- ' + toon(i) + ' ' + STREEP + ' ' + CORE[i] + '.');
    r.push('');
    r.push('Dat is RTG Core: een laag die overal geldt is geen tegel op een');
    r.push('beginscherm (`WERELDEN.md`, *RTG Core*). Maar het hoort wel zichtbaar te');
    r.push('staan, want het verschil tussen "met opzet overal" en "per ongeluk');
    r.push('nergens" is van buiten niet te zien.');
    r.push('');
  }
  if (gat.length) {
    r.push('**Deze onderdelen hebben geen plek en dat is een gat.** Ze bestaan in de');
    r.push('registry, maar geen enkele map noemt ze ' + STREEP + ' een lid vindt ze alleen als');
    r.push('hij het pad al kent:');
    r.push('');
    for (const i of gat) r.push('- ' + toon(i));
    r.push('');
    r.push('Geef ze een map, of haal ze weg. Een derde uitkomst is er niet.');
  } else {
    r.push('Er is geen onderdeel zonder plek: alles wat de registry kent, wordt door');
    r.push('een map genoemd.');
  }
  r.push('');
  return r.join('\n') + '\n';
}

/* Als module: scripts/check.js roept bouw() aan en vergelijkt zelf, precies
   zoals bij de kaart (regel 40). Zo staat de vergelijking op een plek. */
module.exports = { DOEL, bouw };

if (require.main === module) {
  const tekst = bouw();
  if (process.argv.includes('--uit')) { process.stdout.write(tekst); process.exit(0); }
  if (process.argv.includes('--controle')) {
    let opSchijf = '';
    try { opSchijf = fs.readFileSync(DOEL, 'utf8'); } catch (e) {}
    if (opSchijf !== tekst) {
      console.error('WERELDLIJST.md loopt achter op de code -- draai: npm run wereldlijst');
      process.exit(1);
    }
    console.log('WERELDLIJST.md is bij.');
    process.exit(0);
  }
  fs.writeFileSync(DOEL, tekst);
  console.log('WERELDLIJST.md geschreven (' + tekst.split('\n').length + ' regels).');
}
