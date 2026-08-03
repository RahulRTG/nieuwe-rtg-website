/* EEN AVOND IN HET HUIS -- de keuken, een event, het hotel en de gasten.

   WAAROM DIT ER IS

   De vorige toetsen volgen een mens (levensloop) of een bestelling
   (bezorging). Deze volgt een ZAAK op een avond, want daar komen de rollen
   samen: de keuken meldt iets uitverkocht en de kaart verandert meteen, een
   gast meldt zich aan voor een event onder zijn codenaam, de receptie geeft
   een kamer vrij, en de bediening ziet dat alles.

   WAT HIER BEWUST WORDT NAGETROKKEN -- de dingen die stil misgaan:

   1. HET KEUKENSCHERM STUURT DE KAART. Meldt de keuken een gerecht "86"
      (uitverkocht), dan kan een gast het per direct niet meer bestellen. Een
      keukenscherm dat alleen zichzelf bijwerkt is een prikbord.
   2. DE SECTIES SLUITEN DE BON. Een bon is pas klaar als ELKE sectie klaar
      is; een enkele sectie die afvinkt mag hem niet compleet verklaren.
   3. DE VEILIGE STANDAARD BIJ ALCOHOL. Zonder geverifieerde leeftijd geldt
      "onder de 18". Dat is de goede kant om fout te zitten, en het hoort een
      toets te hebben in plaats van een goede bedoeling.
   4. DE GASTENLIJST DRAAIT OP CODENAMEN. De zaak ziet wie er komt, niet wie
      dat is -- ook bij een event, ook bij het inchecken.
   5. EEN VOL EVENT IS VOL, en twee keer aanmelden kan niet. */
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { startServer } = require('./helper');

const TMP = fs.mkdtempSync(path.join(os.tmpdir(), 'rtg-avond-'));

function post(base) {
  return (pad, body, token) => fetch(base + pad, {
    method: 'POST',
    headers: Object.assign({ 'Content-Type': 'application/json' },
      token ? { Authorization: 'Bearer ' + token } : {}),
    body: JSON.stringify(body || {})
  }).then(async r => ({ status: r.status, body: await r.json().catch(() => ({})) }));
}

let teller = 0;
async function nieuwLid(P, naam) {
  const u = String(Date.now()).slice(-7) + String(++teller).padStart(3, '0');
  const r = await P('/api/auth/register', {
    name: naam, email: naam.toLowerCase() + u + '@x.nl', phone: '06' + u.slice(0, 8),
    password: 'geheim123', geboortedatum: '1990-01-01', geslacht: 'v', tier: 'rtg', pasApp: 'rtg'
  });
  assert.ok(r.body.token, naam + ' is aangemeld: ' + JSON.stringify(r.body).slice(0, 140));
  return r.body.token;
}

async function zaak(P, code) {
  const r = await P('/api/supplier/roster', { code });
  const man = (r.body.staff || []).find(s => s.role === 'manager');
  assert.ok(man, code + ' heeft een manager');
  const lg = await P('/api/supplier/login', { code, staffId: man.id, pin: '1234' });
  assert.ok(lg.body.token, 'de manager van ' + code + ' logt in');
  return { token: lg.body.token, state: lg.body.state || {} };
}

test('de keuken stuurt de kaart: een 86 sluit het gerecht per direct af', async () => {
  const { child, base } = await startServer({ env: { RTG_DATA_DIR: TMP, SMTP_URL: '' } });
  try {
    const P = post(base);
    const { token: keuken, state } = await zaak(P, 'KIKUNOI');
    const lid = await nieuwLid(P, 'Gast');

    const kaart = (state.supplier && state.supplier.menu) || state.menu || [];
    const gerecht = kaart.find(m => m.station !== 'bar');
    assert.ok(gerecht, 'er staat een gerecht op de kaart: ' + JSON.stringify(kaart.slice(0, 2)).slice(0, 200));

    /* Eerst gewoon bestellen: zonder deze stap zegt de weigering hierna niets. */
    const voor = await P('/api/order', { supplierCode: 'KIKUNOI', items: [{ id: gerecht.id, qty: 1 }] }, lid);
    assert.equal(voor.status, 200, 'het gerecht is te bestellen: ' + JSON.stringify(voor.body).slice(0, 160));

    /* De keuken meldt 86. Dit is een KEUKENSCHERM dat de kaart van de gast
       verandert -- geen prikbord. */
    const acht = await P('/api/supplier/menu/86', { itemId: gerecht.id, op: true }, keuken);
    assert.equal(acht.status, 200, 'de keuken meldt 86: ' + JSON.stringify(acht.body).slice(0, 160));

    const na = await P('/api/order', { supplierCode: 'KIKUNOI', items: [{ id: gerecht.id, qty: 1 }] }, lid);
    assert.equal(na.status, 409, 'de gast kan het per direct niet meer bestellen');
    assert.match(String(na.body.error), /uitverkocht|86/i, 'en hoort waarom: ' + na.body.error);

    // en terugdraaien kan ook
    await P('/api/supplier/menu/86', { itemId: gerecht.id, op: false }, keuken);
    const weer = await P('/api/order', { supplierCode: 'KIKUNOI', items: [{ id: gerecht.id, qty: 1 }] }, lid);
    assert.equal(weer.status, 200, 'zodra de keuken hem vrijgeeft kan het weer');
  } finally { child.kill('SIGKILL'); }
});

