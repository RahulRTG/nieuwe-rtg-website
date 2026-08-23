#!/usr/bin/env node
/* ============================================================================
   DE ENVELOP -- wat weet RTG op het moment dat het gezag wordt verleend?

   WAAROM DIT ER IS. `scripts/gezag.js` telde de plekken die beslissen OF de
   machine iets zelf mag. Dit meet de vraag ervoor, en die is dwingender: als
   een poortwachter JA zegt, welke feiten liggen er dan eigenlijk op tafel?

   Een controlelaag die per handeling wil kunnen zeggen "deze actor, dit doel,
   zoveel objecten, wel of niet omkeerbaar" heeft die feiten nodig op EEN plek en
   op EEN moment. Die plek bestaat hier al: de elf poortwachters. Bijna alle
   routes lopen door een van hen, en `auth` draagt er zelfs al beleid (hij geeft
   403 als het lid de functie in zijn boardroom heeft uitgezet). De naad is dus
   niet het probleem.

   HET PROBLEEM IS WAT ER OP DIE NAAD LIGT. De poortwachter weet WIE. De
   opslaglaag (`server/db/index.js`, een functie waar 2700 aanroepen doorheen
   gaan) weet WAT ER VERANDERT. Daartussen bestaat geen enkel object dat allebei
   draagt -- en zonder dat object is er geen risicobudget, geen blast radius en
   geen bonnetje te bouwen, hoe je de rest ook inricht.

   WAT DEZE METER TELT

     veldenZonderHuis   envelopvelden die GEEN enkele poortwachter vaststelt.
                        Dit is de echte afstand tot een controlelaag, en het mag
                        alleen omlaag.
     actorVormen        onder hoeveel verschillende namen "wie handelt hier"
                        op het verzoek wordt gezet. Elke extra vorm is LAT.md
                        regel 4 op de gevoeligste plek die er is: acht namen
                        voor een begrip betekent dat geen enkele lezer ze
                        allemaal kent.

   WAT DEZE METER NIET DOET, en dat hoort erbij:

   - Hij oordeelt niet of een poortwachter GOED is. `auth` doet zijn werk; de
     vraag hier is uitsluitend welke feiten hij achterlaat voor wie na hem komt.
   - Hij ziet alleen de elf geregistreerde poortwachters. Een route die langs een
     eigen, ongeregistreerde controle loopt telt hier als "zonder poortwachter",
     en dat is een melding en geen oordeel -- `scripts/check.js` regel 28 is de
     plek die daar hard over is.
   - "Vastgesteld" betekent hier: de poortwachter zet het veld op het verzoek.
     Het zegt niets over of het veld KLOPT. Het scherpste geval staat als
     bevinding in ENVELOP.json: het kantoortoken kent geen personen, dus de
     ondertekenaar bij de documentenuitgifte is een tekenreeks uit de body.

   Draai:  node scripts/envelop.js
           node scripts/envelop.js --velden      (per veld wie hem vaststelt)
           node scripts/envelop.js --vastleggen
   ========================================================================== */
'use strict';
const fs = require('fs');
const path = require('path');
const { zonderCommentaar } = require('./lib/bron');

const WORTEL = path.join(__dirname, '..');
const UITSLAG = path.join(WORTEL, 'ENVELOP.json');
const argv = process.argv.slice(2);
const VASTLEGGEN = argv.includes('--vastleggen');
const VELDEN_UIT = argv.includes('--velden');

/* DE ELF VELDEN van de envelop, in de volgorde waarin ze nodig zijn: eerst wie
   en waar, dan wat en waarom, dan hoe erg. De laatste vijf hebben vandaag geen
   enkele plek -- dat is precies het getal dat deze meter vasthoudt. */
