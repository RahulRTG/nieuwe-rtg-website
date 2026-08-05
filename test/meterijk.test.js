/* De ijking van de meters: regel 10 van LAT.md, met een handhaver.

   "Een meter die je niet hebt zien uitslaan, meet niets." Dat stond
   opgeschreven, en op een dag bleken zeven meters te liegen -- geen van
   allen in de RTG-code zelf, allemaal in de instrumenten die moesten
   bewijzen dat de code deugde. Een kapotte toets zakt en dat merk je; een
   kapotte meter geeft een getal, en getallen ogen als feiten.

   Wat hier gebeurt: elke meter uit scripts/norm.js krijgt een bekend-FOUTE
   invoer, en moet die zien. Niet "hij draait" maar "hij slaat uit". Wat we
   in het klein doen is precies wat LAT-regel 2 in het groot eist: de
   bewering natrekken met een mutatie.

   En voor de meters die je niet in een toets kunt voeden (de prestatiecijfers
   komen van een echte beproeving van een half uur op een echte machine)
   staat er een REDEN in plaats van een proef. Die reden is geen vrijbrief:
   scripts/check.js regel 35 eist dat elke meter hier voorkomt, en de
   NORM-meter `metersOngeijkt` telt de redenen en mag alleen omlaag. Zo kan
   een nieuwe meter niet ongemerkt ongeijkt meeliften, en wordt het gat
   kleiner in plaats van vergeten.

   Draai los: node --experimental-sqlite --test test/meterijk.test.js */
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');
const os = require('os');

const WORTEL = path.join(__dirname, '..');
const norm = require('../scripts/norm.js');

/* Een proef doet drie dingen: iets kapots neerzetten, meten, opruimen. Het
   opruimen staat in een finally, want een ijking die rommel achterlaat is
   erger dan geen ijking. */
function metTijdelijkBestand(relPad, inhoud, doe) {
  const vol = path.join(WORTEL, relPad);
  assert.equal(fs.existsSync(vol), false, 'de ijking overschrijft nooit een bestaand bestand: ' + relPad);
  fs.writeFileSync(vol, inhoud);
  try { return doe(); } finally { try { fs.unlinkSync(vol); } catch (e) {} }
}

/* De tegenhanger: iets tijdelijk AANBOUWEN aan een bestaand bestand. Sommige
   meters lezen een bestand dat er al is (LAT.md) of een module die de server
   echt moet ophangen, en dan helpt een nieuw bestand niet. Terugzetten gebeurt
   uit de tekst die we vooraf lazen, precies zoals bij package.json: dan blijft
   de opmaak byte voor byte zoals hij was. */
function metAanbouw(relPad, extra, doe) {
  const vol = path.join(WORTEL, relPad);
  assert.equal(fs.existsSync(vol), true, 'de ijking bouwt alleen aan iets dat bestaat: ' + relPad);
  const oud = fs.readFileSync(vol, 'utf8');
  try { fs.writeFileSync(vol, oud + extra); return doe(); }
  finally { fs.writeFileSync(vol, oud); }
}

/* WAAROM DE ROUTE-IJKING AAN klok.js HANGT EN NIET IN EEN LOSS BESTAND STAAT.

   Eerst probeerde ik server/routes/zz-ijk-tijdelijk.js, want dat werkt voor
   routesNietSchakelbaar en keuringStuk. Er bewoog niets: 622 met en 622 zonder.
   De reden is dat server/routes/ NIET automatisch geladen wordt -- server.js
   heeft een uitgeschreven lijst van require('./routes/...'), dus een nieuw
   bestand hangt er wel, maar niemand roept het aan. De twee ijkingen die wel
   werkten, werken omdat ze de BRONTEKST scannen; deze twee vragen om routes die
   de draaiende server echt registreert (scripts/routekaart.js start hem).

   Dus bouwen we aan een bestaande, altijd gemounte routemodule. De aanbouw
   raakt de body niet: hij pakt de bestaande export in.

   HONDERD ROUTES EN NIET EEN. endpointsZonderTest slaat al bij een uit, maar
   dekkingPct is een AFGEROND percentage over ruim tweeduizend routes -- een
   enkele erbij verdwijnt in de afronding, precies zoals bij
   dekkingWaargenomenPct. Met honderd zakt hij zichtbaar. Dat is geen ruimere
   proef maar dezelfde eigenschap, twee keer aangetoond.

   HET PAD MAG HIER NERGENS LETTERLIJK STAAN. scripts/keuring.js noemt een route
   gedekt zodra zijn pad ergens in de code van een testbestand voorkomt -- dit
   bestand is er daar een van. Stond het pad hieronder voluit, dan telde de
   keuring de ijkroutes als getest en bewoog de meter niet. Vandaar het plakwerk. */
