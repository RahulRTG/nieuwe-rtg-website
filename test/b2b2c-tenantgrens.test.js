/* DE B2B2C-TENANTGRENS, OVER DE ECHTE SERVER.

   Twee organisaties hebben ieder een tenant, werkruimte, beheerder en RTG-
   account. De aanvaller kent de echte ids van de andere organisatie; raden is
   hier dus geen beveiliging. Voor elke grens bewijst de toets drie dingen:

   1. lezen en wijzigen eindigt hard op 401/403/404;
   2. de weigering bevat geen details van het aangewezen object;
   3. de toestand van organisatie B is daarna byte-voor-byte hetzelfde.

   Ook de twee zakelijke geloofsbrieven worden ingetrokken terwijl de client ze
   nog bewaart: eerst het recht achter een bestaand lid-token, daarna het hele
   lidmaatschap achter zowel dat token als de gekoppelde RTG-sessie.

   Draai los: node --test test/b2b2c-tenantgrens.test.js */
'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { startServer, stop, kantoorAlsPersoon } = require('./helper');

const TMP = fs.mkdtempSync(path.join(os.tmpdir(), 'rtg-b2b2c-grens-'));
const OFFICE_CODE = 'B2B2C-GRENS-KANTOOR';
let srv, BASE, eigenaar, kantoor;
let A, B, bestellingB, bestandB, documentB, projectA;

async function vraag(pad, body, token, methode) {
  const method = methode || 'POST';
  const headers = { 'Content-Type': 'application/json' };
  if (token) headers.Authorization = 'Bearer ' + token;
  const r = await fetch(BASE + pad, {
    method, headers,
    body: method === 'GET' ? undefined : JSON.stringify(body || {})
  });
  const tekst = await r.text();
  let antwoord = {};
  try { antwoord = JSON.parse(tekst); } catch (e) {}
  return { status: r.status, body: antwoord, tekst };
}

const post = (pad, body, token) => vraag(pad, body, token, 'POST');
const get = (pad, token) => vraag(pad, null, token, 'GET');
const bedrijf = (pad, body, token) => post('/api/bedrijf' + pad, body, token);
const rtfos = (pad, body, token) => post('/api/rtfos/' + pad, body,
  token === undefined ? kantoor : token);

function hardDicht(r, geheimen, waar) {
  assert.ok([401, 403, 404].includes(r.status),
    waar + ' was niet hard dicht: ' + r.status + ' ' + r.tekst.slice(0, 200));
  for (const geheim of geheimen || []) {
    if (geheim == null || String(geheim) === '') continue;
    assert.equal(r.tekst.includes(String(geheim)), false,
      waar + ' lekte objectdetail "' + geheim + '": ' + r.tekst.slice(0, 200));
  }
}

async function account(letter, telefoon) {
  const r = await post('/api/auth/register', {
    name: 'Lid Tenant ' + letter,
    email: 'tenant-' + letter.toLowerCase() + '@grens.test',
    phone: telefoon,
    password: 'grens-geheim-123',
    geboortedatum: '1988-04-12',
    tier: 'rtg',
    pasApp: 'rtg'
  });
  assert.equal(r.status, 200, 'account ' + letter + ': ' + r.tekst.slice(0, 160));
  assert.ok(r.body.token, 'account ' + letter + ' kreeg geen sessie');
  return r.body.token;
}

async function organisatie(letter, telefoon) {
  const sessie = await account(letter, telefoon);
  const naam = 'Grensorganisatie ' + letter;
  const w = await bedrijf('/werkruimte/maak', { naam, land: 'NL' });
  assert.equal(w.status, 200, 'werkruimte ' + letter + ': ' + w.tekst.slice(0, 160));
  const werkruimte = w.body.werkruimte;
  const beheerToken = w.body.beheerToken;

  const aanmeld = await bedrijf('/lid/aanmeld', { werkruimte, naam: 'Werker ' + letter });
  assert.equal(aanmeld.status, 200);
  const lidId = aanmeld.body.lidId;
  const lidToken = aanmeld.body.lidToken;
  assert.equal((await bedrijf('/lid/besluit', {
    werkruimte, beheerToken, lidId, akkoord: true
  })).status, 200);
  assert.equal((await bedrijf('/lid/rollen', {
    werkruimte, beheerToken, lidId, rollen: ['directie']
  })).status, 200);
  assert.equal((await bedrijf('/lid/koppel', { werkruimte, lidToken }, sessie)).status, 200);

  const org = 'O-GRENS-' + letter;
  assert.equal((await post('/api/techniek/tenant', { org, naam }, eigenaar)).status, 200);
  assert.equal((await post('/api/techniek/tenant/bind', {
    org, soort: 'werkruimte', code: werkruimte
  }, eigenaar)).status, 200);
  return { letter, org, naam, sessie, werkruimte, beheerToken, lidId, lidToken,
    sleutel: { werkruimte, lidToken } };
}

