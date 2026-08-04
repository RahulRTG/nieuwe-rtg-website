/* DE MENSELIJKE BANEN -- kan elk mens in dit huis bij zijn eigen werk?

   WAAROM DIT ER IS

   Dit huis kent 60 afdelingen en 157 mensen met een baan: van de kok in
   KIKUNOI tot de meldkamer van GUARDIA, van de brigadecommandant van de
   Koninklijke Marechaussee tot de trainer van FCRTG en de fiscalist van
   LEXNOVA. Die banen stonden in een seed en werden per stuk aangenomen: een
   handvol toetsbestanden logde in bij KIKUNOI of ESVEDRA, en de overige
   achtenvijftig afdelingen had niemand ooit aangeraakt.

   Dat is precies de vorm die deze ronde probeert uit te bannen. Een baan die
   in de seed staat maar waar niemand ooit heeft ingelogd, is geen baan maar
   een regel data. Deze toets loopt ze ALLEMAAL langs.

   WAT ER WORDT VASTGELEGD

   1. Elke afdeling uit de seed bestaat ook echt in het draaiende systeem, met
      precies de mensen en functietitels die de seed belooft. Niet "er is een
      rooster", maar: de kok van KIKUNOI heet Mateo Ferrer en zijn functie is
      Keuken.
   2. Elk mens kan inloggen met zijn eigen PIN, en de sessie die hij
      terugkrijgt is de ZIJNE -- `state.actor` noemt zijn naam, zijn staffId
      en of hij manager is. Een sessie die van iemand anders blijkt te zijn is
      erger dan geen sessie.
   3. De baan is ook een grens. Een verkeerde PIN komt er niet in, en de
      manager-vlag volgt de seed en niet de wens van de inlogger.

   OVER DE ROOSTER-REM

   /api/supplier/roster laat per IP dertig zaken per kwartier toe. Dat is geen
   defect maar een bewuste bescherming (zie server/routes/supplier/toegang.js):
   hij houdt tegen dat iemand met een handvol codes alle partners leegtrekt.
   Deze toets omzeilt die rem NIET en verlaagt hem niet -- hij verdeelt de
   afdelingen over meerdere servers, want de teller staat per proces. Een
   toets die een beveiliging uitzet om zichzelf makkelijker te maken, toetst
   het product niet meer. */
const test = require('node:test');
const assert = require('node:assert/strict');
const { startServer } = require('./helper');
const { STAFF_SEED } = require('../server/kern/staffseed.js');

const AFDELINGEN = Object.keys(STAFF_SEED);
const PIN = { manager: '1234', staff: '5678' };
/* Ruim onder de dertig van de rem, zodat een herstart-poging binnen dezelfde
   toetsronde niet alsnog tegen het plafond loopt. */
const PER_SERVER = 20;

function post(base) {
  return (pad, body, token) => fetch(base + pad, {
    method: 'POST',
    headers: Object.assign({ 'Content-Type': 'application/json' },
      token ? { Authorization: 'Bearer ' + token } : {}),
    body: JSON.stringify(body || {})
  }).then(async r => ({ status: r.status, body: await r.json().catch(() => ({})) }));
}

/* De afdelingen in porties, elk met een eigen server. Geeft per afdeling het
   rooster terug zoals het draaiende systeem het kent. */
async function perAfdeling(afdelingen, doe) {
  for (let i = 0; i < afdelingen.length; i += PER_SERVER) {
    const portie = afdelingen.slice(i, i + PER_SERVER);
    const { child, base } = await startServer({ env: { SMTP_URL: '' } });
    try {
      const P = post(base);
      for (const code of portie) {
        const r = await P('/api/supplier/roster', { code });
        assert.notEqual(r.status, 429,
          'de rooster-rem sloeg aan bij ' + code + '; deze toets hoort onder de dertig per server te blijven');
        await doe({ code, rooster: r, P });
      }
    } finally { child.kill('SIGKILL'); }
  }
}

test('elke afdeling uit de seed bestaat echt, met dezelfde mensen en functies', async () => {
  const gemist = [];
  let mensen = 0;
  await perAfdeling(AFDELINGEN, async ({ code, rooster }) => {
    const verwacht = STAFF_SEED[code];
    if (rooster.status !== 200 || !Array.isArray(rooster.body.staff)) {
      gemist.push(code + ': geen rooster (status ' + rooster.status + ')');
      return;
    }
    const staf = rooster.body.staff;
    if (staf.length !== verwacht.length) {
      gemist.push(code + ': ' + staf.length + ' mensen terwijl de seed er ' + verwacht.length + ' belooft');
      return;
    }
    for (const [naam, rol, functie] of verwacht) {
      const p = staf.find(x => x.name === naam);
      if (!p) { gemist.push(code + ': "' + naam + '" ontbreekt in het rooster'); continue; }
      if (p.role !== rol) gemist.push(code + '/' + naam + ': rol ' + p.role + ' terwijl de seed ' + rol + ' zegt');
      if (p.func !== functie) gemist.push(code + '/' + naam + ': functie "' + p.func + '" terwijl de seed "' + functie + '" zegt');
      mensen++;
    }
  });
  assert.deepEqual(gemist, [], 'afdelingen of banen die niet kloppen:\n  ' + gemist.join('\n  '));
  assert.ok(mensen >= 150, 'alle banen zijn nagelopen, niet een handvol (' + mensen + ')');
});

