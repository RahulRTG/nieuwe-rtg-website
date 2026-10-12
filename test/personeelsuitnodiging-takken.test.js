'use strict';
/* DE PERSONEELSUITNODIGING, de takken van server/routes/supplier/werving/
   uitnodiging.js en ./uitnodiging-claim.js die test/wervingcode-lifecycle.test.js
   en test/staff-ontslag.test.js niet langslopen. Rechtstreeks op de module met
   een nagemaakte kern (accounts, collectietransactie, suppliers): het omzetten
   van oude rijen, de transactie zonder bewerkCollectie, het vaste
   uitnodigingsadres, kassacodeHoortBij, en elke uitgang van verbindCode --
   ook een intrekking die tussen twee stappen van de claim valt, een activatie
   die weigert en de hersteltak voor een plek die halverwege bleef steken. */
const test = require('node:test');
const assert = require('node:assert/strict');
const crypto = require('node:crypto');
const maakUitnodiging = require('../server/routes/supplier/werving/uitnodiging');

const ZAAK = { code: 'ZAAK', name: 'De Zaak' };
const MANAGER = { name: 'Maaike' };
const lid = (id, name) => ({ id, name: name === undefined ? 'Lid ' + id : name, tier: 'rtg' });

function opstelling(o = {}) {
  const collecties = { staffInvites: o.bron || {} };
  const staff = [];
  const logs = [];
  const seinen = [];
  const gesloten = [];
  const toestanden = {};
  let volgende = 1;
  let tx = 0;
  const haken = {};
  const accounts = {
    legacyStaffPinToegestaan: () => !!o.legacy,
    makePin: () => '2468',
    realNameOf: (l) => l.name || null,
    staffByMember: (code, id) => staff.find(x => x.active && x.supplier_code === code && x.member_id === id) || null,
    createStaff: async (g) => {
      if (haken.bijMaken) haken.bijMaken(g);
      const rij = { id: volgende++, active: 0, supplier_code: g.supplierCode, member_id: g.memberId, name: g.name,
        role: o.verkeerdeRol ? 'manager' : g.role, func: g.func, pin: g.pin };
      staff.push(rij); return rij;
    },
    createAccountStaff: (g) => {
      if (haken.bijMaken) haken.bijMaken(g);
      const rij = { id: volgende++, active: 0, supplier_code: g.supplierCode, member_id: g.memberId, name: g.name,
        role: o.verkeerdeRol ? 'manager' : g.role, func: g.func };
      staff.push(rij); return rij;
    },
    getStaffByIdAny: (id) => staff.find(x => x.id === Number(id)) || null,
    getUserById: (id) => (o.leden || {})[id] || null,
    isActief: () => true,
    plekWerkt: (id, zaak) => require('../server/accounts/staff-sessie').plekWerkt(accounts, id, zaak),
    activateStaff: (id) => {
      if (o.activatieWeigert) return null;
      const r = staff.find(x => x.id === Number(id)); if (!r) return null; r.active = 1; return r;
    },
    deactivateStaff: (id) => { gesloten.push(id); const r = staff.find(x => x.id === id); if (r) r.active = 0; },
    getMemberState: (id) => { if (o.toestandGooit) throw new Error('kluis dicht'); return toestanden[id] || null; },
    saveMemberState: (id, st) => { toestanden[id] = st; }
  };
  const db = { data: { suppliers: o.suppliers || [ZAAK, { code: 'ANDER', name: 'Ander' }] } };
  const kern = {
    accounts, crypto, db,
    bewerkCollectie: o.zonderTransactie ? undefined : (naam, werk) => {
      tx += 1;
      if (haken[tx]) haken[tx](collecties.staffInvites);
      return werk(o.vorm !== undefined ? o.vorm : collecties.staffInvites);
    },
    save: o.save, notifySupplier: (code, m) => { if (o.seinGooit) throw new Error('weg'); seinen.push({ code, m }); },
    logActivity: (...delen) => logs.push(delen),
    dienstverbandUitAanname: o.brug
  };
  const api = maakUitnodiging({ kern });
  const alle = () => Object.values(collecties.staffInvites).flat();
  return { api, accounts, collecties, staff, logs, seinen, gesloten, toestanden, db, alle, haken,
    /* de volgende transacties tellen vanaf nu; haak n draait vlak voor transactie n */
    tel() { tx = 0; for (const k of Object.keys(haken)) delete haken[k]; } };
}
const trekIn = (bron) => { for (const inv of Object.values(bron).flat()) inv.toegang.ingetrokken_at = new Date().toISOString(); };

