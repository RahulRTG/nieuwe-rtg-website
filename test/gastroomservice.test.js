/* HET GUEST OS OP DE KAMER: roomservice.

   DE DERDE NAAD, en de scherpste. Aan tafel bewijst de QR dat je er bent; thuis
   is de ledensessie de poort; op een kamer geldt iets wat bij de andere twee
   niet bestaat: het bewijs KAN VERLOPEN. Een sticker op tafel 12 is over een
   jaar nog geldig, maar een kaartje op kamer 308 is niets meer waard zodra die
   gast uitcheckt -- en het volgende dat op die kamer gebeurt, is iemand anders.

   Daarom staat de grendel hier niet op de QR maar op de FOLIO: geen open
   gastrekening op die kamer, geen roomservice. Dat is dezelfde regel die de
   betaalwijze 'kamer' in horeca/betalen.js altijd al hanteerde; hij staat nu
   ook voor de deur ervoor in plaats van alleen bij de kassa.

   Wat dit bestand daarnaast bewaakt: roomservice landt op de gastrekening van
   diezelfde kamer en niet ergens anders, en de kamer-QR opent geen tafel. */
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs'); const os = require('os'); const path = require('path');
const { startServer } = require('./helper');

let BASE, child, ZAAK;
const TMP = fs.mkdtempSync(path.join(os.tmpdir(), 'rtg-gastrs-'));
const post = (pad, body, token) => fetch(BASE + pad, {
  method: 'POST', headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: 'Bearer ' + token } : {}) },
  body: JSON.stringify(body || {})
}).then(async r => ({ status: r.status, body: await r.json().catch(() => ({})) }));

test.before(async () => {
  ({ child, base: BASE } = await startServer({ env: { RTG_DATA_DIR: TMP, SMTP_URL: '' } }));
  const roster = (await post('/api/supplier/roster', { code: 'KIKUNOI' })).body;
  const mgr = roster.staff.find(x => x.role === 'manager') || roster.staff[0];
  ZAAK = (await post('/api/supplier/login', { code: 'KIKUNOI', staffId: mgr.id, pin: '1234' })).body.token;
  assert.ok(ZAAK, 'de zaak-inlog werkt');
});
test.after(() => {
  if (child) try { child.kill('SIGKILL'); } catch (e) {}
  try { fs.rmSync(TMP, { recursive: true, force: true }); } catch (e) {}
});

let kamerTeller = 300;
const nieuweKamer = () => String(++kamerTeller);
const qrVoorKamer = async (kamer) =>
  (await post('/api/supplier/horeca/gast/qr', { kamer }, ZAAK)).body.token;

test('een kamer-QR zonder gastrekening geeft geen sessie, met de reden erbij', async () => {
  const kamer = nieuweKamer();
  const token = await qrVoorKamer(kamer);
  assert.ok(token, 'de zaak kan een QR voor een kamer uitgeven');

  const kijk = await post('/api/gast/tafel', { token });
  assert.equal(kijk.status, 409, 'een leegstaande kamer hoort geen kaart te tonen');
  assert.equal(kijk.body.code, 'geen-verblijf');
  assert.match(kijk.body.error, new RegExp('kamer ' + kamer));

  const aan = await post('/api/gast/aanschuiven', { token, naam: 'Iemand' });
  assert.equal(aan.status, 409, 'en ook geen sessie');
  assert.equal(aan.body.code, 'geen-verblijf');
});

