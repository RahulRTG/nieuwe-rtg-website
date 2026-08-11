/* RTG Geldbeleid, fase 1 van GELD.md: regels met vier niveaus, potten
   (oormerken binnen het eigen tegoed) en het append-only actielog, getoetst
   over het routecontract heen -- de UI bouwt blind op deze routes, dus de
   toetsen praten er net zo blind tegen: alleen fetch met een
   Authorization-kop, nooit een token in een URL (huisregel).

   Elke toets hieronder is tegen een tijdelijk kapotgemaakte kern gezien
   zakken (LAT.md regel 2: een toets die je niet hebt zien zakken is geen
   toets); de geziene mutatie staat per toets in het commentaar.

   Draai los: node --experimental-sqlite --test test/geldbeleid.test.js */
const test = require('node:test');
const assert = require('node:assert/strict');
const { startServer, stop, binnenEenDag } = require('./helper');

let srv, base;

/* Status en lichaam samen terug: de foutpaden hieronder beweren een EXACTE
   statuscode, en een helper die alleen het lichaam geeft zou een 500 met een
   nette fouttekst stil laten doorgaan voor een geweigerde 400. */
const api = (pad, body, token) => fetch(base + pad, {
  method: 'POST',
  headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: 'Bearer ' + token } : {}) },
  body: JSON.stringify(body || {})
}).then(async r => ({ status: r.status, body: await r.json().catch(() => ({})) }));

/* Een piepklein geldig PNG'je: RTG Pay vraagt een rtg-lid eenmalig een
   paspoortfoto voordat de wallet opengaat. De toetsen lopen die poort gewoon
   af in plaats van hem te omzeilen -- een geldtoets die de identiteitscontrole
   overslaat, toetst een systeem dat niet bestaat (zie test/portemonnee.test.js). */
const MINI_PNG = 'data:image/png;base64,' +
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==';

/* Een VERS lid per toets: het geldbeleid leeft per codenaam, en een gedeeld
   lid zou de toetsen via potten en actielog aan elkaar vastknopen -- dan
   toetst de tweede stilzwijgend de restjes van de eerste. */
let teller = 0;
async function versLid() {
  const t = Date.now() + '-' + (teller++);
  const r = await api('/api/auth/register', {
    name: 'Beleid Toets', email: 'geldbeleid-' + t + '@toets.example',
    password: 'geheim123', geboortedatum: '1985-05-05', tier: 'rtg'
  });
  assert.ok(r.body.token, 'registreren hoort een token te geven, kreeg: ' + JSON.stringify(r.body).slice(0, 160));
  const kyc = await api('/api/verify/upload', { image: MINI_PNG }, r.body.token);
  assert.equal(kyc.status, 200, 'het paspoort hoort aangenomen te worden: ' + JSON.stringify(kyc.body).slice(0, 160));
  return r.body.token;
}

test.before(async () => { srv = await startServer({ env: { SMTP_URL: '' } }); base = srv.base; });
test.after(() => stop(srv));

/* 1a. De harde grens van GELD.md par. 3: geld verlaat het huis nooit
   autonoom, dus 'automatisch' bestaat uitsluitend voor de maandelijkse
   reservering binnen het eigen tegoed. Eerst de positieve kant, want zonder
   die zou een compleet kapotte route ook overal "geweigerd" opleveren en
   bewees de toets niets (LAT.md regel 9).

   MUTATIE GEZIEN ZAKKEN: de grendel in server/kern/geldbeleid/regels.js
   (niveau 'automatisch' buiten reserveer-maandelijks) op `false` gezet; deze
   toets zakte op "minimumbuffer-automatisch hoort een 400 te zijn" (kreeg
   200). Teruggedraaid, daarna groen. */
test("niveau 'automatisch' bestaat alleen voor reserveer-maandelijks; elke andere soort krijgt een nette fout", async () => {
  const tok = await versLid();
  const pot = await api('/api/geld/pot/zet', { naam: 'Jaarlasten', doelCenten: 120000 }, tok);
  assert.equal(pot.status, 200, 'een pot zetten hoort te lukken: ' + JSON.stringify(pot.body).slice(0, 160));
  const goed = await api('/api/geld/beleid/zet',
    { soort: 'reserveer-maandelijks', drempelCenten: 10000, niveau: 'automatisch', potId: pot.body.pot.id }, tok);
  assert.equal(goed.status, 200, 'automatisch op reserveer-maandelijks hoort juist te mogen: ' + JSON.stringify(goed.body).slice(0, 160));
  assert.equal(goed.body.regel.niveau, 'automatisch');

  for (const soort of ['minimumbuffer', 'maanddrempel', 'gift-bevestiging']) {
    const r = await api('/api/geld/beleid/zet', { soort, drempelCenten: 10000, niveau: 'automatisch' }, tok);
    assert.equal(r.status, 400, soort + '-automatisch hoort een 400 te zijn');
    assert.ok(r.body.error && !r.body.ok, soort + ': met een uitleg en zonder ok');
  }

  /* En de weigering liet niets achter: een half opgeslagen regel zou bij de
     volgende cockpit alsnog gaan handelen. */
  const b = await api('/api/geld/beleid', {}, tok);
  assert.deepEqual(b.body.regels.map(x => x.soort), ['reserveer-maandelijks'],
    'geweigerde regels horen nergens te staan');
});

