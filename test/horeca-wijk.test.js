/* RTG Horeca: DE WIJK -- welke tafels zijn van wie.

   De werklijst toonde de hele zaak, en dat stond er ook bij: een sectie-indeling
   bestond nergens, dus deed het scherm niet alsof. Eerlijk, maar op een avond
   met veertig tafels is "alles" geen werklijst maar een muur.

   Een wijk mag werk VERDELEN en nooit VERBERGEN. Dat is geen slogan maar vier
   toetsbare regels:

   1. EEN TAFEL ZONDER WIJK IS VAN IEDEREEN. Wie hem vergeet in te delen,
      verliest hem niet.
   2. EEN WIJK DIE NIEMAND DRAAGT IS VAN IEDEREEN. Iemand klokt uit en het werk
      valt terug naar de ploeg, niet in een gat.
   3. EEN TAFEL HOORT BIJ HOOGSTENS EEN WIJK, en verhuizen gebeurt zichtbaar.
   4. EEN LIJST DIE FILTERT, ZEGT HOEVEEL HIJ NIET TOONT. Een filter dat zwijgt
      over wat het wegliet, is een filter waarin werk verdwijnt.

   En twee over wie wat mag: indelen is manager-werk, nemen en loslaten doet de
   bediening zelf -- maar loslaten alleen wat van jou is.

   Draai: node --experimental-sqlite --test test/horeca-wijk.test.js */
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs'); const os = require('os'); const path = require('path');
const { startServer } = require('./helper');

/* De demozaak heeft twee mensen: een manager en een vloermedewerker. Dat is
   precies genoeg voor wat hier bewezen moet worden -- een collega is een collega,
   ook als hij toevallig de baas is. Waar het om gaat is: draagt IEMAND ANDERS
   deze wijk. */
let BASE, child, tokM, tokA, tokB, tokN, naamM, naamA, naamB, naamN, idB, idN;
const TMP = fs.mkdtempSync(path.join(os.tmpdir(), 'rtg-wijk-'));
const api = (pad, body, token) => fetch(BASE + pad, {
  method: 'POST', headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: 'Bearer ' + token } : {}) },
  body: JSON.stringify(body || {})
}).then(async r => ({ status: r.status, body: await r.json().catch(() => ({})) }));
const M = (pad, body) => api(pad, body, tokM);
const A = (pad, body) => api(pad, body, tokA);
/* Twee mensen zijn genoeg voor "draagt iemand anders dit", maar niet voor
   "mag een DERDE hier iets mee". Weigeren, een antwoord wegklikken en een
   uitgeleende tafel teruggeven zijn alle drie handelingen van een bepaalde
   mens -- en die regel is pas een regel als iemand anders hem ziet weigeren.
   Bram en Nadia komen er in demomodus bij (RTG_DEMO). */
const B = (pad, body) => api(pad, body, tokB);
const N = (pad, body) => api(pad, body, tokN);


test.before(async () => {
  ({ child, base: BASE } = await startServer({ env: { RTG_DATA_DIR: TMP, SMTP_URL: '', RTG_DEMO: '1' } }));
  const roster = (await api('/api/supplier/roster', { code: 'KIKUNOI' })).body;
  const mgr = roster.staff.find(x => x.role === 'manager') || roster.staff[0];
  const vloer = roster.staff.find(x => x.id !== mgr.id);
  assert.ok(vloer, 'de demozaak heeft naast de manager nog iemand');
  naamM = mgr.name; naamA = vloer.name;
  tokM = (await api('/api/supplier/login', { code: 'KIKUNOI', staffId: mgr.id, pin: '1234' })).body.token;
  tokA = (await api('/api/supplier/login', { code: 'KIKUNOI', staffId: vloer.id, pin: '5678' })).body.token;
  assert.ok(tokM && tokA, 'beide inlogs');

  for (const naam of ['Bram', 'Nadia']) {
    const nieuw = (await api('/api/supplier/staff/add', { name: naam }, tokM)).body;
    assert.ok(nieuw.staff && nieuw.pin, 'er komt iemand bij: ' + JSON.stringify(nieuw));
    const tok = (await api('/api/supplier/login',
      { code: 'KIKUNOI', staffId: nieuw.staff.id, pin: nieuw.pin })).body.token;
    assert.ok(tok, naam + ' kan inloggen');
    if (naam === 'Bram') { tokB = tok; naamB = nieuw.staff.name; idB = String(nieuw.staff.id); }
    else { tokN = tok; naamN = nieuw.staff.name; idN = String(nieuw.staff.id); }
  }
});
test.after(() => {
  if (child) try { child.kill('SIGKILL'); } catch (e) {}
  try { fs.rmSync(TMP, { recursive: true, force: true }); } catch (e) {}
});

