/* De gedeelde motorverbinding op het GELDPAD, in de AAN-stand.

   Waarom dit bestand er is. server/kern/pay/motorklant.js en
   server/kern/bank/motorklant.js waren twee bijna identieke bestanden; ze staan
   nu allebei op server/kern/motorverbinding.js. Toen ik dat samenvoegde bleek er
   maar een toets te bestaan die ze aanraakte (test/rust-noodstop.test.js), en
   die dekt uitsluitend de UIT-stand: alles staat af, er gaat geen netwerk uit.

   Dat is de helft die niets kan kosten. De andere helft -- motor AAN, er wordt
   echt geboekt -- had geen enkele toets, en dat is precies de code die ik
   verplaatste. Een samenvoeging op een geldpad zonder toets op de kant waar het
   geld loopt is geen samenvoeging maar een gok.

   Wat hier bewezen wordt, en het kan allemaal zakken:
     1. elke client praat met ZIJN eigen twee paden. Zou de samenvoeging ze
        verwisseld hebben, dan boekt de bank op het pay-grootboek -- de duurste
        denkbare fout, en aan de buitenkant onzichtbaar want beide antwoorden
        zien er hetzelfde uit;
     2. het poortwacht-token gaat mee als het gezet is;
     3. centen worden afgerond voor ze de deur uit gaan;
     4. een weigering van de motor komt terug als een FOUT met zijn statuscode,
        en nooit als ok -- de caller past dan niets toe op de spiegel;
     5. een antwoord dat ok zegt maar geen boeking meestuurt geldt als fout
        (half antwoord is geen bevestiging);
     6. een time-out en een dode motor worden vertaald, niet gegooid;
     7. motor-modus zonder URL faalt bij het OPBOUWEN, niet pas bij de eerste
        boeking.

   Draai los: node --experimental-sqlite --test test/motorverbinding.test.js */
'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');

const maakPay = require('../server/kern/pay/motorklant');
const maakBank = require('../server/kern/bank/motorklant');

/* Env zetten, werk doen, env exact terugzetten. Zelfde vorm als in
   test/rust-noodstop.test.js, zodat de twee bestanden elkaar niet tegenspreken. */
async function metEnv(waarden, werk) {
  const oud = {};
  for (const [naam, waarde] of Object.entries(waarden)) {
    oud[naam] = process.env[naam];
    if (waarde === null) delete process.env[naam];
    else process.env[naam] = String(waarde);
  }
  try { return await werk(); }
  finally {
    for (const [naam, waarde] of Object.entries(oud)) {
      if (waarde === undefined) delete process.env[naam];
      else process.env[naam] = waarde;
    }
  }
}

const AAN = {
  RTG_RUST_ALLES_UIT: null, RTG_MOTOR_GELD: 'motor',
  RTG_MOTOR_GELD_URL: 'http://127.0.0.1:3100', RTG_MOTOR_TOKEN: null
};

/* Een nep-motor die opschrijft wat hij kreeg en teruggeeft wat de toets wil. */
function nepMotor(antwoord) {
  const gezien = [];
  const oud = globalThis.fetch;
  globalThis.fetch = async (url, opties) => {
    gezien.push({ url, koppen: opties.headers, body: JSON.parse(opties.body || '{}') });
    const a = typeof antwoord === 'function' ? await antwoord(url) : antwoord;
    if (a instanceof Error) throw a;
    /* text() en een headers.get, want de client leest het antwoord sinds de
       zekering BEGRENSD uit (server/kern/motorverbinding.js): eerst kijken hoe
       groot het is, dan pas binnenhalen. Een nepmotor die alleen json() kan,
       modelleert dat pad niet meer. */
    return { status: a.status, headers: { get: () => null }, text: async () => JSON.stringify(a.body || {}) };
  };
  return { gezien, herstel: () => { globalThis.fetch = oud; } };
}

test('1. elke client praat met zijn eigen twee paden', async () => {
  await metEnv(AAN, async () => {
    const m = nepMotor({ status: 200, body: { ok: true, boeking: { id: 'b1' }, saldi: { a: 1 } } });
    try {
      const pay = maakPay(), bank = maakBank();
      await pay.boekGuard({ van: 'A', naar: 'B', centen: 100 });
      await bank.bankBoek({ van: 'A', naar: 'B', centen: 100 });
      await pay.saldiSnapshot();
      await bank.bankSaldiSnapshot();
      assert.deepEqual(m.gezien.map(g => g.url), [
        'http://127.0.0.1:3100/api/pay/boekguard',
        'http://127.0.0.1:3100/api/bank/boek',
        'http://127.0.0.1:3100/api/motor/saldi',
        'http://127.0.0.1:3100/api/bank/saldi'
      ], 'pay en bank hebben elk hun eigen grootboek; verwisselen is onzichtbaar en fataal');
    } finally { m.herstel(); }
  });
});

