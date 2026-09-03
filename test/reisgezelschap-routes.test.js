/* ============================================================================
   HET REISGEZELSCHAP OVER DE DRAAD -- de twaalf routes uit server/routes/reis.js.

   WAAROM DIT BESTAND NAAST test/reisgezelschap.test.js STAAT. Dat bestand
   toetst de MODULE: het geeft kern/reisgezelschap.js een db en een verzonnen
   reis mee en rekent de witte lijst van de poort na. Wat het niet ziet is de
   deur, de sessie, en of een tweede LID werkelijk iets anders terugkrijgt dan
   de reiziger zelf -- want daar heeft het maar een `key`-string voor. De
   dekkingspoort van de samenvoeging zag deze twaalf paden daarom als
   onaangeraakt: het routejournaal telt wat de server zelf heeft gematcht.

   Hier lopen er dus echte mensen doorheen. Vier verse leden, een reis die langs
   de kantoorbalie is klaargezet en door de reiziger is opgeeist, en daarna het
   hele gezelschap: uitnodigen, aanvaarden, weigeren, kijken, schrijven, melden,
   delen en eruit halen.

   DE SCHERPSTE BEWERING STAAT IN TOETS 3, en die komt uit LIFE.md par. 4: wat
   een TWEEDE PERSOON bereikt wordt samengesteld en klaargezet, maar nooit
   automatisch bevestigd. Een uitnodiging die zichzelf aanvaardt is precies wat
   een toets hier hoort te betrappen -- vandaar dat er na het uitnodigen vier
   keer wordt gevraagd of de uitgenodigde al iets ziet, en dat de UITNODIGER
   zelf probeert te antwoorden namens de ander.

   Draai los: node --test test/reisgezelschap-routes.test.js */
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { startServer, stop } = require('./helper');

const TMP = fs.mkdtempSync(path.join(os.tmpdir(), 'rtg-reisgezelschap-'));
const dag = (n) => { const x = new Date(); x.setDate(x.getDate() + n); return x.toISOString().slice(0, 10); };

let srv, base, kantoor;
/* A is de reiziger, B reist mee, C kijkt mee, D hoort er niet bij en weigert
   zijn uitnodiging. Elk met zijn echte voornaam in de kluis en zijn codenaam
   erbuiten -- die twee moeten in de antwoorden nooit samen voorkomen. */
let A, B, C, D;
let REIS = null, UITNODIGING_B = null, UITNODIGING_C = null, BESTAND = null;

const api = (pad, body, token) => fetch(base + pad, {
  method: 'POST',
  headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: 'Bearer ' + token } : {}) },
  body: JSON.stringify(body || {})
}).then(async r => ({ status: r.status, body: await r.json().catch(() => ({})) }));

/* Alle twaalf paden op een rij; de deurtoets loopt ze af en de kop van dit
   bestand blijft zo eerlijk over wat er gedekt is. */
const PADEN = ['/api/reis/gezelschap', '/api/reis/gezelschap/nodig-uit', '/api/reis/gezelschap/antwoord',
  '/api/reis/gezelschap/weg', '/api/reis/gezelschap/kring', '/api/reis/gezelschap/reis',
  '/api/reis/gezelschap/tijdlijn', '/api/reis/gezelschap/schrijf', '/api/reis/gezelschap/beleid',
  '/api/reis/gezelschap/beleid/zet', '/api/reis/gezelschap/beeld', '/api/reis/gezelschap/aangekomen'];

async function nieuwLid(naam) {
  const u = naam + Date.now().toString().slice(-6);
  const r = await api('/api/auth/register', { name: naam, email: u + '@x.nl',
    phone: '06' + u.replace(/\D/g, '').slice(-8), password: 'geheim123', geboortedatum: '1990-01-01' });
  assert.equal(r.status, 200, naam + ' kon zich niet aanmelden: ' + JSON.stringify(r.body));
  /* DE CODENAAM WORDT NAGEKEKEN EN NIET AANGENOMEN, en dat staat hier omdat het
     een keer is misgegaan. Dit bestand nodigt mensen uit OP hun codenaam; komt
     die niet terug uit de aanmelding, dan is `codenaam` undefined en maakt
     schoon() in kern/reisgezelschap.js er een lege reeks van. De route zegt dan
     400 "Geef de codenaam van de persoon die u uitnodigt" -- twee toetsen
     verderop, bij het uitnodigen van Dirk, en die melding wijst naar het
     uitnodigen terwijl de aanmelding de oorzaak was (CI 2 september 2026,
     toets 4 en 7, allebei 400 !== 200). Een opstelling die stil doorloopt is
     erger dan een die zakt: nu zakt hij hier, met het antwoord van de server. */
  const codenaam = r.body && r.body.state && r.body.state.user && r.body.state.user.codename;
  assert.ok(codenaam, naam + ' kreeg geen codenaam terug bij de aanmelding: '
    + JSON.stringify(r.body).slice(0, 240));
  const lid = { naam, token: r.body.token, codenaam };
  /* Eén geauthenticeerd verzoek zet hem in de ledengids (kern/gids.js:
     dirTouch hangt aan de sessiepoort). Zonder die stap is hij voor
     `keyVanCodenaam` onvindbaar en zou toets 2 om de verkeerde reden slagen. */
  await api('/api/reis/gezelschap/kring', {}, lid.token);
  return lid;
}

