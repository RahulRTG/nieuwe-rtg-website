/* RTG BIJSTAND OVER DE LIJN -- de hele keten, en de grens eromheen.

   De rekenregels staan in test/bijstand.test.js. Hier gaat het om de BEDRADING
   plus de twee dingen die alleen over de lijn te zien zijn:

   1. ER IS GEEN RTG-ROUTE DIE EEN SESSIE AANMAAKT. Dat is de belofte in zijn
      controleerbaarste vorm: aan de kantoorkant bestaat het pad niet.
   2. EEN ANDERE ORGANISATIE ZIET DE SESSIE NIET -- en krijgt een 404 en geen 403,
      want een 403 bevestigt dat hij bestaat.

   En de keten zelf: de klant vraagt, RTG betreedt, stelt voor, de klant keurt
   goed, RTG voert uit, RTG vraagt inhoud, de klant weigert, RTG sluit af met een
   verslag. Elke stap gaat door de echte routes.

   MUTATIES die zijn gedraaid en welke bewering erop zakte (LAT.md regel 2):
   - een `/api/command/bijstand/vraag` bijgebouwd die command.bijstand.vraag aanroept
     -> toets 1 ZAKT (RAAK). De rest zakt mee, en dat is geen te grove mutatie
        maar gedeelde staat: die route MAAKT dan een sessie voor deze organisatie,
        en daarna kan de klant er geen tweede openen. Toets 1 is degene die de
        regel draagt.
   - de org-controle uit /api/tenant/bijstand/dossier gehaald
     -> "een andere organisatie ziet de sessie niet" ZAKT (RAAK)
   - `s.status = 'ingetrokken'` uit trekIn() gehaald (de sessie loopt gewoon door)
     -> toets 9 ZAKT, en ALLEEN toets 9 (RAAK). Dat is de scherpst mogelijke
        uitslag: intrekken is het enige wat die toets draagt.
   - een `reden`-eis voor /api/tenant/bijstand/intrekken bijgebouwd
     -> toets 9 ZAKT, en alleen toets 9 (RAAK). Zonder uitleg kunnen intrekken is
        dus echt getoetst en geen zin in een commentaarregel.
   - de gedeelde-code-grendel uit bijstand-rtg.js/betreed gehaald
     -> toets 3 ZAKT (RAAK); 4, 5 en 7 zakken mee omdat de gedeelde code de
        sessie dan bezit en de eigenaar er niet meer bij kan.

   Draai los: node --experimental-sqlite --test test/bijstandketen.test.js */
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { startServer, stop } = require('./helper');

const TMP = fs.mkdtempSync(path.join(os.tmpdir(), 'rtg-bijstand-'));
const OFFICE = 'KANTOOR-BIJSTAND-1';
let srv, base, eigenaar, gedeeld;
let ruimte, beheer, tweede, tweedeBeheer;
let SESSIE;

function api(pad, body, token) {
  const h = { 'Content-Type': 'application/json' };
  if (token) h.Authorization = 'Bearer ' + token;
  return fetch(base + pad, { method: 'POST', headers: h, body: JSON.stringify(body || {}) })
    .then(async r => ({ status: r.status, body: await r.json().catch(() => ({})) }));
}
const klant = (pad, body) => api(pad, Object.assign({ werkruimte: ruimte, beheerToken: beheer }, body || {}));
const rtg = (pad, body) => api(pad, body, eigenaar);

