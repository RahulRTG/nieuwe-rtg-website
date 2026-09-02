#!/usr/bin/env node
/* ============================================================================
   DE WEKKERS -- wat kan er werk beginnen zonder dat iemand een pad opvraagt?

   WAAROM DIT ER IS

   Stap 6 van de keten, en met opzet alleen de MEETKANT. De tredeproef bewijst
   dat op elke trede elk pad buiten die trede geweigerd wordt -- maar alleen over
   HTTP. Een functie die "uit" staat kan nog steeds werk beginnen langs een weg
   die nooit een route aanraakt, en dat is de gevaarlijkste vorm van uit: het
   ziet er dicht uit en het draait.

   Deze meter zoekt die wegen op en telt ze. Hij blokkeert NIETS. Dat is de
   volgorde van CONTROLPLANE.md en niet van gemak: een nieuwe handhavingsregel
   loopt eerst mee in de schaduw, want je kunt niet afdwingen wat nooit in de
   schaduw heeft gelopen.

   DRIE SOORTEN WEKKERS, EN EEN VIERDE DIE ER GEEN BLEEK

     KLOK      setInterval/setTimeout in server/: werk dat vanzelf terugkomt.
     BUS       een abonnee op de berichtenbus (server/bus.js subscribe).
     WEBHOOK   een aanroep van buiten die vóór de schakelkast binnenkomt.

     AI -- EN DIE IS GEEN GAT. kern/stuur.js roept zijn paden aan met
     `fetch('http://127.0.0.1:' + poort + pad)` (regel 130): de AI gaat over
     ECHTE HTTP en komt dus langs dezelfde functieschakelaars als een mens. Dat
     is hier nagekeken en niet aangenomen, en het staat in de uitslag omdat een
     afwezig gat net zo goed een uitkomst is als een aanwezig gat.

   DE VRAAG PER WEKKER: KAN IEMAND HEM UITZETTEN?

   Een wekker woont in een bestand. Dat bestand zit in de envelop van nul of meer
   functies (ACTIVERING.json). Zit hij in geen enkele envelop, dan raakt geen
   schakelaar in de boardroom deze code: hij draait op elke trede, ook op trede 0.

   WAT DAT WEL EN NIET ZEGT, en dat hoort erbij:

     Het is een uitspraak over BEREIK en niet over gedrag. Een wekker in de
     envelop van een functie wordt daarmee NIET automatisch uitgezet als die
     functie uit gaat -- de schakelaar staat op de route, niet op de timer. Wie
     dat verwart, leest hier een garantie die er niet staat.

     Andersom is de nul wél hard: nul functies betekent dat er niets bestaat dat
     hem raakt, en dan is afdwingen later ook niet mogelijk zonder eerst een
     functie te bedenken waar hij bij hoort.

   EN EEN DEEL VAN DIE NULLEN IS GEEN GAT. De bus zelf, de database, de rem, het
   schild, de certificaten en de bedrading horen niet aan een functieschakelaar
   -- exact de redenering die kern/platformregister/bediening.js al voert voor
   routes. Ze staan daarom met naam en reden in
   scripts/lib/wekker-verklaringen.js, en wat daar NIET op staat en toch geen
   functie raakt, is het getal dat naar nul moet.

   Draai: npm run wekkers            (rapport)
          npm run wekkers:vast       (schrijft WEKKERS.json)
   ========================================================================== */
'use strict';
const fs = require('fs');
const path = require('path');

const WORTEL = path.join(__dirname, '..');
const V = require('./verstrengeling');

/* De patronen per soort. Bewust smal en met een naam erbij: een patroon dat
   alles vangt, meldt honderden wekkers die er geen zijn, en dan wordt de lijst
   weggekeken. */
