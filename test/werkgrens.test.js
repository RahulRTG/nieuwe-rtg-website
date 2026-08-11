/* TWEE GRENZEN DIE IN DE VORM ZITTEN, NIET IN EEN CONTROLE.

   Deze twee lagen zijn allebei gebouwd rond iets wat ze NIET doen, en dat is
   precies wat hier wordt vastgelegd:

   HERKOMST (bedrijf/herkomst.js) -- werk dat uit een andere RTG-app komt.
   1. DE VERWIJSVORM IS DE BESTAANDE (`rtg://soort/id`); alles wat daar niet op
      past, wordt geweigerd. Er komt geen tweede vorm naast.
   2. DE VERWIJZING WORDT NOOIT OPGELOST. Er reist geen titel, status of ander
      veld van de RTG-kant mee -- een werkruimtelid is geen RTG-lid.
   3. EEN SOORT DIE DIT HUIS NIET KENT, WORDT BEWAARD EN NIET GEGOKT. Geen link
      naar de homepage, maar de reden erbij.

   MIJN WERK (bedrijf/mijnwerk.js) -- waar was ik gebleven.
   4. ER IS GEEN PARAMETER OM NAAR IEMAND ANDERS TE VRAGEN. Twee leden krijgen
      elk hun eigen werk, en een meegestuurd lidId verandert daar niets aan.
   5. HET BEHEER-TOKEN KOMT ER NIET IN. Dat draagt alle rechten -- precies
      daarom; anders leest een beheerder het werk van iedereen.

   Draai los: node --experimental-sqlite --test test/werkgrens.test.js */
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs'); const os = require('os'); const path = require('path');
const { startServer } = require('./helper');

let BASE, child;
const TMP = fs.mkdtempSync(path.join(os.tmpdir(), 'rtg-werkgrens-'));
const api = (pad, body) => fetch(BASE + '/api/bedrijf' + pad, {
  method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body || {})
}).then(async r => ({ status: r.status, body: await r.json().catch(() => ({})) }));

let W, B, SAM, PIA, TICKET, RTG_TOKEN;

test.before(async () => {
  ({ child, base: BASE } = await startServer({ env: { RTG_DATA_DIR: TMP, SMTP_URL: '' } }));
  const w = (await api('/werkruimte/maak', { naam: 'Noordkaap Holding', land: 'NL' })).body;
  W = w.werkruimte; B = w.beheerToken;
  const mk = async (naam, rollen) => {
    const a = (await api('/lid/aanmeld', { werkruimte: W, naam })).body;
    await api('/lid/besluit', { werkruimte: W, beheerToken: B, lidId: a.lidId, akkoord: true });
    await api('/lid/rollen', { werkruimte: W, beheerToken: B, lidId: a.lidId, rollen });
    return { cred: { werkruimte: W, lidToken: a.lidToken }, lidId: a.lidId, naam };
  };
  SAM = await mk('Sam', ['service']);
  PIA = await mk('Pia', ['projectleider', 'service']);

  TICKET = (await api('/ticket/maak', Object.assign({ onderwerp: 'Bus 28 rijdt niet',
    prioriteit: 'hoog', wie: 'Sam' }, SAM.cred))).body.ticket;
  await api('/ticket/maak', Object.assign({ onderwerp: 'Kassa hapert', wie: 'Pia' }, SAM.cred));
});

test.after(() => {
  if (child) try { child.kill('SIGKILL'); } catch (e) {}
  try { fs.rmSync(TMP, { recursive: true, force: true }); } catch (e) {}
});

test('1. alleen de bestaande verwijsvorm wordt geaccepteerd', async () => {
  for (const kaduuk of ['bus 28', 'https://rtg.nl/voertuig/28', 'rtg:/zaak/GLAS', 'rtg://ZAAK/GLAS']) {
    const uit = await api('/herkomst/zet', Object.assign({ soort: 'ticket', id: TICKET.id, ref: kaduuk }, SAM.cred));
    assert.equal(uit.status, 400, 'geweigerd: ' + kaduuk);
    assert.match(uit.body.let, /geen tweede verwijsvorm/i);
  }
});

