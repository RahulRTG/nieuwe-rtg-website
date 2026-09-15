#!/usr/bin/env node
'use strict';
/* ============================================================================
   KAN RTG IN DIT LAND DRAAIEN? -- gemeten per land, niet per belofte.

   WAAROM DIT SCRIPT BESTAAT. "RTG franchise ready maken voor het buitenland"
   leest als een bouwopdracht en begint als een MEETVRAAG, want dit huis heeft
   twee dingen die er allebei uitzien als internationale gereedheid en die niet
   hetzelfde zijn:

     KENNIS        wat RTG van een land WEET. kern/fiscaal/landen.js kent van
                   189 landen de btw-tarieven, het minimumuurloon, de
                   werkgeverslasten en de aangiftewijze. Dat is echt en het is
                   veel.
     UITVOERING    wat RTG in dat land werkelijk kan DOEN. Loon draaien vraagt
                   een regelpakket (kern/payroll/jaargangen/), een onderneming
                   inschrijven vraagt een rechtsvormtabel, en een tarief dat
                   meebeweegt vraagt een fiscale jaargang.

   Wie die twee optelt, leest 189 landen dekking waar er een paar zijn. Dat is
   dezelfde faalvorm als de `vorm`-as in scripts/ketenvorm.js: een as die per
   definitie waar is, telt als bewijs mee zolang niemand zegt dat hij de
   ONDERGRENS is. Daarom staat hier per as of hij onderscheidend is.

   WAT HIJ MEET. Per land acht assen, elk uit een bron in de code en geen
   ervan uit een lijst die iemand bijhoudt. Een as die voor ELK land in de
   tabel aanstaat is een ONDERGRENS: hij hoort in het beeld en niet in het
   kopgetal.

   EN DAT WORDT AFGELEID EN NIET VERKLAARD. In de eerste versie stond per as
   met de hand of hij onderscheidend was, en dat was meteen mis: `zakelijke
   uitleg` stond als ondergrens ingetikt en bleek er zes van de 189 te hebben.
   De indeling van een meting is zelf een bewering en hoort even hard te zijn
   als de meting (BEWIJSMACHINE.md par. 6a: een proef kan een geldige uitslag
   geven en toch het verkeerde experiment zijn). Een as is hier dus ondergrens
   als hij GETELD voor alle landen aanstaat, en niemand kan dat verkeerd
   invullen.

   WAT HIJ NIET DOET. Een oordeel vellen over of RTG naar een land MOET. Dat is
   een besluit van de eigenaar; dit telt wat er ligt. En hij zegt niets over de
   franchise-assen (wie is RTG in dat land, wie mag daar het kantoor bedienen,
   waar landt de afdracht) -- die zijn niet per land te meten omdat ze
   huisbreed nul zijn. Ze staan apart in de uitslag onder `huisbreed`, met de
   bron van elke nul erbij, want een nul zonder bron is een vermoeden.

   Draaien:  npm run landdekking            (print)
             npm run landdekking:vast       (schrijft LANDDEKKING.json)
   ============================================================================ */
const fs = require('fs');
const path = require('path');
const { stempel } = require('./lib/stempel');

const WORTEL = path.join(__dirname, '..');
const DOEL = path.join(WORTEL, 'LANDDEKKING.json');

const { LANDEN } = require(path.join(WORTEL, 'server/kern/fiscaal/landen'));
const { rechtsvormenVanLand } = require(path.join(WORTEL, 'server/kern/onderneming/rechtsvorm'));
const { registerSuggestie } = require(path.join(WORTEL, 'server/kern/internationalehandel'));

/* De acht assen. Of een as ONDERSCHEIDEND is staat hier met opzet niet: dat
   wordt geteld (zie `meet`), precies zoals `vorm` in ketenvorm.js de ondergrens
   is en dat er hardop bij zegt. */