test.before(async () => {
  srv = await startServer({ env: { SMTP_URL: '', RTG_DATA_DIR: TMP } });
  base = srv.base;
  const inlog = await api('/api/auth/login', { login: 'roellie.i@gmail.com', password: 'Imran', pasApp: 'business' });
  kantoor = inlog.body.token;
  assert.ok(kantoor, 'het kantoor logt niet in; zonder balie is er geen reis om klaar te zetten');

  A = await nieuwLid('Anna'); B = await nieuwLid('Bram');
  C = await nieuwLid('Cees'); D = await nieuwLid('Dirk');

  /* VIER VERSCHILLENDE CODENAMEN, en dat is een echte aanname van dit bestand
     en geen formaliteit. Uitnodigen gaat op codenaam, en keyVanCodenaam
     (kern/gids.js) geeft de EERSTE treffer terug. Delen twee van deze vier er
     een, dan wijst een uitnodiging naar de verkeerde mens en toetst de rest
     van dit bestand iets anders dan het beweert -- zonder dat er iets rood
     wordt. kluis.makeCodename() trekt uit 15 woorden plus twee bytes en
     controleert niet op uniciteit, dus zeldzaam is niet hetzelfde als
     onmogelijk. */
  const codenamen = [A, B, C, D].map(x => x.codenaam);
  assert.equal(new Set(codenamen).size, 4,
    'twee leden delen een codenaam, dus uitnodigen wijst naar de verkeerde: ' + codenamen.join(', '));

  /* DE REIS ONTSTAAT NIET HIER. Het gezelschap bezit geen reis -- hij leest er
     een uit kern/mijnReizen. Die weg loopt langs de kantoorbalie (een reis
     klaarzetten) en de reiziger die hem opeist; dat is de enige manier om een
     lid over de draad aan een echte Reis te helpen. Het boekingskenmerk staat
     er met opzet in: toets 6 kijkt of het bij een ander uit de bus komt. */
  const zet = await api('/api/office/reisbureau/klaarzetten', { onderdelen: [
    { soort: 'verblijf', titel: 'Casa Ibiza', bestemming: 'Ibiza', van: dag(40), tot: dag(45), kenmerk: 'QQ1234', herkomst: 'document' },
    { soort: 'vlucht', titel: 'RT418', bestemming: 'Ibiza', van: dag(40), kenmerk: 'VL9911', herkomst: 'document' }
  ] }, kantoor);
  assert.equal(zet.status, 200, JSON.stringify(zet.body));
  const code = zet.body.link.split('code=')[1];
  assert.equal((await api('/api/reis/uitnodiging/eisop', { code }, A.token)).status, 200);
  const reizen = await api('/api/reis/reizen', {}, A.token);
  assert.equal(reizen.body.reizen.length, 1, 'Anna heeft geen reis; de rest van dit bestand toetst dan niets');
  REIS = reizen.body.reizen[0].id;
});
test.after(() => { stop(srv); try { fs.rmSync(TMP, { recursive: true, force: true }); } catch (e) {} });

test('1. alle twaalf routes zitten achter een sessie, en geen van de twaalf lekt zonder', async () => {
  /* De deur is precies wat een rechtstreekse handleraanroep nooit ziet: de
     module kent alleen een `key` en gaat ervan uit dat er een mens bij hoort.
     Twaalf keer dezelfde vraag, want een route die de `auth` vergeet valt
     nergens anders door de mand -- hij geeft dan gewoon een antwoord. */
  for (const pad of PADEN) {
    const r = await api(pad, { reis: REIS, id: 'G-x', codenaam: A.codenaam, rol: 'meekijker', veld: 'aankomst', tekst: 'hoi', bestand: 'x' });
    assert.equal(r.status, 401, pad + ' antwoordde zonder sessie: ' + JSON.stringify(r.body));
    assert.equal(r.body.ok, undefined, pad + ' gaf een geslaagd antwoord zonder sessie');
  }
});

