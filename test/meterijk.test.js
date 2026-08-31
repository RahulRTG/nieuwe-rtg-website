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

   Draai los: node --test test/meterijk.test.js */
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const os = require('os');
const path = require('path');

const WORTEL = path.join(__dirname, '..');
// Los gestart pakt deze bronmuterende ijking zelf het afbouwslot. Via de
// testrunner bezit de ouder dat slot al en geeft hij dit expliciet door.
if (process.env.RTG_AFBOUW_SLOT_ACTIEF !== '1') require('../scripts/afbouw-slot').pak('meterijking');

/* EERST DE RESTEN VAN EEN AFGEBROKEN IJKING OPRUIMEN.

   Het opruimen hieronder staat in een `finally`, en dat is genoeg voor een
   proef die zakt. Het is NIET genoeg voor een proces dat wordt afgeschoten:
   SIGKILL slaat elke finally over, en dan blijft er een bestand liggen.

   Waarom dat erger is dan het klinkt. Deze bestanden staan in .gitignore, dus
   `git status` zwijgt erover en ze overleven elke checkout. Een achtergebleven
   public/apps/zz-ijk-tijdelijk.html is voor de rest van de suite gewoon een
   NIEUW scherm: bereikbaar, i18n-auto en de app-gids gaan er alle drie op
   zakken, en de meterijking zelf weigert met "overschrijft nooit een bestaand
   bestand". Vier rode toetsen die niets met de code te maken hebben -- en die
   op ELKE branch even rood zijn, dus ook een meting "stond dit al rood op
   main?" komt verkeerd uit. Precies dat is hier gebeurd.

   Wegruimen kan hier zonder risico, en alleen hier: `zz-ijk-tijdelijk` is een
   GERESERVEERD voorvoegsel. Er kan per definitie niets echts onder liggen, en
   wat er wel ligt is per definitie afval van een eerdere ijking. De weigering
   hieronder blijft staan voor alles wat die naam niet draagt. */