test.before(async () => {
  srv = await startServer({ env: { SMTP_URL: '', RTG_DATA_DIR: TMP, OFFICE_CODE } });
  BASE = srv.base;
  eigenaar = (await post('/api/auth/login', {
    login: 'roellie.i@gmail.com', password: 'Imran', pasApp: 'business'
  })).body.token;
  assert.ok(eigenaar, 'de eigenaar kon de twee tenants niet inrichten');

  A = await organisatie('A', '0611111111');
  B = await organisatie('B', '0622222222');

  projectA = (await bedrijf('/project/maak', {
    ...A.sleutel, naam: 'Alleen project A', werkvorm: 'algemeen', budget: 900
  })).body.project;
  assert.ok(projectA && projectA.id, 'project A werd niet gemaakt');

  const doc = await bedrijf('/kennis/schrijf', {
    ...B.sleutel,
    titel: 'Strategie van tenant B',
    tekst: 'Alleen B kent codenaam MAANLICHT en de overnamedatum.',
    soort: 'beleid',
    geldigTot: '2031-06-30'
  });
  assert.equal(doc.status, 200, doc.tekst.slice(0, 200));
  documentB = doc.body.artikel;

  const upload = await post('/api/bestanden/upload', {
    naam: 'tenant-b-geheim.txt',
    dataUrl: 'data:text/plain;base64,' + Buffer.from('BESTAND-INHOUD-TENANT-B').toString('base64')
  }, B.sessie);
  assert.equal(upload.status, 200, upload.tekst.slice(0, 200));
  bestandB = { id: upload.body.id, naam: 'tenant-b-geheim.txt', inhoud: 'BESTAND-INHOUD-TENANT-B' };

  /* De bezorgmodule heeft bewust geen demo-assortiment. Richt via zijn gewone
     beheerroute één product in; de aanval zelf blijft volledig aan de lidkant. */
  const rooster = await post('/api/supplier/roster', { code: 'KIKUNOI' });
  const manager = (rooster.body.staff || []).find(l => l.role === 'manager');
  assert.ok(manager, 'de bestaande KIKUNOI-fixture heeft geen manager');
  const managerInlog = await post('/api/supplier/login', {
    code: 'KIKUNOI', staffId: manager.id, pin: '1234'
  });
  assert.equal(managerInlog.status, 200, managerInlog.tekst.slice(0, 200));
  const product = await post('/api/supplier/bezorg/product', {
    name: 'Grensproefpakket', price: 12
  }, managerInlog.body.token);
  assert.equal(product.status, 200, product.tekst.slice(0, 200));
  assert.equal((await post('/api/supplier/bezorg/instellingen', {
    aan: true, ophalen: true, bezorgen: true
  }, managerInlog.body.token)).status, 200);

  const aanbod = await post('/api/bezorg/partners', {}, B.sessie);
  assert.equal(aanbod.status, 200, aanbod.tekst.slice(0, 200));
  const zaak = (aanbod.body.partners || []).find(z => z.ophalen !== false && (z.producten || []).length);
  assert.ok(zaak, 'de bestaande bezorgfixture heeft geen bestelbaar product');
  const bestel = await post('/api/bezorg/bestel', {
    supplierCode: zaak.code,
    levering: 'ophalen',
    items: [{ id: zaak.producten[0].id, qty: 1 }]
  }, B.sessie);
  assert.equal(bestel.status, 200, bestel.tekst.slice(0, 200));
  bestellingB = bestel.body.order;

  kantoor = await kantoorAlsPersoon(BASE, OFFICE_CODE);
  assert.ok(kantoor, 'geen herleidbare kantoorsessie voor de bestaande Foundation-fixture');
});

test.after(() => {
  stop(srv && srv.child);
  try { fs.rmSync(TMP, { recursive: true, force: true }); } catch (e) {}
});

