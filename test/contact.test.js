/* Nooit meer vreemden: zodra een lid echt in contact komt met een partner
   (hier: een bezorgaanvraag) opent er automatisch een open chatlijn. Beide
   kanten zien die lijn, de partner mag vooraf de Salon van het lid bekijken
   (privacy-first: alleen codenaam, pas en eigen posts) en de partner kan het
   lid direct appen. Idempotent: de lijn en het welkomstbericht komen maar een
   keer. Draai: npm test */
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { startServer, stop } = require('./helper');

function api(base, pad, body, token) {
  const h = { 'Content-Type': 'application/json' };
  if (token) h.Authorization = 'Bearer ' + token;
  return fetch(base + pad, { method: 'POST', headers: h, body: JSON.stringify(body || {}) })
    .then(async r => ({ status: r.status, body: await r.json().catch(() => ({})) }));
}

let srv, base, winkel, vreemdeZaak, lid, ander, lidProfiel, anderProfiel;
const ADRES = 'Carrer de la Mar 10, Ibiza';

test.before(async () => {
  const TMP = fs.mkdtempSync(path.join(os.tmpdir(), 'rtg-contact-'));
  srv = await startServer({ env: { SMTP_URL: '', RTG_DATA_DIR: TMP, DEMO_SUPPLIER: 'MAISON' } });
  base = srv.base;
  winkel = (await api(base, '/api/supplier/login', { username: 'rahul', password: 'Imran' })).body.token;
  await api(base, '/api/supplier/mode/bezorg/setup', { aan: true, kosten: 6.5, gratisVanaf: 150, waardegrensId: 250 }, winkel);
  const u = Date.now().toString().slice(-8);
  const reg = await api(base, '/api/auth/register', { name: 'Contact Lid', email: 'c' + u + '@x.nl',
    phone: '06' + u, password: 'geheim123', geboortedatum: '1990-01-01', tier: 'business', pasApp: 'business' });
  assert.equal(reg.status, 200);
  lid = reg.body.token;
  lidProfiel = reg.body.state.user;
  assert.ok(Number.isSafeInteger(lidProfiel.id) && lidProfiel.id > 0, 'de klant heeft een echte account-ID');
  assert.equal(lidProfiel.tier, 'guest', 'een gewenste Business-pas maakt registratie niet betaald');
  const tweede = await api(base, '/api/auth/register', { name: 'Ander Contact', email: 'ander' + u + '@x.nl',
    phone: '0611223344', password: 'geheim123', geboortedatum: '1990-01-01' });
  assert.equal(tweede.status, 200);
  ander = tweede.body.token;
  anderProfiel = tweede.body.state.user;
  assert.ok(Number.isSafeInteger(anderProfiel.id) && anderProfiel.id > 0, 'de andere klant heeft een echte account-ID');
  assert.notEqual(anderProfiel.id, lidProfiel.id, 'de IDOR-proef gebruikt twee verschillende accounts');
  assert.equal(anderProfiel.tier, 'guest');
  const roster = await api(base, '/api/supplier/roster', { code: 'KIKUNOI' });
  assert.equal(roster.status, 200);
  const manager = roster.body.staff.find(x => x.role === 'manager');
  assert.ok(manager);
  const login = await api(base, '/api/supplier/login', { code: 'KIKUNOI', staffId: manager.id, pin: '1234' });
  assert.equal(login.status, 200);
  vreemdeZaak = login.body.token;
});
test.after(() => stop(srv && srv.child));

// vind de gastchat van dit lid bij de winkel via de leverancier-state
async function vindChatKey() {
  const st = await api(base, '/api/supplier/state', {}, winkel);
  assert.equal(st.status, 200);
  const chats = (st.body.state && st.body.state.guestChats) || [];
  const eigen = chats.find(c => c.key === 'gast:MAISON|user-' + lidProfiel.id + '|Team');
  return eigen ? eigen.key : null;
}

