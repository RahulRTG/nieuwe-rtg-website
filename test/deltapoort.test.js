/* DE IJKING VAN DE DELTAPOORT -- regel 2 van de lat, op de poort zelf.

   scripts/deltapoort.js houdt nieuw werk aan de norm. Een poort die nog nooit
   iemand heeft tegengehouden, is geen poort maar een geruststelling: hij draait,
   hij meldt groen, en niemand weet of dat groen iets betekent. Elke regel
   hieronder krijgt daarom een bekend-FOUTE wijziging voorgeschoteld en moet
   uitslaan -- en meteen erna een goede, want een regel die op alles uitslaat
   houdt net zo weinig tegen als een regel die op niets uitslaat.

   De vier uitkomsten uit LAT.md regel 2 gelden hier letterlijk: RAAK (de
   mutatie bijt) is wat elke proef hieronder eist, AFGESLAGEN zou een bevinding
   op zich zijn, en NIET GEPROBEERD bestaat niet -- er staat geen enkele skip in
   dit bestand.

   Draai los: node --test test/deltapoort.test.js */
'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const os = require('os');
const path = require('path');
const cp = require('child_process');

const POORT = path.join(__dirname, '..', 'scripts', 'deltapoort.js');
const { REGELS } = require('../scripts/deltapoort.js');
const regel = (naam) => {
  const r = REGELS.find(x => x.naam === naam);
  assert.ok(r, 'de regel "' + naam + '" bestaat niet meer; deze ijking wijst dan naar niets');
  return r;
};

/* ============================ 1. DE REGELS APART ==========================
   Elke regel is een functie van (pad, voor, na). `voor === null` betekent: dit
   bestand is nieuw, en dan geldt de volle norm. Beide latten worden hier
   getoond, want het verschil ertussen IS het mechanisme. */

test('inline-stijl: een NIEUW bestand mag er geen enkele hebben', () => {
  const r = regel('inline-stijl');
  const met = r.keur('public/apps/nieuw.html', null, '<div style="color:red">x</div>');
  assert.equal(met.length, 1, 'een nieuw bestand met een inline stijlattribuut moet uitslaan');
  assert.match(met[0].bericht, /nieuw bestand met 1/);
  const zonder = r.keur('public/apps/nieuw.html', null, '<div class="rood">x</div>');
  assert.equal(zonder.length, 0, 'zonder inline stijl mag hij niet uitslaan -- anders keurt hij alles af');
});

test('inline-stijl: een AANGERAAKT bestand mag zijn erfenis houden, maar niet vergroten', () => {
  const r = regel('inline-stijl');
  const erfenis = '<i style="a"></i><i style="b"></i>';
  assert.equal(r.keur('public/x.html', erfenis, erfenis).length, 0,
    'twee houden waar er twee stonden is geen verslechtering; zou dit uitslaan, dan is elke wijziging aan een oud bestand geblokkeerd');
  assert.equal(r.keur('public/x.html', erfenis, erfenis + '<i style="c"></i>').length, 1,
    'de derde erbij is wel een verslechtering');
  assert.equal(r.keur('public/x.html', erfenis, '<i style="a"></i>').length, 0,
    'er een weghalen mag altijd');
});

test('inline-stijl geldt voor public/ en niet voor de rest', () => {
  const r = regel('inline-stijl');
  assert.equal(r.geldt('public/apps/app.html'), true);
  assert.equal(r.geldt('server/server.js'), false, 'een style="-string in servercode is geen CSP-gat in een pagina');
  assert.equal(r.geldt('public/apps/dist/app.html'), false, 'de bouwuitvoer telt niet mee: die is samengesteld uit bronnen die hier al langskomen');
});

test('omvang: een NIEUWE servermodule over de grens slaat uit, eronder niet', () => {
  const r = regel('omvang');
  const groot = 'x'.repeat(10241), klein = 'x'.repeat(10240);
  assert.equal(r.keur('server/nieuw.js', null, groot).length, 1, 'een byte over de grens is over de grens');
  assert.equal(r.keur('server/nieuw.js', null, klein).length, 0, 'precies op de grens is nog binnen');
});