test('2. uitnodigen: de reis moet van u zijn, de rol moet bestaan, en de codenaam moet een mens zijn', async () => {
  /* Vier weigeringen die elk hun eigen reden dragen. Ze staan hier bij elkaar
     omdat ze samen de enige manier zijn waarop iemand in het gezelschap van een
     ander terecht kan komen -- valt er een weg, dan is dat de weg naar binnen. */
  const vreemd = await api('/api/reis/gezelschap/nodig-uit', { reis: 'R-bestaat-niet', codenaam: B.codenaam, rol: 'reisgenoot' }, A.token);
  assert.equal(vreemd.status, 404);
  assert.match(vreemd.body.error, /staat niet bij u/);

  /* De reis van Anna, maar Bram nodigt uit: ook dat is een reis die niet bij
     hem staat. Zonder deze regel kon een reisgenoot het gezelschap uitbreiden. */
  const nietVanHem = await api('/api/reis/gezelschap/nodig-uit', { reis: REIS, codenaam: C.codenaam, rol: 'meekijker' }, B.token);
  assert.equal(nietVanHem.status, 404);

  const rol = await api('/api/reis/gezelschap/nodig-uit', { reis: REIS, codenaam: B.codenaam, rol: 'huisgenoot' }, A.token);
  assert.equal(rol.status, 400);
  assert.match(rol.body.error, /reisgenoot of meekijker/);

  const onbekend = await api('/api/reis/gezelschap/nodig-uit', { reis: REIS, codenaam: 'Grijze Nevelkraai 0000', rol: 'meekijker' }, A.token);
  assert.equal(onbekend.status, 404);
  assert.match(onbekend.body.error, /geen lid met de codenaam/);

  const zelf = await api('/api/reis/gezelschap/nodig-uit', { reis: REIS, codenaam: A.codenaam, rol: 'reisgenoot' }, A.token);
  assert.equal(zelf.status, 400);
  assert.match(zelf.body.error, /staat zelf al/);

  // en na vijf weigeringen staat er niemand in het gezelschap
  const leeg = await api('/api/reis/gezelschap', { reis: REIS }, A.token);
  assert.equal(leeg.status, 200);
  assert.deepEqual(leeg.body.leden, [], 'een geweigerde uitnodiging liet toch iemand achter');
});

test('3. een uitnodiging bevestigt zichzelf niet -- en de uitnodiger antwoordt niet namens de ander', async () => {
  /* DIT IS DE GRENS UIT LIFE.md PAR. 4, en de reden dat dit bestand bestaat.
     Uitnodigen zet klaar; er gebeurt pas iets als de ANDER drukt. Dat is niet
     te bewijzen met de stand alleen -- die kan `gevraagd` heten terwijl de
     toegang al openstaat. Dus wordt er gevraagd wat Bram werkelijk kan. */
  const uit = await api('/api/reis/gezelschap/nodig-uit', { reis: REIS, codenaam: B.codenaam, rol: 'reisgenoot' }, A.token);
  assert.equal(uit.status, 200, JSON.stringify(uit.body));
  assert.equal(uit.body.lid.stand, 'gevraagd');
  assert.equal(uit.body.lid.aanvaardOp, null, 'de uitnodiging droeg meteen een aanvaardmoment');
  UITNODIGING_B = uit.body.lid.id;

  const kring = await api('/api/reis/gezelschap/kring', {}, B.token);
  assert.equal(kring.status, 200);
  assert.equal(kring.body.gevraagd.length, 1, 'de uitnodiging staat niet bij Bram');
  assert.deepEqual(kring.body.meereizen, [], 'Bram reist al mee zonder ja te hebben gezegd');
  assert.equal(kring.body.gevraagd[0].van, A.codenaam, 'de uitnodiger staat er op codenaam');

  // vier deuren die dicht horen te zijn zolang er geen ja is
  assert.equal((await api('/api/reis/gezelschap/reis', { reis: REIS }, B.token)).status, 404);
  assert.equal((await api('/api/reis/gezelschap/tijdlijn', { reis: REIS }, B.token)).status, 404);
  assert.equal((await api('/api/reis/gezelschap', { reis: REIS }, B.token)).status, 404);
  const schrijf = await api('/api/reis/gezelschap/schrijf', { reis: REIS, tekst: 'ik ben er al bij' }, B.token);
  assert.equal(schrijf.status, 403);
  assert.match(schrijf.body.error, /hoort niet bij deze reis/);

  /* En de uitnodiger kan het niet voor hem afmaken: antwoorden zoekt de rij op
     de sleutel van de LEZER, niet op die van de eigenaar. */
  const namens = await api('/api/reis/gezelschap/antwoord', { id: UITNODIGING_B, ja: true }, A.token);
  assert.equal(namens.status, 404);
  assert.match(namens.body.error, /Geen openstaande uitnodiging/);
  assert.equal((await api('/api/reis/gezelschap/reis', { reis: REIS }, B.token)).status, 404,
    'de uitnodiger kreeg de ander toch binnen');

  // pas Bram zelf zet de stand om, en maar één keer
  const ja = await api('/api/reis/gezelschap/antwoord', { id: UITNODIGING_B, ja: true }, B.token);
  assert.equal(ja.status, 200);
  assert.equal(ja.body.stand, 'aanvaard');
  const nogmaals = await api('/api/reis/gezelschap/antwoord', { id: UITNODIGING_B, ja: true }, B.token);
  assert.equal(nogmaals.status, 409);
  assert.match(nogmaals.body.error, /al afgehandeld/);
  assert.equal((await api('/api/reis/gezelschap/reis', { reis: REIS }, B.token)).status, 200, 'na zijn ja staat de reis open');
});

