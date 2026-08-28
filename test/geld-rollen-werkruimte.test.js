/* KOMT WERKRUIMTE B BIJ DE LICENTIEKOSTEN VAN WERKRUIMTE A?

   De vijfde rollenvraag, en de laatste van de vier vormen die dit huis kent.
   Waar de scope vandaan komt verschilt per laag, en dat is precies wat elk van
   deze bestanden vastlegt:

     bank        het voorwerp komt uit de BODY (iban, pas-id)   geld-rollen
     rechterhand de scope is req.session.key                    geld-rollen-buiten-bank
     zaak        de scope is req.supplier.code (de sessie)      geld-rollen-zaken
     school      de scope komt uit de body, het token moet erbij passen  geld-rollen-school
     werkruimte  idem -- en dit bestand is de wachter daarop

   DE VORM. werkPoort() (server/bedrijf/rollen.js) leunt op beheerVan()/lidVan()
   in server/bedrijf/index.js, en die doen het goede:

       const w = ruimteVan(req);                     // uit req.body.werkruimte
       if (!w || w.beheerToken !== String(req.body.beheerToken || ''))  -> 403

   Het token wordt tegen de GEVONDEN werkruimte gehouden. Een werkruimtecode
   die niet bij je token hoort levert geen ruimte op maar een 403. En elke
   id-opzoeking daarna loopt door `g.w` (`L(g.w)`, `g.w.leden`), dus een
   product of lid van een andere organisatie zit niet in de lijst waarin
   gezocht wordt.

   WAAROM DIT GELD IS. Een licentie draagt kostenPerJaarCenten, en een
   toewijzing boven het gekochte aantal is met zoveel woorden "een rekening die
   iemand moet betalen". Wie in de licenties van een ander kan schrijven, kan
   die rekening laten oplopen -- en in de andere richting de kosten van een
   concurrent uitlezen.

   WAT ER BEWEZEN WORDT, en het kan allemaal zakken:
     1. TEGENPROEF: A zet zijn eigen licentie en wijst hem toe, en dat landt;
     2. B met de werkruimtecode van A komt nergens binnen (403, niet 404 --
        hier is het token fout, niet het voorwerp onvindbaar);
     3. B met zijn eigen ruimte en de ids van A vindt niets;
     4. en de licentiestand van A is na alle pogingen byte-voor-byte dezelfde.

   Draai los: node --experimental-sqlite --test test/geld-rollen-werkruimte.test.js */
'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { startServer, stop } = require('./helper');

let srv, base, A = {}, B = {};
const TMP = fs.mkdtempSync(path.join(os.tmpdir(), 'rtg-werkruimte-idor-'));

const api = (pad, body) => fetch(base + '/api' + pad, {
  method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body || {})
}).then(async r => ({ status: r.status, body: await r.json().catch(() => ({})) }));

/* Een organisatie langs de echte weg: openen, iemand aanmelden, en die met het
   beheer-token toelaten. Aanmelden is nadrukkelijk GEEN toelating -- het token
   dat je bij aanmelden krijgt werkt tot dat besluit nergens voor. */
async function maakWerkruimte(naam) {
  const w = (await api('/bedrijf/werkruimte/maak', { naam, land: 'NL' })).body;
  assert.ok(w.werkruimte && w.beheerToken, naam + ' moet een werkruimte opleveren: ' + JSON.stringify(w).slice(0, 140));
  const R = { werkruimte: w.werkruimte, beheerToken: w.beheerToken };

  const l = (await api('/bedrijf/lid/aanmeld', { werkruimte: R.werkruimte, naam: 'Medewerker ' + naam })).body;
  assert.equal(l.status, 'wacht', 'aanmelden is nog geen toelating');
  await api('/bedrijf/lid/besluit', Object.assign({}, R, { lidId: l.lidId, akkoord: true }));
  R.lidId = l.lidId;
  R.lidToken = l.lidToken;
  return R;
}

test.before(async () => {
  srv = await startServer({ env: { SMTP_URL: '', RTG_DATA_DIR: TMP } });
  base = srv.base;

  A = await maakWerkruimte('Alfa Holding');
  B = await maakWerkruimte('Beta Werken');
  assert.notEqual(A.werkruimte, B.werkruimte, 'twee verschillende organisaties -- anders toetst dit niets');
  assert.notEqual(A.beheerToken, B.beheerToken);
});

test.after(() => {
  stop(srv && srv.child);
  try { fs.rmSync(TMP, { recursive: true, force: true }); } catch (e) {}
});

/* DE SLEUTELS EERST, HET VOORWERP DAARNA -- en dat is niet cosmetisch.

   Dit stond er eerst als Object.assign({ lidId: A.lidId }, B), en B draagt zijn
   EIGEN lidId. Dat overschreef precies het id dat deze toets wilde aanbieden,
   waarna B netjes zijn eigen lid toewees en de toets een 200 zag die niets met
   een IDOR te maken had. Een toets die zijn eigen aanval onderweg kwijtraakt
   meet niets -- LAT-regel 9. Vandaar deze twee helpers: de sleutels staan links
   en het voorwerp wint altijd. */
const sleutels = (R) => ({ werkruimte: R.werkruimte, beheerToken: R.beheerToken });
const als = (R, extra) => Object.assign(sleutels(R), extra || {});

const licentiesVanA = async () => JSON.stringify((await api('/bedrijf/licenties', als(A))).body);

