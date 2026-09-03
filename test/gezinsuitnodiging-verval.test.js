/* VERVALT EEN GEZINSUITNODIGING ECHT?

   `server/foundation/gezinsuitnodiging.js` belooft het in zijn kop -- "de sleutel
   verloopt na 48 uur" -- en de code doet het ook: `DUUR`, `verloop()` en
   `verlopen()` staan er, en zowel /bekijk als /accepteer weigeren erop. Maar er
   was geen enkele toets die een VERLOPEN uitnodiging heeft zien weigeren, en een
   vervaltijd die niemand heeft zien aflopen is een belofte en geen grendel
   (LAT.md regel 10).

   WAAROM DAT ER NIET WAS, EN WAT ERVOOR NODIG WAS. De hele foundation-laag las
   de tijd met een kaal `new Date()` in server/foundation/basis.js, dus er viel
   niets aan te draaien: de enige manier om verval te toetsen was de opgeslagen
   `verlooptAt` met de hand terugzetten, en dan toets je de opslag in plaats van
   de regel. Sinds 2 september 2026 loopt die ene `nu()` via `server/lib/klok.js`
   -- de huisklok die er precies voor deze vraag is en die in productie weigert.

   DE PROEF IS DAAROM TWEE SERVERS OP DEZELFDE DATAMAP: de eerste maakt het gezin
   en de uitnodiging op de echte tijd, de tweede start met de klok 49 uur vooruit
   en kijkt naar dezelfde uitnodiging. Niets in de database is aangeraakt; alleen
   de tijd is verzet. Dat is de enige opstelling waarin het antwoord over de
   VERVALREGEL gaat.

   Draai los: node --test test/gezinsuitnodiging-verval.test.js */
'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { startServer } = require('./helper');

const map = fs.mkdtempSync(path.join(os.tmpdir(), 'rtg-uitnod-verval-'));
let child, base, uitnodiging;

const f = (pad, body) => fetch(base + '/api/foundation' + pad, { method: 'POST',
  headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body || {}) });
const json = r => r.json();
const stop = () => { if (child) { try { child.kill('SIGKILL'); } catch (e) {} child = null; } };

test.before(async () => {
  ({ child, base } = await startServer({ env: { RTG_DATA_DIR: map, SMTP_URL: '' } }));
  const gezin = await json(await f('/gezin/maak', { gezinsnaam: 'Gezin Klok', naam: 'Beheerder',
    pin: '2468', bevoegdGezin: true, privacyAkkoord: true }));
  const gemaakt = await json(await f('/gezin/uitnodiging/maak', { code: gezin.code, token: gezin.token,
    naam: 'Tweede ouder', rol: 'ouder', relatie: 'co-ouder', gezagVerklaard: true }));
  uitnodiging = gemaakt.uitnodiging;
  assert.match(uitnodiging || '', /^[A-Z0-9]{6}\.[A-Za-z0-9_-]{30,60}$/, 'er is een sleutel uitgegeven');
});
test.after(() => {
  stop();
  try { fs.rmSync(map, { recursive: true, force: true }); } catch (e) {}
});

test('DE TEGENPROEF EERST: op de echte tijd werkt de uitnodiging gewoon', async () => {
  /* Zonder deze zou een uitnodiging die ALTIJD wordt geweigerd -- een tikfout in
     `zoek()`, een sleutel die nooit matcht -- de vervaltoets hieronder ook halen.
     Dan bewijst een 404 niets over verval. */
  const r = await json(await f('/gezin/uitnodiging/bekijk', { uitnodiging }));
  assert.equal(r.uitnodiging && r.uitnodiging.rol, 'ouder', 'vers is hij te bekijken');
  assert.ok(Date.parse(r.uitnodiging.verlooptAt) > Date.now(), 'en zijn vervaldatum ligt in de toekomst');
});

test('negenenveertig uur later is dezelfde sleutel dood -- bekijken en accepteren allebei', async () => {
  /* DEZELFDE DATAMAP, ALLEEN EEN ANDERE KLOK. De database is niet aangeraakt: wat
     verandert is uitsluitend wat de server "nu" vindt. Mutatie nagetrokken: de
     `verlopen(r.u)`-controle uit `bekijk` en `accepteer` halen laat deze toets
     zakken op precies deze twee asserties. */
  stop();
  ({ child, base } = await startServer({ env: { RTG_DATA_DIR: map, SMTP_URL: '', RTG_KLOK: '+49u' } }));

  const bekijk = await f('/gezin/uitnodiging/bekijk', { uitnodiging });
  assert.equal(bekijk.status, 404, 'na 48 uur is de uitnodiging niet meer te bekijken');

  /* En accepteren is de gevaarlijke helft: bekijken lekt hooguit een naam,
     accepteren MAAKT een profiel met toegang tot de kinderen van dit gezin. Die
     weigering staat op een eigen regel in de code en hoort dus een eigen
     assertie te dragen. */
  const accepteer = await f('/gezin/uitnodiging/accepteer', { uitnodiging,
    pin: '1379', akkoord: true, privacyAkkoord: true });
  assert.equal(accepteer.status, 404, 'en er komt met een verlopen sleutel geen profiel bij');
});
