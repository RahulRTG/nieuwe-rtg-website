/* De zakelijke deur van het communicatieplatform (routes/supplier/comm.js).

   comm-actor.test.js toetst het MODEL: de sleutels, de naamruimtes, de poort.
   Deze toets doet hetzelfde over de echte routes, met echte inlogs, want een
   model dat klopt zegt niets over een route die de sleutel ergens anders
   vandaan haalt. Dat is precies het soort fout dat in de kern niet te zien is:
   de kern doet braaf wat er gevraagd wordt, en de route vraagt het verkeerde.

   VIER BELOFTES:

   1. TWEE COLLEGA'S HEBBEN EEN GESPREK, en het werkt echt: openen, sturen,
      lezen. Zonder deze eerste zegt de rest niets -- een deur die niemand
      binnenlaat lekt ook niet.
   2. DE ZAAK LEEST NIET MEE IN EEN COLLEGA-GESPREK. Elke medewerker draagt de
      zaaksleutel in zijn sessie; als die ook in een onderling gesprek zou
      staan, las het halve team mee.
   3. EEN ANDERE ZAAK KOMT ER LANGS GEEN ENKELE WEG IN, ook niet met het
      gesprek-id in de hand.
   4. EEN ZAAK KOMT NIET IN EEN GESPREK TUSSEN TWEE LEDEN. Dit is de reden dat
      deze verbouwing eng was: de deelnemerslijst is de enige poort, dus als
      een leverancier zijn eigen sleutel mag kiezen, kiest hij die van een lid.

   Draai: npm run e2e */
const test = require('node:test');
const assert = require('node:assert/strict');
const { startServer, stop } = require('./helper');
const fs = require('fs');
const os = require('os');
const path = require('path');

async function post(base, pad, body, tok) {
  const r = await fetch(base + pad, { method: 'POST',
    headers: Object.assign({ 'Content-Type': 'application/json' }, tok ? { Authorization: 'Bearer ' + tok } : {}),
    body: JSON.stringify(body || {}) });
  const d = await r.json().catch(() => ({}));
  return Object.assign({ _status: r.status }, d);
}

/* Twee collega's bij dezelfde zaak plus een medewerker van een ANDERE zaak:
   dat derde paar ogen is het meetinstrument. De PINs komen uit de seed
   (1234 voor de manager, 5678 voor de rest); het rooster is openbaar omdat
   het inlogscherm het nodig heeft. */
async function zaakVolk(base, code) {
  const roster = await post(base, '/api/supplier/roster', { code });
  assert.ok(roster.staff && roster.staff.length >= 2, 'rooster van ' + code + ' heeft twee mensen nodig');
  const man = roster.staff.find((x) => x.role === 'manager') || roster.staff[0];
  const ander = roster.staff.find((x) => x.id !== man.id);
  const inlog = async (s, pin) => {
    const r = await post(base, '/api/supplier/login', { code, staffId: s.id, pin });
    assert.ok(r.token, 'inlog ' + code + '/' + s.name + ': ' + (r.error || ''));
    return { token: r.token, id: s.id, naam: s.name };
  };
  return { A: await inlog(man, '1234'), B: await inlog(ander, '5678') };
}

async function metServer(fn) {
  const TMP = fs.mkdtempSync(path.join(os.tmpdir(), 'rtg-commzaak-'));
  const { child, base } = await startServer({ env: { SMTP_URL: '', RTG_DATA_DIR: TMP, RTG_DEMO: '1' } });
  try { await fn(base); } finally {
    stop(child);
    try { fs.rmSync(TMP, { recursive: true, force: true }); } catch (e) {}
  }
}

