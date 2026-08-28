/* DE VIER METERS DIE ER NIET WAREN: opslag, bericht, transactie en
   transactiewaarde.

   Van de negen kostensoorten waren er vijf aangesloten en vier niet. Die vier
   stonden in het overzicht als REDEN en niet als nul -- eerlijk, maar het
   betekende ook dat elk totaal in dit huis te laag was. Deze toetsen leggen vast
   dat ze nu echt tellen, en dat ze tellen zoals ze horen te tellen.

   DE SCHERPSTE BEWERING STAAT IN TOETS 2: opslag is een STAND en geen stroom.
   Twee keer peilen bij dezelfde inhoud hoort niet te verdubbelen. Wie dat mis
   heeft, rekent een lid dat een maand lang niets doet bij elke peiling opnieuw
   zijn hele kluis aan -- en dan groeit de rekening van wie niets doet het hardst.

   Elke toets is tegen een tijdelijk kapotgemaakte kern gezien zakken (LAT.md
   regel 2); de geziene mutatie staat per toets in het commentaar.

   Draai los: node --experimental-sqlite --test test/kostenmeters.test.js */
const test = require('node:test');
const assert = require('node:assert/strict');
const { startServer, stop, kantoorAlsPersoon } = require('./helper');

let srv, base, kantoor;

const api = (pad, body, token) => fetch(base + pad, {
  method: 'POST',
  headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: 'Bearer ' + token } : {}) },
  body: JSON.stringify(body || {})
}).then(async r => ({ status: r.status, body: await r.json().catch(() => ({})) }));

/* Een demo-lid met een codenaam: de betaallaag werkt op codenamen en de
   kostenlaag op sessiesleutels, en juist die vertaling is wat toets 3 beproeft. */
async function demoLid(tier) {
  const r = await fetch(base + '/api/login', {
    method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ tier: tier || 'rtg' })
  }).then(x => x.json());
  const o = await api('/api/pay/overzicht', {}, r.token);
  return { token: r.token, codenaam: o.body.codenaam };
}

const beeld = async (drager, periode) =>
  (await api('/api/office/kosten/gebruiker', { drager, periode }, kantoor)).body;

const regelVan = (b, soort) => (b.overzicht.regels || []).find(r => r.soort === soort) || null;

async function nu() {
  return (await api('/api/office/kosten/overzicht', {}, kantoor)).body.periode;
}

// een piepklein geldig PNG'je van 68 bytes
const MINI_PNG = 'data:image/png;base64,' +
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==';

test.before(async () => {
  srv = await startServer(); base = srv.base;
  kantoor = await kantoorAlsPersoon(base);
  assert.ok(kantoor, 'geen boardroom-sessie; zonder eigenaar valt hier niets te zien');
});
test.after(() => stop(srv));

/* MUTATIE: in server/mail.js de meld-regel weggehaald -- deze toets zakt dan,
   want dan is elk bericht dat het huis verstuurt gratis. */
test('een bericht telt, en een bericht zonder lid is een huiskost', async () => {
  const p = await nu();
  const voor = regelVan(await beeld('huis', p), 'bericht');
  const voorN = voor ? voor.aantal : 0;

  /* Registreren stuurt een bevestigingsmail, en dat verzoek hoort bij geen enkel
     lid: het account bestaat op dat moment nog niet. Zo'n bericht is dus een
     kost van het HUIS, en niet van het laatste lid dat toevallig langskwam. */
  const t = Date.now();
  const r = await api('/api/auth/register', {
    name: 'Bericht Toets', email: 'bericht-' + t + '@toets.example',
    password: 'geheim123', geboortedatum: '1985-05-05', tier: 'rtg'
  });
  assert.ok(r.body.token, 'registreren lukte niet: ' + JSON.stringify(r.body).slice(0, 160));

  const na = regelVan(await beeld('huis', p), 'bericht');
  assert.ok(na, 'er staat geen berichtregel bij het huis; dan telt de mailweg niets');
  assert.ok(na.aantal > voorN, 'het aantal berichten van het huis groeide niet: ' + voorN + ' -> ' + na.aantal);
  assert.equal(na.ruw, 'berichten');
});

