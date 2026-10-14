/* DE PERSONEELSSESSIE ONDER AANVAL (server/accounts/staff-sessie.js).

   Wat deze module beschermt: een leverancierssessie is een AFGESPLITSTE sessie
   van een persoonlijk RTG-account, en bij elk verzoek moet opnieuw blijken dat
   drie levende waarheden nog bij elkaar horen: sessie -> actieve
   personeelsplek -> actief RTG-account. Uit dienst, account uit, of alle
   sessies ingetrokken (wachtwoord gewijzigd, herstel) sluit dus ook een al
   geopende werkplek, en een oud of half token komt er buiten Magnaat Test niet
   in. De accounts-laag wordt hier nagespeeld met een klein, eerlijk object; de
   echte tabel staat in test/staff-accountuit.test.js en
   test/leverancierpoort.test.js.

   Wat hier niet mag sneuvelen:
   1. een plek van een ANDERE zaak, een verdwenen plek of een plek zonder
      account opent geen sessie, ook niet met hoofdletterspelletjes;
   2. een sessie die bij een ander lid hoort (lid, plek of lidKey wijken af)
      wordt geweigerd, ook als elk los veld geldig lijkt;
   3. een account dat uit staat, of waarvan de sessies NA de inlog zijn
      ingetrokken, sluit een al geopende werkplek meteen;
   4. een token zonder inlogmoment is buiten Magnaat Test niets waard; binnen
      Magnaat Test mag de oude pinplek, maar ook daar geldt de intrekking;
   5. een uitgegeven uitnodiging of doossleutel telt alleen zolang plek EN
      account actief zijn -- uitzetten is geen wissen, aanzetten herstelt;
   6. registreren in het sessieregister legt de zaak vast als gemeten context
      en doet niets zonder sid, lid of register.

   MUTATIES die zijn gedraaid en welke toets erop zakte (LAT.md regel 2):
   - in controleer `Number(lid.sessies_vanaf || 0) > start` vervangen door
     `Number(lid.sessies_vanaf || 0) > start + 1e12`
     -> "3. na intrekking werkt een al geopende werkplek niet meer" ZAKT (RAAK).
   - in controleer de vergelijking `(staff && Number(staff.member_id) !== id) ||`
     weggehaald
     -> "2. een sessie die bij een ander lid hoort" ZAKT (RAAK).

   Draai: node --test test/staff-sessie-weerbaar.test.js */
'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const { accountBinding, controleer, plekWerkt, registreer } = require('../server/accounts/staff-sessie');
const { maakSessieregister } = require('../server/kern/identiteit/sessieregister');

const INLOG = Date.UTC(2026, 9, 14, 9, 0, 0);

function huis({ legacy = false } = {}) {
  const users = new Map([
    [7, { id: 7, actief: true, sessies_vanaf: 0 }],
    [8, { id: 8, actief: true, sessies_vanaf: 0 }]
  ]);
  const staff = new Map([
    [1, { id: 1, supplier_code: 'ZAAK1', member_id: 7, active: 1 }],
    [2, { id: 2, supplier_code: 'zaak2', member_id: 8, active: 1 }],
    [3, { id: 3, supplier_code: 'ZAAK1', member_id: null, active: 1 }]   // pinplek van Magnaat Test
  ]);
  const accounts = {
    getUserById: (id) => users.get(id) || null,
    isActief: (u) => !!u.actief,
    getStaffById: (id) => { const s = staff.get(id); return s && s.active === 1 ? s : null; },
    getStaffByIdAny: (id) => staff.get(id) || null,
    legacyStaffPinToegestaan: () => legacy
  };
  return { accounts, users, staff };
}
const sessie = (extra = {}) => Object.assign({ role: 'supplier', code: 'ZAAK1', staffId: 1, lid: 7,
  lidKey: 'user-7', lidInlogOp: INLOG, sid: 'abcdefghijkl' }, extra);

