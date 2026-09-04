#!/usr/bin/env node
/* ============================================================================
   HOEVEEL SCHERMTOETSEN WACHTEN OP MEER DAN HUN BEWERING NODIG HEEFT?

   WAAROM DIT SCRIPT ER IS, EN WAT ER MIS WAS. TAKEN.md 4.67 zei dat de
   omzetting van `waitUntil: 'load'` af was "op twee gemeten uitzonderingen na".
   Nageteld op 3 september 2026 stonden er 42 navigaties met `load` in 23
   bestanden. Er was geen meter, dus het getal in de tekst kon jaren blijven
   staan terwijl de code de andere kant op liep -- dezelfde vorm als 4.71 en
   4.72 (LAT.md regel 6: een belofte in tekst zonder handhaver), nu in de
   toetsen zelf.

   WAAROM `load` HIER EEN PROBLEEM IS. page.goto met `waitUntil: 'load'` wacht
   op ELK subverzoek van de pagina -- elk plaatje, elk lettertype, elk script
   dat zichzelf bijlaadt -- terwijl de regel eronder meestal al op het echte
   teken wacht (een kiezer, een selector). Op een rustige machine valt dat niet
   op; onder belasting valt het om. Op 19 augustus 2026 zakte werktafel.e2e.js
   in een volle ronde op "Timeout 45000ms exceeded ... waiting until load",
   terwijl er niets stuk was.

   EN `load` IS NIET ALTIJD FOUT, en dat is precies waarom dit een meter is en
   geen verbod. Er zijn schermen waar de bank van de werktafel achteraan een
   keten hangt die zichzelf bijlaadt; daar is `domcontentloaded` plus een
   ruimere wacht ernaast een GROTER venster om een race mee toe te dekken. Zo'n
   navigatie mag blijven staan -- maar dan met de meting erbij in het bestand,
   zodat de volgende lezer niet hoeft te raden of het een besluit was of een
   restpost.

   WAT DEZE METER TELT
     metReden     een `load`-navigatie met een uitleg vlak erboven die het
                  woord `load` noemt. Een besluit.
     zonderReden  een `load`-navigatie zonder die uitleg. DIT is het getal dat
                  alleen omlaag mag.

   DE REDEN WORDT GECITEERD EN NIET GERADEN. Een uitleg telt alleen als er een
   commentaarblok binnen tien regels boven de navigatie staat DAT HET WOORD
   `load` NOEMT en minstens 80 tekens lang is. Zou "er staat ergens commentaar
   in dit bestand" volstaan, dan verklaart de kop van het bestand alle
   navigaties eronder en staat de meter morgen op nul zonder dat er iets is
   gebeurd -- de gevaarlijkste uitslag die er is.

   Draai: npm run wachtwijze   (--vastleggen legt een lagere stand vast)
   ========================================================================== */
'use strict';
const fs = require('fs');
const path = require('path');

const WORTEL = path.join(__dirname, '..');
const TEST = path.join(WORTEL, 'test');
const REGISTER = path.join(WORTEL, 'WACHTWIJZE.json');

/* Hoe ver een uitleg boven een navigatie mag staan. Veertig regels is ruim,
   want de reden loopt hier gerust twintig regels -- en er mag niets ANDERS
   tussen staan (zie hieronder), dus ruimte alleen kan geen vreemde uitleg
   binnenhalen. Tachtig tekens omdat "// load" geen reden is. */
const REGELS_TERUG = 40;
const REDEN_MINSTENS = 80;

const NAVIGATIE = /waitUntil:\s*'load'/;

function e2eBestanden() {
  return fs.readdirSync(TEST).filter(n => n.endsWith('.e2e.js')).sort();
}

/* Draagt deze navigatie een uitleg? Alleen het commentaar dat er DIRECT boven
   staat telt: vanaf de navigatie omhoog lopen zolang de regels commentaar of
   leeg zijn, en stoppen bij de eerste regel code.

   DE EERSTE VERSIE KEEK NAAR EEN VENSTER VAN TIEN REGELS en zocht daarin naar
   een COMPLEET commentaarblok. Die miste test/vooruitscherm.e2e.js -- een uitleg
   van vijftien regels met de meting erin ("van drie rondes waren er twee groen")
   viel buiten het venster, en van wat er wel in stond ontbrak de opening, dus
   telde hij als onverklaard. Een meter die de best gedocumenteerde uitzondering
   van het hele huis niet ziet, meet niet wat hij beweert.

   Twee dingen die daarom vastliggen: het venster is ruim (er kan niets vreemds
   binnenlopen, want de eerste regel code sluit het af), en de uitleg moet het
   woord `load` NOEMEN. Zonder die tweede eis verklaart elke toelichting over
   iets anders de navigatie eronder mee, en staat deze meter morgen op nul
   zonder dat er iets is gebeurd -- de gevaarlijkste uitslag die er is. */
