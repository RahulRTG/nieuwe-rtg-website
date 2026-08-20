/* ELKE INLOGPOGING LAAT EEN SPOOR NA -- ook op de hoofdingang.

   HET INLOG-AUDITLOG BELOOFT DIT LETTERLIJK (server/server.js, logInlog):
   "Elke inlogpoging (gelukt of mislukt, op elk kanaal) komt in een afgeschermd
   log: wie, waar vandaan, wanneer. Zo is een aanval of een gestolen code
   achteraf altijd te reconstrueren; het kantoor leest het log in RTG HQ."

   De AUDIT-as mat dat na en vond het tegendeel: van de 106 geslaagde aanroepen
   op /api/auth/login lieten er 102 GEEN spoor na. De demo-inlog (/api/login met
   wachtwoord) logde wel, de ECHTE accountingang niet -- precies het kanaal waar
   een aanval op echte accounts binnenkomt. Een belofte in tekst die de code niet
   nakomt (LAT.md regel 6), en op de plek waar het het meeste kost: zonder deze
   regels is credential stuffing achteraf niet te zien.

   Deze toets houdt de belofte vast op alle drie de uitkomsten die ertoe doen:
   een geslaagde inlog, een mislukte inlog, en een onbekend account.

   DEZELFDE FOUT STOND OP DE ZAKEN-INGANG. /api/supplier/login logde netjes in
   de personeelstak (pincode) en NIETS in de tak van het bedrijfsaccount --
   gelukt noch mislukt. En de personeelstak zette zijn `ok: true` neer VOOR twee
   weigeringen die nog konden volgen, dus wie bij een gesloten partnerwerkplek
   de juiste pincode intikte kwam als geslaagde inlog op het bord terwijl er
   nooit een sessie ontstond. Een auditlog met een regel die niet is gebeurd, is
   erger dan een ontbrekende regel.

   Draai los: node --experimental-sqlite --test test/inlogspoor.test.js */
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { startServer } = require('./helper');

let BASE, child;
const TMP = fs.mkdtempSync(path.join(os.tmpdir(), 'rtg-inlogspoor-'));
const MAIL = 'spoor' + Date.now() + '@voorbeeld.test';

const post = async (pad, lijf, tok) => {
  const headers = { 'Content-Type': 'application/json' };
  if (tok) headers.Authorization = 'Bearer ' + tok;
  const r = await fetch(BASE + pad, { method: 'POST', headers, body: JSON.stringify(lijf || {}) });
  let data = null; try { data = await r.json(); } catch (e) {}
  return { status: r.status, data };
};

/* Het veiligheidsbord zelf lezen kan alleen het kantoor; deze toets kijkt naar
   de BRON, want het gaat om de vraag of de regel er KOMT -- niet om wie hem mag
   zien. Daarvoor moet de opslag wel leesbaar zijn: een VERSE installatie kiest
   de SQLite-motor (store.db), en dan bestaat er helemaal geen db.json. Vandaar
   RTG_STORE=json hieronder -- de opslagmotor doet niets aan de vraag die deze
   toets stelt, hij maakt het antwoord alleen zichtbaar zonder een tweede lezer
   die zelf weer stuk kan (LAT.md regel 4). */
const bordVan = (kanaal) => {
  try {
    const d = JSON.parse(fs.readFileSync(path.join(TMP, 'db.json'), 'utf8'));
    return (d.securityLog || []).filter(r => r && r.kanaal === kanaal);
  } catch (e) { return []; }
};
const bord = () => bordVan('account');
const zaakBord = () => bordVan('zaak');

test.before(async () => {
  ({ child, base: BASE } = await startServer({ env: { RTG_DATA_DIR: TMP, RTG_DEMO: '1', SMTP_URL: '', RTG_STORE: 'json' } }));
  const r = await post('/api/auth/register', { name: 'Spoor Lid', email: MAIL,
    password: 'geheim123', geboortedatum: '1990-03-03', pasApp: 'rtg' });
  assert.ok(r.data && r.data.token, 'het proefaccount moet bestaan');
});
test.after(() => {
  if (child) try { child.kill('SIGKILL'); } catch (e) {}
  try { fs.rmSync(TMP, { recursive: true, force: true }); } catch (e) {}
});

test('een GESLAAGDE accountinlog komt op het veiligheidsbord', async () => {
  const voor = bord().length;
  const r = await post('/api/auth/login', { login: MAIL, password: 'geheim123' });
  assert.equal(r.status, 200, 'de inlog hoort te slagen');
  await new Promise(z => setTimeout(z, 400));
  const na = bord();
  assert.equal(na.length, voor + 1,
    'een geslaagde inlog op de hoofdingang hoort een regel op te leveren; het log belooft "elke ' +
    'inlogpoging op elk kanaal"');
  assert.equal(na[0].ok, true);
});

test('een MISLUKTE accountinlog komt er ook op, en dat is de belangrijkste', async () => {
  /* Zonder deze regels is credential stuffing achteraf niet te zien: dat is
     precies waar het kantoor dit bord voor leest. */
  const voor = bord().length;
  const r = await post('/api/auth/login', { login: MAIL, password: 'fout-wachtwoord' });
  assert.equal(r.status, 401);
  await new Promise(z => setTimeout(z, 400));
  const na = bord();
  assert.equal(na.length, voor + 1, 'een mislukte poging hoort een regel op te leveren');
  assert.equal(na[0].ok, false);
});

test('een poging op een ONBEKEND account laat ook een spoor na', async () => {
  /* Juist het aftasten van adressen die niet bestaan is een aanvalspatroon. */
  const voor = bord().length;
  const r = await post('/api/auth/login', { login: 'bestaat-niet@voorbeeld.test', password: 'x' });
  assert.equal(r.status, 401);
  await new Promise(z => setTimeout(z, 400));
  assert.equal(bord().length, voor + 1);
});

test('de ZAKEN-ingang logt het bedrijfsaccount, gelukt en mislukt', async () => {
  /* De tak die niets logde. Het demo-bedrijfsaccount (gebruikersnaam +
     wachtwoord) is de enige tak die zonder personeelsdossier te bereiken is;
     de pincode-tak eronder logde al en blijft dat doen. */
  const voor = zaakBord().length;
  const mis = await post('/api/supplier/login', { username: 'rahul', password: 'fout-wachtwoord' });
  assert.equal(mis.status, 401);
  await new Promise(z => setTimeout(z, 400));
  const naMis = zaakBord();
  assert.equal(naMis.length, voor + 1, 'een mislukte zaak-inlog hoort een regel op te leveren');
  assert.equal(naMis[0].ok, false);

  const goed = await post('/api/supplier/login', { username: 'rahul', password: 'Imran' });
  assert.equal(goed.status, 200, 'de demo-inlog van de zaak hoort te slagen');
  assert.ok(goed.data && goed.data.token);
  await new Promise(z => setTimeout(z, 400));
  const naGoed = zaakBord();
  assert.equal(naGoed.length, voor + 2, 'een geslaagde zaak-inlog hoort ook een regel op te leveren');
  assert.equal(naGoed[0].ok, true);
});

test('het spoor draagt geen wachtwoord', async () => {
  /* Een auditlog dat het ingetikte wachtwoord bewaart, is zelf het lek. */
  const alles = JSON.stringify(bord()) + JSON.stringify(zaakBord());
  assert.ok(!/geheim123|fout-wachtwoord/.test(alles), 'nooit een wachtwoord in het log');
});
