/* DE SCHERMKANT VAN EEN ZWARE HANDELING (public/shared/zwaarstap.js).

   De server vraagt om een passkey met 401 + bevestigingNodig. Twee schermen
   lazen dat als "uitgelogd" of toonden alleen de zin; deze helper maakt de
   handeling af. Vier dingen die niet mogen sneuvelen:
   1. een gewoon antwoord gaat ongewijzigd door (geen ceremonie waar geen vraag is);
   2. een vraag om bevestiging leidt tot EEN nieuwe poging, met het bewijs erbij;
   3. een tweede weigering gaat terug en wordt geen lus;
   4. wie zijn vinger weghaalt krijgt een zin, geen uitzondering. */
const test = require('node:test');
const assert = require('node:assert/strict');
const path = require('path');

function laad(passkey) {
  const venster = { RTGPasskey: passkey };
  const pad = path.join(__dirname, '..', 'public', 'shared', 'zwaarstap.js');
  delete require.cache[pad];
  const code = require('fs').readFileSync(pad, 'utf8');
  new Function('window', code)(venster);
  return venster.RTGZwaar;
}
const vraag = { status: 401, body: { bevestigingNodig: true, actie: 'eigenaar-baliezetel', error: 'Bevestig.' } };

test('1. een gewoon antwoord gaat ongewijzigd door', async () => {
  const Z = laad({ bevestig: () => { throw new Error('geen ceremonie verwacht'); } });
  const r = await Z.metVinger(() => Promise.resolve({ status: 200, body: { ok: true } }), () => ({}));
  assert.deepEqual(r, { status: 200, body: { ok: true } });
  const f = await Z.metVinger(() => Promise.resolve({ status: 401, body: { error: 'Geen sessie.' } }), () => ({}));
  assert.equal(f.body.error, 'Geen sessie.', 'een 401 ZONDER bevestigingNodig is geen passkeyvraag');
});

test('2. een vraag om bevestiging: een nieuwe poging, met het bewijs erbij', async () => {
  const gevraagd = [];
  const Z = laad({ bevestig: (opties) => Promise.resolve(opties()).then(() => ({ ceremonie: 'C1', antwoord: { id: 'A' } })) });
  const pogingen = [];
  const r = await Z.metVinger((extra) => {
    pogingen.push(extra);
    return Promise.resolve(pogingen.length === 1 ? vraag : { status: 200, body: { ok: true } });
  }, (actie) => { gevraagd.push(actie); return Promise.resolve({ opties: {}, ceremonie: 'C1' }); });
  assert.equal(r.status, 200);
  assert.deepEqual(gevraagd, ['eigenaar-baliezetel'], 'de ceremonie hoort bij de actie die de server noemde');
  assert.equal(pogingen.length, 2);
  assert.deepEqual(pogingen[1], { ceremonie: 'C1', antwoord: { id: 'A' } });
});

test('3. een tweede weigering gaat terug en wordt geen lus', async () => {
  const Z = laad({ bevestig: () => Promise.resolve({ ceremonie: 'C', antwoord: {} }) });
  let n = 0;
  const r = await Z.metVinger(() => { n++; return Promise.resolve(vraag); }, () => ({}));
  assert.equal(n, 2, 'precies een herhaling');
  assert.equal(r.status, 401);
});

test('4. wie zijn vinger weghaalt krijgt een zin, geen uitzondering', async () => {
  const Z = laad({ bevestig: () => Promise.resolve({ fout: 'Afgebroken: NotAllowedError' }) });
  const r = await Z.metVinger(() => Promise.resolve(vraag), () => ({}));
  assert.equal(r.status, 401);
  assert.match(r.body.error, /Afgebroken/);
  const zonder = await laad(undefined).metVinger(() => Promise.resolve(vraag), () => ({}));
  assert.match(zonder.body.error, /passkey/, 'zonder passkeymodule zegt het scherm waarom, en stopt');
});