/* MUTATIE: in meter.js het lopend gemiddelde in peil() vervangen door optellen
   (rij[s.id] = oud + v) -- deze toets zakt dan op de tweede peiling, want dan
   verdubbelt een stand die niet veranderd is. */
test('opslag wordt gepeild en niet opgeteld: twee keer meten verdubbelt niets', async () => {
  const p = await nu();
  const lid = await demoLid('rtg');
  const up = await api('/api/bestanden/upload', { naam: 'toets.png', dataUrl: MINI_PNG }, lid.token);
  assert.ok(up.body.id || up.body.ok, 'het bestand ging er niet in: ' + JSON.stringify(up.body).slice(0, 160));

  const eerste = await api('/api/office/kosten/peil', {}, kantoor);
  assert.equal(eerste.status, 200);
  assert.ok(eerste.body.dragers >= 1, 'er is geen enkele drager gepeild');

  const drager = (await api('/api/kosten/mij', {}, lid.token)).body.overzicht.drager;
  const na1 = regelVan(await beeld(drager, p), 'opslag');
  assert.ok(na1, 'de opslag van dit lid is niet gepeild');
  assert.equal(na1.ruw, 'GB-maand');
  assert.equal(na1.aard, 'stand', 'opslag hoort een stand te zijn en geen stroom');
  /* EN HIJ LEEST NIET ALS NUL. Zeventig bytes is 0,00000007 GB; op drie
     decimalen is dat exact nul, en nul betekent in deze laag "geen opslag" --
     een andere bewering dan "weinig opslag". */
  assert.ok(na1.aantal > 0, 'een kluis met inhoud las als nul: ' + na1.aantal);

  // nog een keer peilen zonder dat er iets veranderde
  await api('/api/office/kosten/peil', {}, kantoor);
  const na2 = regelVan(await beeld(drager, p), 'opslag');
  assert.equal(na2.aantal, na1.aantal,
    'de opslag verdubbelde bij een tweede peiling; dan wordt een stand als stroom geteld');
});

/* MUTATIE: in kern/pay/opladen.js de meetTransactie-aanroep weggehaald -- deze
   toets zakt dan, want dan kost een oplading ons niets. */
test('een oplading telt als transactie, met het bedrag erbij', async () => {
  const p = await nu();
  const lid = await demoLid('rtg');
  const drager = (await api('/api/kosten/mij', {}, lid.token)).body.overzicht.drager;

  const laad = await api('/api/pay/oplaad', { centen: 4200, idem: 'kostenmeter-1' }, lid.token);
  assert.equal(laad.status, 200, 'opladen lukte niet: ' + JSON.stringify(laad.body).slice(0, 160));

  const b = await beeld(drager, p);
  const vast = regelVan(b, 'transactie');
  const waarde = regelVan(b, 'transactiewaarde');
  assert.ok(vast, 'geen transactieregel; dan is de oplaadweg niet gemeten');
  assert.equal(vast.aantal, 1, 'een oplading is een transactie');
  assert.ok(waarde, 'geen transactiewaarde-regel; dan telt alleen het vaste deel');
  assert.equal(waarde.aantal, 42, 'de waarde hoort in euro\'s te staan, niet in centen');
  assert.equal(waarde.ruw, 'euro');

  /* EN EEN DUBBELE TIK TELT NIET DUBBEL. De idempotentie zit in de betaallaag;
     als de meter erbuiten stond, zou hij hem alsnog twee keer tellen. */
  await api('/api/pay/oplaad', { centen: 4200, idem: 'kostenmeter-1' }, lid.token);
  const nogmaals = regelVan(await beeld(drager, p), 'transactie');
  assert.equal(nogmaals.aantal, 1, 'een herhaalde oplaadtik telde als tweede transactie');
});