test.before(async () => {
  srv = await startServer({ env: { SMTP_URL: '', RTG_DATA_DIR: TMP, OFFICE_CODE: OFFICE } });
  base = srv.base;
  /* De EIGENAAR logt met zijn eigen account in; dat is een herleidbare naam.
     Daarnaast de gedeelde kantoorcode, want die hoort juist geweigerd te worden. */
  eigenaar = (await api('/api/techniek/inloggen', { login: 'roellie.i@gmail.com', wachtwoord: 'Imran' })).body.token;
  assert.ok(eigenaar, 'de eigenaar komt binnen');
  gedeeld = (await api('/api/office/login', { code: OFFICE })).body.token;
  assert.ok(gedeeld, 'de gedeelde kantoorcode komt binnen');

  const a = await api('/api/bedrijf/werkruimte/maak', { naam: 'Hoshi Haarlem' });
  ruimte = a.body.werkruimte; beheer = a.body.beheerToken;
  const b = await api('/api/bedrijf/werkruimte/maak', { naam: 'Een andere klant' });
  tweede = b.body.werkruimte; tweedeBeheer = b.body.beheerToken;

  for (const [org, code] of [['O-HOSHI', ruimte], ['O-ANDER', tweede]]) {
    assert.equal((await api('/api/techniek/tenant', { org, naam: org }, eigenaar)).status, 200);
    assert.equal((await api('/api/techniek/tenant/bind', { org, soort: 'werkruimte', code }, eigenaar)).status, 200);
  }
});
test.after(() => { stop(srv && srv.child); try { fs.rmSync(TMP, { recursive: true, force: true }); } catch (e) {} });

test('1. er is geen RTG-route die een sessie aanmaakt', async () => {
  /* Niet "hij weigert" maar "hij bestaat niet". Een weigering is een instelling;
     een ontbrekend pad is de vorm. */
  for (const pad of ['/api/command/bijstand/vraag', '/api/command/bijstand/open',
                     '/api/command/bijstand/maak', '/api/command/bijstand/nieuw']) {
    const r = await rtg(pad, { org: 'O-HOSHI', niveau: 'herstellen', onderwerp: 'zomaar' });
    assert.equal(r.status, 404, 'POST ' + pad + ' bestaat wel (' + r.status + ')');
  }
  const nog = await rtg('/api/command/bijstand', {});
  assert.equal(nog.body.sessies.length, 0, 'er is uit het niets een sessie ontstaan');
  assert.equal(nog.body.tel.permanenteToegang, 0);
});

test('2. de klant nodigt uit, en ziet de vier niveaus voordat hij kiest', async () => {
  const n = await klant('/api/tenant/bijstand/niveaus');
  assert.equal(n.status, 200);
  assert.deepEqual(n.body.niveaus.map(x => x.id), ['kijken', 'meedenken', 'herstellen', 'nood']);
  assert.match(n.body.let, /verloopt vanzelf/);

  const zonder = await klant('/api/tenant/bijstand/vraag', { niveau: 'herstellen' });
  assert.equal(zonder.status, 400, 'een sessie zonder onderwerp ging gewoon open');

  const v = await klant('/api/tenant/bijstand/vraag', { niveau: 'herstellen', onderwerp: 'de kassakoppeling doet niets', minuten: 45 });
  assert.equal(v.status, 200, JSON.stringify(v.body).slice(0, 160));
  SESSIE = v.body.sessie.id;
  assert.equal(v.body.sessie.org, 'O-HOSHI');
  assert.equal(v.body.sessie.minuten, 45);
  assert.equal(v.body.sessie.inhoudOpen, false, 'de inhoud stond meteen open');
});

test('3. een gedeelde kantoorcode betreedt geen klantomgeving', async () => {
  const r = await api('/api/command/bijstand/betreed', { id: SESSIE }, gedeeld);
  assert.equal(r.status, 403);
  assert.match(r.body.error, /eigen RTG-account/);
  const d = await rtg('/api/command/bijstand/sessie', { id: SESSIE });
  assert.equal(d.body.sessie.medewerker, null, 'er is toch iemand binnengelaten');
});

