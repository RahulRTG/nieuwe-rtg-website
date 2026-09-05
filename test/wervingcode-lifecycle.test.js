/* P0-bewijs voor de personeelsuitnodiging als role-escalating bearer.
   Dit toetst de domeinkern zonder HTTP-cache: hash-only opslag, eenmalige
   onthulling, exclusieve claim, hervatten na een storing tussen de twee
   duurzame stores en server-side intrekken/roteren. */
'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const crypto = require('node:crypto');

function opstelling() {
  const collecties = { staffInvites: {} };
  const staff = [];
  const logs = [];
  let volgende = 1;
  let faalTransactiesVanaf = Infinity;
  let faalActivatieNaSchrijf = false;
  let tx = 0;
  const accounts = {
    legacyStaffPinToegestaan: () => true,
    makePin: () => '1357',
    realNameOf: lid => lid.name,
    staffByMember: (code, id) => staff.find(x => x.active && x.supplier_code === code && x.member_id === id) || null,
    createStaff: async g => {
      const bestaand = accounts.staffByMember(g.supplierCode, g.memberId);
      if (bestaand) {
        const e = new Error('unique supplier/member'); e.code = 'SQLITE_CONSTRAINT_UNIQUE'; throw e;
      }
      const rij = { id: volgende++, active: g.active === false ? 0 : 1, supplier_code: g.supplierCode,
        member_id: g.memberId, name: g.name, role: g.role, func: g.func };
      staff.push(rij);
      return rij;
    },
    getStaffByIdAny: id => staff.find(x => x.id === Number(id)) || null,
    activateStaff: id => {
      const r = staff.find(x => x.id === Number(id));
      if (!r) return null;
      r.active = 1;
      if (faalActivatieNaSchrijf) {
        faalActivatieNaSchrijf = false;
        throw new Error('proces viel uit na activatie');
      }
      return r;
    },
    deactivateStaff: id => { const r = staff.find(x => x.id === id); if (r) r.active = 0; },
    getMemberState: () => ({}),
    saveMemberState: () => {}
  };
  const kern = {
    accounts, crypto, db: { data: { suppliers: [{ code: 'ZAAK', name: 'De Zaak' }] } },
    bewerkCollectie: (naam, werk) => {
      assert.equal(naam, 'staffInvites');
      tx += 1;
      if (tx >= faalTransactiesVanaf) throw new Error('opslag tijdelijk niet beschikbaar');
      return werk(collecties.staffInvites);
    },
    save: () => {}, notifySupplier: () => {},
    logActivity: (...delen) => logs.push(JSON.stringify(delen))
  };
  const api = require('../server/routes/supplier/werving/uitnodiging')({ kern });
  return {
    api, accounts, collecties, logs, staff,
    laatTransactieFalenVanaf(n) { tx = 0; faalTransactiesVanaf = n; },
    herstelOpslag() { tx = 0; faalTransactiesVanaf = Infinity; },
    laatActivatieNaSchrijfFalen() { faalActivatieNaSchrijf = true; }
  };
}

const zaak = { code: 'ZAAK', name: 'De Zaak' };
const manager = { name: 'Maaike Manager' };
const lid = (id, name = 'Lid') => ({ id, name, tier: 'rtg' });

test('kale personeelscode verschijnt eenmalig en staat nooit in opslag, lijst of log', async () => {
  const s = opstelling();
  const gemaakt = await s.api.maakInvite(zaak, manager,
    { naam: 'Nova', role: 'staff', func: 'Keuken', idem: 'een' });
  assert.match(gemaakt.kassacode, /^[A-Z2-9]{6}\.[A-F0-9]{32}$/);
  const opslag = JSON.stringify(s.collecties);
  assert.equal(opslag.includes(gemaakt.kassacode), false);
  assert.match(opslag, /"code_hash":"[a-f0-9]{64}"/);

  const lijst = await s.api.lijstInvites('ZAAK');
  assert.equal(JSON.stringify(lijst).includes(gemaakt.kassacode), false);
  assert.equal(JSON.stringify(lijst).includes('code_hash'), false);
  assert.equal(s.logs.join('\n').includes(gemaakt.kassacode), false);

  const herhaald = await s.api.maakInvite(zaak, manager,
    { naam: 'Nova', role: 'staff', func: 'Keuken', idem: 'een' });
  assert.equal(herhaald.status, 409);
  assert.equal(Object.hasOwn(herhaald, 'kassacode'), false);
});

