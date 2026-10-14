/* DE HERKOMST VAN EEN INLOG EN HET INLOGSPOOR
   (server/kern/identiteit/inlogherkomst.js).

   Wat deze module beschermt: twee dingen die op het moment van inloggen moeten
   gebeuren en niet achteraf kunnen. legInlogVast schrijft in het
   sessieregister WAARMEE een sessie ontstond, met de methode van de inlogweg
   (een wachtwoord is `gemeten`, een passkey `cryptografisch`) -- zonder dat de
   helper zelf een methode kiest. maakInlogspoor schrijft elke geslaagde en
   elke GEWEIGERDE inlog in het securityLog, aan een hashketen, zodat een
   gewijzigde of weggehaalde regel midden in het spoor zichtbaar wordt.

   Wat hier niet mag sneuvelen:
   1. de graad van de vastgelegde inlog komt uit de methode die de inlogweg
      meegeeft: een wachtwoord haalt nooit `bewezen`, een passkey wel, en een
      onbekende methode legt niets vast in plaats van iets te verzinnen;
   2. zonder register, zonder sessieVan of zonder sid wordt er niets
      vastgelegd en niets tegengehouden (null) -- een haperende bewijslaag
      sluit niemand buiten;
   3. elke weigering laat een regel na, met kanaal, ok=false, een geschoonde
      naam en het adres; ook zonder verzoek;
   4. een gewijzigde regel midden in het spoor breekt de keten zichtbaar, en
      een beschadigde opslag wordt geweigerd in plaats van als leeg
      overschreven;
   5. het spoor is begrensd en snoeit aan de staart: de nieuwste regel en de
      top blijven.

   MUTATIES die zijn gedraaid en welke toets erop zakte (LAT.md regel 2):
   - in logInlog `ok: !!ok` vervangen door `ok: true`
     -> "3. elke weigering laat een regel na" ZAKT (RAAK).
   - in logInlog de regel `opslag.kijk('securityLog');` weggehaald
     -> "4b. een beschadigd spoor wordt niet als leeg overschreven" ZAKT (RAAK).

   Draai: node --test test/inlogherkomst-weerbaar.test.js */
'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const { legInlogVast, maakInlogspoor } = require('../server/kern/identiteit/inlogherkomst');
const { maakSessieregister } = require('../server/kern/identiteit/sessieregister');

const SID = 'Inlog_sid_01';
function register() {
  const db = { data: {} };
  return { reg: maakSessieregister({ db, save() {} }), db };
}
const accounts = (sid = SID) => ({ sessieVan: (token) => (token === 'token-goed' ? sid : null) });