const VELDEN = [
  { id: 'actor', wat: 'wie handelt hier' },
  { id: 'tenant', wat: 'binnen welk huis (zaak, werkplek, gezin)' },
  { id: 'capability', wat: 'welk begrensd recht wordt gebruikt' },
  { id: 'doel', wat: 'welk object wordt geraakt' },
  { id: 'intent', wat: 'wat de actor probeert te bereiken' },
  { id: 'wijzigingen', wat: 'wat er precies gaat veranderen, voor het gebeurt' },
  { id: 'risicoklasse', wat: 'hoe zwaar deze handeling weegt' },
  { id: 'omkeerbaarheid', wat: 'is dit terug te draaien, en hoe' },
  { id: 'gezag', wat: 'waar de bevoegdheid vandaan komt (de keten)' },
  { id: 'context', wat: 'apparaat, tijd, dienst, hoeveelheid' },
  { id: 'correlatie', wat: 'welke keten van handelingen hier bij hoort' }
];

/* HET REGISTER van poortwachters. `zet` noemt per veld de EIGENSCHAP die de
   poortwachter op het verzoek achterlaat, en die eigenschap moet in zijn bestand
   terug te vinden zijn -- anders meet deze meter niets meer en zakt hij. */
const POORTWACHTERS = [
  { naam: 'auth', bestand: 'server/opzet/diensten2.js', envelop: true,
    zet: [{ veld: 'actor', via: 'req.session' },
          { veld: 'capability', via: 'lidBoardUit' }],
    opmerking: 'de enige die al beleid droeg: 403 als het lid de functie in zijn boardroom heeft uitgezet. ' +
               'De capability is een aan/uit-schakelaar per functie, geen begrensd recht (geen bedrag, geen bereik)' },
  { naam: 'supplierAuth', bestand: 'server/opzet/leverancierpoort.js', envelop: true,
    zet: [{ veld: 'actor', via: 'req.actor' },
          { veld: 'tenant', via: 'req.supplier' }],
    opmerking: 'de rijkste van de elf: persoon EN huis, met rol, staffId en of hij manager is -- de maat waar de andere tien naartoe groeien' },
  { naam: 'officeAuth', bestand: 'server/kern/kantoor/index.js', envelop: true,
    zet: [],
    opmerking: 'liet tot deze ronde NIETS achter. Zet nu een envelop die eerlijk zegt wat hij is: ' +
               "identiteit 'bewezen' als de sessie een lidKey draagt, anders 'anoniem'. " +
               'Zie de bevinding kantoortoken-kent-geen-personen -- die is hiermee ZICHTBAAR, niet opgelost' },
  { naam: 'boardroomAuth', bestand: 'server/kern/kantoor/index.js', envelop: true,
    zet: [{ veld: 'actor', via: 'req.boardroomKey' },
          { veld: 'gezag', via: 'req.boardroomBaas' }],
    opmerking: 'weigert het anonieme kantoortoken met zoveel woorden -- het precedent voor de reparatie van officeAuth' },
  { naam: 'techAuth', bestand: 'server/routes/techniek.js', envelop: true,
    zet: [{ veld: 'actor', via: 'req.techUser' }],
    opmerking: 'meldt een geldig account dat hier niets te zoeken heeft als kritiek: rechten-escalatie' },
  { naam: 'gastAuth', bestand: 'server/routes/gast.js', envelop: true,
    zet: [{ veld: 'actor', via: 'req.gast' }],
    opmerking: "de actor is een TAFEL en geen persoon; de envelop zegt dat met 'anoniem' in plaats van er een aan te nemen" },
  { naam: 'huisAuth', bestand: 'server/routes/werkplek.js', envelop: true,
    zet: [{ veld: 'tenant', via: 'req.werkplekCode' },
          { veld: 'gezag', via: 'req.werkplekBaas' }],
    opmerking: 'de tenant komt uit req.body.bedrijf en wordt daarna gecontroleerd met werkplek.magIn -- ' +
               'de volgorde klopt; de envelop draagt sinds deze ronde ook de sleutelhouder als actor' },
  { naam: 'baasAuth', bestand: 'server/routes/werkplek.js', envelop: false,
    zet: [],
    opmerking: 'controleert alleen en staat altijd NA huisAuth, die de envelop al heeft gezet; ' +
               'er zelf een tweede zetten zou de eerste overschrijven met minder' },
  { naam: 'huisPoort', bestand: 'server/routes/kantoorpakket-huis.js', envelop: true,
    zet: [{ veld: 'actor', via: 'req.drive' }],
    opmerking: 'req.drive draagt sleutel en kring in een eigen vorm; de envelop staat er nu naast' },
  { naam: 'gezinsPoort', bestand: 'server/routes/tiener.js', envelop: true,
    zet: [{ veld: 'actor', via: 'req.gezinslid' }],
    opmerking: 'weigert gasten; de rol zit sinds deze ronde ook in de envelop' },
  { naam: 'rtfPoort', bestand: 'server/routes/kantoorpakket-huis.js', envelop: true,
    zet: [{ veld: 'actor', via: 'req.drive' }],
    opmerking: 'zelfde vorm als huisPoort, andere herkomst; een oppas is bekend maar mag niet bewerken' }
];

