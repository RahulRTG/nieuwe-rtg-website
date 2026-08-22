/* KOMT SCHOOL B BIJ DE ADMINISTRATIE VAN SCHOOL A?

   De vierde rollenvraag. De bank, de rechterhand en de zakenkant zijn gedekt
   (test/geld-rollen.test.js, geld-rollen-buiten-bank.test.js,
   geld-rollen-zaken.test.js); dit is de school, en die zit anders in elkaar dan
   alle drie.

   HET VERSCHIL, en het is precies wat deze toets bewaakt. Bij de bank en de
   zaak komt de scope uit de SESSIE (req.session.key, req.supplier.code). Bij
   de school komt hij uit de BODY: `poort()` (server/school/rollen.js) zoekt de
   school op met `req.body.schoolCode`. Dat klinkt als een gat, en het is er
   geen -- want daarna moet het meegestuurde token van DIE school zijn:

       if (beheer && sch.token === beheer) return { sch, ... }
       const p = ... Object.values(sch.personeel).find(x => x.token === tok)

   Het token wordt dus tegen de gevonden school gehouden, niet tegen zichzelf.
   Een schoolcode die niet bij je token hoort levert geen school op maar een
   403. Dat is de eigenschap, en eigenschappen verdwijnen zodra iemand "even"
   de school uit het token afleidt en de code als hint gaat gebruiken.

   De tweede grendel zit een laag dieper: elke id-opzoeking loopt door `g.sch`
   (`leerlingLijst(g.sch)`, `FAC(g.sch)`). Een leerling- of factuur-id van een
   andere school zit simpelweg niet in de lijst waarin gezocht wordt.

   Dit gaat over echt geld: schoolgeld, ouderbijdragen, kantinesaldo. En over
   meer dan geld -- er hangt een kind aan elke regel.

   WAT ER BEWEZEN WORDT, en het kan allemaal zakken:
     1. TEGENPROEF: school A kan zijn eigen factuur maken, boeken, herinneren en
        het kantinesaldo opwaarderen, en dat LANDT ook echt;
     2. B met zijn eigen token en de schoolCode van A komt nergens binnen;
     3. B met zijn eigen school en de ids van A vindt niets;
     4. en na al die pogingen is de administratie van A byte-voor-byte dezelfde.

   Punt 4 is het punt dat telt. Een nette 403 of 404 is geen bewijs dat er
   onderweg niets is afgeboekt.

   Draai los: node --experimental-sqlite --test test/geld-rollen-school.test.js */
'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { startServer, stop } = require('./helper');

let srv, base, A = {}, B = {};
const TMP = fs.mkdtempSync(path.join(os.tmpdir(), 'rtg-school-idor-'));

const api = (pad, body) => fetch(base + '/api/foundation' + pad, {
  method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body || {})
}).then(async r => ({ status: r.status, body: await r.json().catch(() => ({})) }));
const office = (pad, body, token) => fetch(base + '/api' + pad, {
  method: 'POST', headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: 'Bearer ' + token } : {}) },
  body: JSON.stringify(body || {})
}).then(async r => ({ status: r.status, body: await r.json().catch(() => ({})) }));

/* Een school langs de echte weg: aanmelden, en het kantoor keurt goed. De
   directie werkt daarna met het beheerToken van de school. */
async function maakSchool(naam, kantoor) {
  const s = (await api('/school/school/maak', { naam, plaats: 'Zwolle' })).body;
  assert.ok(s.schoolCode && s.beheerToken, naam + ' moet een school opleveren: ' + JSON.stringify(s).slice(0, 140));
  await office('/office/school/decide', { code: s.schoolCode, action: 'goedkeuren' }, kantoor);
  return { schoolCode: s.schoolCode, beheerToken: s.beheerToken };
}