test('0. gratis geschiedenis zonder aankoop maakt geen lijn of verzendrecht', async () => {
  assert.equal((await api(base, '/api/partner/chat/send', { supplierCode: 'MAISON', text: 'Zonder aankoop' }, lid)).status, 403);
  for (let i = 0; i < 2; i++) {
    const hist = await api(base, '/api/partner/chat/history', { supplierCode: 'MAISON' }, lid);
    assert.equal(hist.status, 200);
    assert.deepEqual(hist.body.messages, []);
  }
  assert.equal(await vindChatKey(), null, 'lezen legt geen lijn aan');
  assert.equal((await api(base, '/api/partner/chat/send', { supplierCode: 'MAISON', text: 'Na lezen' }, lid)).status, 403);
  const salon = await api(base, '/api/supplier/klant/salon', { key: 'gast:MAISON|user-' + lidProfiel.id + '|Team' }, winkel);
  assert.equal(salon.status, 404, 'geschiedenis lezen opent geen klantprofiel voor de zaak');
});

test('1. een contactmoment (bezorgaanvraag) opent automatisch een open lijn met welkomstbericht', async () => {
  const r = await api(base, '/api/mode/bezorg/aanvraag', { supplierCode: 'MAISON', adres: ADRES,
    items: [{ naam: 'Linnen jurk', maat: 'M', prijs: 80, aantal: 1 }] }, lid);
  assert.equal(r.status, 200);
  const hist = await api(base, '/api/partner/chat/history', { supplierCode: 'MAISON' }, lid);
  assert.equal(hist.status, 200);
  assert.ok(hist.body.messages.length >= 1, 'de lijn heeft meteen een systeembericht');
  assert.equal(hist.body.messages[0].from, 'systeem');
  assert.match(hist.body.messages[0].text, /open lijn/i);
  assert.equal((await api(base, '/api/state', {}, lid)).body.state.user.tier, 'guest', 'nazorg kent geen betaalde pas toe');
});

test('2. de partner ziet de lijn in zijn Gastchat-overzicht', async () => {
  const key = await vindChatKey();
  assert.ok(key, 'de winkel ziet een gastchat met dit lid');
});

test('3. de partner mag vooraf de Salon van het lid bekijken (codenaam, pas, posts)', async () => {
  const key = await vindChatKey();
  const r = await api(base, '/api/supplier/klant/salon', { key }, winkel);
  assert.equal(r.status, 200);
  assert.equal(r.body.codename, lidProfiel.codename, 'de eigen codenaam, nooit de echte naam');
  assert.equal(r.body.tier, 'guest', 'de zaak ziet de werkelijke gratis tier');
  assert.ok(Array.isArray(r.body.posts), 'de eigen Salon-posts van het lid');
  assert.deepEqual(Object.keys(r.body).sort(), ['codename', 'posts', 'tier']);
  assert.doesNotMatch(JSON.stringify(r.body), /Contact Lid|1990-01-01/);
});

test('4. de partner kan het lid direct appen op de open lijn', async () => {
  const key = await vindChatKey();
  const snd = await api(base, '/api/supplier/chat/send', { key, text: 'Welkom! Bekijk gerust onze Salon.' }, winkel);
  assert.equal(snd.status, 200);
  const hist = await api(base, '/api/partner/chat/history', { supplierCode: 'MAISON' }, lid);
  assert.ok(hist.body.messages.some(m => m.from === 'partner' && /Bekijk gerust/.test(m.text)), 'het lid ziet het partnerbericht');
  const antwoord = await api(base, '/api/partner/chat/send', { supplierCode: 'MAISON', text: 'Dank, waar blijft mijn bezorging?' }, lid);
  assert.equal(antwoord.status, 200, 'ook het gratis account kan over de eigen aankoop antwoorden');
  const bijZaak = await api(base, '/api/supplier/chat/history', { key }, winkel);
  assert.equal(bijZaak.status, 200);
  assert.ok(bijZaak.body.messages.some(m => m.from === 'guest' && m.text === 'Dank, waar blijft mijn bezorging?'));
});