const IJKSTAM = '/api/' + 'zzijk' + 'proef/';
let _routeGat = null;
function metIjkRoutes(voor) {
  if (_routeGat) return _routeGat;
  let extra = '\n/* tijdelijke ijk-aanbouw */\nconst _ijkOrig = module.exports;\n' +
    'module.exports = (kern) => {\n  _ijkOrig(kern);\n';
  for (let i = 0; i < 100; i++) {
    extra += "  kern.app.post('" + IJKSTAM + 'n' + i + "', (req, res) => res.json({ ok: true }));\n";
  }
  extra += '};\n';
  const na = metAanbouw('server/routes/klok.js', extra, () => norm.meet());
  _routeGat = { zonderTest: na.endpointsZonderTest - voor.endpointsZonderTest,
    pctVal: voor.dekkingPct - na.dekkingPct };
  return _routeGat;
}

/* Een journaal met alle routes op een na, en wat scripts/dekking.js daarvan
   maakt. Eenmaal gemeten en daarna bewaard: de routekaart starten kost een
   halve minuut en beide journaalmeters hebben aan dezelfde meting genoeg. */
const _gaten = new Map();
function journaalMetGat(weglaten) {
  const n = weglaten || 1;
  if (_gaten.has(n)) return _gaten.get(n);
  const os = require('os');
  const { execFileSync, spawnSync } = require('child_process');
  const kaart = JSON.parse(execFileSync(process.execPath,
    ['--experimental-sqlite', path.join(WORTEL, 'scripts', 'routekaart.js'), '--json'],
    { cwd: WORTEL, encoding: 'utf8', timeout: 300000, maxBuffer: 64 * 1024 * 1024 }));
  const routes = (kaart.routes || []).filter(r => r && r.pad && r.pad.startsWith('/api/'));
  assert.ok(routes.length > 100, 'de routekaart geeft routes (' + routes.length + ')');

  const map = fs.mkdtempSync(path.join(os.tmpdir(), 'rtg-ijk-journaal-'));
  const bestand = path.join(map, 'journaal.txt');
  try {
    // alles behalve de laatste n; die horen straks als "nooit aangeraakt" te tellen
    const regels = routes.slice(0, routes.length - n).map(r => (r.methode || 'POST').toUpperCase() + ' ' + r.pad);
    fs.writeFileSync(bestand, regels.join('\n') + '\n');
    const r = spawnSync(process.execPath,
      ['--experimental-sqlite', path.join(WORTEL, 'scripts', 'dekking.js'), '--lees', bestand, '--json'],
      { cwd: WORTEL, encoding: 'utf8', timeout: 300000, maxBuffer: 64 * 1024 * 1024 });
    let d = null;
    try { d = JSON.parse(r.stdout); } catch (e) { d = null; }
    assert.ok(d, 'dekking.js gaf een leesbaar rapport: ' +
      String(r.stderr || r.stdout || '').trim().split('\n').slice(0, 3).join(' | ').slice(0, 240));
    const uit = { nooit: Number(d.nooitAangeraakt), pct: Number(d.pct), totaal: routes.length };
    assert.ok(Number.isFinite(uit.nooit) && Number.isFinite(uit.pct),
      'dekking.js gaf de twee cijfers terug: ' + JSON.stringify(d).slice(0, 160));
    _gaten.set(n, uit);
    return uit;
  } finally { try { fs.rmSync(map, { recursive: true, force: true }); } catch (e) {} }
}

/* De registratie. Elke meter uit scripts/norm.js staat hier, met OF een
   proef die hem laat uitslaan, OF een reden waarom dat in een toets niet
   kan. scripts/check.js regel 35 bewaakt dat die lijst compleet blijft. */
