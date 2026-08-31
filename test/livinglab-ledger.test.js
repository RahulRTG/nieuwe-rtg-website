/* HET ONDERZOEKSGROOTBOEK -- wat een studie kostte, en waarom de stichting die
   rekening mocht betalen.

   Wat deze toets vastlegt:

     1. Het verbruik van een lab landt op het LAB en niet op het huis. Zonder
        deze regel betaalt RTG stilzwijgend het onderzoek van een andere
        rechtspersoon, en kan de stichting niet zeggen wat haar werk kostte.
     2. Een lab hoort bij de wereld rtfoundation, en die stuurt haar gebruikers
        geen rekeningen.
     3. Zonder economische relatie is er GEEN doorbelasting -- en dan staat er
        niet nul maar de reden, met de weg ernaartoe.
     4. Met een relatie mag het, tot het plafond. Erboven weigert de firewall met
        het plafond en het bedrag erbij.
     5. De twee boeken worden niet opgeteld: de begroting is ingetypt (graad
        onbekend), het verbruik is gemeten.
     6. Het grootboek zegt wat het NIET weet -- personeel, apparatuur,
        deelnemersvergoeding staan er niet in.

   Draai los: node --test test/livinglab-ledger.test.js */
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { startServer, stop } = require('./helper');
const { dragerVanLab, dragerVanStudie, hoortBij, studieVanDrager } = require('../server/kern/livinglab/ledger');
const { SOORTEN_DRAGER } = require('../server/kern/kosten/haak');
const { wereldVan, factureerbaar } = require('../server/kern/economie/werelden');
const { BELEID, VAST } = require('../server/kern/kosten/beleidkaart');

const TMP = fs.mkdtempSync(path.join(os.tmpdir(), 'rtg-lableger-'));
let srv, base, office, labId, studieId;

function api(pad, body, token) {
  const h = { 'Content-Type': 'application/json' };
  if (token) h.Authorization = 'Bearer ' + token;
  return fetch(base + pad, { method: 'POST', headers: h, body: JSON.stringify(body || {}) })
    .then(async r => ({ status: r.status, body: await r.json().catch(() => ({})) }));
}

test('1. een lab is een dragersoort, en hij hoort bij de stichting', () => {
  assert.ok(SOORTEN_DRAGER.includes('lab'));
  assert.equal(wereldVan(dragerVanLab('L1')), 'rtfoundation');
  assert.equal(wereldVan(dragerVanStudie('L1', 'S2')), 'rtfoundation');
  /* En die wereld factureert haar gebruikers niet: een deelnemer krijgt nooit
     een rekening voor het onderzoek waaraan hij meedoet. */
  assert.equal(factureerbaar('rtfoundation'), false);
  assert.equal(BELEID.lab.stand, 'rtfoundation');
  assert.ok(VAST.lab, 'de stand van een lab is geen schakelaar in de boardroom');
});

test('2. de drager van een studie hoort bij zijn lab, en niet bij een lab dat er op lijkt', () => {
  assert.equal(hoortBij('lab:L1/S2', 'L1'), true);
  assert.equal(hoortBij('lab:L1', 'L1'), true);
  assert.equal(hoortBij('lab:L12', 'L1'), false, 'L12 is geen studie van L1');
  assert.equal(hoortBij('lid:user-1', 'L1'), false);
  assert.equal(studieVanDrager('lab:L1/S2'), 'S2');
  assert.equal(studieVanDrager('lab:L1'), null);
});

test.before(async () => {
  srv = await startServer({ env: { SMTP_URL: '', RTG_DATA_DIR: TMP } });
  base = srv.base;
  office = (await api('/api/office/login', { code: 'RTG-OFFICE' })).body.token;
  const lab = await api('/api/lab2/lab/maak', { naam: 'Lab IJmuiden', stad: 'IJmuiden' }, office);
  labId = lab.body.lab.id;
  await api('/api/lab2/lab/budget', { id: labId, toegekend: 84000, besteed: 0, bron: 'gemeente' }, office);
  const st = await api('/api/lab2/studie/maak', { labId, titel: 'Hittestress in woningen',
    soort: 'leefomgeving', vraagstuk: 'Welke woningen lopen risico bij hitte?', doel: 'inzicht' }, office);
  studieId = st.body.studie.id;
});
test.after(() => stop(srv));

test('3. het verbruik van een studie landt op het lab en niet op het huis', async () => {
  /* Een paar verzoeken op de studie; de poort van het lab zet de drager. */
  for (let i = 0; i < 3; i++) await api('/api/lab2/studie', { id: studieId }, office);
  const r = await api('/api/lab2/ledger/studie', { id: studieId }, office);
  assert.equal(r.status, 200, JSON.stringify(r.body));
  assert.equal(r.body.verbruik.drager, 'lab:' + labId + '/' + studieId);
  const verzoeken = r.body.verbruik.regels.find(x => x.soort === 'verzoek');
  assert.ok(verzoeken && verzoeken.aantal >= 3, 'de verzoeken van deze studie staan op deze studie');
});

