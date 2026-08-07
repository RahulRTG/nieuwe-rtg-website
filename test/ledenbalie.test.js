/* DE LEDENBALIE: helpen zonder de kluis open te breken.

   Het kantoor is een ongedeelde ruimte die je binnenkomt met een GEDEELDE code,
   en die code wijst niemand aan. Iemand helpen met zijn abonnement of wachtwoord
   raakt zijn account, en dat mag niet achter een anonieme code -- precies de
   redenering die de boardroom zelf al voert. Vandaar een eigen ZETEL.

   DEZE TOETSEN LEGGEN VOORAL VAST WAT DE BALIE NIET MAG, want dat is waar de
   merkregels zitten en wat bij een verbouwing als eerste sneuvelt:

   1. Zonder zetel komt niemand bij een dossier, ook niet met een geldige
      kantoorcode.
   2. Een dossier bevat NOOIT een naam, e-mailadres of telefoonnummer. Klantdata
      draait op codenamen; een helpdesk is geen achterdeur om die regel heen.
   3. Zonder reden geen inzage, en een reden die niets zegt telt niet.
   4. Wachtwoordherstel gaat naar het LID; de balie krijgt geen link en geen
      adres terug. Wie de link ziet, kan het account overnemen.
   5. Een abo-voorstel naar Lifestyle of Business KENT NIETS TOE. Die passen gaan
      uitsluitend via een menselijk besluit -- dat is een merkregel, geen
      voorzichtigheid. */
'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const { startServer, stop, kantoorAlsPersoon } = require('./helper');

const post = (base) => async (pad, body, tok) => {
  const r = await fetch(base + pad, {
    method: 'POST',
    headers: Object.assign({ 'Content-Type': 'application/json' }, tok ? { Authorization: 'Bearer ' + tok } : {}),
    body: JSON.stringify(body || {})
  });
  return { status: r.status, body: await r.json().catch(() => ({})) };
};

const OFFICE_CODE = 'RTG-OFFICE';

async function opzet() {
  const srv = await startServer({ env: { SMTP_URL: '', OFFICE_CODE } });
  const p = post(srv.base);
  const reg = await p('/api/auth/register', { name: 'Balie Lid', email: 'balielid@x.nl', phone: '0612349999',
    password: 'geheim123', geboortedatum: '1990-01-01', pasApp: 'rtg' });
  const st = await p('/api/state', {}, reg.body.token);
  const codenaam = st.body.state && st.body.state.user && st.body.state.user.codename;
  const eigenaar = await kantoorAlsPersoon(srv.base);
  /* De balie werkt in twee stappen, met opzet: eerst ZOEKEN op codenaam of
     steuncode (zo bevestigt de medewerker wie hij voor zich heeft), en pas dan
     het dossier op id. */
  const gevonden = await post(srv.base)('/api/office/balie/zoek', { codenaam }, eigenaar);
  const id = ((gevonden.body.treffers || [])[0] || {}).id;
  return { srv, p, codenaam, eigenaar, id, lidToken: reg.body.token, gevonden };
}

test('met alleen de gedeelde kantoorcode komt niemand bij een dossier', async () => {
  const o = await opzet();
  try {
    const kantoor = await o.p('/api/office/login', { code: OFFICE_CODE });
    assert.ok(kantoor.body.token, 'de gedeelde code geeft wel een kantoorsessie: ' + JSON.stringify(kantoor.body).slice(0, 120));

    const r = await o.p('/api/office/balie/dossier',
      { id: o.id, reden: 'lid belde over zijn abonnement' }, kantoor.body.token);
    assert.notEqual(r.status, 200,
      'een gedeelde code wijst niemand aan en hoort hier NIET binnen te komen: ' + JSON.stringify(r.body).slice(0, 160));
  } finally { stop(o.srv.child); }
});

test('een dossier bevat geen naam, adres of telefoonnummer', async () => {
  const o = await opzet();
  try {
    assert.ok(o.id, 'zoeken op codenaam hoort het lid te vinden: ' + JSON.stringify(o.gevonden.body).slice(0, 200));
    const r = await o.p('/api/office/balie/dossier',
      { id: o.id, reden: 'lid belde over zijn abonnement' }, o.eigenaar);
    assert.equal(r.status, 200, 'de eigenaar mag altijd aan de balie: ' + JSON.stringify(r.body).slice(0, 200));

    const alles = JSON.stringify(r.body);
    for (const geheim of ['Balie Lid', 'balielid@x.nl', '0612349999']) {
      assert.ok(!alles.includes(geheim),
        'dit hoort NOOIT in een dossier te staan: "' + geheim + '" -- ' + alles.slice(0, 220));
    }
    assert.ok(alles.includes(o.codenaam), 'de codenaam mag wel, anders weet de medewerker niet wie hij helpt');
  } finally { stop(o.srv.child); }
});

test('zonder reden, of met een reden die niets zegt, geen dossier', async () => {
  const o = await opzet();
  try {
    for (const reden of [undefined, '', 'x', 'test']) {
      const r = await o.p('/api/office/balie/dossier', { id: o.id, reden }, o.eigenaar);
      assert.notEqual(r.status, 200,
        'een reden hoort iets te zeggen; "' + String(reden) + '" is geen reden: ' + JSON.stringify(r.body).slice(0, 140));
    }
  } finally { stop(o.srv.child); }
});

test('wachtwoordherstel gaat naar het lid, en de balie krijgt geen link te zien', async () => {
  const o = await opzet();
  try {
    const r = await o.p('/api/office/balie/herstel',
      { id: o.id, reden: 'lid komt er niet meer in na een nieuwe telefoon' }, o.eigenaar);
    assert.equal(r.status, 200, 'de balie mag het herstel in gang zetten: ' + JSON.stringify(r.body).slice(0, 180));

    const alles = JSON.stringify(r.body);
    assert.ok(!/reset=/.test(alles), 'de herstel-link hoort NIET terug te komen; wie hem ziet, kan het account overnemen: ' + alles.slice(0, 200));
    assert.ok(!alles.includes('balielid@x.nl'), 'en het adres van het lid ook niet: ' + alles.slice(0, 200));
  } finally { stop(o.srv.child); }
});

test('een abo-voorstel naar Business kent niets toe', async () => {
  const o = await opzet();
  try {
    const voor = await o.p('/api/state', {}, o.lidToken);
    const pasVoor = voor.body.state.user.tier;

    const r = await o.p('/api/office/balie/abo',
      { id: o.id, naarPas: 'business', reden: 'lid vraagt om een zakelijke pas' }, o.eigenaar);
    assert.equal(r.status, 200, 'een voorstel vastleggen mag: ' + JSON.stringify(r.body).slice(0, 180));

    const na = await o.p('/api/state', {}, o.lidToken);
    assert.equal(na.body.state.user.tier, pasVoor,
      'de pas van het lid hoort ONVERANDERD te zijn: Lifestyle en Business gaan uitsluitend via een menselijk besluit');
  } finally { stop(o.srv.child); }
});