async function metEnv(waarden, fn) {
  const oud = {};
  for (const k of Object.keys(waarden)) { oud[k] = process.env[k]; if (waarden[k] == null) delete process.env[k]; else process.env[k] = waarden[k]; }
  try { return await fn(); } finally { for (const k of Object.keys(oud)) { if (oud[k] === undefined) delete process.env[k]; else process.env[k] = oud[k]; } }
}

test('DOEL en SCOPE staan op de module', () => {
  assert.equal(maakUitnodiging.DOEL, 'workos-personeelsuitnodiging');
  assert.deepEqual(maakUitnodiging.SCOPE, ['supplier.staff.join']);
});

test('oude rijen: een lijst die geen lijst is wordt leeg, en een legacy-code wordt hash-only en dicht', async () => {
  const bron = {
    KAPOT: 'geen lijst',
    ZAAK: [
      null,
      { id: 'al-nieuw', toegang: { code_hash: 'x' } },
      { naam: 'zonder code' },
      { kassacode: 'OUD123', createdAt: 'geen datum', role: 'staff' },
      { id: 'sinv-oud', kassacode: 'OUD456', createdAt: '2026-01-01T00:00:00.000Z', expires: Date.parse('2026-02-01T00:00:00.000Z'),
        used: true, memberId: 7, usedAt: '2026-01-05T00:00:00.000Z', door: 'Oude manager', role: 'staff' },
      { kassacode: 'OUD789', createdAt: '2026-03-01T00:00:00.000Z', used: true, role: 'staff' }
    ]
  };
  const s = opstelling({ bron });
  /* een oude code opent niets meer; het zoeken zet de rijen om */
  assert.equal(await s.api.kassacodeHoortBij('OUD123', 'ZAAK'), false);
  assert.deepEqual(s.collecties.staffInvites.KAPOT, []);
  const [, , , vers, gebruikt, zonderLid] = s.collecties.staffInvites.ZAAK;
  assert.match(vers.id, /^sinv-[0-9a-f]{16}$/);
  assert.equal(vers.toegang.issuer, 'legacy');
  assert.equal(vers.kassacode, undefined, 'de kale code is weg');
  assert.equal(vers.toegang.intrekreden, 'legacy credential vereist rotatie');
  assert.ok(Number.isFinite(Date.parse(vers.toegang.issued_at)));
  assert.equal(gebruikt.id, 'sinv-oud');
  assert.equal(gebruikt.toegang.issuer, 'Oude manager');
  assert.equal(gebruikt.toegang.expires_at, '2026-02-01T00:00:00.000Z');
  assert.equal(gebruikt.toegang.gebruik, 1);
  assert.deepEqual(gebruikt.claim, { memberId: 7, status: 'voltooid', at: '2026-01-05T00:00:00.000Z', voltooid_at: '2026-01-05T00:00:00.000Z' });
  assert.equal(zonderLid.claim.memberId, null);
  assert.equal(zonderLid.claim.at, '2026-03-01T00:00:00.000Z');
  assert.equal(Date.parse(zonderLid.toegang.expires_at) - Date.parse('2026-03-01T00:00:00.000Z'), 30 * 86400000);
  assert.deepEqual(s.collecties.staffInvites.ZAAK[1], { id: 'al-nieuw', toegang: { code_hash: 'x' } }, 'een omgezette rij blijft zoals hij is');
  assert.deepEqual(s.collecties.staffInvites.ZAAK[2], { naam: 'zonder code' });
  /* de lijst toont alleen ongeclaimde rijen, en een dichte legacy-rij met zijn reden */
  const t = opstelling({ bron: { ZAAK: [{ kassacode: 'OUDABC', createdAt: '2026-01-01T00:00:00.000Z', role: 'staff' },
    { id: 'sinv-gebruikt', kassacode: 'OUDDEF', createdAt: '2026-01-01T00:00:00.000Z', used: true, role: 'staff' }] } });
  const lijst = await t.api.lijstInvites('ZAAK');
  assert.equal(lijst.invites.length, 1);
  assert.equal(lijst.invites[0].status, 'ingetrokken');
  assert.ok(!lijst.invites.some(i => i.id === 'sinv-gebruikt'));
});