test('2. het poortwacht-token gaat mee, en alleen als het gezet is', async () => {
  await metEnv(Object.assign({}, AAN, { RTG_MOTOR_TOKEN: 'geheim-motortoken' }), async () => {
    const m = nepMotor({ status: 200, body: { ok: true, boeking: { id: 'b1' } } });
    try {
      await maakPay().boekGuard({ van: 'A', naar: 'B', centen: 1 });
      assert.equal(m.gezien[0].koppen['x-rtg-motor-token'], 'geheim-motortoken');
      assert.equal(m.gezien[0].koppen['content-type'], 'application/json');
    } finally { m.herstel(); }
  });
  await metEnv(AAN, async () => {
    const m = nepMotor({ status: 200, body: { ok: true, boeking: { id: 'b1' } } });
    try {
      await maakPay().boekGuard({ van: 'A', naar: 'B', centen: 1 });
      assert.equal('x-rtg-motor-token' in m.gezien[0].koppen, false, 'geen token gezet: ook geen kop');
    } finally { m.herstel(); }
  });
});

test('3. centen gaan afgerond de deur uit', async () => {
  await metEnv(AAN, async () => {
    const m = nepMotor({ status: 200, body: { ok: true, boeking: { id: 'b1' } } });
    try {
      await maakPay().boekGuard({ van: 'A', naar: 'B', centen: 12.6 });
      await maakBank().bankBoek({ van: 'A', naar: 'B', centen: '99.4' });
      assert.equal(m.gezien[0].body.centen, 13, 'een halve cent bestaat niet op het grootboek');
      assert.equal(m.gezien[1].body.centen, 99, 'ook als hij als tekst binnenkomt');
    } finally { m.herstel(); }
  });
});

test('4. een weigering van de motor is een fout met zijn eigen statuscode', async () => {
  await metEnv(AAN, async () => {
    const m = nepMotor({ status: 402, body: { error: 'Onvoldoende saldo.' } });
    try {
      const r = await maakPay().boekGuard({ van: 'A', naar: 'B', centen: 100 });
      assert.equal(r.ok, undefined, 'een weigering mag NOOIT als ok terugkomen');
      assert.equal(r.status, 402, 'de statuscode van de motor blijft staan');
      assert.equal(r.error, 'Onvoldoende saldo.', 'en zijn reden ook');
      assert.equal(r.boeking, undefined, 'er is niets geboekt om te spiegelen');
    } finally { m.herstel(); }
  });
});

test('5. ok zonder boeking is geen bevestiging', async () => {
  await metEnv(AAN, async () => {
    const m = nepMotor({ status: 200, body: { ok: true } });   // half antwoord
    try {
      const p = await maakPay().boekGuard({ van: 'A', naar: 'B', centen: 100 });
      const b = await maakBank().bankBoek({ van: 'A', naar: 'B', centen: 100 });
      assert.equal(p.ok, undefined, 'pay: half antwoord telt niet als geboekt');
      assert.equal(p.error, 'Motor weigerde de boeking.');
      assert.equal(b.ok, undefined, 'bank: idem');
      assert.equal(b.error, 'Motor weigerde de bankboeking.', 'en de bank zegt bankboeking, zodat het log te lezen blijft');
    } finally { m.herstel(); }
  });
});

test('6. een dode motor en een time-out worden vertaald, niet gegooid', async () => {
  await metEnv(AAN, async () => {
    const stuk = new Error('connect ECONNREFUSED');
    const m = nepMotor(stuk);
    try {
      const r = await maakPay().boekGuard({ van: 'A', naar: 'B', centen: 1 });
      assert.equal(r.status, 502);
      assert.match(r.error, /Motor onbereikbaar/, 'geen uitzondering het geldpad op');
      const s = await maakBank().bankSaldiSnapshot();
      assert.equal(s.status, 502, 'ook de saldi-kant vertaalt in plaats van te gooien');
    } finally { m.herstel(); }
  });
  await metEnv(AAN, async () => {
    const afgebroken = new Error('afgebroken'); afgebroken.name = 'AbortError';
    const m = nepMotor(afgebroken);
    try {
      const r = await maakPay().boekGuard({ van: 'A', naar: 'B', centen: 1 });
      assert.equal(r.error, 'Motor-time-out.', 'een time-out heeft een eigen, herkenbare tekst');
      assert.equal(r.status, 502);
    } finally { m.herstel(); }
  });
});

test('7. motor-modus zonder URL faalt bij het opbouwen, niet pas bij de eerste boeking', async () => {
  await metEnv({ RTG_RUST_ALLES_UIT: null, RTG_MOTOR_GELD: 'motor', RTG_MOTOR_GELD_URL: null, RTG_MOTOR_SHADOW: null }, async () => {
    /* Fail-closed op de configuratie. Zou dit pas bij de eerste boeking klappen,
       dan draait er een server die er gezond uitziet tot het moment dat er geld
       loopt -- en dan is het te laat om nog rustig te kijken. */
    assert.throws(() => maakPay(), /RTG_MOTOR_GELD=motor maar geen/, 'pay weigert te starten');
    assert.throws(() => maakBank(), /RTG_MOTOR_GELD=motor maar geen/, 'bank ook');
  });
});