test('omvang: een bestand mag niet OVER de grens groeien, en erover niet verder groeien', () => {
  const r = regel('omvang');
  const net = 'x'.repeat(10000), over = 'x'.repeat(10300), nogMeer = 'x'.repeat(10400);
  const kruist = r.keur('server/x.js', net, over);
  assert.equal(kruist.length, 1, 'van onder naar boven de grens is de verslechtering die keuringTeGroot telt');
  assert.match(kruist[0].bericht, /OVER de grens/);
  assert.equal(r.keur('server/x.js', over, nogMeer).length, 1, 'al te groot en nog groter: ook uitslaan');
  assert.equal(r.keur('server/x.js', over, over.slice(0, 10250)).length, 0,
    'al te groot en KLEINER geworden mag: anders is een bestand boven de grens niet meer te repareren');
  assert.equal(r.keur('server/x.js', net, net + 'x').length, 0, 'onder de grens groeien mag gewoon');
});

test('zelfpoortende-toets: een nieuwe skip slaat uit, ook in de vorm test.skip()', () => {
  const r = regel('zelfpoortende-toets');
  assert.equal(r.keur('test/x.test.js', null, "test('a', { skip: !process.env.DATABASE_URL }, f)").length, 1);
  assert.equal(r.keur('test/x.test.js', null, "test.skip('a', f)").length, 1);
  assert.equal(r.keur('test/x.test.js', null, "test('a', { skip: false }, f)").length, 0,
    'skip: false is een poort die openstaat en telt dus niet mee');
  assert.equal(r.keur('test/x.test.js', null, "test('a', f)").length, 0);
});

test('zelfpoortende-toets telt geen skip die alleen in commentaar of in een string staat', () => {
  /* Dit is geen bijzaak. In norm.js is precies deze fout DRIE keer gemaakt:
     een teller die de rauwe tekst las, telde de uitleg over skips mee als
     skips. De poort gebruikt daarom schoon() uit norm.js -- dezelfde wringer,
     met dezelfde drie reparaties erin. Zou hij zijn eigen telling hebben, dan
     kwam die fout hier voor de vierde keer terug. */
  const r = regel('zelfpoortende-toets');
  assert.equal(r.keur('test/x.test.js', null, "/* zo ziet { skip: true } eruit */\ntest('a', f)").length, 0,
    'commentaar over een skip is geen skip');
  assert.equal(r.keur('test/x.test.js', null, "const uitleg = '{ skip: true }';\ntest('a', f)").length, 0,
    'een skip binnen aanhalingstekens is tekst, geen poort');
});

test('nieuw-endpoint-zonder-toets: alleen de route die NIEUW is, en alleen als geen test hem noemt', () => {
  const r = regel('nieuw-endpoint-zonder-toets');
  const voor = "app.get('/api/oud/pad', h);";
  const na = voor + "\napp.post('/api/verse/route', h);";
  const geenTest = { gedekt: () => false };
  const welTest = { gedekt: () => true };

  const raak = r.keur('server/x.js', voor, na, geenTest);
  assert.equal(raak.length, 1, 'de nieuwe route hoort uit te slaan');
  assert.match(raak[0].bericht, /POST \/api\/verse\/route/);
  assert.equal(raak.filter(v => /oud\/pad/.test(v.bericht)).length, 0,
    'de route die er al stond is geen nieuw werk en hoort NIET mee te komen -- anders blokkeert elke wijziging aan een oud bestand');

  assert.equal(r.keur('server/x.js', voor, na, welTest).length, 0,
    'staat de route wel in een test, dan zwijgt de regel');
  assert.equal(r.keur('server/x.js', voor, voor + '\n// alleen commentaar erbij', geenTest).length, 0,
    'zonder nieuwe route valt er niets te melden');
});