async function tafelMetVerzoek(naam) {
  const r = (await M('/api/supplier/horeca/rekening/open', { kanaal: 'tafel', tafel: naam, gasten: 2 })).body.rekening;
  const qr = (await M('/api/supplier/horeca/gast/qr', { tafel: naam })).body;
  const aan = (await api('/api/gast/aanschuiven', { token: qr.token, naam: 'Gast' })).body;
  await api('/api/gast/verzoek', { sleutel: aan.sleutel, soort: 'hulp', tekst: 'iets met ' + naam });
  return r.id;
}
const lijst = async (fn, wijkOpt) => (await fn('/api/supplier/horeca/werklijst', Object.assign({ modus: 'alles' }, wijkOpt || {}))).body;
const taken = (d) => d.nu.concat(d.open);

test('1. indelen is manager-werk; nemen doet de bediening zelf', async () => {
  const nee = await A('/api/supplier/horeca/wijk/zet', { naam: 'Raamkant', tafels: ['W1'] });
  assert.ok(nee.status === 403 || nee.status === 401, 'de vloer deelt niet in: ' + nee.status);

  const w = await M('/api/supplier/horeca/wijk/zet', { naam: 'Raamkant', tafels: ['W1', 'W2'] });
  assert.equal(w.status, 200);
  assert.equal(w.body.wijk.tafels.length, 2);

  const genomen = await A('/api/supplier/horeca/wijk/neem', { wijkId: w.body.wijk.id });
  assert.equal(genomen.status, 200, 'de bediening neemt hem zelf');
  assert.equal(genomen.body.van.naam, naamA);
});

test('2. een tweede die dezelfde wijk neemt, hoort wie hem heeft', async () => {
  const w = (await M('/api/supplier/horeca/wijken', {})).body.wijken.find(x => x.naam === 'Raamkant');
  /* Ook een manager pakt een wijk niet stilzwijgend af: nemen is geen recht maar
     een handeling, en twee mensen die denken dat een tafel van hen is, is erger
     dan niemand. Vrijmaken is iets anders -- dat mag hij wel (zie onder). */
  const tweede = await M('/api/supplier/horeca/wijk/neem', { wijkId: w.id });
  assert.equal(tweede.status, 409);
  assert.equal(tweede.body.code, 'al-genomen');
  assert.match(tweede.body.error, new RegExp(naamA), 'met de naam erbij: ' + tweede.body.error);

  const magWel = await M('/api/supplier/horeca/wijk/laat', { wijkId: w.id });
  assert.equal(magWel.status, 200, 'een manager mag een wijk wel vrijmaken');
  await A('/api/supplier/horeca/wijk/neem', { wijkId: w.id });   // terug in de oude stand
});

test('2b. loslaten kan alleen wat van jou is', async () => {
  const t = await M('/api/supplier/horeca/wijk/zet', { naam: 'Bar', tafels: ['W7'] });
  await M('/api/supplier/horeca/wijk/neem', { wijkId: t.body.wijk.id });
  const nee = await A('/api/supplier/horeca/wijk/laat', { wijkId: t.body.wijk.id });
  assert.equal(nee.status, 409, 'de vloer laat de wijk van een ander niet los');
  assert.match(nee.body.error, new RegExp(naamM), 'en hoort wie hem draagt: ' + nee.body.error);
  await M('/api/supplier/horeca/wijk/laat', { wijkId: t.body.wijk.id });
  await M('/api/supplier/horeca/wijk/weg', { wijkId: t.body.wijk.id });
});

test('3. een tafel hoort bij hoogstens een wijk, en verhuizen is zichtbaar', async () => {
  const tweede = await M('/api/supplier/horeca/wijk/zet', { naam: 'Terras', tafels: ['W2', 'W3'] });
  assert.equal(tweede.status, 200);
  assert.equal(tweede.body.verhuisd.length, 1, 'W2 kwam uit een andere wijk');
  assert.equal(tweede.body.verhuisd[0].tafel, 'W2');
  assert.equal(tweede.body.verhuisd[0].van, 'Raamkant');
  assert.match(tweede.body.let, /hoogstens een wijk/);

  const wijken = (await M('/api/supplier/horeca/wijken', {})).body.wijken;
  assert.deepEqual(wijken.find(x => x.naam === 'Raamkant').tafels, ['W1'], 'en hij staat er niet meer in');
});

