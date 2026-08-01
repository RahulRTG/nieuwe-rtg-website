/* ============================================================================
   WISSELEN VAN AFDELING, EN DE RITHISTORIE -- 3 endpoints.

   supplier/wissel, supplier/wissel/opties en supplier/ride/history stonden
   als nooit aangeroepen in de waargenomen dekkingsmeting.

   WAT ER OP HET SPEL STAAT

   Wisselen is de gevaarlijkste van de drie: hij geeft een NIEUW TOKEN voor een
   ANDERE ZAAK. Dat is precies wat je wilt voor een barman die 's middags in
   het hotel en 's avonds in de bar staat -- niet twee inlogs, niet twee
   pincodes. Maar het is ook precies de vorm waarmee je, als de controle
   wegvalt, jezelf een sleutel van de buren geeft.

   Er moeten daarom twee dingen tegelijk waar zijn, en de foutmelding zegt ze
   allebei: de zaken moeten VERBONDEN zijn, en de manager daar moet je in het
   TEAM hebben gezet. Een van de twee is niet genoeg -- dat is het verschil
   tussen "wij werken samen" en "deze persoon werkt hier ook".

   En: een gedeeld inlogaccount wisselt niet. Alleen wie op zijn eigen naam is
   ingelogd (met een staffId) heeft een naam om aan de andere kant te
   herkennen; een zaakbrede inlog zou anders in iemand anders' rooster landen.

   Draai los: node --experimental-sqlite --test test/wisselen-en-historie.test.js
   ========================================================================== */
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { startServer, stop } = require('./helper');

let srv, base, baas, werker, buurbaas, taxi, gedeeld;
const TMP = fs.mkdtempSync(path.join(os.tmpdir(), 'rtg-wissel-'));

function api(pad, body, token) {
  const h = { 'Content-Type': 'application/json' };
  if (token) h.Authorization = 'Bearer ' + token;
  return fetch(base + pad, { method: 'POST', headers: h, body: JSON.stringify(body || {}) })
    .then(async r => ({ status: r.status, body: await r.json().catch(() => ({})) }));
}
async function inlog(code, rol) {
  const roster = await api('/api/supplier/roster', { code });
  const wie = (roster.body.staff || []).find(x => x.role === rol);
  return wie ? (await api('/api/supplier/login', { code, staffId: wie.id, pin: rol === 'manager' ? '1234' : '5678' })).body.token : null;
}

test.before(async () => {
  srv = await startServer({ env: { SMTP_URL: '', RTG_DATA_DIR: TMP } });
  base = srv.base;
  baas = await inlog('KIKUNOI', 'manager');
  werker = await inlog('KIKUNOI', 'staff');
  buurbaas = await inlog('HOSHI', 'manager');
  taxi = await inlog('MKKX', 'manager');
  // de gedeelde zaakinlog (geen persoonlijke naam, dus geen staffId)
  gedeeld = (await api('/api/supplier/login', { username: 'rahul', password: 'Imran' })).body.token;
  assert.ok(baas && werker && buurbaas && taxi, 'de zaken staan klaar');
});
test.after(() => {
  stop(srv && srv.child);
  try { fs.rmSync(TMP, { recursive: true, force: true }); } catch (e) {}
});

test('1. de wisselopties zijn de plekken waar je echt op het rooster staat', async () => {
  const o = await api('/api/supplier/wissel/opties', {}, werker);
  assert.equal(o.status, 200);
  assert.ok(Array.isArray(o.body.opties), 'er komt een lijst terug, ook als hij leeg is');
  for (const x of o.body.opties) {
    assert.ok(x.code && x.naam, 'elke optie draagt een code en een naam');
    assert.notEqual(x.code, 'KIKUNOI', 'de eigen zaak staat er niet tussen');
  }

  /* Een gedeelde zaakinlog heeft geen persoonlijke naam, dus ook geen plek op
     een rooster elders. Die krijgt een lege lijst en niet de opties van
     iemand anders. */
  if (gedeeld) assert.deepEqual((await api('/api/supplier/wissel/opties', {}, gedeeld)).body.opties, [],
    'een gedeelde inlog heeft geen eigen roosterplekken');
});