test.before(async () => {
  srv = await startServer({ env: { SMTP_URL: '', RTG_DATA_DIR: TMP } });
  base = srv.base;
  const kantoor = (await office('/office/login', { code: 'RTG-OFFICE' })).body.token;
  assert.ok(kantoor, 'het kantoor moet kunnen inloggen');

  A = await maakSchool('Het Baken', kantoor);
  B = await maakSchool('De Wissel', kantoor);
  assert.notEqual(A.schoolCode, B.schoolCode, 'twee verschillende scholen -- anders toetst dit niets');
  assert.notEqual(A.beheerToken, B.beheerToken);

  /* School A schrijft een leerling in en zet er een factuur op. Dat is de
     administratie waar B straks aan probeert te komen. */
  const l = (await api('/school/leerling/aanmeld', Object.assign({ naam: 'Fatima El Amrani' }, A))).body;
  A.leerling = l.leerling && l.leerling.id;
  assert.ok(A.leerling, 'A heeft een leerling: ' + JSON.stringify(l).slice(0, 160));

  const f = (await api('/school/factuur/maak', Object.assign({ leerlingId: A.leerling, soort: 'schoolgeld',
    bedrag: 250, omschrijving: 'Schoolgeld periode 1', vervalt: '2027-01-01' }, A))).body;
  A.factuur = f.factuur && f.factuur.id;
  assert.ok(A.factuur, 'A heeft een factuur: ' + JSON.stringify(f).slice(0, 160));

  /* En B krijgt een eigen leerling, zodat B een volwaardige, werkende school is
     en niet een lege huls die nergens bij kan omdat er niets is. */
  const lb = (await api('/school/leerling/aanmeld', Object.assign({ naam: 'Joris de Wit' }, B))).body;
  B.leerling = lb.leerling && lb.leerling.id;
  assert.ok(B.leerling, 'B heeft ook een leerling');
});

test.after(() => {
  stop(srv && srv.child);
  try { fs.rmSync(TMP, { recursive: true, force: true }); } catch (e) {}
});

/* De administratie van A in één string: de openstaande posten. Alles wat B
   afboekt, kort of herinnert komt hier terug. */
const boekenVanA = async () =>
  JSON.stringify((await api('/school/debiteuren', A)).body);

test('1. TEGENPROEF: school A bedient zijn eigen administratie, en het landt', async () => {
  const voor = (await api('/school/debiteuren', A)).body;
  assert.equal(voor.aantal, 1, 'A heeft één openstaande post');
  assert.equal(voor.openTotaal, 25000, 'van 250 euro, in centen');

  const boek = await api('/school/factuur/boek', Object.assign({ factuurId: A.factuur, bedrag: 50 }, A));
  assert.equal(boek.status, 200, 'de eigenaar kan boeken: ' + JSON.stringify(boek.body).slice(0, 140));
  assert.equal(boek.body.factuur.open, 20000, 'en de betaling LANDT ook echt');

  const kan = await api('/school/kantine/saldo', Object.assign({ leerlingId: A.leerling, bij: 10 }, A));
  assert.equal(kan.status, 200, 'en het kantinesaldo opwaarderen ook');
  assert.equal(kan.body.saldo, 1000);

  const her = await api('/school/factuur/herinner', Object.assign({ factuurId: A.factuur, tekst: 'vriendelijk' }, A));
  assert.equal(her.status, 200);
  assert.equal(her.body.herinneringen, 1);
});