const IJKINGEN = {
  testbestanden: {
    proef: (voor) => metTijdelijkBestand('test/zz-ijk-tijdelijk.test.js',
      "const test = require('node:test');\ntest('ijk', () => {});\n",
      () => norm.meet().testbestanden - voor.testbestanden)
  },
  e2eBestanden: {
    proef: (voor) => metTijdelijkBestand('test/zz-ijk-tijdelijk.e2e.js',
      "const test = require('node:test');\ntest('ijk', () => {});\n",
      () => norm.meet().e2eBestanden - voor.e2eBestanden)
  },
  zelfpoortendeToetsen: {
    // een toets die zichzelf overslaat MOET meetellen; de vorm met een
    // ternair, want juist die vorm werd hier ooit verkeerd geteld
    proef: (voor) => metTijdelijkBestand('test/zz-ijk-tijdelijk.test.js',
      "const test = require('node:test');\nconst aan = false;\n" +
      "test('ijk', { skip: aan ? false : 'geen dienst' }, () => {});\n",
      () => norm.meet().zelfpoortendeToetsen - voor.zelfpoortendeToetsen)
  },
  browserpoortToetsen: {
    /* DE TWEEDE HELFT VAN DEZELFDE TELLING, en de proef staat er vooral om de
       GRENS te bewijzen: dezelfde skip-regel hoort in een *.e2e.js in de
       browserbak te vallen en in een *.test.js in de dienstbak. Zonder deze
       proef zou een verschuiving van die grens ongemerkt de ene meter leeghalen
       en de andere vullen -- en dan ratelt er niets meer. */
    proef: () => {
      const regel = "test('ijk', { skip: pw ? false : 'geen browser' }, () => {});";
      const alsE2e = norm.telSkips(['x.e2e.js'], () => regel);
      const alsToets = norm.telSkips(['x.test.js'], () => regel);
      assert.deepEqual(alsE2e, { dienst: 0, browser: 1 }, 'in een *.e2e.js telt hij als browsergepoort');
      assert.deepEqual(alsToets, { dienst: 1, browser: 0 }, 'in een *.test.js als dienstgepoort');
      // en skip: false is geen poort maar een open deur
      assert.deepEqual(norm.telSkips(['y.e2e.js'], () => "test('x', { skip: false }, () => {});"),
        { dienst: 0, browser: 0 }, 'skip: false telt niet mee');
      return alsE2e.browser;
    }
  },
  keuringOmvang: {
    // een productbestand vlak onder de 10 kB-grens hoort opgemerkt te worden
    proef: (voor) => metTijdelijkBestand('server/kern/zz-ijk-tijdelijk.js',
      '/* ijkbestand */\n' + 'const x = "' + 'y'.repeat(9900) + '";\nmodule.exports = { x };\n',
      () => norm.meet().keuringOmvang - voor.keuringOmvang)
  },
  keuringTeGroot: {
    /* HETZELFDE BESTAND, MAAR DAN ECHT TE GROOT. En dat is niet zomaar een
       tweede proef: tot vandaag zou deze ijking NIETS hebben gemeten, want de
       omvangregel keek alleen naar de band 9400-10240 en liet alles erboven
       lopen. Een bestand van twaalf kilobyte was voor de keuring onzichtbaar,
       net als server/server.js van tweehonderdtwaalf.

       De twee proeven staan bewust naast elkaar: samen laten ze zien dat de
       grens nu aan BEIDE kanten iets zegt, en dat de ene telling niet in de
       andere wegvalt. */
    proef: (voor) => metTijdelijkBestand('server/kern/zz-ijk-tijdelijk.js',
      '/* ijkbestand */\n' + 'const x = "' + 'y'.repeat(12000) + '";\nmodule.exports = { x };\n',
      () => norm.meet().keuringTeGroot - voor.keuringTeGroot)
  },
  inlineStijlAttributen: {
    /* DE RATEL OP DE LAATSTE unsafe-inline. Twee kanten geijkt, want dit getal
       moet twee dingen goed doen: tellen wat de CSP openhoudt, en NIET tellen
       wat er niets mee te maken heeft.

       Een style="..."-attribuut valt onder style-src-attr en telt dus mee. Een
       CSSOM-schrijfactie (el.style.kleur = '...') gaat buiten de ontleder om,
       wordt door CSP niet gecontroleerd, en is juist de UITWEG -- die mag het
       getal niet omhoog duwen, anders straft de meter de oplossing af.

       De proef voert de teller een verzonnen bestand, zodat hij niet afhangt
       van wat er toevallig in public/ staat. */
    proef: () => {
      const drie = '<div style="a"><p style="b"></p><span style="c"></span></div>';
      const geen = "el.style.kleur = 'rood'; el.style.breedte = '3px';";
      const met = norm.telInlineStijl(() => drie, ['verzonnen.html']);
      const zonder = norm.telInlineStijl(() => geen, ['verzonnen.js']);
      assert.equal(met, 3, 'drie attributen worden er drie geteld');
      assert.equal(zonder, 0, 'CSSOM-schrijfacties tellen niet mee -- dat is de uitweg, geen schuld');
      return met - zonder;
    }
  },

  dependencies: {
    /* De enige meter waarvan de bron een bestand is dat we ook echt even
       veranderen. Terugzetten gebeurt uit de tekst die we vooraf lazen, niet
       uit een herbouwd object: dan blijft de opmaak exact zoals hij was. */
    proef: (voor) => {
      const p = path.join(WORTEL, 'package.json');
      const oud = fs.readFileSync(p, 'utf8');
      try {
        const j = JSON.parse(oud);
        j.dependencies = Object.assign({}, j.dependencies, { 'zz-ijk-tijdelijk': '^1.0.0' });
        fs.writeFileSync(p, JSON.stringify(j, null, 2) + '\n');
        return norm.meet().dependencies - voor.dependencies;
      } finally { fs.writeFileSync(p, oud); }
    }
  },
  schermenZonderToets: {
    /* De meter achter LAT-regel 2 voor de schermkant: "af" is pas af als een
       toets de hele weg heeft afgelegd. Het journaal komt uit een echte
       e2e-ronde en is hier niet te maken, maar de INVENTARIS wel -- en dat is
       precies de kant waarlangs een nieuw scherm binnenkomt: iemand zet een
       app neer, niemand opent hem, en het getal hoort meteen op te lopen. */
    proef: () => {
      const schermen = require('../scripts/schermen.js');

      /* Eerst de scherpte van de meter zelf: een scherm dat ALLEEN door een
         veegtoets is aangeraakt mag niet als getoetst tellen. Dat is precies
         waar de eerste versie van deze meter op stukliep -- hij gaf 188 van
         188 omdat leven.e2e.js alles even aantikt. */
      const veegJournaal = new Map();
      for (let i = 0; i < 50; i++) veegJournaal.set('/apps/z' + i + '.html', new Set(['leven.e2e.js']));
      veegJournaal.get('/apps/z0.html').add('eigen.e2e.js');
      const vegers = schermen.veegToetsen(veegJournaal, 50);
      assert.ok(vegers.has('leven.e2e.js'), 'een toets die alle schermen aantikt geldt als veegtoets');
      assert.ok(!vegers.has('eigen.e2e.js'), 'een toets die er een aantikt geldt niet als veegtoets');

      /* En dan de inventaris: een NIEUW scherm dat niemand opent hoort meteen
         mee te tellen. Dat is de kant waarlangs dit gat in de praktijk groeit:
         iemand zet een app neer en niemand komt er ooit. */
      const journaal = new Set(schermen.alleSchermen());        // alsof alles geopend is
      const tel = () => schermen.alleSchermen().filter(s => !journaal.has(s)).length;
      const voor = tel();
      assert.equal(voor, 0, 'met een journaal dat alles bevat staat de meter op nul');
      return metTijdelijkBestand('public/apps/zz-ijk-tijdelijk.html',
        '<!doctype html>\n<title>ijk</title>\n', () => tel() - voor);
    }
  },
  metersOngeijkt: {
    /* De meter die de ongeijkte meters telt, moet zelf uitslaan -- anders
       bewaakt een ongeijkte meter het ijken. Hij krijgt twee verzonnen
       registraties: in de ene draagt een ECHTE metersleutel een reden, in de
       andere dezelfde sleutel een proef. Het verschil hoort exact 1 te zijn.
       Geen norm.meet() nodig, en dat is geen luiheid: telOngeijkt() neemt zijn
       bron als invoer juist zodat deze ijking kan bestaan. */
    proef: () => {
      const bouw = (regel) => 'const IJKINGEN = {\n  ' + regel + '\n};\n';
      const met = norm.telOngeijkt(bouw("p99Ms: { reden: 'prestatiecijfer uit een echte beproeving' }"));
      const zonder = norm.telOngeijkt(bouw('p99Ms: { proef: 1 }'));
      assert.equal(met, 1, 'een verzonnen registratie met een reden telt er precies een');
      assert.equal(zonder, 0, 'dezelfde registratie met een proef telt er nul');
      /* En een sleutel die GEEN meter is telt niet mee, hoe hard hij ook
         "reden" roept: anders zou de meter zijn eigen commentaar meetellen. */
      assert.equal(norm.telOngeijkt(bouw("zzGeenMeter: { reden: 'lang genoeg om een reden te lijken' }")), 0,
        'een sleutel die in norm.js geen meter is, telt niet mee');
      return met - zonder;
    }
  },

  endpointsZonderTest: {
    /* HONDERD ROUTES DIE NERGENS IN EEN TOETS VOORKOMEN. De reden die hier
       stond ("dat is een repo-brede staat, geen invoer die je in een toets
       neerzet") klopte niet, en de manier waarop hij niet klopte is leerzaam:
       een tijdelijk bestand in server/routes/ bewoog de meter inderdaad niet,
       maar niet omdat de meter repo-breed is -- server.js laadt die map niet
       automatisch. Zie de uitleg bij metIjkRoutes(). */
    proef: (voor) => metIjkRoutes(voor).zonderTest
  },
  dekkingPct: {
    /* Dezelfde aanbouw, en hij laat meteen zien hoe grof dit cijfer is: bij
       2533 routes verdwijnt een handvol ongedekte endpoints in de afronding.
       Precies de reden dat endpointsZonderTest ernaast staat als de scherpe
       van de twee -- net als bij het paar in het routejournaal. */
    proef: (voor) => metIjkRoutes(voor).pctVal
  },
  keuringStuk: {
    /* Een route die een ECHTE naam meestuurt in zijn antwoord. Dat is de
       zwaarste bevinding die de keuring kent, en niet toevallig: dit huis
       draait op codenamen en de echte naam hoort in de kluis. De proef zet
       precies dat neer -- en meet daarmee ook dat de keuring die vorm nog
       herkent. */
    proef: (voor) => metTijdelijkBestand('server/routes/zz-ijk-tijdelijk.js',
      'module.exports = (kern) => {\n' +
      '  const { app } = kern;\n' +
      '  app.post(\'/api/zz-ijk/proef\', (req, res) => res.json({ realName: \'Jan Jansen\' }));\n' +
      '};\n',
      () => norm.meet().keuringStuk - voor.keuringStuk)
  },
  keuringScheef: {
    /* Een tekst die zegt dat een boeking bevestigd is. Dat mag dit huis nooit
       beweren (CLAUDE.md), en de keuring hoort die zin te vinden waar hij ook
       staat. */
    proef: (voor) => metTijdelijkBestand('server/kern/zz-ijk-tijdelijk.js',
      /* De zin moet in een STRING staan en niet in losse HTML-tekst: de keuring
         kijkt naar wat een gebruiker echt te zien krijgt, en dat is tekst
         tussen aanhalingstekens op een regel die geen commentaar is. Een eerste
         poging met een <p> in een htmlbestand sloeg daarom niet aan -- de
         reden hier stond ("zelfde soort bron als keuringStuk") was te vaag om
         dat te zien. */
      '/* tijdelijk ijkbestand */\n' +
      'module.exports = () => ({ melding: \'Uw boeking is bevestigd en staat klaar.\' });\n',
      () => norm.meet().keuringScheef - voor.keuringScheef)
  },
  keuringDubbeling: {
    /* DRIE KERNMODULES MET DEZELFDE FUNCTIENAAM. De reden die hier stond
       ("dat is een verplaatsing van productcode") ging uit van een verplaatsing,
       terwijl de keuring alleen telt hoe vaak een naam voorkomt: drie tijdelijke
       bestandjes doen precies hetzelfde. Drie en niet twee, want de keuring zegt
       zelf dat twee keer toeval kan zijn en drie keer een patroon. */
    proef: (voor) => {
      const paden = ['a', 'b', 'c'].map(x => 'server/kern/zz-ijk-tijdelijk-' + x + '.js');
      const inhoud = '/* tijdelijk ijkbestand */\n' +
        'function zzIjkTijdelijkeNaam(x) { return x; }\n' +
        'module.exports = { zzIjkTijdelijkeNaam };\n';
      const ga = (i) => i === paden.length
        ? norm.meet().keuringDubbeling - voor.keuringDubbeling
        : metTijdelijkBestand(paden[i], inhoud, () => ga(i + 1));
      return ga(0);
    }
  },

  /* Hieronder: meters die je in een toets niet eerlijk kunt voeden. De reden
     staat erbij en telt mee in `metersOngeijkt`, die alleen omlaag mag. */
  keuringDekkingAdvies: { reden: 'zit op zijn plafond: scripts/keuring.js meldt met .slice(0, 8) hooguit acht domeinen en er zijn er acht, dus omhoog kan hij niet en omlaag alleen door echte gaten te dichten' },
  routesNietSchakelbaar: {
    /* Een route die nergens in het schakelbord staat. Dat is precies wat deze
       meter telt, en het blijkt met een tijdelijk routebestand gewoon te
       voeden -- de reden die hier stond ("die moet je echt monteren") klopte
       niet.

       WAAROM DIT WERKT EN endpointsZonderTest NIET. Hier stond eerst als
       verklaring "server/routes/ wordt automatisch geladen", en dat is gewoon
       onwaar: server.js heeft een uitgeschreven lijst van require-regels, dus
       dit bestand wordt nooit aangeroepen. Deze meter en keuringStuk lezen de
       BRONTEKST en zien het bestand daarom toch. De meters die een DRAAIENDE
       server aflezen zien het niet, en dat kostte een halve middag omdat de
       verklaring hier plausibel klonk. Een reden die niet klopt is net zo
       schadelijk als een meter die niet uitslaat. */
    proef: (voor) => metTijdelijkBestand('server/routes/zz-ijk-tijdelijk.js',
      'module.exports = (kern) => {\n' +
      '  const { app } = kern;\n' +
      '  app.post(\'/api/zz-ijk/proef\', (req, res) => res.json({ ok: true }));\n' +
      '};\n',
      () => norm.meet().routesNietSchakelbaar - voor.routesNietSchakelbaar)
  },
  onbewaakt: {
    /* EEN REGEL IN LAT.md ZONDER HANDHAVER. De reden die hier stond ("gaat over
       soorten dingen en niet over een enkel bestand") klopte voor de helft van
       de tabel: bij schermen, app-delen en API-routes is `bewaakt` een simpele
       bestaat-de-bewaker-nog vraag, en die beweegt inderdaad voor geen enkel
       tijdelijk bestand -- drie pogingen daartoe deden niets. Maar twee soorten
       kijken wel degelijk per ding: de meters in NORM.json en de regels in
       LAT.md.

       Die laatste is de eerlijkste om te voeden, want hij gaat over precies dit
       onderwerp: LAT.md eist dat elke regel zijn eigen handhaver noemt, en een
       regel zonder die zin is een voornemen. Zet er zo een neer, en de census
       hoort hem te zien.

       En let op WELK getal er gemeten wordt: samenhang.totaalOnbewaakt() is
       dezelfde optelling die het script op het scherm zet en in NORM.json
       vastlegt. Een eigen sommetje hier zou zijn eigen sommetje ijken. */
    proef: () => {
      const samenhang = require('../scripts/samenhang.js');
      const tel = () => samenhang.totaalOnbewaakt(samenhang.meet());
      const voor = tel();
      return metAanbouw('LAT.md',
        '\n### 99. Een tijdelijke ijkregel, met opzet zonder handhaver\n\n' +
        'Staat hier alleen tijdens test/meterijk.test.js.\n',
        () => tel() - voor);
    }
  },
  endpointsNooitAangeraakt: {
    /* HET JOURNAAL MET EEN GAT ERIN. De reden die hier stond ("komt uit het
       routejournaal van een hele testronde") klopte half: het cijfer komt
       daaruit, maar scripts/dekking.js leest met --lees elk journaal dat je
       hem geeft. Dus bouwen we er zelf een: alle routes van de routekaart,
       precies EEN weggelaten. De meter hoort die ene te missen.

       Een kleiner journaal kan niet: dekking.js weigert er zelf een met te
       weinig patronen, met de melding dat dat geen meting is maar een kapotte
       opstelling. Dat is dezelfde LAT-regel 3 die deze ijking bewaakt, en het
       is precies goed dat hij hier in de weg zit. */
    proef: () => journaalMetGat(1).nooit
  },
  dekkingWaargenomenPct: {
    /* HET PERCENTAGE IS GROVER DAN ZIJN BUURMAN, en dat is hier zwart op wit te
       zien: met EEN weggelaten route van ruim tweeduizend rondt hij nog gewoon
       op honderd af. Precies wat de kop van scripts/dekking.js waarschuwt --
       "een afgerond percentage dekt bij 2530 routes tot een stuk of twaalf
       endpoints die nooit zijn aangeraakt". Deze proef laat er daarom vijftig
       weg. Dat hij dan pas uitslaat is geen tekortkoming van de ijking maar de
       eigenschap van de meter, en de reden dat endpointsNooitAangeraakt
       ernaast staat als de scherpe van de twee. */
    proef: () => 100 - journaalMetGat(50).pct
  },
  /* DE ZES PRESTATIEMETERS. Hier stond bij alle zes een reden: "prestatiecijfer
     uit een echte beproeving op een echte machine". Dat leek onvermijdelijk --
     je kunt een p99 van 144 ms niet naspelen in een toets zonder de machine te
     vervalsen.

     Maar dat is niet wat een ijking vraagt. De vraag is niet "kun je dit cijfer
     namaken" maar "SLAAT DEZE METER UIT ALS ZIJN INVOER FOUT IS". En de invoer
     is een BESTAND: leesPrestatie() neemt zijn pad als parameter, met in
     scripts/norm.js de opmerking erbij dat dat er staat "zodat een toets hem
     echt kan beproeven". Die uitnodiging stond er maanden; hij is nooit
     aangenomen.

     Elke proef hieronder voedt hem een verzonnen BEPROEVING.json en kijkt of
     het cijfer meekomt, EN of een GEZAKTE ronde geen norm oplevert. Dat tweede
     is de scherpste: cijfers van een run die zijn eigen drempels niet haalde,
     zijn geen lat om aan vast te houden -- en een meter die ze toch overneemt,
     legt een slechte dag vast als de nieuwe standaard. */
  /* DE ZES STAAN UITGESCHREVEN, en dat is geen slordigheid. Ze stonden eerst
     als `...prestatieIjkingen()` -- korter, maar scripts/check.js LEEST deze
     registratie als tekst en kon de sleutels dan niet vinden. Terecht: een
     registratie waarvan je moet uitvoeren om te weten wat erin staat, is voor
     wie hem naleest geen registratie. De proef zelf staat wel op EEN plek. */
  p99Ms: { proef: () => prestatieIjking('p99Ms') },
  doorvoerPerSec: { proef: () => prestatieIjking('doorvoerPerSec') },
  eventLoopP99Ms: { proef: () => prestatieIjking('eventLoopP99Ms') },
  herstelSeconden: { proef: () => prestatieIjking('herstelSeconden') },
  verhalenSlaagPctStorm: { proef: () => prestatieIjking('verhalenSlaagPctStorm') },
  geheugenHellingMBPerMin: { proef: () => prestatieIjking('geheugenHellingMBPerMin') }
};