test('een collectie die geen kaart is, wordt geweigerd', () => {
  for (const vorm of [null, [], 7]) {
    const s = opstelling({ vorm });
    assert.throws(() => s.api.lijstInvites('ZAAK'), /staffInvites hoort een kaart te zijn/);
  }
});

test('zonder collectietransactie buiten productie: de collectie in db.data, en bewaren alleen bij een wijziging', async () => {
  await metEnv({ NODE_ENV: 'test' }, async () => {
    let saves = 0;
    const s = opstelling({ zonderTransactie: true, save: () => { saves++; } });
    s.db.data.staffInvites = 'kapot';
    const leeg = s.api.lijstInvites('ZAAK');
    assert.deepEqual(leeg.invites, []);
    assert.deepEqual(s.db.data.staffInvites, { ZAAK: [] });
    assert.equal(saves, 1, 'de nieuwe lege lijst is een wijziging');
    s.api.lijstInvites('ZAAK');
    assert.equal(saves, 1, 'een tweede keer lezen verandert niets');
    const g = s.api.maakInvite(ZAAK, MANAGER, { naam: 'Ida' });
    assert.equal(g.ok, true);
    assert.equal(saves, 2);
    assert.equal(s.api.lijstInvites('ZAAK').invites.length, 1);
    /* zonder save-functie gaat het ook */
    const t = opstelling({ zonderTransactie: true });
    assert.equal(t.api.maakInvite(ZAAK, MANAGER, {}).ok, true);
  });
});

test('het uitnodigingsadres: alleen een schone vaste oorsprong, en in productie alleen HTTPS', async () => {
  const s = opstelling();
  await metEnv({ NODE_ENV: 'test', APP_URL: '' }, () => {
    assert.deepEqual(s.api.wervingsBasis(), { ok: true, basis: '' });
    assert.equal(s.api.wervingsLink(null, 'AB CD'), '/apps/app.html#werving=AB%20CD');
    assert.equal(s.api.wervingsLink(null, null), '/apps/app.html#werving=');
  });
  for (const [url, fout] of [['https://u:p@rtg.example', /geen veilige vaste oorsprong/], ['https://rtg.example/?x=1', /geen veilige/],
    ['https://rtg.example/#a', /geen veilige/], ['ftp://rtg.example', /geen veilige/], ['geen url', /geen geldige vaste oorsprong/]]) {
    await metEnv({ NODE_ENV: 'test', APP_URL: url }, () => assert.match(s.api.wervingsBasis().error, fout, url));
  }
  await metEnv({ NODE_ENV: 'test', APP_URL: ' http://rtg.example/pad ' }, () =>
    assert.deepEqual(s.api.wervingsBasis(), { ok: true, basis: 'http://rtg.example' }));
  await metEnv({ NODE_ENV: 'production', APP_URL: 'http://rtg.example' }, () => {
    assert.match(s.api.wervingsBasis().error, /HTTPS/);
    assert.throws(() => s.api.wervingsLink(null, 'X'), (e) => e.code === 'RTG_WERVING_APP_URL' && /HTTPS/.test(e.message));
  });
  await metEnv({ NODE_ENV: 'production', APP_URL: 'https://rtg.example' }, () =>
    assert.equal(s.api.wervingsLink(null, 'X'), 'https://rtg.example/apps/app.html#werving=X'));
  await metEnv({ NODE_ENV: 'production', APP_URL: null }, () =>
    assert.match(s.api.wervingsBasis().error, /APP_URL ontbreekt/));
});

