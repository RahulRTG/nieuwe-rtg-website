'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const maakKlant = require('../server/kern/magnaat-motorklant');

async function metOmgeving(waarden, werk) {
  const oud = {};
  for (const [naam, waarde] of Object.entries(waarden)) {
    oud[naam] = process.env[naam];
    if (waarde == null) delete process.env[naam];
    else process.env[naam] = String(waarde);
  }
  try { return await werk(); }
  finally {
    for (const [naam, waarde] of Object.entries(oud)) {
      if (waarde == null) delete process.env[naam];
      else process.env[naam] = waarde;
    }
  }
}

const basisEnv = {
  RTG_MOTOR_REKEN_URL: 'http://127.0.0.1:3100',
  RTG_MAGNAAT_RUST: 'motor',
  RTG_MOTOR_REKEN_FOUTGRENS: 2,
  RTG_MOTOR_REKEN_AFKOEL_MS: 1000,
  RTG_MOTOR_REKEN_MAX_TEGELIJK: 4
};

test('herhaalde motorfouten openen de stroomonderbreker en herstel sluit hem', async () => {
  await metOmgeving(basisEnv, async () => {
    let nu = 1000;
    let aanroepen = 0;
    let stuk = true;
    const klant = maakKlant({
      nu: () => nu,
      async fetch() {
        aanroepen += 1;
        if (stuk) throw new Error('motor weg');
        return new Response('{"ok":true,"bedrijven":[],"macro":{}}', {
          status: 200, headers: { 'content-type': 'application/json' }
        });
      }
    });
    await assert.rejects(klant.markt({}), /motor weg/);
    await assert.rejects(klant.markt({}), /motor weg/);
    assert.equal(klant.status().circuit, 'open');
    await assert.rejects(klant.markt({}), fout => fout.code === 'MOTOR_CIRCUIT_OPEN');
    assert.equal(aanroepen, 2, 'een open circuit raakt het netwerk niet opnieuw');

    nu += 1001;
    stuk = false;
    const antwoord = await klant.markt({});
    assert.equal(antwoord.ok, true);
    assert.equal(klant.status().circuit, 'gesloten');
    assert.equal(klant.status().fouten, 0);
  });
});

test('na afkoeling mag precies één herstelproef tegelijk door', async () => {
  await metOmgeving(Object.assign({}, basisEnv, { RTG_MOTOR_REKEN_FOUTGRENS: 1 }), async () => {
    let nu = 1000;
    let hervat;
    let aanroepen = 0;
    const klant = maakKlant({
      nu: () => nu,
      fetch() {
        aanroepen += 1;
        if (aanroepen === 1) return Promise.reject(new Error('eerste fout'));
        return new Promise(resolve => { hervat = resolve; });
      }
    });
    await assert.rejects(klant.markt({}), /eerste fout/);
    nu += 1001;
    const proef = klant.markt({});
    await assert.rejects(klant.markt({}), fout => fout.code === 'MOTOR_CIRCUIT_OPEN');
    hervat(new Response('{"ok":true}', { status: 200 }));
    await proef;
    assert.equal(aanroepen, 2);
    assert.equal(klant.status().circuit, 'gesloten');
  });
});

test('de gelijktijdigheidsgrens valt snel terug zonder een onbegrensde wachtrij', async () => {
  await metOmgeving(Object.assign({}, basisEnv, { RTG_MOTOR_REKEN_MAX_TEGELIJK: 1 }), async () => {
    let hervat;
    const klant = maakKlant({ fetch: () => new Promise(resolve => { hervat = resolve; }) });
    const eerste = klant.markt({});
    await assert.rejects(klant.markt({}), fout => fout.code === 'MOTOR_DRUK');
    assert.equal(klant.status().actief, 1);
    hervat(new Response('{"ok":true}', { status: 200 }));
    await eerste;
    assert.equal(klant.status().actief, 0);
  });
});

test('een te groot of ongeldig motorantwoord wordt fail-closed geweigerd', async () => {
  await metOmgeving(Object.assign({}, basisEnv, { RTG_MOTOR_REKEN_MAX_ANTWOORD: 65536 }), async () => {
    const groot = maakKlant({ fetch: async () => new Response('{}', { status: 200, headers: { 'content-length': '70000' } }) });
    await assert.rejects(groot.markt({}), fout => fout.code === 'MOTOR_ANTWOORD_TE_GROOT');
    const kapot = maakKlant({ fetch: async () => new Response('geen json', { status: 200 }) });
    await assert.rejects(kapot.markt({}), fout => fout.code === 'MOTOR_PROTOCOL');
  });
});

test('het motortoken gaat alleen in de afgeschermde kop mee', async () => {
  await metOmgeving(Object.assign({}, basisEnv, { RTG_MOTOR_TOKEN: 'test-geheim' }), async () => {
    let gezien;
    const klant = maakKlant({ fetch: async (url, opties) => {
      gezien = { url, opties };
      return new Response('{"ok":true}', { status: 200 });
    } });
    await klant.markt({ bedrijven: [] });
    assert.equal(gezien.url, 'http://127.0.0.1:3100/api/reken/magnaat/markt');
    assert.equal(gezien.opties.headers['x-rtg-motor-token'], 'test-geheim');
    assert.equal(gezien.opties.body.includes('test-geheim'), false);
  });
});