test('ook zonder aangeleverde herhaalsleutel blokkeert de transactie een gelijktijdige dubbeltik', async () => {
  const s = opstelling();
  const uitkomsten = await Promise.all([
    s.api.maakInvite(zaak, manager, { naam: 'Mila', role: 'staff', func: 'Salon' }),
    s.api.maakInvite(zaak, manager, { naam: 'Mila', role: 'staff', func: 'Salon' })
  ]);
  assert.equal(uitkomsten.filter(x => x && x.ok).length, 1);
  assert.equal(uitkomsten.filter(x => x && x.status === 409).length, 1);
  assert.equal(s.collecties.staffInvites.ZAAK.length, 1);
  const code = uitkomsten.find(x => x && x.ok).kassacode;
  assert.equal(JSON.stringify(uitkomsten.find(x => x && x.status === 409)).includes(code), false);
});

test('twee gelijktijdige claims leveren precies een actief personeelsaccount op', async () => {
  const s = opstelling();
  const gemaakt = await s.api.maakInvite(zaak, manager,
    { naam: 'Nova', role: 'staff', func: 'Keuken', idem: 'race' });
  const uitkomsten = await Promise.all([
    s.api.verbindCode(lid(41, 'Eerste'), gemaakt.kassacode, {}, 'ZAAK'),
    s.api.verbindCode(lid(42, 'Tweede'), gemaakt.kassacode, {}, 'ZAAK')
  ]);
  assert.equal(uitkomsten.filter(x => x && x.ok).length, 1);
  assert.equal(uitkomsten.filter(x => x && x.status === 403).length, 1);
  assert.equal(s.staff.filter(x => x.active).length, 1);
  const bewaard = s.collecties.staffInvites.ZAAK[0];
  assert.equal(bewaard.toegang.gebruik, 1);
  assert.equal(bewaard.claim.status, 'voltooid');
});

test('dezelfde member hervat een half-afgeronde claim; een andere member nooit', async () => {
  const s = opstelling();
  const gemaakt = await s.api.maakInvite(zaak, manager,
    { naam: 'Nova', role: 'staff', func: 'Keuken', idem: 'herstel' });

  // context, beginclaim en koppeling slagen; de finalisering faalt. De
  // accountsrij bestaat wel, maar blijft nadrukkelijk buiten iedere login.
  s.laatTransactieFalenVanaf(4);
  await assert.rejects(
    s.api.verbindCode(lid(51, 'Nova'), gemaakt.kassacode, {}, 'ZAAK'),
    /opslag tijdelijk niet beschikbaar/);
  assert.equal(s.staff.filter(x => x.active).length, 0,
    'een halfafgeronde role-claim geeft nooit alvast toegang');
  assert.equal(s.collecties.staffInvites.ZAAK[0].claim.status, 'bezig');
  assert.equal(s.collecties.staffInvites.ZAAK[0].claim.staffId, s.staff[0].id,
    'de herstelroute is aan exact de inactieve rij gebonden');

  s.herstelOpslag();
  const indringer = await s.api.verbindCode(lid(52, 'Ander'), gemaakt.kassacode, {}, 'ZAAK');
  assert.equal(indringer.status, 403);
  assert.equal(s.staff.filter(x => x.active).length, 0);

  const hervat = await s.api.verbindCode(lid(51, 'Nova'), gemaakt.kassacode, {}, 'ZAAK');
  assert.equal(hervat.ok, true);
  assert.equal(hervat.staff.id, s.staff[0].id);
  assert.equal(s.collecties.staffInvites.ZAAK[0].claim.status, 'voltooid');
  assert.equal(s.collecties.staffInvites.ZAAK[0].toegang.gebruik, 1);
});

test('uitval na activatie sluit fail-closed en een retry herstelt zonder PIN-replay', async () => {
  const s = opstelling();
  const gemaakt = await s.api.maakInvite(zaak, manager,
    { naam: 'Nova', role: 'manager', func: 'Leiding', idem: 'crash-activatie' });
  s.laatActivatieNaSchrijfFalen();

  await assert.rejects(
    s.api.verbindCode(lid(61, 'Nova'), gemaakt.kassacode, {}, 'ZAAK'),
    /proces viel uit na activatie/);
  const claim = s.collecties.staffInvites.ZAAK[0].claim;
  assert.equal(claim.status, 'voltooid');
  assert.equal(s.staff.filter(x => x.active).length, 0,
    'compensatie sluit ook een rij waarbij de activatieschrijf al gelukt was');

  const indringer = await s.api.verbindCode(lid(62, 'Ander'), gemaakt.kassacode, {}, 'ZAAK');
  assert.equal(indringer.status, 403);
  assert.equal(s.staff.filter(x => x.active).length, 0);

  const herstel = await s.api.verbindCode(lid(61, 'Nova'), gemaakt.kassacode, {}, 'ZAAK');
  assert.equal(herstel.status, 409);
  assert.equal(herstel.hersteld, true);
  assert.equal(Object.hasOwn(herstel, 'pin'), false, 'een retry onthult het eenmalige geheim niet');
  assert.equal(herstel.staff.id, claim.staffId);
  assert.equal(s.staff.filter(x => x.active).length, 1);
});