test('kassacodeHoortBij: bedrijf, geldigheid, en een claim alleen voor het eigen lid', async () => {
  const s = opstelling();
  const g = await s.api.maakInvite(ZAAK, MANAGER, { naam: 'Ida', idem: 'k1' });
  assert.equal(await s.api.kassacodeHoortBij(g.kassacode, 'ZAAK'), true);
  assert.equal(await s.api.kassacodeHoortBij(g.kassacode, 'ANDER'), false);
  assert.equal(await s.api.kassacodeHoortBij('GEEN-CODE', 'ZAAK'), false);
  /* geclaimd maar halverwege: zonder lid telt hij, met lid alleen het eigen lid */
  const rij = s.alle()[0];
  rij.claim = { memberId: 5, status: 'bezig' };
  assert.equal(await s.api.kassacodeHoortBij(g.kassacode, 'ZAAK'), true);
  assert.equal(await s.api.kassacodeHoortBij(g.kassacode, 'ZAAK', lid(5)), true);
  assert.equal(await s.api.kassacodeHoortBij(g.kassacode, 'ZAAK', lid(6)), false);
  rij.claim.status = 'mislukt';
  assert.equal(await s.api.kassacodeHoortBij(g.kassacode, 'ZAAK'), false);
  rij.claim.status = 'voltooid';
  rij.toegang.ingetrokken_at = new Date().toISOString();
  assert.equal(await s.api.kassacodeHoortBij(g.kassacode, 'ZAAK'), false, 'ingetrokken ook na de claim');
});

test('een open code van een uitgever die hier niet meer werkt, geldt niet meer', async () => {
  const s = opstelling();
  s.staff.push({ id: 90, active: 1, supplier_code: 'ZAAK', member_id: null, role: 'manager' });
  const g = await s.api.maakInvite(ZAAK, { name: 'Mo', staffId: 90 }, {});
  assert.equal(await s.api.kassacodeHoortBij(g.kassacode, 'ZAAK'), true);
  s.staff[0].active = 0;
  assert.equal(await s.api.kassacodeHoortBij(g.kassacode, 'ZAAK'), false);
  assert.equal(await s.api.zoekInvite(g.kassacode), null);
});

test('zoekInvite: een open code geeft zaak en uitnodiging, geclaimd of zonder zaak niets', async () => {
  const s = opstelling();
  const g = await s.api.maakInvite(ZAAK, MANAGER, { naam: 'Ida', role: 'manager', func: 'Bar' });
  const z = await s.api.zoekInvite(g.kassacode);
  assert.equal(z.s.code, 'ZAAK');
  assert.equal(z.inv.role, 'manager');
  assert.equal(z.inv.func, 'Bar');
  assert.equal(z.inv.claim, null);
  assert.equal(await s.api.zoekInvite('ONBEKEND'), null);
  s.db.data.suppliers = [];
  assert.equal(await s.api.zoekInvite(g.kassacode), null);
  s.db.data.suppliers = undefined;
  assert.equal(await s.api.zoekInvite(g.kassacode), null, 'zonder supplierlijst bestaat de zaak niet');
  s.db.data.suppliers = [ZAAK];
  s.alle()[0].claim = { memberId: 1, status: 'bezig' };
  assert.equal(await s.api.zoekInvite(g.kassacode), null);
});