/* De proef achter alle zes. Ze verschillen alleen in hun sleutel, dus staat de
   inhoud op EEN plek -- zes kopieen zijn zes kansen om er een te vergeten bij
   te werken. */
function prestatieIjking(sleutel) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'rtg-prestatie-ijk-'));
  const pad = path.join(dir, 'BEPROEVING.json');
  const schrijf = (oordeel, waarde) => fs.writeFileSync(pad, JSON.stringify({
    oordeel, gezakteDrempels: oordeel === 'PASS' ? 0 : 2, gedraaid: '2026-01-01T00:00:00.000Z',
    machine: { cpus: 4, geheugenGB: 17, platform: 'linux' }, opslag: 'sqlite',
    meters: { [sleutel]: waarde } }));
  try {
    // 1. een geslaagde ronde levert het cijfer dat erin staat
    schrijf('PASS', 4242);
    const goed = norm.leesPrestatie(pad);
    assert.ok(goed.cijfers, 'een geslaagde beproeving levert cijfers: ' + goed.reden);
    assert.equal(goed.cijfers[sleutel], 4242, 'de meter leest wat er in het bestand staat');
    assert.ok(goed.bron, 'en zegt op welke machine het gemeten is');

    // 2. een GEZAKTE ronde levert er GEEN, met de reden erbij
    schrijf('FAIL', 4242);
    const slecht = norm.leesPrestatie(pad);
    assert.ok(!slecht.cijfers, 'een gezakte beproeving levert geen norm');
    assert.match(slecht.reden, /GEZAKT/);

    // 3. een onleesbaar of ontbrekend bestand zegt WAT er mis is
    fs.writeFileSync(pad, 'geen json');
    assert.match(norm.leesPrestatie(pad).reden, /onleesbaar/);
    fs.rmSync(pad);
    assert.match(norm.leesPrestatie(pad).reden, /ontbreekt/);
    return 1;   // alle drie de foute invoeren zijn gezien
  } finally { try { fs.rmSync(dir, { recursive: true, force: true }); } catch (e) {} }
}

