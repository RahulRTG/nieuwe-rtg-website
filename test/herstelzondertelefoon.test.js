/* HERSTELLEN MOET KUNNEN, OOK ZONDER TELEFOONNUMMER.

   WAT ER MISGING. De tweede stap van het wachtwoordherstel gaat als een sms.
   Stond er geen telefoonnummer, dan viel de code terug op de tekst 'onbekend' en
   ging hij als 'sms:onbekend' de deur uit -- naar niemand. /api/auth/reset EIST
   die code, dus was herstellen voor zo'n account onmogelijk.

   En dat is niet de uitzondering maar de REGEL: de registratie vraagt met opzet
   geen telefoonnummer (naam, geboortedatum, e-mail, wachtwoord -- meer niet).
   Ondertussen meldde het antwoord vrolijk `tweestaps: true` en keek de gebruiker
   op een telefoon waar niets binnenkwam.

   Een `|| 'onbekend'` is een fallback die iets VERZINT in plaats van te weigeren
   -- dezelfde vorm als de sleutels die zichzelf opnieuw verzonnen toen ze
   ontbraken.

   DE REGEL NU: is er een tweede kanaal, dan is er een tweede stap. Is die er
   niet, dan is de link uit de e-mail het bewijs, en zegt het antwoord dat ook,
   zodat het scherm niet om een code vraagt die nooit komt. */
'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const { startServer, stop } = require('./helper');

const post = (base) => async (pad, body) => {
  const r = await fetch(base + pad, {
    method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body || {})
  });
  return { status: r.status, body: await r.json().catch(() => ({})) };
};

test('een account zonder telefoonnummer kan zijn wachtwoord herstellen', async () => {
  const srv = await startServer({ env: { SMTP_URL: '' } });
  const p = post(srv.base);
  try {
    // registreren zoals de app het doet: geen telefoonnummer
    const reg = await p('/api/auth/register', { name: 'Zonder Telefoon', email: 'zondertel@x.nl',
      password: 'geheim123', geboortedatum: '1990-01-01', pasApp: 'rtg' });
    assert.ok(reg.body.token, 'registreren zonder telefoonnummer hoort gewoon te lukken: ' + JSON.stringify(reg.body).slice(0, 140));

    const vraag = await p('/api/auth/forgot', { email: 'zondertel@x.nl' });
    assert.equal(vraag.status, 200);
    assert.equal(vraag.body.tweestaps, false,
      'zonder tweede kanaal hoort het antwoord GEEN tweede stap te beloven; anders wacht iemand op een sms die nooit komt');
    const token = String(vraag.body.devResetUrl || '').split('reset=')[1];
    assert.ok(token, 'er hoort een herstel-link te zijn: ' + JSON.stringify(vraag.body).slice(0, 140));

    const zet = await p('/api/auth/reset', { token, password: 'nieuwgeheim456' });
    assert.equal(zet.status, 200, 'de link alleen hoort te volstaan als er geen tweede kanaal is: ' + JSON.stringify(zet.body).slice(0, 160));

    const inlog = await p('/api/auth/login', { login: 'zondertel@x.nl', password: 'nieuwgeheim456', pasApp: 'rtg' });
    assert.equal(inlog.status, 200, 'en met het nieuwe wachtwoord kom je binnen: ' + JSON.stringify(inlog.body).slice(0, 140));
  } finally { stop(srv.child); }
});

test('met een telefoonnummer blijft de tweede stap gewoon verplicht', async () => {
  const srv = await startServer({ env: { SMTP_URL: '' } });
  const p = post(srv.base);
  try {
    const reg = await p('/api/auth/register', { name: 'Met Telefoon', email: 'mettel@x.nl', phone: '0612345788',
      password: 'geheim123', geboortedatum: '1990-01-01', pasApp: 'rtg' });
    assert.ok(reg.body.token);

    const vraag = await p('/api/auth/forgot', { email: 'mettel@x.nl' });
    assert.equal(vraag.body.tweestaps, true, 'met een telefoonnummer hoort er wel een tweede stap te zijn');
    const token = String(vraag.body.devResetUrl || '').split('reset=')[1];

    const zonder = await p('/api/auth/reset', { token, password: 'nieuwgeheim456' });
    assert.notEqual(zonder.status, 200,
      'zonder de code hoort het te weigeren; anders is de tweede stap een sierstuk: ' + JSON.stringify(zonder.body).slice(0, 160));

    const met = await p('/api/auth/reset', { token, code: vraag.body.devCode, password: 'nieuwgeheim456' });
    assert.equal(met.status, 200, 'met de code hoort het wel te lukken: ' + JSON.stringify(met.body).slice(0, 160));
  } finally { stop(srv.child); }
});