test('1. TEGENPROEF: A zet zijn eigen licentie en wijst hem toe, en het landt', async () => {
  const zet = await api('/bedrijf/licentie/zet',
    als(A, { product: 'Ontwerpsuite', aantal: 2, kostenPerJaar: 1800 }));
  assert.equal(zet.status, 200, 'de eigenaar kan een licentie zetten: ' + JSON.stringify(zet.body).slice(0, 140));
  assert.equal(zet.body.licentie.kostenPerJaarCenten, 180000, 'en de kosten staan in centen');

  const toe = await api('/bedrijf/licentie/toewijzen', als(A, { product: 'Ontwerpsuite', lidId: A.lidId }));
  assert.equal(toe.status, 200, 'en toewijzen ook');
  assert.equal(toe.body.inGebruik, 1, 'de toewijzing LANDT ook echt');
  assert.equal(toe.body.overschrijding, 0, 'nog binnen het gekochte aantal');
});

test('2. B met de werkruimtecode van A komt nergens binnen', async () => {
  const voor = await licentiesVanA();

  /* Het token van B, de code van A. Dit is de vorm die werkt zodra iemand de
     code als hint gaat behandelen in plaats van als een sleutel die bij het
     token moet passen. Het lid-token van B krijgt dezelfde behandeling: twee
     sleutels, dezelfde vraag. */
  const alsBeheerA = { werkruimte: A.werkruimte, beheerToken: B.beheerToken };
  const alsLidA = { werkruimte: A.werkruimte, lidToken: B.lidToken };

  const pogingen = [
    ['/bedrijf/licenties', {}],
    ['/bedrijf/licentie/zet', { product: 'Ontwerpsuite', aantal: 0, kostenPerJaar: 999999 }],
    ['/bedrijf/licentie/toewijzen', { product: 'Ontwerpsuite', lidId: A.lidId, weg: true }],
    ['/bedrijf/rollen', {}]
  ];

  const doorgelaten = [];
  for (const sleutel of [alsBeheerA, alsLidA]) {
    for (const [pad, body] of pogingen) {
      const r = await api(pad, Object.assign({}, body, sleutel));
      if (r.status >= 200 && r.status < 300) doorgelaten.push(pad + ' -> ' + r.status + ' ' + JSON.stringify(r.body).slice(0, 80));
      assert.ok(r.status < 500, pad + ' viel om in plaats van te weigeren (' + r.status + ')');
      if (r.status >= 400) assert.equal(r.status, 403,
        pad + ': een vreemd token hoort 403 te geven (de sleutel is fout, niet het voorwerp zoek), kreeg ' + r.status);
    }
  }
  assert.deepEqual(doorgelaten, [], 'werkruimte B kwam met de code van A binnen');

  assert.equal(await licentiesVanA(), voor, 'de licenties van A zijn aangeraakt door B');
});

test('3. B met zijn eigen ruimte en de ids van A vindt niets', async () => {
  const voor = await licentiesVanA();

  /* Nu een geldige combinatie -- die van B -- maar met het product en het lid
     van A. De grendel is hier niet de poort maar de opzoeking: L(g.w) en
     g.w.leden kijken alleen in B zijn eigen organisatie. */
  const p1 = await api('/bedrijf/licentie/toewijzen', als(B, { product: 'Ontwerpsuite', lidId: A.lidId }));
  assert.equal(p1.status, 404, 'een product van een andere organisatie hoort onbekend te zijn, kreeg ' +
    p1.status + ' ' + JSON.stringify(p1.body).slice(0, 100));

  /* En met een product dat B WEL heeft, maar een lid van A. Zonder deze stap
     zou de 404 hierboven ook door de eerste opzoeking komen en zou het lid
     nooit getoetst zijn. */
  await api('/bedrijf/licentie/zet', als(B, { product: 'Ontwerpsuite', aantal: 5, kostenPerJaar: 10 }));
  const p2 = await api('/bedrijf/licentie/toewijzen', als(B, { product: 'Ontwerpsuite', lidId: A.lidId }));
  assert.equal(p2.status, 404, 'een lid van een andere organisatie hoort onbekend te zijn, kreeg ' +
    p2.status + ' ' + JSON.stringify(p2.body).slice(0, 100));

  const mijn = (await api('/bedrijf/licenties', als(B))).body;
  assert.ok(!JSON.stringify(mijn).includes(A.lidId), 'het lid van A staat niet in de licenties van B');
  assert.equal((mijn.licenties.find(l => l.product === 'Ontwerpsuite') || {}).inGebruik, 0,
    'B heeft niemand toegewezen: zijn eigen lid heeft hij niet aangeraakt en dat van A kwam er niet in');

  assert.equal(await licentiesVanA(), voor, 'de licenties van A zijn aangeraakt door B');
});

test('4. en A staat er na alles precies bij zoals hij hem zelf achterliet', async () => {
  const nu = (await api('/bedrijf/licenties', als(A))).body;
  const l = nu.licenties.find(x => x.product === 'Ontwerpsuite');
  assert.ok(l, 'de licentie van A bestaat nog');
  assert.equal(l.gekocht, 2, 'met het aantal dat A er zelf op zette');
  assert.equal(l.kostenPerJaarCenten, 180000, 'en de kosten die A er zelf op zette');
  assert.equal(l.inGebruik, 1, 'en zijn eigen toewijzing is niet weggehaald');
  assert.equal(l.overschrijding, 0, 'B heeft de rekening van A niet laten oplopen');
});