test('elke geijkte meter slaat echt uit op een bekend-foute invoer', () => {
  const voor = norm.meet();
  const geijkt = Object.keys(IJKINGEN).filter(k => IJKINGEN[k].proef);
  assert.ok(geijkt.length >= 5, 'er zijn ijkingen om te draaien (' + geijkt.length + ')');

  for (const sleutel of geijkt) {
    const verschil = IJKINGEN[sleutel].proef(voor);
    assert.ok(verschil > 0,
      'meter "' + sleutel + '" zag de bekend-foute invoer NIET (verschil ' + verschil + '). ' +
      'Een meter die niet uitslaat op iets wat fout is, meet niets.');
  }
});

test('de ijking ruimt zichzelf op: geen enkel spoor blijft achter', () => {
  for (const naam of ['test/zz-ijk-tijdelijk.test.js', 'test/zz-ijk-tijdelijk.e2e.js',
    'server/kern/zz-ijk-tijdelijk.js', 'public/apps/zz-ijk-tijdelijk.html',
    'server/kern/zz-ijk-tijdelijk-a.js', 'server/kern/zz-ijk-tijdelijk-b.js',
    'server/kern/zz-ijk-tijdelijk-c.js']) {
    assert.equal(fs.existsSync(path.join(WORTEL, naam)), false, naam + ' is blijven staan');
  }
  const pkg = JSON.parse(fs.readFileSync(path.join(WORTEL, 'package.json'), 'utf8'));
  assert.equal(Object.keys(pkg.dependencies || {}).length, 0, 'package.json heeft weer nul dependencies');

  /* DE TWEE AANBOUWEN ZIJN GEVAARLIJKER DAN DE LOSSE BESTANDEN, want een
     achtergebleven bestand valt op en een achtergebleven regel in een bestaand
     bestand niet. Een ijkroute die in productie blijft hangen is een open
     endpoint; een ijkregel in LAT.md is een regel die niemand geschreven heeft.
     Vandaar dat ze hier apart genoemd worden en niet op bestaan maar op INHOUD
     gecontroleerd. */
  const klok = fs.readFileSync(path.join(WORTEL, 'server/routes/klok.js'), 'utf8');
  assert.equal(klok.includes('_ijkOrig'), false, 'server/routes/klok.js draagt nog een ijk-aanbouw');
  assert.equal(klok.includes(IJKSTAM), false, 'server/routes/klok.js draagt nog ijkroutes');
  const lat = fs.readFileSync(path.join(WORTEL, 'LAT.md'), 'utf8');
  assert.equal(/^### 99\./m.test(lat), false, 'LAT.md draagt nog de tijdelijke ijkregel');
});

test('elke meter met een norm staat in de registratie', () => {
  const bron = fs.readFileSync(path.join(WORTEL, 'scripts/norm.js'), 'utf8');
  const sleutels = [...bron.matchAll(/sleutel:\s*'([a-zA-Z0-9]+)'/g)].map(m => m[1]);
  /* Niet elke meter woont in norm.js: wie een journaal nodig heeft (dekking,
     schermen, samenhang) meet in een eigen script met zijn sleutel in een
     METER-constante. Die stonden hier eerst buiten, en juist zo glipt een
     ongeijkte meter erdoor. Zelfde vindwijze als check.js regel 35. */
  for (const b of fs.readdirSync(path.join(WORTEL, 'scripts')).filter(f => f.endsWith('.js') && f !== 'norm.js')) {
    const s = fs.readFileSync(path.join(WORTEL, 'scripts', b), 'utf8');
    for (const m of s.matchAll(/^const METER[A-Z_]*\s*=\s*'([a-zA-Z0-9]+)'/gm)) {
      if (!sleutels.includes(m[1])) sleutels.push(m[1]);
    }
  }
  assert.ok(sleutels.length >= 15, 'de meters zijn gevonden (' + sleutels.length + ')');
  const ontbreekt = sleutels.filter(s => !IJKINGEN[s]);
  assert.deepEqual(ontbreekt, [],
    'deze meters hebben geen ijking en geen reden: ' + ontbreekt.join(', ') +
    '. Voeg een proef toe, of een reden waarom die niet kan.');
});

test('elke registratie heeft OF een proef OF een reden, nooit allebei leeg', () => {
  for (const [sleutel, ijk] of Object.entries(IJKINGEN)) {
    assert.ok(ijk.proef || ijk.reden, 'meter "' + sleutel + '" heeft niets');
    assert.ok(!(ijk.proef && ijk.reden), 'meter "' + sleutel + '" heeft er twee; kies');
    if (ijk.reden) assert.ok(ijk.reden.length > 25,
      'de reden bij "' + sleutel + '" is te kort om iets uit te leggen');
  }
});

module.exports = { IJKINGEN };
