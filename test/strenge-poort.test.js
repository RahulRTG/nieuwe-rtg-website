/* De strenge poort bewaakt de hele suite: een geslaagde test mag de server nooit
   een uncaughtException of unhandledRejection laten loggen. Deze test bewaakt de
   BEWAKER zelf: dat de detectie klopt (crashes wel, client-fouten niet) en dat een
   opgevangen regel echt geregistreerd wordt. We ruimen de gedeelde lijst daarna op,
   zodat deze test de run niet per ongeluk laat falen.
   Draai: node --experimental-sqlite --test test/strenge-poort.test.js */
const test = require('node:test');
const assert = require('node:assert/strict');
const { spawn } = require('node:child_process');
const { _poort } = require('./helper');

test('detectie: crashes en 5xx tellen mee, client-fouten en ruis niet', () => {
  assert.ok(_poort.isFataal('2026 ERROR uitzondering {"fout":"x","bron":"uncaughtException","fataal":true}'), 'uncaughtException telt mee');
  assert.ok(_poort.isFataal('ERROR uitzondering {"bron":"unhandledRejection"}'), 'unhandledRejection telt mee');
  // een geworpen route-fout -> 500: de server markeert die met serverfout:true
  assert.ok(_poort.isFataal('ERROR uitzondering {"p":"/api/x","status":500,"serverfout":true}'), 'een onverwachte 5xx telt mee');
  // een client-fout via de express error-middleware (400/413) krijgt GEEN serverfout-vlag
  assert.equal(_poort.isFataal('ERROR uitzondering {"fout":"te groot","p":"/api/x","status":413}'), false, 'een 413 telt niet mee');
  assert.equal(_poort.isFataal('ERROR uitzondering {"p":"/api/x","status":400}'), false, 'een 400 telt niet mee');
  assert.equal(_poort.isFataal('WARN [pg] flush mislukt: timeout'), false, 'een waarschuwing telt niet mee');
  assert.equal(_poort.isFataal('gewone logregel'), false, 'ruis telt niet mee');
});

test('een echte stderr-regel van een crashend proces wordt opgevangen', async () => {
  const voor = _poort.serverUitzonderingen.length;
  const kind = spawn(process.execPath, ['-e',
    'process.stderr.write(\'ERROR uitzondering {"fout":"kapot","bron":"unhandledRejection"}\\n\')']);
  _poort.luisterOpFouten(kind);
  await new Promise(r => kind.on('exit', () => setTimeout(r, 150)));
  assert.equal(_poort.serverUitzonderingen.length, voor + 1, 'de crashregel is geregistreerd');
  // opruimen: haal onze test-regel er weer uit zodat de run-brede exit-poort niet afgaat
  _poort.serverUitzonderingen.length = voor;
});