test('2. een geldige verwijzing wordt bewaard en NIET opgelost', async () => {
  const uit = await api('/herkomst/zet', Object.assign({ soort: 'ticket', id: TICKET.id,
    ref: 'rtg://zaak/GLAS' }, SAM.cred));
  assert.equal(uit.status, 200);
  assert.equal(uit.body.herkomst.soort, 'zaak');
  assert.equal(uit.body.herkomst.id, 'GLAS');
  assert.ok(uit.body.herkomst.opent.app.includes('GLAS'), 'er staat WAAR je hem opent');

  /* De harde bewering: er reist geen enkel veld van de RTG-kant mee. Het
     antwoord draagt alleen de verwijzing zelf. */
  const sleutels = Object.keys(uit.body.herkomst).sort();
  assert.deepEqual(sleutels, ['id', 'let', 'opent', 'ref', 'soort'],
    'geen titel, geen status, geen enkel opgehaald veld');
  assert.match(uit.body.herkomst.let, /wordt NIET opgelost/i);
});

test('3. een soort die dit huis niet kent, wordt bewaard en niet gegokt', async () => {
  /* `koffer` staat niet in de kaart van kern/wereld/koppel.js. Hij is geldig van
     vorm en het ticket gaat er echt over, dus hij wordt BEWAARD -- alleen is er
     geen app om heen te gaan, en dat wordt gezegd in plaats van een pagina te
     gokken. (Deze toets stond eerst op `voertuig`; die soort heeft sinds
     public/apps/voertuig.html wél een bestemming, zie toets 3b.) */
  await api('/herkomst/zet', Object.assign({ soort: 'ticket', id: TICKET.id,
    ref: 'rtg://koffer/28' }, SAM.cred));
  const uit = (await api('/herkomst', Object.assign({ soort: 'ticket', id: TICKET.id }, SAM.cred))).body;
  assert.equal(uit.herkomst.soort, 'koffer', 'de verwijzing staat er gewoon');
  assert.equal(uit.herkomst.opent, null, 'maar er wordt geen pagina gegokt');
  assert.match(uit.herkomst.let, /geen app om heen te gaan/i, 'met de reden erbij');
  assert.equal(uit.herkomst.door, 'Sam', 'en wie hem legde');
});

test('3b. een defect voertuig heeft nu WEL een bestemming', async () => {
  /* Dit was het scenario waar deze hele draad om begon: "bus 28 is defect"
     gebeurt in RTG Mobility, het ticket hier. Sinds public/apps/voertuig.html
     bestaat, wijst die verwijzing ergens heen. */
  await api('/herkomst/zet', Object.assign({ soort: 'ticket', id: TICKET.id,
    ref: 'rtg://voertuig/bus28' }, SAM.cred));
  const uit = (await api('/herkomst', Object.assign({ soort: 'ticket', id: TICKET.id }, SAM.cred))).body;
  assert.equal(uit.herkomst.soort, 'voertuig');
  assert.ok(uit.herkomst.opent, 'er is een app om heen te gaan');
  assert.match(uit.herkomst.opent.app, /voertuig\.html\?voertuig=bus28/, 'met het id in het adres');
  assert.match(uit.herkomst.let, /wordt NIET opgelost/i,
    'en de verwijzing wordt nog steeds niet opgelost: alleen het adres, geen inhoud');
});

