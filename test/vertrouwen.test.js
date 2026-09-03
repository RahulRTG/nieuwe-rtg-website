/* ============================================================================
   DE VERTROUWENSSTAND -- afgeleid uit harde feiten, en nergens bewaard.

   DE BEWERING DIE ERTOE DOET staat in toets 3: een conclusie is nooit harder
   dan haar zachtste premisse. Zonder die regel lezen drie halve zekerheden
   samen als een hele, en dat is precies het samengestelde groene cijfer dat
   LAT-regel 11 en check.js regel 48 verbieden.

   En toets 5, die structureel is: deze stand wordt NIET opgeslagen. Een
   afgeleide waarde die je bewaart is een tweede waarheid die veroudert -- de
   sessie zegt dan "sterk" terwijl het toestel er inmiddels uit ligt. Het veld
   `vertrouwen` is daarom uit sessievelden.js gehaald in plaats van gevuld.

   Draai los: node --test test/vertrouwen.test.js
   ========================================================================== */
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');
const { standVan, STANDEN, NIET_MEEGEWOGEN } = require('../server/kern/identiteit/vertrouwen');

const g = (x) => ({ graad: x, aanwezig: x !== 'onbekend' });

/* ---------------------------------------------------------------------------
   1. DE VIER STANDEN, en wat ze betekenen.
   ------------------------------------------------------------------------- */
test('1. zonder authenticator is de stand onbekend, niet zwak', () => {
  const s = standVan({});
  assert.equal(s.stand, 'onbekend');
  assert.equal(s.graad, 'onbekend');
  assert.match(s.graadReden, /niets vastgesteld/,
    '"wij hebben nooit vastgelegd" is iets anders dan "dit is zwak"');
});

test('1b. een wachtwoord is KENNIS en dat is over te dragen', () => {
  const s = standVan({ authenticator: g('gemeten') }, 'wachtwoord');
  assert.equal(s.stand, 'kennis');
  assert.match(s.uitleg, /over te dragen/,
    'het verschil tussen weten en hebben is de hele reden dat deze stand bestaat');
});

test('1c. een passkey is BEZIT', () => {
  assert.equal(standVan({ authenticator: g('bewezen') }, 'passkey').stand, 'bezit');
});

/* DE TREDE DIE HET DUURST WAS OM EERLIJK TE HOUDEN. Twee factoren zijn beter
   dan een, en het is NIET hetzelfde als een passkey: een TOTP-code komt uit een
   geheim dat RTG ook heeft, en een mens kan hem voorlezen aan wie erom vraagt.
   Hem onder `bezit` scharen zou een groen vinkje zijn dat phishing niet
   tegenhoudt. */
test('1c2. wachtwoord + TOTP is twee factoren, en blijft onder een passkey', () => {
  const t = standVan({ authenticator: g('gemeten') }, 'wachtwoord+totp');
  assert.equal(t.stand, 'tweefactor');
  assert.ok(STANDEN.tweefactor.rang > STANDEN.kennis.rang, 'het is beter dan een wachtwoord alleen');
  assert.ok(STANDEN.tweefactor.rang < STANDEN.bezit.rang, 'en het is minder dan aangetoond bezit');
  assert.match(t.uitleg, /doorvertellen|phishing/i,
    'de uitleg hoort te zeggen waarom dit geen phishingbestendigheid is');
});

test('1d. een bewezen toestelbinding tilt een wachtwoordsessie naar bezit', () => {
  const s = standVan({ authenticator: g('gemeten'), toestel: g('bewezen') }, 'wachtwoord');
  assert.equal(s.stand, 'bezit', 'het toestel heeft een sleutel aangetoond die het niet kan verlaten');
});

test('1e. sleutelbinding tilt naar gebonden, maar alleen boven op bezit', () => {
  assert.equal(standVan({ authenticator: g('bewezen'), sleutelbinding: g('bewezen') }).stand, 'gebonden');
  assert.equal(standVan({ authenticator: g('gemeten'), sleutelbinding: g('bewezen') }).stand, 'kennis',
    'een gebonden token boven op alleen kennis is nog steeds kennis: er is niets bezeten aangetoond');
});

/* ---------------------------------------------------------------------------
   2. HET IS GEEN SCORE.
   ------------------------------------------------------------------------- */
test('2. er komt geen cijfer uit', () => {
  const s = standVan({ authenticator: g('bewezen'), toestel: g('bewezen'), sleutelbinding: g('bewezen') });
  const plat = JSON.stringify(s);
  assert.equal(/"(score|punten|percentage|cijfer)"/.test(plat), false,
    'een mens die "72" leest weet niet of hij iets moet doen');
  for (const k of Object.keys(s)) assert.equal(typeof s[k] === 'number', false, k + ' is een getal');
});