/* WAT ER BUITEN DE POORTWACHTERS OM AL WORDT VASTGESTELD, en dat stond hier
   eerst niet. De eerste versie van deze meter keek ALLEEN naar de elf
   poortwachters en meldde daarom dat `correlatie` geen huis had. Fout: de
   logmiddleware (server/log.js) zet `req.id` op ELK verzoek en echoot hem als
   X-Request-Id. Een meter die de vraag te smal stelt geeft een getal dat te
   hoog is, en dat is precies zo misleidend als een getal dat te laag is
   (LAT.md regel 10). */
const MIDDLEWARE = [
  { naam: 'log.middleware', bestand: 'server/log.js',
    zet: [{ veld: 'correlatie', via: 'req.id' }],
    opmerking: 'zet een correlatie-id op elk verzoek en geeft hem terug als X-Request-Id; ' +
               'de envelop maakt er GEEN tweede, die zou uiteenlopen' }
];

/* DE CANONIEKE ENVELOP (server/opzet/envelop.js). Welke velden draagt hij, en
   staan die daar ook echt? Een veld telt pas als "hij heeft een huis" wanneer de
   envelopmodule hem draagt EN er poortwachters zijn die een envelop zetten --
   een vorm die niemand vult is geen huis. */
const ENVELOPMODULE = {
  bestand: 'server/opzet/envelop.js',
  /* DE BEWIJSZIN WIJST NAAR DE ECHTE DRAGER, en niet naar de veldnaam. Hier
     stond eerst 'capability:', en dat kon niet zakken: het VANGNET in zet() zet
     ook `capability: null`, dus de naam bleef staan als de drager verdween.
     Precies de vorm uit LAT.md regel 9 -- gevonden doordat de mutatie in
     test/envelop.test.js werd afgeslagen. Elke zin hieronder komt nu uit maak(),
     de enige plek waar het veld ECHT wordt gevuld. */
  draagt: [
    { veld: 'actor', bewijs: 'actor: { soort, id,' },
    { veld: 'tenant', bewijs: 'tenant: g.tenantId ?' },
    { veld: 'capability', bewijs: 'capability: tekst(g.capability' },
    { veld: 'gezag', bewijs: 'gezag: g.gezagBron ?' },
    { veld: 'context', bewijs: 'context: context(req, fouten)' },
    { veld: 'correlatie', bewijs: 'correlatie: leesVeilig(' }
  ],
  /* EEN SLOT DRAGEN IS NIET HETZELFDE ALS HEM VULLEN, en dat verschil hoort in
     het getal. De envelop heeft op alle 3346 routes een `tenant`-veld, maar
     alleen supplierAuth, huisAuth en gastAuth zetten er iets in -- "tenant: 3346
     routes" melden zou een slot voor een feit laten doorgaan. Deze twee velden
     zijn de enige die de envelop ZELF op elke route invult; de rest is een slot
     dat een poortwachter moet vullen. */
  vultAltijd: ['context', 'correlatie'],
  /* WAT HIJ BEWUST NIET DRAAGT. Een poortwachter kent deze niet: ze ontstaan pas
     als de handeling bekend is en de opslaglaag weet wat er verandert. Ze hier
     verzinnen zou de envelop laten liegen, en daar gaat beleid op. */
  draagtNiet: ['doel', 'intent', 'wijzigingen', 'risicoklasse', 'omkeerbaarheid']
};