test('werkruimte en tenantbeheer: een bekende B-code wordt geen beheersleutel', async () => {
  const voor = await bedrijf('/werkruimte', {
    werkruimte: B.werkruimte, beheerToken: B.beheerToken
  });
  assert.equal(voor.status, 200);

  const lees = await bedrijf('/werkruimte', {
    werkruimte: B.werkruimte, lidToken: A.lidToken
  }, A.sessie);
  hardDicht(lees, [B.naam, B.werkruimte, B.beheerToken], 'A leest werkruimte B');

  const lidMutatie = await bedrijf('/lid/rollen', {
    werkruimte: B.werkruimte,
    beheerToken: A.beheerToken,
    lidId: B.lidId,
    rollen: []
  }, A.sessie);
  hardDicht(lidMutatie, [B.naam, B.werkruimte, B.lidId], 'A wijzigt lid B');

  /* Dit was een echte doorbraak: `moeder` werd alleen op bestaan gecontroleerd.
     Daarmee kon A een eigen werkruimte onder de holding van B hangen, waarna B
     die naam in zijn dochterlijst zag. Een bekende id is geen toestemming. */
  const dochter = await bedrijf('/werkruimte/maak', {
    naam: 'Door A onder B gehangen',
    moeder: B.werkruimte,
    moederBeheerToken: A.beheerToken
  }, A.sessie);
  hardDicht(dochter, [B.naam, B.werkruimte, B.beheerToken], 'A hangt een dochter onder B');
  const onbekendeMoeder = await bedrijf('/werkruimte/maak', {
    naam: 'Door A onder onbekend gehangen',
    moeder: 'WONBEKEN',
    moederBeheerToken: A.beheerToken
  }, A.sessie);
  assert.equal(dochter.status, onbekendeMoeder.status,
    'een bekende B-code verraadt niet meer dan een onbekende moederwerkruimte');
  assert.deepEqual(dochter.body, onbekendeMoeder.body,
    'een bekende B-code en een onbekende moederwerkruimte hebben hetzelfde antwoord');

  const tenantMutatie = await post('/api/techniek/tenant', {
    org: B.org, naam: 'Door A overgenomen'
  }, A.sessie);
  hardDicht(tenantMutatie, [B.org, B.naam], 'A wijzigt tenant B');

  const ledenNa = await bedrijf('/leden', {
    werkruimte: B.werkruimte, beheerToken: B.beheerToken
  });
  const lidNa = ledenNa.body.leden.find(l => l.id === B.lidId);
  assert.deepEqual(lidNa.rollen.map(r => r.id), ['directie'], 'de aanval wijzigde de rollen van B');

  const na = await bedrijf('/werkruimte', {
    werkruimte: B.werkruimte, beheerToken: B.beheerToken
  });
  assert.deepEqual(na.body, voor.body, 'de aanval wijzigde de werkruimte of dochterlijst van B');

  const tenants = await get('/api/techniek/tenant', eigenaar);
  const tenantB = tenants.body.tenants.find(t => t.org === B.org);
  assert.equal(tenantB.naam, B.naam, 'de aanval wijzigde de control-plane van B');
});

test('tokenobjecten: sessie A kan het lidToken van B niet lezen, ontkoppelen of intrekken', async () => {
  const mijnA = await bedrijf('/mijn', {}, A.sessie);
  assert.equal(mijnA.status, 200);
  assert.deepEqual(mijnA.body.werkruimtes.map(w => w.werkruimte), [A.werkruimte]);
  for (const detail of [B.werkruimte, B.lidId, B.lidToken, B.beheerToken]) {
    assert.equal(mijnA.tekst.includes(detail), false, 'de eigen tokenlijst van A lekt een B-detail');
  }

  const ontkoppel = await bedrijf('/lid/ontkoppel', {
    werkruimte: B.werkruimte,
    lidToken: A.lidToken
  }, A.sessie);
  hardDicht(ontkoppel, [B.werkruimte, B.lidId, B.lidToken], 'A ontkoppelt tokenobject B');

  const intrekken = await bedrijf('/lid/uit-dienst', {
    werkruimte: B.werkruimte,
    beheerToken: A.beheerToken,
    lidId: B.lidId,
    reden: 'A probeert B in te trekken'
  }, A.sessie);
  hardDicht(intrekken, [B.werkruimte, B.lidId, B.lidToken], 'A trekt lidToken B in');

  const bNogActief = await bedrijf('/start', B.sleutel, B.sessie);
  assert.equal(bNogActief.status, 200, 'de aanval maakte het geldige lidToken van B onbruikbaar');
  const mijnB = await bedrijf('/mijn', {}, B.sessie);
  assert.equal(mijnB.status, 200);
  assert.equal(mijnB.body.aantal, 1);
  assert.equal(mijnB.body.werkruimtes[0].werkruimte, B.werkruimte);
  assert.equal(mijnB.body.werkruimtes[0].lidToken, B.lidToken,
    'de aanval roteerde of wijzigde het tokenobject van B');
});