const ASSEN = [
  { id: 'btwTarief', bron: 'kern/fiscaal/landen.js',
    wat: 'De btw-tarieven per categorie (eten, drank, logies, vervoer, jet, standaard).' },
  { id: 'aangifte', bron: 'kern/fiscaal/landen.js',
    wat: 'Hoe en waar er in dit land aangifte wordt gedaan, als tekst voor een mens.' },
  { id: 'loonkennis', bron: 'kern/fiscaal/landen.js',
    wat: 'Minimumuurloon, werkgeverslasten en vakantiegeld. Kennis, geen motor.' },
  { id: 'zakelijkeUitleg', bron: 'kern/fiscaal/landen.js',
    wat: 'Wat een ondernemer per categorie mag aftrekken.' },
  { id: 'loonuitvoering', bron: 'kern/payroll/jaargangen/',
    wat: 'Een regelpakket waarmee er werkelijk loon gedraaid kan worden. Zonder dit komt er geen loonstrook, en dat is goed -- met Nederlandse tarieven Spaans loon rekenen is erger dan niet rekenen.' },
  { id: 'fiscaalJaargang', bron: 'kern/fiscaal/meegeleverd/',
    wat: 'Een meegeleverde fiscale jaargang, zodat een tariefwijziging meebeweegt in plaats van met de hand te worden nagelopen.' },
  { id: 'rechtsvorm', bron: 'kern/onderneming/rechtsvorm*.js',
    wat: 'De rechtsvormen van dit land, met hun verplichtingen. Zonder dit kan er geen onderneming worden opgericht.' },
  { id: 'bedrijfsregister', bron: 'kern/internationalehandel.js',
    wat: 'Een AANWIJSBAAR ondernemingsregister met adres. De terugval "het officiele register van het vestigingsland" telt hier niet mee: dat is een zin, geen register.' }
];

/* ---------- de bronnen, elk een keer gelezen ---------- */

function bestandenIn(rel) {
  const dir = path.join(WORTEL, rel);
  try { return fs.readdirSync(dir).filter(f => f.endsWith('.json')); } catch (_) { return []; }
}

/* Een jaargangbestand heet `nl-2026.json`; de landcode is het deel voor het
   streepje. Niet de INHOUD lezen: een pakket dat niet laadt hoort hier op te
   vallen als ontbrekend land, en niet als een crash van de meter. */
function landenUitJaargangen(rel) {
  const per = new Map();
  for (const f of bestandenIn(rel)) {
    const m = /^([a-z]{2})-/i.exec(f);
    if (!m) continue;
    const land = m[1].toUpperCase();
    if (!per.has(land)) per.set(land, []);
    per.get(land).push(f);
  }
  return per;
}

