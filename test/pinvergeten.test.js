/* Pin vergeten: de weg terug die er niet was.

   WAAROM DEZE TOETS BESTAAT. De algemene pin kon alleen worden gewijzigd met de
   oude pin. Wie hem kwijt was, kwam nooit meer in de kantoorrol en dus ook niet
   in de boardroom -- er was letterlijk geen weg terug. Dat is hier gebeurd, bij
   de eigenaar, op zijn eigen systeem. De reparatie is een eenmalige sleutel naar
   het eigen e-mailadres, net als bij het wachtwoord.

   Elke bewering hieronder kan zakken: de sleutel is eenmalig, hij verloopt, hij
   hoort bij EEN account, en de hele weg naar de boardroom moet er daarna
   doorheen lopen. */
'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const { startServer, stop } = require('./helper');

const post = (base) => async (pad, body, tok) => {
  const r = await fetch(base + pad, {
    method: 'POST',
    headers: Object.assign({ 'Content-Type': 'application/json' }, tok ? { Authorization: 'Bearer ' + tok } : {}),
    body: JSON.stringify(body || {})
  });
  return { status: r.status, body: await r.json().catch(() => ({})) };
};

test('een vergeten pin is te herstellen via het eigen adres, en de sleutel werkt maar een keer', async () => {
  const srv = await startServer({ env: { SMTP_URL: '' } });
  const p = post(srv.base);
  try {
    const reg = await p('/api/auth/register', { name: 'Pin Lid', email: 'pinvergeten@x.nl', phone: '0612345788',
      password: 'geheim123', geboortedatum: '1990-01-01', pasApp: 'rtg' });
    const tok = reg.body.token;
    assert.ok(tok, 'registreren lukte: ' + JSON.stringify(reg.body).slice(0, 140));

    // een pin zetten, en hem daarna "vergeten"
    const gezet = await p('/api/pin/zet', { pin: '4321' }, tok);
    assert.equal(gezet.status, 200, 'pin zetten: ' + JSON.stringify(gezet.body).slice(0, 140));

    // zonder de oude pin lukt wijzigen niet -- dat is precies de klem
    const zonder = await p('/api/pin/zet', { pin: '1111' }, tok);
    assert.equal(zonder.status, 401, 'wijzigen zonder de oude pin hoort te weigeren');

    // de weg terug
    const vraag = await p('/api/pin/vergeten', {}, tok);
    assert.equal(vraag.status, 200, 'herstel aanvragen: ' + JSON.stringify(vraag.body).slice(0, 140));
    assert.equal(vraag.body.verstuurd, true);
    assert.ok(!JSON.stringify(vraag.body).includes('pinvergeten@x.nl'),
      'het antwoord hoort het e-mailadres NIET terug te geven');
    const url = vraag.body.devPinUrl;
    assert.ok(url, 'zonder SMTP hoort de link in het antwoord te staan (dev-veld)');
    const sleutel = String(url).split('pinherstel=')[1];
    assert.ok(sleutel && sleutel.length > 20, 'er zit een sleutel in de link');

    // een te korte pin wordt geweigerd EN verbruikt de sleutel: een sleutel die
    // na een misgreep nog werkt, is geen sleutel
    const kort = await p('/api/pin/herstel', { sleutel, pin: '12' });
    assert.equal(kort.status, 400, 'een pin van twee cijfers hoort te weigeren');
    const nogmaals = await p('/api/pin/herstel', { sleutel, pin: '9876' });
    assert.equal(nogmaals.status, 400, 'dezelfde sleutel mag niet nog eens werken');

    // een verse sleutel, en dan wel goed
    const vraag2 = await p('/api/pin/vergeten', {}, tok);
    const sleutel2 = String(vraag2.body.devPinUrl).split('pinherstel=')[1];
    const klaar = await p('/api/pin/herstel', { sleutel: sleutel2, pin: '9876' });
    assert.equal(klaar.status, 200, 'herstellen: ' + JSON.stringify(klaar.body).slice(0, 140));

    // en de nieuwe pin doet het echt
    const check = await p('/api/pin/check', { pin: '9876' }, tok);
    assert.equal(check.status, 200, 'de nieuwe pin wordt aangenomen');
    const oud = await p('/api/pin/check', { pin: '4321' }, tok);
    assert.equal(oud.status, 401, 'de oude pin doet het niet meer');
  } finally { stop(srv.child); }
});

test('een gast heeft geen algemene pin en dus ook niets te herstellen', async () => {
  const srv = await startServer({ env: { SMTP_URL: '' } });
  const p = post(srv.base);
  try {
    const g = await p('/api/login', { tier: 'guest' });
    const tok = g.body.token;
    assert.ok(tok, 'gastsessie: ' + JSON.stringify(g.body).slice(0, 140));
    const vraag = await p('/api/pin/vergeten', {}, tok);
    assert.equal(vraag.status, 403, 'een gast hoort hier een nette weigering te krijgen');
  } finally { stop(srv.child); }
});
