'use strict';
/* REIZEN & VEILIG: EEN DUBBELTIK OP "MOMENT STARTEN" IS EEN LIVE CIRCLE.

   De voltooiproef (VOLTOOIPROEF.json, link:reizen, herstelbaar schakel 2) vond
   dat hetzelfde formulier twee keer tegelijk twee Live Circles maakte, en dat de
   gekozen zaak de aankomst twee keer zag: POST /api/veiligheid/moment/maak
   stond in geen enkele idempotentieverklaring. De verklaring staat nu in
   server/lib/idemsleutels-veiligmoment.js.

   Deze toets meet op een echte server, met een echte zaak als ontvanger, en
   heeft een TEGENPROEF: twee VERSCHILLENDE formulieren tegelijk moeten twee
   cirkels blijven. Zonder die tegenproef is "alles op een hoop" de goedkoopste
   manier om hier groen te staan. */
const test = require('node:test');
const assert = require('node:assert/strict');
const { startServer, stopNet } = require('./helper');

test('Live Circle: een dubbeltik maakt er een, twee formulieren maken er twee', { timeout: 90000 }, async () => {
  const srv = await startServer({ env: { SMTP_URL: '' } });
  const api = async (pad, body, tok) => {
    const r = await fetch(srv.base + pad, { method: 'POST', signal: AbortSignal.timeout(15000),
      headers: { 'Content-Type': 'application/json', ...(tok ? { Authorization: 'Bearer ' + tok } : {}) },
      body: JSON.stringify(body || {}) });
    return { http: r.status, ...(await r.json().catch(() => ({}))) };
  };
  try {
    const u = Date.now().toString().slice(-8);
    const lid = (await api('/api/auth/register', { name: 'Dubbeltik', email: 'dbt' + u + '@voorbeeld.nl',
      phone: '06' + u, password: 'geheim12345', geboortedatum: '1985-05-05', tier: 'rtg' })).token;
    assert.ok(lid, 'registratie gaf geen token');
    const rooster = await api('/api/supplier/roster', { code: 'KIKUNOI' });
    const man = (rooster.staff || []).find((x) => x.role === 'manager');
    const zaak = (await api('/api/supplier/login', { code: 'KIKUNOI', staffId: man.id, pin: '1234' })).token;
    assert.ok(zaak, 'geen zaaksessie');

    /* Zoals #rvMomentForm in public/apps/reizen-veilig.js het stuurt. */
    const formulier = (titel) => ({ titel, doel: 'Diner', minuten: 120,
      ontvangers: [{ soort: 'bedrijf', id: 'KIKUNOI', niveau: 'voortgang' }] });
    const telLid = async (titel) => ((await api('/api/veiligheid/moment', {}, lid)).momenten || []).filter((m) => m.titel === titel).length;
    const telZaak = async (titel) => ((await api('/api/supplier/veiligheid/aankomsten', {}, zaak)).aankomsten || []).filter((m) => m.titel === titel).length;

    const [a, b] = await Promise.all([api('/api/veiligheid/moment/maak', formulier('Taxi naar huis'), lid),
      api('/api/veiligheid/moment/maak', formulier('Taxi naar huis'), lid)]);
    assert.equal(a.http, 200);
    assert.ok(b.http < 500, 'de tweede tik mag geen storing worden (' + b.http + ')');
    assert.equal(await telLid('Taxi naar huis'), 1, 'een dubbeltik op Moment starten maakte meer dan een Live Circle');
    assert.equal(await telZaak('Taxi naar huis'), 1, 'de zaak zag de aankomst meer dan een keer');

    const [c, d] = await Promise.all([api('/api/veiligheid/moment/maak', formulier('Trein naar Parijs'), lid),
      api('/api/veiligheid/moment/maak', formulier('Diner bij Maison'), lid)]);
    assert.equal(c.http, 200); assert.equal(d.http, 200);
    assert.equal(await telLid('Trein naar Parijs') + await telLid('Diner bij Maison'), 2,
      'TEGENPROEF: twee verschillende formulieren zijn twee Live Circles, en mogen niet op een hoop');
  } finally {
    await stopNet(srv.child).catch(() => {});
  }
});