test('documenten en bestanden: bekende ids van B blijven onzichtbaar en ongewijzigd', async () => {
  const onbekendDoc = await bedrijf('/kennis/lees', {
    ...A.sleutel, artikelId: 'bestaat-niet'
  }, A.sessie);
  const leesDoc = await bedrijf('/kennis/lees', {
    ...A.sleutel, artikelId: documentB.id
  }, A.sessie);
  hardDicht(leesDoc, [documentB.id, 'Strategie van tenant B', 'MAANLICHT'], 'A leest document B');
  assert.deepEqual(leesDoc.body, onbekendDoc.body, 'een echte B-id verraadt meer dan een onbekende id');

  const wijzigDoc = await bedrijf('/kennis/nagekeken', {
    ...A.sleutel, artikelId: documentB.id, geldigTot: '2099-12-31'
  }, A.sessie);
  hardDicht(wijzigDoc, [documentB.id, 'Strategie van tenant B'], 'A wijzigt document B');

  const onbekendBestand = await post('/api/bestanden/haal', { id: 'bestaat-niet' }, A.sessie);
  const leesBestand = await post('/api/bestanden/haal', { id: bestandB.id }, A.sessie);
  hardDicht(leesBestand, [bestandB.id, bestandB.naam, bestandB.inhoud], 'A haalt bestand B');
  assert.deepEqual(leesBestand.body, onbekendBestand.body,
    'een echte B-bestands-id verraadt meer dan een onbekende id');

  const wijzigBestand = await post('/api/bestanden/wijzig', {
    id: bestandB.id, naam: 'door-a-hernoemd.txt', ster: true
  }, A.sessie);
  hardDicht(wijzigBestand, [bestandB.id, bestandB.naam], 'A wijzigt bestand B');

  const docNa = await bedrijf('/kennis/lees', { ...B.sleutel, artikelId: documentB.id }, B.sessie);
  assert.equal(docNa.status, 200);
  assert.equal(docNa.body.artikel.geldigTot, '2031-06-30');
  assert.equal(docNa.body.artikel.tekst.includes('MAANLICHT'), true);

  const bestandNa = await post('/api/bestanden/haal', { id: bestandB.id }, B.sessie);
  assert.equal(bestandNa.status, 200);
  assert.equal(bestandNa.body.naam, bestandB.naam);
  assert.equal(Buffer.from(bestandNa.body.dataUrl.split(',')[1], 'base64').toString(), bestandB.inhoud);
});

test('orders: bekende referentie van B kan door A niet worden gelezen of betaald', async () => {
  const onbekend = await post('/api/bezorg/volg', { ref: 'RTG-B-BESTAATNIET' }, A.sessie);
  const lees = await post('/api/bezorg/volg', { ref: bestellingB.ref }, A.sessie);
  hardDicht(lees, [bestellingB.ref, bestellingB.pickup, bestellingB.supplierName], 'A volgt order B');
  assert.deepEqual(lees.body, onbekend.body, 'een echte B-order verraadt meer dan een onbekende order');

  const betaalOnbekend = await post('/api/order/pay', { ref: 'RTG-B-BESTAATNIET' }, A.sessie);
  const betaal = await post('/api/order/pay', { ref: bestellingB.ref }, A.sessie);
  hardDicht(betaal, [bestellingB.ref, bestellingB.pickup, bestellingB.supplierName], 'A betaalt order B');
  assert.deepEqual(betaal.body, betaalOnbekend.body, 'de betaaldeur bevestigt dat de B-order bestaat');

  const na = await post('/api/orders/mine', {}, B.sessie);
  const orderNa = na.body.orders.find(o => o.ref === bestellingB.ref);
  assert.ok(orderNa, 'de order van B verdween door de aanval');
  assert.equal(orderNa.paid, false, 'A heeft de order van B betaald of gemuteerd');
  assert.equal(orderNa.status, bestellingB.status);
});