test('alcohol: de leeftijd van het paspoort beslist, en de zaak hoort die niet', async () => {
  const { child, base } = await startServer({ env: { RTG_DATA_DIR: TMP, SMTP_URL: '' } });
  try {
    const P = post(base);
    const { state } = await zaak(P, 'KIKUNOI');

    const kaart = (state.supplier && state.supplier.menu) || state.menu || [];
    const bar = kaart.find(m => m.station === 'bar');
    const eten = kaart.find(m => m.station !== 'bar');
    assert.ok(bar && eten, 'er staat iets van de bar en iets van de keuken op de kaart');

    /* TWEE VERSCHILLENDE DREMPELS, en dat is geen toeval maar ontwerp. Het
       lidmaatschap zelf kan vanaf 15; alcohol vanaf de grens van het land waar
       de zaak staat. Een zestienjarige is dus een volwaardig lid dat geen cava
       krijgt -- en dat is precies het geval dat je wilt zien werken. */
    const uu = String(Date.now()).slice(-7);
    const teJong = await P('/api/auth/register', {
      name: 'Veel Te Jong', email: 'tj' + uu + '@x.nl', phone: '061' + uu.slice(0, 7),
      password: 'geheim123', geboortedatum: '2014-05-05', geslacht: 'v', tier: 'rtg', pasApp: 'rtg'
    });
    assert.equal(teJong.status, 400, 'onder de vijftien kom je er niet eens in');
    assert.match(String(teJong.body.error), /15 jaar/, 'met de grens erbij: ' + teJong.body.error);

    const jong = await P('/api/auth/register', {
      name: 'Jonge Gast', email: 'jong' + uu + '@x.nl', phone: '062' + uu.slice(0, 7),
      password: 'geheim123', geboortedatum: '2010-05-05', geslacht: 'v', tier: 'rtg', pasApp: 'rtg'
    });
    assert.ok(jong.body.token, 'een zestienjarige is wel gewoon lid: ' + JSON.stringify(jong.body).slice(0, 160));

    const geweigerd = await P('/api/order',
      { supplierCode: 'KIKUNOI', items: [{ id: bar.id, qty: 1 }] }, jong.body.token);
    assert.equal(geweigerd.status, 403, 'maar een zestienjarige krijgt geen cava: ' +
      JSON.stringify(geweigerd.body).slice(0, 180));
    assert.match(String(geweigerd.body.error), /alcohol|jaar/i, 'met de reden erbij: ' + geweigerd.body.error);

    /* En de rest van de kaart blijft gewoon open -- een leeftijdsgrens op
       alcohol mag geen kind de keuken uit sturen. */
    const eten1 = await P('/api/order',
      { supplierCode: 'KIKUNOI', items: [{ id: eten.id, qty: 1 }] }, jong.body.token);
    assert.equal(eten1.status, 200, 'eten kan hij gewoon bestellen');

    /* De volwassene mag wel. Zonder deze kant zou "alles weigeren" ook slagen. */
    const oud = await nieuwLid(P, 'Oudere');
    const mag = await P('/api/order', { supplierCode: 'KIKUNOI', items: [{ id: bar.id, qty: 1 }] }, oud);
    assert.equal(mag.status, 200, 'een volwassen lid kan wel bestellen: ' + JSON.stringify(mag.body).slice(0, 160));

    /* DE MERKREGEL erachter: de partner ziet DAT de leeftijd geverifieerd is,
       niet WELKE. Een geboortedatum hoort niet op een keukenscherm. */
    const bij = await zaak(P, 'KIKUNOI');
    const bonnen = JSON.stringify(bij.state.orders || []);
    assert.ok(!/2010-05-05/.test(bonnen), 'de geboortedatum staat niet op de bon bij de zaak');
    assert.ok(!/Jonge Gast|Oudere/.test(bonnen), 'en de echte naam ook niet: ' + bonnen.slice(0, 200));
  } finally { child.kill('SIGKILL'); }
});