test('0. een geldige personeelssessie gaat door en levert de plek', () => {
  const { accounts } = huis();
  const uit = controleer(accounts, sessie());
  assert.equal(uit.ok, true);
  assert.equal(uit.staff.id, 1);
  // Hoofdletters van de zaakcode tellen niet, de zaak zelf wel.
  assert.equal(controleer(accounts, sessie({ code: 'zaak1' })).ok, true);
  assert.equal(controleer(accounts, sessie({ staffId: 2, code: 'ZAAK2', lid: 8, lidKey: 'user-8' })).ok, true);
});

test('1. geen leverancier, een verdwenen plek of een plek van een andere zaak opent niets', () => {
  const { accounts, staff } = huis();
  for (const s of [null, undefined, {}, sessie({ role: 'member' }), sessie({ role: 'SUPPLIER' })]) {
    assert.deepEqual(controleer(accounts, s), { ok: false, status: 401, error: 'Niet ingelogd als leverancier.' });
  }
  const plek = (s) => controleer(accounts, s).error;
  assert.equal(plek(sessie({ staffId: 99 })), 'Deze personeelsplek is niet meer actief.');
  assert.equal(plek(sessie({ code: 'ZAAK2' })), 'Deze personeelsplek is niet meer actief.', 'plek 1 hoort bij ZAAK1');
  assert.equal(plek(sessie({ code: undefined })), 'Deze personeelsplek is niet meer actief.');
  // Uit dienst: de plek staat op inactief en de sessie sluit meteen.
  staff.get(1).active = 0;
  assert.equal(plek(sessie()), 'Deze personeelsplek is niet meer actief.');
  // Een plek zonder zaakcode past bij geen enkele zaak.
  staff.get(1).active = 1; staff.get(1).supplier_code = null;
  assert.equal(plek(sessie()), 'Deze personeelsplek is niet meer actief.');
});

test('1b. buiten Magnaat Test geen sessie zonder plek, zonder account achter de plek of zonder lid', () => {
  const { accounts } = huis();
  const weer = 'Log opnieuw in met uw persoonlijke RTG-account.';
  assert.equal(controleer(accounts, sessie({ staffId: undefined })).error, weer, 'een token zonder plek');
  assert.equal(controleer(accounts, sessie({ staffId: null })).error, weer);
  assert.equal(controleer(accounts, sessie({ staffId: 3, lid: undefined, lidKey: undefined })).error, weer, 'de pinplek zonder account');
  assert.equal(controleer(accounts, sessie({ lid: null })).error, weer, 'een token van voor de migratie');
  // Een accounts-laag zonder schakelaar voor Magnaat Test telt als "niet toegestaan".
  const zonder = Object.assign({}, accounts); delete zonder.legacyStaffPinToegestaan;
  assert.equal(controleer(zonder, sessie({ staffId: 3, lid: undefined })).error, weer);
});

test('2. een sessie die bij een ander lid hoort, wordt geweigerd', () => {
  const { accounts } = huis();
  const anders = 'De personeelsplek hoort niet bij dit RTG-account.';
  assert.equal(controleer(accounts, sessie({ lid: 8, lidKey: 'user-8' })).error, anders, 'plek 1 is van lid 7');
  assert.equal(controleer(accounts, sessie({ lidKey: 'user-8' })).error, anders, 'lidKey wijkt af van lid');
  for (const lid of [0, -7, 7.5, 'zeven', Number.MAX_SAFE_INTEGER + 2]) {
    assert.equal(controleer(accounts, sessie({ lid, lidKey: undefined })).error, anders, 'lid ' + String(lid));
  }
  // Een lidKey die ontbreekt is geen afwijking; lid en plek moeten dan nog steeds kloppen.
  assert.equal(controleer(accounts, sessie({ lidKey: undefined })).ok, true);
  assert.equal(controleer(accounts, sessie({ lid: '7' })).ok, true, 'een lid als tekst wordt als getal gelezen');
});