test('5. idempotent: een tweede contactmoment maakt geen tweede welkomstbericht', async () => {
  const voor = await api(base, '/api/partner/chat/history', { supplierCode: 'MAISON' }, lid);
  const aantalSysteem = voor.body.messages.filter(m => m.from === 'systeem').length;
  assert.equal(aantalSysteem, 1);
  const tweede = await api(base, '/api/mode/bezorg/aanvraag', { supplierCode: 'MAISON', adres: ADRES,
    items: [{ naam: 'Zijden sjaal', prijs: 40, aantal: 1 }] }, lid);
  assert.equal(tweede.status, 200);
  const na = await api(base, '/api/partner/chat/history', { supplierCode: 'MAISON' }, lid);
  assert.equal(na.body.messages.filter(m => m.from === 'systeem').length, aantalSysteem, 'maar een welkomstbericht');
});

test('6. de Salon van een klant is alleen te zien met een echte lijn bij deze zaak', async () => {
  const r = await api(base, '/api/supplier/klant/salon', { key: 'gast:MAISON|user-bestaatniet|Team' }, winkel);
  assert.equal(r.status, 404, 'geen gesprek, geen inzage');
});

test('7. een andere gratis klant kan de lijn niet lezen, overnemen of via history aanleggen', async () => {
  const key = await vindChatKey();
  assert.equal(key, 'gast:MAISON|user-' + lidProfiel.id + '|Team', 'de aanval verwijst naar de echte lijn van de andere klant');
  const body = { supplierCode: 'MAISON', key, customerKey: 'user-' + lidProfiel.id, accountId: lidProfiel.id };
  const hist = await api(base, '/api/partner/chat/history', body, ander);
  assert.equal(hist.status, 200);
  assert.deepEqual(hist.body.messages, [], 'de sleutel uit de body vervangt de sessie niet');
  const snd = await api(base, '/api/partner/chat/send', { ...body, text: 'Niet mijn aankoop' }, ander);
  assert.equal(snd.status, 403);
  const salon = await api(base, '/api/supplier/klant/salon', { key: 'gast:MAISON|user-' + anderProfiel.id + '|Team' }, winkel);
  assert.equal(salon.status, 404, 'geen aankoop of lijn voor de andere klant');
});

test('8. een vreemde zaak kan de eigen nazorglijn niet lezen of namens haar antwoorden', async () => {
  const key = await vindChatKey();
  assert.ok(key);
  for (const pad of ['/api/supplier/chat/history', '/api/supplier/klant/salon', '/api/supplier/chat/send']) {
    const r = await api(base, pad, { key, text: 'Niet onze klant' }, vreemdeZaak);
    assert.equal(r.status, 404, pad);
  }
  const hist = await api(base, '/api/partner/chat/history', { supplierCode: 'KIKUNOI' }, lid);
  assert.equal(hist.status, 200);
  assert.deepEqual(hist.body.messages, []);
  assert.equal((await api(base, '/api/partner/chat/send', { supplierCode: 'KIKUNOI', text: 'Geen aankoop bij deze zaak' }, lid)).status, 403);
});

test('9. een anonieme demo-gast krijgt geen gratis-accountrecht door geschiedenis te lezen', async () => {
  const gast = await api(base, '/api/login', { tier: 'guest' });
  assert.equal(gast.status, 200);
  const hist = await api(base, '/api/partner/chat/history', { supplierCode: 'MAISON' }, gast.body.token);
  assert.equal(hist.status, 200);
  assert.deepEqual(hist.body.messages, []);
  assert.equal((await api(base, '/api/partner/chat/send', { supplierCode: 'MAISON', text: 'Geen account' }, gast.body.token)).status, 403);
});