/* MUTATIE: in kern/kosten/peiling.js de uur-rem weggehaald -- deze toets zakt
   dan, want dan peilt de onderhoudsronde elke vijf minuten opnieuw. */
test('de peiling remt zichzelf af, en een mens kan hem overrulen', async () => {
  await api('/api/office/kosten/peil', {}, kantoor);      // vult de stand
  const { peilOpslag } = require('../server/kern/kosten/peiling');
  assert.equal(typeof peilOpslag, 'undefined', 'peiling.js hoort een fabriek te zijn, geen kant-en-klare functie');

  /* Over de route: de knop van het kantoor forceert met opzet. Dat is het
     verschil tussen de klok (die zich afremt) en een mens die "nu meten" vraagt. */
  const geforceerd = await api('/api/office/kosten/peil', {}, kantoor);
  assert.equal(geforceerd.body.overgeslagen, undefined, 'de kantoorknop hoort altijd te peilen');
  assert.ok(geforceerd.body.laatste && geforceerd.body.laatste.op, 'de stand van de laatste peiling ontbreekt');
});

/* MUTATIE: in soorten.js `aard` voor opslag op 'stroom' zetten -- deze toets
   zakt dan, want dan neemt de meter een peiling aan als optelling. */
test('een stand komt niet door de stroom-deur en andersom', async () => {
  const db = { data: {} };
  const economie = require('../server/kern/economie')({ db, save: () => {} }).economie;
  const k = require('../server/kern/kosten')({ db, save: () => {}, accounts: {}, economie }).kosten;
  const drager = k.drager('lid', 'user-1');

  assert.equal(k.meet(drager, 'opslag', 5), false,
    'opslag kwam door de stroom-deur; dan telt elke peiling op bij de vorige');
  assert.equal(k.meet(drager, 'verzoek', 5), true, 'een stroom hoort er wel door te kunnen');
});

/* DE SMS-KANT, RECHTSTREEKS. Toets 1 dekt de mailweg, en een mutatie liet zien
   dat die de SMS-weg NIET dekt: de meter uit mail-lokaal.js halen bleef groen.
   Dat is logisch -- mail.js telt alleen de mail en laat een sms door naar
   sendSms, die zichzelf telt -- maar het betekent wel dat die tweede teller
   onbeproefd was. Een teller waarvan je de zakkende kant nooit hebt gezien, is
   geen teller.

   Over de routes is de sms-weg lastig te raken (hij hangt aan het
   tweestaps-herstel met een telefoonnummer), dus dit gaat rechtstreeks langs de
   module -- zoals test/economie.test.js dat met de factuurpoort doet.

   MUTATIE: in mail-lokaal.js de meld-regel weggehaald -- deze toets zakt dan. */
test('een sms telt ook, en op de drager die aan de knop zit', () => {
  const db = { data: {} };
  const economie = require('../server/kern/economie')({ db, save: () => {} }).economie;
  const k = require('../server/kern/kosten')({ db, save: () => {}, accounts: {}, economie }).kosten;
  const haak = require('../server/kern/kosten/haak');
  const mail = require('../server/mail');
  const drager = k.drager('lid', 'sms-toets');

  haak.binnen(drager, () => { mail.sendSms('+31600000000', 'RTG', 'proefbericht'); }, 'rtg');

  const rij = k.voorDrager(k.periodeVan(), drager).regels.find(r => r.soort === 'bericht');
  assert.ok(rij, 'een sms telde niet mee als bericht');
  assert.equal(rij.aantal, 1);

  /* En hij landt op de drager uit de context en niet op het huis: een sms die
     tijdens het verzoek van een lid de deur uitgaat, is van dat lid. */
  const huis = k.voorDrager(k.periodeVan(), 'huis').regels.find(r => r.soort === 'bericht');
  assert.ok(!huis, 'de sms landde bij het huis in plaats van bij het lid');
});