test('4. er is geen parameter om naar het werk van een ander te vragen', async () => {
  const sam = (await api('/mijnwerk', SAM.cred)).body;
  const pia = (await api('/mijnwerk', PIA.cred)).body;
  assert.equal(sam.wie.naam, 'Sam');
  assert.equal(pia.wie.naam, 'Pia');
  assert.equal(sam.openstaand.aantallen.tickets, 1, 'ieder ziet zijn eigen ticket');
  assert.equal(pia.openstaand.aantallen.tickets, 1);
  assert.ok(!JSON.stringify(sam.openstaand).includes('Kassa hapert'), 'Sam ziet het werk van Pia niet');

  /* En een meegestuurd lidId verandert er niets aan: de route leest het niet. */
  const poging = (await api('/mijnwerk', Object.assign({ lidId: PIA.lidId }, SAM.cred))).body;
  assert.equal(poging.wie.naam, 'Sam', 'het meegestuurde lidId wordt niet gelezen');
  assert.ok(!JSON.stringify(poging.openstaand).includes('Kassa hapert'));
});

test('5. het beheer-token komt er niet in', async () => {
  const uit = await api('/mijnwerk', { werkruimte: W, beheerToken: B });
  assert.equal(uit.status, 403, 'directie leest hier niet mee');
  assert.match(uit.body.let, /leuze/i, 'met de reden waarom dat geen detail is');
});

test('6. wat op naam staat, draagt de naamgrens mee', async () => {
  const sam = (await api('/mijnwerk', SAM.cred)).body;
  assert.equal(sam.naamgrens.opNaam, true);
  assert.match(sam.naamgrens.let, /niet op een sleutel/i,
    'de lijst gaat op naam, en dat wordt gezegd in plaats van verzwegen');
});

/* HET LID-ID NAAST DE NAAM (bedrijf/wieis.js). Dit was de zwaarste schuld die
   deze reeks achterliet: mensen werden alleen op naam gevonden. Drie
   beweringen, en de derde is de reden dat het een helper werd en geen regel per
   module. */
test('7. een onbedubbelzinnige naam levert een id op, en dat wordt gebruikt', async () => {
  const t = (await api('/ticket/maak', Object.assign({ onderwerp: 'Pomp lekt',
    wie: 'Pia' }, SAM.cred))).body;
  assert.equal(t.ticket.wie, 'Pia', 'de naam blijft gewoon staan');
  assert.equal(t.ticket.wieId, PIA.lidId, 'en het id staat ernaast');
  assert.equal(t.wieLet, null, 'geen voorbehoud: de naam was thuis te brengen');

  const mijn = (await api('/mijnwerk', PIA.cred)).body;
  assert.ok(mijn.gevonden.opId >= 1, 'die rij wordt op id gevonden');
  assert.equal(mijn.gevonden.opNaam, 0, 'en niet op naam');
  assert.match(mijn.gevonden.let, /geen naamgok/i);
});

test('8. een naam die niet thuis te brengen is, blijft een naam -- met de reden', async () => {
  const buiten = (await api('/ticket/maak', Object.assign({ onderwerp: 'Dak lekt',
    wie: 'Iemand van buiten' }, SAM.cred))).body;
  assert.equal(buiten.ticket.wie, 'Iemand van buiten', 'de toewijzing wordt niet geweigerd');
  assert.equal(buiten.ticket.wieId, null, 'er wordt geen id gegokt');
  assert.match(buiten.wieLet, /geen actief lid/i, 'en de gebruiker hoort waarom');
});

test('9. bij twee naamgenoten wordt er GEEN id gekozen', async () => {
  const a = (await api('/lid/aanmeld', { werkruimte: W, naam: 'Pia' })).body;
  await api('/lid/besluit', { werkruimte: W, beheerToken: B, lidId: a.lidId, akkoord: true });

  const t = (await api('/ticket/maak', Object.assign({ onderwerp: 'Derde melding',
    wie: 'Pia' }, SAM.cred))).body;
  assert.equal(t.ticket.wieId, null, 'twee actieve Pia\'s: er wordt er geen gekozen');
  assert.match(t.wieLet, /2 actieve leden heten zo/i, 'met de telling erbij');

  /* En de rij die eerder WEL een id kreeg, blijft exact -- er wordt niets met
     terugwerkende kracht omgegooid. */
  const mijn = (await api('/mijnwerk', PIA.cred)).body;
  assert.ok(mijn.gevonden.opId >= 1, 'de eerdere toewijzing blijft op id staan');
});