test('4. de wijklens toont mijn tafels, en zegt wat hij niet toont', async () => {
  await tafelMetVerzoek('W1');   // van Raamkant, dus van A
  await tafelMetVerzoek('W3');   // van Terras, en die draagt niemand
  await tafelMetVerzoek('W9');   // in geen enkele wijk

  const alles = await lijst(A, { wijk: 'alles' });
  const namen = taken(alles).map(t => t.tafel);
  assert.ok(namen.includes('W1') && namen.includes('W3') && namen.includes('W9'),
    'zonder lens staat alles er: ' + namen.join(', '));
  assert.equal(alles.verborgen, 0);

  const mijn = await lijst(A, { wijk: 'mijn' });
  const mijne = taken(mijn).map(t => t.tafel);
  assert.ok(mijne.includes('W1'), 'mijn eigen wijk staat er');
  assert.ok(mijne.includes('W3'), 'regel 2: een wijk die niemand draagt is van iedereen');
  assert.ok(mijne.includes('W9'), 'regel 1: een tafel zonder wijk is van iedereen');
  assert.deepEqual(mijn.mijnWijken, ['Raamkant']);
});

test('5. een tafel van een COLLEGA valt weg, en dat staat erbij', async () => {
  const terras = (await M('/api/supplier/horeca/wijken', {})).body.wijken.find(x => x.naam === 'Terras');
  await M('/api/supplier/horeca/wijk/neem', { wijkId: terras.id });   // nu draagt de collega het terras

  const mijn = await lijst(A, { wijk: 'mijn' });
  const mijne = taken(mijn).map(t => t.tafel);
  assert.ok(mijne.includes('W1'), 'mijn eigen tafel staat er nog');
  assert.ok(!mijne.includes('W3'), 'de tafel van de collega niet meer');
  assert.ok(mijne.includes('W9'), 'en de tafel zonder wijk nog steeds');
  assert.ok(mijn.verborgen >= 1, 'wat wegviel is geteld: ' + mijn.verborgen);
  assert.match(mijn.let, /buiten uw wijk/, 'en het staat er met zoveel woorden bij');

  const vanCollega = await lijst(M, { wijk: 'mijn' });
  assert.ok(taken(vanCollega).map(t => t.tafel).includes('W3'), 'bij de collega staat hij wel');
});

/* EERLIJK OVER WAT DEZE LAATSTE TOETS WEL EN NIET BEWIJST. Dat de tafels van
   een weggehaalde wijk bij iedereen terugkomen, VOLGT uit regel 1 -- een tafel
   in geen enkele wijk is van iedereen -- en die regel heeft zijn eigen toets
   hierboven. Er is dan ook geen mutatie in wijk.js gevonden die deze toets laat
   zakken zonder er een andere mee te nemen; drie pogingen bleven groen.

   Hij staat er toch, en met opzet: hij bewaakt de VOLGENDE versie van weg().
   Een weghaal-functie die de tafels "opruimt", de dienst laat staan of de
   tafels naar een restwijk verplaatst, is een voor de hand liggende
   verbetering die precies dit stukmaakt. Een toets die vandaag niets vangt maar
   morgen de enige is die iets zegt, is geen dode toets. */
test('6. een wijk weghalen laat de tafels bij iedereen, niet in een gat', async () => {
  const terras = (await M('/api/supplier/horeca/wijken', {})).body.wijken.find(x => x.naam === 'Terras');
  const weg = await M('/api/supplier/horeca/wijk/weg', { wijkId: terras.id });
  assert.equal(weg.status, 200);
  assert.match(weg.body.let, /bij iedereen/);

  for (const [wie, deur] of [['de vloer', A], ['de collega die hem droeg', M]]) {
    const mijn = await lijst(deur, { wijk: 'mijn' });
    assert.ok(taken(mijn).map(t => t.tafel).includes('W3'),
      'de tafel van de weggehaalde wijk staat weer bij ' + wie);
    assert.ok(!mijn.mijnWijken.includes('Terras'), 'en de wijk zelf is weg bij ' + wie);
  }
});

/* ---------- EEN WIJK OVERDRAGEN midden in een dienst ----------

   De vraag van VLOER is niet "wat moet ik nu doen" maar "wie heeft ons nú
   nodig, en hoe verdelen we dat". Het eerste deel stond er al (het wijkbeeld);
   het tweede kon niet -- en dat is precies het moment waarop een maître iets
   nodig heeft: iemand gaat pauzeren, iemand raakt achterop.

   HET GEVAAR ZIT IN HET GAT. Een wijk loslaten en hopen dat een collega hem
   oppakt, is een tafel die tussen twee mensen door valt. Dus is een overdracht
   geen "loslaten" maar een AANBOD, en tijdens dat aanbod draagt de aanbieder
   hem nog. */