test('4. wie nee zegt verdwijnt, en niet als afgewezen rij die blijft staan', async () => {
  const uit = await api('/api/reis/gezelschap/nodig-uit', { reis: REIS, codenaam: D.codenaam, rol: 'meekijker' }, A.token);
  assert.equal(uit.status, 200);
  const nee = await api('/api/reis/gezelschap/antwoord', { id: uit.body.lid.id, ja: false }, D.token);
  assert.equal(nee.status, 200);
  assert.equal(nee.body.stand, 'geweigerd');

  /* Geweigerd betekent weg: geen rij die morgen als "ooit gevraagd" op het
     scherm van de reiziger staat, en geen tweede kans om alsnog ja te zeggen. */
  assert.deepEqual((await api('/api/reis/gezelschap/kring', {}, D.token)).body.gevraagd, []);
  assert.equal((await api('/api/reis/gezelschap/antwoord', { id: uit.body.lid.id, ja: true }, D.token)).status, 404);
  const bij = await api('/api/reis/gezelschap', { reis: REIS }, A.token);
  /* Eerst dat er iemand STAAT, anders zegt "de weigeraar staat er niet" niets. */
  assert.ok(bij.body.leden.some(l => l.codenaam === B.codenaam), 'Bram, die ja zei, hoort er nog te staan');
  assert.ok(!bij.body.leden.some(l => l.codenaam === D.codenaam), 'de weigeraar staat nog in het gezelschap');
  assert.equal((await api('/api/reis/gezelschap/reis', { reis: REIS }, D.token)).status, 404);
});

test('5. de kring toont alleen wat aan MIJ gevraagd is, en verandert niets door hem te lezen', async () => {
  /* /kring draagt een mutatiecontract (server/lib/mutatiecontracten-lezers.js):
     NOT_APPLICABLE, hij leest alleen. Die eigenschap is hier de bewering: twee
     oproepen geven hetzelfde antwoord, en de openstaande uitnodiging staat er
     na afloop nog precies zo bij. Een lezer die zijn eigen lijst opruimt of
     een uitnodiging als "gezien" wegstreept, valt hierop om. */
  const uit = await api('/api/reis/gezelschap/nodig-uit', { reis: REIS, codenaam: C.codenaam, rol: 'meekijker' }, A.token);
  assert.equal(uit.status, 200);
  UITNODIGING_C = uit.body.lid.id;

  const een = await api('/api/reis/gezelschap/kring', {}, C.token);
  const twee = await api('/api/reis/gezelschap/kring', {}, C.token);
  assert.equal(een.status, 200);
  assert.deepEqual(twee.body, een.body, 'de tweede oproep gaf iets anders dan de eerste');
  assert.equal(een.body.gevraagd.length, 1);
  assert.equal(een.body.gevraagd[0].id, UITNODIGING_C);

  /* En hij is van de lezer: de reiziger die de uitnodiging verstuurde vindt
     hem niet in zijn eigen kring -- daar staat wat aan HEM gevraagd is. */
  const vanAnna = await api('/api/reis/gezelschap/kring', {}, A.token);
  assert.deepEqual(vanAnna.body.gevraagd, [], 'de uitnodiger zag zijn eigen verzonden uitnodiging als binnengekomen');
  assert.deepEqual(vanAnna.body.meereizen, [], 'de eigenaar reist niet mee met zichzelf');
  const vanBram = await api('/api/reis/gezelschap/kring', {}, B.token);
  assert.ok(!vanBram.body.gevraagd.some(x => x.id === UITNODIGING_C), 'Bram zag de uitnodiging van Cees');
  assert.equal(vanBram.body.meereizen.length, 1, 'wat Bram aanvaardde hoort bij `meereizen` te staan');

  assert.equal((await api('/api/reis/gezelschap/antwoord', { id: UITNODIGING_C, ja: true }, C.token)).body.stand, 'aanvaard');
});