test('10. groothandelreplay opent alleen de lijn naar de zaak uit de bestaande order', () => {
  const crypto = require('node:crypto');
  const { maakGroothandel } = require('../server/kern/groothandel');
  const zaken = ['GH-A', 'GH-B'].map(code => ({ code, name: code, type: 'groothandel',
    groothandel: { functies: {}, producten: [{ id: 'p1', naam: 'Brood', actief: true, voorraad: 10, consumentPrijs: 2 }] } }));
  const db = { data: { groothandelOrders: [] } };
  const stil = () => {};
  const findSupplier = code => zaken.find(s => s.code === code);
  const gh = maakGroothandel({ db, save: stil, crypto, findSupplier,
    notify: stil, notifySupplier: stil, sseToSupplier: stil, sseToCustomer: stil, sseToOffice: stil });
  const handlers = new Map(), geopend = [];
  const kern = { app: { post: (pad, ...fns) => handlers.set(pad, fns.at(-1)) }, auth: stil,
    express: { json: () => stil }, db, groothandel: gh, findSupplier,
    gegevensStop: () => false, liveCodename: () => 'Test Vos' };
  require('../server/routes/member/handel/winkel')({ kern, openLijn: s => geopend.push(s.code) });
  const bestel = code => {
    let uit;
    handlers.get('/api/groothandel/bestel')({ session: { key: 'user-1' },
      body: { groothandelCode: code, regels: [{ productId: 'p1', aantal: 1 }], idem: 'dezelfde-order' } },
    { status: n => { assert.fail('onverwachte HTTP-status ' + n); }, json: r => { uit = r; } });
    return uit;
  };
  const eerste = bestel('GH-A'), herhaald = bestel('GH-B');
  assert.equal(herhaald.order.ref, eerste.order.ref);
  assert.equal(herhaald.order.groothandelCode, 'GH-A');
  assert.equal(db.data.groothandelOrders.length, 1);
  assert.deepEqual(geopend, ['GH-A', 'GH-A'], 'een andere bodyzaak is geen tweede handelsrelatie');
});

test('11. gratis nazorg vereist een persoonlijke transactie, ook bij een bestaande lege lijn', async () => {
  const crypto = require('node:crypto');
  const db = { data: { modeBezorg: [], groothandelOrders: [] } }, stil = () => {};
  const comm = require('../server/kern/comm').maakComm({ db, save: stil, crypto, naamVan: key => key });
  const commGast = require('../server/kern/comm/gast').maakCommGast({ db, save: stil, comm });
  const lijn = commGast.gesprek('ZAAK', 'user-1', 'Team'); // oude lege history-lijn is geen aankoop
  const handlers = new Map();
  require('../server/routes/member/terplaatse')({ db, comm, commGast, auth: stil,
    app: { post: (pad, ...fns) => handlers.set(pad, fns.at(-1)) },
    findSupplier: code => code === 'ZAAK' ? { code, name: 'Testzaak' } : null,
    optieAan: () => true, validDept: () => 'Team', talen: { taalVan: () => 'nl' }, trChat: async m => m,
    notifySupplier: stil, sseToSupplier: stil, sseToCustomer: stil });
  const stuur = (session = { tier: 'guest', key: 'user-1', account: { id: 1, codename: 'Test Vos' } }) => new Promise(resolve => {
    let status = 200;
    handlers.get('/api/partner/chat/send')({ session, body: { supplierCode: 'ZAAK', text: 'Hulp bij de aankoop' } },
      { status(n) { status = n; return this; }, json(body) { resolve({ status, body }); } });
  });
  assert.equal((await stuur()).status, 403, 'lijn zonder aankoop is niet genoeg');
  for (const klant of [{ soort: 'partner', id: 'user-1' }, { soort: 'groothandel', id: 'user-1' },
    { soort: 'lid', id: 'user-2' }, { soort: 'lid', id: 1 }]) {
    db.data.groothandelOrders = [{ ref: 'GH-1', groothandelCode: 'ZAAK', klant }];
    assert.equal((await stuur()).status, 403, 'zakelijke of vreemde koper is niet deze persoonlijke sessie');
  }
  db.data.groothandelOrders = [{ ref: 'GH-1', groothandelCode: 'ANDERS', klant: { soort: 'lid', id: 'user-1' } }];
  assert.equal((await stuur()).status, 403, 'een andere zaak geeft hier geen recht');
  db.data.groothandelOrders[0].groothandelCode = 'ZAAK';
  assert.equal((await stuur()).status, 200, 'eigen persoonlijke bestelling geeft nazorg');
  db.data.groothandelOrders = [];
  db.data.modeBezorg = Array.from({ length: 31 }, (_, i) => ({ ref: 'MODE-' + i, supplierCode: 'ANDERS', key: 'user-1' }));
  db.data.modeBezorg.push({ ref: 'MODE-OUD', supplierCode: 'ZAAK', key: 'user-1', status: 'retour' });
  assert.equal((await stuur()).status, 200, 'oudere afgeronde nazorg valt niet achter de eerste dertig schermregels');
  assert.equal((await stuur({ tier: 'guest', key: 'user-1', account: { id: 2, codename: 'Ander' } })).status, 403,
    'een tegenstrijdige accountbinding blijft dicht');
  lijn.deelnemers = ['user-1'];
  assert.equal((await stuur()).status, 403, 'zonder de zaak als deelnemer is de lijn niet geldig');
});