const wijken = async (deur) => (await deur('/api/supplier/horeca/wijken', {})).body;
const wijkMet = async (deur, naam) => (await wijken(deur)).wijken.find(x => x.naam === naam);

test('7. tijdens een aanbod draagt de aanbieder de wijk nog', async () => {
  const w = await M('/api/supplier/horeca/wijk/zet', { naam: 'Serre', tafels: ['V1', 'V2'] });
  await A('/api/supplier/horeca/wijk/neem', { wijkId: w.body.wijk.id });

  const ploeg = (await wijken(A)).ploeg;
  const ander = ploeg.find(x => x.naam === naamM);
  assert.ok(ander, 'de ploeg staat erbij zodat een aanbod een naam kan krijgen');

  const bod = await A('/api/supplier/horeca/wijk/bied', { wijkId: w.body.wijk.id, naarId: ander.id, naarNaam: ander.naam });
  assert.equal(bod.status, 200);
  assert.equal(bod.body.overdracht.stand, 'aangeboden');
  assert.match(bod.body.let, /draagt deze wijk nog/i, bod.body.let);

  /* DIT IS DE HELE POINTE: het aanbod verandert niets aan wie verantwoordelijk
     is. Er bestaat geen moment waarop de wijk van niemand is. */
  const nu = await wijkMet(A, 'Serre');
  assert.equal(nu.van.naam, naamA, 'de aanbieder draagt hem nog steeds');
  assert.equal(nu.vanMij, true);
});

test('8. alleen de gevraagde aanvaardt, en pas dan verhuist de wijk', async () => {
  const o = (await wijken(A)).overdrachten.find(x => x.wijkNaam === 'Serre');
  assert.ok(o, 'het aanbod staat er');

  const zelf = await A('/api/supplier/horeca/wijk/aanvaard', { overdrachtId: o.id });
  assert.equal(zelf.status, 409, 'de aanbieder aanvaardt zijn eigen aanbod niet');
  assert.equal(zelf.body.code, 'niet-voor-jou');

  const ja = await M('/api/supplier/horeca/wijk/aanvaard', { overdrachtId: o.id });
  assert.equal(ja.status, 200);
  assert.match(ja.body.let, /overgenomen van/i, ja.body.let);

  const na = await wijkMet(M, 'Serre');
  assert.equal(na.van.naam, naamM, 'nu pas is hij van de ander');
  assert.equal(na.van.overgenomenVan, naamA, 'met de naam van wie hem overdroeg');
  assert.equal((await wijken(M)).overdrachten.length, 0, 'en het aanbod staat niet meer open');
});

test('9. een collega trekt een wijk niet naar zich toe', async () => {
  const w = await wijkMet(M, 'Serre');
  const nee = await A('/api/supplier/horeca/wijk/bied', { wijkId: w.id, naarId: '999', naarNaam: 'iemand' });
  assert.equal(nee.status, 409, 'wie hem niet draagt, biedt hem niet aan');
  assert.equal(nee.body.code, 'niet-van-jou');
  assert.match(nee.body.error, new RegExp(naamM), 'met de naam van wie hem wel draagt: ' + nee.body.error);
});

