/* HET LEDENBESTAND MAG NIET OP VOLGNUMMER AF TE LOPEN ZIJN.

   WAT ER MISGING. /api/supplier/paspoort/vraag zoekt een lid op via de CODENAAM
   -- die de partner op het codescherm van het lid ziet, dus die krijgt hij van
   het lid zelf. Maar de handler accepteerde daarnaast ook een rechtstreekse
   `key`, en dat is 'user-<volgnummer>'.

   Daarmee was het hele ledenbestand af te struinen: user-1, user-2, user-3.
   Niveau 'bevestiging' komt zonder toestemming van het lid terug, dus van elk
   lid was zo de leeftijdsbevestiging op te vragen -- door elke partner, over
   leden die nooit bij hem binnen zijn geweest.

   Het commentaar boven die functie zei het al goed ("een partner verwijst met de
   codenaam"); de regel eronder sprak het tegen. Geen enkel scherm en geen enkele
   toets stuurde ooit `key` -- alleen de deur stond open.

   DEZE TOETS HOUDT DE DEUR DICHT. Hij loopt bewust een reeks nummers af, want
   dat is precies wat een aanvaller doet. */
'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const { startServer, stop } = require('./helper');

const api = (base) => async (pad, body, tok) => {
  const r = await fetch(base + pad, {
    method: 'POST',
    headers: Object.assign({ 'Content-Type': 'application/json' }, tok ? { Authorization: 'Bearer ' + tok } : {}),
    body: JSON.stringify(body || {})
  });
  return { status: r.status, body: await r.json().catch(() => ({})) };
};

test('een partner komt met een interne sleutel bij geen enkel lid', async () => {
  const srv = await startServer({ env: { SMTP_URL: '' } });
  const p = api(srv.base);
  try {
    // een echte partner-sessie: de manager van een zaak uit de startdata
    const roster = await p('/api/supplier/roster', { code: 'KIKUNOI' });
    const man = (roster.body.staff || []).find(x => x.role === 'manager');
    assert.ok(man, 'er hoort een manager te zijn: ' + JSON.stringify(roster.body).slice(0, 140));
    const login = await p('/api/supplier/login', { code: 'KIKUNOI', staffId: man.id, pin: '1234' });
    assert.ok(login.body.token, 'partner-inlog: ' + JSON.stringify(login.body).slice(0, 140));

    // en dan het ledenbestand aflopen, zoals een aanvaller zou doen
    const geraakt = [];
    for (let id = 1; id <= 12; id++) {
      const r = await p('/api/supplier/paspoort/vraag',
        { key: 'user-' + id, niveau: 'bevestiging', minLeeftijd: 18 }, login.body.token);
      if (r.status === 200) geraakt.push('user-' + id + ' -> ' + JSON.stringify(r.body).slice(0, 80));
    }
    assert.deepEqual(geraakt, [],
      'met een volgnummer hoort een partner NERGENS binnen te komen; dit zijn leden die nooit bij hem waren:\n  ' + geraakt.join('\n  '));
  } finally { stop(srv.child); }
});

test('met een codenaam werkt het gewoon, want zo hoort het', async () => {
  const srv = await startServer({ env: { SMTP_URL: '' } });
  const p = api(srv.base);
  try {
    const reg = await p('/api/auth/register', { name: 'Codenaam Lid', email: 'codenaamlid@x.nl',
      password: 'geheim123', geboortedatum: '1990-01-01', pasApp: 'rtg' });
    // de codenaam komt uit /api/state, net als in test/paspoort.test.js -- niet
    // uit het registratie-antwoord; hij wordt bij het eerste ophalen toegekend
    const st = await p('/api/state', {}, reg.body.token);
    const codenaam = st.body.state && st.body.state.user && st.body.state.user.codename;
    assert.ok(codenaam, 'een lid hoort een codenaam te hebben: ' + JSON.stringify(st.body).slice(0, 160));

    const roster = await p('/api/supplier/roster', { code: 'KIKUNOI' });
    const man = (roster.body.staff || []).find(x => x.role === 'manager');
    const login = await p('/api/supplier/login', { code: 'KIKUNOI', staffId: man.id, pin: '1234' });

    const r = await p('/api/supplier/paspoort/vraag',
      { codenaam, niveau: 'bevestiging', minLeeftijd: 18 }, login.body.token);
    assert.equal(r.status, 200,
      'met de codenaam die het lid zelf laat zien, hoort een leeftijdsbevestiging gewoon te kunnen: ' + JSON.stringify(r.body).slice(0, 160));
  } finally { stop(srv.child); }
});