test('twee collegas praten via de kern, en de zaak leest niet mee', async () => {
  await metServer(async (base) => {
    const eigen = await zaakVolk(base, 'KIKUNOI');
    const vreemd = await zaakVolk(base, 'ESVEDRA');

    // 1. het werkt
    const begin = await post(base, '/api/supplier/comm/collega', { staffId: eigen.B.id }, eigen.A.token);
    assert.ok(begin.ok, 'A opent een gesprek met collega B: ' + (begin.error || ''));
    const id = begin.gesprek.id;
    assert.ok((await post(base, '/api/supplier/comm/stuur',
      { id, tekst: 'neem jij de late dienst' }, eigen.A.token)).ok, 'A stuurt');

    const bijB = await post(base, '/api/supplier/comm/gesprek', { id }, eigen.B.token);
    assert.equal(bijB.gesprek.berichten[0].tekst, 'neem jij de late dienst', 'B leest het');
    assert.equal(bijB.gedeeld, false, 'dit is geen gedeelde zaakinbox');
    assert.match(bijB.alsWie, /^mens:KIKUNOI:/, 'B komt binnen als persoon, niet als zaak');

    // en het staat in zijn inbox
    const inbox = await post(base, '/api/supplier/comm/inbox', {}, eigen.B.token);
    assert.ok(inbox.gesprekken.some((g) => g.id === id), 'het gesprek staat in de inbox van B');

    /* 2. Een derde collega van DEZELFDE zaak hoort er niet bij. De zaaksleutel
          zit in zijn sessie, dus als die ook in dit gesprek stond, was hij
          binnen. Het rooster van KIKUNOI is klein; de manager telt hier als de
          derde partij zodra we een gesprek tussen twee anderen zouden hebben.
          Wat we wel kunnen meten: de zaakinbox zelf ziet het niet als gedeeld. */
    assert.ok(inbox.gesprekken.every((g) => g.id !== id || g.gedeeld === false),
      'een onderling gesprek werd als gedeelde zaakinbox getoond');

    // 3. een andere zaak komt er langs geen enkele weg in
    const wegen = [
      ['lezen', '/api/supplier/comm/gesprek', { id }],
      ['sturen', '/api/supplier/comm/stuur', { id, tekst: 'ik hoor hier niet' }],
      ['lezen-melden', '/api/supplier/comm/lees', { id }],
      ['typen', '/api/supplier/comm/typt', { id }]
    ];
    const open = [];
    for (const [naam, pad, body] of wegen) {
      const r = await post(base, pad, body, vreemd.A.token);
      if (r.ok || r._status === 200) open.push(naam);
    }
    assert.deepEqual(open, [], 'een andere zaak kwam binnen via: ' + open.join(', '));
    const zoek = await post(base, '/api/supplier/comm/zoek', { vraag: 'late dienst' }, vreemd.A.token);
    assert.equal((zoek.treffers || []).length, 0, 'een andere zaak kon erin zoeken');

    // en een collega van die andere zaak kan er geen gesprek mee beginnen
    const kaap = await post(base, '/api/supplier/comm/collega', { staffId: eigen.B.id }, vreemd.A.token);
    assert.ok(!kaap.ok, 'een vreemde zaak opende een gesprek met andermans personeel');
    assert.match(kaap.error || '', /niet gevonden/i);
  });
});

test('een zaak komt niet in het gesprek van twee leden', async () => {
  await metServer(async (base) => {
    const A = await post(base, '/api/login', { tier: 'rtg', pasApp: 'rtg' });
    const B = await post(base, '/api/login', { tier: 'business', pasApp: 'business' });
    assert.ok(A.token && B.token, 'demo-inlog (staat RTG_DEMO=1 aan?)');
    assert.ok((await post(base, '/api/member/connect', { key: 'business' }, A.token)).ok);
    assert.ok((await post(base, '/api/member/connect/respond', { key: 'rtg', action: 'accept' }, B.token)).ok);

    const g = await post(base, '/api/comm/begin', { met: 'business' }, A.token);
    assert.ok(g.ok, 'A begint een gesprek met B: ' + (g.error || ''));
    const id = g.gesprek.id;
    assert.ok((await post(base, '/api/comm/stuur', { id, tekst: 'Onder ons.' }, A.token)).ok);

    const zaak = (await zaakVolk(base, 'KIKUNOI')).A;
    const open = [];
    for (const [naam, pad, body] of [
      ['lezen', '/api/supplier/comm/gesprek', { id }],
      ['sturen', '/api/supplier/comm/stuur', { id, tekst: 'meegelezen' }],
      ['lezen-melden', '/api/supplier/comm/lees', { id }],
      ['typen', '/api/supplier/comm/typt', { id }]
    ]) {
      const r = await post(base, pad, body, zaak.token);
      if (r.ok || r._status === 200) open.push(naam);
    }
    assert.deepEqual(open, [], 'een zaak kwam in een ledengesprek via: ' + open.join(', '));

    /* EN NU DE POGING ZELF, want de vier hierboven meten alleen dat de route
       de goede sleutel gebruikt -- niet dat er geen weg is om hem te KIEZEN.
       Dat is de hele belofte van dit ontwerp: de sleutel wordt afgeleid uit de
       sessie en nergens aangeleverd. Zou een van deze velden ooit gelezen
       worden -- door een handige toevoeging, door een route die "even" een
       parameter accepteert -- dan staat een leverancier met de sleutel van een
       lid in een gesprek dat niet van hem is, en meet niets anders in deze
       toets dat. Vandaar dat de namen die een programmeur zou kiezen er
       allemaal in staan. */
    const namen = ['alsWie', 'van', 'sleutel', 'key', 'deelnemer', 'actor', 'mij'];
    const gelukt = [];
    for (const veld of namen) {
      for (const waarde of ['rtg', 'business']) {
        const r = await post(base, '/api/supplier/comm/gesprek',
          { id, [veld]: waarde }, zaak.token);
        if (r.ok || r._status === 200) gelukt.push(veld + '=' + waarde);
        const s = await post(base, '/api/supplier/comm/stuur',
          { id, tekst: 'namens een lid', [veld]: waarde }, zaak.token);
        if (s.ok || s._status === 200) gelukt.push('stuur:' + veld + '=' + waarde);
      }
    }
    assert.deepEqual(gelukt, [],
      'een zaak kon zelf opgeven wie hij was, via: ' + gelukt.join(', '));

    /* En het gesprek is er niet door veranderd: geen leeg bericht, geen
       deelnemer erbij. Een poort die weigert maar onderweg wel iets schrijft,
       is geen poort. */
    const na = await post(base, '/api/comm/gesprek', { id }, B.token);
    assert.equal(na.gesprek.berichten.length, 1, 'er is onderweg toch iets geschreven');
    assert.equal(na.gesprek.aantal, 2, 'er is een deelnemer bij gekomen');
  });
});