test('10. een wijk heeft hoogstens een open aanbod, en intrekken kan', async () => {
  const w = await wijkMet(M, 'Serre');
  const ploeg = (await wijken(M)).ploeg;
  const naarA = ploeg.find(x => x.naam === naamA);

  const een = await M('/api/supplier/horeca/wijk/bied', { wijkId: w.id, naarId: naarA.id, naarNaam: naarA.naam });
  assert.equal(een.status, 200);
  const twee = await M('/api/supplier/horeca/wijk/bied', { wijkId: w.id, naarId: naarA.id, naarNaam: naarA.naam });
  assert.equal(twee.status, 409, 'twee aanbiedingen op dezelfde wijk geven twee antwoorden');
  assert.equal(twee.body.code, 'al-aangeboden');

  /* Intrekken is van de AANBIEDER (of van een manager die moet opruimen), en
     niet van de gevraagde: wie een wijk aangeboden krijgt, aanvaardt hem of
     laat hem staan -- maar haalt het aanbod niet weg onder degene die hem
     nog draagt. */
  const nietVanJou = await A('/api/supplier/horeca/wijk/trek-in', { overdrachtId: een.body.overdracht.id });
  assert.equal(nietVanJou.status, 409, 'de gevraagde trekt het aanbod van een ander niet in');
  assert.match(nietVanJou.body.error, new RegExp(naamM), nietVanJou.body.error);
  assert.equal((await wijken(M)).overdrachten.length, 1, 'en het aanbod staat er nog');

  const weg = await M('/api/supplier/horeca/wijk/trek-in', { overdrachtId: een.body.overdracht.id });
  assert.equal(weg.status, 200);
  assert.match(weg.body.let, /draagt Serre nog steeds/i, weg.body.let);
  assert.equal((await wijkMet(M, 'Serre')).van.naam, naamM, 'en er is niets verhuisd');

  // en daarna kan er weer een nieuw aanbod uit
  const opnieuw = await M('/api/supplier/horeca/wijk/bied', { wijkId: w.id, naarId: naarA.id, naarNaam: naarA.naam });
  assert.equal(opnieuw.status, 200, 'na intrekken kan het weer');
  await M('/api/supplier/horeca/wijk/trek-in', { overdrachtId: opnieuw.body.overdracht.id });

  /* De andere helft van dezelfde regel: de AANBIEDER trekt zijn eigen aanbod
     in, ook als hij geen manager is. Een bediening die zich bedenkt hoeft
     niemand te roepen -- anders is de manager een grendel op een handeling
     van een halve seconde. */
  const eigen = await M('/api/supplier/horeca/wijk/zet', { naam: 'Loge', tafels: ['V7'] });
  await A('/api/supplier/horeca/wijk/neem', { wijkId: eigen.body.wijk.id });
  const naarM = ploeg.find(x => x.naam === naamM);
  const bod = await A('/api/supplier/horeca/wijk/bied', { wijkId: eigen.body.wijk.id, naarId: naarM.id, naarNaam: naarM.naam });
  assert.equal(bod.status, 200);
  const zelfWeg = await A('/api/supplier/horeca/wijk/trek-in', { overdrachtId: bod.body.overdracht.id });
  assert.equal(zelfWeg.status, 200, 'de aanbieder trekt zijn eigen aanbod in, zonder manager te zijn');
  assert.equal((await wijkMet(A, 'Loge')).vanMij, true, 'en houdt de wijk gewoon');
});

test('11. de werklijst volgt de overdracht: het werk verhuist mee', async () => {
  await tafelMetVerzoek('V1');   // V1 zit in Serre, en die is nu van de manager

  const vanA = await lijst(A, { wijk: 'mijn' });
  assert.ok(!taken(vanA).map(t => t.tafel).includes('V1'),
    'de aanbieder ziet de tafel niet meer, want de wijk is overgedragen');

  const vanM = await lijst(M, { wijk: 'mijn' });
  assert.ok(taken(vanM).map(t => t.tafel).includes('V1'),
    'en wie hem overnam, ziet hem wel');
  assert.ok(vanM.mijnWijken.includes('Serre'));
});

/* ==========================================================================
   NEE ZEGGEN, EN EEN HALVE WIJK

   Tot hier kon een aanbod maar een kant op: aanvaarden of niets doen. Dat legt
   de handeling bij de verkeerde mens -- wie NIET kan, weet dat als enige. En
   een overdracht was altijd de HELE wijk, terwijl "neem tafel 6 even van me
   over" de gewone vorm is op een drukke avond.

   Wat hieronder bewezen wordt gaat over allebei, en over de plek waar ze
   elkaar raken: een uitgeleende tafel is van de LENER, ook al staat hij op de
   kaart nog in de wijk van een ander. */

test('12. weigeren doet de gevraagde, en alleen die', async () => {
  const w = await wijkMet(M, 'Serre');           // die draagt de manager sinds toets 8
  const ploeg = (await wijken(M)).ploeg;
  const naarA = ploeg.find(x => x.naam === naamA);
  const bod = await M('/api/supplier/horeca/wijk/bied', { wijkId: w.id, naarId: naarA.id, naarNaam: naarA.naam });
  assert.equal(bod.status, 200);
  const oid = bod.body.overdracht.id;

  const zelf = await M('/api/supplier/horeca/wijk/weiger', { overdrachtId: oid });
  assert.equal(zelf.status, 409, 'de aanbieder weigert zijn eigen aanbod niet; die trekt in');
  assert.match(zelf.body.error, /intrekken/i, zelf.body.error);

  /* EN OOK EEN MANAGER NIET. Dat is de regel die het meest telt: een manager
     die namens iemand weigert, laat het journaal iets zeggen wat die persoon
     nooit gezegd heeft. Nadia is hier de derde mens die er niets mee te maken
     heeft; de manager staat hierboven al. */
  const derde = await N('/api/supplier/horeca/wijk/weiger', { overdrachtId: oid });
  assert.equal(derde.status, 409, 'een collega weigert een aanbod aan een ander niet');
  assert.equal(derde.body.code, 'niet-voor-jou');

  const nee = await A('/api/supplier/horeca/wijk/weiger', { overdrachtId: oid, reden: 'ik zit zelf vol' });
  assert.equal(nee.status, 200);
  assert.match(nee.body.let, /draagt Serre nog steeds/i, nee.body.let);

  assert.equal((await wijkMet(M, 'Serre')).van.naam, naamM, 'de wijk is niet verhuisd');
  assert.equal((await wijken(M)).overdrachten.length, 0, 'en het aanbod staat niet meer open');
});