test('6. de poort: dezelfde reis, drie gezichten -- en het boekingsnummer blijft bij de reiziger', async () => {
  /* De witte lijst zelf staat in kern/reisgezelschap-poort.js en wordt door
     test/reisgezelschap.test.js nagerekend. Wat HIER bewezen wordt is dat de
     route die lijst ook echt gebruikt: drie sessies, drie antwoorden. */
  const eigen = await api('/api/reis/gezelschap/reis', { reis: REIS }, A.token);
  assert.equal(eigen.status, 200);
  assert.equal(eigen.body.reis.rol, 'eigenaar');
  assert.ok(JSON.stringify(eigen.body).includes('QQ1234'), 'de reiziger ziet zijn eigen boekingsnummer niet meer');
  assert.deepEqual(eigen.body.reis.nietZichtbaar, [], 'voor de eigenaar is er niets afgeschermd');

  const genoot = await api('/api/reis/gezelschap/reis', { reis: REIS }, B.token);
  assert.equal(genoot.status, 200);
  assert.equal(genoot.body.reis.rol, 'reisgenoot');
  assert.equal(genoot.body.van, A.codenaam, 'van wie de reis is, staat er op codenaam bij');
  assert.equal(genoot.body.reis.bestemming, 'Ibiza');
  assert.ok(genoot.body.reis.onderdelen.length >= 2, 'een reisgenoot hoort het draaiboek te zien');
  assert.ok(!JSON.stringify(genoot.body).includes('QQ1234'), 'het boekingsnummer bereikte de reisgenoot');
  assert.ok(!JSON.stringify(genoot.body).includes('VL9911'), 'het vluchtkenmerk bereikte de reisgenoot');
  assert.ok(genoot.body.reis.nietZichtbaar.length >= 1, 'de reisgenoot hoort iets afgeschermd te zien; anders zegt de lege lijst van de eigenaar niets');
  assert.ok(genoot.body.reis.nietZichtbaar.includes('boekingskenmerken'),
    'hij hoort te lezen dat er iets is dat hij niet ziet');

  const kijker = await api('/api/reis/gezelschap/reis', { reis: REIS }, C.token);
  assert.equal(kijker.status, 200);
  assert.equal(kijker.body.reis.rol, 'meekijker');
  assert.equal(kijker.body.reis.bestemming, 'Ibiza');
  assert.deepEqual(kijker.body.reis.onderdelen, [], 'een meekijker kreeg het draaiboek');
  assert.ok(kijker.body.reis.nietZichtbaar.includes('draaiboek'));
  const alles = JSON.stringify(kijker.body);
  assert.ok(!alles.includes('QQ1234') && !alles.includes('VL9911'), 'een kenmerk bereikte de meekijker');
  assert.ok(!alles.includes('Casa Ibiza') && !alles.includes('RT418'), 'de titels van de onderdelen bereikten de meekijker');
  assert.ok(!alles.includes('Anna'), 'de echte naam van de reiziger stond in het antwoord');
});