test('met een open folio werkt dezelfde QR wel, en hij opent een kamer en geen tafel', async () => {
  const kamer = nieuweKamer();
  const token = await qrVoorKamer(kamer);
  const folio = await post('/api/supplier/horeca/folio/open', { kamer, naam: 'Gast 1' }, ZAAK);
  assert.equal(folio.status, 200, JSON.stringify(folio.body).slice(0, 160));

  const kijk = await post('/api/gast/tafel', { token });
  assert.equal(kijk.status, 200);
  assert.equal(kijk.body.soort, 'kamer');
  assert.equal(kijk.body.kamer, kamer);
  assert.equal(kijk.body.tafel, null, 'een kamer-QR opent geen tafel');

  const aan = await post('/api/gast/aanschuiven', { token, naam: 'Gast 1' });
  assert.equal(aan.status, 200);
  assert.equal(aan.body.soort, 'kamer');
  assert.equal(aan.body.rekening.kanaal, 'roomservice',
    'een bestelling van de kamer loopt over het roomservice-kanaal');
});

test('roomservice komt op de gastrekening van diezelfde kamer terecht', async () => {
  const kamer = nieuweKamer();
  const token = await qrVoorKamer(kamer);
  await post('/api/supplier/horeca/folio/open', { kamer, naam: 'Gast 2' }, ZAAK);
  const kijk = await post('/api/gast/tafel', { token });
  const item = kijk.body.kaart.find(k => !k.alcohol && !k.uitverkocht);
  const { body: aan } = await post('/api/gast/aanschuiven', { token, naam: 'Gast 2' });

  const best = await post('/api/gast/bestel', { sleutel: aan.sleutel, items: [{ itemId: item.id, aantal: 2 }] });
  assert.equal(best.status, 200, JSON.stringify(best.body).slice(0, 200));

  // afrekenen op de kamer: dat is de rail die hier WEL bestaat
  const betaal = await post('/api/gast/betaal', { sleutel: aan.sleutel, wijze: 'kamer' });
  assert.equal(betaal.status, 200, JSON.stringify(betaal.body).slice(0, 200));
  assert.equal(betaal.body.gesloten, true);

  const f = await post('/api/supplier/horeca/folio', { kamer }, ZAAK);
  const rs = (f.body.folio.regels || []).filter(r => r.soort === 'roomservice');
  assert.equal(rs.length, 1, 'de roomservice hoort als EEN regel op de folio te staan');
  assert.equal(rs[0].centen, item.centen * 2,
    'en voor hetzelfde bedrag als de gast op zijn scherm zag');
});

test('een kamer die uitcheckt maakt de lopende sessie waardeloos', async () => {
  const kamer = nieuweKamer();
  const token = await qrVoorKamer(kamer);
  await post('/api/supplier/horeca/folio/open', { kamer, naam: 'Gast 3' }, ZAAK);
  const kijk = await post('/api/gast/tafel', { token });
  const item = kijk.body.kaart.find(k => !k.alcohol && !k.uitverkocht);
  const { body: aan } = await post('/api/gast/aanschuiven', { token, naam: 'Gast 3' });
  await post('/api/gast/bestel', { sleutel: aan.sleutel, items: [{ itemId: item.id, aantal: 1 }] });

  /* De gast checkt uit: de folio wordt afgerekend. De open roomservice-rekening
     blijft staan voor de zaak (daar staat nog geld open), maar een NIEUWE
     sessie op die kamer hoort niet meer te ontstaan -- want de volgende die
     hier binnenloopt is iemand anders. */
  const af = await post('/api/supplier/horeca/folio/afrekenen', { kamer, wijze: 'pin' }, ZAAK);
  assert.equal(af.status, 200, JSON.stringify(af.body).slice(0, 160));

  const opnieuw = await post('/api/gast/aanschuiven', { token, naam: 'Vreemde' });
  assert.equal(opnieuw.status, 409, 'na uitchecken opent dezelfde QR geen nieuwe sessie');
  assert.equal(opnieuw.body.code, 'geen-verblijf');
});