test('3. na intrekking of uitzetten werkt een al geopende werkplek niet meer', () => {
  const { accounts, users } = huis();
  assert.equal(controleer(accounts, sessie()).ok, true);
  // Wachtwoord gewijzigd: alle sessies van voor dit moment zijn ingetrokken.
  users.get(7).sessies_vanaf = INLOG + 1;
  const ingetrokken = controleer(accounts, sessie());
  assert.deepEqual([ingetrokken.ok, ingetrokken.status], [false, 401]);
  assert.match(ingetrokken.error, /ingetrokken/);
  // Een nieuwe inlog na de intrekking mag wel; precies op het moment ook.
  assert.equal(controleer(accounts, sessie({ lidInlogOp: INLOG + 1 })).ok, true);
  assert.equal(controleer(accounts, sessie({ lidInlogOp: INLOG + 2 })).ok, true);
  // Account uit (SCIM, AVG-wissing): weg.
  users.get(7).actief = false;
  assert.equal(controleer(accounts, sessie({ lidInlogOp: INLOG + 2 })).error, 'Dit RTG-account is niet meer actief.');
  // Account verdwenen.
  users.delete(7);
  assert.equal(controleer(accounts, sessie({ lidInlogOp: INLOG + 2 })).error, 'Dit RTG-account is niet meer actief.');
});

test('4. een token zonder geldig inlogmoment is buiten Magnaat Test niets waard', () => {
  const { accounts } = huis();
  for (const lidInlogOp of [undefined, null, 0, -1, 'gisteren', NaN]) {
    assert.equal(controleer(accounts, sessie({ lidInlogOp })).error, 'Log opnieuw in met uw persoonlijke RTG-account.',
      'inlogmoment ' + String(lidInlogOp));
  }
});

test('4b. in Magnaat Test mag de oude pinplek, maar een intrekking geldt ook daar', () => {
  const { accounts, users } = huis({ legacy: true });
  assert.equal(controleer(accounts, sessie({ staffId: 3, lid: undefined, lidKey: undefined })).ok, true, 'de pinplek zonder account');
  assert.equal(controleer(accounts, { role: 'supplier', code: 'ZAAK1' }).ok, true, 'de oude demo-sessie zonder plek');
  // Een lid zonder inlogmoment mag in Magnaat Test, maar alleen als lid en plek kloppen.
  assert.equal(controleer(accounts, sessie({ lidInlogOp: undefined })).ok, true);
  assert.equal(controleer(accounts, sessie({ lidInlogOp: undefined, lid: 8, lidKey: 'user-8' })).ok, false);
  users.get(7).sessies_vanaf = INLOG + 10;
  assert.match(controleer(accounts, sessie()).error, /ingetrokken/, 'ook in Magnaat Test sluit een intrekking');
  // Zonder isActief-functie geldt het account als actief zolang het bestaat.
  const zonder = Object.assign({}, accounts); delete zonder.isActief;
  users.get(7).sessies_vanaf = 0; users.get(7).actief = false;
  assert.equal(controleer(zonder, sessie()).ok, true);
});

test('5. accountBinding: alleen een bestaand, actief lid levert een binding', () => {
  const { accounts, users } = huis();
  assert.deepEqual(accountBinding(accounts, 7, INLOG), { lid: 7, lidKey: 'user-7', lidInlogOp: INLOG });
  assert.deepEqual(accountBinding(accounts, { id: 8 }, String(INLOG)), { lid: 8, lidKey: 'user-8', lidInlogOp: INLOG });
  for (const fout of [null, undefined, 0, -1, 1.5, 'x', {}, { id: 'acht' }, 99]) {
    assert.equal(accountBinding(accounts, fout, INLOG), null, 'lid ' + JSON.stringify(fout));
  }
  users.get(7).actief = false;
  assert.equal(accountBinding(accounts, 7, INLOG), null, 'een account dat uit staat bindt niets');
  const zonder = Object.assign({}, accounts); delete zonder.isActief;
  assert.equal(accountBinding(zonder, 7, INLOG).lid, 7);
  // Zonder uitgiftemoment: nu.
  const vers = accountBinding(accounts, 8);
  assert.ok(Math.abs(vers.lidInlogOp - Date.now()) < 5000);
});

