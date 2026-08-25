/* ============================================================================
   DE POORT, MACHINEDEEL -- wat een computer aan een inzending kan zien.

   DE REGEL DIE DIT BESTAND STUURT: DEZE POORT KEURT NOOIT GOED.

   Hij kan afkeuren en hij kan doorlaten NAAR EEN MENS. Meer niet, en dat is een
   ontwerpbesluit en geen tekortkoming. Een machine ziet vorm; of een app doet
   wat hij belooft, of de uitgever is wie hij zegt, ziet hij niet. Datzelfde
   staat in CLAUDE.md over de bewijspoort: een ingediend stuk is geen bewijs, een
   mens van RTG tekent af, en nooit de partij die het stuk indiende.

   WAT HIJ WEL ZIET, EN WAAROM JUIST DIT.

   1. DE VORM VAN DE BUNDEL. Alleen bestandssoorten die een browser als inhoud
      kan lezen. Geen archieven, geen uitvoerbare bestanden, geen wasm.
   2. HET BUDGET. Een App Store die traag is, is geen veilige App Store maar een
      trage. Het budget is een POORT en geen meter achteraf: te zwaar komt er
      niet in.
   3. DE VERBODEN VORMEN. Een derde krijgt in de cel al geen netwerk (de CSP van
      de cel zet connect-src op 'none'), maar een aanroep die daar stilletjes
      faalt, is een app die het bij een lid niet doet en niemand die weet waarom.
      Daarom wordt hij hier afgekeurd MET het regelnummer, voordat hij bestaat.
   4. DE EXTERNE VERWIJZING. Alles wat een app nodig heeft, zit in zijn bundel.
      Een verwijzing naar buiten is een tweede plek waar de inhoud vandaan komt,
      en die kan na de keuring veranderen.
   5. DE VIRUSSCAN. Dezelfde scanner die de rest van het huis gebruikt
      (kern/antivirus). ONTBREEKT HIJ, DAN GAAT DE POORT DICHT -- niet open. Dat
      is dezelfde keuze als de persoonspoort in opzet/leverancierpoort.js: een
      controle die er niet is, is geen stilzwijgend "ja".

   EEN BEVINDING DRAAGT ALTIJD VIER DINGEN: waar (bestand + regel), wat, waarom
   het niet mag, en hoe het wel kan. Zonder dat laatste zendt een uitgever drie
   keer in om te leren wat hij in een keer had kunnen lezen -- en traag inzenden
   is precies wat dit kanaal niet moet zijn.
   ========================================================================== */
'use strict';

const { TOEGESTAAN, TEKSTSOORT, BUDGET, VERBODEN_JS, VERBODEN_HTML, VERBODEN_CSS, VERBODEN_SVG, EXTERN } = require('./verboden');
/* De adapter om de algemene virusscanner heen; hij verantwoordt bij naam wat er
   voor een webbundel wordt overgeslagen en waarom (./scan.js). */
const { scanBundel } = require('./scan');

const ext = (pad) => { const i = String(pad).lastIndexOf('.'); return i < 0 ? '' : String(pad).slice(i).toLowerCase(); };

/* Regelgewijs zoeken zodat een bevinding een regelnummer draagt. Een melding
   zonder regelnummer in een bundel van zestig bestanden is een zoekopdracht. */
function zoekRegels(inhoud, patronen, bestand, uit) {
  const regels = inhoud.split('\n');
  for (let i = 0; i < regels.length; i++) {
    for (const [vorm, wat, hoe] of patronen) {
      if (vorm.test(regels[i])) uit.push({ ernst: 'blokkeert', bestand, regel: i + 1, wat, hoe });
    }
  }
}

/* De machinale keuring van een bundel. `bestanden` is [{ pad, buf }]; de
   padvorm is al door ./bundel.js gecontroleerd voordat het hier komt.

   Geeft { door, bevindingen, maten }. `door` betekent: door naar een MENS. */
