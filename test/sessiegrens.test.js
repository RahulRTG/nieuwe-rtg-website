/* EEN NIEUW WACHTWOORD HOORT ELKE LOPENDE SESSIE TE BEEINDIGEN.

   WAT ER MISGING. Een sessietoken is hier staatloos: alles staat erin,
   ondertekend. Een wachtwoordwijziging veranderde daar niets aan, dus wie
   eenmaal binnen was bleef binnen -- tot de vervaldatum, dertig dagen later.
   Ook na een volledig herstel.

   Juist bij een herstel is dat verkeerd om. Iemand herstelt zijn wachtwoord
   meestal OMDAT er iets mis is: een geleend toestel, een meelezer, een gestolen
   sessie. Precies dan hoort de ander eruit te vliegen, en niet rustig te
   blijven zitten terwijl het slot achter hem wordt vervangen.

   DE OPLOSSING PAST BIJ EEN STAATLOOS TOKEN. Er valt niets weg te gooien, dus is
   er een grens per account: alles wat VOOR sessies_vanaf is uitgegeven, telt
   niet meer. Het token draagt daarvoor zijn uitgiftemoment. Een oud token zonder
   dat derde deel geldt als uitgegeven op moment 0 en valt dus af zodra er ooit
   een grens is gezet -- dat is de juiste kant om naar te falen. */
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

test('na een wachtwoordherstel werkt de oude sessie niet meer', async () => {
  const srv = await startServer({ env: { SMTP_URL: '' } });
  const p = post(srv.base);
  try {
    const reg = await p('/api/auth/register', { name: 'Sessie Lid', email: 'sessielid@x.nl',
      password: 'geheim123', geboortedatum: '1990-01-01', pasApp: 'rtg' });
    const oudToken = reg.body.token;
    assert.ok(oudToken, 'registreren: ' + JSON.stringify(reg.body).slice(0, 140));

    // de oude sessie werkt nu nog
    const voor = await p('/api/auth/me', {}, oudToken);
    assert.equal(voor.status, 200, 'de sessie hoort te werken voordat er iets verandert');

    // wachtwoord herstellen (zonder telefoon: de link is het bewijs)
    const vraag = await p('/api/auth/forgot', { email: 'sessielid@x.nl' });
    const token = String(vraag.body.devResetUrl || '').split('reset=')[1];
    const zet = await p('/api/auth/reset', { token, password: 'heelnieuw456' });
    assert.equal(zet.status, 200, 'herstellen: ' + JSON.stringify(zet.body).slice(0, 160));

    // en nu hoort de OUDE sessie dood te zijn
    const na = await p('/api/auth/me', {}, oudToken);
    assert.notEqual(na.status, 200,
      'de sessie van voor het herstel hoort te vervallen; anders blijft wie er niet meer bij hoort dertig dagen binnen');
  } finally { stop(srv.child); }
});

test('de verse sessie na het herstel werkt gewoon', async () => {
  const srv = await startServer({ env: { SMTP_URL: '' } });
  const p = post(srv.base);
  try {
    await p('/api/auth/register', { name: 'Vers Lid', email: 'verslid@x.nl',
      password: 'geheim123', geboortedatum: '1990-01-01', pasApp: 'rtg' });
    const vraag = await p('/api/auth/forgot', { email: 'verslid@x.nl' });
    const token = String(vraag.body.devResetUrl || '').split('reset=')[1];
    await p('/api/auth/reset', { token, password: 'heelnieuw456' });

    const inlog = await p('/api/auth/login', { login: 'verslid@x.nl', password: 'heelnieuw456', pasApp: 'rtg' });
    assert.equal(inlog.status, 200, 'inloggen met het nieuwe wachtwoord: ' + JSON.stringify(inlog.body).slice(0, 140));
    const me = await p('/api/auth/me', {}, inlog.body.token);
    assert.equal(me.status, 200,
      'de NIEUWE sessie hoort gewoon te werken; een grens die alles doodt is net zo fout als geen grens');
  } finally { stop(srv.child); }
});