test('verbindCode weigert zonder lid of code, een vreemde code, een ander bedrijf en een dubbele aanmelding', async () => {
  const s = opstelling();
  const g = await s.api.maakInvite(ZAAK, MANAGER, {});
  assert.equal((await s.api.verbindCode(null, g.kassacode)).status, 400);
  assert.equal((await s.api.verbindCode(lid(1), '')).status, 400);
  assert.equal((await s.api.verbindCode(lid(1), 'ONBEKEND')).status, 403);
  assert.equal((await s.api.verbindCode(lid(1), g.kassacode, {}, 'ANDER')).status, 403);
  s.staff.push({ id: 50, active: 1, supplier_code: 'ZAAK', member_id: 1, role: 'staff' });
  const dubbel = await s.api.verbindCode(lid(1), g.kassacode);
  assert.equal(dubbel.status, 409);
  assert.equal(dubbel.code, 'ZAAK');
  assert.equal(s.alle()[0].claim, null, 'er is niets geclaimd');
  /* een uitnodiging van een zaak die er niet meer is */
  s.db.data.suppliers = [];
  assert.equal((await s.api.verbindCode(lid(2), g.kassacode)).status, 403);
});

test('een geslaagde aanmelding zonder pincode: accountplek, naam, herkomst, log, seintje en geen brug', async () => {
  const s = opstelling();
  const g = await s.api.maakInvite(ZAAK, MANAGER, { func: 'Keuken' });
  const v = await s.api.verbindCode(lid(3, 'Vera'), g.kassacode);
  assert.equal(v.ok, true);
  assert.equal(v.pin, undefined, 'zonder legacy geen pincode');
  assert.equal(v.naam, 'Vera');
  assert.equal(v.staff.active, 1);
  assert.equal(v.staff.func, 'Keuken');
  assert.deepEqual(v.dienstverband, { gemaakt: false, reden: 'RTG Concern is in dit proces niet geladen.' });
  assert.equal(s.toestanden[3].via.code, 'ZAAK');
  assert.match(s.logs[0][2], /Vera meldde zich aan/);
  assert.equal(s.seinen.length, 1);
  assert.equal(s.alle()[0].claim.status, 'voltooid');
  assert.ok(s.alle()[0].claim.geactiveerd_at);
  /* een tweede keer met dezelfde code: het eigen lid krijgt de herstelzin */
  const weer = await s.api.verbindCode(lid(3, 'Vera'), g.kassacode);
  assert.equal(weer.status, 409);
  assert.equal(weer.hersteld, true);
  assert.equal(s.logs.length, 1, 'een herhaling meldt zich niet opnieuw aan');
  /* een ander lid komt er nooit in */
  assert.equal((await s.api.verbindCode(lid(4), g.kassacode)).status, 403);
});

test('legacy: een pincode uit de opties of gemaakt, en een lid zonder naam heet Medewerker', async () => {
  const s = opstelling({ legacy: true, brug: (a) => ({ gemaakt: true, zaak: a.zaak, persoon: a.persoon, rol: a.rol }) });
  const a = await s.api.maakInvite(ZAAK, MANAGER, {});
  const b = await s.api.maakInvite(ZAAK, MANAGER, { naam: 'Bo' });
  const va = await s.api.verbindCode(lid(8, null), a.kassacode, { pin: '1111' });
  assert.equal(va.pin, '1111');
  assert.equal(va.naam, 'Medewerker');
  assert.deepEqual(va.dienstverband, { gemaakt: true, zaak: 'ZAAK', persoon: 'user-8', rol: null });
  const vb = await s.api.verbindCode(lid(9), b.kassacode);
  assert.equal(vb.pin, '2468');
  assert.equal(vb.naam, 'Bo', 'de naam op de uitnodiging gaat voor');
});

test('de nawerking faalt nooit hardop: een kluis die gooit, een bestaande herkomst, een seintje en een brug die falen', async () => {
  const s = opstelling({ toestandGooit: true, seinGooit: true, brug: () => { throw new Error('concern weg'); } });
  const g = await s.api.maakInvite(ZAAK, MANAGER, {});
  const v = await s.api.verbindCode(lid(3), g.kassacode);
  assert.equal(v.ok, true);
  assert.deepEqual(v.dienstverband, { gemaakt: false, reden: 'Het dienstverband kon niet worden vastgelegd.' });
  const t = opstelling();
  t.toestanden[4] = { via: { soort: 'uitnodiging', code: 'EERDER' } };
  const h = await t.api.maakInvite(ZAAK, MANAGER, {});
  await t.api.verbindCode(lid(4), h.kassacode);
  assert.equal(t.toestanden[4].via.code, 'EERDER', 'een herkomst wordt niet overschreven');
});