function keur({ bestanden, manifest, antivirus }) {
  const bevindingen = [];
  const blok = (wat, hoe, bestand) => bevindingen.push({ ernst: 'blokkeert', bestand: bestand || null, regel: null, wat, hoe });
  const let_op = (wat, hoe, bestand) => bevindingen.push({ ernst: 'let-op', bestand: bestand || null, regel: null, wat, hoe });

  if (!antivirus || typeof antivirus.scan !== 'function') {
    blok('de virusscanner draait niet mee',
      'Dit is geen fout van jouw inzending. De poort gaat dicht wanneer een controle ontbreekt; probeer het later opnieuw.');
    return { door: false, bevindingen, maten: null };
  }
  if (!bestanden.length) {
    blok('een lege bundel', 'Stuur ten minste je startbestand mee.');
    return { door: false, bevindingen, maten: null };
  }

  const maten = { bestanden: bestanden.length, totaal: 0, script: 0, stijl: 0 };
  const paden = new Set();

  for (const b of bestanden) {
    const e = ext(b.pad);
    maten.totaal += b.buf.length;
    if (e === '.js') maten.script += b.buf.length;
    if (e === '.css') maten.stijl += b.buf.length;
    if (paden.has(b.pad)) blok('het pad "' + b.pad + '" zit er twee keer in', 'Elk pad komt een keer voor.', b.pad);
    paden.add(b.pad);

    if (!TOEGESTAAN[e]) {
      blok('de bestandssoort "' + (e || 'zonder extensie') + '"',
        'Een cel toont inhoud. Toegestaan zijn: ' + Object.keys(TOEGESTAAN).join(' ') + '.', b.pad);
      continue;
    }
    if (b.buf.length > BUDGET.perBestand) {
      blok('een bestand van ' + Math.round(b.buf.length / 1024) + ' kB',
        'Per bestand geldt ' + Math.round(BUDGET.perBestand / 1024) + ' kB. Splits het, of comprimeer het beeld.', b.pad);
    }

    /* De virusscan draait over ELK bestand: een webshell in een .js of een
       uitvoerbaar bestand met een .png-naam wordt hier gepakt en niet door de
       vormregels hierboven. Voor de tekstsoorten gaat er een filter overheen;
       zie scanBundel() hieronder voor wat er wordt overgeslagen en waarom. */
    const av = scanBundel(antivirus, b.buf, b.pad, e);
    if (av.verdict === 'besmet') {
      blok('de virusscanner sloeg aan: ' + av.redenen.join('; '),
        'Deze inzending is geweigerd en gemeld. Controleer de machine waarop je bouwt.', b.pad);
    } else if (av.verdict === 'verdacht') {
      /* Niet blokkerend, wel zichtbaar voor de mens die aftekent: een woff2 of
         een strak gecomprimeerde png haalt van nature een hoge entropie. */
      let_op('de virusscanner noemt dit verdacht: ' + av.redenen.join('; '),
        'Een mens van RTG kijkt hiernaar voordat je app publiek wordt.', b.pad);
    }

    if (!TEKSTSOORT.has(e)) continue;
    const inhoud = b.buf.toString('utf8');
    if (e === '.js') zoekRegels(inhoud, VERBODEN_JS, b.pad, bevindingen);
    if (e === '.html') { zoekRegels(inhoud, VERBODEN_HTML, b.pad, bevindingen); zoekRegels(inhoud, VERBODEN_JS, b.pad, bevindingen); }
    if (e === '.css') zoekRegels(inhoud, VERBODEN_CSS, b.pad, bevindingen);
    if (e === '.svg') zoekRegels(inhoud, VERBODEN_SVG, b.pad, bevindingen);
    zoekRegels(inhoud, [[EXTERN, 'een verwijzing naar een andere server',
      'Alles wat je app nodig heeft, zit in je bundel. Wat van buiten komt, kan na de keuring veranderen zonder dat iemand het merkt.']], b.pad, bevindingen);
  }

  if (maten.bestanden > BUDGET.bestanden) blok('een bundel van ' + maten.bestanden + ' bestanden', 'Er passen er ' + BUDGET.bestanden + ' in. Voeg samen wat samen kan.');
  if (maten.totaal > BUDGET.totaal) blok('een bundel van ' + Math.round(maten.totaal / 1024) + ' kB', 'Het budget is ' + Math.round(BUDGET.totaal / 1024) + ' kB. Een App Store die traag is, is geen veilige App Store maar een trage.');
  if (maten.script > BUDGET.script) blok('' + Math.round(maten.script / 1024) + ' kB aan scriptcode', 'Het budget is ' + Math.round(BUDGET.script / 1024) + ' kB. Dit is wat de telefoon van het lid moet uitvoeren voordat er iets op het scherm staat.');
  if (maten.stijl > BUDGET.stijl) blok('' + Math.round(maten.stijl / 1024) + ' kB aan stijl', 'Het budget is ' + Math.round(BUDGET.stijl / 1024) + ' kB.');

  // het manifest wijst naar bestanden die er ook echt zijn
  if (!paden.has(manifest.start)) blok('een startbestand dat niet in de bundel zit ("' + manifest.start + '")', 'Zet het erbij, of wijs met "start" naar het bestand dat er wel is.');
  if (manifest.icoon && !paden.has(manifest.icoon)) blok('een icoon dat niet in de bundel zit ("' + manifest.icoon + '")', 'Zet het erbij, of laat "icoon" leeg.');

  const blokkeert = bevindingen.filter(b => b.ernst === 'blokkeert');
  return { door: blokkeert.length === 0, bevindingen, maten };
}

module.exports = { keur, BUDGET, TOEGESTAAN, TEKSTSOORT };