test('externe persoonscode: code A plus bekende gift-id B opent niets van B', async () => {
  const stad = await rtfos('stad/maak', { naam: 'Codegrensstad' });
  assert.equal(stad.status, 200, stad.tekst.slice(0, 200));
  const stadId = stad.body.stad.id;
  assert.equal((await rtfos('stad/status', { id: stadId, status: 'actief' })).status, 200);
  assert.equal((await rtfos('stad/module', { id: stadId, vlag: 'donations', aan: true })).status, 200);

  const giftA = await rtfos('bron/maak', {
    stad: stadId, soort: 'donatie', gever: 'Gever Code A', bedrag: 21
  });
  const giftB = await rtfos('bron/maak', {
    stad: stadId, soort: 'donatie', gever: 'Gever Code B', bedrag: 987
  });
  assert.equal(giftA.status, 200);
  assert.equal(giftB.status, 200);

  const codeA = await rtfos('donateur/code', { bronId: giftA.body.bron.id, max_gebruik: 20 });
  const codeB = await rtfos('donateur/code', { bronId: giftB.body.bron.id, max_gebruik: 20 });
  assert.equal(codeA.status, 200);
  assert.equal(codeB.status, 200);

  const onbekend = await post('/api/rtfos/portaal/donateur/bewijs', {
    code: codeA.body.code, giftId: 'bestaat-niet'
  });
  const dwars = await post('/api/rtfos/portaal/donateur/bewijs', {
    code: codeA.body.code, giftId: giftB.body.bron.id
  });
  hardDicht(dwars, [giftB.body.bron.id, 'Gever Code B', '987'], 'code A leest bewijs B');
  assert.deepEqual(dwars.body, onbekend.body, 'een echte B-gift verraadt meer dan een onbekende gift');

  const bNa = await post('/api/rtfos/portaal/donateur', { code: codeB.body.code });
  assert.equal(bNa.status, 200);
  assert.equal(bNa.body.donateur.naam, 'Gever Code B');
  assert.equal(bNa.body.donateur.totaal, 987);
  assert.equal(bNa.body.donateur.giften.length, 1);
});

test('oude zakelijke sessie en lidToken verliezen direct hun ingetrokken recht en lidmaatschap', async () => {
  const rolWeg = await bedrijf('/lid/rollen', {
    werkruimte: A.werkruimte,
    beheerToken: A.beheerToken,
    lidId: A.lidId,
    rollen: [],
    reden: 'aanvalstoets: projectrecht direct intrekken'
  });
  assert.equal(rolWeg.status, 200);

  const oudeRol = await bedrijf('/project/wijzig', {
    ...A.sleutel,
    projectId: projectA.id,
    status: 'gestopt',
    reden: 'oude client probeert door te schrijven'
  }, A.sessie);
  hardDicht(oudeRol, [projectA.id, projectA.naam], 'oude sessie/lidToken na rolintrekking');
  assert.equal(oudeRol.status, 403, 'een bestaand lid zonder projectrecht hoort 403 te krijgen');

  const projectNaRol = await bedrijf('/project', {
    werkruimte: A.werkruimte, beheerToken: A.beheerToken, projectId: projectA.id
  });
  assert.equal(projectNaRol.body.project.status, 'loopt', 'de oude rol wijzigde het project alsnog');

  const uitDienst = await bedrijf('/lid/uit-dienst', {
    werkruimte: A.werkruimte,
    beheerToken: A.beheerToken,
    lidId: A.lidId,
    reden: 'lidmaatschap ingetrokken door aanvalstoets'
  });
  assert.equal(uitDienst.status, 200);

  const oudLid = await bedrijf('/start', A.sleutel, A.sessie);
  hardDicht(oudLid, [A.werkruimte, projectA.id, projectA.naam], 'oud lidToken na uitdienst');
  assert.equal(oudLid.status, 403);

  const oudPaar = await bedrijf('/project', {
    ...A.sleutel, projectId: projectA.id
  }, A.sessie);
  hardDicht(oudPaar, [A.werkruimte, projectA.id, projectA.naam], 'oude sessie plus oud lidToken');

  /* De RTG-sessie blijft bewust bruikbaar voor het persoonlijke RTG-account;
     het zakelijke vermogen verdwijnt eruit. Zij mag vooral geen nieuw of oud
     lid-token meer teruggeven. */
  const mijn = await bedrijf('/mijn', {}, A.sessie);
  assert.equal(mijn.status, 200);
  assert.equal(mijn.body.aantal, 0);
  assert.deepEqual(mijn.body.werkruimtes, []);
  assert.equal(mijn.tekst.includes(A.lidToken), false);
  assert.equal(mijn.tekst.includes(A.werkruimte), false);

  const bootstrap = await post('/api/tenant/bootstrap/mijn', {}, A.sessie);
  assert.equal(bootstrap.status, 200);
  assert.equal(bootstrap.body.aantal, 0);
  assert.deepEqual(bootstrap.body.werkruimtes, []);
  assert.equal(bootstrap.tekst.includes(A.werkruimte), false);

  const projectNa = await bedrijf('/project', {
    werkruimte: A.werkruimte, beheerToken: A.beheerToken, projectId: projectA.id
  });
  assert.equal(projectNa.body.project.status, 'loopt', 'de ingetrokken geloofsbrieven veranderden toestand');
});