test('intrekken en roteren maken oude codes server-side nutteloos', async () => {
  const s = opstelling();
  const eerste = await s.api.maakInvite(zaak, manager,
    { naam: 'Nova', role: 'staff', func: 'Keuken', idem: 'rotatie' });
  const rotatie = await s.api.roteerInvite('ZAAK', eerste.id, manager.name, 'rotatie-een');
  assert.equal(rotatie.ok, true);
  assert.notEqual(rotatie.kassacode, eerste.kassacode);
  assert.equal(await s.api.zoekInvite(eerste.kassacode), null);
  assert.ok(await s.api.zoekInvite(rotatie.kassacode));

  const retry = await s.api.roteerInvite('ZAAK', eerste.id, manager.name, 'rotatie-een');
  assert.equal(retry.status, 409);
  assert.equal(retry.kassacode, undefined, 'een transportretry heronthult geen credential');
  assert.ok(await s.api.zoekInvite(rotatie.kassacode),
    'de retry roteert de zojuist getoonde code niet stil opnieuw');

  const ingetrokken = await s.api.trekInviteIn('ZAAK', eerste.id, manager.name, 'verkeerd adres');
  assert.equal(ingetrokken.ok, true);
  assert.equal(await s.api.zoekInvite(rotatie.kassacode), null);
});

test('een zwakke legacy-kassacode wordt hash-only opgeslagen maar fail-closed tot rotatie', async () => {
  const s = opstelling();
  const oudeCode = 'ABC234';
  s.collecties.staffInvites.ZAAK = [{ kassacode: oudeCode, naam: 'Legacy',
    role: 'staff', func: 'Balie', door: 'oude manager', createdAt: new Date().toISOString(),
    expires: Date.now() + 86400000, used: false }];

  const lijst = await s.api.lijstInvites('ZAAK');
  assert.equal(lijst.invites.length, 1);
  assert.equal(lijst.invites[0].status, 'ingetrokken');
  assert.equal(JSON.stringify(s.collecties).includes(oudeCode), false);
  assert.equal(await s.api.zoekInvite(oudeCode), null);

  const nieuw = await s.api.roteerInvite('ZAAK', lijst.invites[0].id, manager.name);
  assert.match(nieuw.kassacode, /^[A-Z2-9]{6}\.[A-F0-9]{32}$/);
  assert.ok(await s.api.zoekInvite(nieuw.kassacode));
});

test('uitnodigingsadres vertrouwt alleen vaste APP_URL en houdt het geheim uit pad en query', () => {
  const s = opstelling();
  const oud = process.env.APP_URL;
  process.env.APP_URL = 'https://rtg.example///';
  try {
    const code = 'ABCDEF.' + 'A'.repeat(32);
    const kwaadaardigVerzoek = { protocol: 'https', get: () => 'aanvaller.example' };
    const link = s.api.wervingsLink(kwaadaardigVerzoek, code);
    const u = new URL(link);
    assert.equal(u.origin, 'https://rtg.example');
    assert.equal(u.pathname, '/apps/app.html');
    assert.equal(u.search, '');
    assert.equal(u.hash, '#werving=' + code);
    assert.equal(link.includes('aanvaller.example'), false);
  } finally {
    if (oud == null) delete process.env.APP_URL; else process.env.APP_URL = oud;
  }
});

test('productie geeft zonder een veilige vaste APP_URL geen uitnodigingsadres uit', () => {
  const s = opstelling();
  const oudeUrl = process.env.APP_URL;
  const oudeOmgeving = process.env.NODE_ENV;
  delete process.env.APP_URL;
  process.env.NODE_ENV = 'production';
  try {
    assert.equal(s.api.wervingsBasis().ok, false);
    assert.throws(() => s.api.wervingsLink({}, 'ABCDEF.' + 'A'.repeat(32)),
      e => e && e.code === 'RTG_WERVING_APP_URL');
    process.env.APP_URL = 'http://rtg.example';
    assert.equal(s.api.wervingsBasis().ok, false, 'productie accepteert geen onbeveiligde oorsprong');
    process.env.APP_URL = 'https://rtg.example/pad?injectie=1';
    assert.equal(s.api.wervingsBasis().ok, false, 'query/fragment horen niet in de vaste oorsprong');
  } finally {
    if (oudeUrl == null) delete process.env.APP_URL; else process.env.APP_URL = oudeUrl;
    if (oudeOmgeving == null) delete process.env.NODE_ENV; else process.env.NODE_ENV = oudeOmgeving;
  }
});