test('2. wisselen kan alleen waar je geaccrediteerd bent', async () => {
  if (gedeeld) {
    const g = await api('/api/supplier/wissel', { code: 'HOSHI' }, gedeeld);
    assert.equal(g.status, 403, 'een gedeelde inlog wisselt niet van afdeling');
    assert.match(g.body.error, /eigen naam/i, 'en zegt waarom: er is geen persoon om te herkennen');
  }

  assert.equal((await api('/api/supplier/wissel', { code: 'BESTAATNIET' }, werker)).status, 404,
    'een bedrijf dat we niet kennen');
  assert.equal((await api('/api/supplier/wissel', { code: 'KIKUNOI' }, werker)).status, 400,
    'naar je eigen zaak wisselen is geen wisseling');

  /* DE BEWERING DIE ERTOE DOET. Wisselen levert een token voor een ANDERE
     zaak op. Zonder accreditatie is dat een sleutel van de buren, en dan is
     het verschil tussen "wij werken samen" en "deze persoon werkt hier ook"
     verdwenen. De foutmelding noemt beide voorwaarden met opzet. */
  const nee = await api('/api/supplier/wissel', { code: 'MKKX' }, werker);
  assert.equal(nee.status, 403, 'zonder accreditatie geen token voor een andere zaak');
  assert.match(nee.body.error, /verbonden/i, 'de zaken moeten verbonden zijn');
  assert.match(nee.body.error, /team/i, 'en de manager daar moet je in het team hebben gezet');
  assert.ok(!nee.body.token, 'en er komt zeker geen token mee');

  // wie de opties wel heeft, wisselt ook echt -- inclusief een werkend token
  const opties = (await api('/api/supplier/wissel/opties', {}, werker)).body.opties || [];
  if (opties.length) {
    const w = await api('/api/supplier/wissel', { code: opties[0].code }, werker);
    assert.equal(w.status, 200, JSON.stringify(w.body).slice(0, 160));
    assert.ok(w.body.token, 'er komt een token mee');
    assert.equal(w.body.supplier.code, opties[0].code);
    const daar = await api('/api/supplier/state', {}, w.body.token);
    assert.equal(daar.status, 200, 'en dat token werkt echt bij de andere zaak');
    assert.equal(daar.body.state.supplier.code, opties[0].code, 'op de goede zaak');
  }
});

test('3. de rithistorie is van de eigen zaak, met een zoekveld en paginas', async () => {
  const h = await api('/api/supplier/ride/history', {}, taxi);
  assert.equal(h.status, 200);
  assert.ok(Array.isArray(h.body.items), 'er komt een lijst terug');
  assert.equal(typeof h.body.total, 'number');
  assert.equal(typeof h.body.omzet, 'number', 'met de omzet erbij');
  assert.ok(h.body.pages >= 1, 'en minstens een pagina');

  /* Een paginanummer buiten bereik landt op de laatste pagina in plaats van
     op een lege lijst. Dat is vriendelijker dan een foutmelding en het is
     bewust zo: wie doorklikt na de laatste pagina hoort niet in het niets te
     eindigen. */
  const ver = await api('/api/supplier/ride/history', { page: 9999 }, taxi);
  assert.equal(ver.body.page, ver.body.pages, 'te ver doorklikken landt op de laatste pagina');
  const terug = await api('/api/supplier/ride/history', { page: -5 }, taxi);
  assert.equal(terug.body.page, 1, 'en te ver terug op de eerste');

  /* Een zoekterm die niets kan opleveren geeft een lege lijst en geen fout.
     Dat bewijst alleen iets als de historie ZONDER zoekterm wel gevuld is --
     anders is nul het antwoord op elke vraag. scripts/tandeloos.js wees deze
     regel van mij aan, en terecht: ik stelde nergens vast dat deze zaak
     uberhaupt ritten heeft. */
  if (h.body.items.length) {
    const zoek = await api('/api/supplier/ride/history', { q: 'zzzzgeenenkelerit' }, taxi);
    assert.equal(zoek.status, 200);
    assert.equal(zoek.body.items.length, 0, 'de zoekterm filtert echt: zonder hem staan er wel ritten');
    const alles = await api('/api/supplier/ride/history', { q: '' }, taxi);
    assert.ok(alles.body.items.length > 0, 'en zonder zoekterm komt de historie gewoon terug');
  } else {
    /* Deze zaak heeft geen afgeronde ritten in de seed. Dan valt er over het
       zoekveld niets te bewijzen, en dat opschrijven is eerlijker dan een
       bewering die op nul altijd slaagt. */
    assert.equal(h.body.total, 0, 'deze zaak heeft geen afgeronde ritten; over het zoekveld valt hier niets te bewijzen');
  }

  // en een restaurant heeft zijn eigen (lege) historie, niet die van de taxi
  const resto = await api('/api/supplier/ride/history', {}, baas);
  assert.equal(resto.status, 200);
  for (const r of resto.body.items) assert.notEqual(r.supplierCode, 'MKKX', 'geen ritten van de buren');
});

/* ============================================================================
   "DEZELFDE PERSOON" WAS "DEZELFDE WEERGAVENAAM".

   De hele accreditatie hing op `m.name === ik.name`. De naam op een
   personeelskaart is vrije tekst die de manager van die zaak zelf intikt, dus
   dat is geen identiteit maar een etiket:

   - stond er bij de verbonden zaak een MANAGER met dezelfde naam, dan
     wisselde je daarheen en kreeg je zijn rol mee (manager: true);
   - de manager van je EIGEN zaak mag namen aanpassen, dus die kon een
     medewerker hernoemen naar de naam van een manager bij de buren;
   - en zonder enige kwade wil botsen twee Jan de Vries'en gewoon.

   Deze situatie was in de seed niet te maken (geen verbonden zaken, geen
   personeel met een gekoppeld account), dus stond de test hierboven met
   `if (opties.length)` altijd op nul: hij bewees niets over het geval dat
   ertoe deed. Deze test bouwt de situatie daarom zelf op.
   ========================================================================== */