/* OPLOSSEN NA EIGEN KOPPELING. De verwijzing werd nooit opgelost; dat mag nu
   wel, maar alleen met de identiteit van het LID -- zijn eigen, eenmalig
   gekoppelde RTG-account -- en nooit met die van de werkruimte.

   Deze drie toetsen gebruiken een ECHTE RTG-sessie. Een eerdere versie deed dat
   niet en accepteerde 401 of 403; die kon dus niet zakken, en twee mutaties
   sloegen er dan ook op af (LAT-regel 9). Nu bijt hij. */
const metSessie = (pad, body, token) => fetch(BASE + '/api/bedrijf' + pad, {
  method: 'POST',
  headers: Object.assign({ 'Content-Type': 'application/json' },
    token ? { Authorization: 'Bearer ' + token } : {}),
  body: JSON.stringify(body || {})
}).then(async r => ({ status: r.status, body: await r.json().catch(() => ({})) }));

test('10. met een RTG-sessie maar ZONDER koppeling wordt er niets gelezen', async () => {
  const inlog = await fetch(BASE + '/api/auth/login', { method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ login: 'roellie.i@gmail.com', password: 'Imran' }) }).then(r => r.json());
  assert.ok(inlog.token, 'de demo-inlog werkt');
  RTG_TOKEN = inlog.token;

  await api('/herkomst/zet', Object.assign({ soort: 'ticket', id: TICKET.id,
    ref: 'rtg://zaak/HOSHI' }, SAM.cred));

  const uit = await metSessie('/herkomst/open',
    Object.assign({ soort: 'ticket', id: TICKET.id }, SAM.cred), RTG_TOKEN);
  assert.equal(uit.status, 200, 'de sessie komt binnen');
  assert.equal(uit.body.opgelost, null, 'maar er is niets van de RTG-kant gelezen');
  assert.match(uit.body.reden, /niet aan dit lidmaatschap gekoppeld/i,
    'want dit lid heeft zijn RTG-account niet gekoppeld');
});

test('11. na de eigen koppeling wordt hij WEL opgelost', async () => {
  const kop = await metSessie('/lid/koppel', SAM.cred, RTG_TOKEN);
  assert.equal(kop.status, 200, 'Sam koppelt zijn eigen RTG-account');

  const uit = await metSessie('/herkomst/open',
    Object.assign({ soort: 'ticket', id: TICKET.id }, SAM.cred), RTG_TOKEN);
  assert.equal(uit.status, 200);
  assert.ok(uit.body.opgelost, 'nu komt er een titel mee');
  assert.ok(uit.body.opgelost.titel, 'en die is niet leeg');
  assert.match(uit.body.let, /met UW RTG-sessie/i, 'met wiens sessie hij is gelezen');
  assert.match(uit.body.let, /bewaart hem niet/i, 'en dat de werkruimte hem niet bewaart');
});

test('12. een ANDERE RTG-sessie dan de gekoppelde lost niets op', async () => {
  /* De tweede grendel: het is niet genoeg dat er EEN geldige RTG-sessie
     meekomt, hij moet het account zijn dat DIT lid heeft gekoppeld. Zonder
     deze toets kon die controle eruit zonder dat er iets rood werd -- de
     eerdere versie gebruikte alleen de gekoppelde sessie en bewees dus niets. */
  const reg = await fetch(BASE + '/api/auth/register', { method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ name: 'Bram Jansen', email: 'bram-werkgrens@x.nl', phone: '0612345672',
      password: 'geheim123', geboortedatum: '1992-02-02' }) }).then(r => r.json());
  const ander = reg.token ? reg : await fetch(BASE + '/api/auth/login', { method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ login: 'bram-werkgrens@x.nl', password: 'geheim123' }) }).then(r => r.json());
  assert.ok(ander.token, 'een tweede RTG-account is beschikbaar');

  const uit = await metSessie('/herkomst/open',
    Object.assign({ soort: 'ticket', id: TICKET.id }, SAM.cred), ander.token);
  assert.equal(uit.status, 200);
  assert.equal(uit.body.opgelost, null, 'met een vreemde sessie komt er niets mee');
  assert.match(uit.body.reden, /niet het account dat aan dit lidmaatschap is gekoppeld/i);
});

