/* ============================================================================
   EEN BETAALVERZOEK INTREKKEN -- 2 endpoints, aan beide kanten van het huis.

   De dekkingsmeting wees /api/pay/verzoek/intrek (lid vraagt een vriend) en
   /api/supplier/betaalverzoek/intrek (zaak vraagt een klant) aan als nooit
   aangeroepen. Maken en betalen was wel beproefd; intrekken niet. Dat is de
   knop die je gebruikt als je je vergist hebt, en dus juist de knop waar het
   pijnlijk wordt als hij niet klopt.

   WAT ER OP HET SPEL STAAT

   - INGETROKKEN IS DICHT. Zou een ingetrokken verzoek nog te betalen zijn,
     dan haalt het systeem geld op voor iets wat de aanvrager heeft
     teruggenomen. Dat is de enige bewering hier die echt over geld gaat, en
     hij staat in toets 2.
   - INTREKKEN DOET DE AANVRAGER. Niet de gevraagde -- die betaalt of laat het
     staan, maar hij haalt geen verzoek van tafel dat niet van hem is. En niet
     de buurzaak.
   - WAT BETAALD IS, IS BETAALD. Een betaald verzoek intrekken is geen
     terugbetaling; dat zou een storting zijn die niemand goedkeurde. 409.

   Draai los: node --experimental-sqlite --test test/verzoek-intrekken.test.js
   ========================================================================== */
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { startServer, stop } = require('./helper');

let srv, base, vrager, vriend, zaak, buurzaak, klant;
let openId = null, betaaldId = null, ref = null;
const TMP = fs.mkdtempSync(path.join(os.tmpdir(), 'rtg-intrek-'));

function api(pad, body, token) {
  const h = { 'Content-Type': 'application/json' };
  if (token) h.Authorization = 'Bearer ' + token;
  return fetch(base + pad, { method: 'POST', headers: h, body: JSON.stringify(body || {}) })
    .then(async r => ({ status: r.status, body: await r.json().catch(() => ({})) }));
}
let n = 0;
async function nieuwLid(naam, tier) {
  const u = Date.now().toString(36) + (n++) + Math.random().toString(36).slice(2, 6);
  const r = await api('/api/auth/register', { name: naam, email: u + '@voorbeeld.test',
    phone: '06' + u.replace(/\D/g, '').padEnd(8, '1').slice(0, 8),
    password: 'intrekgeheim1', geboortedatum: '1986-06-06', tier: tier || 'rtg', pasApp: tier || 'rtg' });
  assert.equal(r.status, 200, 'registreren: ' + JSON.stringify(r.body));
  const st = await api('/api/state', {}, r.body.token);
  return { token: r.body.token, codenaam: st.body.state.user.codename };
}
/* Een demo-sessie: /api/login geeft een pas zonder registratie. Voor de
   BETALER is dat het verschil tussen wel en niet door de KYC-poort komen --
   zie de opmerking in test.before hieronder. */
async function demoLid(tier) {
  const r = await api('/api/login', { tier });
  const o = await api('/api/pay/overzicht', {}, r.body.token);
  return { token: r.body.token, codenaam: o.body.codenaam };
}
async function inlog(code, rol) {
  const roster = await api('/api/supplier/roster', { code });
  const wie = roster.body.staff.find(x => x.role === rol);
  return (await api('/api/supplier/login', { code, staffId: wie.id, pin: rol === 'manager' ? '1234' : '5678' })).body.token;
}

test.before(async () => {
  /* RTG_DEMO=1, en dat is geen slordigheid maar wat deze toets nodig heeft:
     demoLid() logt in met /api/login (dat is de demo-deur, zie de opmerking
     daar) en inlog() heeft de demo-zaken KIKUNOI en HOSHI nodig.

     Hier stond RTG_DEMO='0'. Dat werkte zolang de demo-vlag in routes/auth.js
     op `!PRODUCTION` stond -- een fout die inmiddels is gerepareerd: met de
     demostand uit gaf POST /api/login {"tier":"business"} nog een volledige
     sessie. Die reparatie was terecht en deze toets is er stil op stukgelopen:
     de rooster-aanroep gaf undefined en elke toets viel om in de before-haak.
     Demo AAN zetten is hier dus het herstel, niet het verzwakken -- wat deze
     toets bewaakt (wie een betaalverzoek mag intrekken) staat er los van. */
  srv = await startServer({ env: { SMTP_URL: '', RTG_DATA_DIR: TMP, RTG_DEMO: '1' } });
  base = srv.base;
  vrager = await nieuwLid('De Vrager');
  /* De betaler is een Lifestyle-pas. Niet uit luxe: de KYC-poort van RTG Pay
     staat VOOR de statuscontrole, dus een RTG Pass-lid dat zijn paspoort nog
     niet liet bevestigen krijgt 403 en bereikt de vraag "is dit verzoek nog
     open?" nooit. De klant hieronder is wel zo'n lid, en bewijst in toets 2
     die eerste laag; de vriend bewijst de tweede. */
  vriend = await demoLid('lifestyle');
  klant = await nieuwLid('De Klant');
  zaak = await inlog('KIKUNOI', 'manager');
  buurzaak = await inlog('HOSHI', 'manager');
  assert.ok(vrager.codenaam && vriend.codenaam && zaak && buurzaak, 'iedereen staat klaar');
});
test.after(() => {
  stop(srv && srv.child);
  try { fs.rmSync(TMP, { recursive: true, force: true }); } catch (e) {}
});