function redenBoven(regels, i) {
  const uit = [];
  let inBlok = false;
  for (let j = i - 1; j >= 0 && i - j <= REGELS_TERUG; j--) {
    const r = regels[j];
    const kaal = r.trim();
    if (inBlok) {                       // we lopen omhoog DOOR een blok heen
      uit.unshift(r);
      if (kaal.startsWith('/*')) inBlok = false;
      continue;
    }
    if (!kaal) { uit.unshift(r); continue; }
    if (kaal.endsWith('*/')) { uit.unshift(r); if (!kaal.startsWith('/*')) inBlok = true; continue; }
    if (kaal.startsWith('//')) { uit.unshift(r); continue; }
    break;                              // code: hier houdt de uitleg op
  }
  const tekst = uit.join('\n');
  if (!/\bload\b/.test(tekst)) return null;
  /* Twee losse vervangingen en geen tekenklasse: `[/*]` bevat letterlijk de
     tekens die een commentaar OPENEN, en scripts/lib/bronblind.js -- de
     commentaar-verwijderaar waar de kruisproef op staat -- raakte daardoor de
     rest van dit bestand kwijt (711 tokens). Gevonden door npm run norm, die
     hem als blind bestand meldde. */
  const kaal = tekst.replace(/\*/g, '').replace(/\//g, '').trim();
  return kaal.length >= REDEN_MINSTENS ? kaal.slice(0, 200) : null;
}

function meet() {
  const metReden = [];
  const zonderReden = [];
  for (const naam of e2eBestanden()) {
    const regels = fs.readFileSync(path.join(TEST, naam), 'utf8').split('\n');
    for (let i = 0; i < regels.length; i++) {
      if (!NAVIGATIE.test(regels[i])) continue;
      const reden = redenBoven(regels, i);
      (reden ? metReden : zonderReden).push({ bestand: naam, regel: i + 1, reden: reden || null });
    }
  }
  return { bestanden: e2eBestanden().length, metReden, zonderReden,
    totaal: metReden.length + zonderReden.length };
}

function lees() {
  try { return JSON.parse(fs.readFileSync(REGISTER, 'utf8')); } catch (e) { return null; }
}

function schrijf(nu) {
  const uit = {
    uitleg: 'Gemeten door scripts/wachtwijze.js (npm run wachtwijze). `zonderReden` is de ratel ' +
      'en mag alleen omlaag; `metReden` is een besluit met de meting erbij in het bestand.',
    grens: 'Deze meter zegt NIET dat `load` fout is. Hij zegt dat een navigatie die op meer wacht ' +
      'dan haar bewering nodig heeft, een reden hoort te dragen -- anders is het een restpost.',
    gemeten: { e2eBestanden: nu.bestanden, loadNavigaties: nu.totaal,
      metReden: nu.metReden.length, zonderReden: nu.zonderReden.length },
    metReden: nu.metReden.map(r => ({ bestand: r.bestand, regel: r.regel })),
    zonderReden: nu.zonderReden.map(r => ({ bestand: r.bestand, regel: r.regel }))
  };
  fs.writeFileSync(REGISTER, JSON.stringify(uit, null, 2) + '\n');
}

function draai(args) {
  const nu = meet();
  const oud = lees();
  const norm = oud && oud.gemeten ? oud.gemeten.zonderReden : null;
  console.log('\nDE WACHTWIJZE VAN DE SCHERMTOETSEN\n');
  console.log('  ' + nu.bestanden + ' schermtoetsen, ' + nu.totaal + ' navigaties met waitUntil load');
  console.log('    met reden      ' + nu.metReden.length + '   (een besluit, met de meting in het bestand)');
  console.log('    zonder reden   ' + nu.zonderReden.length + (norm == null ? '' : '   (norm: ' + norm + ')'));
  if (nu.zonderReden.length) {
    console.log('');
    const per = new Map();
    for (const r of nu.zonderReden) per.set(r.bestand, (per.get(r.bestand) || 0) + 1);
    for (const [b, n] of [...per].sort((a, b2) => b2[1] - a[1])) console.log('    ' + String(n).padStart(3) + '  ' + b);
  }
  if (norm != null && nu.zonderReden.length > norm) {
    console.log('\n  ZAKT: zonderReden ' + norm + ' -> ' + nu.zonderReden.length +
      '. Zet een navigatie om naar domcontentloaded, of schrijf de meting erboven.\n');
    return 1;
  }
  if (args.includes('--vastleggen') || norm == null) {
    schrijf(nu);
    console.log('\n  WACHTWIJZE.json bijgewerkt.\n');
    return 0;
  }
  if (norm != null && nu.zonderReden.length < norm) {
    console.log('\n  BETER dan de norm (' + norm + '). Leg vast met: npm run wachtwijze -- --vastleggen\n');
    return 0;
  }
  console.log('\n  Gelijk aan de norm.\n');
  return 0;
}

module.exports = { meet, lees, schrijf, redenBoven, REGELS_TERUG, REDEN_MINSTENS, REGISTER };

if (require.main === module) process.exit(draai(process.argv.slice(2)));