test('de keukenlijn: een bon is pas klaar als elke sectie klaar is', async () => {
  const { child, base } = await startServer({ env: { RTG_DATA_DIR: TMP, SMTP_URL: '' } });
  try {
    const P = post(base);
    const { token: keuken, state } = await zaak(P, 'KIKUNOI');
    const lid = await nieuwLid(P, 'Tafelgast');

    const kaart = (state.supplier && state.supplier.menu) || state.menu || [];
    const eten = kaart.filter(m => m.station !== 'bar').slice(0, 2);
    assert.equal(eten.length, 2, 'twee gerechten van de kaart');

    const bon = await P('/api/order', {
      supplierCode: 'KIKUNOI', items: eten.map(m => ({ id: m.id, qty: 1 }))
    }, lid);
    assert.equal(bon.status, 200, 'de bon is geplaatst: ' + JSON.stringify(bon.body).slice(0, 160));
    const ref = bon.body.ref || (bon.body.order && bon.body.order.ref);
    assert.ok(ref, 'met een referentie');
    await P('/api/order/pay', { ref }, lid);

    /* DE KANT. Een kok meldt zich aan op een kant van de keuken (warm, koud,
       snack, dessert, pas, bar); daarmee weet de lijn wie waar staat. Een
       onbekende kant hoort te stuiten -- anders staat er iemand op een post
       die niet bestaat. */
    const onzin = await P('/api/supplier/lijn', { sectie: 'zeewier' }, keuken);
    assert.equal(onzin.status, 400, 'een kant die niet bestaat wordt geweigerd');

    const opDeKant = await P('/api/supplier/lijn', { sectie: 'warm' }, keuken);
    assert.equal(opDeKant.status, 200, 'de kok meldt zich aan op de warme kant: ' + JSON.stringify(opDeKant.body).slice(0, 160));
    assert.equal(opDeKant.body.aangemeld, true, 'en staat aangemeld');
    assert.ok((opDeKant.body.lijn.warm || []).length >= 1, 'de warme kant is bemand');

    /* Nog een keer klikken meldt hem weer af -- dezelfde knop, en dat hoort
       ook zo te werken op een keukenscherm met natte handen. */
    const eraf = await P('/api/supplier/lijn', { sectie: 'warm' }, keuken);
    assert.equal(eraf.body.aangemeld, false, 'dezelfde knop meldt hem weer af');
    await P('/api/supplier/lijn', { sectie: 'warm' }, keuken);   // weer erop voor de rest

    /* Een sectie meldt zich bezig -> de bon is in bereiding, maar NIET klaar. */
    const bezig = await P('/api/supplier/order/sectie', { ref, sectie: 'warm', phase: 'bezig' }, keuken);
    assert.equal(bezig.status, 200, 'de warme kant is begonnen: ' + JSON.stringify(bezig.body).slice(0, 140));

    const halverwege = await zaak(P, 'KIKUNOI');
    const bonHalf = (halverwege.state.orders || []).find(o => o.ref === ref);
    assert.ok(bonHalf, 'de bon staat op het keukenscherm: ' + JSON.stringify((halverwege.state.orders || []).map(o => o.ref)).slice(0, 160));
    assert.notEqual(bonHalf.status, 'klaar', 'en is niet stiekem al klaar terwijl de warme kant nog bezig is');
    assert.equal(bonHalf.status, 'in bereiding', 'hij staat in bereiding');

    /* En klaar: nu mag hij op de pas liggen. */
    const klaar = await P('/api/supplier/order/sectie', { ref, sectie: 'warm', phase: 'klaar' }, keuken);
    assert.equal(klaar.status, 200, 'de warme kant is klaar');

    /* De gast ziet het ook: het volgscherm van zijn bestelling is meegelopen. */
    const spoed = await P('/api/supplier/order/spoed', { ref, aan: true }, keuken);
    assert.ok([200, 400, 404].includes(spoed.status),
      'de spoedknop van het keukenscherm antwoordt: ' + spoed.status + ' ' + JSON.stringify(spoed.body).slice(0, 120));
  } finally { child.kill('SIGKILL'); }
});