test('nieuw-endpoint-zonder-toets: een nieuw BESTAND vol routes telt ze allemaal als nieuw', () => {
  const r = regel('nieuw-endpoint-zonder-toets');
  const na = "app.get('/api/alpha/een', h);\napp.get('/api/beta/twee', h);";
  assert.equal(r.keur('server/nieuw.js', null, na, { gedekt: () => false }).length, 2);
});

/* ====================== 2. DE POORT ALS GEHEEL ============================
   De regels hierboven zijn functies. Wat ze niet aantonen is of de poort de
   juiste bestanden VINDT, of hij de vorige versie werkelijk uit de historie
   haalt, en of hij zakt met de juiste exitcode. Daarvoor is een echte
   repository nodig, en die maken we weg. */

function metWegwerpRepo(doe) {
  const map = fs.mkdtempSync(path.join(os.tmpdir(), 'rtg-deltapoort-'));
  const git = (...a) => cp.execFileSync('git', a, { cwd: map, encoding: 'utf8' });
  const schrijf = (rel, inhoud) => {
    const vol = path.join(map, rel);
    fs.mkdirSync(path.dirname(vol), { recursive: true });
    fs.writeFileSync(vol, inhoud);
  };
  try {
    git('init', '-q', '-b', 'main');
    git('config', 'user.email', 'ijking@rtg.test');
    git('config', 'user.name', 'ijking');
    return doe({ map, git, schrijf,
      draai: (...extra) => {
        const r = cp.spawnSync(process.execPath, [POORT, ...extra], {
          cwd: map, encoding: 'utf8', env: { ...process.env, RTG_DELTA_WORTEL: map }
        });
        return { code: r.status, uit: (r.stdout || '') + (r.stderr || '') };
      } });
  } finally { fs.rmSync(map, { recursive: true, force: true }); }
}

test('nieuwe-ingang-buiten-http: een nieuwe klok of server moet worden gezegd', () => {
  const r = regel('nieuwe-ingang-buiten-http');
  assert.equal(r.keur('server/kern/nieuw.js', null, 'setInterval(veeg, 1000);').length, 1,
    'een nieuw bestand met een timer hoort uit te slaan');
  assert.equal(r.keur('server/kern/nieuw.js', null, "require('net').createServer(f);").length, 1,
    'en een eigen server op een eigen poort ook');
  assert.equal(r.keur('server/kern/nieuw.js', null, 'module.exports = () => 1;').length, 0,
    'een gewoon bestand niet -- anders slaat de regel op alles uit en gaat hij uit');
});

test('nieuwe-ingang-buiten-http: de erfenis mag blijven, maar niet groeien', () => {
  const r = regel('nieuwe-ingang-buiten-http');
  const oud = 'setInterval(a, 1);';
  assert.equal(r.keur('server/kern/x.js', oud, oud + '\nconst y = 1;').length, 0,
    'een bestaande timer houden mag; anders is elke wijziging aan zo\'n bestand geblokkeerd');
  assert.equal(r.keur('server/kern/x.js', oud, oud + 'setInterval(b, 2);').length, 1, 'een tweede erbij niet');
  assert.equal(r.keur('server/kern/x.js', oud, '').length, 0, 'hem weghalen mag altijd');
});

test('nieuwe-ingang-buiten-http: een al verklaarde ingang wordt met rust gelaten', () => {
  /* server/bus.js IS de bus; die vraag is beantwoord en staat met een reden in
     de verklaringen. Een poort die daar opnieuw over begint, wordt uitgezet. */
  const r = regel('nieuwe-ingang-buiten-http');
  assert.equal(r.keur('server/bus.js', null, 'x.subscribe(f); x.subscribe(g);').length, 0);
});

