'use strict';
/* SEMANTISCHE DIFF -- wat is er ECHT veranderd, en hoe zwaar weegt dat?

   Een git-diff telt regels. Deze laag vraagt wat die regels betekenen: een
   witregel erbij is niets, een verdwenen `await` in een beveiligingslaag is
   alles.

   DIT LEVERT EEN ONDERGRENS EN GEEN OORDEEL. De vorm van een wijziging liegt,
   en dat is de belangrijkste zin in dit bestand. Twee echte gevallen van
   21 augustus 2026:

     - de inlogrem verloor twee regels. De diff toont het VERWIJDEREN VAN EEN
       AWAIT -- dat leest als `implementation`. Wat het was: de doelemmer telde
       nog wel maar remde niet meer, en dertig gokken van dertig adressen liepen
       weer op volle snelheid. Dat is `security`.
     - `open = vind(id)` werd `const g = vind(id); if (!g) return; open = g;`.
       Puur `implementation` -- en het repareerde een scherm dat voor elk lid een
       bestand opende zonder ooit de inhoud te tonen.

   Beide keren zei de vorm "klein" en zei de graaf "zwaar". Het eindoordeel komt
   daarom uit scripts/lib/risico.js; wie hier stopt, mist precies die twee.

   EERST DE SOORT, DAN PAS DE PATRONEN, en dat is duur geleerd: de eerste versie
   liet de codepatronen ook op proza los, en noemde toen ADAPTIEF.md
   "beveiliging" omdat er het woord sleutel in stond. Van de 2542 gewijzigde
   bestanden kreeg 540 die stempel. Een etiket dat overal op zit, draagt geen
   informatie -- en het is niet "veilig conservatief" maar waardeloos, want dan
   is nooit iets aantoonbaar irrelevant en versnelt er nooit iets.

   DE SOORTEN ZIJN GEMETEN EN NIET GEVOELD (21 augustus 2026):

     document   .md -- GEEN ENKELE servermodule leest er een in (nul treffers op
                readFile/require van .md onder server/), maar tien keuringsscripts
                wel. Een documentwijziging kan dus de POORTEN raken en nooit het
                draaiende huis.
     gegevens   .json -- servercode leest die wel (vier plekken), dus die krijgt
                de volle behandeling.
     besturing  de bewijsmachinerie zelf: de werkstromen, de keuringen, de
                toetsen, de ratelregisters, de Node-versie.
     code       .js -- de patronen hieronder, en alleen op CODEregels.

   WAAROM `besturing` BOVEN `security` STAAT. Een wijziging aan de machinerie
   die bewijs oplevert, kan niet worden gecertificeerd door diezelfde machinerie.
   Wie een ratel losdraait, een toets uitzet of de Node-versie wisselt, verandert
   niet iets in het huis maar de weegschaal waarmee het huis wordt gewogen. Dat
   is de zwaarste klasse die er is, en hij hoort nooit door een bewijserfenis
   heen te glippen.
   ========================================================================== */
const { execFileSync } = require('child_process');
const path = require('path');

const WORTEL = path.join(__dirname, '..', '..');

/* De klassen op volgorde van gewicht: een wijziging krijgt de ZWAARSTE die
   past, nooit de eerste. */
const GEWICHT = ['documentatie', 'cosmetic', 'implementation', 'contract',
  'public API', 'schema', 'authorization', 'money', 'security', 'besturing'];

/* EEN ONBEKENDE KLASSE WINT. Dat lijkt een detail en is het niet: `indexOf`
   geeft voor een naam die niet in de ladder staat -1 terug, en dan VERLIEST die
   klasse van alles. Voor de lichtste klasse is dat toevallig het goede antwoord,
   voor de zwaarste is het een ramp -- en precies dat gebeurde: risico.js droeg
   een eigen kopie van deze ladder zonder `besturing` erin, en daar werd een
   wijziging aan de bewijsmachinerie zelf teruggezet naar `implementation`. Een
   naadfout tussen twee bestanden die allebei gelijk leken te hebben.

   Twee dingen zijn daarop veranderd: de ladder staat nog maar op EEN plek (deze),
   en een naam die er niet in staat wordt behandeld als het zwaarste dat er is.
   Wie een klasse toevoegt en hem hier vergeet, krijgt te veel bewijs en niet te
   weinig -- de kant waar par. 0 om vraagt. */
function zwaarste(a, b) {
  const ia = GEWICHT.indexOf(a), ib = GEWICHT.indexOf(b);
  if (ia === -1) return a;
  if (ib === -1) return b;
  return ia >= ib ? a : b;
}

/* DE BESTURINGSLAAG, met naam en te betwisten. Alles wat bepaalt WAT er wordt
   bewezen of WAARONDER er wordt bewezen. */
const BESTURING = [
  /^\.github\/workflows\//,
  /^scripts\//,
  /^test\//,
  /^\.nvmrc$/,
  /^package(?:-lock)?\.json$/,
  /^(?:NORM|BEREIK|IDEMSCHULD|BEWIJSSCHULD|KLOKWACHT|KLOK|BEDRADING|BEPROEVING)\.json$/,
  /^Dockerfile$|^docker-compose/
];

function soortVan(pad) {
  for (const p of BESTURING) if (p.test(pad)) return 'besturing';
  if (/\.(?:md|txt)$/i.test(pad)) return 'document';
  if (/\.(?:js|mjs|cjs)$/i.test(pad)) return 'code';
  if (/\.json$/i.test(pad)) return 'gegevens';
  if (/\.html?$/i.test(pad)) return 'scherm';
  if (/\.css$/i.test(pad)) return 'stijl';
  return 'overig';
}

