/* DE ZEKERING OP HET GELDPAD.

   server/kern/motorverbinding.js had drie beschermingen niet die
   server/kern/magnaat-motorklant.js tegen dezelfde motor wel heeft: een
   foutenteller met afkoelperiode, een grens op gelijktijdige verzoeken, en een
   maximum op de antwoordgrootte. Ze ontbraken op het pad waar geld loopt.

   Wat hier bewezen wordt, en het kan allemaal zakken:

     1. na genoeg STORINGEN gaat de zekering open, en dan gaat er geen netwerk
        meer uit -- dat is het hele punt: niet honderd verzoeken die elk hun
        volle time-out uitzitten terwijl de motor al dood is;
     2. EEN WEIGERING VAN DE MOTOR IS GEEN STORING. Dit is de belangrijkste
        bewering van het bestand. "Onvoldoende saldo" betekent dat de motor
        werkt. Zou dat de teller optikken, dan kan een lid dat vijf keer te veel
        probeert uit te geven de kassa sluiten voor iedereen -- een zelfgebouwde
        storing uit normaal gebruik;
     3. na de afkoeltijd gaat er EEN proef door en niet de hele wachtrij;
     4. een geslaagde proef sluit de zekering weer;
     5. een te groot antwoord wordt afgekapt in plaats van ingeslikt;
     6. een open zekering betekent dat er NIETS geboekt is -- de aanroeper krijgt
        een fout en spiegelt dus niets. Er beweegt geen cent.

   De klok en het netwerk worden geinjecteerd, zodat dit in milliseconden draait
   in plaats van in afkoelperiodes.

   Draai los: node --experimental-sqlite --test test/motorzekering.test.js */
'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const maakPay = require('../server/kern/pay/motorklant');

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
  RTG_MOTOR_GELD_URL: 'http://127.0.0.1:3100', RTG_MOTOR_TOKEN: null,
  RTG_MOTOR_GELD_FOUTGRENS: 3, RTG_MOTOR_GELD_AFKOEL_MS: 10000
};

/* Een nepmotor plus een klok die de toets zelf vooruit zet. */
function opstelling(antwoord) {
  const staat = { pogingen: 0, nu: 1000000 };
  const haal = async () => {
    staat.pogingen += 1;
    const a = typeof antwoord === 'function' ? antwoord(staat.pogingen) : antwoord;
    if (a instanceof Error) throw a;
    return { status: a.status, headers: { get: () => null }, text: async () => JSON.stringify(a.body || {}) };
  };
  return { staat, opties: { fetch: haal, nu: () => staat.nu } };
}

const boeking = { van: 'A', naar: 'B', centen: 100 };

test('1. na genoeg storingen gaat de zekering open en gaat er geen netwerk meer uit', async () => {
  await metEnv(AAN, async () => {
    const o = opstelling(new Error('connect ECONNREFUSED'));
    const pay = maakPay(o.opties);
    for (let i = 0; i < 3; i++) {
      const r = await pay.boekGuard(boeking);
      assert.equal(r.status, 502, 'poging ' + (i + 1) + ' probeert het echt en faalt');
    }
    assert.equal(o.staat.pogingen, 3, 'drie keer het netwerk op');
    assert.equal(pay.stand().zekering, 'open');

    const r4 = await pay.boekGuard(boeking);
    assert.equal(o.staat.pogingen, 3, 'de vierde raakt het netwerk NIET meer -- dat is het hele punt');
    assert.equal(r4.status, 503);
    assert.match(r4.error, /uit de route/);
    assert.equal(r4.ok, undefined, 'en er is dus niets geboekt om te spiegelen');
  });
});

test('2. een WEIGERING van de motor is geen storing en sluit de kassa niet', async () => {
  await metEnv(AAN, async () => {
    // de motor werkt prima en zegt tien keer achter elkaar: onvoldoende saldo
    const o = opstelling({ status: 402, body: { error: 'Onvoldoende saldo.' } });
    const pay = maakPay(o.opties);
    for (let i = 0; i < 10; i++) {
      const r = await pay.boekGuard(boeking);
      assert.equal(r.status, 402, 'de weigering komt gewoon door');
      assert.equal(r.error, 'Onvoldoende saldo.');
    }
    assert.equal(o.staat.pogingen, 10, 'alle tien zijn echt gevraagd');
    assert.equal(pay.stand().zekering, 'gesloten', 'een werkende motor die NEE zegt is geen storing');
    assert.equal(pay.stand().fouten, 0, 'de teller blijft op nul');
  });
});