/* 1b. Potten zijn oormerken op het ene echte saldo: reserveren verlaagt de
   vrije ruimte in de cockpit met precies het bedrag (rauw, in centen), en de
   nulgrens van een pot is hard -- meer vrijgeven dan er staat is een
   boekhoudleugen.

   MUTATIES GEZIEN ZAKKEN: (1) in server/kern/geldgraaf/index.js de aftrek
   `vrijNa = saldoCenten - pottenTotaal(...)` vervangen door `saldoCenten`;
   zakte op "precies het gereserveerde bedrag eraf" (100000 != 87655).
   (2) in server/kern/geldbeleid/potten.js de nulgrens `if (nieuw < 0)` op
   `if (false)`; zakte op "meer vrijgeven dan er staat is een 400" (kreeg
   200). Allebei teruggedraaid, daarna groen. */
test('potReserveer verlaagt vrijCenten met precies het bedrag, en een pot gaat nooit onder nul', async () => {
  const tok = await versLid();
  const laad = await api('/api/pay/oplaad', { centen: 100000, idem: 'gb-1b' }, tok);
  assert.equal(laad.status, 200, 'opladen hoort te lukken: ' + JSON.stringify(laad.body).slice(0, 160));
  const voor = (await api('/api/geld/cockpit', {}, tok)).body;
  assert.ok(voor.ok && Number.isInteger(voor.cijfers.vrijCenten), 'de cockpit staat en rekent in hele centen');

  const pot = (await api('/api/geld/pot/zet', { naam: 'Reisfonds', doelCenten: 500000 }, tok)).body.pot;
  const res1 = await api('/api/geld/pot/reserveer', { id: pot.id, centen: 12345 }, tok);
  assert.equal(res1.status, 200);
  assert.equal(res1.body.pot.standCenten, 12345, 'de pot draagt de reservering');
  const na = (await api('/api/geld/cockpit', {}, tok)).body;
  assert.equal(na.cijfers.vrijCenten, voor.cijfers.vrijCenten - 12345, 'precies het gereserveerde bedrag eraf');

  /* Een cent meer vrijgeven dan er staat: nette fout, en de stand verroert
     zich niet. */
  const teVeel = await api('/api/geld/pot/reserveer', { id: pot.id, centen: -12346 }, tok);
  assert.equal(teVeel.status, 400, 'meer vrijgeven dan er staat is een 400');
  assert.ok(teVeel.body.error, 'met een uitleg in gewone taal');
  const stand = (await api('/api/geld/beleid', {}, tok)).body.potten.find(p => p.id === pot.id);
  assert.equal(stand.standCenten, 12345, 'de pot bleef staan waar hij stond');

  // exact vrijgeven kan wel, en de cockpit komt terug op het oude getal
  assert.equal((await api('/api/geld/pot/reserveer', { id: pot.id, centen: -12345 }, tok)).body.pot.standCenten, 0);
  const terug = (await api('/api/geld/cockpit', {}, tok)).body;
  assert.equal(terug.cijfers.vrijCenten, voor.cijfers.vrijCenten, 'vrijgeven geeft de vrije ruimte terug');
});

/* 1c. Het actielog is append-only (GELD.md par. 5): er komt bij, er gaat
   nooit iets af of overheen. Zonder dat is de Waarom-knop een orakel.

   MUTATIE GEZIEN ZAKKEN: in server/kern/geldbeleid/actielog.js het
   bijschrijven (`rec.log.push(rij)`) vervangen door herschrijven van de
   laatste regel; zakte op "twee handelingen, twee regels erbij" (1 != 2).
   Teruggedraaid, daarna groen. */