test('12. een legacy-archief herstelt bij lezen geen verwijderde deelnemer van de gemigreerde lijn', () => {
  const crypto = require('node:crypto');
  for (const verwijderd of ['user-1', 'zaak:MAISON']) {
    const archief = { supplierCode: 'MAISON', customerKey: 'user-1', codename: 'Test Vos', tier: 'guest', dept: 'Team',
      messages: [{ from: 'partner', who: 'Team', text: 'Privé nazorg', at: '2026-01-01T12:00:00.000Z' }] };
    const db = { data: { guestChats: { 'MAISON|user-1|Team': archief } } };
    let saves = 0;
    const save = () => { saves++; };
    const comm = require('../server/kern/comm').maakComm({ db, save, crypto, naamVan: key => key });
    const gast = require('../server/kern/comm/gast').maakCommGast({ db, save, comm });
    assert.equal(gast.berichten('MAISON', 'user-1', 'Team').length, 1, 'de historische lijn wordt eerst echt gemigreerd');
    const lijn = comm.gesprekMetSleutel('gast:MAISON|user-1|Team');
    assert.ok(lijn);
    lijn.deelnemers = lijn.deelnemers.filter(key => key !== verwijderd);
    const voor = structuredClone(lijn), bewaard = saves, oud = JSON.stringify(archief);
    gast.bestaand('MAISON', 'user-1', 'Team');
    assert.deepEqual(gast.berichten('MAISON', 'user-1', 'Team'), [], verwijderd + ' krijgt geen toegang via herimport');
    assert.deepEqual(gast.voorZaak('MAISON'), [], 'de zaaklijst toont geen lijn met een verwijderde wederpartij');
    const eigenExport = gast.voorLid('user-1');
    if (verwijderd === 'user-1') assert.deepEqual(eigenExport, {}, 'het verwijderde lid krijgt geen historische inzage');
    else {
      assert.deepEqual(Object.keys(eigenExport), ['MAISON|user-1|Team']);
      assert.equal(eigenExport['MAISON|user-1|Team'].messages[0].text, 'Privé nazorg',
        'het gebleven lid behoudt zijn eigen historische gegevensuitvoer');
    }
    const handlers = new Map(), stil = () => {};
    require('../server/routes/supplier/gastcontact')({ comm, commGast: gast, supplierAuth: stil,
      app: { post: (pad, ...fns) => handlers.set(pad, fns.at(-1)) },
      talen: { taalVan: () => 'nl' }, trChat: async m => m, notify: stil,
      sseToCustomer: stil, sseToSupplier: stil, logActivity: stil,
      klantSalon: () => assert.fail('een ingetrokken lijn mag geen klantprofiel openen') });
    for (const pad of ['/api/supplier/chat/history', '/api/supplier/chat/send', '/api/supplier/klant/salon']) {
      let status = 200, antwoord;
      handlers.get(pad)({ supplier: { code: 'MAISON', name: 'Testzaak' }, actor: { name: 'Team' },
        body: { key: 'gast:MAISON|user-1|Team', text: 'Dit mag niet verstuurd worden' } },
      { status(n) { status = n; return this; }, json(body) { antwoord = body; } });
      assert.equal(status, 404, pad + ' weigert na verwijdering van ' + verwijderd);
      assert.deepEqual(antwoord, { error: 'Gesprek niet gevonden.' });
    }
    assert.deepEqual(lijn, voor, 'lezen herstelt de verwijderde deelnemer niet');
    assert.equal(comm.magErin(lijn, verwijderd), false);
    assert.equal(saves, bewaard, 'opzoeken schrijft geen nieuwe deelname');
    assert.equal(JSON.stringify(archief), oud, 'het legacy-archief blijft ongewijzigd');
  }
});