test('13. een nee komt aan, en verdwijnt niet vanzelf', async () => {
  const mijne = (await wijken(M)).antwoorden;
  assert.equal(mijne.length, 1, 'de aanbieder krijgt het antwoord te zien');
  assert.equal(mijne[0].reden, 'ik zit zelf vol', 'met de reden erbij');
  assert.equal(mijne[0].wijkNaam, 'Serre');

  assert.equal((await wijken(A)).antwoorden.length, 0, 'wie weigerde krijgt zijn eigen nee niet terug');
  assert.equal((await wijken(N)).antwoorden.length, 0, 'en een collega evenmin');

  const derde = await N('/api/supplier/horeca/wijk/gezien', { overdrachtId: mijne[0].id });
  assert.equal(derde.status, 409, 'een ander klikt het antwoord niet weg');

  const weg = await M('/api/supplier/horeca/wijk/gezien', { overdrachtId: mijne[0].id });
  assert.equal(weg.status, 200);
  assert.equal((await wijken(M)).antwoorden.length, 0, 'gezien is weg');
});

test('14. een half aanbod verhuist geen tafels', async () => {
  const z = (await M('/api/supplier/horeca/wijk/zet', { naam: 'Zaal', tafels: ['Z1', 'Z2', 'Z3', 'Z4'] })).body.wijk;
  await A('/api/supplier/horeca/wijk/neem', { wijkId: z.id });

  const bod = await A('/api/supplier/horeca/wijk/bied', { wijkId: z.id, naarId: idB, naarNaam: naamB, tafels: ['Z1', 'Z2'] });
  assert.equal(bod.status, 200, JSON.stringify(bod.body));
  assert.deepEqual(bod.body.overdracht.tafels, ['Z1', 'Z2'], 'het aanbod draagt twee tafels');
  assert.equal((await wijkMet(A, 'Zaal')).vanMij, true, 'en tijdens het aanbod houdt de aanbieder alles');

  const ja = await B('/api/supplier/horeca/wijk/aanvaard', { overdrachtId: bod.body.overdracht.id });
  assert.equal(ja.status, 200);
  assert.match(ja.body.let, /houdt de rest van Zaal/i, ja.body.let);

  /* DIT IS DE POINTE: de kaart is niet hertekend en de wijk is niet verhuisd.
     Alleen die twee tafels worden nu door iemand anders gedragen. */
  const na = await wijkMet(A, 'Zaal');
  assert.deepEqual(na.tafels, ['Z1', 'Z2', 'Z3', 'Z4'], 'de plattegrond staat er nog precies zo');
  assert.equal(na.van.naam, naamA, 'en Zaal is nog steeds van wie hem droeg');

  const leen = (await wijken(A)).leningen;
  assert.deepEqual(leen.map(l => l.tafel).sort(), ['Z1', 'Z2'], 'twee tafels staan uit');
  assert.equal(leen[0].naam, naamB, 'op naam van wie ze draagt');
  assert.equal(leen[0].vanNaam, naamA, 'met wie ze uitleende erbij');
  assert.equal(leen[0].wijkNaam, 'Zaal', 'en uit welke wijk ze komen');
  assert.equal(na.uitgeleend.length, 2, 'de wijk zelf zegt hoeveel er van hem uitstaat');
});