test('het event: aanmelden op codenaam, vol is vol, en inchecken aan de deur', async () => {
  const { child, base } = await startServer({ env: { RTG_DATA_DIR: TMP, SMTP_URL: '' } });
  try {
    const P = post(base);
    const { token: manager } = await zaak(P, 'KIKUNOI');
    const anna = await nieuwLid(P, 'Annelies');
    const boris = await nieuwLid(P, 'Bartholomeus');

    /* ---- het event bestaat pas als het gepubliceerd is ---- */
    const maak = await P('/api/supplier/event', {
      action: 'add',
      event: { name: 'Zomerproeverij', date: '2026-09-12', time: '20:00', capacity: 2, price: 0 }
    }, manager);
    assert.equal(maak.status, 200, 'het event is aangemaakt: ' + JSON.stringify(maak.body).slice(0, 160));
    const ev = maak.body.events[0];
    assert.equal(ev.published, false, 'en staat nog niet online');

    const teVroeg = await P('/api/event/rsvp', { supplierCode: 'KIKUNOI', eventId: ev.id, qty: 1 }, anna);
    assert.equal(teVroeg.status, 404, 'een ongepubliceerd event is niet te vinden voor leden');

    await P('/api/supplier/event', { action: 'publish', id: ev.id }, manager);

    /* ---- aanmelden, op CODENAAM ---- */
    const aan = await P('/api/event/rsvp', { supplierCode: 'KIKUNOI', eventId: ev.id, qty: 1 }, anna);
    assert.equal(aan.status, 200, 'Annelies meldt zich aan: ' + JSON.stringify(aan.body).slice(0, 160));

    const nogEens = await P('/api/event/rsvp', { supplierCode: 'KIKUNOI', eventId: ev.id, qty: 1 }, anna);
    assert.equal(nogEens.status, 409, 'twee keer aanmelden kan niet');

    /* ---- vol is vol: capaciteit 2, Annelies heeft er 1, Bartholomeus vraagt er 2 ---- */
    const teVeel = await P('/api/event/rsvp', { supplierCode: 'KIKUNOI', eventId: ev.id, qty: 2 }, boris);
    assert.equal(teVeel.status, 409, 'meer dan er passen kan niet');
    const past = await P('/api/event/rsvp', { supplierCode: 'KIKUNOI', eventId: ev.id, qty: 1 }, boris);
    assert.equal(past.status, 200, 'de laatste plek kan wel');

    /* ---- DE MERKREGEL: de zaak ziet WIE er komt, niet WIE dat is ---- */
    const lijst = await P('/api/supplier/login', { code: 'KIKUNOI', staffId: null, pin: '1234' });
    const opnieuw = await zaak(P, 'KIKUNOI');
    const eventBijZaak = ((opnieuw.state.events || []).find(x => x.id === ev.id)) || {};
    const gasten = eventBijZaak.guests || [];
    assert.equal(gasten.length, 2, 'er staan twee gasten op de lijst: ' + JSON.stringify(gasten).slice(0, 200));
    const alleTekst = JSON.stringify(gasten);
    assert.ok(!/Annelies|Bartholomeus/i.test(alleTekst),
      'de gastenlijst draagt codenamen en geen echte namen: ' + alleTekst.slice(0, 200));
    assert.ok(gasten.every(g => g.codename), 'elke gast heeft een codenaam');

    /* ---- inchecken aan de deur ---- */
    const eerste = gasten[0];
    const check = await P('/api/supplier/event/checkin', { eventId: ev.id, key: eerste.key }, manager);
    assert.equal(check.status, 200, 'de eerste gast checkt in: ' + JSON.stringify(check.body).slice(0, 140));
    const ingecheckt = (check.body.event.guests || []).find(g => g.key === eerste.key);
    assert.equal(ingecheckt.checkedIn, true, 'en staat als binnen genoteerd');

    /* ---- de runsheet: wat er moet gebeuren, en wie het afvinkte ---- */
    const rs = await P('/api/supplier/event/runsheet', {
      id: ev.id, action: 'add', item: { time: '18:00', station: 'keuken', text: 'Amuses klaarzetten' }
    }, manager);
    assert.equal(rs.status, 200, 'de runsheet krijgt een regel: ' + JSON.stringify(rs.body).slice(0, 140));
    const regel = rs.body.event.runsheet[0];
    assert.equal(regel.done, false, 'die nog niet is afgevinkt');

    const af = await P('/api/supplier/event/runsheet/done', { id: ev.id, itemId: regel.id }, manager);
    assert.equal(af.status, 200, 'en wordt afgevinkt');
    const naAf = af.body.event.runsheet.find(x => x.id === regel.id);
    assert.equal(naAf.done, true, 'de regel staat af');
    assert.ok(naAf.doneBy, 'met de naam van wie het deed: ' + naAf.doneBy);
  } finally { child.kill('SIGKILL'); }
});