function meet() {
  const loonPakketten = landenUitJaargangen('server/kern/payroll/jaargangen');
  const fiscaalPakketten = landenUitJaargangen('server/kern/fiscaal/meegeleverd');

  const perLand = [];
  for (const [code, d] of Object.entries(LANDEN)) {
    const heeft = {};
    heeft.btwTarief = !!(d.tarieven && Object.keys(d.tarieven).length);
    heeft.aangifte = !!(d.aangifte && String(d.aangifte).trim());
    heeft.loonkennis = d.uurloonMin != null && d.lasten != null;
    heeft.zakelijkeUitleg = !!(d.zakelijk && Object.keys(d.zakelijk).length);
    heeft.loonuitvoering = loonPakketten.has(code);
    heeft.fiscaalJaargang = fiscaalPakketten.has(code);

    /* rechtsvormenVanLand geeft een OBJECT ({ ok, vormen, reden }) en geen
       array. Dit stond hier eerst als array en telde daarom nul landen terwijl
       er zeven zijn -- de meter had ongelijk, niet de code. */
    let vorm = null;
    try { vorm = rechtsvormenVanLand(code); } catch (_) { vorm = null; }
    const vormen = (vorm && vorm.ok && Array.isArray(vorm.vormen)) ? vorm.vormen : [];
    heeft.rechtsvorm = vormen.length > 0;

    /* Een register telt alleen als het een adres heeft. De generieke terugval
       geeft een lege url, en die is met opzet niet goed genoeg: hij vertelt een
       ondernemer niet waar hij heen moet. */
    let reg = null;
    try { reg = registerSuggestie(code); } catch (_) { reg = null; }
    heeft.bedrijfsregister = !!(reg && reg.url);

    perLand.push({
      code, naam: d.naam, regio: d.regio || '',
      heeft,
      rechtsvormen: vormen.length,
      register: heeft.bedrijfsregister ? reg.naam : null
    });
  }

  /* ---------- welke assen zijn onderscheidend? GETELD, niet ingetikt ----------
     Een as die voor elk van de landen aanstaat, zegt niets over een land. Die
     hoort in het beeld en niet in het kopgetal. */
  const perAs = {};
  for (const a of ASSEN) perAs[a.id] = perLand.filter(l => l.heeft[a.id]).length;
  const ONDERSCHEIDEND = ASSEN.filter(a => perAs[a.id] < perLand.length).map(a => a.id);
  const ONDERGRENS = ASSEN.filter(a => perAs[a.id] >= perLand.length).map(a => a.id);

  for (const l of perLand) {
    l.mist = ONDERSCHEIDEND.filter(a => !l.heeft[a]);
    l.onderscheidendeAssen = ONDERSCHEIDEND.length - l.mist.length;
  }

  perLand.sort((a, b) => b.onderscheidendeAssen - a.onderscheidendeAssen ||
    a.naam.localeCompare(b.naam, 'nl'));

  const volledig = perLand.filter(l => l.mist.length === 0);

  const perAantal = {};
  for (const l of perLand) perAantal[l.onderscheidendeAssen] = (perAantal[l.onderscheidendeAssen] || 0) + 1;

  return {
    stempel: stempel(),
    graad: 'gemeten',
    grens: 'Deze meter telt GEVULDE CELLEN en beoordeelt geen enkel getal: of het Albanese btw-tarief klopt, of het minimumuurloon van vandaag is, en of een regelpakket juridisch juist rekent, staat hier NIET in. Hij zegt ook niets over of RTG naar een land moet -- dat is een besluit van de eigenaar. En `bedrijfsregister` telt een AANWIJSBAAR register en niet of dat register bereikbaar of actueel is.',
    hoe: 'Elke as leest een bron in server/; geen enkele as komt uit een lijst in dit script.',
    assen: ASSEN.map(a => Object.assign({ onderscheidend: ONDERSCHEIDEND.includes(a.id) }, a)),
    telling: {
      landen: perLand.length,
      onderscheidendeAssen: ONDERSCHEIDEND.length,
      ondergrensAssen: ONDERGRENS.length,
      landenVolledig: volledig.length,
      landenMetMinstensEen: perLand.filter(l => l.onderscheidendeAssen > 0).length,
      landenZonderEnige: perLand.filter(l => l.onderscheidendeAssen === 0).length,
      perAs, perAantal
    },
    volledig: volledig.map(l => l.code),
    koplopers: perLand.filter(l => l.onderscheidendeAssen > 0),
    perLand,
    huisbreed: huisbreed()
  };
}

/* ---------- de franchise-assen, en waarom ze niet per land staan ----------
   Deze zes gaan niet over een land maar over de vraag wie RTG daar IS. Ze zijn
   huisbreed nul of een, en elk getal wordt hier GETELD uit de broncode -- niet
   ingetikt met een zin erachter. In de eerste versie stonden ze wel ingetikt,
   en dat is precies wat BEWIJSMACHINE.md tegenhoudt: een register dat naast de
   code leeft, loopt eruit en niemand ziet het. Een nul die uit een telling komt
   gaat vanzelf omhoog zodra iemand het begrip bouwt. */

/* Alle .js onder server/, een keer gelezen. */
function bronBestanden() {
  const uit = [];
  (function loop(dir) {
    let rij = [];
    try { rij = fs.readdirSync(dir, { withFileTypes: true }); } catch (_) { return; }
    for (const d of rij) {
      const vol = path.join(dir, d.name);
      if (d.isDirectory()) { if (d.name !== 'node_modules' && d.name !== 'data') loop(vol); }
      else if (d.name.endsWith('.js')) uit.push(vol);
    }
  })(path.join(WORTEL, 'server'));
  return uit.map(f => ({ pad: path.relative(WORTEL, f), tekst: fs.readFileSync(f, 'utf8') }));
}