test('de tafel-QR blijft werken zoals hij deed', async () => {
  /* De plek-laag is een generalisatie van de tafel-laag, en dit is de toets die
     zakt als die verbouwing de bestaande kant heeft geraakt. Oude QR-rijen in
     de opslag dragen geen `soort` en horen op 'tafel' terug te vallen. */
  const qr = await post('/api/supplier/horeca/gast/qr', { tafel: 'Tafel 99' }, ZAAK);
  assert.equal(qr.status, 200);
  assert.equal(qr.body.soort, 'tafel');
  const kijk = await post('/api/gast/tafel', { token: qr.body.token });
  assert.equal(kijk.status, 200);
  assert.equal(kijk.body.tafel, 'Tafel 99');
  assert.equal(kijk.body.kamer, null);
  const aan = await post('/api/gast/aanschuiven', { token: qr.body.token, naam: 'Aan tafel' });
  assert.equal(aan.status, 200);
  assert.equal(aan.body.rekening.kanaal, 'tafel');
});

/* ---------------------------------------------------------------------------
   DE CLUB. Hier was bijna niets nieuws nodig -- een polsband is al een
   tegoedbon en betalen met een tegoed liep al. Wat erbij moest is het BEWIJS
   dat de band van jou is: aan de bar geef je hem af, op een telefoon niet. Het
   bandnummer staat groot op de band en is te raden; de boncode niet. Deze twee
   toetsen bewaken precies dat onderscheid.
   --------------------------------------------------------------------------- */

test('een polsbandsaldo is te zien met de boncode, en niet met het bandnummer', async () => {
  const qr = await post('/api/supplier/horeca/gast/qr', { tafel: 'VIP 1' }, ZAAK);
  const { body: aan } = await post('/api/gast/aanschuiven', { token: qr.body.token, naam: 'Clubgast' });

  const band = await post('/api/supplier/horeca/club/band', { nummer: '077', bedrag: 50 }, ZAAK);
  assert.equal(band.status, 200);
  const bonCode = band.body.band.bonCode;
  assert.ok(bonCode, 'de zaak krijgt de boncode terug om als QR op de band te zetten');

  const goed = await post('/api/gast/band', { sleutel: aan.sleutel, bonCode });
  assert.equal(goed.status, 200);
  assert.equal(goed.body.saldo, 5000);

  const metNummer = await post('/api/gast/band', { sleutel: aan.sleutel, bonCode: '077' });
  assert.equal(metNummer.status, 404,
    'het bandnummer is geen bewijs: dat staat groot op de band en is te raden');
  assert.equal(metNummer.body.code, 'band-onbekend');
});

test('met de band afrekenen loopt langs hetzelfde tegoed dat de zaak ziet', async () => {
  const qr = await post('/api/supplier/horeca/gast/qr', { tafel: 'VIP 2' }, ZAAK);
  const { body: aan } = await post('/api/gast/aanschuiven', { token: qr.body.token, naam: 'Bandgast' });
  const rekId = aan.rekening.rekeningId;
  await post('/api/supplier/horeca/rekening/regel', { rekeningId: rekId, naam: 'Fles cava', centen: 4000, aantal: 1 }, ZAAK);
  const band = await post('/api/supplier/horeca/club/band', { nummer: '078', bedrag: 50 }, ZAAK);
  const bonCode = band.body.band.bonCode;

  const betaal = await post('/api/gast/betaal', { sleutel: aan.sleutel, wijze: 'tegoed', bonCode });
  assert.equal(betaal.status, 200, JSON.stringify(betaal.body).slice(0, 200));
  assert.equal(betaal.body.gesloten, true);
  assert.equal(betaal.body.bonSaldo, 1000, 'van 50,00 blijft na 40,00 nog 10,00 op de band staan');

  // en de zaak ziet hetzelfde saldo, want het is dezelfde bon
  const zaakKant = await post('/api/supplier/horeca/club/band', { nummer: '078', bedrag: 0 }, ZAAK);
  const echt = zaakKant.status === 200 ? zaakKant.body.band.saldo : null;
  if (echt !== null) assert.equal(echt, 1000, 'de zaak telt hetzelfde tegoed als de gast');
});