test('7. het gezelschap: de eigenaar ziet ook wie nog niet geantwoord heeft, een ander alleen wie meedoet', async () => {
  const nieuw = await api('/api/reis/gezelschap/nodig-uit', { reis: REIS, codenaam: D.codenaam, rol: 'meekijker' }, A.token);
  assert.equal(nieuw.status, 200, 'na zijn weigering mag Dirk opnieuw gevraagd worden');

  const dubbel = await api('/api/reis/gezelschap/nodig-uit', { reis: REIS, codenaam: D.codenaam, rol: 'reisgenoot' }, A.token);
  assert.equal(dubbel.status, 409, 'iemand twee keer uitnodigen hoort te botsen');
  assert.match(dubbel.body.error, /staat al in het gezelschap/);

  const vanAnna = await api('/api/reis/gezelschap', { reis: REIS }, A.token);
  assert.equal(vanAnna.body.rol, 'eigenaar');
  const standen = Object.fromEntries(vanAnna.body.leden.map(l => [l.codenaam, l.stand]));
  assert.equal(standen[B.codenaam], 'aanvaard');
  assert.equal(standen[C.codenaam], 'aanvaard');
  assert.equal(standen[D.codenaam], 'gevraagd', 'de reiziger hoort te zien dat Dirk nog niet geantwoord heeft');

  /* Een aanvaard lid ziet het gezelschap, maar niet wie er nog OVERWEEGT: een
     openstaande uitnodiging is iets tussen de reiziger en de gevraagde. */
  const vanCees = await api('/api/reis/gezelschap', { reis: REIS }, C.token);
  assert.equal(vanCees.body.rol, 'meekijker');
  assert.ok(vanCees.body.leden.some(l => l.codenaam === B.codenaam), 'Bram, die aanvaardde, hoort in het gezelschap dat Cees ziet');
  assert.ok(vanCees.body.leden.every(l => l.stand === 'aanvaard'), 'een openstaande uitnodiging lekte naar het gezelschap');
  assert.ok(!vanCees.body.leden.some(l => l.codenaam === D.codenaam), 'de nog twijfelende Dirk stond in de lijst');
  assert.ok(!JSON.stringify(vanCees.body).includes('Bram'), 'er staat een echte naam in het gezelschap');

  // Dirk zelf hoort er nog niet bij en ziet dus niets
  assert.equal((await api('/api/reis/gezelschap', { reis: REIS }, D.token)).status, 404);
});

test('8. schrijven kan alleen wie erbij hoort, en niet met niets', async () => {
  const leeg = await api('/api/reis/gezelschap/schrijf', { reis: REIS, tekst: '   ' }, A.token);
  assert.equal(leeg.status, 400);
  assert.match(leeg.body.error, /Schrijf eerst iets/);

  const vreemd = await api('/api/reis/gezelschap/schrijf', { reis: REIS, tekst: 'hallo allemaal' }, D.token);
  assert.equal(vreemd.status, 403, 'wie alleen gevraagd is, schrijft niet mee');

  const genoot = await api('/api/reis/gezelschap/schrijf', { reis: REIS, tekst: 'Koffers staan klaar.' }, B.token);
  assert.equal(genoot.status, 200, JSON.stringify(genoot.body));
  assert.equal(genoot.body.post.rol, 'reisgenoot');
  assert.equal(genoot.body.post.van, B.codenaam, 'een bericht draagt de codenaam van de schrijver');

  /* EEN TIJDLIJN PER REIS, niet een per kijker: wat de reisgenoot schrijft
     staat bij de reiziger, zonder dat er iets is doorgestuurd. */
  const bijAnna = await api('/api/reis/gezelschap/tijdlijn', { reis: REIS }, A.token);
  assert.equal(bijAnna.status, 200);
  assert.equal(bijAnna.body.rol, 'eigenaar');
  const post = bijAnna.body.posts.find(p => p.id === genoot.body.post.id);
  assert.ok(post, 'het bericht van de reisgenoot staat niet op de tijdlijn van de reis');
  assert.equal(post.tekst, 'Koffers staan klaar.');
  assert.ok(!JSON.stringify(bijAnna.body).includes('Bram'), 'de echte naam van de schrijver staat op de tijdlijn');

  // en wie er niet bij hoort leest hem ook niet
  assert.equal((await api('/api/reis/gezelschap/tijdlijn', { reis: REIS }, D.token)).status, 404);
});

test('9. het beleid is van de reiziger, en een schakelaar die niet bestaat wordt geweigerd met de reden', async () => {
  const genoot = await api('/api/reis/gezelschap/beleid', { reis: REIS }, B.token);
  assert.equal(genoot.status, 404, 'een reisgenoot mocht het deelbeleid van de reiziger lezen');
  assert.equal((await api('/api/reis/gezelschap/beleid/zet', { reis: REIS, veld: 'aankomst', aan: false }, B.token)).status, 404,
    'een reisgenoot mocht de schakelaar van de reiziger omzetten');

  const mijn = await api('/api/reis/gezelschap/beleid', { reis: REIS }, A.token);
  assert.equal(mijn.status, 200);
  assert.equal(mijn.body.beleid.aankomst, true, 'de aankomstmelding staat standaard aan');
  /* Wat er NIET bestaat hoort er met zoveel woorden bij te staan: anders leest
     een ontbrekende schakelaar als een functie die nog moet komen. */
  const nietBestaand = (mijn.body.bestaatNiet || []).map(x => x.naam);
  assert.ok(nietBestaand.includes('live locatie'), 'het besluit tegen een live locatie staat er niet bij');
  assert.match(mijn.body.bestaatNiet.find(x => x.naam === 'live locatie').reden, /moment, geen stip/);

  const verzonnen = await api('/api/reis/gezelschap/beleid/zet', { reis: REIS, veld: 'locatie', aan: true }, A.token);
  assert.equal(verzonnen.status, 400);
  assert.match(verzonnen.body.error, /geen instelling die bestaat/);
  const na = await api('/api/reis/gezelschap/beleid', { reis: REIS }, A.token);
  assert.equal(na.body.beleid.locatie, undefined, 'een verzonnen schakelaar werd toch bewaard');
});

