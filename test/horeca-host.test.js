/* RTG Horeca: DE ROLMODUS HOST -- de aankomststroom als vijfde taakbron.

   De werklijst kende vier bronnen: een gastverzoek, de pas, een gebroken
   belofte en een tafel zonder bestelling. Een host werkt op een vijfde die er
   niet in zat: de Arrival Pass, waar beloften wachten op een PERSOONLIJKE
   controle vóór de gast er is -- een toegankelijke route, een allergiebriefing
   voor de keuken, een bijzonder moment. Die beloften stonden er al jaren; wat
   ontbrak is dat ze op een werklijst kwamen.

   Wat hier vastligt:

   1. DE GRENS IS HET AFGESPROKEN AANKOMSTMOMENT, en die is niet verzonnen: de
      gast heeft een tijd gekregen en die staat op de pass. Een belofte die nog
      openstaat terwijl de gast al binnen is, is een ander soort te laat dan een
      die nog twee uur heeft.
   2. DE OPEN BELOFTEN REIZEN MEE. Een host die niet ziet WELKE belofte wacht,
      moet eerst een ander scherm openen -- en dan is dit geen werklijst maar
      een verwijzing.
   3. EEN AFGETEKENDE BELOFTE VERDWIJNT, en een pass zonder open beloften is
      geen taak meer.
   4. DE MODUS IS EEN LENS: de host ziet de aankomsten, de runner niet.
   5. WAT AL BEREKEND IS, WACHT NIET. Alleen beloften die op een MENS wachten
      tellen; "operationele capaciteit" is uitgerekend en heeft niemand nodig.

   Draai: node --experimental-sqlite --test test/horeca-host.test.js */
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs'); const os = require('os'); const path = require('path');
const { startServer } = require('./helper');

let BASE, child, tok;
const TMP = fs.mkdtempSync(path.join(os.tmpdir(), 'rtg-host-'));
const api = (pad, body, token) => fetch(BASE + pad, {
  method: 'POST', headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: 'Bearer ' + token } : {}) },
  body: JSON.stringify(body || {})
}).then(async r => ({ status: r.status, body: await r.json().catch(() => ({})) }));
const H = (pad, body) => api(pad, body, tok);

test.before(async () => {
  ({ child, base: BASE } = await startServer({ env: { RTG_DATA_DIR: TMP, SMTP_URL: '' } }));
  const roster = (await api('/api/supplier/roster', { code: 'KIKUNOI' })).body;
  const mgr = roster.staff.find(x => x.role === 'manager') || roster.staff[0];
  tok = (await api('/api/supplier/login', { code: 'KIKUNOI', staffId: mgr.id, pin: '1234' })).body.token;
  assert.ok(tok, 'de zaak-inlog werkt');
});
test.after(() => {
  if (child) try { child.kill('SIGKILL'); } catch (e) {}
  try { fs.rmSync(TMP, { recursive: true, force: true }); } catch (e) {}
});

/* Een aanvraagcode heeft de vorm <id>.<geheim>; de poort ontleedt hem en kent
   verder geen register (zie routes/supplier/horeca/arrival-toegang.js). */
const code = (n) => 'arrivaltest' + n + 'abcdefghijkl.' + 'geheimgeheimgeheim' + n + 'abcdef';
/* Datum EN tijd komen uit HETZELFDE moment. Nemen we de tijd van de klok (die
   over middernacht rolt) en de datum van vandaag (die dat niet doet), dan wijst
   dat paar na tienen 's avonds 22 uur TERUG: de route laat dat door -- die
   keurt alleen `datum < vandaag()` -- zet vervaltAt op aankomst + 12 uur, en
   dan gooit de werklijst de aankomst weg omdat hij verlopen is. Deze toetsen
   zakten daardoor elke avond na 22:00 en niemand die dat overdag zag. */
const over = (u) => {
  const d = new Date(Date.now() + u * 3600000);
  const p2 = (n) => String(n).padStart(2, '0');
  return {
    datum: d.getFullYear() + '-' + p2(d.getMonth() + 1) + '-' + p2(d.getDate()),
    tijd: p2(d.getHours()) + ':' + p2(d.getMinutes())
  };
};

async function aanvraag(n, opties) {
  const m = over(2);
  const r = await api('/api/arrival/request', Object.assign({
    requestToken: code(n), supplierCode: 'KIKUNOI', naam: 'Gast ' + n,
    datum: m.datum, tijd: m.tijd, personen: 2
  }, opties || {}));
  assert.equal(r.status, 200, 'de aanvraag lukt: ' + JSON.stringify(r.body).slice(0, 160));
  return r.body.pass;
}
const lijst = async (modus) => (await H('/api/supplier/horeca/werklijst', { modus })).body;
const taken = (d) => d.nu.concat(d.open);
const aankomsten = (d) => taken(d).filter(t => t.soort === 'aankomst');

test('1. een aankomst met een wachtende belofte staat op de lijst van de host', async () => {
  const pass = await aanvraag(1, { allergie: true, toegankelijk: true });
  const d = await lijst('host');
  const t = aankomsten(d).find(x => x.bronId === pass.id);
  assert.ok(t, 'de aankomst staat er: ' + JSON.stringify(aankomsten(d)).slice(0, 200));
  assert.match(t.wat, /belofte\(n\) wachten/, t.wat);
  assert.equal(typeof t.grens, 'number', 'met een grens uit het aankomstmoment');
  assert.ok(t.grens > 100 && t.grens < 130, 'ongeveer twee uur: ' + t.grens);
  assert.ok(t.over < 0, 'de gast komt pas, dus hij is nog niet te laat');
  assert.match(t.rekensom, new RegExp(pass.tijd), 'de rekensom noemt het aankomstmoment');
});