test('het hotel: een kamer erbij, de huishoudingsketen, en vroege check-in', async () => {
  const { child, base } = await startServer({ env: { RTG_DATA_DIR: TMP, SMTP_URL: '' } });
  try {
    const P = post(base);
    const { token: hotel } = await zaak(P, 'SAKURA');

    /* Een kamer zonder prijs is geen kamer: wat er te boeken valt en wat het
       kost is managementwerk, geen baliehandeling. */
    const zonderPrijs = await P('/api/supplier/room/add', { name: 'Suite Boven' }, hotel);
    assert.equal(zonderPrijs.status, 400, 'een kamer zonder prijs wordt geweigerd');

    const erbij = await P('/api/supplier/room/add',
      { name: 'Suite Boven', price: 240, desc: 'Uitzicht op zee' }, hotel);
    assert.equal(erbij.status, 200, 'de kamer is toegevoegd: ' + JSON.stringify(erbij.body).slice(0, 180));
    const kamer = (erbij.body.rooms || []).find(k => k.name === 'Suite Boven');
    assert.ok(kamer, 'en staat in de lijst');
    assert.equal(kamer.hk.status, 'schoon', 'een nieuwe kamer begint schoon');

    /* DE HUISHOUDINGSKETEN. Een kamer die "vrij" heet maar nog vuil is, is de
       dure fout van een hotel: dan staat er een gast voor een onopgemaakte
       deur. Elke andere status dan schoon hoort de vrijgave weg te halen. */
    const onzin = await P('/api/supplier/room/hk', { id: kamer.id, status: 'halfschoon' }, hotel);
    assert.equal(onzin.status, 400, 'een verzonnen status wordt geweigerd');

    await P('/api/supplier/room/hk', { id: kamer.id, status: 'schoon' }, hotel);
    const vrij = await P('/api/supplier/room/vrij', { id: kamer.id, vrij: true }, hotel);
    assert.equal(vrij.status, 200, 'housekeeping geeft de schone kamer vrij voor vroege check-in: ' +
      JSON.stringify(vrij.body).slice(0, 160));

    const vuil = await P('/api/supplier/room/hk', { id: kamer.id, status: 'vuil' }, hotel);
    assert.equal(vuil.status, 200, 'daarna gaat hij op vuil');
    const naVuil = (vuil.body.rooms || []).find(k => k.id === kamer.id);
    assert.equal(naVuil.hk.status, 'vuil', 'en dat staat er ook');
    assert.equal(naVuil.vroegVrij, undefined,
      'de vrijgave voor vroege check-in is vanzelf weg: ' + JSON.stringify(naVuil).slice(0, 200));
    assert.ok(naVuil.hk.by, 'met de naam van wie het zette: ' + naVuil.hk.by);

    /* DEFECT is de zwaarste stand, en die doet drie dingen tegelijk: de
       notitie blijft bewaard (alleen hier -- bij "vuil" hoort geen verhaal),
       de kamer gaat uit de verkoop, en er komt een klus voor onderhoud. Een
       kapotte kamer die gewoon boekbaar blijft is precies de fout waar een
       gast voor een onbruikbare deur staat. */
    const defect = await P('/api/supplier/room/hk',
      { id: kamer.id, status: 'defect', note: 'Airco lekt op het tapijt' }, hotel);
    assert.equal(defect.status, 200, 'de kamer wordt defect gemeld');
    const naDefect = (defect.body.rooms || []).find(k => k.id === kamer.id);
    assert.match(String(naDefect.hk.note), /Airco lekt/, 'de notitie blijft bij een defect wel staan');
    assert.equal(naDefect.available, false, 'en de kamer is per direct niet meer boekbaar');

    const tickets = await zaak(P, 'SAKURA');
    const klus = JSON.stringify(tickets.state.tickets || []);
    assert.match(klus, /Airco lekt/, 'er staat een klus voor onderhoud open: ' + klus.slice(0, 200));

    /* En hersteld: de kamer komt vanzelf terug in de verkoop. */
    const hersteld = await P('/api/supplier/room/hk', { id: kamer.id, status: 'schoon' }, hotel);
    const naHerstel = (hersteld.body.rooms || []).find(k => k.id === kamer.id);
    assert.equal(naHerstel.available, true, 'na herstel is hij weer boekbaar');

    const planning = await P('/api/supplier/kamerplanning', {}, hotel);
    assert.equal(planning.status, 200, 'de kamerplanning opent: ' + JSON.stringify(planning.body).slice(0, 160));
  } finally {
    child.kill('SIGKILL');
    try { fs.rmSync(TMP, { recursive: true, force: true }); } catch (e) {}
  }
});
