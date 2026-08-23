/* RTG Horeca: WAT RAHUL MAG, en de actiebon die er altijd bij hoort.

   De opdracht was letterlijk: een AI-voorstel kan nooit ONGEMERKT een allergie
   aanpassen, een betaling uitvoeren, een medewerker beoordelen, een
   alcoholbeperking negeren, een voorraadverschil wegboeken of een hoge korting
   toekennen.

   "Nooit ongemerkt" is geen belofte maar een eigenschap, en deze toets is de
   plek waar die eigenschap wordt vastgehouden:

   1. VERBODEN IS VERBODEN, en er is geen bevestiging die het opheft. Een
      medewerker beoordelen en een alcoholgrens negeren komen er niet doorheen --
      ook niet als een manager erop drukt.
   2. EEN VOORSTEL VERANDERT NIETS. Bij `mensbevestigt` staat er een bon met
      stand `wacht` en is er aan de rekening niets gebeurd. Pas de bevestiging
      doet iets, en dan staat de naam van de mens erop.
   3. ELKE POGING LAAT EEN BON NA, ook een geweigerde. Een poging die niemand
      ziet, is de gevaarlijkste.
   4. EEN ONBEKENDE HANDELING IS NIET VRIJGEGEVEN. Wat niemand heeft beoordeeld,
      valt terug op `mensbevestigt` -- nooit op `mag`.
   5. ER IS GEEN VERZONNEN KORTINGSGRENS. Zonder instelling vraagt ELKE korting
      een mens; met instelling geldt precies dat bedrag.
   6. DE BON IS APPEND-ONLY EN DRAAGT ZIJN REDEN. Geen deur die hem wist, en
      "geweigerd" staat er nooit zonder waarom.

   Draai: node --experimental-sqlite --test test/horeca-rahul.test.js */
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs'); const os = require('os'); const path = require('path');
const { startServer } = require('./helper');

let BASE, child, tokM, tokV, naamM;
const TMP = fs.mkdtempSync(path.join(os.tmpdir(), 'rtg-rahul-'));
const api = (pad, body, token) => fetch(BASE + pad, {
  method: 'POST', headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: 'Bearer ' + token } : {}) },
  body: JSON.stringify(body || {})
}).then(async r => ({ status: r.status, body: await r.json().catch(() => ({})) }));
const M = (pad, body) => api('/api/supplier/horeca' + pad, body, tokM);
const V = (pad, body) => api('/api/supplier/horeca' + pad, body, tokV);

test.before(async () => {
  ({ child, base: BASE } = await startServer({ env: { RTG_DATA_DIR: TMP, SMTP_URL: '' } }));
  const roster = (await api('/api/supplier/roster', { code: 'KIKUNOI' })).body;
  const mgr = roster.staff.find(x => x.role === 'manager') || roster.staff[0];
  const ander = roster.staff.find(x => x.id !== mgr.id);
  naamM = mgr.name;
  tokM = (await api('/api/supplier/login', { code: 'KIKUNOI', staffId: mgr.id, pin: '1234' })).body.token;
  tokV = (await api('/api/supplier/login', { code: 'KIKUNOI', staffId: ander.id, pin: '5678' })).body.token;
  assert.ok(tokM && tokV, 'manager en vloer zijn ingelogd');
});
test.after(() => {
  if (child) try { child.kill('SIGKILL'); } catch (e) {}
  try { fs.rmSync(TMP, { recursive: true, force: true }); } catch (e) {}
});

const bonnen = async () => (await M('/rahul/bonnen', { hoeveel: 100 })).body;
async function tafel(naam, prijs) {
  const r = (await M('/rekening/open', { kanaal: 'tafel', tafel: naam, gasten: 2 })).body.rekening;
  await M('/rekening/regel', { rekeningId: r.id, naam: 'Menu', prijs: prijs || 100, aantal: 1, gang: 1, station: 'warm' });
  return r.id;
}
const rek = async (id) => (await M('/rekening', { rekeningId: id })).body.rekening;

test('1. verboden is verboden, en geen bevestiging heft dat op', async () => {
  const r = await M('/rahul/doe', { handeling: 'medewerker.beoordelen',
    gegevens: { wie: 'iemand' }, waarom: 'Rahul wilde de dienst evalueren' });
  assert.equal(r.status, 200, 'de poging wordt netjes beantwoord');
  assert.equal(r.body.bon.stand, 'geweigerd');
  assert.equal(r.body.bon.laag, 'verboden');
  assert.match(r.body.bon.reden, /ranglijst/i, 'met de reden erbij: ' + r.body.bon.reden);

  const nee = await M('/rahul/bevestig', { bonId: r.body.bon.id });
  assert.equal(nee.status, 409, 'een manager kan het niet alsnog goedkeuren');
  assert.match(nee.body.error, /verboden/i);

  const alcohol = await M('/rahul/doe', { handeling: 'alcohol.negeren', gegevens: {} });
  assert.equal(alcohol.body.bon.stand, 'geweigerd');
});