test('1. de graad komt uit de methode van de inlogweg, en de helper verzint er geen', () => {
  const { reg } = register();
  const sid = legInlogVast({ sessieregister: reg, accounts: accounts(), token: 'token-goed', lidKey: 'user-1',
    type: 'wachtwoord', methode: 'gemeten', bron: 'inlog' });
  assert.equal(sid, SID);
  const rij = reg.lees(SID);
  assert.equal(rij.lidKey, 'user-1');
  assert.equal(rij.context.authenticator.type, 'wachtwoord');
  assert.equal(rij.context.authenticator.herkomst.methode, 'gemeten');
  assert.equal(rij.context.authenticator.herkomst.regelversie, 'mijnrtg');
  assert.equal(rij.context.authenticator.assurance, undefined, 'geen assurance meegegeven, dan ook geen');
  assert.equal(rij.context.authenticator.authenticatorId, undefined);
  const stand = reg.vanLid('user-1')[0].stand;
  assert.equal(stand.authenticator.graad, 'gemeten', 'een wachtwoord haalt nooit bewezen');
  assert.equal(stand.context.graad, 'gemeten');
  assert.deepEqual([rij.context.context.contextId, rij.context.context.contextSoort], ['persoonlijk', 'persoonlijk']);

  // Een passkey met authenticator-id en assurance.
  const p = register();
  legInlogVast({ sessieregister: p.reg, accounts: accounts(), token: 'token-goed', lidKey: 'user-1',
    type: 'passkey', assurance: 'hoog', methode: 'cryptografisch', bron: 'webauthn', authenticatorId: 'cred-1' });
  const pr = p.reg.lees(SID);
  assert.deepEqual([pr.context.authenticator.assurance, pr.context.authenticator.authenticatorId], ['hoog', 'cred-1']);
  assert.equal(p.reg.vanLid('user-1')[0].stand.authenticator.graad, 'bewezen');

  // Een onbekende of ontbrekende methode legt GEEN authenticator vast; de context wel.
  for (const methode of ['vertrouwd', undefined]) {
    const o = register();
    assert.equal(legInlogVast({ sessieregister: o.reg, accounts: accounts(), token: 'token-goed', lidKey: 'user-1',
      type: 'wachtwoord', methode, bron: 'inlog' }), SID);
    assert.equal(o.reg.lees(SID).context.authenticator, undefined, 'methode ' + methode + ' maakt geen claim');
    assert.equal(o.reg.vanLid('user-1')[0].stand.authenticator.graad, 'onbekend');
  }
  // Een ongeldige authenticator-id (spatie) laat de hele claim vallen, niet half.
  const f = register();
  legInlogVast({ sessieregister: f.reg, accounts: accounts(), token: 'token-goed', lidKey: 'user-1',
    type: 'passkey', methode: 'cryptografisch', bron: 'webauthn', authenticatorId: 'met spatie' });
  assert.equal(f.reg.lees(SID).context.authenticator, undefined);
});

test('2. zonder register, sessieVan of sid wordt er niets vastgelegd, en niets tegengehouden', () => {
  const { reg, db } = register();
  const basis = { lidKey: 'user-1', type: 'wachtwoord', methode: 'gemeten', bron: 'inlog' };
  assert.equal(legInlogVast(Object.assign({ sessieregister: null, accounts: accounts(), token: 'token-goed' }, basis)), null);
  assert.equal(legInlogVast(Object.assign({ sessieregister: reg, accounts: null, token: 'token-goed' }, basis)), null);
  assert.equal(legInlogVast(Object.assign({ sessieregister: reg, accounts: {}, token: 'token-goed' }, basis)), null);
  assert.equal(legInlogVast(Object.assign({ sessieregister: reg, accounts: { sessieVan: 'geen functie' }, token: 'token-goed' }, basis)), null);
  assert.equal(legInlogVast(Object.assign({ sessieregister: reg, accounts: accounts(), token: 'token-oud' }, basis)), null,
    'een token van voor het register heeft geen sid');
  assert.deepEqual(db.data.sessiecontext || {}, {});
});

function spoor({ data = {} } = {}) {
  const db = { data };
  const bewaard = [];
  const save = () => bewaard.push('alles');
  save.sleutels = (s) => bewaard.push(s.join(','));
  const schoon = (v, n) => (v == null ? '' : String(v).replace(/[<>]/g, '').slice(0, n));
  return { s: maakInlogspoor({ db, save, schoon }), db, bewaard };
}