test('4. de keten loopt, en de klant leest hem live mee', async () => {
  const b = await rtg('/api/command/bijstand/betreed', { id: SESSIE });
  assert.equal(b.status, 200);
  assert.ok(String(b.body.sessie.medewerker).startsWith('user-'), 'de medewerker heeft geen herleidbare naam');

  const kijk = await rtg('/api/command/bijstand/kijk', { id: SESSIE, wat: 'stand' });
  assert.equal(kijk.status, 200);
  assert.equal(kijk.body.diagnose.stand.org, 'O-HOSHI');
  assert.ok(kijk.body.diagnose.nooit.length >= 3, 'de diagnose zegt niet wat hij nooit toont');

  const v = await rtg('/api/command/bijstand/voorstel', { id: SESSIE, wat: 'de kassakoppeling opnieuw opbouwen', waarom: 'de sessie is weg' });
  assert.equal(v.status, 200);
  assert.equal(v.body.sessie.handelingenLijst[0].status, 'voorgesteld');

  /* De klant ziet het voorstel EN het spoor, zonder dat iemand hem iets stuurt. */
  const bij = await klant('/api/tenant/bijstand/dossier', { id: SESSIE });
  assert.equal(bij.status, 200);
  assert.equal(bij.body.sessie.wachtOpAkkoord, 1);
  const spoor = bij.body.sessie.spoor.map(x => x.wat).join(' | ');
  assert.match(spoor, /stelt voor/, 'het spoor toont het voorstel niet: ' + spoor);
  assert.match(spoor, /bekeek de stand van de organisatie/, 'het spoor zegt niet wat er is bekeken');

  assert.equal((await rtg('/api/command/bijstand/uitvoeren', { id: SESSIE, index: 0, uitslag: 'x' })).status, 403,
    'er is uitgevoerd zonder akkoord van de klant');
  assert.equal((await klant('/api/tenant/bijstand/besluit', { id: SESSIE, index: 0, akkoord: true })).status, 200);
  const u = await rtg('/api/command/bijstand/uitvoeren', { id: SESSIE, index: 0, uitslag: '82 van 82 verwerkt' });
  assert.equal(u.status, 200);
  assert.equal(u.body.sessie.handelingenLijst[0].status, 'uitgevoerd');
});

test('5. inhoud gaat alleen open als de klant dat zegt', async () => {
  assert.equal((await rtg('/api/command/bijstand/inhoud', { id: SESSIE, reden: 'kort' })).status, 400, 'inhoud gevraagd zonder reden');
  const vr = await rtg('/api/command/bijstand/inhoud', { id: SESSIE, reden: 'ik moet zien welke groep aan welke rol hangt' });
  assert.equal(vr.status, 200);
  assert.equal(vr.body.sessie.inhoud.open, false, 'een verzoek opende de inhoud zelf al');

  const dicht = await rtg('/api/command/bijstand/kijk', { id: SESSIE, wat: 'inrichting' });
  assert.equal(dicht.body.diagnose.inrichting.dicht, true, 'de inrichting lag open zonder akkoord');

  assert.equal((await klant('/api/tenant/bijstand/inhoud', { id: SESSIE, akkoord: false })).status, 200);
  const nog = await rtg('/api/command/bijstand/kijk', { id: SESSIE, wat: 'inrichting' });
  assert.equal(nog.body.diagnose.inrichting.dicht, true, 'na een NEE ging de inrichting toch open');
});

test('6. een andere organisatie ziet de sessie niet', async () => {
  const ander = await api('/api/tenant/bijstand/dossier',
    { werkruimte: tweede, beheerToken: tweedeBeheer, id: SESSIE });
  assert.equal(ander.status, 404, 'de buurman kon het dossier openen (' + ander.status + ')');
  const lijst = await api('/api/tenant/bijstand', { werkruimte: tweede, beheerToken: tweedeBeheer });
  assert.equal(lijst.body.sessies.length, 0, 'de buurman ziet de sessie in zijn lijst staan');
});