test('13. een afgebroken eerste migratie neemt het archief alsnog precies eenmaal met oorspronkelijke tijden over', () => {
  const crypto = require('node:crypto');
  const archief = { supplierCode: 'MAISON', customerKey: 'user-1', codename: 'Test Vos', tier: 'guest', dept: 'Team',
    messages: [
      { from: 'guest', who: 'Test Vos', text: 'Waar is mijn bestelling?', at: '2025-06-01T08:05:00.000Z' },
      { from: 'partner', who: 'Team', text: 'De bezorger komt eraan.', at: '2025-06-01T08:06:00.000Z' }
    ] };
  const db = { data: { guestChats: { 'MAISON|user-1|Team': archief } } };
  let saves = 0;
  const save = () => { saves++; };
  const comm = require('../server/kern/comm').maakComm({ db, save, crypto, naamVan: key => key });
  // De kernlijn is al opgeslagen, maar de daaropvolgende archiefimport niet.
  const lijn = comm.gesprekMaak({ soort: 'order', deelnemers: ['user-1', 'zaak:MAISON'], door: 'user-1',
    meta: { sleutel: 'gast:MAISON|user-1|Team', zaak: 'MAISON', dept: 'Team', bron: 'Zaak' } });
  assert.equal(lijn.meta.oudBinnen, undefined);
  assert.deepEqual(comm.berichtenVan(lijn.id), []);
  const oud = JSON.stringify(archief);
  const gast = require('../server/kern/comm/gast').maakCommGast({ db, save, comm });
  assert.equal(gast.bestaand('MAISON', 'user-1', 'Team').id, lijn.id, 'dezelfde kernlijn wordt hervat');
  const eerste = gast.berichten('MAISON', 'user-1', 'Team');
  assert.deepEqual(eerste.map(m => [m.from, m.text, m.at]), archief.messages.map(m => [m.from, m.text, m.at]));
  assert.ok(lijn.meta.oudBinnen, 'de import is nu gemarkeerd');
  const bewaard = saves;
  for (let i = 0; i < 2; i++) {
    assert.equal(gast.bestaand('MAISON', 'user-1', 'Team').id, lijn.id);
    assert.deepEqual(gast.berichten('MAISON', 'user-1', 'Team'), eerste, 'herlezen importeert niets dubbel');
  }
  assert.equal(comm.berichtenVan(lijn.id).length, 2);
  assert.equal(saves, bewaard, 'herlezen schrijft geen tweede migratie');
  assert.deepEqual(lijn.deelnemers, ['user-1', 'zaak:MAISON']);
  assert.equal(JSON.stringify(archief), oud, 'het oorspronkelijke archief blijft intact');
});