test('15. de werklijst volgt de leen: een uitgeleende tafel is van de lener', async () => {
  await tafelMetVerzoek('Z1');   // uitgeleend aan Bram
  await tafelMetVerzoek('Z3');   // nog gewoon van Ayla

  const vanA = taken(await lijst(A, { wijk: 'mijn' })).map(t => t.tafel);
  assert.ok(vanA.includes('Z3'), 'wie de wijk draagt houdt de rest');
  assert.ok(!vanA.includes('Z1'), 'maar niet de tafel die hij heeft uitgeleend');

  const vanB = taken(await lijst(B, { wijk: 'mijn' })).map(t => t.tafel);
  assert.ok(vanB.includes('Z1'), 'die staat bij wie hem draagt');
  assert.ok(!vanB.includes('Z3'), 'en de rest van die wijk niet');

  /* HET GETAL MAG NIET LIEGEN. "Zaal, vier open" terwijl er twee bij Bram
     staan, is een mening die eruitziet als een meting (grens 7). Geteld uit de
     lijst zelf en niet uit een verwacht getal: hoeveel taken een pas gezette
     tafel oplevert, is een som van elders. */
  const alles = taken(await lijst(M, {}));
  const opZ1 = alles.filter(t => t.tafel === 'Z1').length;
  const opZaal = alles.filter(t => ['Z1', 'Z2', 'Z3', 'Z4'].includes(t.tafel)).length;
  assert.ok(opZ1 > 0 && opZ1 < opZaal, 'er staat werk op de uitgeleende tafel en op de rest');

  const zaal = (await wijken(A)).wijken.find(x => x.naam === 'Zaal');
  assert.equal(zaal.taken, opZaal, 'de drukte telt al het werk op de kaart van deze wijk');
  assert.equal(zaal.uit, opZ1, 'met erbij hoeveel daarvan op een uitgeleende tafel staat');
});

test('16. een tafel staat hoogstens bij een iemand uit', async () => {
  const z = await wijkMet(A, 'Zaal');

  /* EN JE GEEFT ALLEEN WEG WAT IN JE EIGEN WIJK ZIT. V1 zit in Serre; zonder
     deze grens zou een aanbod de tafel van een collega kunnen uitlenen. */
  const vreemd = await A('/api/supplier/horeca/wijk/bied', { wijkId: z.id, naarId: idN, naarNaam: naamN, tafels: ['Z3', 'V1'] });
  assert.equal(vreemd.status, 400, 'een tafel uit een andere wijk gaat niet mee');
  assert.equal(vreemd.body.code, 'niet-uit-deze-wijk');
  assert.match(vreemd.body.error, /V1/, vreemd.body.error);

  /* EN AAN IEMAND DIE HIER WERKT. Dit veld was als enige niet nagekeken: een
     aanbod aan een verzonnen staffId bleef staan tot iemand het introk, want
     aanvaarden kon niemand het. */
  const spook = await A('/api/supplier/horeca/wijk/bied', { wijkId: z.id, naarId: '99999', naarNaam: 'Spook', tafels: ['Z3'] });
  assert.equal(spook.status, 404, 'een aanbod aan iemand die hier niet werkt gaat niet door');
  assert.equal(spook.body.code, 'onbekende-collega');
  assert.equal((await wijken(A)).overdrachten.length, 0, 'en er staat niets open');

  const weer = await A('/api/supplier/horeca/wijk/bied', { wijkId: z.id, naarId: idN, naarNaam: naamN, tafels: ['Z1'] });
  assert.equal(weer.status, 409, 'een uitgeleende tafel bied je niet nog eens aan');
  assert.equal(weer.body.code, 'uitgeleend');
  assert.match(weer.body.error, new RegExp(naamB), weer.body.error);

  const heel = await A('/api/supplier/horeca/wijk/bied', { wijkId: z.id, naarId: idN, naarNaam: naamN });
  assert.equal(heel.status, 409, 'en de hele wijk ook niet, zolang er een stuk van uit is');
  assert.equal(heel.body.code, 'uitgeleend');

  const een = await A('/api/supplier/horeca/wijk/bied', { wijkId: z.id, naarId: idN, naarNaam: naamN, tafels: ['Z3'] });
  assert.equal(een.status, 200, 'een vrije tafel mag wel: ' + JSON.stringify(een.body));

  const zelfde = await A('/api/supplier/horeca/wijk/bied', { wijkId: z.id, naarId: idB, naarNaam: naamB, tafels: ['Z3', 'Z4'] });
  assert.equal(zelfde.status, 409, 'een tafel die al uitstaat, staat niet twee keer uit');
  assert.equal(zelfde.body.code, 'al-aangeboden');

  /* MAAR TWEE HALVE AANBIEDINGEN OP VERSCHILLENDE TAFELS MOGEN WEL. Vier tafels
     aan Bram en drie aan Nadia is een normale avond, geen uitzondering. */
  const naast = await A('/api/supplier/horeca/wijk/bied', { wijkId: z.id, naarId: idB, naarNaam: naamB, tafels: ['Z4'] });
  assert.equal(naast.status, 200, 'naast elkaar mag: ' + JSON.stringify(naast.body));

  await A('/api/supplier/horeca/wijk/trek-in', { overdrachtId: een.body.overdracht.id });
  await A('/api/supplier/horeca/wijk/trek-in', { overdrachtId: naast.body.overdracht.id });
});