const PATRONEN = [
  { soort: 'KLOK', rx: /\bsetInterval\s*\(/g, wat: 'werk dat vanzelf terugkomt' },
  { soort: 'BUS', rx: /\.subscribe\s*\(/g, wat: 'een abonnee op de berichtenbus' }
];

/* De webhooks staan niet met een patroon maar met hun pad: ze zijn al gevonden
   door de tredeproef, en die lijst is daar VERKLAARD met de reden. Hem hier
   opnieuw afleiden zou een tweede waarheid opleveren (LAT-regel 4). */
function webhooks() {
  const { VOOR_DE_SCHAKELAAR } = require('./tredeproef');
  return VOOR_DE_SCHAKELAAR.map(([route, reden]) => ({ soort: 'WEBHOOK', route, reden }));
}

function bestanden(map, uit = []) {
  for (const e of fs.readdirSync(map, { withFileTypes: true })) {
    if (e.name === 'node_modules' || e.name === 'data') continue;
    const p = path.join(map, e.name);
    if (e.isDirectory()) bestanden(p, uit);
    else if (e.name.endsWith('.js')) uit.push(p);
  }
  return uit;
}

/* Puur: welke functies raken dit bestand?

   TWEE WEGEN, EN DE EERSTE ONTBRAK EERST. Een envelop draagt haar DOMEINEN
   (knopen die met `domein:` beginnen) en haar OPHANGBESTANDEN. Op alleen de
   domeinen matchen betekent dat een routebestand nooit kan matchen -- dat is
   een `ingang:`-knoop en die staat per definitie niet in die lijst. Zeven
   route-bestanden met een timer stonden daardoor als "raakt geen enkele
   functie" gemeld, terwijl ze precies de functie dragen waar hun routes bij
   horen. Een meter die zijn eigen koppeling niet dekt, meldt een gat dat er
   niet is -- en dat is even schadelijk als een gat verzwijgen. */
function functiesVoorBestand(rel, envelopen) {
  const k = V.knoopVan(rel);
  const id = k ? k.laag + ':' + k.domein : null;
  return envelopen.filter(e =>
    (e.ophangbestanden || []).includes(rel) || (id && e.domeinen.includes(id))
  ).map(e => e.id);
}

function meet() {
  let activering;
  try { activering = JSON.parse(fs.readFileSync(path.join(WORTEL, 'ACTIVERING.json'), 'utf8')); }
  catch (e) { throw new Error('ACTIVERING.json ontbreekt (' + e.message + '); draai npm run activering:vast -- zonder envelopen is niet te zeggen wie een wekker kan uitzetten'); }
  const envelopen = activering.envelopen || [];

  const wekkers = [];
  for (const f of bestanden(path.join(WORTEL, 'server'))) {
    const rel = path.relative(WORTEL, f).replace(/\\/g, '/');
    let bron;
    try { bron = fs.readFileSync(f, 'utf8'); } catch { continue; }
    for (const p of PATRONEN) {
      const n = (bron.match(p.rx) || []).length;
      if (!n) continue;
      const fn = functiesVoorBestand(rel, envelopen);
      wekkers.push({ soort: p.soort, bestand: rel, aantal: n, functies: fn.length, welke: fn.slice(0, 8) });
    }
  }

  const verklaard = new Map(require('./lib/wekker-verklaringen').map(v => [v.bestand, v.reden]));
  for (const w of wekkers) if (w.functies === 0 && verklaard.has(w.bestand)) w.verklaard = verklaard.get(w.bestand);
  const ongeschakeld = wekkers.filter(w => w.functies === 0 && !w.verklaard);
  const ongeschakeldVerklaard = wekkers.filter(w => w.functies === 0 && w.verklaard);
  const perSoort = {};
  for (const w of wekkers) perSoort[w.soort] = (perSoort[w.soort] || 0) + 1;

  return {
    gemetenOp: new Date().toISOString().slice(0, 10),
    meetAlleen: 'deze meter blokkeert niets; hij loopt in de schaduw (CONTROLPLANE.md: je kunt niet afdwingen wat nooit in de schaduw heeft gelopen)',
    aiIsGeenGat: "kern/stuur.js r.130 roept zijn paden aan met fetch('http://127.0.0.1:'+poort+pad): de AI gaat over echte HTTP en komt dus langs dezelfde functieschakelaars als een mens",
    watDitNietZegt: 'een wekker IN de envelop van een functie wordt niet automatisch uitgezet als die functie uit gaat -- de schakelaar staat op de route, niet op de timer. De nul is wel hard: nul functies betekent dat niets hem raakt.',
    wekkers: wekkers.length,
    perSoort,
    webhooks: webhooks(),
    ongeschakeld: ongeschakeld.length,
    ongeschakeldVerklaard: ongeschakeldVerklaard.length,
    verklaringenOngebruikt: [...verklaard.keys()].filter(b => !wekkers.some(w => w.bestand === b)),
    ongeschakeldLijst: ongeschakeld.map(w => w.soort + '  ' + w.bestand + ' (' + w.aantal + 'x)').sort(),
    lijst: wekkers.sort((a, b) => a.functies - b.functies || (a.bestand < b.bestand ? -1 : 1))
  };
}

function rapport(r) {
  const L = [];
  L.push('DE WEKKERS -- ' + r.gemetenOp);
  L.push('');
  L.push(`  ${r.wekkers} plekken die werk kunnen beginnen zonder dat iemand een pad opvraagt.`);
  L.push('  ' + Object.entries(r.perSoort).map(([s, n]) => `${n} ${s}`).join(', ') + `, plus ${r.webhooks.length} webhooks.`);
  L.push('');
  L.push(`  ONGESCHAKELD EN ONVERKLAARD: ${r.ongeschakeld} van de ${r.wekkers}.`);
  L.push(`  (${r.ongeschakeldVerklaard} andere raken ook geen functie, maar horen dat niet te doen:`);
  L.push('  de bus, de database, de rem, het schild, de certificaten en de bedrading --');
  L.push('  met hun reden in scripts/lib/wekker-verklaringen.js.)');
  L.push('  Wat hieronder staat raakt GEEN schakelaar in de boardroom, op geen enkele trede.');
  for (const x of r.ongeschakeldLijst.slice(0, 25)) L.push('      ' + x);
  if (r.ongeschakeldLijst.length > 25) L.push(`      ... en nog ${r.ongeschakeldLijst.length - 25}`);
  L.push('');
  if (r.verklaringenOngebruikt.length) {
    L.push('  LET OP -- verklaringen die nergens meer op slaan (het bestand is weg of');
    L.push('  raakt inmiddels wel een functie). Een reden die nergens over gaat, hoort op te ruimen:');
    for (const b of r.verklaringenOngebruikt) L.push('      ' + b);
    L.push('');
  }
  L.push('  DE WEBHOOKS (verklaard in de tredeproef, niet hier opnieuw afgeleid)');
  for (const w of r.webhooks) L.push('      ' + w.route);
  L.push('');
  L.push('  DE AI IS GEEN GAT: ' + r.aiIsGeenGat);
  L.push('');
  L.push('  WAT DIT NIET ZEGT: ' + r.watDitNietZegt);
  L.push('  ' + r.meetAlleen);
  return L.join('\n');
}

if (require.main === module) {
  const r = meet();
  if (process.argv.includes('--json')) process.stdout.write(JSON.stringify(r, null, 2) + '\n');
  else if (process.argv.includes('--vastleggen')) {
    fs.writeFileSync(path.join(WORTEL, 'WEKKERS.json'), JSON.stringify(r, null, 2) + '\n');
    process.stdout.write(rapport(r) + '\n\nVastgelegd in WEKKERS.json\n');
  } else process.stdout.write(rapport(r) + '\n');
}

module.exports = { meet, rapport, functiesVoorBestand, PATRONEN };