function huisbreed() {
  const bestanden = bronBestanden();
  const raakt = (re) => bestanden.filter(b => re.test(b.tekst)).map(b => b.pad);

  /* De woorden waarmee een exploitant zou heten. Geteld op het WOORD en niet op
     een structuur, dus dit is een ONDERGRENS: een begrip dat er onder een naam
     staat die hier niet in staat, wordt gemist. Zo staat het er ook bij. */
  const exploitantWoorden = /franchisenemer|franchisegever|masterfranchise|licentienemer|licentiegever|merklicentie|royalty/i;
  const exploitant = raakt(exploitantWoorden);

  const werelden = bestanden.find(b => b.pad.endsWith('kern/economie/werelden.js'));
  const dragersIntern = (/id:\s*'rtg-intern'[^}]*dragers:\s*\[([^\]]*)\]/.exec(werelden ? werelden.tekst : '') || [, ''])[1]
    .split(',').map(x => x.trim().replace(/'/g, '')).filter(Boolean);

  /* Hoeveel gedeelde kantoorcodes zijn er? Geteld op de plek waar hij ontstaat. */
  const kantoorBron = bestanden.filter(b => /OFFICE_CODE\s*=\s*process\.env/.test(b.tekst)).map(b => b.pad);

  /* Een vergoeding over omzet. Het GETAL komt uit de module zelf, zodat deze as
     meebeweegt als de invariant ooit bewust wordt opengezet. */
  let commissie = null;
  try { commissie = require(path.join(WORTEL, 'server/kern/commercie/vergoeding')).PARTNER_COMMISSIE; } catch (_) { commissie = null; }

  const landTaal = raakt(/landTaal|taalVanLand|LAND_TAAL|taalBijLand/);

  return [
    { as: 'exploitant', aantal: exploitant.length, graad: 'vermoed', treffers: exploitant,
      bron: 'woordtelling over alle .js in server/',
      wat: 'Een partijsoort die RTG in een land exploiteert onder het merk RTG.',
      waarom: 'Geteld op de woorden franchisenemer, franchisegever, masterfranchise, licentienemer, licentiegever, merklicentie en royalty. ' +
        'De enige treffer is kern/beroepenbieb/data.js, en daar staan Franchisenemer en Franchisegever als BEROEPSNAAM in een lijst van beroepen -- ' +
        'dat is een woord in gegevens en geen partijsoort, dezelfde vorm als een pad dat in schermroutes.js een gegeven bleek in plaats van een doel. ' +
        'Als BEGRIP is deze as dus nul. Het woord "franchise" zelf staat er twee keer en beide keren over een KLANT: kern/mall/vestigingen.js beschrijft de franchise van een bakker, ' +
        'en zegt daar meteen de regel die hier het meest toe doet -- waar elke vestiging een eigen ondernemer is, hoort zij een eigen zaak met een eigen code te zijn en geen vestiging. ' +
        'De graad is vermoed omdat dit op woorden telt en niet op structuur: een begrip onder een naam die hier niet in staat, wordt gemist.' },
    { as: 'economischeWereld', aantal: dragersIntern.length, graad: 'gemeten', treffers: dragersIntern,
      bron: 'server/kern/economie/werelden.js',
      wat: 'Hoeveel dragers de wereld rtg-intern kent.',
      waarom: 'De wereld rtg-intern heeft precies deze dragers: ' + (dragersIntern.join(', ') || '(geen)') +
        '. Er is dus een huis. Een exploitant in een ander land is een tweede huis met een eigen vermogen, en daar bestaat geen drager voor -- zijn kosten en zijn omzet hebben vandaag geen plek die niet van RTG zelf is.' },
    { as: 'kantoorcode', aantal: kantoorBron.length, graad: 'gemeten', treffers: kantoorBron,
      bron: 'de plek waar OFFICE_CODE ontstaat',
      wat: 'Hoeveel gedeelde kantoorcodes het huis kent.',
      waarom: 'Er is een gedeelde OFFICE_CODE en een rol office; KANTOORMACHT.md meet 26 kamers achter die ene sleutel. Een medewerker van een exploitant in Spanje zou daarmee de deur van het hele huis hebben. Dit telt de codes en niet de kamers -- KANTOORMACHT.json telt die.' },
    { as: 'vergoedingOverOmzet', aantal: commissie == null ? 0 : commissie,
      graad: commissie == null ? 'onbekend' : 'gemeten',
      bron: 'kern/commercie/vergoeding.js, PARTNER_COMMISSIE',
      wat: 'Het percentage dat RTG over de omzet van een partner rekent.',
      waarom: 'De partnervergoeding over omzet is nul, en dat is geen instelling maar een eigenschap van het product (partnervoorwaarden art. 1). Een royalty is precies zo een stroom. Wat er WEL mag zijn vier BENOEMDE diensten in dezelfde module -- die weg staat open, de generieke weg niet.' },
    { as: 'landTaalTabel', aantal: landTaal.length, graad: 'gemeten', treffers: landTaal,
      bron: 'woordtelling over alle .js in server/',
      wat: 'Een tabel die een land aan een taal knoopt.',
      waarom: 'Er staan 114 talen in server/talen.js en 11 schiltalen in server/taalschil.js, maar niets knoopt een land aan een taal. Een lid in Madrid krijgt dus geen Spaans omdat hij in Spanje zit; hij krijgt het omdat hij het kiest. Dat is verdedigbaar en het is een BESLUIT dat nergens staat.' }
  ];
}

function druk(u) {
  const t = u.telling;
  console.log('landdekking: ' + t.landen + ' landen, ' + t.onderscheidendeAssen + ' onderscheidende assen');
  console.log('  VOLLEDIG (alle ' + t.onderscheidendeAssen + '): ' + t.landenVolledig +
    (u.volledig.length ? ' -- ' + u.volledig.join(', ') : ''));
  console.log('  minstens een as: ' + t.landenMetMinstensEen + '   geen enkele: ' + t.landenZonderEnige);
  console.log('\n  PER AS');
  for (const a of u.assen) {
    console.log('    ' + a.id.padEnd(17) + String(t.perAs[a.id]).padStart(4) + ' landen' +
      (a.onderscheidend ? '' : '   (ondergrens -- staat voor elk land aan)'));
  }
  console.log('\n  DE LANDEN DIE IETS HEBBEN');
  for (const l of u.koplopers) {
    console.log('    ' + l.code + ' ' + l.naam.slice(0, 20).padEnd(21) + l.onderscheidendeAssen + '/' + t.onderscheidendeAssen +
      '   mist: ' + (l.mist.join(', ') || '-'));
  }
  console.log('\n  HUISBREED (niet per land te meten)');
  for (const h of u.huisbreed) {
    console.log('    ' + h.as.padEnd(19) + String(h.aantal).padStart(3) + '  [' + h.graad + ']  ' + h.wat);
  }
}

module.exports = { meet, ASSEN, DOEL };

if (require.main === module) {
  const u = meet();
  /* GEEN process.exit() NA EEN GROTE console.log: naar een BESTAND schrijft node
     synchroon en gaat het goed, naar een PIPE wordt de uitvoer afgekapt --
     geldige tekst, kapotte JSON, exitcode 0. Dat is keuringsregel `pipe` in
     scripts/meetkeuring.js, en hij kostte dit huis ooit twee derde van een
     uitslag zonder enig signaal. process.exitCode laat de pipe leeglopen. */
  if (process.argv.includes('--json')) { console.log(JSON.stringify(u, null, 2)); process.exitCode = 0; return; }
  druk(u);
  if (process.argv.includes('--vastleggen')) {
    fs.writeFileSync(DOEL, JSON.stringify(u, null, 2) + '\n');
    console.log('\ngeschreven: LANDDEKKING.json');
  }
}