test('2. een voorstel verandert niets; pas de bevestiging doet iets', async () => {
  const t = await tafel('R2', 100);
  const voor = await rek(t);
  assert.equal(voor.totalen.korting, 0, 'er staat nog geen korting op');

  const v = await M('/rahul/doe', { handeling: 'korting.toekennen',
    gegevens: { rekeningId: t, centen: 2500, reden: 'wachttijd goedgemaakt' },
    waarom: 'De gang stond 22 minuten over zijn serveermoment' });
  assert.equal(v.body.bon.stand, 'wacht', 'zonder grens vraagt elke korting een mens');
  assert.equal(v.body.bon.bevestigdDoor, null);

  const tussen = await rek(t);
  assert.equal(tussen.totalen.korting, 0, 'en er is werkelijk niets gebeurd');

  const ja = await M('/rahul/bevestig', { bonId: v.body.bon.id });
  assert.equal(ja.status, 200);
  assert.equal(ja.body.bon.stand, 'uitgevoerd');
  assert.equal(ja.body.bon.bevestigdDoor, naamM, 'de naam van de mens staat op de bon');
  const na = await rek(t);
  assert.equal(na.totalen.korting, 2500, 'nu pas staat de korting op de rekening');

  const nog = await M('/rahul/bevestig', { bonId: v.body.bon.id });
  assert.equal(nog.status, 409, 'twee keer bevestigen boekt geen twee kortingen');
  assert.equal((await rek(t)).totalen.korting, 2500);
});

test('3. bevestigen is manager-werk', async () => {
  const t = await tafel('R3', 80);
  const v = await M('/rahul/doe', { handeling: 'korting.toekennen',
    gegevens: { rekeningId: t, centen: 500, reden: 'vaste klant' } });
  const nee = await V('/rahul/bevestig', { bonId: v.body.bon.id });
  assert.ok(nee.status === 403 || nee.status === 401, 'de vloer bevestigt geen geldbesluit: ' + nee.status);
  assert.equal((await rek(t)).totalen.korting, 0, 'en er is niets geboekt');
});

test('4. een onbekende handeling is niet vrijgegeven', async () => {
  const r = await M('/rahul/doe', { handeling: 'iets.heel.nieuws', gegevens: {} });
  assert.equal(r.body.bon.laag, 'mensbevestigt', 'nooit "mag"');
  assert.equal(r.body.bon.stand, 'wacht');
  assert.equal(r.body.bon.bekend, false, 'en de bon zegt dat hij onbekend is');
  assert.match(r.body.bon.reden, /niet in het register/i);
});

test('5. de kortingsgrens is van de zaak en wordt nergens verzonnen', async () => {
  const zonder = (await M('/rahul/register', {})).body;
  assert.equal(zonder.kortingGrensCenten, null, 'er is geen standaardgrens');

  await M('/rahul/grens', { centen: 1000 });
  const t = await tafel('R5', 100);
  const klein = await M('/rahul/doe', { handeling: 'korting.toekennen',
    gegevens: { rekeningId: t, centen: 800, reden: 'kleine attentie' } });
  assert.equal(klein.body.bon.stand, 'uitgevoerd', 'binnen de grens mag Rahul zelf');
  assert.equal((await rek(t)).totalen.korting, 800);

  const groot = await M('/rahul/doe', { handeling: 'korting.toekennen',
    gegevens: { rekeningId: t, centen: 1001, reden: 'te veel' } });
  assert.equal(groot.body.bon.stand, 'wacht', 'een cent erboven vraagt een mens');
  assert.match(groot.body.bon.reden, /grens/i);
  assert.equal((await rek(t)).totalen.korting, 800, 'en er kwam niets bij');

  await M('/rahul/grens', { centen: null });
  assert.equal((await M('/rahul/register', {})).body.kortingGrensCenten, null, 'de grens is weer weg');
});

test('6. elke poging laat een bon na, met zijn reden, en niets wist ze', async () => {
  const b = await bonnen();
  assert.ok(b.aantal >= 7, 'alle pogingen hierboven staan erin: ' + b.aantal);
  assert.ok(b.geweigerd >= 2, 'inclusief de geweigerde');
  for (const bon of b.bonnen) {
    assert.ok(bon.reden && bon.reden.length > 10, '"' + bon.stand + '" staat nooit zonder waarom');
    assert.ok(bon.at, 'met een tijdstip');
    assert.ok(['geweigerd', 'wacht', 'uitgevoerd', 'mislukt'].includes(bon.stand), 'en een geldige stand');
  }
  /* Er is geen deur die een bon wist. Dat is een eigenschap van de code en niet
     van deze toets, maar hier wordt hij wel vastgehouden: komt er ooit zo'n
     deur, dan hoort deze regel te zakken. */
  const wis = await M('/rahul/bonnen/weg', { bonId: b.bonnen[0].id });
  assert.equal(wis.status, 404, 'er bestaat geen deur om een actiebon weg te halen');
});

test('7. een mislukte uitvoering zegt dat, en beweert niet dat het lukte', async () => {
  await M('/rahul/grens', { centen: 5000 });
  const r = await M('/rahul/doe', { handeling: 'korting.toekennen',
    gegevens: { rekeningId: 'bestaat-niet', centen: 100, reden: 'test' } });
  assert.equal(r.body.bon.stand, 'mislukt', 'geen "uitgevoerd" over iets dat niet gebeurde');
  assert.match(r.body.bon.uitkomst, /kennen we niet/);
  await M('/rahul/grens', { centen: null });
});