test('een plek die niet bij de uitnodiging past, wordt gesloten', async () => {
  const s = opstelling({ verkeerdeRol: true });
  const g = await s.api.maakInvite(ZAAK, MANAGER, {});
  const v = await s.api.verbindCode(lid(3), g.kassacode);
  assert.equal(v.status, 409);
  assert.match(v.error, /past niet bij deze uitnodiging/);
  assert.deepEqual(s.gesloten, [1]);
});

test('een intrekking tussen de stappen van de claim sluit de half gemaakte plek', async () => {
  /* transacties in verbindCode: 1 zoeken, 2 claim, 3 koppelen, 4 voltooien, 5 bevestigen */
  for (const [stap, zin] of [[3, /veilig worden gekoppeld/], [4, /intussen ingetrokken/], [5, /niet meer geldig/]]) {
    const s = opstelling();
    const g = await s.api.maakInvite(ZAAK, MANAGER, {});
    s.tel();
    s.haken[stap] = trekIn;
    const v = await s.api.verbindCode(lid(3), g.kassacode);
    assert.equal(v.status, 409, 'stap ' + stap);
    assert.match(v.error, zin);
    assert.deepEqual(s.gesloten, [1]);
    assert.equal(s.logs.length, 0, 'geen aanmelding in het log');
  }
});

test('een activatie die weigert, gooit en sluit de plek', async () => {
  const s = opstelling({ activatieWeigert: true });
  const g = await s.api.maakInvite(ZAAK, MANAGER, {});
  await assert.rejects(s.api.verbindCode(lid(3), g.kassacode), /personeelsactivatie geweigerd/);
  assert.deepEqual(s.gesloten, [1]);
  assert.equal(s.alle()[0].claim.status, 'voltooid');
});

test('de hersteltak: een halve aanmelding wordt hersteld, een uitgezette plek nooit', async () => {
  for (const legacy of [false, true]) {
    const s = opstelling({ legacy });
    const g = await s.api.maakInvite(ZAAK, MANAGER, {});
    /* de plek staat gekoppeld en voltooid, maar is nooit actief geweest */
    await s.api.verbindCode(lid(3), g.kassacode);
    const rij = s.alle()[0];
    delete rij.claim.geactiveerd_at;
    s.staff[0].active = 0;
    s.logs.length = 0;
    const r = await s.api.verbindCode(lid(3), g.kassacode);
    assert.equal(r.status, 409);
    assert.equal(r.hersteld, true);
    assert.match(r.error, legacy ? /Een pincode wordt nooit opnieuw getoond/ : /persoonlijke RTG-account/);
    assert.equal(s.staff[0].active, 1);
    assert.equal(s.logs.length, 1, 'de eerste activatie meldt zich alsnog aan');
    /* nog eens: nu was hij al actief, dus geen tweede logregel */
    const weer = await s.api.verbindCode(lid(3), g.kassacode, {}, 'ZAAK');
    assert.equal(weer.status, 409);
    assert.equal(s.logs.length, 1);
  }
});

test('de hersteltak weigert een plek die al actief was en nu uit staat, of niet meer bij het lid hoort', async () => {
  const s = opstelling();
  const g = await s.api.maakInvite(ZAAK, MANAGER, {});
  await s.api.verbindCode(lid(3), g.kassacode);
  s.staff[0].active = 0;
  assert.equal((await s.api.verbindCode(lid(3), g.kassacode)).status, 403);
  s.staff[0].member_id = 99;
  delete s.alle()[0].claim.geactiveerd_at;
  assert.equal((await s.api.verbindCode(lid(3), g.kassacode)).status, 403);
});