test('4. zonder economische relatie is er geen doorbelasting, en dat staat er met de reden', async () => {
  const r = await api('/api/lab2/ledger/lab', { id: labId }, office);
  assert.equal(r.status, 200, JSON.stringify(r.body));
  const d = r.body.doorbelasting;
  assert.equal(d.toegestaan, false);
  assert.equal(d.besluit.code, 'geen-relatie');
  assert.equal(d.staatBij, 'rtg-intern', 'de kosten staan dan bij RTG, en dat is een ander feit');
  assert.match(d.let, /NIET doorbelast/);
  assert.ok(d.besluit.hoeWel, 'een weigering die niet zegt hoe het wel kan, wordt omzeild');
});

test('5. de twee boeken staan naast elkaar, met hun herkomst', async () => {
  const r = await api('/api/lab2/ledger/lab', { id: labId }, office);
  assert.equal(r.body.begroting.toegekendEuro, 84000);
  assert.equal(r.body.begroting.graad, 'onbekend', 'een ingetypt bedrag is geen meting');
  assert.match(r.body.begroting.herkomst, /hand/);
  assert.match(r.body.infrastructuur.herkomst, /gemeten/);
  /* Er wordt nergens een saldo van die twee gemaakt: dat zou een
     nauwkeurigheid suggereren die er niet is. */
  assert.ok(!('saldo' in r.body), 'er staat geen saldo tussen een meting en een invoer');
});

test('6. het grootboek zegt wat het niet weet', async () => {
  const r = await api('/api/lab2/ledger/studie', { id: studieId }, office);
  const z = r.body.zegtNiet;
  for (const veld of ['personeel', 'apparatuur', 'deelnemers', 'verdeeld']) {
    assert.ok(z[veld] && z[veld].length > 20, veld + ' ontbreekt in "wat dit niet zegt"');
  }
});

test('7. een studie die niet bestaat, krijgt geen leeg grootboek', async () => {
  const r = await api('/api/lab2/ledger/studie', { id: 'bestaat-niet' }, office);
  assert.equal(r.status, 404);
});

/* 8. MET een relatie mag het wel -- tot het plafond. Dit gaat op de MODULE en
   niet over de lijn: er is geen route die een economische relatie vastlegt
   zonder boardroom, en wat hier telt is het besluit en niet de deur ernaartoe. */
test('8. met een grondslag en een plafond mag het, en erboven niet', () => {
  const { maakLedger } = require('../server/kern/livinglab/ledger');
  const db = { data: {} };
  const { economie } = require('../server/kern/economie')({ db, save: () => {} });
  economie.relatieZet({ van: 'rtg-intern', naar: 'rtfoundation',
    grondslag: 'onderzoeksinfrastructuur 2026-01', plafondCenten: 750000, door: 'Bestuur RTFoundation' });

  const kosten = { voorDrager: (p, drager) => ({ periode: p, drager, regels: [], toegerekend: [],
    totaal: { centen: 590400, millicenten: 0, graad: 'gemeten' }, zonderTarief: [], nietGemeten: [] }),
    alleDragers: () => [] };
  const ledger = maakLedger({ kosten, economie, vindLab: () => null, vindStudie: () => null, nu: () => '2026-08-31T12:00:00.000Z' });

  const onder = ledger.doorbelasting(590400);
  assert.equal(onder.toegestaan, true);
  assert.equal(onder.staatBij, 'rtfoundation');
  assert.match(onder.let, /onderzoeksinfrastructuur 2026-01/, 'de grondslag staat in het grootboek');

  const boven = ledger.doorbelasting(800000);
  assert.equal(boven.toegestaan, false);
  assert.equal(boven.besluit.code, 'boven-plafond');
  assert.equal(boven.besluit.plafondCenten, 750000);
  assert.equal(boven.staatBij, 'rtg-intern', 'wat er niet door mag, blijft bij RTG staan');
});

/* 9. HET DERDE BOEK: wat het Lab-fonds aan dit onderzoek heeft toegezegd. Het
   fonds haalde geld op VOOR onderzoek en wist niet welk; sinds
   kern/labfonds/onderzoek.js staat het in het grootboek van de studie -- naast
   de begroting en het gemeten verbruik, en niet erbij opgeteld. */
test('9. het onderzoeksgrootboek toont het fondsgeld apart, als toezegging', async () => {
  const r = await api('/api/lab2/ledger/studie', { id: studieId }, office);
  assert.equal(r.status, 200, JSON.stringify(r.body));
  const f = r.body.fonds;
  assert.ok(f && f.toegezegd, 'het fonds hoort in het grootboek van een studie te staan');
  assert.equal(f.toegezegd.bedrag, 0);
  assert.match(f.toegezegd.herkomst, /fondsgrootboek/);
  assert.ok(f.zegtNiet.some(z => /toegezegd/i.test(z) && /betaling/i.test(z)),
    'een toezegging die als betaling leest, is een verkeerde verantwoording');
  /* En het staat NAAST het verbruik: er wordt geen totaal van de twee gemaakt.
     Het ene is door leden toegezegd, het andere door de meter geteld. */
  assert.ok(!('saldo' in r.body) && !('totaalMetFonds' in r.body));
});