test('10. aankomst is een handeling van de reiziger, en de schakelaar bepaalt wie hem ziet', async () => {
  /* Een reisgenoot meldt niet aan dat een ander er is -- ook niet met de beste
     bedoelingen. De melding hoort bij de reis van de reiziger. */
  assert.equal((await api('/api/reis/gezelschap/aangekomen', { reis: REIS }, B.token)).status, 404);
  assert.equal((await api('/api/reis/gezelschap/aangekomen', { reis: 'R-bestaat-niet' }, A.token)).status, 404);

  const aan = await api('/api/reis/gezelschap/aangekomen', { reis: REIS }, A.token);
  assert.equal(aan.status, 200, JSON.stringify(aan.body));
  assert.equal(aan.body.post.soort, 'aankomst');
  assert.match(aan.body.post.tekst, /Aangekomen in Ibiza/);
  assert.equal(aan.body.gedeeldMet, 'het hele gezelschap', 'met de schakelaar aan ziet iedereen het');
  const telt = (r) => r.body.posts.filter(p => p.soort === 'aankomst').length;
  assert.equal(telt(await api('/api/reis/gezelschap/tijdlijn', { reis: REIS }, C.token)), 1, 'de meekijker mist de melding');

  /* Nu uit. Dit is de invariant die de schakelaar iets waard maakt: hij bepaalt
     niet of de reiziger mag melden, maar of een MEEKIJKER het te zien krijgt --
     en wie meereist ziet het altijd, want die staat op dezelfde reis. */
  const uit = await api('/api/reis/gezelschap/beleid/zet', { reis: REIS, veld: 'aankomst', aan: false }, A.token);
  assert.equal(uit.status, 200);
  assert.equal(uit.body.beleid.aankomst, false);

  const nog = await api('/api/reis/gezelschap/aangekomen', { reis: REIS }, A.token);
  assert.equal(nog.status, 200, 'de reiziger mag nog steeds melden dat hij er is');
  assert.equal(nog.body.gedeeldMet, 'alleen wie meereist', 'het antwoord zegt niet eerlijk wie het ziet');

  assert.equal(telt(await api('/api/reis/gezelschap/tijdlijn', { reis: REIS }, C.token)), 0,
    'de meekijker zag de aankomst terwijl de schakelaar uit staat');
  assert.equal(telt(await api('/api/reis/gezelschap/tijdlijn', { reis: REIS }, B.token)), 2,
    'de reisgenoot hoort beide meldingen te zien -- hij staat op dezelfde reis');
  assert.equal(telt(await api('/api/reis/gezelschap/tijdlijn', { reis: REIS }, A.token)), 2);
});

