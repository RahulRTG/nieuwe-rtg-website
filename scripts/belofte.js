#!/usr/bin/env node
/* ============================================================================
   HET BELOFTEREGISTER -- welke toezegging is waarmee gedekt, en wat is nog open?

   WAAROM DIT ER IS. Op de vraag "maak alles wat er nog niet is" heb ik twee keer
   het verkeerde antwoord gegeven. De eerste keer scande ik alleen de bovenste
   maplaag en meldde ik dat RTG Sheets, Slides en Forms ontbraken -- ze stonden
   in public/apps/office/. De tweede keer meldde ik CRM en BI als ontbrekend,
   terwijl CRM als server/bedrijf/klant.js bestaat (met gewogen pijplijn en een
   verplichte verliesreden) en de voorspellaag als server/kern/voorspel/.

   Twee keer fout op dezelfde vraag betekent niet dat ik beter moet zoeken. Het
   betekent dat er geen bron was om in te kijken. Dit huis heeft GRENZEN.json
   voor domeingrenzen, NORM.json voor meters, BEWIJS.md voor wat de toetsen
   beweren en ARCHITECTUUR.md voor de kaart -- maar niets dat zegt wat er is
   BELOOFD en waar dat dan staat. Vandaar dit register.

   WAT HET DOET, en het is bewust smal:

     - elke belofte draagt haar DEKKING: bestandspaden en/of API-paden;
     - dit script controleert of die dekking ER ECHT IS. Een bestand dat niet
       bestaat of een API-pad dat nergens wordt geregistreerd, maakt de belofte
       GEBROKEN -- en dat is de enige stand die alarmerend is. Een belofte die
       ooit waar was en stil is verdwenen, is erger dan een belofte die nog
       open staat, want niemand mist hem.
     - een belofte zonder dekking heet OPEN. Dat is geen fout maar werkvoorraad.

   WAT HET NIET DOET. Het beoordeelt geen kwaliteit. Dat een bestand bestaat,
   zegt niet dat de belofte goed is ingelost -- daar is BEWIJS.md voor, en de
   toetsen die daaronder liggen. Dit register beantwoordt precies één vraag:
   bestaat het, en waar.

   GEEN DATUM IN DE UITVOER, met opzet -- zie de kop van scripts/kaart.js.

   Draai: node scripts/belofte.js              (schrijft BELOFTE.md)
          node scripts/belofte.js --controle   (zakt als het register achterloopt)
   ========================================================================== */
'use strict';
const fs = require('fs');
const path = require('path');

const WORTEL = path.join(__dirname, '..');
const BRON = path.join(WORTEL, 'BELOFTE.json');
const DOEL = path.join(WORTEL, 'BELOFTE.md');

/* De broncode waarin een API-pad geregistreerd moet staan. We lezen server/ één
   keer in het geheugen; dat is sneller dan per pad grepen en het is dezelfde
   maat voor elke belofte. */
function serverBron() {
  const stukken = [];
  (function loop(dir) {
    for (const naam of fs.readdirSync(dir)) {
      const vol = path.join(dir, naam);
      const st = fs.statSync(vol);
      if (st.isDirectory()) { if (naam !== 'data' && naam !== 'node_modules') loop(vol); continue; }
      if (naam.endsWith('.js')) stukken.push(fs.readFileSync(vol, 'utf8'));
    }
  })(path.join(WORTEL, 'server'));
  return stukken.join('\n');
}

/* Eén bewijsstuk nakijken. Een pad dat met /api/ begint is een route en moet
   letterlijk in de serverbron staan; al het andere is een bestand of map. */
function bestaat(bewijs, bron) {
  if (bewijs.startsWith('/api/')) return bron.includes("'" + bewijs) || bron.includes('"' + bewijs) || bron.includes('`' + bewijs);
  return fs.existsSync(path.join(WORTEL, bewijs));
}