test('elk mens met een baan kan inloggen, en krijgt zijn EIGEN sessie', async () => {
  const stuk = [];
  let ingelogd = 0, managers = 0;
  await perAfdeling(AFDELINGEN, async ({ code, rooster, P }) => {
    if (rooster.status !== 200 || !Array.isArray(rooster.body.staff)) {
      stuk.push(code + ': geen rooster om mee in te loggen');
      return;
    }
    for (const p of rooster.body.staff) {
      const lg = await P('/api/supplier/login', { code, staffId: p.id, pin: PIN[p.role] || PIN.staff });
      if (lg.status !== 200 || !lg.body.token) {
        stuk.push(code + '/' + p.name + ' (' + p.func + '): geen sessie -- ' +
          lg.status + ' ' + JSON.stringify(lg.body).slice(0, 80));
        continue;
      }
      /* De sessie moet van DEZE mens zijn. Een token dat werkt maar iemand
         anders blijkt voor te stellen, is het gevaarlijkste van alles: dan
         staat er een naam op een scherm die er niet hoort. */
      const ik = (lg.body.state || {}).actor || {};
      if (ik.staffId !== p.id) stuk.push(code + '/' + p.name + ': sessie hoort bij staffId ' + ik.staffId + ' in plaats van ' + p.id);
      if (ik.name !== p.name) stuk.push(code + '/' + p.name + ': sessie draagt de naam "' + ik.name + '"');
      if (ik.manager !== (p.role === 'manager')) stuk.push(code + '/' + p.name + ': managervlag ' + ik.manager + ' terwijl de rol ' + p.role + ' is');
      ingelogd++;
      if (p.role === 'manager') managers++;
    }
  });
  assert.deepEqual(stuk, [], 'mensen die niet bij hun eigen werk komen:\n  ' + stuk.join('\n  '));
  assert.ok(ingelogd >= 150, 'er is voor alle banen ingelogd (' + ingelogd + ')');
  assert.equal(managers, AFDELINGEN.length, 'elke afdeling heeft precies een manager die erin komt (' + managers + ')');
});

test('de baan is ook een grens: een verkeerde PIN komt er niet in', async () => {
  /* Zonder deze toets bewijst de vorige niets: als elke PIN werkt, is
     "iedereen kan inloggen" een lege mededeling. Een steekproef volstaat --
     de PIN-controle is een gedeelde weg en geen eigenschap per afdeling. */
  const { child, base } = await startServer({ env: { SMTP_URL: '' } });
  try {
    const P = post(base);
    for (const code of ['KIKUNOI', 'GUARDIA', 'KMAR', 'LEXNOVA']) {
      const r = await P('/api/supplier/roster', { code });
      assert.equal(r.status, 200, 'rooster van ' + code);
      for (const p of r.body.staff.slice(0, 2)) {
        const fout = await P('/api/supplier/login', { code, staffId: p.id, pin: '9999' });
        assert.equal(fout.status, 401, code + '/' + p.name + ' komt met een verkeerde PIN niet binnen');
        assert.equal(fout.body.token, undefined, 'en krijgt zeker geen sessie mee');
      }
    }
  } finally { child.kill('SIGKILL'); }
});

test('een onbekende afdelingscode geeft niets prijs', async () => {
  /* De keerzijde van de vorige: wie de code niet kent hoort niets te zien.
     Zou hier een rooster uitkomen, dan zijn 157 namen en functies vrij op te
     vragen -- en juist daarvoor staat die rem op deze route. */
  const { child, base } = await startServer({ env: { SMTP_URL: '' } });
  try {
    const P = post(base);
    for (const onzin of ['BESTAATNIET', 'kikunoi-tikfout', '']) {
      const r = await P('/api/supplier/roster', { code: onzin });
      assert.notEqual(r.status, 200, 'code "' + onzin + '" levert geen rooster op');
      assert.equal((r.body.staff || []).length, 0, 'en zeker geen namen');
    }
  } finally { child.kill('SIGKILL'); }
});
