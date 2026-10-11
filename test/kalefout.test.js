/* BEWIJS 8 (MENSELIJK) ALS ONDERGRENS -- scripts/lib/kalefout.js.

   De meter van bewijs 8 draait in een browser (scripts/appwerkt.js), en een
   browser is er niet altijd. Het OORDEEL staat daarom los en wordt hier zonder
   browser beproefd, zodat een detector die nooit aanslaat niet onopgemerkt
   groen kan geven over 114 rijen (zie de kop van scripts/lib/schermleugen.js).

     1. Elke soort kale techniek wordt gezien, en een nette melding niet.
     2. De ijking: wat in de zichtbare tekst van het statische bestand staat, telt
        niet -- en de ijklijn is de TEKST, niet de bron met scripts erin.
     3. Het oordeel: een kale fout of techniek of een naamloze knop is DEFECT, te
        weinig bediening is NIET_GETEST, en BEWEZEN zegt wat het niet meet.
     4. appwerkt.js gebruikt deze module en schrijft geen eigen oordeel. */
'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');
const K = require('../scripts/lib/kalefout');

test('1. kale techniek wordt gezien, een nette melding niet', () => {
  const gevallen = {
    stacktrace: 'Er ging iets mis at laad (https://x/apps/geld.js:12:5)',
    foutklasse: 'TypeError: x is null',
    'JS-foutzin': 'Cannot read properties of null (reading lat)',
    'rauw JSON-antwoord': 'Antwoord: {"error":"BAD_REQUEST"}',
    'kale netwerkmelding': 'Failed to fetch',
    'kale HTTP-status': 'Internal Server Error',
    undefined: 'Saldo: undefined',
    NaN: 'Totaal € NaN',
    '[object Object]': 'Naam: [object Object]'
  };
  for (const [naam, tekst] of Object.entries(gevallen)) {
    const k = K.kaleKlachten({ tekst, statisch: '<html><body><p>Hallo</p></body></html>' });
    assert.ok(k.some((x) => x.includes('(' + naam + ')')), naam + ' niet gezien in "' + tekst + '"');
  }
  for (const tekst of ['Er ging iets mis. Probeer het opnieuw.', 'Dit kon niet worden geladen. Ververs de pagina.',
    'Kies of beschrijf de plek in huis.', 'Nog niets live gedeeld', 'Het antwoord was onvolledig, dus dit kon niet worden geladen.']) {
    assert.deepEqual(K.kaleKlachten({ tekst, statisch: '' }), [], 'een nette melding telde als kaal: ' + tekst);
  }
});

test('2. de ijking is de zichtbare tekst van het bestand, niet de bron met scripts', () => {
  /* Staat het in de tekst die de auteur zelf in beeld zette, dan is het geen vondst. */
  const uitleg = '<html><body><p>Een leeg veld heet in JSON null.</p></body></html>';
  assert.deepEqual(K.kaleKlachten({ tekst: 'Een leeg veld heet in JSON null.', statisch: uitleg }), []);
  /* Staat het alleen in een SCRIPT, dan ijkt het niets weg: `undefined` staat in
     vrijwel elk inline script, en anders zag de meter nooit iets. */
  const metScript = '<html><body><p>Saldo</p><script>if (x === undefined) y = null;</script></body></html>';
  assert.equal(K.kaleKlachten({ tekst: 'Saldo undefined', statisch: metScript }).length, 1);
  assert.doesNotMatch(K.statischeTekst(metScript), /undefined/);
  assert.doesNotMatch(K.statischeTekst('<style>.a{}</style><!-- TypeError --><b>x</b>'), /TypeError|\.a/);
});

test('3. het oordeel: defect, niet getest of bewezen -- en bewezen zegt wat het niet meet', () => {
  const basis = { stuk: [], laadCrash: [], kaal: [], naamloos: [], bedienbaar: 'BEWEZEN', eigenKnoppen: 12 };
  assert.equal(K.menselijkOordeel(Object.assign({}, basis, { stuk: ['500 /api/x'] })).status, 'GEBLOKKEERD_DOOR_DEFECT');
  assert.equal(K.menselijkOordeel(Object.assign({}, basis, { laadCrash: ['JS: boem'] })).status, 'GEBLOKKEERD_DOOR_DEFECT');
  assert.equal(K.menselijkOordeel(Object.assign({}, basis, { kaal: ['kale techniek in beeld (NaN)'] })).status, 'GEBLOKKEERD_DOOR_DEFECT');
  assert.equal(K.menselijkOordeel(Object.assign({}, basis, { naamloos: ['button.x'] })).status, 'GEBLOKKEERD_DOOR_DEFECT');
  /* Niets gezien is pas bewijs als er genoeg bediend is. */
  for (const b of ['NIET_GETEST', 'GEBLOKKEERD_DOOR_DEFECT', 'GEBLOKKEERD_DOOR_CONFIG']) {
    assert.equal(K.menselijkOordeel(Object.assign({}, basis, { bedienbaar: b })).status, 'NIET_GETEST', 'bedienbaar ' + b + ' gaf geen NIET_GETEST');
  }
  const ok = K.menselijkOordeel(basis);
  assert.equal(ok.status, 'BEWEZEN');
  assert.match(ok.reden, /NIET gemeten/);
  assert.match(ok.reden, /weg/);
  assert.match(ok.reden, /handicap/);
  assert.match(ok.reden, /TOEGANKELIJK\.md/);
});

test('4. appwerkt.js laat bewijs 8 aan deze module over', () => {
  const bron = fs.readFileSync(path.join(__dirname, '..', 'scripts', 'appwerkt.js'), 'utf8');
  assert.match(bron, /require\('\.\/lib\/kalefout'\)/);
  assert.match(bron, /r\.bewijzen\.menselijk = \{ status: m8\.status/);
  assert.doesNotMatch(bron, /afgeleid: geen kale fout gezien/, 'het oude afgeleide oordeel staat er nog naast');
  /* Na elke tik wordt opnieuw gekeken, niet alleen bij het laden. */
  assert.match(bron, /await kijkKaal\(laatste\)/);
});