/* BEVINDINGEN die met de hand zijn vastgesteld en die deze meter bij elke ronde
   opnieuw natrekt aan een LETTERLIJKE zin uit de bron. Verdwijnt de zin, dan is
   de bevinding opgelost of verplaatst en moet dit register bij -- zodat hij niet
   stilletjes verdampt en ook niet blijft staan als hij al gerepareerd is. */
const BEVINDINGEN = [
  {
    naam: 'kantoortoken-kent-geen-personen',
    wat: 'Het kantoortoken is anoniem: officeAuth laat in de kantoor-tak niets op het verzoek achter. ' +
         'Bij de documentenuitgifte MET vier-ogenprincipe wordt de ondertekenaar daarom uit de body gelezen ' +
         '(req.body.wie), dus de identiteit onder een handtekening is een tekenreeks die de aanroeper zelf typt.',
    ernst: 'Dit is een gedocumenteerd ONTWERPGEVOLG en geen slordigheid -- de kop van routes/uitgifte.js zegt het ' +
           'zelf. RTG heeft hetzelfde gat elders al herkend en dichtgezet: boardroomAuth weigert het anonieme ' +
           'kantoortoken juist omdat het geen identiteit draagt. ' +
           'SINDS DE ENVELOPRONDE IS HIJ ZICHTBAAR EN NIET OPGELOST: officeAuth zet nu wel een envelop, maar die ' +
           "draagt identiteit 'anoniem' zodra de sessie geen lidKey heeft -- precies wat het is. Wat nog niet " +
           'gebeurt is dat de vier-ogen-uitgifte daar iets mee DOET; hij leest nog steeds req.body.wie. ' +
           'De reparatie is een besluit en geen code: of het kantoor krijgt een sessie met een persoon (zoals de ' +
           'leverancierskant met req.actor), of de uitgifte weigert een anonieme envelop zoals de boardroom dat doet.',
    kanten: [
      { bestand: 'server/routes/uitgifte.js', zin: "const wieOffice = req => String((req.body || {}).wie || '')" },
      { bestand: 'server/routes/uitgifte.js', zin: 'het kantoor-token kent geen' },
      { bestand: 'server/kern/kantoor/index.js', zin: "identiteit: sess.lidKey ? 'bewezen' : 'anoniem'" }
    ]
  }
];

function loopJs(map, uit) {
  let namen;
  try { namen = fs.readdirSync(map, { withFileTypes: true }); } catch (e) { return uit; }
  for (const e of namen) {
    const p = path.join(map, e.name);
    if (e.isDirectory()) loopJs(p, uit);
    else if (e.name.endsWith('.js')) uit.push(p);
  }
  return uit;
}

function lees(vol) {
  let ruw;
  try { ruw = fs.readFileSync(vol, 'utf8'); } catch (e) { return null; }
  // een binair bestand met een .js-naam draagt geen routes; stil overslaan is
  // hier juist, meetellen zou het getal vervuilen
  if (ruw.indexOf('\u0000') >= 0) return null;
  try { return zonderCommentaar(ruw); } catch (e) { return ruw; }
}