test('3. elke weigering laat een regel na, met kanaal, adres en een geschoonde naam', () => {
  const { s, db, bewaard } = spoor();
  s.logInlog('wachtwoord', false, '<script>' + 'k'.repeat(100), { ip: '203.0.113.7' });
  s.logInlog('passkey', 1, 'kat', { ip: '198.51.100.2' });
  s.logInlog('werkplek', 0, '', null);
  s.logInlog('wachtwoord', undefined, null, {});
  const l = db.data.securityLog;
  assert.equal(l.length, 4);
  // Nieuwste vooraan.
  assert.deepEqual([l[3].kanaal, l[3].ok, l[3].ip], ['wachtwoord', false, '203.0.113.7']);
  assert.equal(l[3].wie, 'script' + 'k'.repeat(54), 'geschoond en op zestig tekens begrensd');
  assert.deepEqual([l[2].kanaal, l[2].ok, l[2].wie], ['passkey', true, 'kat']);
  assert.deepEqual([l[1].ok, l[1].wie, l[1].ip], [false, null, ''], 'zonder verzoek: leeg adres, geen naam, wel een regel');
  assert.deepEqual([l[0].ok, l[0].wie, l[0].ip], [false, null, '']);
  for (const r of l) assert.ok(Number.isFinite(new Date(r.at).getTime()));
  assert.deepEqual(bewaard, ['securityLog', 'securityLog', 'securityLog', 'securityLog'], 'alleen de eigen collectie, elke keer');
  const k = s.securityLogKeten();
  assert.equal(k.ok, true);
  assert.equal(k.geteld, 4);
  assert.equal(k.top, l[0].hash);
  assert.deepEqual(l.map(r => r.nr), [4, 3, 2, 1]);
});

test('4. een gewijzigde of weggehaalde regel midden in het spoor breekt de keten zichtbaar', () => {
  const { s, db } = spoor();
  for (let i = 0; i < 5; i++) s.logInlog('wachtwoord', i % 2 === 0, 'lid' + i, { ip: '10.0.0.' + i });
  assert.equal(s.securityLogKeten().ok, true);
  // Een weigering achteraf als geslaagd boeken.
  assert.equal(db.data.securityLog[1].ok, false, 'regel 1 is een weigering');
  db.data.securityLog[1].ok = true;
  const na = s.securityLogKeten();
  assert.equal(na.ok, false);
  assert.ok(na.gebroken.some(g => g.index === 1), 'de gewijzigde regel wordt aangewezen');
  db.data.securityLog[1].ok = false;
  assert.equal(s.securityLogKeten().ok, true, 'terugzetten herstelt het bewijs');
  // Een regel midden uit het spoor halen.
  db.data.securityLog.splice(2, 1);
  assert.equal(s.securityLogKeten().ok, false);
});

test('4b. een beschadigd spoor wordt niet als leeg overschreven', () => {
  const { s, db, bewaard } = spoor({ data: { securityLog: { niet: 'een lijst' } } });
  assert.throws(() => s.logInlog('wachtwoord', false, 'kat', { ip: '1' }), /niet de verklaarde vorm/);
  assert.deepEqual(db.data.securityLog, { niet: 'een lijst' }, 'het bestaande spoor is onaangeroerd');
  assert.deepEqual(bewaard, [], 'en er is niets weggeschreven');
  assert.throws(() => s.securityLogKeten(), /niet de verklaarde vorm/);
  // Een spoor dat er nog niet is, is leeg en klopt.
  const leeg = spoor();
  assert.deepEqual(leeg.s.securityLogKeten(), { top: null, ok: true, gebroken: [], afgekapt: false, zonderKeten: 0, geteld: 0 });
  assert.equal(leeg.db.data.securityLog, undefined, 'lezen schept geen collectie');
});

test('5. het spoor is begrensd en snoeit aan de staart: de nieuwste regel blijft', () => {
  const regels = [];
  for (let i = 5000; i >= 1; i--) regels.push({ at: 'x', kanaal: 'oud', ok: false, wie: null, ip: '', nr: i, hash: 'h' + i, vorige: 'h' + (i - 1) });
  const { s, db } = spoor({ data: { securityLog: regels } });
  s.logInlog('wachtwoord', false, 'nieuw', { ip: '9.9.9.9' });
  const l = db.data.securityLog;
  assert.equal(l.length, 5000, 'begrensd op vijfduizend');
  assert.equal(l[0].wie, 'nieuw', 'de nieuwste staat vooraan');
  assert.equal(l[0].nr, 5001);
  assert.equal(l[0].vorige, 'h5000', 'en hangt aan de vorige top');
  assert.equal(l[l.length - 1].nr, 2, 'de oudste is eraf');
  assert.equal(s.securityLogKeten().top, l[0].hash);
});