test('3. na de afkoeltijd gaat er EEN proef door en niet de hele wachtrij', async () => {
  await metEnv(AAN, async () => {
    let laatDoor = false;
    const o = opstelling(() => {
      if (!laatDoor) throw new Error('connect ECONNREFUSED');
      return { status: 200, body: { ok: true, boeking: { id: 'b1' } } };
    });
    const pay = maakPay(o.opties);
    for (let i = 0; i < 3; i++) await pay.boekGuard(boeking);
    assert.equal(pay.stand().zekering, 'open');

    o.staat.nu += 10001;                       // de afkoeltijd is om
    assert.equal(pay.stand().zekering, 'half-open');

    /* Twee tegelijk: de eerste is de proef, de tweede hoort te wachten. Zonder
       die grendel stormt de hele wachtrij op een motor die misschien nog ligt. */
    laatDoor = true;
    const voor = o.staat.pogingen;
    const [a, b] = await Promise.all([pay.boekGuard(boeking), pay.boekGuard(boeking)]);
    const erdoor = [a, b].filter(r => r.ok).length;
    const geweigerd = [a, b].filter(r => r.status === 503).length;
    assert.equal(erdoor, 1, 'precies EEN proef komt erdoor');
    assert.equal(geweigerd, 1, 'de andere wordt netjes teruggestuurd');
    assert.equal(o.staat.pogingen, voor + 1, 'en dus maar EEN keer het netwerk op');
  });
});

test('4. een geslaagde proef sluit de zekering weer', async () => {
  await metEnv(AAN, async () => {
    let stuk = true;
    const o = opstelling(() => {
      if (stuk) throw new Error('connect ECONNREFUSED');
      return { status: 200, body: { ok: true, boeking: { id: 'b1' } } };
    });
    const pay = maakPay(o.opties);
    for (let i = 0; i < 3; i++) await pay.boekGuard(boeking);
    assert.equal(pay.stand().zekering, 'open');

    o.staat.nu += 10001;
    stuk = false;
    const r = await pay.boekGuard(boeking);
    assert.equal(r.ok, true, 'de proef lukt');
    assert.equal(pay.stand().zekering, 'gesloten', 'en daarmee is de route weer open');
    assert.equal(pay.stand().fouten, 0);
    // en het gewone verkeer loopt weer
    assert.equal((await pay.boekGuard(boeking)).ok, true);
  });
});

test('5. een te groot antwoord wordt afgekapt in plaats van ingeslikt', async () => {
  await metEnv(Object.assign({}, AAN, { RTG_MOTOR_GELD_MAX_ANTWOORD: 65536 }), async () => {
    const reus = 'x'.repeat(200000);
    const haal = async () => ({
      status: 200,
      headers: { get: (n) => (String(n).toLowerCase() === 'content-length' ? String(reus.length) : null) },
      text: async () => reus,
      body: { cancel: async () => {} }
    });
    const pay = maakPay({ fetch: haal, nu: Date.now });
    const r = await pay.boekGuard(boeking);
    assert.equal(r.ok, undefined, 'een te groot antwoord telt nooit als een geslaagde boeking');
    assert.equal(r.status, 502);
    assert.match(r.error, /te groot/);
  });
});

test('6. de gelijktijdigheidsgrens houdt de stapel klein', async () => {
  await metEnv(Object.assign({}, AAN, { RTG_MOTOR_GELD_MAX_TEGELIJK: 2 }), async () => {
    let los;
    const wacht = new Promise(r => { los = r; });
    let bezig = 0, piek = 0;
    const haal = async () => {
      bezig += 1; piek = Math.max(piek, bezig);
      await wacht;
      bezig -= 1;
      return { status: 200, headers: { get: () => null }, text: async () => JSON.stringify({ ok: true, boeking: { id: 'b' } }) };
    };
    const pay = maakPay({ fetch: haal, nu: Date.now });
    const lopend = [pay.boekGuard(boeking), pay.boekGuard(boeking), pay.boekGuard(boeking)];
    // even de loop laten draaien zodat de eerste twee echt onderweg zijn
    await new Promise(r => setImmediate(r));
    /* EERST loslaten, DAN pas beweren. Dit stond andersom, en dat maakte de
       toets afhankelijk van het gedrag dat hij moest bewijzen: zonder grens
       bleef de derde hangen op dezelfde belofte, liep de await vast en zakte de
       toets als een TIME-OUT in plaats van als een bewering. Rood was hij wel,
       maar stilvallen is geen uitkomst (LAT.md regel 3) -- en een afgebroken
       toets vertelt je niet WAT er mis is. Nu falen alle drie de beloftes
       gewoon af en zegt de bewering zelf wat er niet klopte. */
    los();
    const uit = await Promise.all(lopend);
    const geweigerd = uit.filter(r => r.status === 503);
    assert.equal(geweigerd.length, 1, 'precies EEN wordt teruggestuurd in plaats van opgestapeld');
    assert.match(geweigerd[0].error, /tegelijk/);
    assert.equal(uit.filter(r => r.ok).length, 2, 'en de andere twee lopen gewoon door');
    assert.ok(piek <= 2, 'er stonden er nooit meer dan twee tegelijk open, gemeten piek: ' + piek);
  });
});