test('nieuwe-onverklaarde-rand: een NIEUW bestand mag er geen enkele hebben', () => {
  const r = regel('nieuwe-onverklaarde-rand');
  /* De indeling van het hele huis komt normaal uit VERSTRENGELING.json; hier
     gaat hij mee als context, zodat deze toets meet wat de REGEL doet en niet
     wat de codebase vandaag toevallig bevat. */
  const onbekendeRanden = new Set(['domein:vakwerk -> domein:klantenboek']);
  const raak = r.keur('server/kern/vakwerk/index.js', null, "const k = require('../klantenboek');", { onbekendeRanden });
  assert.equal(raak.length, 1, 'een nieuw bestand met een onverklaarde rand moet uitslaan');
  assert.match(raak[0].bericht, /domein:vakwerk -> domein:klantenboek/);
  assert.match(raak[0].hulp, /verstrengeling-verklaringen/, 'de uitweg is verklaren, en die hoort in de melding te staan');
});

test('nieuwe-onverklaarde-rand: een rand die er AL stond mag blijven', () => {
  /* De erfenis van 111 randen hoeft niet weg om ergens aan te mogen werken.
     Zou dit uitslaan, dan is elke wijziging aan zo'n bestand geblokkeerd en
     gaat de poort binnen een week uit. */
  const r = regel('nieuwe-onverklaarde-rand');
  const onbekendeRanden = new Set(['domein:vakwerk -> domein:klantenboek']);
  const bron = "const k = require('../klantenboek');";
  assert.equal(r.keur('server/kern/vakwerk/index.js', bron, bron + '\nconst x = 1;', { onbekendeRanden }).length, 0);
  assert.equal(r.keur('server/kern/vakwerk/index.js', bron, 'const x = 1;', { onbekendeRanden }).length, 0,
    'hem weghalen mag altijd');
});

test('nieuwe-onverklaarde-rand: een VERKLAARDE rand slaat niet uit', () => {
  /* Een regel die op elke kruisverwijzing uitslaat, houdt net zo weinig tegen
     als een regel die op niets uitslaat: dan wordt hij uitgezet. Alleen wat in
     de indeling ONBEKEND heet, telt. */
  const r = regel('nieuwe-onverklaarde-rand');
  const onbekendeRanden = new Set(['domein:vakwerk -> domein:klantenboek']);
  assert.equal(r.keur('server/kern/vakwerk/index.js', null, "const p = require('../pay/poort');", { onbekendeRanden }).length, 0);
  /* En een require binnen het eigen domein is helemaal geen rand. */
  assert.equal(r.keur('server/kern/vakwerk/index.js', null, "const z = require('./zusje');", { onbekendeRanden }).length, 0);
});

test('de poort zakt op een nieuw bestand dat onder de norm staat, en is groen zodra het klopt', () => {
  metWegwerpRepo(({ git, schrijf, draai }) => {
    schrijf('leesmij.md', 'grondslag\n');
    git('add', '-A'); git('commit', '-qm', 'grondslag');
    const basis = git('rev-parse', 'HEAD').trim();

    /* Nog niet gecommit, want zo draait een mens hem: voor het committen. */
    schrijf('public/apps/fout.html', '<b style="color:red">a</b><b style="color:blue">b</b>');
    const zakt = draai('--basis', basis);
    assert.equal(zakt.code, 1, 'twee inline stijlattributen in een nieuw bestand horen de poort te laten zakken\n' + zakt.uit);
    assert.match(zakt.uit, /inline-stijl/);
    assert.match(zakt.uit, /nieuw bestand met 2/);
    assert.match(zakt.uit, /\[nieuw bestand: de volle norm\]/);

    schrijf('public/apps/fout.html', '<b class="rood">a</b><b class="blauw">b</b>');
    const groen = draai('--basis', basis);
    assert.equal(groen.code, 0, 'zonder inline stijl hoort hij te openen\n' + groen.uit);
    assert.match(groen.uit, /De deltapoort is gehaald/);
  });
});