(function ruimResten() {
  const MAPPEN = ['', 'public/apps', 'server/kern', 'server/routes', 'test'];
  const resten = [];
  for (const map of MAPPEN) {
    const vol = path.join(WORTEL, map);
    let namen = [];
    try { namen = fs.readdirSync(vol); } catch (e) { continue; }
    for (const naam of namen) {
      if (!naam.startsWith('zz-ijk-tijdelijk')) continue;
      try { fs.rmSync(path.join(vol, naam), { recursive: true, force: true }); resten.push(path.join(map, naam)); }
      catch (e) { /* niet te verwijderen: dan zakt de proef zo meteen alsnog, met de naam erbij */ }
    }
  }
  /* Hardop, en niet stil. Een opruiming die niemand ziet, verbergt dat er een
     ijking is afgebroken -- en dat is zelf informatie (LAT-regel 5). */
  if (resten.length) {
    process.stderr.write('[meterijk] resten van een afgebroken ijking opgeruimd: ' + resten.join(', ') + '\n');
  }
})();
const norm = require('../scripts/norm.js');
const deuren = require('../scripts/deuren');
const VERBOSE = process.env.RTG_METERIJK_VERBOSE === '1';
const meld = (tekst) => { if (VERBOSE) process.stderr.write('[meterijk] ' + tekst + '\n'); };

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
   enkele erbij verdwijnt in de afronding. Met honderd zakt hij zichtbaar. Dat
   is geen ruimere proef maar dezelfde eigenschap, twee keer aangetoond.

   Hier stond "precies zoals bij dekkingWaargenomenPct", en dat is sinds de
   dekkingsronde niet meer waar: die rondt naar BENEDEN af en slaat wel bij een
   uit (zie zijn ijking onderaan). dekkingPct doet dat nog niet -- dus staat de
   grofheid nu bij de meter die hem heeft, en niet meer bij twee.

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
    pctVal: voor.dekkingPct - na.dekkingPct,
    /* De honderd ijkroutes zitten onder /api/zzijkproef/, dus ze vormen een NIEUW
       domein met gaten. keuringDekkingAdvies hoort daarmee precies een omhoog te
       gaan -- en dat kon pas sinds die meter het echte aantal leest in plaats van
       de acht meldingen die het rapport toont. */
    dekkingAdvies: na.keuringDekkingAdvies - voor.keuringDekkingAdvies };
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
    [path.join(WORTEL, 'scripts', 'routekaart.js'), '--json'],
    { cwd: WORTEL, encoding: 'utf8', timeout: 300000, maxBuffer: 64 * 1024 * 1024 }));
  /* EEN ROUTE IS EEN METHODE PLUS EEN PATROON, en het journaal noteert hem ook
     zo. Hier stond `(r.methode || 'POST')`, en dat veld bestaat niet in de JSON
     van routekaart.js -- daar heet het `methoden` en is het een lijst. Elke
     regel kreeg dus POST, ook de vijfenzeventig GET-routes. Zolang de meting op
     PADEN telde viel dat niet op; sinds ze op methode+pad telt zou het journaal
     vijfenzeventig valse gaten opleveren en zou deze ijking meten hoe kapot
     hijzelf is. Ook het /api/-filter is weg: de meting kent dat onderscheid
     niet meer, en een ijking die een deelverzameling voedt ijkt de helft. */
  const routes = [];
  for (const r of (kaart.routes || [])) {
    if (!r || !r.pad) continue;
    for (const mth of (r.methoden || [])) routes.push({ pad: r.pad, methode: String(mth).toUpperCase() });
  }
  assert.ok(routes.length > 100, 'de routekaart geeft routes (' + routes.length + ')');

  const map = fs.mkdtempSync(path.join(os.tmpdir(), 'rtg-ijk-journaal-'));
  const bestand = path.join(map, 'journaal.txt');
  try {
    // alles behalve de laatste n; die horen straks als "nooit aangeraakt" te tellen
    const regels = routes.slice(0, routes.length - n).map(r => r.methode + ' ' + r.pad);
    fs.writeFileSync(bestand, regels.join('\n') + '\n');
    const r = spawnSync(process.execPath,
      [path.join(WORTEL, 'scripts', 'dekking.js'), '--lees', bestand, '--json'],
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
  bewijsCellenBewezen: {
    /* De 100%-tand op het bewijs zelf. De teller krijgt een nep-register
       gevoerd (zelfde snit als telSkips): eerst een matrix met zeven bewezen
       cellen, dan een zonder telling, dan een die geen JSON is. De laatste
       twee horen te GOOIEN en niet nul te geven -- een register dat wegvalt is
       een gezakte meting, en nul zou hier de allerslechtste stand belonen. */
    proef: () => {
      const schuld = JSON.stringify({ telling: { meetwerk: 0, instrument: 0, grens: 9 } });
      const lees = (matrixTekst) => (naam) =>
        naam === 'BEWIJSMATRIX.json' ? matrixTekst : schuld;
      const uit = norm.telBewijslaag(lees(JSON.stringify({ telling: { bewezen: 7 } })));
      assert.equal(uit.bewijsCellenBewezen, 7, 'zeven bewezen cellen worden er zeven geteld');
      assert.throws(() => norm.telBewijslaag(lees(JSON.stringify({ telling: {} }))),
        /bewijsCellenBewezen niet gemeten/, 'een matrix zonder telling is een gezakte meting, geen nul');
      assert.throws(() => norm.telBewijslaag(lees('{ kapot')),
        /BEWIJSMATRIX\.json is niet leesbaar/, 'een onleesbare matrix is een gezakte meting, geen nul');
      return uit.bewijsCellenBewezen;
    }
  },
  bewijsAchterstand: {
    /* De andere kant van dezelfde tand: meetwerk en instrument tellen mee,
       de soort `grens` niet -- die sluit nooit en is geen achterstand. Telde
       hij wel mee, dan zou de ratel eeuwig 586 punten eisen die per definitie
       niet te leveren zijn, en dan draait iemand hem stilletjes los. */
    proef: () => {
      const matrix = JSON.stringify({ telling: { bewezen: 1 } });
      const lees = (schuldTekst) => (naam) =>
        naam === 'BEWIJSMATRIX.json' ? matrix : schuldTekst;
      const uit = norm.telBewijslaag(lees(JSON.stringify({ telling: { meetwerk: 3, instrument: 4, grens: 500 } })));
      assert.equal(uit.bewijsAchterstand, 7, 'meetwerk en instrument tellen; de grens van 500 niet');
      assert.throws(() => norm.telBewijslaag(lees(JSON.stringify({ telling: { meetwerk: 3 } }))),
        /bewijsAchterstand niet gemeten/, 'een schuldregister zonder instrument-telling is een gezakte meting');
      assert.throws(() => norm.telBewijslaag(lees('nee')),
        /BEWIJSSCHULD\.json is niet leesbaar/, 'een onleesbaar schuldregister is een gezakte meting, geen nul');
      return uit.bewijsAchterstand;
    }
  },
  /* DE TWEE DEURMETERS, EN WAAROM ER MAAR EEN VAN ZE norm.meet() AANROEPT.

     dbDeuren telt de bestanden buiten server/db/ die db.data rechtstreeks
     aanraken; dbDeurenSchrijvend het deel daarvan dat er ook IN schrijft. Ze
     staan los omdat lezen en schrijven verschillende dingen bepalen -- een
     schrijver bepaalt of de invarianten van een domein kloppen, een lezer of je
     de opslag kunt vervangen.

     Twee losse meters zijn alleen strakker als de ZEEF ze ook echt uit elkaar
     houdt. Zou hij elk db.data-bestand als schrijver tellen, dan bewegen beide
     proeven netjes omhoog en ziet de ijking niets. Daarom kijkt elke proef ook
     naar de ANDERE meter.

     DE KOSTEN. norm.meet() doet de hele ronde en duurt minuten. Twee proeven die
     hem allebei aanroepen kosten dat twee keer, bij elke draai van de suite, voor
     altijd. Dat is niet gratis en het levert hier niets extra's op: beide meters
     komen in scripts/norm.js uit EEN aanroep van deuren.meet(). Dus roept
     dbDeurenSchrijvend hem aan -- en die controleert meteen dat norm.js BEIDE
     velden uit die ene meting overneemt, wat een verwisseling zou vangen die twee
     losse aanroepen juist niet vangen. dbDeuren meet daarna nog alleen de zeef.

     Dat is een bewuste ruil en geen bezuiniging: wat er wordt bewezen is groter
     geworden, en de rekening kleiner. */
  dbDeuren: {
    proef: (voor) => metTijdelijkBestand('server/kern/zz-ijk-tijdelijk-deur.js',
      "'use strict';\n" +
      '/* ijking: raakt db.data alleen LEZEND aan */\n' +
      'module.exports = (db) => (db.data.leden || []).length;\n',
      () => {
        const na = deuren.meet();
        assert.equal(na.schrijvendeDeuren - voor.dbDeurenSchrijvend, 0,
          'een bestand dat db.data alleen LEEST mag de schrijvende meter niet bewegen; ' +
          'doet hij dat wel, dan meten de twee meters hetzelfde en is de splitsing schijn');
        return na.deuren - voor.dbDeuren;
      })
  },
  dbDeurenSchrijvend: {
    proef: (voor) => metTijdelijkBestand('server/kern/zz-ijk-tijdelijk-schrijf.js',
      "'use strict';\n" +
      '/* ijking: schrijft rechtstreeks IN db.data, langs de datalaag heen */\n' +
      'module.exports = (db) => { db.data.zzIjkTeller = (db.data.zzIjkTeller || 0) + 1; };\n',
      () => {
        const na = norm.meet();
        assert.equal(na.dbDeuren - voor.dbDeuren, 1,
          'een schrijver is ook een deur en hoort in BEIDE meters te tellen');
        /* De bedrading, voor allebei: norm.js hoort deze twee velden uit dezelfde
           meting over te nemen. Een verwisseling (dbDeurenSchrijvend gevuld met
           het deurental) overleeft de assert hierboven wel en deze niet. */
        const rechtstreeks = deuren.meet();
        assert.equal(na.dbDeuren, rechtstreeks.deuren, 'norm.js geeft dbDeuren door uit deuren.meet()');
        assert.equal(na.dbDeurenSchrijvend, rechtstreeks.schrijvendeDeuren,
          'norm.js geeft dbDeurenSchrijvend door uit deuren.meet(), en niet per ongeluk het deurental');
        return na.dbDeurenSchrijvend - voor.dbDeurenSchrijvend;
      })
  },
  testbestanden: {
    proef: (voor) => metTijdelijkBestand('test/zz-ijk-tijdelijk.test.js',
      "const test = require('node:test');\ntest('ijk', () => {});\n",
      () => norm.meet().testbestanden - voor.testbestanden)
  },
  schermenZonderVormtaal: {
    /* TWEE KANTEN, want een meter die maar EEN kant beweegt zegt de helft. Een
       pagina ZONDER de tokenlaag hoort de teller te laten stijgen, en dezelfde
       pagina MET de tokenlaag hoort hem te laten staan. Zonder die tweede helft
       zou een meter die simpelweg alle html-bestanden telt, ook slagen -- en
       dan meet hij het bestaan van pagina's in plaats van de adoptie. */
    proef: (voor) => {
      const zonder = metTijdelijkBestand('public/apps/zz-ijk-tijdelijk.html',
        '<!doctype html><html lang="nl"><head><title>ijk</title></head><body></body></html>\n',
        () => norm.meet().schermenZonderVormtaal - voor.schermenZonderVormtaal);
      assert.equal(zonder, 1, 'een pagina zonder de tokenlaag telt mee als gat');
      const met = metTijdelijkBestand('public/apps/zz-ijk-tijdelijk.html',
        '<!doctype html><html lang="nl"><head><link href="/shared/rtg-ontwerp.css" rel="stylesheet">' +
        '</head><body></body></html>\n',
        () => norm.meet().schermenZonderVormtaal - voor.schermenZonderVormtaal);
      assert.equal(met, 0, 'dezelfde pagina MET de tokenlaag telt niet mee');
      return zonder;
    }
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
      /* EN DE WRINGER. Een attribuut dat alleen in COMMENTAAR staat, houdt geen
         style-src-attr open: de ontleder ziet het nooit. Telde de meter het wel,
         dan strafte hij het OPSCHRIJVEN van de regel af -- de val van LAT.md
         regel 10, hier voor de vierde keer. De proef zet beide vormen in een
         bestand, zodat hij ook zakt als de wringer te gulzig wordt en het echte
         attribuut meeneemt. */
      const gemengd = '/* geen style="x" hier */\nconst h = \'<i style="b"></i>\'; // ook geen style="y"';
      assert.equal(norm.telInlineStijl(() => gemengd, ['verzonnen2.js']), 1,
        'alleen het echte attribuut telt; die in commentaar niet');
      return met - zonder;
    }
  },

  bronBlindeBestanden: {
    /* DE MUTATIE IS HIER DE HISTORISCHE FOUT ZELF, in het klein nagebouwd.

       Deze meter kruist scripts/lib/bron.js met scripts/ast/lexer.js: elke token
       die de lexer ziet is code en hoort dus nog in de gestripte uitvoer te
       staan. De proef zet een bestand neer met de vorm die op 17 augustus 2026
       224.031 tekens broncode opat -- een MIME-joker in een string, met verderop
       een gewoon commentaar dat de opener sluit -- en draait er twee
       verwijderaars overheen: die van vandaag, en die van voor de reparatie.

       Wat dit bewijst is niet dat de teller draait maar dat hij ZIET: dezelfde
       bron, nul ongedekt met de gerepareerde verwijderaar en een met de kapotte.
       Zou de kruisproef ooit stomp worden gemaakt, dan zakt deze regel.

       Het gebeurt in een tijdelijke map en niet in de boom zelf: een ijking die
       een blind bestand in server/ achterlaat, laat elke andere meting van deze
       ronde meebewegen. */
    proef: () => {
      const { meetBlind } = require('../scripts/lib/bronblind');
      const kapot = (b) => String(b)
        .replace(/\/\*[\s\S]*?\*\//g, ' ')
        .replace(/(^|[^:'"\\])\/\/[^\n]*/g, '$1');
      const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'rtg-bronblind-'));
      try {
        fs.mkdirSync(path.join(dir, 'server'));
        fs.writeFileSync(path.join(dir, 'server', 'ijk.js'),
          "const a = 'image/*';\n/* een gewoon commentaar */\nmodule.exports = { a };\n");
        const schoon = meetBlind({ wortel: dir, mappen: ['server'] });
        assert.equal(schoon.bestanden, 1, 'de proef heeft echt een bestand gelezen');
        assert.equal(schoon.ongedekt, 0, 'met de gerepareerde verwijderaar raakt er niets kwijt');
        const blind = meetBlind({ wortel: dir, mappen: ['server'], strip: kapot });
        assert.equal(blind.ongedekt, 1, 'met de verwijderaar van voor 17 augustus is dit bestand blind');
        assert.match(blind.lijst[0].eerste, /image/,
          'en het eerste dat kwijtraakt is de MIME-joker: precies de vorm van toen');
        /* De lexfout telt mee als ongedekt, en dat hoort ook geijkt: een bestand
           dat de tweede mening niet kan lezen is geen bestand zonder bevindingen,
           het is een bestand waar niet naar gekeken is (LAT.md regel 10). */
        /* EEN LEXFOUT IS IETS ANDERS DAN EEN PARSEFOUT, en hier stond eerst het
           verkeerde: `const = = = ;`. Dat is onzin voor een parser, maar een
           LEXER tokeniseert het probleemloos -- `const`, drie gelijktekens, een
           puntkomma, allemaal geldige tokens. Deze ijking zakte daarop, en dat
           is precies waarvoor hij bestaat: hij mat niet wat hij beweerde te
           meten. Een niet-afgesloten string breekt de lexer wel echt. */
        fs.writeFileSync(path.join(dir, 'server', 'stuk.js'), "const a = 'nooit gesloten\n");
        const metStuk = meetBlind({ wortel: dir, mappen: ['server'] });
        assert.equal(metStuk.lexfout, 1, 'onleesbare bron telt als lexfout');
        assert.equal(metStuk.ongedekt, 1, 'en een lexfout telt mee in de meter, niet als stille nul');

        /* EN DE HTML-WEG, want die telt sinds 19 augustus mee in dezelfde meter.
           Een pagina met een MIME-joker in de markup en een scriptblok erachter:
           de kapotte verwijderaar eet vanaf die joker vooruit en raakt het script
           kwijt, de gerepareerde niet. Dat is in het klein wat er op 17 augustus
           over acht pagina's gebeurde. */
        fs.rmSync(path.join(dir, 'server', 'stuk.js'));
        fs.mkdirSync(path.join(dir, 'public'));
        fs.writeFileSync(path.join(dir, 'public', 'ijk.html'),
          '<input type="file" accept="image/*">\n' +
          '<script>\nconst telefoon = 1;\n/* een gewoon commentaar */\nconst blijft = 2;\n</scr' + 'ipt>\n');
        const paginaSchoon = meetBlind({ wortel: dir, mappen: ['public'] });
        assert.equal(paginaSchoon.bestanden, 1, 'de pagina is echt gelezen');
        assert.equal(paginaSchoon.ongedekt, 0, 'met de gerepareerde verwijderaar blijft het script heel');
        const paginaBlind = meetBlind({ wortel: dir, mappen: ['public'], strip: kapot });
        assert.equal(paginaBlind.ongedekt, 1, 'met die van voor 17 augustus raakt de pagina bron kwijt');

        return blind.ongedekt - schoon.ongedekt + paginaBlind.ongedekt;
      } finally { try { fs.rmSync(dir, { recursive: true, force: true }); } catch (e) {} }
    }
  },

  delenZonderOnderwerp: {
    /* GEIJKT OP DE ZEEF EN NIET OP DE BOOM, en dat is hier een keuze met een
       reden. De proef van bronBlindeBestanden hierboven zet zijn foute invoer in
       een TIJDELIJKE map; dat kan hier niet, want een bundeldeel telt alleen mee
       als het in public/ staat -- en een verzonnen deel in public/ zou meteen
       test/bundeldelen.test.js laten zakken (de bundel is dan niet meer de som
       van zijn delen). Een ijking die een andere toets sloopt om zichzelf te
       bewijzen, is de kwaal erger dan de kwaal.

       Dus toetst deze proef de zeef in beide richtingen -- ziet hij een deel MET
       onderwerp, en ziet hij er een ZONDER -- plus dat de meter over de echte
       boom een getal geeft dat leeft. Zonder die laatste regel zou een zeef die
       nergens meer wordt aangeroepen hier gewoon groen blijven. */
    proef: () => {
      const { onderwerpVan } = require('../scripts/lib/bundeldeel');
      const met = onderwerpVan('/* de contactpin: je eigen code, als tekst en als QR */\ncode();');
      assert.equal(met, 'de contactpin: je eigen code, als tekst en als QR', 'een onderwerp wordt gezien');
      assert.equal(onderwerpVan('  const x = 1;\n  /* pas hieronder een uitleg die lang genoeg is */'), null,
        'een deel dat met code begint draagt geen onderwerpregel');
      assert.equal(onderwerpVan('/* deel 4b */\ncode();'), null, 'zeven letters is geen onderwerp');

      const { delenVan } = require('../scripts/deelindex');
      const { bundels } = require('../scripts/bundel');
      const delen = Object.values(bundels).flatMap(m => delenVan(m));
      assert.ok(delen.length > 300, 'de teller leest echt de delen (' + delen.length + ')');
      const kaal = delen.filter(d => !d.onderwerp).length;
      assert.ok(delen.some(d => d.onderwerp), 'en hij vindt er ook mét onderwerp -- anders zegt de telling niets');
      return kaal + 1;   // gezien: de zeef slaat uit op alle drie de invoeren
    }
  },

  /* DE DRIE GRENSMETERS. Geijkt op een VERZONNEN bron en niet op de repo: de
     teller krijgt een stukje code te lezen dat ik zelf schrijf, dus ik weet het
     antwoord vooraf. Een meter die alleen zijn eigen routemap kan lezen, is niet
     te ijken -- dan meet je of hij draait en niet of hij ziet. */
  kernBreedte: {
    proef: () => {
      const grenzen = require('../scripts/grenzen');
      const een = grenzen.bereikVan('module.exports = (kern) => { const { app, db, save } = kern; };');
      assert.deepEqual([...een].sort(), ['app', 'db', 'save'], 'een destructurering wordt geteld');
      const twee = grenzen.bereikVan('module.exports = (kern) => { kern.app.get("/x", () => kern.db); };');
      assert.deepEqual([...twee].sort(), ['app', 'db'], 'losse kern.x-toegang ook');
      /* En de wringer: een naam die alleen in COMMENTAAR of in een TEKENREEKS
         staat, telt niet mee. Precies deze fout zat al drie keer in een meter
         van dit huis. */
      const drie = grenzen.bereikVan('/* kern.geheim */ const s = "kern.ooknietecht";\nmodule.exports = (kern) => { const { app } = kern; };');
      assert.deepEqual([...drie], ['app'], 'commentaar en tekst tellen niet mee: ' + [...drie].join(','));
      return een.size;
    }
  },
  kernGedeeld: {
    /* Twee verzonnen domeinen die EEN naam delen. Dat is het hele begrip: een
       eigenschap die meer dan een domein aanraakt is koppeling; een die maar
       een domein aanraakt hoort in dat domein. */
    proef: () => {
      const grenzen = require('../scripts/grenzen');
      const a = grenzen.bereikVan('const { app, eigenA } = kern;');
      const b = grenzen.bereikVan('const { app, eigenB } = kern;');
      const samen = new Map();
      for (const [d, set] of [['a', a], ['b', b]]) for (const n of set) {
        if (!samen.has(n)) samen.set(n, new Set());
        samen.get(n).add(d);
      }
      const gedeeld = [...samen.entries()].filter(([, ds]) => ds.size > 1).map(([n]) => n);
      assert.deepEqual(gedeeld, ['app'], 'alleen de gedeelde naam telt als koppeling');
      return gedeeld.length;
    }
  },
  kernBreedsteBestand: {
    proef: () => {
      const grenzen = require('../scripts/grenzen');
      const namen = Array.from({ length: 42 }, (_, i) => 'n' + i);
      const breed = grenzen.bereikVan('const { ' + namen.join(', ') + ' } = kern;');
      assert.equal(breed.size, 42, 'een breed bestand wordt op zijn volle breedte geteld');
      const smal = grenzen.bereikVan('const { app } = kern;');
      assert.equal(smal.size, 1, 'en een smal bestand op een');
      return breed.size - smal.size;
    }
  },
  kernOngebruikt: {
    /* De scherpste van de vier, en de enige die een ECHTE fout aanwijst in plaats
       van een maat: een naam die een bestand uit de kern pakt en nooit gebruikt.
       Drie beweringen, en de derde is degene die telt. */
    proef: () => {
      const grenzen = require('../scripts/grenzen');
      const dood = grenzen.pakVsGebruik('const { app, db, save } = kern;\napp.get("/x", () => 1);');
      assert.deepEqual(dood.ongebruikt.sort(), ['db', 'save'],
        'gepakt en niet gebruikt: db en save; app wordt wel gebruikt');

      /* Een naam achter een PUNT is geen gebruik van die naam. Zonder deze
         controle zou `req.save` de naam `save` levend houden en zag de meter
         niets. */
      /* DE SPREAD, en deze bewering staat hier omdat het echt is misgegaan. De
         eerste versie van deze meter sloeg een naam over als er een punt voor
         stond -- `req.save` is geen gebruik van `save`. Maar in
         `{ ...publicSupplier(s) }` staat er ook een punt voor de naam. Dus heette
         publicSupplier ongebruikt, is hij in server/routes/supplier/menukaart.js
         weggehaald, en gaf /api/supplier/menu/get een 500 met "publicSupplier is
         not defined". test/allergie.test.js vond het; deze meter had het moeten
         vinden. Zonder de regel hieronder bijt niets. */
      const spread = grenzen.pakVsGebruik('const { publicSupplier } = kern;\nres.json({ ...publicSupplier(s) });');
      assert.deepEqual(spread.ongebruikt, [],
        'een naam achter de spread-punten is WEL gebruikt: ' + spread.ongebruikt.join(','));

      /* En de prijs van die reparatie, hier vastgelegd zodat niemand hem voor
         scherpte aanziet: de meter kent geen punt-logica meer, dus `req.save`
         houdt `save` in leven terwijl niemand hem gebruikt. Over server/routes
         kost dat 13 van de 3924 namen. Wie deze meter ooit "slimmer" wil maken,
         leest eerst de regel hierboven. */
      const punt = grenzen.pakVsGebruik('const { save } = kern;\nfoo(req.save);');
      assert.deepEqual(punt.ongebruikt, [],
        'req.save houdt save in leven -- bewust te ruim, zie de spread hierboven');

      /* EN DE KANT DIE HET GEVAARLIJKST IS. Een naam die alleen binnen een
         template-string staat MOET als gebruikt gelden: wie hem op grond van
         deze meter weghaalt, bouwt een ReferenceError die pas bij het eerste
         verzoek valt. Deze bewering is de reden dat pakVsGebruik een eigen,
         mildere wringer heeft dan de rest van scripts/grenzen.js. */
      const sjabloon = grenzen.pakVsGebruik('const { naam } = kern;\nconst t = `hallo ${naam}`;');
      assert.deepEqual(sjabloon.ongebruikt, [],
        'een naam in ${...} binnen een template geldt als gebruikt');

      const rename = grenzen.pakVsGebruik('const { a: b, c: d } = kern;\nb();');
      assert.deepEqual(rename.ongebruikt, ['d'], 'bij { a: b } gaat het om de gebonden naam');
      return dood.ongebruikt.length;
    }
  },

  /* DE TWEE MUTATIEMETERS. Hun bron is MUTATIES.json, de uitslag van
     scripts/mutatie.js. We zetten er kortstondig een verzonnen uitslag in en
     kijken of het getal meebeweegt -- dezelfde vorm als de dependencies-proef
     hieronder, en om dezelfde reden: een meter die zijn eigen bestand niet echt
     leest, meet of hij draait en niet of hij ziet. */
  /* GEEN SCHRIJFACTIE MEER OP HET ECHTE MUTATIES.json, en dat is een reparatie.

     Deze twee proeven zetten de verzonnen uitslag eerst IN het echte bestand en
     schreven het in een finally terug. Twee dingen konden daar misgaan: een
     `git add -A` in dat venster commit een uitslag waarin toetsen "overleefd"
     staan, en een kill in dat venster laat de finally niet lopen -- dan is de
     campagne van 540 toetsen weg en vervangen door iets dat op een meting lijkt.
     Beide zijn in dit huis al gebeurd (eerlijkheidspunt 6.4 en, deze sessie,
     server/lokaal-tls.js dat gemuteerd bleef staan na een kill).

     norm.meet() neemt nu een LEZER aan. De verzonnen uitslag gaat er als tekst
     in, dus de meter doet nog steeds alles zelf: lezen, parsen, tellen. Wat er
     niet meer gebeurt, is op schijf schrijven -- en dus is er ook niets meer om
     terug te zetten of te verliezen. */
  toetsenOngevoeligPct: {
    proef: (voor) => {
      const j = JSON.parse(fs.readFileSync(path.join(WORTEL, 'MUTATIES.json'), 'utf8'));
      /* Drie BESTAANDE toetsbestanden op "overleefd" zetten, want de meter loopt
         de echte testmap af; een verzonnen naam zou hij terecht negeren. Drie en
         niet een, omdat het een percentage is: bij zestig metingen schuift een
         enkele overlever het getal met 1,6 procentpunt en dat kan door afronding
         net onder de zichtbaarheid blijven. */
      const namen = fs.readdirSync(path.join(WORTEL, 'test'))
        .filter(n => n.endsWith('.test.js')).sort().slice(0, 3);
      for (const naam of namen) j.toetsen[naam] = { soort: 'puur', staat: 'overleefd' };
      const na = norm.meet({ leesMutaties: () => JSON.stringify(j) });
      return na.toetsenOngevoeligPct - voor.toetsenOngevoeligPct;
    }
  },
  toetsenNietGemeten: {
    proef: (voor) => {
      const j = JSON.parse(fs.readFileSync(path.join(WORTEL, 'MUTATIES.json'), 'utf8'));
      /* Een gemeten toets uit de uitslag halen: dan is hij niet gemeten, en
         hoort het getal precies een omhoog te gaan. Slaat deze proef af, dan
         telt de meter iets anders dan wat er in het bestand staat. */
      const gemeten = Object.keys(j.toetsen).filter(k => j.toetsen[k].staat === 'gezakt' || j.toetsen[k].staat === 'overleefd');
      if (!gemeten.length) throw new Error('MUTATIES.json bevat geen enkele gemeten toets, dus deze ijking kan niets aanwijzen');
      delete j.toetsen[gemeten[0]];
      const na = norm.meet({ leesMutaties: () => JSON.stringify(j) });
      return na.toetsenNietGemeten - voor.toetsenNietGemeten;
    }
  },
  beweringenZonderVulcontrole: {
    /* De derde voorraad (scripts/tandeloos.js). De meting zelf staat daar; deze
       proef vraagt of de meter hem ECHT overneemt en niet ergens een eigen getal
       vasthoudt. Een verzonnen telling gaat er als functie in -- dezelfde naad
       als `leesMutaties` hierboven, en om dezelfde reden: er wordt niets op
       schijf veranderd, dus er is ook niets terug te zetten of te verliezen. */
    proef: (voor) => {
      const echt = require('../scripts/tandeloos').meet({ stil: true });
      if (!echt.bekeken) throw new Error('tandeloos.js keek naar nul beweringen; dan wijst deze ijking niets aan');
      const na = norm.meet({ meetTandeloos: () => ({ ...echt, meldingen: echt.meldingen + 1 }) });
      return na.beweringenZonderVulcontrole - voor.beweringenZonderVulcontrole;
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
  devPakketten: {
    /* Dezelfde proef aan de andere kant van de scheiding. Die twee stonden op
       een hoop tot playwright er als devDependency bij kwam om 114 stille
       schermtoetsen echt te laten draaien: een verbetering die als
       verslechtering binnenkwam. Deze proef bewaakt dat de scheiding ook echt
       een scheiding IS -- een dev-pakket hoort dit getal te bewegen en het
       runtime-getal niet. */
    proef: (voor) => {
      const p = path.join(WORTEL, 'package.json');
      const oud = fs.readFileSync(p, 'utf8');
      try {
        const j = JSON.parse(oud);
        j.devDependencies = Object.assign({}, j.devDependencies, { 'zz-ijk-dev': '^1.0.0' });
        fs.writeFileSync(p, JSON.stringify(j, null, 2) + '\n');
        const na = norm.meet();
        assert.equal(na.dependencies, voor.dependencies,
          'een dev-pakket hoort de RUNTIME-meter met rust te laten, anders is de scheiding er alleen op papier');
        return na.devPakketten - voor.devPakketten;
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

      /* EN DAN DE HELE METER, VAN JOURNAALREGEL TOT GETAL.

         Hier stond een eigen sommetje (`alleSchermen().filter(s => !journaal
         .has(s))`), en dat ijkte zijn eigen aftrekking: de meter werd nooit
         aangeroepen. De opvolger riep wel zonderEigenToets() aan, maar voerde
         er een met de hand gebouwde Map in -- daarmee bleef de PARSER buiten
         de ijking, en juist daar zit het onderscheid waar deze meter sinds
         deze ronde om draait. Gemeten met een mutatie in
         scripts/schermen.js (`const doel = afgelegd;`, oftewel: een
         voorophaling telt weer als bezoek): de meteruitkomst verschoof
         42 -> 43 en geen enkele toets zakte. Daarom leest deze ijking nu een
         ECHT journaalbestand, in de vorm die de server schrijft.

         Het proefjournaal is met opzet zo gebouwd dat alle drie de clausules
         van zonderEigenToets() eraan hangen, en niet alleen `!t`:
           - alle schermen op een na hebben hun eigen navigatie -> tellen niet;
           - leven.e2e.js tikt ALLES aan en is dus een veegtoets, zodat het
             eerste scherm alleen een veeg heeft -> telt WEL mee (de veeg-
             clausule; haal je die weg, dan zakt de proef);
           - datzelfde eerste scherm is bovendien VOOROPGEHAALD -> dat mag er
             geen bezoek van maken (de parser-clausule; laat je nevenverzoek
             weer als navigatie tellen, dan zakt de proef).
         Zo hangt het getal aan de meter zelf en niet aan een sommetje
         ernaast (LAT-regel 10). */
      const alle = schermen.alleSchermen();
      const regels = [];
      for (const [i, s] of alle.entries()) {
        regels.push('SCHERM ' + s + ' leven.e2e.js navigatie');
        if (i > 0) regels.push('SCHERM ' + s + ' eigen' + i + '.e2e.js navigatie');
      }
      regels.push('SCHERM ' + alle[0] + ' voorop.e2e.js nevenverzoek');
      const ijkmap = fs.mkdtempSync(path.join(os.tmpdir(), 'rtg-schermijk-'));
      try {
        const pad = path.join(ijkmap, 'schermjournaal');
        fs.writeFileSync(pad, regels.join('\n') + '\n');
        const journaal = schermen.geopendeSchermen(pad);
        assert.equal(journaal.zonderSoort, 0, 'de parser leest deze regels als volwaardig');
        const tel = () => schermen.zonderEigenToets(journaal.afgelegd, schermen.alleSchermen()).length;
        const voor = tel();
        assert.deepEqual(schermen.zonderEigenToets(journaal.afgelegd, alle), [alle[0]],
          'een scherm dat alleen een veeg en een voorophaling heeft, telt als ongetoetst');
        assert.equal(voor, 1, 'de rest heeft een eigen navigatie en telt dus niet mee');
        return metTijdelijkBestand('public/apps/zz-ijk-tijdelijk.html',
          '<!doctype html>\n<title>ijk</title>\n', () => tel() - voor);
      } finally { fs.rmSync(ijkmap, { recursive: true, force: true }); }
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
  /* HIER STOND EEN REDEN EN DAT WAS EEN GEBREK, geen reden. Er stond: "zit op zijn
     plafond -- keuring.js meldt met .slice(0, 8) hooguit acht domeinen en er zijn
     er acht". Dat is geen eigenschap van de dekking maar van het RAPPORT: de
     meter telde de meldingen, en die zijn afgekapt om leesbaar te blijven. Hij mat
     dus de slice. Nagemeten: er zijn 46 domeinen met endpoints zonder toets, niet
     acht.

     scripts/keuring.js geeft nu cijfers.dekking.domeinenMetGaten terug (alle
     domeinen) en scripts/norm.js leest dat. Daarmee KAN hij bewegen, en dus ook
     geijkt worden: de honderd ijkroutes hieronder vormen een nieuw domein zonder
     toets, en dan hoort dit getal precies een omhoog te gaan. */
  keuringDekkingAdvies: { proef: (voor) => metIjkRoutes(voor).dekkingAdvies },
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
  wettenOnbewezen: {
    /* EEN WET DIE NIEMAND OOIT HEEFT GEPROBEERD. Deze meter telt hoeveel
       systeemwetten uit WETTEN.json GEEN bewezen handhaver hebben -- alles wat
       niet `raak` is. Hij hoort dus omhoog te gaan zodra er een wet bij komt
       waarvoor niets is gemeten.

       DE PROEF GAAT OVER HET ECHTE BESTAND EN NIET OVER EEN VERZONNEN OBJECT.
       In test/wetten.test.js staat de rekenkant al (raak telt, afgeslagen en
       blind niet), en dat is een andere vraag. Hier moet blijken dat de meter
       ziet wat er op schijf gebeurt: een wet erbij in WETTEN.json en de teller
       hoort hem te vinden. Deed hij dat niet, dan kon iemand er tien wetten bij
       schrijven zonder dat de norm ooit bewoog.

       Het terugzetten gebeurt uit de TEKST die we vooraf lazen, byte voor byte,
       precies zoals metAanbouw dat doet -- een ijking die het wetboek anders
       opgemaakt achterlaat, is zelf de wijziging waar keuringsregel 41 op valt. */
    proef: () => {
      const wetboek = require('../scripts/lib/wetboek.js');
      const tel = () => { const { boek } = wetboek.lees(); return wetboek.onbewezen(boek, wetboek.leesUitslag()); };
      const voor = tel();
      const pad = path.join(WORTEL, 'WETTEN.json');
      const oud = fs.readFileSync(pad, 'utf8');
      try {
        const boek = JSON.parse(oud);
        boek.wetten.push({ id: 'zz-ijk-tijdelijk', soort: 'proef',
          wet: 'Een tijdelijke ijkwet die niemand ooit heeft geprobeerd.',
          bron: { bestand: 'LAT.md', anker: 'De lat' }, handhaver: [],
          mensenwerk: 'staat hier alleen tijdens test/meterijk.test.js' });
        fs.writeFileSync(pad, JSON.stringify(boek, null, 2) + '\n');
        return tel() - voor;
      } finally { fs.writeFileSync(pad, oud); }
    }
  },
  endpointsNooitAangeraakt: {
    /* HET JOURNAAL MET EEN GAT ERIN. De reden die hier stond ("komt uit het
       routejournaal van een hele testronde") klopte half: het cijfer komt
       daaruit, maar scripts/dekking.js leest met --lees elk journaal dat je
       hem geeft. Dus bouwen we er zelf een: alle routes van de routekaart --
       elke METHODE van elk pad, ook buiten /api/ -- precies EEN weggelaten. De
       meter hoort die ene te missen.

       Een kleiner journaal kan niet: dekking.js weigert er zelf een met te
       weinig patronen, met de melding dat dat geen meting is maar een kapotte
       opstelling. Dat is dezelfde LAT-regel 3 die deze ijking bewaakt, en het
       is precies goed dat hij hier in de weg zit. */
    proef: () => journaalMetGat(1).nooit
  },
  dekkingWaargenomenPct: {
    /* HET PERCENTAGE WAS GROVER DAN ZIJN BUURMAN, EN DAT IS GEREPAREERD.

       Hier stond dat deze meter met EEN weggelaten route van ruim tweeduizend
       nog gewoon op honderd afrondt, en daarom liet deze proef er vijftig weg.
       Dat was eerlijk opgeschreven en het bleef een meter die een gat kon
       verzwijgen -- precies wat de kop van scripts/dekking.js waarschuwde.

       Sinds kern/routedekking.js naar BENEDEN afrondt kan dat niet meer: één gat
       van 4189 geeft 99 en geen 100. De proef laat er daarom weer één weg, met
       hetzelfde journaal als zijn buurman (dus ook één routekaart-start in
       plaats van twee). Slaat hij daar niet op uit, dan is de afronding terug en
       is het cijfer weer op te poetsen. */
    proef: () => 100 - journaalMetGat(1).pct
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
  geheugenHellingMBPerMin: { proef: () => prestatieIjking('geheugenHellingMBPerMin') },

  /* DE TWEE METERS DIE OVER DE RATEL ZELF GAAN.

     Ze bewaken niet de code maar de dekking van de ratel, en juist daarom
     moeten ze zelf een proef hebben: een meter over meters die niet uitslaat,
     zou de indruk wekken dat de ratel meegroeit terwijl hij stilstaat. Dat is
     erger dan geen meter, want het is een geruststelling.

     `ratelTanden` telt de geratelde sleutels. De bekend-foute invoer is een
     script dat een NIEUWE meter declareert: dan hoort de telling mee te
     bewegen. Dat het langs een tijdelijk BESTAND in scripts/ gaat en niet langs
     een verzonnen lijst, is met opzet -- zo loopt de hele weg (de map lezen, de
     METER-constante herkennen, ontdubbelen, tellen) nog steeds door de meter,
     precies zoals bij de mutatiemeters hierboven. */
  ratelTanden: {
    proef: (voor) => metTijdelijkBestand('scripts/zz-ijk-tijdelijk.js',
      "'use strict';\nconst METER = 'zzIjkTand';\nmodule.exports = { METER };\n",
      () => norm.meet().ratelTanden - voor.ratelTanden)
  },

  /* `metingenZonderRatel` telt de meetbestanden in de wortel waar geen ratel
     achter staat. De bekend-foute invoer is dus een nieuw meetbestand dat in
     geen enkel register voorkomt: dat is per definitie een gat, en de meter
     hoort het te zien op het moment dat het ontstaat -- niet pas als iemand er
     over een half jaar overheen struikelt. */
  /* DE TWEE METERS VAN DE LADDER.

     Ze komen uit een ronde van vier minuten tegen een echte server, en die is
     hier niet na te spelen. Dezelfde situatie als bij de zes prestatiemeters
     hieronder, en dezelfde oplossing: niet het CIJFER namaken maar de meter een
     bekend-foute uitslag voeren en kijken of hij uitslaat. scripts/ladder.js
     zet zijn oordeel daarom apart in beoordeel().

     ladderNietGeprobeerd is de belangrijkste van de twee en de minst
     vanzelfsprekende. Nul bevindingen is triviaal te halen door niets meer te
     proberen -- en precies dat was hier gebeurd: de insider-trede voerde NUL
     proeven uit en meldde keurig geen enkele bevinding. Deze meter maakt van
     "minder proberen" een verslechtering. */
  /* DE TWEE METERS VAN DE ROLRONDE. Zelfde vorm en zelfde reden als bij de
     ladder hieronder: de ronde duurt minuten met een echte server, dus de ijking
     voedt niet de RONDE maar het OORDEEL een bekend-foute uitslag.

     rolscheidingGemeten is de minst vanzelfsprekende en de belangrijkste. Nul
     gaten is triviaal te halen door minder te onderzoeken, en precies dat was
     hier aan de hand: test/auth-rol.test.js beloofde "ELK leden-endpoint" en
     herkende er 1374 van de 1444, omdat een grendel in de body van de handler
     buiten zijn uitdrukking viel. Deze meter maakt van "minder beproeven" een
     verslechtering. */
  /* DE TWEE METERS VAN DE GLUURRONDE (de horizontale scheiding). Zelfde vorm
     als bij de ladder en de rolronde: het OORDEEL krijgt een bekend-foute
     uitslag, want de ronde zelf duurt minuten met twee echte leden.

     De ronde heeft daarnaast een eigen zelfproef (GLUUR_ZELFPROEF=1) die zijn
     vernielingscontrole aantoonbaar laat uitslaan; die draait in CI. Dat is er
     omdat drie pogingen om die controle met een opzettelijk gat te beproeven
     afsloegen op de OPSLAGVORM (bundelde notities), en een ijking die van de
     opslagvorm afhangt is geen ijking. */
  gluurGaten: {
    proef: () => {
      const g = require('../scripts/gluurronde.js');
      const norm = { gluurGaten: 0, gluurGecontroleerd: 2410 };
      assert.equal(g.beoordeel({ gaten: 0, gecontroleerd: 2410 }, norm).zakt, false, 'een schone ronde hoort niet te zakken');
      const stuk = g.beoordeel({ gaten: 1, gecontroleerd: 2410 }, norm);
      assert.equal(stuk.zakt, true, 'een lek tegen een norm van nul hoort te zakken');
      assert.match(stuk.redenen[0], /1 lek/);
      return 1;
    }
  },
  gluurGecontroleerd: {
    proef: () => {
      const g = require('../scripts/gluurronde.js');
      const blind = g.beoordeel({ gaten: 0, gecontroleerd: 400 }, { gluurGaten: 0, gluurGecontroleerd: 2410 });
      assert.equal(blind.zakt, true,
        'nul lekken over 400 nagekeken dingen terwijl het er 2410 waren, is geen schone ronde maar een blinde');
      assert.match(blind.redenen[0], /Minder nakijken is geen betere uitslag/);
      return 1;
    }
  },
  gluurOnbewaakt: {
    proef: () => {
      /* Een aanmaakroute waarvan het resultaat nergens te lezen is, is geen lek
         maar een blinde vlek: een schrijflek erop blijft onzichtbaar. De meter
         hoort dus uit te slaan op een ONVERKLAARDE blinde vlek, en niet op een
         ronde die er geen heeft. */
      const g = require('../scripts/gluurronde.js');
      const norm = { gluurGaten: 0, gluurGecontroleerd: 2417, gluurOnbewaakt: 0 };
      assert.equal(g.beoordeel({ gaten: 0, gecontroleerd: 2417, onbewaakt: 0 }, norm).zakt, false,
        'een ronde zonder onverklaarde blinde vlek hoort niet te zakken');
      const blind = g.beoordeel({ gaten: 0, gecontroleerd: 2417, onbewaakt: 1 }, norm);
      assert.equal(blind.zakt, true, 'een nieuwe aanmaakroute zonder lezer en zonder reden hoort te zakken');
      assert.match(blind.redenen[0], /zonder lezer en zonder reden/);
      return 1;
    }
  },
  rolscheidingGaten: {
    proef: () => {
      const rol = require('../scripts/rolronde.js');
      const norm = { rolscheidingGaten: 0, rolscheidingGemeten: 1444 };
      assert.equal(rol.beoordeel({ gaten: 0, gemeten: 1444 }, norm).zakt, false, 'een schone ronde hoort niet te zakken');
      const stuk = rol.beoordeel({ gaten: 2, gemeten: 1444 }, norm);
      assert.equal(stuk.zakt, true, 'twee gaten tegen een norm van nul hoort te zakken');
      assert.match(stuk.redenen[0], /2 gat\(en\)/);
      return 1;
    }
  },
  rolscheidingGemeten: {
    proef: () => {
      const rol = require('../scripts/rolronde.js');
      const norm = { rolscheidingGaten: 0, rolscheidingGemeten: 1444 };
      const blind = rol.beoordeel({ gaten: 0, gemeten: 900 }, norm);
      assert.equal(blind.zakt, true,
        'nul gaten over 900 endpoints terwijl er 1444 waren, is geen schone ronde maar een blinde');
      assert.match(blind.redenen[0], /Minder beproeven is geen betere uitslag/);
      return 1;
    }
  },
  ladderRaak: {
    proef: () => {
      const ladder = require('../scripts/ladder.js');
      const norm = { ladderRaak: 0, ladderNietGeprobeerd: 1 };
      assert.equal(ladder.beoordeel({ raak: 0, niet: 1 }, norm).zakt, false, 'een schone ronde hoort niet te zakken');
      const stuk = ladder.beoordeel({ raak: 3, niet: 1 }, norm);
      assert.equal(stuk.zakt, true, 'drie bevindingen tegen een norm van nul hoort te zakken');
      assert.match(stuk.redenen[0], /3 bevinding/);
      return 1;
    }
  },
  ladderNietGeprobeerd: {
    proef: () => {
      const ladder = require('../scripts/ladder.js');
      const norm = { ladderRaak: 0, ladderNietGeprobeerd: 1 };
      const stil = ladder.beoordeel({ raak: 0, niet: 9 }, norm);
      assert.equal(stil.zakt, true,
        'nul bevindingen bij negen overgeslagen proeven is geen schone ronde maar een blinde');
      assert.match(stil.redenen[0], /Minder proberen is geen betere uitslag/);
      return 1;
    }
  },
  metingenZonderRatel: {
    proef: (voor) => metTijdelijkBestand('zz-ijk-tijdelijk.json',
      '{ "uitleg": "verzonnen meting zonder ratel, alleen tijdens de ijking" }\n',
      () => norm.meet().metingenZonderRatel - voor.metingenZonderRatel)
  }
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

/* EEN EIGEN TIJDGRENS, EN WAAROM DIE HIER HOORT.

   Deze ene proef draait ELKE geijkte meter een keer op een geplante fout, en
   sommige van die meters lopen zelf het hele huis af. Gemeten op 31 augustus
   2026 in deze omgeving: 650 seconden. De testrunner geeft elk bestand
   standaard 600 (scripts/test-runner.js), dus in een volle lokale ronde werd
   deze proef AFGEBROKEN -- en een afgebroken ijking zegt niets, terwijl hij er
   in de samenvatting uitziet als "niet gezakt".

   De CI kende dit al: daar krijgt meterijk een eigen job met 45 minuten
   (.github/workflows/ci.yml). Wat hier stond was dus geen strengere eis maar een
   grens die per ongeluk van een ander bestand kwam. Veertig minuten is ruim
   boven de gemeten 650 seconden en nog steeds ruim onder de jobgrens, zodat een
   proef die werkelijk HANGT alsnog opvalt in plaats van een uur te blijven staan.

   Verlaag deze grens niet om een trage machine te dwingen; verhoog hem ook niet
   zonder de meting erbij te zetten. */
test('elke geijkte meter slaat echt uit op een bekend-foute invoer', { timeout: 40 * 60 * 1000 }, () => {
  const voor = norm.meet();
  const geijkt = Object.keys(IJKINGEN).filter(k => IJKINGEN[k].proef);
  assert.ok(geijkt.length >= 5, 'er zijn ijkingen om te draaien (' + geijkt.length + ')');

  /* EEN HERIJKING BIJ EEN MISSER, en waarom dat geen wegmoffelen is. In de
     volle CI-suite draaien honderden toetsen naast deze; de nulmeting
     ('voor') is dan een momentopname van een boom die onder je voeten kan
     bewegen. Een proef die tegen die verschoven nulmeting 0 meet, zegt
     niets over de meter -- alleen over de gelijktijdigheid. Bij een misser
     meten we daarom EERST een verse nul en proberen we een keer opnieuw:
     een echte regressie (de meter ziet de geplante fout niet) zakt ook
     tegen de verse nul; een verbouwing ernaast niet. En als het dan nog
     mis is, noemt de melding ALLE gezakte meters met hun verschillen --
     de vorige vorm stopte bij de eerste en de CI-samenvatting herhaalt
     alleen de toetsnaam, waardoor het echte detail onvindbaar bleef. */
  const missers = [];
  for (const sleutel of geijkt) {
    meld('start ' + sleutel);
    let verschil = IJKINGEN[sleutel].proef(voor);
    if (!(verschil > 0)) {
      const versNul = norm.meet();
      verschil = IJKINGEN[sleutel].proef(versNul);
      meld('herijking ' + sleutel + ' tegen een verse nulmeting: verschil ' + verschil);
    }
    meld('klaar ' + sleutel + ': verschil ' + verschil);
    if (!(verschil > 0)) missers.push(sleutel + ' (verschil ' + verschil + ')');
  }
  assert.deepEqual(missers, [],
    'meters die de bekend-foute invoer NIET zagen, ook niet tegen een verse nulmeting: ' +
    missers.join(', ') + '. Een meter die niet uitslaat op iets wat fout is, meet niets.');
});

test('de ijking ruimt zichzelf op: geen enkel spoor blijft achter', () => {
  for (const naam of ['test/zz-ijk-tijdelijk.test.js', 'test/zz-ijk-tijdelijk.e2e.js',
    'server/kern/zz-ijk-tijdelijk.js', 'public/apps/zz-ijk-tijdelijk.html',
    'scripts/zz-ijk-tijdelijk.js', 'zz-ijk-tijdelijk.json',
    'server/kern/zz-ijk-tijdelijk-a.js', 'server/kern/zz-ijk-tijdelijk-b.js',
    'server/kern/zz-ijk-tijdelijk-deur.js', 'server/kern/zz-ijk-tijdelijk-schrijf.js',
    'server/kern/zz-ijk-tijdelijk-c.js',
    /* DEZE ONTBRAK, EN HIJ IS DE GEVAARLIJKSTE VAN DE ZEVEN. Twee ijkingen
       (keuringStuk en endpointsZonderTest) zetten hier een route neer die een
       ECHTE naam teruggeeft, en server/routes wordt automatisch gemount: blijft
       hij staan, dan draait er een open endpoint dat de codenaamregel doorbreekt.
       Precies het geval dat de opmerking hieronder beschrijft -- en juist die
       stond niet in de lijst. Gevonden doordat hij op 19 augustus 2026 echt is
       blijven staan: de suite werd door een time-out gedood, de `finally` van
       metTijdelijkBestand kwam niet meer aan de beurt, en deze toets zag het
       niet omdat hij er niet naar keek. `npm run check` regel 28 vond hem wel,
       en dat is een vangnet en geen vervanging: die draait niet in elke ronde. */
    'server/routes/zz-ijk-tijdelijk.js']) {
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

test('een onbruikbaar MUTATIES.json laat de meter ZAKKEN en niet stil nul melden', () => {
  /* LAT.md regel 3: een meter zonder invoer die toch een getal geeft, is erger
     dan geen meter. Bij deze twee is nul de GEVAARLIJKE kant -- nul overlevers
     leest als een perfecte suite terwijl er niets is gemeten.

     Deze bewering bestond nog niet, en ze kon ook niet bestaan: het enige gat om
     het bestand onbruikbaar te maken was het echt overschrijven, en dat is precies
     wat hier is weggehaald. Met een injecteerbare lezer is het drie regels.

     Drie soorten onbruikbaar, want ze komen op drie plekken in de meter uit:
     onleesbaar (de lezer gooit), geen json, en geldige json zonder een enkele
     gemeten toets -- dat laatste is de stilste van de drie, want daar is er wel
     een bestand en klopt de vorm. */
  for (const [wat, lezer] of [
    ['onleesbaar', () => { throw new Error('ENOENT'); }],
    ['geen json', () => 'dit is geen json'],
    ['geen enkele meting', () => JSON.stringify({ toetsen: {} })],
    ['alleen niet-gemeten uitslagen', () => JSON.stringify({ toetsen: { 'a11ykeuring.test.js': { staat: 'geen module gevonden' } } })]
  ]) {
    assert.throws(() => norm.meet({ leesMutaties: lezer }), /MUTATIES\.json/,
      'met "' + wat + '" hoort norm.meet() te gooien in plaats van een getal te geven');
  }
});

test('DE TEGENPROEF: een BRUIKBARE lezer laat de meter gewoon meten', () => {
  /* Zonder deze zou de toets hierboven ook groen blijven als norm.meet() ALTIJD
     gooit, en dan bewijst hij dat een kapotte meter goed gebouwd is. */
  const echt = fs.readFileSync(path.join(WORTEL, 'MUTATIES.json'), 'utf8');
  const na = norm.meet({ leesMutaties: () => echt });
  assert.equal(typeof na.toetsenOngevoeligPct, 'number');
  assert.equal(na.toetsenNietGemeten, norm.meet().toetsenNietGemeten,
    'dezelfde inhoud via de lezer hoort hetzelfde getal te geven als van schijf');
});

module.exports = { IJKINGEN };