test('2. B met de schoolCode van A komt nergens binnen', async () => {
  const voor = await boekenVanA();

  /* Het token van B, de schoolCode van A. Dit is de vorm die werkt zodra
     iemand de code als een hint gaat behandelen in plaats van als een sleutel
     die bij het token moet passen. */
  const alsA = { schoolCode: A.schoolCode, beheerToken: B.beheerToken };
  const pogingen = [
    ['/school/debiteuren', {}],
    ['/school/factuur/maak', { leerlingId: A.leerling, soort: 'schoolgeld', bedrag: 1, omschrijving: 'Kaping', vervalt: '2027-01-01' }],
    ['/school/factuur/boek', { factuurId: A.factuur, bedrag: 200, terugbetaling: true, reden: 'kaping' }],
    ['/school/factuur/herinner', { factuurId: A.factuur, tekst: 'kaping' }],
    ['/school/kantine/saldo', { leerlingId: A.leerling, af: 10 }],
    ['/school/budget/zet', { afdeling: 'kaping', centen: 1 }],
    ['/school/financien/rapport', {}]
  ];

  const doorgelaten = [];
  for (const [pad, body] of pogingen) {
    const r = await api(pad, Object.assign({}, body, alsA));
    if (r.status >= 200 && r.status < 300) doorgelaten.push(pad + ' -> ' + r.status + ' ' + JSON.stringify(r.body).slice(0, 80));
    assert.ok(r.status < 500, pad + ' viel om in plaats van te weigeren (' + r.status + ')');
    if (r.status >= 400) assert.equal(r.status, 403, pad + ': een vreemd token hoort 403 te geven, niet ' + r.status);
  }
  assert.deepEqual(doorgelaten, [], 'school B kwam met de code van A binnen');

  assert.equal(await boekenVanA(), voor, 'de administratie van A is aangeraakt door B');
});

test('3. B met zijn eigen school en de ids van A vindt niets', async () => {
  const voor = await boekenVanA();

  /* Nu wél een geldige combinatie van school en token -- die van B -- maar met
     de ids van A. Hier is de grendel niet de poort maar de opzoeking: `FAC(g.sch)`
     en `leerlingLijst(g.sch)` kijken alleen in B zijn eigen administratie. */
  const pogingen = [
    ['/school/factuur/boek', { factuurId: A.factuur, bedrag: 200 }],
    ['/school/factuur/herinner', { factuurId: A.factuur, tekst: 'kaping' }],
    ['/school/factuur/maak', { leerlingId: A.leerling, soort: 'schoolgeld', bedrag: 1, omschrijving: 'Kaping', vervalt: '2027-01-01' }],
    ['/school/kantine/saldo', { leerlingId: A.leerling, af: 10 }]
  ];

  for (const [pad, body] of pogingen) {
    const r = await api(pad, Object.assign({}, body, B));
    assert.equal(r.status, 404, pad + ': een id van een andere school hoort "kennen we niet" te geven, kreeg ' + r.status +
      ' ' + JSON.stringify(r.body).slice(0, 100));
  }

  /* En B ziet in zijn eigen boeken niets van A staan -- ook niet als bijvangst
     van een van de pogingen hierboven. */
  const mijn = (await api('/school/debiteuren', B)).body;
  assert.equal(mijn.aantal, 0, 'B heeft zelf niets openstaan: ' + JSON.stringify(mijn).slice(0, 160));
  assert.ok(!JSON.stringify(mijn).includes(A.factuur), 'de factuur van A staat niet in de boeken van B');
  assert.ok(!JSON.stringify(mijn).includes(A.leerling), 'de leerling van A ook niet');

  assert.equal(await boekenVanA(), voor, 'de administratie van A is aangeraakt door B');
});

test('4. en de leerling van A blijft van A -- ook in het dossier zelf', async () => {
  /* De administratie is geld; het dossier is het kind. Dezelfde vraag, en het
     antwoord hoort niet anders te zijn omdat er geen bedrag in staat. */
  const vreemd = await api('/school/dossier', Object.assign({ leerlingId: A.leerling }, B));
  assert.ok(vreemd.status >= 400, 'B mag het dossier van een leerling van A niet openen (kreeg ' + vreemd.status + ')');

  const eigen = await api('/school/dossier', Object.assign({ leerlingId: A.leerling }, A));
  assert.equal(eigen.status, 200, 'TEGENPROEF: A opent het dossier van zijn eigen leerling wel');
  assert.equal(eigen.body.leerling.naam, 'Fatima El Amrani');
});
