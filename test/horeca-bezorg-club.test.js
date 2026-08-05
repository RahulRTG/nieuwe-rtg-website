/* RTG Horeca OS, deel 3: de eigen bezorgdienst en de club.

   Wat hier bewezen wordt:
   - een adres buiten de zone krijgt een REDEN, geen kale weigering;
   - de capaciteitsrem telt in keukenminuten en noemt het eerstvolgende slot;
   - de routevolgorde noemt zichzelf een heuristiek en weigert te rekenen op
     stops zonder locatie;
   - er wordt niet afgetekend zonder leeftijdscontrole als die nodig is;
   - een polsband is geld: nooit onder nul, restsaldo gaat terug, en er staat
     geen naam op;
   - de deur telt hoeveel mensen er binnen zijn, niet wie, en weigert boven de
     capaciteit -- ook bij herbetreding.
   Draai: node --experimental-sqlite --test test/horeca-bezorg-club.test.js */
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs'); const os = require('os'); const path = require('path');
const { startServer } = require('./helper');

let BASE, child, tok;
const TMP = fs.mkdtempSync(path.join(os.tmpdir(), 'rtg-bzclub-'));
const api = (pad, body, token) => fetch(BASE + pad, {
  method: 'POST', headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: 'Bearer ' + token } : {}) },
  body: JSON.stringify(body || {})
}).then(async r => ({ status: r.status, body: await r.json().catch(() => ({})) }));
const H = (pad, body) => api('/api/supplier/horeca' + pad, body, tok);

test.before(async () => {
  ({ child, base: BASE } = await startServer({ env: { RTG_DATA_DIR: TMP, SMTP_URL: '' } }));
  const roster = (await api('/api/supplier/roster', { code: 'KIKUNOI' })).body;
  const mgr = roster.staff.find(x => x.role === 'manager') || roster.staff[0];
  tok = (await api('/api/supplier/login', { code: 'KIKUNOI', staffId: mgr.id, pin: '1234' })).body.token;
});
test.after(() => {
  if (child) try { child.kill('SIGKILL'); } catch (e) {}
  try { fs.rmSync(TMP, { recursive: true, force: true }); } catch (e) {}
});

test('bezorgzones: kosten, minimum en gratis vanaf -- en buiten de zone een reden', async () => {
  const leeg = await H('/bezorg/check', { postcode: '1012AB' });
  assert.equal(leeg.status, 409, 'zonder zones is er niets te checken');

  await H('/bezorg/zone', { zones: [
    { id: 'stad', naam: 'Binnenstad', postcodes: ['1011', '1012'], kosten: 2.5, minimum: 15, gratisVanaf: 40, minuten: 25 },
    { id: 'rand', naam: 'Rand', postcodes: ['1069'], kosten: 4.5, minimum: 25, minuten: 45 }
  ] });

  const stad = (await H('/bezorg/check', { postcode: '1012 AB', bedrag: 20 })).body;
  assert.equal(stad.bezorgbaar, true);
  assert.equal(stad.zone.naam, 'Binnenstad');
  assert.equal(stad.kostenCenten, 250);
  assert.equal(stad.haaltMinimum, true);

  const tekort = (await H('/bezorg/check', { postcode: '1069XY', bedrag: 20 })).body;
  assert.equal(tekort.haaltMinimum, false);
  assert.equal(tekort.tekort, 500, 'er staat bij hoeveel er nog bij moet');

  const gratis = (await H('/bezorg/check', { postcode: '1011AA', bedrag: 45 })).body;
  assert.equal(gratis.gratisBezorging, true);
  assert.equal(gratis.kostenCenten, 0);

  const buiten = (await H('/bezorg/check', { postcode: '9999ZZ', bedrag: 30 })).body;
  assert.equal(buiten.bezorgbaar, false);
  assert.match(buiten.reden, /9999ZZ/, 'de weigering noemt de postcode');

  // tijdelijk dicht bij extreme drukte, met de reden erbij
  await H('/bezorg/zone', { open: false, reden: 'te druk in de keuken' });
  const dicht = (await H('/bezorg/check', { postcode: '1012AB', bedrag: 30 })).body;
  assert.equal(dicht.bezorgbaar, false);
  assert.match(dicht.redenDicht, /te druk/);
  await H('/bezorg/zone', { open: true, reden: '' });
});