test('5b. plekWerkt: een uitgegeven uitnodiging of doossleutel telt alleen zolang plek en account actief zijn', () => {
  const { accounts, users, staff } = huis();
  assert.equal(plekWerkt(accounts, 1, 'zaak1'), true);
  assert.equal(plekWerkt(accounts, '1', 'ZAAK1'), true);
  assert.equal(plekWerkt(accounts, 1, 'ZAAK2'), false, 'een andere zaak');
  assert.equal(plekWerkt(accounts, 1, undefined), false);
  assert.equal(plekWerkt(accounts, 99, 'ZAAK1'), false, 'een verdwenen plek');
  assert.equal(plekWerkt(accounts, 3, 'ZAAK1'), true, 'de pinplek zonder account houdt het oude gedrag');
  staff.get(1).active = '1';
  assert.equal(plekWerkt(accounts, 1, 'ZAAK1'), true, 'active als tekst telt als getal');
  staff.get(1).active = 0;
  assert.equal(plekWerkt(accounts, 1, 'ZAAK1'), false, 'uit dienst');
  staff.get(1).active = 1;
  users.get(7).actief = false;
  assert.equal(plekWerkt(accounts, 1, 'ZAAK1'), false, 'account uit');
  users.get(7).actief = true;
  assert.equal(plekWerkt(accounts, 1, 'ZAAK1'), true, 'uitzetten is geen wissen: weer aan is weer geldig');
  users.delete(7);
  assert.equal(plekWerkt(accounts, 1, 'ZAAK1'), false, 'account gewist');
  const zonder = Object.assign({}, accounts); delete zonder.isActief;
  assert.equal(plekWerkt(zonder, 2, 'ZAAK2'), true);
  staff.get(2).supplier_code = null;
  assert.equal(plekWerkt(accounts, 2, 'ZAAK2'), false, 'een plek zonder zaak past niet bij een zaak');
});

test('6. registreren legt de zaak vast als gemeten context, en doet niets zonder sid, lid of register', () => {
  const db = { data: {} };
  const reg = maakSessieregister({ db, save() {} });
  const s = sessie();
  assert.equal(registreer(reg, s, 'user-7'), true);
  const rij = reg.lees(s.sid);
  assert.equal(rij.lidKey, 'user-7');
  assert.deepEqual([rij.context.context.contextId, rij.context.context.contextSoort, rij.context.context.contextVersie], ['ZAAK1', 'zaak', 1]);
  assert.equal(rij.context.context.herkomst.methode, 'gemeten');
  assert.equal(rij.context.context.herkomst.bron, 'persoonlijk-rtg-account');
  assert.equal(rij.context.context.herkomst.regelversie, 'staff-account-v1');
  assert.equal(reg.vanLid('user-7')[0].stand.context.graad, 'gemeten');
  // Een eigen bron wordt vastgelegd.
  const t = sessie({ sid: 'mnopqrstuvwx', code: undefined });
  assert.equal(registreer(reg, t, 'user-7', 'magnaat-pin'), true);
  // Zonder zaakcode komt er GEEN lege zaak in de context: de poort weigert een lege sleutel.
  assert.equal(reg.lees(t.sid).context.context, undefined);
  const u = sessie({ sid: 'yzABCDEFGHIJ' });
  assert.equal(registreer(reg, u, 'user-7', 'magnaat-pin'), true);
  assert.equal(reg.lees(u.sid).context.context.herkomst.bron, 'magnaat-pin');
  // Niets zonder register, sessie, sid of lid.
  for (const [r, sess, lid] of [[null, s, 'user-7'], [reg, null, 'user-7'], [reg, sessie({ sid: '' }), 'user-7'], [reg, s, '']]) {
    assert.equal(registreer(r, sess, lid), false);
  }
});

test('6. een plek zonder zaakcode past op geen enkele zaak, ook niet op een lege', () => {
  /* Aan beide kanten `String(x || '')` maakte van een ontbrekende code een
     lege tekst, en '' === '': een plek zonder code paste dan op een sessie of
     een zaak zonder code. */
  const { accounts, staff } = huis();
  staff.set(4, { id: 4, supplier_code: null, member_id: 7, active: 1 });
  assert.equal(plekWerkt(accounts, 4, ''), false, 'leeg tegen leeg is geen zaak');
  assert.equal(plekWerkt(accounts, 4, undefined), false);
  assert.equal(controleer(accounts, sessie({ staffId: 4, code: '' })).ok, false);
  assert.equal(controleer(accounts, sessie({ staffId: 4, code: null })).ok, false);
});