test('17. teruggeven doet de lener, de uitlener of een manager -- en niemand anders', async () => {
  const nee = await N('/api/supplier/horeca/wijk/tafel-terug', { tafel: 'Z1' });
  assert.equal(nee.status, 409, 'een collega geeft andermans tafel niet terug');
  assert.match(nee.body.error, new RegExp(naamB), nee.body.error);

  const doorLener = await B('/api/supplier/horeca/wijk/tafel-terug', { tafel: 'Z1' });
  assert.equal(doorLener.status, 200, 'wie hem draagt geeft hem terug: klaar');
  assert.match(doorLener.body.let, /Zaal/, doorLener.body.let);

  const doorUitlener = await A('/api/supplier/horeca/wijk/tafel-terug', { tafel: 'Z2' });
  assert.equal(doorUitlener.status, 200, 'en wie hem uitleende ook: ik kan weer');

  assert.equal((await wijken(A)).leningen.length, 0, 'er staat niets meer uit');
  const terug = taken(await lijst(A, { wijk: 'mijn' })).map(t => t.tafel);
  assert.ok(terug.includes('Z1'), 'en het werk staat weer bij de wijk waar de tafel op de kaart staat');

  // en een manager kan opruimen wat niemand meer terugvraagt
  const z = await wijkMet(A, 'Zaal');
  const bod = await A('/api/supplier/horeca/wijk/bied', { wijkId: z.id, naarId: idB, naarNaam: naamB, tafels: ['Z2'] });
  await B('/api/supplier/horeca/wijk/aanvaard', { overdrachtId: bod.body.overdracht.id });
  const doorManager = await M('/api/supplier/horeca/wijk/tafel-terug', { tafel: 'Z2' });
  assert.equal(doorManager.status, 200, 'een manager ruimt op');
});

test('18. alles aanvinken is de hele wijk, en niet zeven losse tafels', async () => {
  const z = await wijkMet(A, 'Zaal');
  const bod = await A('/api/supplier/horeca/wijk/bied', { wijkId: z.id, naarId: idB, naarNaam: naamB, tafels: z.tafels });
  assert.equal(bod.status, 200, JSON.stringify(bod.body));
  assert.equal(bod.body.overdracht.tafels, null,
    'alle tafels aanvinken IS de hele wijk aanbieden -- anders levert het hetzelfde werk op ' +
    'met vier keer teruggeven erachteraan');

  const ja = await B('/api/supplier/horeca/wijk/aanvaard', { overdrachtId: bod.body.overdracht.id });
  assert.equal(ja.status, 200);
  assert.equal((await wijkMet(B, 'Zaal')).van.naam, naamB, 'dus verhuist de wijk zelf');
  assert.equal((await wijken(B)).leningen.length, 0, 'en staat er geen enkele tafel uitgeleend');
});

test('19. een aanbod reist mee naar de PDA, want daar staat de mens', async () => {
  /* Overdragen gebeurt op de vloer, waar de hele verdeling erbij staat. Maar
     wie een aanbod krijgt, loopt op dat moment met een PDA -- en zolang hij niet
     antwoordt, draagt zijn collega het nog. Dus reist het AANTAL mee in de
     werklijst, geteld uit dezelfde lijst en niet uit een tweede. */
  const z = await wijkMet(B, 'Zaal');   // die draagt Bram sinds toets 18
  assert.equal((await lijst(A, {})).voorMij, 0, 'er ligt nog niets');

  const bod = await B('/api/supplier/horeca/wijk/bied', { wijkId: z.id, naarId: (await wijken(B)).ploeg
    .find(x => x.naam === naamA).id, naarNaam: naamA, tafels: ['Z1'] });
  assert.equal(bod.status, 200, JSON.stringify(bod.body));

  assert.equal((await lijst(A, {})).voorMij, 1, 'de gevraagde ziet het op zijn eigen lijst');
  assert.equal((await lijst(B, {})).voorMij, 0, 'de aanbieder telt zijn eigen aanbod niet mee');
  assert.equal((await lijst(N, {})).voorMij, 0, 'en een collega evenmin');

  await B('/api/supplier/horeca/wijk/trek-in', { overdrachtId: bod.body.overdracht.id });
  assert.equal((await lijst(A, {})).voorMij, 0, 'ingetrokken telt niet meer mee');
});