test('7. afsluiten vraagt een verslag, en dat verslag is van de klant', async () => {
  assert.equal((await rtg('/api/command/bijstand/sluit', { id: SESSIE, verslag: 'klaar' })).status, 400);
  const s = await rtg('/api/command/bijstand/sluit', { id: SESSIE,
    verslag: 'De sessie van de kassakoppeling was verlopen; opnieuw opgebouwd en 82 transacties verwerkt.' });
  assert.equal(s.status, 200);
  assert.equal(s.body.sessie.status, 'gesloten');
  assert.equal(s.body.sessie.verslag.uitgevoerd, 1);
  assert.equal(s.body.sessie.verslag.inhoudGeopend, false, 'het verslag beweert dat de inhoud open stond');

  const bij = await klant('/api/tenant/bijstand/dossier', { id: SESSIE });
  assert.equal(bij.body.sessie.verslag.uitgevoerd, 1, 'de klant ziet het verslag niet');
  /* En daarna is er geen toegang meer, zonder dat iemand iets heeft ingetrokken. */
  assert.equal((await rtg('/api/command/bijstand/kijk', { id: SESSIE, wat: 'stand' })).status, 409);
});

test('8. het vlootbeeld toont de organisatie en houdt daar op', async () => {
  const v = await api('/api/command/vloot', {}, eigenaar);
  assert.equal(v.status, 200);
  assert.ok(v.body.tel.organisaties >= 2, 'de vloot telt de organisaties niet');
  assert.ok(v.body.nietTeZien.length >= 3);
  const o = await api('/api/command/vloot/organisatie', { org: 'O-HOSHI' }, eigenaar);
  assert.equal(o.status, 200);
  assert.deepEqual(o.body.werkruimtes, [ruimte]);
  assert.equal(o.body.dieper.mag, false, 'het vlootbeeld kijkt dieper dan de uitnodiging');
  assert.equal(o.body.sessies.length, 1, 'de afgesloten sessie staat niet in de geschiedenis');
  assert.equal((await api('/api/command/vloot/organisatie', { org: 'BESTAATNIET' }, eigenaar)).status, 404);
});

test('9. de klant neemt de uitnodiging terug, en RTG staat meteen buiten', async () => {
  /* De scherpste vorm van "toegang is een uitnodiging en geen recht": niet
     wachten tot de klok hem sluit, maar hem MIDDEN in de sessie terugnemen.
     En dat mag zonder uitleg -- een uitnodiging die je niet zonder reden kunt
     intrekken, is een recht met een wachttijd. */
  const v = await klant('/api/tenant/bijstand/vraag',
    { niveau: 'kijken', onderwerp: 'de urenlijst telt dubbel' });
  const tweedeSessie = v.body.sessie.id;
  assert.equal(v.status, 200, JSON.stringify(v.body).slice(0, 160));

  assert.equal((await rtg('/api/command/bijstand/betreed', { id: tweedeSessie })).status, 200);
  assert.equal((await rtg('/api/command/bijstand/kijk', { id: tweedeSessie, wat: 'stand' })).status, 200);

  const weg = await klant('/api/tenant/bijstand/intrekken', { id: tweedeSessie });
  assert.equal(weg.status, 200, 'intrekken vroeg iets wat de klant niet meestuurde');
  assert.equal(weg.body.sessie.status, 'ingetrokken');

  /* Geen 403 die zegt "mag niet meer" maar een sessie die niet meer loopt. */
  const na = await rtg('/api/command/bijstand/kijk', { id: tweedeSessie, wat: 'stand' });
  assert.equal(na.status, 409, 'RTG keek na het intrekken gewoon door (' + na.status + ')');

  const dos = await klant('/api/tenant/bijstand/dossier', { id: tweedeSessie });
  assert.equal(dos.body.sessie.status, 'ingetrokken');
  assert.ok(dos.body.sessie.spoor.some(r => /trok de toegang in/.test(r.wat)),
    'het intrekken staat niet in het spoor: ' + JSON.stringify(dos.body.sessie.spoor));
});