test('12b. een voertuig wordt alleen opgelost bij een vervoerder waar u WERKT', async () => {
  /* De tweede laag van de grens. Gekoppeld zijn is niet genoeg: de zoekopdracht
     kijkt uitsluitend in de vloten van de vervoerders waar dit lid volgens de
     personeelsadministratie werkelijk werkt. Sam is nergens chauffeur, dus er is
     geen pad waarlangs deze bus gevonden wordt -- ook al is zijn RTG-account
     netjes gekoppeld en is de sessie de juiste. */
  await api('/herkomst/zet', Object.assign({ soort: 'ticket', id: TICKET.id,
    ref: 'rtg://voertuig/bus28' }, SAM.cred));
  const uit = await metSessie('/herkomst/open',
    Object.assign({ soort: 'ticket', id: TICKET.id }, SAM.cred), RTG_TOKEN);
  assert.equal(uit.status, 200);
  assert.equal(uit.body.opgelost, null, 'er komt geen naam of kenteken mee');
  assert.match(uit.body.reden, /vervoerder waar u werkt/i,
    'met de reden: gekoppeld zijn is daarvoor niet genoeg');
  assert.ok(uit.body.herkomst.opent, 'het ADRES staat er wel; alleen de inhoud niet');
});

test('13. het beheer-token lost nooit op, ook niet met een geldige sessie', async () => {
  const uit = await metSessie('/herkomst/open',
    { werkruimte: W, beheerToken: B, soort: 'ticket', id: TICKET.id }, RTG_TOKEN);
  assert.equal(uit.status, 403, 'de werkgever opent deze deur niet');
  assert.match(uit.body.let, /opent de werkgever de deur/i,
    'met de reden waarom dat de kern van deze grens is');
});

/* DE VOERTUIGGRENS ALS PURE FUNCTIE.

   De routetoets hierboven (12b) kan niet bewijzen dat de werkplekken-grens
   werkt: in die toets bestaat het voertuig nergens, dus met of zonder grens
   komt er niets terug. Een mutatie die de grens weghaalde sloeg dan ook AF --
   en dat is precies LAT-regel 9: een toets die niet kan zakken.

   Hier staat de bewering waar hij wel kan zakken: op bedrijf/oplosbaar.js zelf,
   met een voertuig dat ECHT bestaat bij een vervoerder waar het lid niet werkt. */
test('14. de voertuiggrens: alleen vinden waar dit lid werkelijk werkt', () => {
  const oplosbaar = require('../server/bedrijf/oplosbaar');
  const bus = { id: 'bus28', vervoerder: 'KAAP', categorie: 'shuttlebus', naam: 'Bus 28' };
  const kernMet = (zaken) => ({
    werkplekken: { zakenVan: () => zaken },
    assetMet: (code, id) => (code === 'KAAP' && id === bus.id ? bus : null),
    assetBeeld: (a) => ({ id: a.id, naam: a.naam, categorieNaam: 'Shuttlebus', registratie: null, inzetbaar: true })
  });

  const werktEr = oplosbaar.voertuig(kernMet([{ code: 'KAAP' }]), 'bus28', 'user-1');
  assert.ok(werktEr, 'wie bij KAAP werkt, vindt de bus');
  assert.equal(werktEr.titel, 'Bus 28');

  const werktErNiet = oplosbaar.voertuig(kernMet([{ code: 'ANDERS' }]), 'bus28', 'user-1');
  assert.equal(werktErNiet, null, 'wie ergens anders werkt, vindt hem niet');

  const werktNergens = oplosbaar.voertuig(kernMet([]), 'bus28', 'user-1');
  assert.equal(werktNergens, null, 'en wie nergens werkt al helemaal niet');
});