function meet() {
  const reg = JSON.parse(fs.readFileSync(BRON, 'utf8'));
  const bron = serverBron();
  const rijen = [];
  for (const b of reg.beloften) {
    const dekking = Array.isArray(b.dekking) ? b.dekking : [];
    const gevonden = dekking.filter(d => bestaat(d, bron));
    const kwijt = dekking.filter(d => !bestaat(d, bron));
    const stand = !dekking.length ? 'open' : (kwijt.length ? 'gebroken' : 'gedekt');
    rijen.push({ id: b.id, wat: b.wat, groep: b.groep || 'overig', stand,
      dekking: gevonden, kwijt, let: b.let || '' });
  }
  const tel = { gedekt: 0, open: 0, gebroken: 0 };
  for (const r of rijen) tel[r.stand]++;
  return { rijen, tel, uitleg: reg.uitleg };
}

function bouw() {
  const { rijen, tel, uitleg } = meet();
  const uit = [];
  uit.push('# Het belofteregister');
  uit.push('');
  uit.push(uitleg);
  uit.push('');
  uit.push('> Gegenereerd met `node scripts/belofte.js`. Bewerk **BELOFTE.json**, niet dit bestand.');
  uit.push('');
  uit.push('| stand | aantal | wat het betekent |');
  uit.push('| --- | --- | --- |');
  uit.push('| gedekt | ' + tel.gedekt + ' | elk bewijsstuk bestaat |');
  uit.push('| open | ' + tel.open + ' | nog geen dekking opgeschreven: werkvoorraad |');
  uit.push('| gebroken | ' + tel.gebroken + ' | er wordt naar iets verwezen dat er niet (meer) is |');
  uit.push('');

  if (tel.gebroken) {
    uit.push('## Gebroken beloften');
    uit.push('');
    uit.push('Dit is de enige alarmerende stand: er stond dekking opgeschreven en die is weg.');
    uit.push('Een belofte die ooit waar was en stil verdween, mist niemand -- daarom staat hij hier bovenaan.');
    uit.push('');
    for (const r of rijen.filter(x => x.stand === 'gebroken')) {
      uit.push('- **' + r.wat + '** (`' + r.id + '`) -- kwijt: ' + r.kwijt.map(k => '`' + k + '`').join(', '));
    }
    uit.push('');
  }

  const groepen = [...new Set(rijen.map(r => r.groep))];
  for (const g of groepen) {
    uit.push('## ' + g);
    uit.push('');
    uit.push('| belofte | stand | waar het staat |');
    uit.push('| --- | --- | --- |');
    for (const r of rijen.filter(x => x.groep === g)) {
      const waar = r.stand === 'open' ? '_nog niet gebouwd_'
        : r.dekking.map(d => '`' + d + '`').join('<br>');
      uit.push('| ' + r.wat + (r.let ? '<br><sub>' + r.let + '</sub>' : '') + ' | ' + r.stand + ' | ' + waar + ' |');
    }
    uit.push('');
  }
  return uit.join('\n') + '\n';
}

module.exports = { meet, bouw, DOEL };

if (require.main === module) {
  const inhoud = bouw();
  if (process.argv.includes('--controle')) {
    const opSchijf = fs.existsSync(DOEL) ? fs.readFileSync(DOEL, 'utf8') : null;
    if (opSchijf !== inhoud) {
      console.error('BELOFTE.md loopt achter op BELOFTE.json -- draai: node scripts/belofte.js');
      process.exit(1);
    }
    const { tel } = meet();
    if (tel.gebroken) {
      console.error(tel.gebroken + ' gebroken belofte(n): er wordt naar iets verwezen dat er niet meer is.');
      process.exit(1);
    }
    console.log('het belofteregister klopt (' + tel.gedekt + ' gedekt, ' + tel.open + ' open)');
  } else {
    fs.writeFileSync(DOEL, inhoud);
    const { tel } = meet();
    console.log('BELOFTE.md geschreven (' + tel.gedekt + ' gedekt, ' + tel.open + ' open, ' + tel.gebroken + ' gebroken).');
  }
}