/* ---------------------------------------------------------------------------
   3. DE KERN: nooit harder dan de zachtste premisse.
   ------------------------------------------------------------------------- */
test('3. een vermoede authenticator maakt de hele stand vermoed', () => {
  const s = standVan({ authenticator: g('vermoed'), toestel: g('bewezen'), sleutelbinding: g('bewezen') }, 'overdracht');
  assert.equal(s.stand, 'gebonden', 'de stand zelf mag best hoog zijn');
  assert.equal(s.graad, 'vermoed', 'maar de zekerheid erover is die van het zwakste feit eronder');
  assert.match(s.graadReden, /zwakste feit/);
});

test('3b. alles bewezen geeft ook bewezen', () => {
  const s = standVan({ authenticator: g('bewezen'), toestel: g('bewezen'), sleutelbinding: g('bewezen') });
  assert.equal(s.graad, 'bewezen');
});

test('3c. een zacht feit dat NIET meetelt, verzwakt de graad ook niet', () => {
  const s = standVan({ authenticator: g('bewezen'), toestel: g('vermoed') });
  assert.equal(s.graad, 'bewezen',
    'de vermoede toestelbinding draagt deze stand niet, dus hij hoort hem ook niet omlaag te halen');
  const grond = s.gronden.find(x => x.feit === 'Toestelbinding');
  assert.equal(grond.staat, 'vermoed', 'maar hij staat er wel eerlijk bij');
});

/* ---------------------------------------------------------------------------
   4. HIJ ZEGT WAT HIJ NIET BEKEEK.
   ------------------------------------------------------------------------- */
test('4. wat niet meeweegt staat erbij, met een reden per regel', () => {
  const s = standVan({ authenticator: g('bewezen') });
  assert.ok(s.nietMeegewogen.length >= 3);
  for (const n of s.nietMeegewogen) {
    assert.ok(n.wat && n.reden && n.reden.length > 25,
      n.wat + ' staat er zonder reden bij; een stand die zwijgt over wat hij niet bekeek, laat een mens denken dat hij alles bekeek');
  }
  assert.ok(s.nietMeegewogen.some(n => /gedrag/i.test(n.wat)), 'gedrag hoort hier expliciet buiten te staan');
});

test('4b. elke grond draagt een betekenis en niet alleen een woord', () => {
  const s = standVan({ authenticator: g('gemeten') }, 'wachtwoord');
  for (const grond of s.gronden) {
    assert.ok(grond.feit && grond.staat && grond.betekenis && grond.betekenis.length > 15,
      grond.feit + ' zegt niet wat het betekent');
  }
});

/* ---------------------------------------------------------------------------
   5. HIJ WORDT NIET BEWAARD -- structureel, niet als belofte.
   ------------------------------------------------------------------------- */
test('5. het veld vertrouwen bestaat niet meer in de sessie', () => {
  const { VELDEN } = require('../server/kern/identiteit/sessievelden');
  assert.equal(VELDEN.vertrouwen, undefined,
    'een afgeleide waarde opslaan maakt er een tweede waarheid van die veroudert');
});