test('het actielog is append-only: twee handelingen geven twee regels erbij en de eerdere blijft onveranderd', async () => {
  const tok = await versLid();
  const log0 = (await api('/api/geld/actielog', {}, tok)).body.log;
  assert.deepEqual(log0, [], 'een vers lid begint met een leeg log');

  const pot = (await api('/api/geld/pot/zet', { naam: 'Buffer', doelCenten: 100000 }, tok)).body.pot;
  const log1 = (await api('/api/geld/actielog', {}, tok)).body.log;
  assert.equal(log1.length, 1, 'de eerste handeling staat erin');
  /* Diepe kopie, want de volgende vergelijking moet een HERSCHREVEN regel
     kunnen betrappen; een referentie zou altijd gelijk blijven. */
  const eerste = JSON.parse(JSON.stringify(log1[0]));
  assert.equal(eerste.wie, 'lid', 'via de route handelt het lid, nooit rahul');

  const res = await api('/api/geld/pot/reserveer', { id: pot.id, centen: 5000 }, tok);
  assert.equal(res.status, 200);
  const log2 = (await api('/api/geld/actielog', {}, tok)).body.log;
  assert.equal(log2.length, 2, 'twee handelingen, twee regels erbij');
  // nieuwste eerst: de eerdere handeling is naar plaats twee geschoven, ongewijzigd
  assert.deepEqual(log2[1], eerste, 'de eerdere regel is onveranderd');
  assert.equal(log2[0].wie, 'lid');
  for (const rij of log2) {
    assert.deepEqual(Object.keys(rij).sort(), ['gegevens', 'tijd', 'waarom', 'wat', 'wie'],
      'elke logregel draagt het volledige verantwoordingsformaat');
    assert.ok(Array.isArray(rij.gegevens), 'gegevens is het controlespoor en hoort een lijst te zijn');
  }
});

/* 1d. De enige plek waar 'automatisch' echt iets doet: de maandelijkse
   reservering. Twee cockpit-aanroepen in dezelfde maand voeren hem EEN keer
   uit (idempotent), en het log schrijft hem op naam van rahul -- het log mag
   lid en rahul nooit door elkaar halen.

   binnenEenDag: de maandgrens zit in een kalenderdag, en een suite die over
   middernacht loopt mag hier geen vals alarm geven (zie test/helper.js).

   MUTATIES GEZIEN ZAKKEN: (1) in server/kern/geldbeleid/evalueer.js de
   maandgrendel `if (regel.laatst === m) continue;` weggehaald; zakte op "de
   tweede cockpit in dezelfde maand reserveert NIET nog eens" (40000 !=
   20000). (2) in server/kern/geldbeleid/potten.js de herkomst altijd 'lid'
   gemaakt; zakte op "precies een handeling van rahul" (0 != 1). Allebei
   teruggedraaid, daarna groen. */
test('reserveer-maandelijks op automatisch loopt een keer per maand en staat als rahul in het log', async () => {
  await binnenEenDag(async () => {
    /* Het verse lid ontstaat BINNEN de dagwacht: slaat de dag om, dan begint
       de herkansing met een schone pot in plaats van op een halve stand. */
    const tok = await versLid();
    const pot = (await api('/api/geld/pot/zet', { naam: 'Vaste lasten', doelCenten: 600000 }, tok)).body.pot;
    const regel = await api('/api/geld/beleid/zet',
      { soort: 'reserveer-maandelijks', drempelCenten: 20000, niveau: 'automatisch', potId: pot.id }, tok);
    assert.equal(regel.status, 200, 'de regel hoort gezet te worden: ' + JSON.stringify(regel.body).slice(0, 160));

    const c1 = await api('/api/geld/cockpit', {}, tok);
    assert.equal(c1.status, 200);
    const na1 = (await api('/api/geld/beleid', {}, tok)).body.potten.find(p => p.id === pot.id);
    assert.equal(na1.standCenten, 20000, 'de eerste cockpit voerde de maandreservering uit');

    const c2 = await api('/api/geld/cockpit', {}, tok);
    assert.equal(c2.status, 200);
    const na2 = (await api('/api/geld/beleid', {}, tok)).body.potten.find(p => p.id === pot.id);
    assert.equal(na2.standCenten, 20000, 'de tweede cockpit in dezelfde maand reserveert NIET nog eens');

    const log = (await api('/api/geld/actielog', {}, tok)).body.log;
    const vanRahul = log.filter(r => r.wie === 'rahul');
    assert.equal(vanRahul.length, 1, 'precies een handeling van rahul');
    assert.match(vanRahul[0].wat, /Gereserveerd in pot/, 'het log zegt wat er gebeurde');
    assert.ok(vanRahul[0].gegevens.some(g => g.includes('bedrag: 20000 centen')),
      'het controlespoor draagt het rauwe bedrag in centen: ' + JSON.stringify(vanRahul[0].gegevens));

    /* Wat automatisch liep staat in het log, nooit als uitzondering: een
       uitzondering met niveau 'automatisch' zou het lid iets voorleggen dat
       al gebeurd is. */
    for (const u of c2.body.uitzonderingen) assert.notEqual(u.niveau, 'automatisch');
  });
});