test('tijdsloten: de rem telt keukenminuten en noemt het eerstvolgende slot', async () => {
  await H('/bezorg/sloten', { sloten: { '18:00': 60, '18:30': 60, '19:00': 120 } });
  const lijst = (await H('/bezorg/sloten', { datum: '2026-08-05' })).body;
  assert.equal(lijst.sloten.length, 3);
  assert.equal(lijst.sloten[0].capaciteitMinuten, 60);

  assert.equal((await H('/bezorg/reserveer-slot', { datum: '2026-08-05', tijd: '18:00', minuten: 45 })).body.gebruikt, 45);
  const vol = await H('/bezorg/reserveer-slot', { datum: '2026-08-05', tijd: '18:00', minuten: 30 });
  assert.equal(vol.status, 409);
  assert.equal(vol.body.vol, true);
  assert.equal(vol.body.eerstvolgende, '18:30', 'een vol slot stuurt de klant niet weg');

  const onbekend = await H('/bezorg/reserveer-slot', { datum: '2026-08-05', tijd: '23:45', minuten: 10 });
  assert.equal(onbekend.status, 404);
});

test('de route is een heuristiek, en weigert te rekenen zonder locaties', async () => {
  const zonder = await H('/bezorg/route', { stops: [{ id: 'a', adres: 'Straat 1' }, { id: 'b', adres: 'Straat 2' }] });
  assert.equal(zonder.status, 400);
  assert.match(zonder.body.error, /missen een locatie/);

  const uit = (await H('/bezorg/route', { stops: [
    { id: 'ver', lat: 52.40, lng: 4.90 }, { id: 'dichtbij', lat: 52.372, lng: 4.893 }, { id: 'midden', lat: 52.38, lng: 4.895 }
  ] })).body;
  assert.equal(uit.stops, 3);
  assert.equal(uit.heuristiek, 'dichtstbijzijnde eerst');
  assert.match(uit.let, /geen optimale route/);
  assert.ok(uit.route[0].kmVanVorige <= uit.route[1].kmVanVorige + uit.route[2].kmVanVorige);
});

test('afleveren: zonder leeftijdscontrole wordt er niet afgetekend', async () => {
  const zonder = await H('/bezorg/afgeleverd', { ritId: 'R1', hoe: 'overhandigd', ontvanger: 'Jansen', leeftijdNodig: true });
  assert.equal(zonder.status, 409);
  assert.match(zonder.body.error, /leeftijdscontrole/);

  const naamloos = await H('/bezorg/afgeleverd', { ritId: 'R1', hoe: 'overhandigd' });
  assert.equal(naamloos.status, 400, 'overhandigd zonder naam is geen bewijs');

  const ok = (await H('/bezorg/afgeleverd', { ritId: 'R1', hoe: 'overhandigd', ontvanger: 'Jansen',
    leeftijdNodig: true, leeftijdGecontroleerd: true })).body;
  assert.equal(ok.bewijs.leeftijdGecontroleerd, true);
  assert.match(ok.let, /geen foto/);

  const stoep = (await H('/bezorg/afgeleverd', { ritId: 'R2', hoe: 'op de stoep', notitie: 'achter de plantenbak' })).body;
  assert.equal(stoep.bewijs.ontvanger, null);
});