/* PATRONEN OP DE GEWIJZIGDE CODEREGELS ZELF. Alleen toevoegingen en
   verwijderingen tellen; contextregels zeggen niets over deze wijziging. */
const PATRONEN = [
  [/\b(?:app|router)\.(?:get|post|put|patch|delete)\s*\(/, 'public API'],
  [/\bmodule\.exports\b|\bexports\.[A-Za-z_$]/, 'contract'],
  [/\bCREATE TABLE\b|\bALTER TABLE\b|\bmigratie\b|\bkolom\b/i, 'schema'],
  [/\bcapabilit|\bmag\s*\(|\bofficeAuth\b|\bboardroomAuth\b|\bbevoegd/i, 'authorization'],
  [/\bcenten\b|\bbedrag\b|\bsaldo\b|\bbtw\b|\bfactuur\b|\bwallet\b|\bbetaal/i, 'money'],
  [/\btoken\b|\bnonce\b|\bsleutel\b|\bhmac\b|\bscrypt\b|\brem\b|tooManyTries/i, 'security']
];

/* WAT NOOIT MEETELT. Een regel die alleen uit witruimte of commentaar bestaat,
   verandert niets aan wat de code doet -- en een classificator die dat wel
   meetelt, laat elke documentatieronde de zwaarste toetsen draaien. */
function isCosmetisch(regel) {
  const r = regel.slice(1).trim();                 // zonder de + of -
  if (!r) return true;
  return /^(?:\/\/|\*|\/\*|\*\/)/.test(r);
}

function git(args) {
  return execFileSync('git', args, { cwd: WORTEL, encoding: 'utf8', maxBuffer: 256 * 1024 * 1024 });
}

/* De ondergrens van EEN bestand. */
function klasseVanBestand(pad, regels) {
  const soort = soortVan(pad);
  if (soort === 'besturing') return { klasse: 'besturing', redenen: ['de bewijsmachinerie zelf'] };
  if (soort === 'document') return { klasse: 'documentatie', redenen: [] };
  /* Een scherm, een stijlblad of een gegevensbestand krijgt geen woordpatronen
     opgeplakt -- daar betekenen dezelfde woorden iets anders. Wat het WEL is,
     bepaalt de graaf: een scherm dat in een geldpad hangt is een geldpad. */
  if (soort !== 'code') return { klasse: 'implementation', redenen: [] };

  let klasse = 'cosmetic';
  const redenen = new Set();
  for (const r of regels) {
    for (const [p, k] of PATRONEN) {
      if (!p.test(r)) continue;
      if (zwaarste(klasse, k) === k && klasse !== k) redenen.add(k);
      klasse = zwaarste(klasse, k);
    }
    if (klasse === 'cosmetic') klasse = 'implementation';
  }
  return { klasse, redenen: [...redenen] };
}

/* DE ONTLEDING, LOS VAN GIT. Dit is met opzet een eigen functie: zolang hij in
   diff() zat, was hij alleen te beproeven door een echte repository te bouwen --
   en dus werd hij niet beproefd. De mutatietoets legde dat bloot: het commentaar
   uit de telling halen liet geen enkele toets zakken. */
function ontleed(ruw) {
  const bestanden = new Map();
  let nu = null;
  for (const regel of ruw.split('\n')) {
    /* VERWIJDERDE BESTANDEN STAAN AAN DE a-KANT. Zonder deze tak verdwijnt een
       verwijdering uit de meting -- en juist die is voor de impactvraag de
       lastigste, want de omgekeerde graaf weet er daarna niets meer van. */
    const oud = /^--- a\/(.+)$/.exec(regel);
    if (oud) { nu = { pad: oud[1], verwijderd: true, regels: [], cosmetisch: 0 }; continue; }
    const kop = /^\+\+\+ (?:b\/(.+)|\/dev\/null)$/.exec(regel);
    if (kop) {
      if (kop[1]) nu = { pad: kop[1], verwijderd: false, regels: [], cosmetisch: 0 };
      if (nu) bestanden.set(nu.pad, nu);
      continue;
    }
    if (!nu) continue;
    if (!/^[+-]/.test(regel) || /^(?:\+\+\+|---)/.test(regel)) continue;
    if (isCosmetisch(regel)) { nu.cosmetisch++; continue; }
    nu.regels.push(regel);
  }

  return [...bestanden.values()].map((f) => {
    const k = klasseVanBestand(f.pad, f.regels);
    return { pad: f.pad, soort: soortVan(f.pad), verwijderd: f.verwijderd,
      klasse: f.regels.length ? k.klasse : (f.cosmetisch ? 'cosmetic' : k.klasse),
      regels: f.regels.length, cosmetisch: f.cosmetisch, redenen: k.redenen };
  }).sort((x, y) => x.pad.localeCompare(y.pad));
}

/* De wijziging ten opzichte van een basis. Standaard de samenvoegbasis met
   main, want dat is de vraag die er bij een merge toe doet: wat brengt DEZE tak
   mee, en niet wat er sinds gisteren is gebeurd. */
function diff(basis) {
  const b = basis || (() => {
    try { return git(['merge-base', 'HEAD', 'origin/main']).trim(); }
    catch (e) { return 'HEAD~1'; }
  })();

  let ruw;
  try { ruw = git(['diff', '--unified=0', b, 'HEAD']); }
  catch (e) { return { basis: b, fout: (e && e.message) || String(e), bestanden: [] }; }

  return { basis: b, bestanden: ontleed(ruw) };
}

module.exports = { diff, ontleed, soortVan, klasseVanBestand, GEWICHT, zwaarste, isCosmetisch, BESTURING };