test('1. een Klompje trekt de aanvrager in, en niemand anders', async () => {
  const mk = await api('/api/pay/verzoek', { aan: [vriend.codenaam], perCenten: 1250, oms: 'Het etentje' }, vrager.token);
  assert.equal(mk.status, 200, JSON.stringify(mk.body));
  openId = mk.body.verzoeken[0].id;
  assert.equal(mk.body.verzoeken[0].status, 'open');

  /* De GEVRAAGDE mag niet intrekken. Hij kan betalen of het laten staan, maar
     een verzoek van tafel halen dat niet van hem is, is de schuld van een
     ander wegdrukken. 404 en niet 403: buiten je eigen verzoeken bestaat dit
     id niet. */
  assert.equal((await api('/api/pay/verzoek/intrek', { id: openId }, vriend.token)).status, 404,
    'de gevraagde trekt het verzoek niet in');
  assert.equal((await api('/api/pay/verzoek/intrek', { id: openId }, klant.token)).status, 404,
    'een willekeurig ander lid al helemaal niet');
  assert.equal((await api('/api/pay/verzoek/intrek', { id: 'TKbestaatniet' }, vrager.token)).status, 404);

  const weg = await api('/api/pay/verzoek/intrek', { id: openId }, vrager.token);
  assert.equal(weg.status, 200, JSON.stringify(weg.body));
  assert.equal((await api('/api/pay/verzoek/intrek', { id: openId }, vrager.token)).status, 409,
    'twee keer intrekken is geen tweede handeling');
});

test('2. een ingetrokken verzoek is niet meer te betalen', async () => {
  /* De bewering die over geld gaat. Zou dit lukken, dan haalt het systeem geld
     op voor iets wat de aanvrager heeft teruggenomen -- en dan is intrekken
     niets waard. */
  /* Twee lagen, in deze volgorde. Eerst de KYC-poort: een RTG Pass-lid dat
     zijn paspoort nog niet liet bevestigen betaalt helemaal niets, en komt bij
     de statuscontrole niet eens in de buurt. */
  const ongeverifieerd = await api('/api/pay/verzoek/betaal', { id: openId }, klant.token);
  assert.equal(ongeverifieerd.status, 403, 'de KYC-poort staat ervoor');
  assert.equal(ongeverifieerd.body.kyc, true, 'en zegt eerlijk waar het op vastloopt');

  // en dan de bewering die over geld gaat, bij iemand die de poort wel passeert
  const poging = await api('/api/pay/verzoek/betaal', { id: openId }, vriend.token);
  assert.equal(poging.status, 409, 'betalen na intrekken: ' + JSON.stringify(poging.body));

  // het verzoek staat ook niet meer open in het overzicht van de gevraagde
  const ov = await api('/api/pay/overzicht', {}, vriend.token);
  const lijst = [].concat(ov.body.teBetalen || [], ov.body.verzoeken || [], ov.body.open || []);
  assert.ok(!lijst.some(v => v && v.id === openId && v.status === 'open'),
    'en hij staat niet meer als open op zijn scherm');
});

test('3. wat betaald is, is betaald: intrekken is geen terugbetaling', async () => {
  const mk = await api('/api/pay/verzoek', { aan: [vriend.codenaam], perCenten: 500, oms: 'De koffie' }, vrager.token);
  betaaldId = mk.body.verzoeken[0].id;

  const bet = await api('/api/pay/verzoek/betaal', { id: betaaldId, idem: 'koffie1' }, vriend.token);
  assert.equal(bet.status, 200, 'de vriend betaalt: ' + JSON.stringify(bet.body));

  const terug = await api('/api/pay/verzoek/intrek', { id: betaaldId }, vrager.token);
  assert.equal(terug.status, 409, 'een betaald verzoek intrekken zou een storting zijn die niemand goedkeurde');
});

test('4. de zaakkant: intrekken is van de eigen zaak', async () => {
  const mk = await api('/api/supplier/betaalverzoek',
    { codename: klant.codenaam, centen: 4500, omschrijving: 'Aanbetaling tafel' }, zaak);
  assert.equal(mk.status, 200, JSON.stringify(mk.body));
  ref = mk.body.verzoek ? mk.body.verzoek.ref : mk.body.ref;
  assert.ok(ref, 'het verzoek heeft een kenmerk');

  assert.equal((await api('/api/supplier/betaalverzoek/intrek', { ref }, buurzaak)).status, 404,
    'het verzoek van een andere zaak bestaat hier niet');
  assert.equal((await api('/api/supplier/betaalverzoek/intrek', { ref: 'BESTAATNIET' }, zaak)).status, 404);
  assert.equal((await api('/api/supplier/betaalverzoek/intrek', {}, zaak)).status, 404, 'zonder kenmerk valt er niets in te trekken');

  const weg = await api('/api/supplier/betaalverzoek/intrek', { ref }, zaak);
  assert.equal(weg.status, 200, JSON.stringify(weg.body));
  assert.equal((await api('/api/supplier/betaalverzoek/intrek', { ref }, zaak)).status, 409,
    'alleen een open verzoek kan ingetrokken worden');

  const ont = await api('/api/supplier/ontvangsten', {}, zaak);
  assert.ok(!(ont.body.openVerzoeken || []).some(v => v.ref === ref),
    'en hij staat niet meer bij de openstaande verzoeken van de zaak');
});
