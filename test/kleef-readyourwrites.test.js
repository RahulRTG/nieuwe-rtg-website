/* READ-YOUR-WRITES OVER TWEE PROCESSEN -- de reden dat de kleefroutering bestaat.

   Dit is de toets die het probleem laat ZIEN en de oplossing meteen erna. Twee
   serverprocessen op dezelfde opslag; een lid bewaart een notitie en vraagt zijn
   lijst weer op.

     zonder kleefroutering  schrijf op A, lees op B -> de notitie staat er niet
     met kleefroutering     beide op hetzelfde proces -> hij staat er wel

   Gemeten op een echte opstelling (docs/meerkernig.md) is het venster waarin dat
   misgaat 733 ms op SQLite en 139-141 ms op Postgres. Hier wordt de poll met
   opzet op tien minuten gezet: dan is het venster de hele testduur, en is
   "niet zichtbaar" een uitkomst en geen kans. Een toets die soms slaagt omdat
   een achtergrondpoll net niet liep, bewijst niets.

   WAAROM DE POORTWACHTER HIER NIET DRAAIT. server/trio.js is een proxy met een
   hartslag, drie kindprocessen en een failbacktimer; die erbij halen zou meten
   of dat allemaal werkt. Wat hier bewezen moet worden is smaller: dat de KEUZE
   die trio.js maakt (server/trio-kleef.js, in trio.js een regel) het gat dicht.
   Die keuze wordt hieronder dus letterlijk aangeroepen, op echte servers.

   Draai los: node --experimental-sqlite --test test/kleef-readyourwrites.test.js */
'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { startServer, stop } = require('./helper');
const kleef = require('../server/trio-kleef.js');

const api = (base, pad, body, token) => fetch(base + '/api/' + pad, {
  method: 'POST',
  headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: 'Bearer ' + token } : {}) },
  body: JSON.stringify(body || {})
}).then(async r => ({ status: r.status, body: await r.json().catch(() => ({})) }));

/* Precies wat server/trio.js doet: het verzoek zoals de poortwachter het ziet,
   en de keuze die hij eruit maakt. */
const alsVerzoek = token => ({ headers: { authorization: 'Bearer ' + token }, url: '/api/notities/mijn' });
const kleefDoel = token => kleef.kleefIndex(alsVerzoek(token), [0, 1]);

const staatEr = (lijst, merk) => JSON.stringify(lijst && lijst.body || {}).includes(merk);

test('twee processen, een lid: de kleefroutering sluit read-your-writes', async () => {
  const TMP = fs.mkdtempSync(path.join(os.tmpdir(), 'rtg-kleef-'));
  const env = {
    RTG_STORE: 'sqlite', DATABASE_URL: '', PG_URL: '', SMTP_URL: '', RTG_DATA_DIR: TMP,
    /* Tien minuten. De kruisprocespoll mag tijdens deze toets NIET lopen, want
       dan meten we of we sneller zijn dan de poll in plaats van of we hem niet
       meer nodig hebben. */
    RTG_POLL_MS: '600000'
  };
  let s1 = null, s2 = null;
  try {
    // --- proces 1 komt op, het lid logt in ---
    s1 = await startServer({ env });
    const inlog = await fetch(s1.base + '/api/login', {
      method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ tier: 'rtg' })
    }).then(r => r.json());
    const token = inlog.token;
    assert.ok(token, 'het lid heeft een sessie op proces 1');

    // --- proces 2 komt daarna op en leest de opslag bij het starten ---
    s2 = await startServer({ env });
    const bases = [s1.base, s2.base];
    assert.notEqual(bases[0], bases[1], 'het zijn echt twee processen');

    const heen = await api(bases[1], 'notities/mijn', {}, token);
    assert.equal(heen.status, 200,
      'de sessie van proces 1 geldt ook op proces 2 -- die staat in de gedeelde opslag en wordt bij het starten gelezen');

    /* ---------- 1. ZONDER kleefroutering: om en om, zoals een gewone verdeler ---------- */
    let gezien = 0;
    for (let i = 0; i < 6; i++) {
      const merk = 'zonder-kleef-' + i + '-' + process.pid;
      const w = await api(bases[0], 'notities/bewaar', { titel: merk, tekst: 'x' }, token);
      assert.equal(w.status, 200, 'bewaren op proces 1 lukt');
      const lees = await api(bases[1], 'notities/mijn', {}, token);
      assert.equal(lees.status, 200, 'lezen op proces 2 lukt');
      if (staatEr(lees, merk)) gezien++;
      // en op het proces dat hem schreef staat hij natuurlijk wel
      assert.ok(staatEr(await api(bases[0], 'notities/mijn', {}, token), merk),
        'proces 1 ziet zijn eigen schrijfactie meteen');
    }
    assert.equal(gezien, 0,
      'DIT IS HET PROBLEEM: zonder kleefroutering ziet het lid ' + gezien + ' van de 6 notities op het andere proces');

    /* ---------- 2. MET kleefroutering: elk verzoek langs dezelfde keuze ---------- */
    const doel = kleefDoel(token);
    assert.ok(doel === 0 || doel === 1, 'de kleefroutering wijst dit lid een proces toe');
    const bezocht = new Set();
    for (let i = 0; i < 6; i++) {
      const merk = 'met-kleef-' + i + '-' + process.pid;
      const naar = bases[kleefDoel(token)];
      bezocht.add(naar);
      const w = await api(naar, 'notities/bewaar', { titel: merk, tekst: 'x' }, token);
      assert.equal(w.status, 200, 'bewaren lukt op het toegewezen proces');
      const lees = await api(bases[kleefDoel(token)], 'notities/mijn', {}, token);
      assert.equal(lees.status, 200);
      assert.ok(staatEr(lees, merk),
        'MET kleefroutering ziet het lid zijn eigen notitie meteen terug (ronde ' + i + ')');
    }
    assert.equal(bezocht.size, 1, 'en alle twaalf verzoeken gingen naar hetzelfde proces');

    /* ---------- 3. en valt dat proces weg, dan verhuist het lid ---------- */
    const naDeUitval = kleef.kleefIndex(alsVerzoek(token), [doel === 0 ? 1 : 0]);
    assert.equal(naDeUitval, doel === 0 ? 1 : 0,
      'met nog een gezonde server over gaat het lid daarheen, en niet nergens heen');
  } finally {
    stop(s1 && s1.child);
    stop(s2 && s2.child);
    try { fs.rmSync(TMP, { recursive: true, force: true }); } catch (e) {}
  }
});