test('polsband: geld op een nummer, nooit onder nul, en het restsaldo gaat terug', async () => {
  const band = (await H('/club/band', { nummer: 'B-0042', bedrag: 50 })).body;
  assert.equal(band.band.saldo, 5000);
  assert.match(band.let, /geen naam/);

  const bij = (await H('/club/band', { nummer: 'B-0042', bedrag: 25 })).body;
  assert.equal(bij.band.saldo, 7500, 'opwaarderen telt op');

  const drank = (await H('/club/band/betaal', { nummer: 'B-0042', bedrag: 12.5 })).body;
  assert.equal(drank.geboekt, 1250);
  assert.equal(drank.saldo, 6250);

  const teveel = (await H('/club/band/betaal', { nummer: 'B-0042', bedrag: 100 })).body;
  assert.equal(teveel.geboekt, 6250, 'er wordt hooguit het saldo geboekt');
  assert.equal(teveel.saldo, 0);
  assert.equal(teveel.tekort, 3750);
  assert.match(teveel.let, /te weinig saldo/);

  await H('/club/band', { nummer: 'B-0043', bedrag: 30 });
  const terug = (await H('/club/band/terug', { nummer: 'B-0043' })).body;
  assert.equal(terug.uitbetaald, 3000);
  assert.equal((await H('/club/band/terug', { nummer: 'B-0043' })).status, 409, 'een lege band betaalt niets terug');
  assert.equal((await H('/club/band/betaal', { nummer: 'B-9999', bedrag: 5 })).status, 404);
});

test('minimum spend toont wat er te gaan is en boekt niets bij', async () => {
  const rek = (await H('/rekening/open', { kanaal: 'club', tafel: 'VIP 1' })).body.rekening;
  await H('/rekening/regel', { rekeningId: rek.id, naam: 'Fles', prijs: 180 });
  await H('/club/tafel', { tafel: 'VIP 1', minimum: 500, gastnaam: 'Groep De Vries', personen: 6, rekeningId: rek.id });

  const stand = (await H('/club/tafel/stand', {})).body;
  const vip = stand.tafels.find(t => t.tafel === 'VIP 1');
  assert.equal(vip.besteed, 18000);
  assert.equal(vip.teGaan, 32000);
  assert.equal(vip.gehaald, false);
  assert.match(stand.let, /boekt niets automatisch bij/);

  await H('/rekening/regel', { rekeningId: rek.id, naam: 'Fles', prijs: 180, aantal: 2 });
  const na = (await H('/club/tafel/stand', {})).body.tafels.find(t => t.tafel === 'VIP 1');
  assert.equal(na.gehaald, true);
  assert.equal(na.teGaan, 0);

  // de rekening zelf is niet aangeraakt door het minimum
  const controle = (await H('/rekening', { rekeningId: rek.id })).body.rekening;
  assert.equal(controle.totalen.netto, 54000, 'er is niets bijgeboekt om het minimum te halen');
});

test('de deur telt hoeveel mensen er binnen zijn, niet wie', async () => {
  const gl = (await H('/club/gastenlijst', { namen: ['Anna', 'Bo', 'Cem'], promoter: 'NOVA', personen: 2 })).body;
  assert.equal(gl.aantal, 3);
  assert.equal(gl.perPromoter.NOVA.aangemeld, 6);
  assert.equal(gl.perPromoter.NOVA.binnen, 0);

  const eerste = (await H('/club/deur', { wat: 'in', personen: 2, capaciteit: 5, gastId: gl.gasten[0].id })).body;
  assert.equal(eerste.binnen, 2);
  assert.equal(eerste.vrij, 3);

  const geweigerd = await H('/club/deur', { wat: 'in', personen: 4, capaciteit: 5 });
  assert.equal(geweigerd.status, 409);
  assert.equal(geweigerd.body.vol, true);

  const zonderCheck = await H('/club/deur', { wat: 'in', personen: 1, capaciteit: 5, leeftijdGecontroleerd: false });
  assert.equal(zonderCheck.status, 409, 'zonder leeftijdscontrole komt er niemand binnen');

  await H('/club/deur', { wat: 'uit', personen: 1, capaciteit: 5 });
  const terug = (await H('/club/deur', { wat: 'terug', personen: 1, capaciteit: 5 })).body;
  assert.equal(terug.herbetreding, 1);
  assert.equal(terug.binnen, 2);
  assert.match(terug.let, /niet wie/);

  // de gastenlijst weet nu dat die eerste groep binnen is
  const na = (await H('/club/gastenlijst', {})).body;
  assert.equal(na.perPromoter.NOVA.binnen, 2, 'per promoter telt wat er ECHT binnen is');
});
