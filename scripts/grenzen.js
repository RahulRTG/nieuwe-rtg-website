#!/usr/bin/env node
/* ============================================================================
   DE GRENZEN -- hoe breed reikt een domein in de gedeelde kern?

   HET PROBLEEM DAT DIT METT. server.js bouwt een object `kern` met ruim
   driehonderd eigenschappen en geeft dat aan ELKE router. Iedere router pakt
   eruit wat hij wil. Er is dus geen enkele grens: elk domein kan bij alles van
   elk ander domein. Het commentaar in opzet/routes.js belooft dat een domein
   later als eigen proces kan draaien -- die belofte is niet na te komen zolang
   niemand kan zeggen wat een domein eigenlijk nodig heeft.

   En dat is niet op te lossen door code te verplaatsen. Ik heb server.js van 183
   naar 103 kB geknipt en de verstrengeling bleef exact gelijk: dezelfde namen,
   andere bestanden. Wat ontbreekt is niet ordening maar een GRENS.

   WAT DE METING LIET ZIEN, en dit is de reden dat dit script er is:

     946 eigenschappen van kern worden door routes aangeraakt
     801 daarvan (85%) door PRECIES EEN domein
      26 door vijf of meer domeinen -- app, auth, supplierAuth, db, officeAuth,
         save, crypto, accounts, express, rtmail, rtf, schoon ...

   Dat laatste lijstje IS een interface. De verstrengeling is dus niet inherent
   aan dit ontwerp; het is een zak die gedeeld wordt terwijl de inhoud bijna
   helemaal van een enkel domein is. Vijfentachtig procent hoort niet in een
   gedeeld object maar in het domein zelf.

   DRIE METERS, ALLE DRIE ALLEEN OMLAAG (zie scripts/norm.js)

   1. kernBreedte   -- hoeveel kern-eigenschappen door routes worden aangeraakt.
   2. kernGedeeld   -- hoeveel daarvan door MEER DAN EEN domein. Dit is het getal
                       dat de echte koppeling meet: dit omlaag brengen betekent
                       dat een domein iets van zichzelf terugneemt.
   3. kernBreedsteBestand -- het breedste enkele routebestand. Nu 139 namen in
                       EEN destructurering (server/routes/supplier/toegang.js).
                       Een bestand dat honderddertig dingen nodig heeft, weet
                       niet wat het is.

   WAT DIT SCRIPT NIET DOET, en dat is met opzet: het verplaatst niets en het
   verbiedt niets nieuws op eigen initiatief. Het maakt de grens ZICHTBAAR en
   ratelt hem. Wie een domein echt losmaakt ziet de getallen zakken; wie er een
   koppeling bij bouwt ziet ze stijgen en moet dat verantwoorden.

   Draai: node scripts/grenzen.js          (leesbaar)
          node scripts/grenzen.js --json   (voor de ratel)
   ========================================================================== */
'use strict';
const fs = require('fs');
const path = require('path');

const WORTEL = path.join(__dirname, '..');
const ROUTES = path.join(WORTEL, 'server', 'routes');

/* De acht echte domeinen uit opzet/routes.js. Alles daarbuiten is een losse
   routemodule; die krijgt zijn bestandsnaam als domein, want dat is precies wat
   hij is -- een eigen ding dat de kern aanraakt. */
const DOMEINEN = ['auth', 'member', 'supplier', 'office', 'staff', 'social', 'techniek', 'zakelijk'];

/* Commentaar en tekenreeksen eruit voordat er iets geteld wordt. Zonder deze
   wringer telt een naam die in een uitleg wordt genoemd mee als een echte
   aanraking -- dezelfde fout die in dit huis al drie keer in een meter zat. */