test('4. wisselen kijkt naar het RTG-account, niet naar de naam op de kaart', async () => {
  // de twee zaken verbinden (allebei een manager, dus een echte tweezijdige link)
  await api('/api/supplier/net/verzoek', { code: 'HOSHI' }, baas);
  const akkoord = await api('/api/supplier/net/beslis', { code: 'KIKUNOI', actie: 'akkoord' }, buurbaas);
  assert.equal(akkoord.body.status, 'akkoord', 'KIKUNOI en HOSHI zijn verbonden');

  // wie ben ik bij KIKUNOI?
  const roster = await api('/api/supplier/roster', { code: 'KIKUNOI' });
  const ik = (roster.body.staff || []).find(x => x.role !== 'manager');
  assert.ok(ik, 'ik werk bij KIKUNOI en ben geen manager');

  /* DE AANVAL: de buurzaak krijgt iemand met MIJN naam -- en met de rol
     manager. Vroeger was dat genoeg: gelijke naam = gelijke persoon = wissel,
     met de rol van de kaart daar. */
  const dubbel = await api('/api/supplier/staff/add', { name: ik.name, role: 'manager' }, buurbaas);
  assert.equal(dubbel.status, 200, 'de buurzaak heeft nu een manager met dezelfde naam: ' + JSON.stringify(dubbel.body).slice(0, 120));

  const opties = (await api('/api/supplier/wissel/opties', {}, werker)).body.opties || [];
  assert.ok(!opties.some(o => o.code === 'HOSHI'),
    'een gelijke naam bij de buren is GEEN werkplek van mij (kreeg: ' + JSON.stringify(opties) + ')');
  const poging = await api('/api/supplier/wissel', { code: 'HOSHI' }, werker);
  assert.equal(poging.status, 403, 'en wisselen lukt dus niet');
  assert.ok(!poging.body.token, 'zeker geen token voor de buren, al helemaal geen manager-token');
});

/* En de andere kant: met een ECHT gedeeld RTG-account werkt het wel. Anders
   had ik de functie gewoon uitgezet in plaats van hem juist gemaakt. */
test('5. met hetzelfde RTG-account achter beide kaarten wisselt het wel', async () => {
  const u = Date.now().toString().slice(-8);
  const email = 'wissel' + u + '@x.nl';
  const reg = await api('/api/auth/register', { name: 'Wisselwerker', email, phone: '06' + u,
    password: 'geheim123', geboortedatum: '1992-02-02', tier: 'rtg', pasApp: 'rtg' });
  assert.equal(reg.status, 200, 'een RTG-account als identiteit');

  /* De aanmeldroute zoekt de zaak op BEDRIJFSNAAM, niet op code -- de
     medewerker krijgt van zijn werkgever "Sal de Mar", niet "KIKUNOI". De
     uitnodiging geeft die naam zelf terug, dus die nemen we over in plaats van
     hem hier nog eens op te schrijven. */
  const PIN = '4321'; // zelfgekozen; de server geeft een gegenereerde pin nooit terug
  const aanmelden = async (mgrToken, waar) => {
    const inv = await api('/api/supplier/staff/invite', { name: 'Wisselwerker', role: 'staff' }, mgrToken);
    assert.equal(inv.status, 200, 'uitnodiging bij ' + waar);
    const join = await api('/api/supplier/staff/join', { bedrijf: inv.body.bedrijf,
      kassacode: inv.body.invite.kassacode, login: email, password: 'geheim123', pin: PIN });
    assert.equal(join.status, 200, 'aangemeld bij ' + inv.body.bedrijf + ': ' + JSON.stringify(join.body).slice(0, 160));
    return join.body;
  };
  const bijKik = await aanmelden(baas, 'KIKUNOI');
  await aanmelden(buurbaas, 'HOSHI');

  // inloggen op de KIKUNOI-kaart en dan wisselen
  assert.ok(bijKik.staffId, 'de aanmelding levert een kaart: ' + JSON.stringify(bijKik).slice(0, 160));
  const tok = (await api('/api/supplier/login', { code: 'KIKUNOI', staffId: bijKik.staffId, pin: PIN })).body.token;
  assert.ok(tok, 'ingelogd op de eigen kaart');

  const opties = (await api('/api/supplier/wissel/opties', {}, tok)).body.opties || [];
  assert.ok(opties.some(o => o.code === 'HOSHI'), 'HOSHI is nu wel een werkplek van mij: ' + JSON.stringify(opties));
  const w = await api('/api/supplier/wissel', { code: 'HOSHI' }, tok);
  assert.equal(w.status, 200, JSON.stringify(w.body).slice(0, 160));
  const daar = await api('/api/supplier/state', {}, w.body.token);
  assert.equal(daar.body.state.supplier.code, 'HOSHI', 'en het token werkt echt bij de buren');
});