test('2. de open beloften reizen mee, en alleen die op een MENS wachten', async () => {
  const d = await lijst('host');
  const t = aankomsten(d)[0];
  const labels = t.beloften.map(b => b.label);
  assert.ok(labels.some(x => /allergie/i.test(x)), 'de allergiebriefing wacht: ' + labels.join(', '));
  assert.ok(labels.some(x => /toegankelijk/i.test(x)), 'de toegankelijke route ook');
  assert.ok(!labels.some(x => /capaciteit/i.test(x)),
    'wat al berekend is wacht niet op een mens: ' + labels.join(', '));
  for (const b of t.beloften) assert.match(b.status, /wacht|voorgesteld/);
});

test('3. een afgetekende belofte verdwijnt, en zonder open beloften is het geen taak', async () => {
  const pass = (await H('/api/supplier/horeca/arrivals', {})).body.arrivals[0];
  const voor = aankomsten(await lijst('host')).find(x => x.bronId === pass.id);
  const hoeveel = voor.beloften.length;

  await H('/api/supplier/horeca/arrival/promise', { arrivalId: pass.id, id: voor.beloften[0].id, akkoord: true });
  const na = aankomsten(await lijst('host')).find(x => x.bronId === pass.id);
  assert.equal(na.beloften.length, hoeveel - 1, 'er wacht er een minder');

  for (const b of na.beloften) {
    await H('/api/supplier/horeca/arrival/promise', { arrivalId: pass.id, id: b.id, akkoord: true });
  }
  const weg = aankomsten(await lijst('host')).find(x => x.bronId === pass.id);
  assert.equal(weg, undefined, 'een pass zonder open beloften is geen taak meer');
});

test('4. de modus is een lens: de runner ziet geen aankomsten', async () => {
  await aanvraag(4, { allergie: true });
  assert.ok(aankomsten(await lijst('host')).length, 'de host ziet ze');
  assert.equal(aankomsten(await lijst('runner')).length, 0, 'de runner niet');
  assert.equal(aankomsten(await lijst('bediening')).length, 0, 'de bediening ook niet');
  assert.ok(aankomsten(await lijst('alles')).length, 'en alles wel');
});

test('5. een gast die er al had moeten zijn, staat in "nu"', () => {
  /* Via de server is dit niet te maken zonder de klok te verzetten: een
     aanvraag draagt de tijd van NU. Dus wordt de rekensom hier rechtstreeks
     gevoed, met een pass die twintig minuten geleden is aangevraagd voor een
     aankomst van vijf minuten geleden. */
  const MINUUT = 60000;
  /* EEN VAST ANKER, en dat is geen netheid maar een reparatie. De eerste versie
     nam Date.now() op drie plekken en knipte de aankomsttijd af op HH:MM; de
     seconden die daarbij wegvielen maakten het verschil tussen aanvraag en
     aankomst soms 14 en soms 15 minuten. Die toets zakte ongeveer een op de
     drie keer -- en een toets die af en toe zomaar rood wordt, leert mensen om
     hem te negeren. vanAankomst neemt "nu" als argument, dus alle drie de
     getallen zijn hier exact. */
  const NU = new Date();
  NU.setSeconds(0, 0);
  const geleden = (m) => new Date(NU.getTime() - m * MINUUT);
  const horeca = { nu: () => NU.toISOString(), regelSom: () => 0 };
  const schoon = (t, n) => String(t == null ? '' : t).slice(0, n || 80);
  const bronnen = require('../server/kern/horeca/werklijst-bronnen')(
    { horeca, schoon, verzoeklaag: { SOORTEN: {}, wachtrij: () => ({ verzoeken: [] }) } });

  const aank = geleden(5);
  const h = { arrivals: { A: {
    id: 'A', datum: aank.toISOString().slice(0, 10),
    tijd: String(aank.getHours()).padStart(2, '0') + ':' + String(aank.getMinutes()).padStart(2, '0'),
    personen: 4, tafel: 'Tafel 6', at: geleden(20).toISOString(),
    vervaltAt: new Date(NU.getTime() + 3600000).toISOString(),
    beloften: [{ id: 'allergie', label: 'Allergiebriefing keuken', status: 'wacht-op-mens' },
      { id: 'capaciteit', label: 'Operationele capaciteit', status: 'berekend' }]
  } } };

  const [t] = bronnen.vanAankomst(h, NU.getTime());
  assert.ok(t, 'de aankomst is een taak');
  assert.equal(t.wacht, 20, 'de belofte staat twintig minuten open');
  assert.equal(t.grens, 15, 'en er zaten vijftien minuten tussen aanvraag en aankomst');
  assert.equal(t.over, 5, 'dus de gast is vijf minuten binnen terwijl wij nog niets aftekenden');
  assert.equal(t.beloften.length, 1, 'alleen de belofte die op een mens wacht');
  assert.match(t.rekensom, /5 min voorbij/, t.rekensom);
});