const wring = (t) => t
  .replace(/\/\*[\s\S]*?\*\//g, m => m.replace(/[^\n]/g, ' '))
  .replace(/(^|[^:'"\\/])\/\/[^\n]*/g, (m, p) => p)
  .replace(/'(?:\\.|[^'\\\n])*'|"(?:\\.|[^"\\\n])*"|`(?:\\.|[^`\\])*`/g, m => m.replace(/[^\n]/g, ' '));

/* Welke kern-eigenschappen raakt deze bron aan? Twee vormen, en beide tellen:
   de destructurering (`const { a, b } = kern`) en de losse toegang (`kern.a`).
   De contextnamen tctx/ctx horen erbij: submodules van techniek en de kantoren
   krijgen de kern onder die naam doorgegeven, en dat is dezelfde zak. */
/* WELKE NAAM DRAAGT DE KERN IN DIT BESTAND? Eerst stonden hier drie namen
   (kern, tctx, ctx) en dat leek genoeg. Het was het niet: server/routes/member/
   betalen-munt.js destructureert uit `mctx`, en dat bestand was daarmee VOLLEDIG
   onzichtbaar voor deze meting -- bereikVan gaf er nul namen voor terug. Toen de
   domeingrens aanging zakte test/munten.test.js op een undefined, en de oorzaak
   lag niet in de code maar hier.

   Geteld over server/routes komen er minstens tien voor: kern (252x), horeca,
   ctx, tctx, vctx, octx, actx, sctx, kctx, wctx, hctx, mctx en r. Een vaste lijst
   loopt dus per definitie achter op de volgende submodule.

   Daarom: ELKE destructurering uit een enkele naam telt mee. Dat verzamelt te
   RUIM -- `const { a, b } = eenGewoonObject` komt er ook in -- en die kant is de
   goede. Wat een domein te veel opschrijft maakt zijn grens iets ruimer; wat het
   te weinig opschrijft laat een route stil op undefined vallen. */
function bereikVan(bron) {
  const s = wring(bron);
  const uit = new Set();
  for (const m of s.matchAll(/\{([^{}]*)\}\s*=\s*[a-zA-Z_$][\w$]*\s*[;)]/g)) {
    for (const stuk of m[1].split(',')) {
      const n = stuk.includes(':') ? stuk.split(':')[0] : stuk;
      const naam = (n || '').trim().split('=')[0].trim();
      if (/^[A-Za-z_$][\w$]*$/.test(naam)) uit.add(naam);
    }
  }
  for (const m of s.matchAll(/\b(?:kern|tctx|ctx)\.([A-Za-z_$][\w$]*)/g)) uit.add(m[1]);
  return uit;
}

/* GEPAKT versus GEBRUIKT -- de scherpste van de metingen hier.

   De twaalf breedste routebestanden reiken alle twaalf naar 134-139 namen. Dat
   zijn geen twaalf brede domeinen: het is EEN destructurering die is
   overgenomen. server/routes/supplier/toegang.js pakt honderdnegenendertig
   namen uit de kern en gebruikt er een fractie van. De kop van dat bestand zegt
   dan niet wat het nodig heeft maar wat een broertje ooit nodig had -- en dan is
   er geen grens meer, ook niet op papier.

   WANNEER HEET EEN NAAM GEBRUIKT, en dit is de tweede versie. De eerste was
   slimmer: een naam telde niet als hij direct achter een punt stond, want
   `req.save` is geen gebruik van `save`. Dat leek scherper en het brak de app.
   In `{ ...publicSupplier(s) }` staat er ook een punt voor de naam -- de spread
   -- dus heette publicSupplier ongebruikt, werd hij in
   server/routes/supplier/menukaart.js weggehaald, en gaf /api/supplier/menu/get
   een 500 met "publicSupplier is not defined". test/allergie.test.js vond het.

   Nu is de regel bot: de naam moet buiten de destructurering NERGENS meer als
   los woord voorkomen. Dat mist gevallen -- een `req.save` houdt `save` in leven
   terwijl niemand hem gebruikt -- en over server/routes kost dat 13 van de 3926
   namen. Dertien gemiste namen tegen een klasse fouten die pas bij een verzoek
   valt: die ruil is niet spannend. Er is nu ook geen punt-logica meer, dus de
   spread-val kan niet opnieuw ontstaan. */
/* Een MILDERE wringer dan hierboven, en het verschil is hier geen detail. De
   gewone `wring` blankt ook backtick-teksten, en een naam die alleen in
   `${save}` staat zou dan als ongebruikt gelden. Wie daarop een naam weghaalt,
   bouwt een ReferenceError die pas bij het eerste verzoek valt. Dus: commentaar
   en aanhalingstekens eruit, backticks laten staan. Een naam die alleen in
   gewone tekst binnen een template voorkomt telt daarmee als gebruikt -- te
   ruim, en dat is precies de kant waar dit hoort te falen. */
const wringMild = (t) => t
  .replace(/\/\*[\s\S]*?\*\//g, m => m.replace(/[^\n]/g, ' '))
  .replace(/(^|[^:'"\\/])\/\/[^\n]*/g, (m, p) => p)
  .replace(/'(?:\\.|[^'\\\n])*'|"(?:\\.|[^"\\\n])*"/g, m => m.replace(/[^\n]/g, ' '));

function pakVsGebruik(bron) {
  const s = wringMild(bron);
  const gepakt = [];
  let rest = s;
  for (const m of s.matchAll(/(?:const|let|var)\s*\{([^{}]*)\}\s*=\s*(?:kern|tctx|ctx)\b/g)) {
    for (const stuk of m[1].split(',')) {
      const n = stuk.includes(':') ? stuk.split(':')[1] : stuk;   // {a: b} bindt b
      const naam = (n || '').trim().split('=')[0].trim();
      if (/^[A-Za-z_$][\w$]*$/.test(naam)) gepakt.push(naam);
    }
    rest = rest.split(m[0]).join(' ');   // de kop zelf is geen gebruik
  }
  const ongebruikt = gepakt.filter(naam => {
    const re = new RegExp('\\b' + naam.replace(/\$/g, '\\$') + '\\b');
    return !re.test(rest);
  });
  return { gepakt, ongebruikt };
}

function meet() {
  const bestanden = [];
  (function loop(map) {
    for (const naam of fs.readdirSync(map)) {
      const p = path.join(map, naam);
      const st = fs.statSync(p);
      if (st.isDirectory()) { loop(p); continue; }
      if (naam.endsWith('.js')) bestanden.push(p);
    }
  })(ROUTES);

  const domeinVan = (f) => {
    const stukken = path.relative(ROUTES, f).split(path.sep);
    return stukken.length > 1 ? stukken[0] : stukken[0].replace(/\.js$/, '');
  };

  const perBestand = new Map();
  const perDomein = new Map();
  const dood = [];                 // gepakt uit de kern, nergens gebruikt
  for (const f of bestanden) {
    const bron = fs.readFileSync(f, 'utf8');
    const rel = path.relative(WORTEL, f).replace(/\\/g, '/');
    const pv = pakVsGebruik(bron);
    if (pv.ongebruikt.length) dood.push({ bestand: rel, aantal: pv.ongebruikt.length,
      gepakt: pv.gepakt.length, namen: pv.ongebruikt });
    const bereik = bereikVan(bron);
    if (!bereik.size) continue;
    perBestand.set(rel, bereik);
    const d = domeinVan(f);
    if (!perDomein.has(d)) perDomein.set(d, new Set());
    for (const n of bereik) perDomein.get(d).add(n);
  }
  dood.sort((a, b) => b.aantal - a.aantal);

  // per eigenschap: welke domeinen raken hem aan?
  const domeinenPer = new Map();
  for (const [d, set] of perDomein) for (const n of set) {
    if (!domeinenPer.has(n)) domeinenPer.set(n, new Set());
    domeinenPer.get(n).add(d);
  }

  const gedeeld = [...domeinenPer.entries()].filter(([, ds]) => ds.size > 1);
  const breedste = [...perBestand.entries()].sort((a, b) => b[1].size - a[1].size);

  return {
    kernBreedte: domeinenPer.size,
    kernGedeeld: gedeeld.length,
    kernBreedsteBestand: breedste.length ? breedste[0][1].size : 0,
    /* Namen die een bestand uit de kern PAKT en nergens gebruikt. Elk daarvan is
       een grens die op papier breder staat dan hij in werkelijkheid is. */
    kernOngebruikt: dood.reduce((n, d) => n + d.aantal, 0),
    ongebruiktPerBestand: dood.slice(0, 15).map(d => ({ bestand: d.bestand, ongebruikt: d.aantal, gepakt: d.gepakt })),
    alleOngebruikt: dood,
    /* Niet in de ratel maar wel in het rapport: waar je zou beginnen. Een
       eigenschap die maar een domein aanraakt, hoort in dat domein en niet in
       een zak die iedereen krijgt. */
    alleenEenDomein: domeinenPer.size - gedeeld.length,
    breedsteBestanden: breedste.slice(0, 12).map(([f, s]) => ({ bestand: f, bereik: s.size })),
    echteKern: [...domeinenPer.entries()].filter(([, ds]) => ds.size >= 5)
      .sort((a, b) => b[1].size - a[1].size).map(([n, ds]) => ({ naam: n, domeinen: ds.size })),
    domeinen: [...perDomein.entries()].sort((a, b) => b[1].size - a[1].size)
      .slice(0, 15).map(([d, s]) => ({ domein: d, bereik: s.size }))
  };
}

if (require.main === module) {
  const r = meet();
  if (process.argv.includes('--json')) { console.log(JSON.stringify(r, null, 2)); process.exit(0); }
  console.log('\n\x1b[1mDE GRENZEN\x1b[0m \x1b[2m-- hoe breed reikt een domein in de gedeelde kern?\x1b[0m\n');
  console.log('  kern-eigenschappen die routes aanraken   \x1b[36m' + r.kernBreedte + '\x1b[0m');
  console.log('  daarvan door MEER dan een domein         \x1b[36m' + r.kernGedeeld +
    '\x1b[0m \x1b[2m(de echte koppeling)\x1b[0m');
  console.log('  daarvan door precies EEN domein          \x1b[36m' + r.alleenEenDomein +
    '\x1b[0m \x1b[2m(' + Math.round(100 * r.alleenEenDomein / r.kernBreedte) + '% -- hoort in dat domein zelf)\x1b[0m');
  console.log('  breedste enkele routebestand             \x1b[36m' + r.kernBreedsteBestand + '\x1b[0m namen\n');
  console.log('  \x1b[1mde echt gedeelde kern\x1b[0m \x1b[2m(vijf of meer domeinen -- dit is de interface)\x1b[0m');
  console.log('  ' + r.echteKern.map(x => x.naam + '(' + x.domeinen + ')').join(' ') + '\n');
  console.log('  \x1b[1mde breedste routebestanden\x1b[0m \x1b[2m(hier zou je beginnen)\x1b[0m');
  for (const b of r.breedsteBestanden) console.log('  ' + String(b.bereik).padStart(5) + '  ' + b.bestand);
  console.log('');
}

module.exports = { meet, bereikVan, pakVsGebruik };