test('11. beeld is een verwijzing naar de kluis, en wordt gedeeld voordat het op de tijdlijn komt', async () => {
  assert.equal((await api('/api/reis/gezelschap/beeld', { reis: REIS, bestand: 'B-1' }, B.token)).status, 404,
    'een reisgenoot deelde beeld op de reis van een ander');
  const zonder = await api('/api/reis/gezelschap/beeld', { reis: REIS }, A.token);
  assert.equal(zonder.status, 400);
  assert.match(zonder.body.error, /bestand uit uw kluis/);

  const voor = (await api('/api/reis/gezelschap/tijdlijn', { reis: REIS }, A.token)).body.posts.length;
  /* Een bestand dat niet in de kluis staat, wordt door de DEELLAAG geweigerd --
     en dat is precies de volgorde die deze module belooft: eerst delen, dan pas
     plaatsen. Andersom zou er een regel op de tijdlijn staan die naar een beeld
     wijst dat niemand kan openen. */
  const spook = await api('/api/reis/gezelschap/beeld', { reis: REIS, bestand: 'B-bestaatniet' }, A.token);
  assert.equal(spook.status, 404);
  assert.match(spook.body.error, /niet in uw kluis/);
  assert.equal((await api('/api/reis/gezelschap/tijdlijn', { reis: REIS }, A.token)).body.posts.length, voor,
    'een mislukte deling liet toch een regel op de tijdlijn achter');

  const up = await api('/api/bestanden/upload', { naam: 'strand.txt',
    dataUrl: 'data:text/plain;base64,' + Buffer.from('een foto van het strand').toString('base64') }, A.token);
  assert.equal(up.status, 200, JSON.stringify(up.body));
  BESTAND = up.body.id;

  const beeld = await api('/api/reis/gezelschap/beeld', { reis: REIS, bestand: BESTAND, tekst: 'Uitzicht' }, A.token);
  assert.equal(beeld.status, 200, JSON.stringify(beeld.body));
  assert.equal(beeld.body.post.soort, 'beeld');
  assert.equal(beeld.body.post.bestand, BESTAND, 'de tijdlijn draagt de verwijzing en niet de bytes');
  assert.equal(beeld.body.gedeeldMet, 2, 'gedeeld met precies de twee aanvaarde leden, niet met de gevraagde');

  /* En de deling is echt: Bram vindt het bestand in zijn eigen kluisoverzicht
     onder `gedeeld`. Er is geen tweede opslag; dit is dezelfde rij. */
  const bijBram = await api('/api/bestanden/mijn', {}, B.token);
  assert.ok((bijBram.body.gedeeld || []).some(x => x.id === BESTAND), 'de reisgenoot kan het beeld niet openen');
  const bijDirk = await api('/api/bestanden/mijn', {}, D.token);
  assert.ok(!(bijDirk.body.gedeeld || []).some(x => x.id === BESTAND),
    'wie alleen gevraagd is kreeg het beeld al');
});

test('12. eruit gaan werkt echt: de tijdlijn EN de beelden gaan mee', async () => {
  assert.equal((await api('/api/reis/gezelschap/weg', { id: 'G-bestaatniet' }, A.token)).status, 404);
  /* Een derde haalt niemand weg: de rij wordt gezocht op eigenaar OF lid. Zonder
     die regel kon een meekijker de reisgenoot uit het gezelschap zetten. */
  const derde = await api('/api/reis/gezelschap/weg', { id: UITNODIGING_B }, C.token);
  assert.equal(derde.status, 404, 'een derde kon iemand anders uit het gezelschap halen');
  assert.equal((await api('/api/reis/gezelschap/reis', { reis: REIS }, B.token)).status, 200, 'Bram is er toch uit gezet');

  const weg = await api('/api/reis/gezelschap/weg', { id: UITNODIGING_B }, A.token);
  assert.equal(weg.status, 200, JSON.stringify(weg.body));
  assert.equal(weg.body.beeldenIngetrokken, true);

  // alles dicht, in één keer
  assert.equal((await api('/api/reis/gezelschap/reis', { reis: REIS }, B.token)).status, 404);
  assert.equal((await api('/api/reis/gezelschap/tijdlijn', { reis: REIS }, B.token)).status, 404);
  assert.equal((await api('/api/reis/gezelschap', { reis: REIS }, B.token)).status, 404);
  assert.deepEqual((await api('/api/reis/gezelschap/kring', {}, B.token)).body.meereizen, []);
  const bijBram = await api('/api/bestanden/mijn', {}, B.token);
  assert.ok(!(bijBram.body.gedeeld || []).some(x => x.id === BESTAND),
    'hij raakte de tijdlijn kwijt en hield de fotos -- precies de halve waarheid die deze module uitsluit');

  /* En Cees, die er wel bij blijft, houdt alles. Anders zou toets 12 ook groen
     zijn als `verwijder` iedereen eruit gooide. */
  assert.equal((await api('/api/reis/gezelschap/reis', { reis: REIS }, C.token)).status, 200);
  const bijCees = await api('/api/bestanden/mijn', {}, C.token);
  assert.ok((bijCees.body.gedeeld || []).some(x => x.id === BESTAND), 'de meekijker raakte het beeld kwijt zonder eruit te gaan');

  /* Weggaan kan ook door het lid zelf -- dezelfde route, andere kant. */
  const zelf = await api('/api/reis/gezelschap/weg', { id: UITNODIGING_C }, C.token);
  assert.equal(zelf.status, 200);
  assert.equal((await api('/api/reis/gezelschap/reis', { reis: REIS }, C.token)).status, 404);
});