test('5b. de module kent geen opslag', () => {
  const bron = fs.readFileSync(path.join(__dirname, '..', 'server', 'kern', 'identiteit', 'vertrouwen.js'), 'utf8');
  const code = bron.replace(/\/\*[\s\S]*?\*\//g, '');
  for (const verboden of ['db.data', 'save(', 'eigencollectie', 'require(\'../eigencollectie\')']) {
    assert.equal(code.includes(verboden), false,
      'kern/identiteit/vertrouwen.js raakt "' + verboden + '" aan; deze stand hoort te worden berekend en niet bewaard');
  }
});

test('5c. het register levert hem mee zonder hem op te slaan', () => {
  const { maakSessieregister } = require('../server/kern/identiteit/sessieregister');
  const db = { data: {} };
  const reg = maakSessieregister({ db, save() {} });
  const nu = new Date().toISOString();
  reg.open('aaaaaaaaaaaa', 'user-1', { authenticator: { type: 'passkey', authenticatorId: 'c1',
    herkomst: { bron: 't', methode: 'cryptografisch', vastgesteldOp: nu, regelversie: 'v1' } } });
  assert.equal(reg.vanLid('user-1')[0].vertrouwen.stand, 'bezit');
  assert.equal(JSON.stringify(db.data.sessiecontext).includes('vertrouwen'), false,
    'de berekende stand hoort niet in de opslag te belanden');
});

test('6. de standen zijn geordend en compleet', () => {
  const rangen = Object.values(STANDEN).map(s => s.rang).sort();
  assert.deepEqual(rangen, [0, 1, 2, 3, 4]);
  for (const [id, s] of Object.entries(STANDEN)) {
    assert.ok(s.naam && s.uitleg && s.uitleg.length > 25, id + ' mist een uitleg die een mens iets zegt');
  }
  assert.ok(NIET_MEEGEWOGEN.length >= 3);
});

/* ============================================================================
   BEWIJS UIT EEN BOOM DIE NIEMAND KAN OVERDOEN.

   Een bronregister dat is gemeten terwijl er ongecommitte CODE in de boom stond,
   hoort niet bij de commit die in zijn stempel staat -- hij hoort bij iets wat
   nergens is vastgelegd. Zo'n meting is niet na te lopen, en wat niemand kan
   overdoen is geen bewijs (TAKEN.md 7.3). Tot vandaag telde hij hier voor de
   volle waarde mee: `ouderdom()` keek alleen naar `op` en negeerde `boomVuil`.

   HIJ ZAKT NAAR `verschaald` EN NIET NAAR `geschorst`, en dat is een besluit dat
   deze toets vastlegt. Er IS iets gemeten en waarschijnlijk klopt het; alleen de
   waarde die je eraan mag hechten is minder. Schorsen zou de schorspoort
   dichttrekken op een boekhoudkundig gebrek -- een 503 voor de gebruiker omdat
   iemand vergat te committen. Dat is geen veiligheid maar een storing.
   ========================================================================== */
test('een bronregister uit een vuile boom haalt geen enkele route boven verschaald', () => {
  const alles = cellen('bewezen');
  assert.equal(v.staatVan(alles, 1, 30).staat, 'bewezen', 'schoon en vers: gewoon bewezen');

  const vuil = v.staatVan(alles, 1, 30, ['ROLPROEF.json', 'POORTWACHT.json']);
  assert.equal(vuil.staat, 'verschaald', 'met een onreproduceerbare bron kan het geen bewijs meer heten');
  assert.match(vuil.reden, /ROLPROEF\.json/, 'en de reden noemt WELKE meting, anders volgt er een zoektocht');
  assert.match(vuil.reden, /POORTWACHT\.json/);
  assert.match(vuil.heropent, /commit/, 'en zegt wat je eraan doet');

  // een lege lijst is geen vuil: dat is de normale toestand en die mag gewoon bewijzen
  assert.equal(v.staatVan(alles, 1, 30, []).staat, 'bewezen');
  assert.equal(v.staatVan(alles, 1, 30, undefined).staat, 'bewezen');

  /* De rangorde blijft heel: een gezakte cel wint nog steeds van alles. Een
     onreproduceerbare meting mag een schorsing nooit ZACHTER maken -- dat zou
     van deze reparatie een uitweg maken. */
  assert.equal(v.staatVan(cellen('bewezen', { AUTH: 'gezakt' }), 1, 30, ['X.json']).staat, 'geschorst');
  assert.equal(v.staatVan(cellen('bewezen', { AUTH: 'ongemeten' }), 1, 30, ['X.json']).staat, 'verzwakt');
});

test('ouderdom() wijst de vuile bronnen aan, en onbekend is geen vuil', () => {
  const dag = 86400000;
  const nu = Date.parse('2026-08-20T12:00:00Z');
  const lees = (per) => (naam) => {
    if (!(naam in per)) throw new Error('bestaat niet');
    const [dagen, boomVuil] = per[naam];
    return JSON.stringify({ stempel: { op: new Date(nu - dagen * dag).toISOString(), boomVuil } });
  };
  const uit = v.ouderdom(nu, lees({
    'ROLPROEF.json': [2, true],
    'POORTWACHT.json': [3, false],
    /* null betekent: git was niet te bevragen. Onbekend als vuil lezen zou elke
       meting buiten een repo onbruikbaar maken -- maar hij staat wel in het
       antwoord, want stilzwijgend als schoon tellen is de andere fout. */
    'OUTPUTPROEF.json': [4, null]
  }));
  assert.deepEqual(uit.onreproduceerbaar, ['ROLPROEF.json'], 'alleen de echt vuile');
  assert.equal(uit.bronnen['POORTWACHT.json'].boomVuil, false);
  assert.equal(uit.bronnen['OUTPUTPROEF.json'].boomVuil, false, 'onbekend telt niet als vuil');
});