test('de hersteltak: een activatie of bevestiging die faalt, sluit de plek weer', async () => {
  const s = opstelling();
  const g = await s.api.maakInvite(ZAAK, MANAGER, {});
  await s.api.verbindCode(lid(3), g.kassacode);
  delete s.alle()[0].claim.geactiveerd_at;
  s.staff[0].active = 0;
  /* transacties in de hersteltak: 1 zoeken, 2 claim, 3 bevestigen */
  s.tel();
  s.haken[3] = trekIn;
  const r = await s.api.verbindCode(lid(3), g.kassacode);
  assert.equal(r.status, 409);
  assert.match(r.error, /niet meer geldig/);
  assert.deepEqual(s.gesloten, [1]);
  const t = opstelling({ activatieWeigert: true });
  const h = await t.api.maakInvite(ZAAK, MANAGER, {});
  await assert.rejects(t.api.verbindCode(lid(3), h.kassacode));
  await assert.rejects(t.api.verbindCode(lid(3), h.kassacode), /personeelsactivatie geweigerd/);
  assert.deepEqual(t.gesloten, [1, 1]);
});

test('hervatten: een halve claim met een actieve plek zonder koppeling sluit die plek en gaat verder met hem', async () => {
  const s = opstelling();
  const g = await s.api.maakInvite(ZAAK, MANAGER, {});
  /* de claim staat op bezig, er is al een actieve plek voor dit lid maar niet gekoppeld */
  await s.api.verbindCode(lid(3), g.kassacode);
  const rij = s.alle()[0];
  rij.claim = { id: 'c', memberId: 3, status: 'bezig', at: rij.claim.at, staffId: null };
  const v = await s.api.verbindCode(lid(3), g.kassacode);
  assert.equal(v.ok, true);
  assert.equal(v.staff.id, 1, 'dezelfde plek, geen tweede');
  assert.deepEqual(s.gesloten, [1]);
  assert.equal(s.staff.length, 1);
  assert.equal(rij.claim.status, 'voltooid');
});

test('wisselCodeIn: alleen een uitslag, en nooit een fout naar buiten', async () => {
  const s = opstelling({ legacy: true });
  const g = await s.api.maakInvite(ZAAK, MANAGER, {});
  assert.equal(await s.api.wisselCodeIn(null, g.kassacode), null);
  assert.equal(await s.api.wisselCodeIn(lid(1), ''), null);
  assert.equal(await s.api.wisselCodeIn(lid(1), 'ONBEKEND'), null);
  assert.deepEqual(await s.api.wisselCodeIn(lid(1), g.kassacode), { code: 'ZAAK', bedrijf: 'De Zaak', staffId: 1, role: 'staff', pin: '2468' });
  const t = opstelling({ activatieWeigert: true });
  const h = await t.api.maakInvite(ZAAK, MANAGER, {});
  assert.equal(await t.api.wisselCodeIn(lid(1), h.kassacode), null, 'een fout wordt null');
  const u = opstelling();
  const k = await u.api.maakInvite(ZAAK, MANAGER, {});
  assert.equal((await u.api.wisselCodeIn(lid(2), k.kassacode)).pin, undefined);
});

test('neemAan: alleen voor een bestaand lid achter een geldige sleutel', async () => {
  const s = opstelling({ leden: { 12: lid(12, 'Noor') } });
  const g = await s.api.maakInvite(ZAAK, MANAGER, {});
  assert.equal(await s.api.neemAan(ZAAK, g, 'geen-sleutel'), null);
  assert.equal(await s.api.neemAan(ZAAK, g, 'user-13'), null);
  const r = await s.api.neemAan(ZAAK, g, 'user-12');
  assert.equal(r.naam, 'Noor');
  assert.equal(r.staffId, 1);
  assert.equal(r.dienstverband.gemaakt, false);
  assert.equal(await s.api.neemAan({ code: 'ANDER' }, g, 'user-12'), null);
});