function meet() {
  const bron = new Map();
  /* RUW ERNAAST, en dat is geen luxe. De tellingen hieronder lezen de bron
     ZONDER commentaar -- een route in een uitlegregel is geen route. Maar een
     BEVINDING mag juist naar een commentaarregel wijzen: "het kantoor-token kent
     geen personen" staat in de kop van routes/uitgifte.js en is daar de
     verklaring van het gat. Dat is LAT.md regel 6 (een belofte in tekst is een
     belofte in code) en dus bewijs, geen ruis. Ze door dezelfde wringer halen
     liet de bevinding ten onrechte als "veranderd" melden. */
  const ruwe = new Map();
  for (const f of loopJs(path.join(WORTEL, 'server'), [])) {
    const rel = path.relative(WORTEL, f).replace(/\\/g, '/');
    let ruw;
    try { ruw = fs.readFileSync(f, 'utf8'); } catch (e) { continue; }
    if (ruw.indexOf('\u0000') >= 0) continue;
    ruwe.set(rel, ruw);
    const code = lees(f);
    if (code != null) bron.set(rel, code);
  }

  /* DE ZELFIJKING (LAT.md regel 3 en 10). Elke poortwachter moet in zijn bestand
     staan, en elke eigenschap die hij volgens dit register achterlaat moet daar
     ook echt worden gezet. Klopt dat niet, dan is het register verouderd en meet
     alles hieronder niets -- dan hoort deze meter te zakken, niet 0 te melden. */
  const stuk = [];
  for (const p of POORTWACHTERS) {
    const code = bron.get(p.bestand);
    if (code == null) { stuk.push(p.naam + ': ' + p.bestand + ' bestaat niet meer'); continue; }
    if (!new RegExp('function\\s+' + p.naam + '\\s*\\(').test(code))
      stuk.push(p.naam + ': niet meer gedeclareerd in ' + p.bestand);
    for (const z of p.zet) {
      const eig = z.via.replace(/^req\./, '');
      const patroon = z.via.startsWith('req.')
        ? new RegExp('req\\.' + eig + '\\s*=')      // hij ZET hem, niet leest hem
        : new RegExp('\\b' + z.via + '\\b');
      if (!patroon.test(code)) stuk.push(p.naam + ': zet ' + z.via + ' niet (meer) in ' + p.bestand);
    }
    /* Zegt het register dat deze poortwachter een canonieke envelop zet, dan
       moet die aanroep er ook staan. Zonder deze regel zou het wegvallen van
       envelop.zet() het aantal velden-met-huis stilzwijgend laten stijgen. */
    if (p.envelop && !/envelop\.zet\s*\(/.test(code))
      stuk.push(p.naam + ': zet geen canonieke envelop meer in ' + p.bestand);
  }
  for (const m of MIDDLEWARE) {
    const code = bron.get(m.bestand);
    if (code == null) { stuk.push(m.naam + ': ' + m.bestand + ' bestaat niet meer'); continue; }
    for (const z of m.zet) {
      const eig = z.via.replace(/^req\./, '');
      if (!new RegExp('req\\.' + eig + '\\s*=').test(code))
        stuk.push(m.naam + ': zet ' + z.via + ' niet (meer) in ' + m.bestand);
    }
  }
  {
    const code = bron.get(ENVELOPMODULE.bestand);
    if (code == null) stuk.push('de envelopmodule ' + ENVELOPMODULE.bestand + ' bestaat niet');
    else for (const d of ENVELOPMODULE.draagt) {
      if (!code.includes(d.bewijs))
        stuk.push('de envelop draagt ' + d.veld + ' niet meer (' + d.bewijs + ' weg uit ' + ENVELOPMODULE.bestand + ')');
    }
  }

  /* ROUTES PER POORTWACHTER. Uit de bron, want de routekaart kent de middleware
     niet. Een route kan meer dan een poortwachter dragen (boardroomAuth loopt
     via officeAuth); dan telt hij bij allebei, en dat staat er zo bij. */
  const namen = POORTWACHTERS.map(p => p.naam);
  const perPoort = new Map(namen.map(n => [n, 0]));
  let routes = 0, zonderPoort = 0;
  const zonderVoorbeeld = [];
  for (const [, code] of bron) {
    for (const m of code.matchAll(/app\.(?:get|post|put|delete|patch)\(\s*'([^']+)'\s*,([^)]*)/g)) {
      routes++;
      const midden = m[2];
      const raak = namen.filter(n => new RegExp('\\b' + n + '\\b').test(midden));
      if (!raak.length) { zonderPoort++; if (zonderVoorbeeld.length < 8) zonderVoorbeeld.push(m[1]); continue; }
      for (const n of raak) perPoort.set(n, perPoort.get(n) + 1);
    }
  }

  /* ROUTES MET EEN CANONIEKE ENVELOP. Dit is het getal dat de kant op moet die
     de rest mogelijk maakt: hoeveel routes dragen een handeling in EEN vorm? */
  const envelopRoutes = POORTWACHTERS.filter(p => p.envelop)
    .reduce((n, p) => n + perPoort.get(p.naam), 0);

  /* PER VELD: wie stelt hem vast, en over hoeveel routes. Drie bronnen, en ze
     tellen alle drie -- de poortwachter (per route), de middleware (elk verzoek)
     en de canonieke envelop (overal waar een poortwachter hem zet). */
  const envelopDraagt = new Set(ENVELOPMODULE.draagt.map(d => d.veld));
  const perVeld = VELDEN.map(v => {
    const dragers = POORTWACHTERS.filter(p => p.zet.some(z => z.veld === v.id)).map(p => p.naam);
    const uitMiddleware = MIDDLEWARE.filter(m => m.zet.some(z => z.veld === v.id)).map(m => m.naam);
    const altijd = ENVELOPMODULE.vultAltijd.includes(v.id);
    const uitEnvelop = envelopDraagt.has(v.id) && envelopRoutes > 0
      ? [altijd ? 'envelop' : 'envelop (slot)'] : [];
    const alle = [...dragers, ...uitMiddleware, ...uitEnvelop];
    /* BEREIK = waar het veld ECHT gevuld wordt. Een slot telt niet mee: de
       envelop draagt overal een tenant-veld, maar het is alleen gevuld waar een
       poortwachter hem zet. */
    const bereik = uitMiddleware.length ? routes
      : altijd ? envelopRoutes
      : POORTWACHTERS.filter(p => p.zet.some(z => z.veld === v.id))
          .reduce((n, p) => n + perPoort.get(p.naam), 0);
    return { ...v, dragers: alle, bereik, slot: !altijd && uitEnvelop.length > 0 };
  });
  const zonderHuis = perVeld.filter(v => !v.dragers.length);

  /* DE ACTORVORMEN. Hoeveel verschillende namen draagt "wie handelt hier"? */
  const actorVormen = [...new Set(POORTWACHTERS.flatMap(p =>
    p.zet.filter(z => z.veld === 'actor').map(z => z.via)))].sort();

  const bevindingen = BEVINDINGEN.map(b => {
    const kwijt = b.kanten.filter(k => {
      const ruw = ruwe.get(k.bestand);          // ruw: een bewijszin mag commentaar zijn
      return ruw == null || !ruw.includes(k.zin);
    }).map(k => k.bestand);
    return { naam: b.naam, wat: b.wat, ernst: b.ernst,
      staat: kwijt.length ? 'veranderd' : 'staat nog', kwijt };
  });

  return { stuk, routes, zonderPoort, zonderVoorbeeld, perPoort, perVeld, zonderHuis,
    actorVormen, bevindingen, envelopRoutes,
    routesZonderEnvelop: routes - envelopRoutes,
    veldenZonderHuis: zonderHuis.length, aantalActorVormen: actorVormen.length };
}

function stand(nu) {
  return {
    uitleg: 'Wat weet RTG op het moment dat een poortwachter JA zegt? `veldenZonderHuis` telt de ' +
      'envelopvelden die GEEN enkele poortwachter vaststelt; `actorVormen` telt onder hoeveel ' +
      'verschillende namen "wie handelt hier" op het verzoek wordt gezet. BEIDE MOGEN ALLEEN OMLAAG. ' +
      'Zonder een envelop die actor en wijziging samen draagt, is er geen risicobudget, geen blast ' +
      'radius en geen bonnetje te bouwen -- hoe de rest ook wordt ingericht.',
    hoe: 'node scripts/envelop.js --velden',
    gemeten: { veldenZonderHuis: nu.veldenZonderHuis, actorVormen: nu.aantalActorVormen,
      routesZonderEnvelop: nu.routesZonderEnvelop,
      routesMetEnvelop: nu.envelopRoutes,
      routesMetPoortwachter: nu.routes - nu.zonderPoort, routesTotaal: nu.routes },
    veldenZonderHuis: nu.zonderHuis.map(v => ({ veld: v.id, wat: v.wat })),
    actorVormen: nu.actorVormen,
    poortwachters: POORTWACHTERS.map(p => ({
      naam: p.naam, bestand: p.bestand, routes: nu.perPoort.get(p.naam),
      zet: p.zet.map(z => z.veld + ' <- ' + z.via), opmerking: p.opmerking })),
    bevindingen: nu.bevindingen.map(b => ({ naam: b.naam, wat: b.wat, ernst: b.ernst }))
  };
}

function leesVastgelegd() {
  try { return JSON.parse(fs.readFileSync(UITSLAG, 'utf8')); } catch (e) { return null; }
}

/* Geeft een exitcode terug in plaats van process.exit() te doen, zodat een toets
   hem in hetzelfde proces kan draaien en de mutatiemotor deze module echt kan
   muteren -- een script dat zijn werk bij het laden doet is voor allebei
   onbereikbaar. */
function main() {
  const nu = meet();
  const oud = leesVastgelegd();

  console.log('\n=== DE ENVELOP ===\n');

  if (nu.stuk.length) {
    console.log('  DE METER IS STUK -- het poortwachterregister klopt niet meer met de code:\n');
    for (const s of nu.stuk) console.log('    - ' + s);
    console.log('\n  Zolang dit staat meet niets hieronder iets. Werk POORTWACHTERS in');
    console.log('  scripts/envelop.js bij, of zet de poortwachter terug.');
    return 2;
  }

  console.log('  routes met een geregistreerde poortwachter : ' +
    (nu.routes - nu.zonderPoort) + ' van ' + nu.routes);
  console.log('  envelopvelden zonder huis                  : ' + nu.veldenZonderHuis + ' van ' + VELDEN.length);
  console.log('  routes met een canonieke envelop           : ' + nu.envelopRoutes +
    ' van ' + nu.routes + '   (zonder: ' + nu.routesZonderEnvelop + ')');
  console.log('  oude actorvormen die nog gelezen worden    : ' + nu.aantalActorVormen +
    '  (' + nu.actorVormen.join(', ') + ')');

  console.log('\n  per poortwachter:');
  for (const p of POORTWACHTERS) {
    const zet = p.zet.length ? p.zet.map(z => z.veld).join(', ') : '\x1b[33mniets\x1b[0m';
    console.log('    ' + String(nu.perPoort.get(p.naam)).padStart(5) + '  ' +
      p.naam.padEnd(15) + zet);
  }

  if (VELDEN_UIT) {
    console.log('\n  per veld:');
    for (const v of nu.perVeld) {
      const wie = v.dragers.length ? v.dragers.join(', ') + '  (' + v.bereik + ' routes)' : '\x1b[33mGEEN ENKELE\x1b[0m';
      console.log('    ' + v.id.padEnd(16) + wie);
      console.log('    ' + ' '.repeat(16) + '\x1b[2m' + v.wat + '\x1b[0m');
    }
    if (nu.zonderPoort) {
      console.log('\n  ' + nu.zonderPoort + ' routes zonder een van deze elf poortwachters, bijvoorbeeld:');
      for (const p of nu.zonderVoorbeeld) console.log('    - ' + p);
      console.log('    \x1b[2m(publiek, een eigen controle, of een gat -- check.js regel 28 is daar hard over)\x1b[0m');
    }
  }

  console.log('\n  bevindingen : ' + nu.bevindingen.length);
  for (const b of nu.bevindingen) {
    console.log('    [' + b.staat + '] ' + b.naam);
    if (b.staat === 'veranderd') console.log('      veranderd in: ' + b.kwijt.join(', ') + ' -- werk ENVELOP.json bij');
  }

  if (VASTLEGGEN) {
    if (oud && (nu.veldenZonderHuis > oud.gemeten.veldenZonderHuis ||
                nu.aantalActorVormen > oud.gemeten.actorVormen ||
                nu.routesZonderEnvelop > (oud.gemeten.routesZonderEnvelop != null
                  ? oud.gemeten.routesZonderEnvelop : Infinity))) {
      console.log('\n  GEWEIGERD: de ratel legt geen verslechtering vast (' +
        oud.gemeten.veldenZonderHuis + '/' + oud.gemeten.actorVormen + ' -> ' +
        nu.veldenZonderHuis + '/' + nu.aantalActorVormen + ').');
      return 1;
    }
    fs.writeFileSync(UITSLAG, JSON.stringify(stand(nu), null, 2) + '\n');
    console.log('\n  vastgelegd in ENVELOP.json');
    return 0;
  }

  if (!oud) { console.log('\n  Nog geen ENVELOP.json. Leg de stand vast met --vastleggen.'); return 0; }

  const slechter = [];
  if (nu.veldenZonderHuis > oud.gemeten.veldenZonderHuis)
    slechter.push('velden zonder huis ' + oud.gemeten.veldenZonderHuis + ' -> ' + nu.veldenZonderHuis);
  if (nu.aantalActorVormen > oud.gemeten.actorVormen)
    slechter.push('actorvormen ' + oud.gemeten.actorVormen + ' -> ' + nu.aantalActorVormen);
  if (oud.gemeten.routesZonderEnvelop != null && nu.routesZonderEnvelop > oud.gemeten.routesZonderEnvelop)
    slechter.push('routes zonder envelop ' + oud.gemeten.routesZonderEnvelop + ' -> ' + nu.routesZonderEnvelop);

  if (slechter.length) {
    console.log('\n  ZAKT: ' + slechter.join('; ') + '.');
    console.log('  Een nieuwe actorvorm betekent een negende naam voor hetzelfde begrip;');
    console.log('  laat een nieuwe poortwachter een BESTAANDE vorm gebruiken.');
    return 1;
  }
  if (nu.veldenZonderHuis < oud.gemeten.veldenZonderHuis ||
      nu.aantalActorVormen < oud.gemeten.actorVormen ||
      (oud.gemeten.routesZonderEnvelop != null && nu.routesZonderEnvelop < oud.gemeten.routesZonderEnvelop)) {
    console.log('\n  BETER dan ENVELOP.json (' + oud.gemeten.veldenZonderHuis + '/' + oud.gemeten.actorVormen +
      ' -> ' + nu.veldenZonderHuis + '/' + nu.aantalActorVormen + '). Zet de ratel strakker met --vastleggen.');
    return 0;
  }
  console.log('\n  De stand is gelijk aan ENVELOP.json.');
  return 0;
}

module.exports = { meet, stand, main, VELDEN, POORTWACHTERS, MIDDLEWARE, ENVELOPMODULE, BEVINDINGEN };

if (require.main === module) process.exit(main());