test('de poort ziet de vorige versie uit de historie, niet alleen wat er nu op schijf staat', () => {
  metWegwerpRepo(({ git, schrijf, draai }) => {
    schrijf('public/x.html', '<i style="a"></i><i style="b"></i>');
    git('add', '-A'); git('commit', '-qm', 'met erfenis');
    const basis = git('rev-parse', 'HEAD').trim();

    schrijf('public/x.html', '<i style="a"></i><i style="b"></i><p>tekst</p>');
    assert.equal(draai('--basis', basis).code, 0,
      'de erfenis van twee blijft twee; wie dit laat zakken, verbiedt elke wijziging aan een oud bestand');

    schrijf('public/x.html', '<i style="a"></i><i style="b"></i><i style="c"></i>');
    const zakt = draai('--basis', basis);
    assert.equal(zakt.code, 1, 'de derde erbij hoort te zakken\n' + zakt.uit);
    assert.match(zakt.uit, /van 2 naar 3/);
  });
});

test('de poort zakt op een nieuw pakket, en noemt WELK pakket', () => {
  metWegwerpRepo(({ git, schrijf, draai }) => {
    schrijf('package.json', JSON.stringify({ name: 'p', dependencies: {} }, null, 2));
    git('add', '-A'); git('commit', '-qm', 'zonder pakketten');
    const basis = git('rev-parse', 'HEAD').trim();

    schrijf('package.json', JSON.stringify({ name: 'p', dependencies: { express: '^4' } }, null, 2));
    const zakt = draai('--basis', basis);
    assert.equal(zakt.code, 1, 'een nieuwe runtime-dependency hoort te zakken\n' + zakt.uit);
    assert.match(zakt.uit, /nieuw pakket in dependencies: express/);
  });
});

/* De ijking van een NIEUWE METER wordt hier niet beproefd, omdat de poort hem
   niet keurt: scripts/check.js regel 35 en de ratel `metersOngeijkt` houden die
   waarheid al vast. Zie de kop van scripts/deltapoort.js, paragraaf "wat hier
   bewust niet staat". Deze regels staan er zodat de volgende lezer niet denkt
   dat de proef vergeten is. */

test('ZONDER BASIS ZAKT HIJ, en meldt hij niet dat alles in orde is', () => {
  /* De belangrijkste proef van dit bestand. Een poort die zonder
     vergelijkingspunt exitcode 0 geeft, is precies het gat dat
     scripts/pgtoetsen.js maandenlang had: groen zonder iets gezien te hebben.
     Een repository zonder hoofdlijn en zonder --basis is die situatie. */
  metWegwerpRepo(({ git, schrijf, draai }) => {
    schrijf('leesmij.md', 'x');
    git('add', '-A'); git('commit', '-qm', 'een');
    git('branch', '-m', 'main', 'losse-tak');       // geen main/master meer
    const r = draai();
    assert.equal(r.code, 2, 'zonder basis hoort hij te zakken met een eigen exitcode\n' + r.uit);
    assert.match(r.uit, /GEEN BASIS/);
    assert.doesNotMatch(r.uit, /gehaald/, 'hij mag onder geen beding melden dat de poort gehaald is');
  });
});

test('een uitzondering met geldige datum opent de poort, een verlopen uitzondering niet', () => {
  metWegwerpRepo(({ git, schrijf, draai }) => {
    schrijf('NORM.json', JSON.stringify({ meters: {} }, null, 2));
    git('add', '-A'); git('commit', '-qm', 'norm');
    const basis = git('rev-parse', 'HEAD').trim();
    schrijf('public/x.html', '<b style="a"></b>');

    assert.equal(draai('--basis', basis).code, 1, 'zonder uitzondering zakt hij');

    const uitz = (vervalt) => schrijf('NORM.json', JSON.stringify({ meters: {},
      uitzonderingen: [{ regel: 'inline-stijl', pad: 'public/x.html', reden: 'ijking', vervalt }] }, null, 2));

    uitz('2999-01-01');
    assert.equal(draai('--basis', basis).code, 0, 'een geldige uitzondering hoort de poort te openen');
    uitz('2000-01-01');
    assert.equal(draai('--basis', basis).code, 1,
      'een VERLOPEN uitzondering telt niet meer -- anders is een uitzondering gewoon een tweede norm');
  });
});
