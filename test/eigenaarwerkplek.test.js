/* De eigenaar ziet zijn werkplek, OOK in productie.

   server/eigenaar.js legt vast dat de eigenaar bij de beheeromgevingen kan, met
   zoveel woorden: "de RTG-Backoffice (met zijn eigen accountlogin, zonder
   aparte code)". Achter de deur klopte dat ook: boardroomWie() kent hem, en
   accStart munt voor de rol 'kantoor' een echte office-sessie.

   Maar de sleutelbos ervoor werd gevuld door zetEigenaarsAccount(), en die
   staat achter `if (DEMO)`. Op een productie-installatie (NODE_ENV=production)
   draait hij dus nooit, en dan kreeg de eigenaar in de Werk-kiezer op zijn
   telefoon "Nog geen werkplek gekoppeld" -- terwijl koppelen om de
   backoffice-code vraagt die hij als eigenaar niet nodig hoort te hebben. Een
   belofte in de tekst die de code alleen in demostand nakwam.

   Deze toets bootst die stand na binnen de gewone toetsomgeving: hij haalt de
   gekoppelde kantoorrol die de demo-seed neerzet er eerst AF, en kijkt dan of
   de eigenaar de backoffice nog steeds ziet. Dat is precies de toestand van een
   productie-installatie, zonder de server in productiestand te hoeven zetten
   (die eist TLS, en dan toetsen we de opstart in plaats van de sleutelbos). */
const test = require('node:test');
const assert = require('node:assert/strict');
const { startServer, stop } = require('./helper');

const api = async (base, pad, body, token) => {
  const h = { 'Content-Type': 'application/json' };
  if (token) h.Authorization = 'Bearer ' + token;
  const r = await fetch(base + pad, { method: 'POST', headers: h, body: JSON.stringify(body || {}) });
  return { status: r.status, body: await r.json() };
};

test('zonder koppeling houdt de eigenaar zijn kantoorsleutel, een ander lid niet', async () => {
  /* Het eigenaarsaccount staat er al voordat er iemand registreert: de opstart
     zet het neer op RTG_OWNER_EMAIL met het demowachtwoord. We loggen dus in
     in plaats van te registreren. */
  const WW = 'eigenaarsproef123';
  const { child, base } = await startServer({ env: { SMTP_URL: '',
    RTG_OWNER_EMAIL: 'baas@rtg.test', DEMO_PASS: WW } });
  try {
    const baas = (await api(base, '/api/auth/login', { login: 'baas@rtg.test', password: WW })).body;
    const ander = (await api(base, '/api/auth/register', { name: 'Gewoon Lid', email: 'lid@rtg.test',
      password: 'geheim123', geboortedatum: '1990-01-01', tier: 'rtg' })).body;
    assert.ok(baas.token, 'de eigenaar kan inloggen');
    assert.ok(ander.token, 'en een gewoon lid registreert normaal');

    /* De demo-seed koppelt de kantoorrol; op een productie-installatie gebeurt
       dat niet. Die koppeling halen we er hier af, zodat we meten wat de
       eigenaar op een ECHTE installatie ziet. */
    const los = await api(base, '/api/account/ontkoppel', { rol: 'kantoor' }, baas.token);
    assert.equal(los.status, 200, 'de gekoppelde kantoorrol laat zich losmaken');

    const rBaas = (await api(base, '/api/account/rollen', {}, baas.token)).body;
    const rAnder = (await api(base, '/api/account/rollen', {}, ander.token)).body;

    const kantoor = (rBaas.rollen || []).filter(x => x.rol === 'kantoor');
    assert.equal(kantoor.length, 1, 'de eigenaar ziet de RTG-Backoffice ook zonder koppeling');
    assert.equal(kantoor[0].viaEigenaar, true, 'en wel afgeleid uit zijn eigenaarschap');
    assert.equal((rAnder.rollen || []).filter(x => x.rol === 'kantoor').length, 0,
      'een gewoon lid krijgt die sleutel NIET');

    // en de deur gaat ook echt open, met dezelfde sessie als de losse inlog
    const start = await api(base, '/api/account/start', { rol: 'kantoor' }, baas.token);
    assert.equal(start.status, 200, 'de eigenaar opent de backoffice zonder aparte code');
    assert.ok(start.body.token, 'er komt een echte kantoorsessie uit');

    const startAnder = await api(base, '/api/account/start', { rol: 'kantoor' }, ander.token);
    assert.equal(startAnder.status, 404, 'een ander lid komt daar niet binnen');
  } finally { stop(child); }
});
