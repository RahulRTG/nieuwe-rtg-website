/* DE VERVALSTATEN, NAGETROKKEN. PROOF.md paragraaf 2 belooft een staatmachine;
   dit bestand laat hem elke overgang echt maken (LAT.md regel 10: een meter
   die je niet hebt zien uitslaan meet niets). De volgorde van de gevallen is
   de rangorde van de staten zelf: gezakt wint van alles, dan de vloer
   (ongemeten), dan het gat (verzwakt), dan de leeftijd (verschaald), en pas
   als niets daarvan speelt is het bewezen.

   Draai los: node --experimental-sqlite --test test/vertrouwen.test.js */
const test = require('node:test');
const assert = require('node:assert/strict');

const v = require('../scripts/vertrouwen.js');

/* Elf cellen bouwen met een defaultstaat en gerichte afwijkingen, zodat elk
   geval leest als wat hij verandert en niet als een muur JSON. */
const SCHAKELS = ['AUTH', 'ACL', 'INPUT', 'OUTPUT', 'STATE', 'SIDE_EFFECT',
  'AUDIT', 'IDEMPOTENCY', 'FAILURE', 'ROLLBACK', 'PRIVACY'];
function cellen(basis, afwijking) {
  const uit = {};
  for (const s of SCHAKELS) uit[s] = { staat: (afwijking || {})[s] || basis };
  return uit;
}

test('de staatmachine maakt elke overgang, in rangorde', () => {
  /* BEWEZEN: alles gedragen en vers. */
  const groen = v.staatVan(cellen('bewezen', { AUTH: 'nvt' }), 3, 30);
  assert.equal(groen.staat, 'bewezen');
  assert.match(groen.heropent, /vervalt zodra/, 'een bewezen staat noemt zijn vervalvoorwaarden');

  /* VERSCHAALD: zelfde bewijs, maar de meting is over de halfwaardetijd. De
     ENIGE verandering is de leeftijd -- dat is de hele overgang. */
  const oud = v.staatVan(cellen('bewezen', { AUTH: 'nvt' }), 31, 30);
  assert.equal(oud.staat, 'verschaald');
  assert.match(oud.reden, /vorige wereld/);

  /* VERZWAKT: een gat weegt zwaarder dan leeftijd; ook een VERSE meting met
     een ongemeten schakel is verzwakt, en de reden noemt de schakel. */
  const gat = v.staatVan(cellen('bewezen', { AUDIT: 'ongemeten' }), 3, 30);
  assert.equal(gat.staat, 'verzwakt');
  assert.match(gat.reden, /AUDIT/);

  /* GESCHORST: een gezakte cel wint van ALLES -- ook van tien bewezen cellen
     en een verse meting. Het bewijs zegt zelf dat het niet klopt. */
  const zakt = v.staatVan(cellen('bewezen', { ROLLBACK: 'gezakt' }), 1, 30);
  assert.equal(zakt.staat, 'geschorst');
  assert.match(zakt.heropent, /hermeting/, 'de enige weg omhoog is hermeting, geen hand');

  /* En gezakt wint ook van ongemeten gaten: geschorst, niet verzwakt. */
  assert.equal(v.staatVan(cellen('ongemeten', { STATE: 'gezakt', AUTH: 'bewezen' }), 1, 30).staat,
    'geschorst');

  /* ONGEMETEN: de eerlijke vloer. Nvt draagt niet: een route met alleen
     nvt-cellen heeft geen bewijs, hij heeft een vrijstelling. */
  assert.equal(v.staatVan(cellen('ongemeten'), 1, 30).staat, 'ongemeten');
  assert.equal(v.staatVan(cellen('nvt'), 1, 30).staat, 'ongemeten');

  /* En verklaard draagt WEL: dat is een gemeten uitspraak. */
  assert.equal(v.staatVan(cellen('verklaard'), 1, 30).staat, 'bewezen');
});

test('een staat zonder invoer is een gezakte meting, geen vloer', () => {
  /* LAT.md regel 3. Geen cellen is niet "ongemeten" -- ongemeten is een
     uitslag over een route die bestaat; dit is een meting die faalde. */
  assert.throws(() => v.staatVan(null, 3, 30), /gezakte meting/);
  assert.throws(() => v.staatVan({}, 3, 30), /gezakte meting/);
  /* En een onbekende ouderdom maakt elke versheidsuitspraak verzonnen. */
  assert.throws(() => v.staatVan(cellen('bewezen'), NaN, 30), /versheid/);
  assert.throws(() => v.staatVan(cellen('bewezen'), undefined, 30), /versheid/);
});

test('bereken() telt de staten en sleutelt op methode + pad', () => {
  const rijen = [
    { methode: 'POST', pad: '/api/a', cellen: cellen('bewezen') },
    { methode: 'POST', pad: '/api/b', cellen: cellen('bewezen', { OUTPUT: 'gezakt' }) },
    { methode: 'GET', pad: '/api/a', cellen: cellen('ongemeten') }
  ];
  const uit = v.bereken(rijen, 2, 30);
  assert.deepEqual(uit.telling, { bewezen: 1, verschaald: 0, verzwakt: 0, geschorst: 1, ongemeten: 1 });
  /* Methode + pad, want dezelfde weg kan met GET open en met POST dicht
     staan -- zelfde sleutel als de bewijsmatrix. */
  assert.equal(uit.perRoute['POST /api/a'].staat, 'bewezen');
  assert.equal(uit.perRoute['GET /api/a'].staat, 'ongemeten');
});

test('de ouderdom is die van het OUDSTE been, en zonder stempels zakt hij', () => {
  const dag = 86400000;
  const nu = Date.parse('2026-08-20T12:00:00Z');
  /* De lezer is injecteerbaar (zelfde snit als telBewijslaag in norm.js), dus
     de toets voert hem precies wat hij wil zien: twee gestempelde bronnen van
     verschillende leeftijd -> het OUDSTE been telt. Een verse outputproef
     naast een rolproef van vorig kwartaal maakt het geheel niet vers. */
  const lees = (per) => (naam) => {
    if (!(naam in per)) throw new Error('bestaat niet');
    return JSON.stringify({ stempel: { op: new Date(nu - per[naam] * dag).toISOString() } });
  };
  const uit = v.ouderdom(nu, lees({ 'OUTPUTPROEF.json': 2, 'ROLPROEF.json': 80 }));
  assert.equal(Math.round(uit.dagen), 80, 'het oudste been telt, niet het jongste');
  assert.equal(Object.keys(uit.bronnen).length, 2, 'beide gelezen bronnen staan in het antwoord');

  /* Een bron ZONDER stempel telt niet mee -- en als geen enkele bron er een
     draagt, is de versheid niet te meten en hoort dat een gezakte meting te
     zijn, geen verzonnen nul (LAT.md regel 3). */
  const zonderStempel = () => JSON.stringify({ telling: { iets: 1 } });
  assert.throws(() => v.ouderdom(nu, zonderStempel), /gezakte meting/);
  assert.throws(() => v.ouderdom(nu, () => { throw new Error('weg'); }), /gezakte meting/);

  /* En tegen het echte huis: de registers in de wortel dragen stempels. Zakt
     dit, dan is een register zijn stempel kwijt en dat is zelf een bevinding. */
  const echt = v.ouderdom(Date.now());
  assert.ok(Number.isFinite(echt.dagen), 'de echte ouderdom is een getal');
  assert.ok(Object.keys(echt.bronnen).length >= 2, 'minstens twee gestempelde bronregisters');
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
