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
