/* ELKE BETAALDE LIDTRANSACTIE LEVERT EEN FACTUUR OP -- en dus btw.

   Dit is de toets bij de reparatie in kern/lidacties/factuur.js. De aanleiding
   stond als caveat in de btw-aangifte: "omzet zonder factuur staat er niet in".
   Dat was waar, en het was een pleister: de bestelling, de rekening, de boeking
   en de rit van het lid boekten helemaal geen factuur, dus die omzet kwam nooit
   in het factuurregister en dus nooit in de aangifte -- terwijl de
   maandboekhouding van dezelfde zaak hem wel gewoon telde. Twee cijfers over
   dezelfde omzet, en het ene wist niet dat het andere bestond.

   Wat hier wordt vastgelegd, en waarom in deze volgorde:
     1  elk van de zes betaalwegen boekt EEN factuur, op de ref van de bon
     2  precies EEN: twee wegen naar dezelfde bon geven geen twee facturen
     3  het bedrag op de factuur is het bedrag dat de boekhouding telt
     4  en daarmee komt de btw-aangifte uit op de omzet van dezelfde maand,
        over beide tarieven -- keuken en bar
     5  en een factuur die NIET lukt valt niet stil (toets 8)
     6  een post op de kamer of de tafel is nog GEEN verkoop: die wordt pas
        gefactureerd bij het afrekenen, en dan precies een keer

   Punt 3 en 4 zijn het hele doel. Een factuur die er wel is maar een ander
   bedrag draagt, is geen reparatie maar een derde cijfer erbij.

   De twee dubbeltellingen aan de ANDERE kant -- de cadeaukaart en het
   tafelticket op 'contant' (TAKEN.md 4.27 en 4.28) -- stonden hier als
   caveat: ze zaten niet in toets 7, want ze zeiden niets over die reparatie.
   Ze zijn nu gerepareerd en staan in het laatste deel van dit bestand, apart
   gehouden om dezelfde reden: het is een defect aan de kant van de
   BOEKHOUDING, en de maat is dan ook een andere (de boekhouding tegen de som
   van de bonnen, niet de aangifte tegen de boekhouding). Daar staat ook het
   verschil tussen de twee vragen die de kassa en de boekhouding stellen --
   ging dit geld door de la, tegen draagt deze bon omzet -- want dat verschil
   is bij het repareren twee keer de verkeerde kant op gegaan.

   Draai los: node --experimental-sqlite --test test/lidfactuur.test.js */
const test = require('node:test');
const assert = require('node:assert/strict');
const { startServer, stop } = require('./helper');
const fs = require('fs'); const os = require('os'); const path = require('path');

function verseDataDir() { return fs.mkdtempSync(path.join(os.tmpdir(), 'rtg-lidfac-')); }
async function api(base, pad, body, token) {
  const h = { 'Content-Type': 'application/json' }; if (token) h.Authorization = 'Bearer ' + token;
  const r = await fetch(base + pad, { method: 'POST', headers: h, body: JSON.stringify(body || {}) });
  return { status: r.status, body: await r.json().catch(() => ({})) };
}
async function registreer(base, naam) {
  const u = Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
  return (await api(base, '/api/auth/register', {
    name: naam || 'Factuur Lid', email: u + '@x.nl',
    phone: '06' + u.replace(/\D/g, '').padEnd(8, '1').slice(0, 8),
    password: 'geheim123', geboortedatum: '1990-01-01', tier: 'business', pasApp: 'business'
  })).body.token;
}
// de manager van een zaak, want de kassa en de boekhouding zijn managementwerk
async function managerVan(base, code) {
  const roster = (await api(base, '/api/supplier/roster', { code })).body;
  const mgr = (roster.staff || []).find(x => x.role === 'manager') || (roster.staff || [])[0];
  return (await api(base, '/api/supplier/login', { code, staffId: mgr.id, pin: '1234' })).body.token;
}
async function eersteItem(base, token, code) {
  const kaart = (await api(base, '/api/supplier/menu/get', { code }, token)).body;
  const m = (kaart.menu || []).find(x => !x.uitverkocht && x.station !== 'bar') || (kaart.menu || [])[0];
  return m ? m.id : 'm1';
}
// alle facturen die deze zaak heeft UITGESCHREVEN, op ref
async function facturenOpRef(base, mgrTok, ref) {
  const f = await api(base, '/api/supplier/facturen/mijn', {}, mgrTok);
  assert.equal(f.status, 200, 'de facturenlijst van de zaak');
  return (f.body.verkocht || []).filter(x => x.ref === ref);
}
// de facturatiemotor boekt in een losse belofte; de route antwoordt eerder
const even = () => new Promise(r => setTimeout(r, 400));

/* -------------------------------------------------------------------------
   1. de vier wegen in de app: bestelling, rekening, boeking, rit
   ------------------------------------------------------------------------- */
test('1. een betaalde bestelling in de app levert precies EEN factuur op, op de ref van de bon', async () => {
  const TMP = verseDataDir();
  const { child, base } = await startServer({ env: { SMTP_URL: '', RTG_DATA_DIR: TMP } });
  try {
    const lid = await registreer(base);
    const mgr = await managerVan(base, 'KIKUNOI');
    const item = await eersteItem(base, lid, 'KIKUNOI');

    const o = await api(base, '/api/order', { supplierCode: 'KIKUNOI', items: [{ id: item, qty: 2 }] }, lid);
    assert.equal(o.status, 200);
    const ref = o.body.order.ref, totaal = o.body.order.total;

    // NOG NIET betaald = nog geen factuur. Een factuur bij het plaatsen zou een
    // bon factureren die het lid nog kan laten lopen.
    await even();
    assert.deepEqual(await facturenOpRef(base, mgr, ref), [], 'een onbetaalde bon heeft geen factuur');

    assert.equal((await api(base, '/api/order/pay', { ref }, lid)).status, 200);
    await even();
    const fac = await facturenOpRef(base, mgr, ref);
    assert.equal(fac.length, 1, 'precies een factuur na betaling');
    assert.equal(fac[0].totaal, totaal, 'en voor het bedrag van de bon');
    assert.ok(fac[0].btwBedrag > 0, 'met btw erop, anders bereikt hij de aangifte niet');
    assert.equal(fac[0].koperCodenaam, o.body.order.customerCodename,
      'de koper staat op codenaam; de echte naam blijft in de kluis');
    assert.ok(!JSON.stringify(fac[0]).includes('Factuur Lid'), 'de echte naam staat nergens op de factuur');
  } finally {
    stop(child);
    try { fs.rmSync(TMP, { recursive: true, force: true }); } catch (e) {}
  }
});

test('2. de gezamenlijke rekening geeft een factuur PER BON, en de fooi staat er niet op', async () => {
  const TMP = verseDataDir();
  const { child, base } = await startServer({ env: { SMTP_URL: '', RTG_DATA_DIR: TMP } });
  try {
    const mgr = await managerVan(base, 'KIKUNOI');
    await api(base, '/api/supplier/settings', { code: 'KIKUNOI', opties: { betaalVooraf: false } }, mgr);
    const lid = await registreer(base);
    const item = await eersteItem(base, lid, 'KIKUNOI');

    const r1 = await api(base, '/api/order', { supplierCode: 'KIKUNOI', items: [{ id: item, qty: 1 }], table: '7' }, lid);
    const r2 = await api(base, '/api/order', { supplierCode: 'KIKUNOI', items: [{ id: item, qty: 2 }], table: '7' }, lid);
    assert.equal(r1.body.order.betaalMoment, 'achteraf', 'de zaak laat achteraf betalen');

    const bet = await api(base, '/api/rekening/betaal', { supplierCode: 'KIKUNOI', fooi: 5 }, lid);
    assert.equal(bet.status, 200);
    await even();

    const f1 = await facturenOpRef(base, mgr, r1.body.order.ref);
    const f2 = await facturenOpRef(base, mgr, r2.body.order.ref);
    assert.equal(f1.length, 1, 'bon 1 heeft zijn eigen factuur');
    assert.equal(f2.length, 1, 'bon 2 ook');
    assert.equal(f1[0].totaal, r1.body.order.total);
    assert.equal(f2[0].totaal, r2.body.order.total);
    /* De fooi gaat naar het team en is geen omzet van de zaak. Stond hij op de
       factuur, dan droeg de zaak btw af over geld dat ze nooit heeft gehad. */
    assert.equal(f1[0].totaal + f2[0].totaal, bet.body.rekening.subtotaal,
      'samen de rekening zonder fooi');
    assert.ok(bet.body.rekening.betaald > bet.body.rekening.subtotaal, 'er is wel degelijk fooi betaald');
  } finally {
    stop(child);
    try { fs.rmSync(TMP, { recursive: true, force: true }); } catch (e) {}
  }
});

test('3. een betaalde boeking en een betaalde rit leveren allebei een factuur op', async () => {
  const TMP = verseDataDir();
  const { child, base } = await startServer({ env: { SMTP_URL: '', RTG_DATA_DIR: TMP } });
  try {
    const lid = await registreer(base);

    // een dienst boeken bij een zelfstandige
    const mgrB = await managerVan(base, 'CASTELL');
    const b = await api(base, '/api/booking/request', { supplierCode: 'CASTELL', serviceId: 'b1' }, lid);
    assert.equal(b.status, 200, JSON.stringify(b.body).slice(0, 200));
    assert.equal((await api(base, '/api/booking/pay', { ref: b.body.boeking.ref }, lid)).status, 200);
    await even();
    const fb = await facturenOpRef(base, mgrB, b.body.boeking.ref);
    assert.equal(fb.length, 1, 'de boeking heeft een factuur');
    assert.equal(fb[0].totaal, b.body.boeking.price);
    assert.equal(fb[0].soort, 'dienst', 'een boeking is een dienst en geen verkoop');

    // en een rit
    const mgrR = await managerVan(base, 'MKKX');
    const rit = await api(base, '/api/ride/request', { supplierCode: 'MKKX', toCode: 'KIKUNOI', passengers: 1 }, lid);
    assert.equal(rit.status, 200, JSON.stringify(rit.body).slice(0, 200));
    assert.equal((await api(base, '/api/ride/pay', { ref: rit.body.ride.ref }, lid)).status, 200);
    await even();
    const fr = await facturenOpRef(base, mgrR, rit.body.ride.ref);
    assert.equal(fr.length, 1, 'de rit heeft een factuur');
    assert.equal(fr[0].totaal, rit.body.ride.quote);
  } finally {
    stop(child);
    try { fs.rmSync(TMP, { recursive: true, force: true }); } catch (e) {}
  }
});

/* -------------------------------------------------------------------------
   2. de twee wegen aan de balie -- en vooral: NIET twee keer
   ------------------------------------------------------------------------- */
test('4. de balie int een onbetaalde bon op de ophaalcode: een factuur, en de betaaldatum staat erop', async () => {
  const TMP = verseDataDir();
  const { child, base } = await startServer({ env: { SMTP_URL: '', RTG_DATA_DIR: TMP } });
  try {
    const mgr = await managerVan(base, 'KIKUNOI');
    const lid = await registreer(base);
    const item = await eersteItem(base, lid, 'KIKUNOI');
    const o = await api(base, '/api/order', { supplierCode: 'KIKUNOI', items: [{ id: item, qty: 1 }], naarKassa: true }, lid);
    assert.equal(o.status, 200);
    assert.equal(o.body.order.paid, false, 'aan de balie betaal je aan de balie');
    const ref = o.body.order.ref;

    const inn = await api(base, '/api/supplier/pos/redeem', { code: o.body.order.pickup }, mgr);
    assert.equal(inn.status, 200, JSON.stringify(inn.body).slice(0, 200));
    assert.equal(inn.body.order.wasPaid, false, 'de balie heeft hem echt geind');
    await even();

    const fac = await facturenOpRef(base, mgr, ref);
    assert.equal(fac.length, 1, 'de balie-inning levert een factuur op');
    assert.equal(fac[0].totaal, o.body.order.total);

    /* En de bon draagt het MOMENT van betalen. Dit was de enige betaalweg die
       geen paidAt zette, en de hele verslaglegging valt daarop terug -- zonder
       zou een bon van vorige maand vandaag geind in de VORIGE maand tellen,
       terwijl zijn factuur de datum van vandaag draagt. */
    const mijn = (await api(base, '/api/orders/mine', {}, lid)).body.orders;
    const bon = mijn.find(x => x.ref === ref);
    assert.ok(bon.paidAt, 'de bon draagt een betaalmoment');
    assert.equal(String(bon.paidAt).slice(0, 10), fac[0].datum,
      'en dat is dezelfde dag als de factuur');
  } finally {
    stop(child);
    try { fs.rmSync(TMP, { recursive: true, force: true }); } catch (e) {}
  }
});

test('5. een bon die al in de app is betaald, wordt aan de balie NIET nog eens gefactureerd', async () => {
  const TMP = verseDataDir();
  const { child, base } = await startServer({ env: { SMTP_URL: '', RTG_DATA_DIR: TMP } });
  try {
    const mgr = await managerVan(base, 'KIKUNOI');
    const lid = await registreer(base);
    const item = await eersteItem(base, lid, 'KIKUNOI');
    const o = await api(base, '/api/order', { supplierCode: 'KIKUNOI', items: [{ id: item, qty: 1 }] }, lid);
    const ref = o.body.order.ref;
    assert.equal((await api(base, '/api/order/pay', { ref }, lid)).status, 200);
    await even();
    assert.equal((await facturenOpRef(base, mgr, ref)).length, 1, 'na de app-betaling: een');

    // en dan komt hij zijn bestelling ophalen
    const inn = await api(base, '/api/supplier/pos/redeem', { code: o.body.order.pickup }, mgr);
    assert.equal(inn.status, 200);
    assert.equal(inn.body.order.wasPaid, true, 'de balie ziet dat er al betaald is');
    await even();
    assert.equal((await facturenOpRef(base, mgr, ref)).length, 1,
      'nog steeds EEN: uitgeven is geen tweede transactie');
  } finally {
    stop(child);
    try { fs.rmSync(TMP, { recursive: true, force: true }); } catch (e) {}
  }
});

test('6. een tafelticket in een keer afrekenen factureert elke bon aan de tafel apart', async () => {
  const TMP = verseDataDir();
  const { child, base } = await startServer({ env: { SMTP_URL: '', RTG_DATA_DIR: TMP } });
  try {
    const mgr = await managerVan(base, 'KIKUNOI');
    await api(base, '/api/supplier/settings', { code: 'KIKUNOI', opties: { betaalVooraf: false } }, mgr);
    const tafel = '7';
    const lid = await registreer(base);
    const item = await eersteItem(base, lid, 'KIKUNOI');
    const r1 = await api(base, '/api/order', { supplierCode: 'KIKUNOI', items: [{ id: item, qty: 1 }], table: tafel }, lid);
    const r2 = await api(base, '/api/order', { supplierCode: 'KIKUNOI', items: [{ id: item, qty: 3 }], table: tafel }, lid);
    assert.equal(r2.status, 200);

    const tk = await api(base, '/api/supplier/tafelticket', { table: tafel }, mgr);
    assert.equal(tk.status, 200, JSON.stringify(tk.body).slice(0, 200));
    assert.equal(tk.body.ticket.aantalBonnen, 2, 'beide bonnen staan op het ticket');
    const af = await api(base, '/api/supplier/tafelticket/afrekenen',
      { table: tafel, zegel: tk.body.ticket.zegel, at: tk.body.ticket.at, method: 'contant' }, mgr);
    assert.equal(af.status, 200, JSON.stringify(af.body).slice(0, 200));
    await even();

    const f1 = await facturenOpRef(base, mgr, r1.body.order.ref);
    const f2 = await facturenOpRef(base, mgr, r2.body.order.ref);
    assert.equal(f1.length, 1, 'bon 1 aan tafel heeft een factuur');
    assert.equal(f2.length, 1, 'bon 2 aan tafel ook');
    assert.equal(f1[0].totaal + f2[0].totaal, af.body.subtotaal,
      'samen precies het tafelticket');
    assert.equal(f1[0].methode, 'contant', 'de betaalwijze van de kassa reist mee');
  } finally {
    stop(child);
    try { fs.rmSync(TMP, { recursive: true, force: true }); } catch (e) {}
  }
});

/* -------------------------------------------------------------------------
   3. HET DOEL: de aangifte en de boekhouding tellen dezelfde omzet
   ------------------------------------------------------------------------- */
test('7. de btw-aangifte komt uit op de omzet die de maandboekhouding telt', async () => {
  const TMP = verseDataDir();
  const { child, base } = await startServer({ env: { SMTP_URL: '', RTG_DATA_DIR: TMP } });
  try {
    const mgr = await managerVan(base, 'KIKUNOI');
    const lid = await registreer(base);
    const item = await eersteItem(base, lid, 'KIKUNOI');
    /* En een BAR-artikel, want de boekhouding telt de bar apart tegen het
       standaardtarief. Zonder een tweede tarief in deze toets zou een factuur
       die alles op het lage tarief zet er ongestraft doorheen komen -- precies
       de fout die per regel is gerepareerd. */
    const kaart = (await api(base, '/api/supplier/menu/get', { code: 'KIKUNOI' }, lid)).body;
    const bar = (kaart.menu || []).find(x => x.station === 'bar');
    assert.ok(bar, 'de zaak heeft een baritem; anders meet deze toets maar een tarief');

    /* Vier bonnen langs drie verschillende wegen -- in de app, aan de balie op
       de ophaalcode, en nog een in de app. Precies de mix waarin het mis ging:
       de balie-bon werd door financeVoor via de order geteld en door de
       aangifte helemaal niet. */
    const refs = [];
    for (const n of [1, 2]) {
      const o = await api(base, '/api/order', { supplierCode: 'KIKUNOI', items: [{ id: item, qty: n }] }, lid);
      assert.equal((await api(base, '/api/order/pay', { ref: o.body.order.ref }, lid)).status, 200);
      refs.push(o.body.order.ref);
    }
    const drank = await api(base, '/api/order', { supplierCode: 'KIKUNOI', items: [{ id: bar.id, qty: 3 }] }, lid);
    assert.equal((await api(base, '/api/order/pay', { ref: drank.body.order.ref }, lid)).status, 200);
    refs.push(drank.body.order.ref);
    const balie = await api(base, '/api/order', { supplierCode: 'KIKUNOI', items: [{ id: item, qty: 4 }], naarKassa: true }, lid);
    assert.equal((await api(base, '/api/supplier/pos/redeem', { code: balie.body.order.pickup }, mgr)).status, 200);
    refs.push(balie.body.order.ref);
    await even();

    /* Wat de maandboekhouding telt. Let op WELK getal: `omzet` is inclusief
       btw, `grondslag` is eraf. De aangifte rekent in grondslag (dat is wat er
       in rubriek 1a hoort te staan), dus dat is de kant waar ze elkaar moeten
       raken -- ze naast elkaar leggen op `omzet` zou negen procent verschil
       geven dat niets met deze reparatie te maken heeft. */
    const fin = await api(base, '/api/supplier/finance', {}, mgr);
    assert.equal(fin.status, 200);
    const omzetBoekhouding = Math.round((fin.body.btw || []).reduce((s, r) => s + r.grondslag, 0) * 100);
    const btwBoekhouding = Math.round((fin.body.btwTotaal || 0) * 100);
    assert.ok(omzetBoekhouding > 0, 'de boekhouding telt deze omzet');
    const tarieven = (fin.body.btw || []).map(r => r.tarief).sort();
    assert.equal(new Set(tarieven).size, 2, 'er staan echt TWEE tarieven in de boekhouding (eten en drank)');

    // en wat de btw-aangifte over dezelfde maand telt
    const maand = fin.body.maand;
    const op = await api(base, '/api/supplier/btw/opmaken', { periode: maand }, mgr);
    assert.equal(op.status, 200, JSON.stringify(op.body).slice(0, 200));
    const omzetAangifte = (op.body.aangifte.tarieven || []).reduce((s, t) => s + t.omzetCenten, 0);

    /* DIT is de reparatie. Vóór deze ronde stond hier nul tegenover de volle
       omzet: geen van deze drie bonnen boekte een factuur, en de aangifte telt
       het factuurregister. */
    assert.equal(omzetAangifte, omzetBoekhouding,
      'de aangifte telt exact de omzet van de maandboekhouding');
    assert.equal(op.body.aangifte.verschuldigdCenten, btwBoekhouding,
      'en dezelfde af te dragen btw');
    assert.deepEqual((op.body.aangifte.tarieven || []).map(t => t.tarief).sort(), tarieven,
      'en op DEZELFDE tarieven: de bon van de gast zet de bar niet op het lage tarief');
    for (const ref of refs) assert.equal((await facturenOpRef(base, mgr, ref)).length, 1, ref + ' precies een factuur');
  } finally {
    stop(child);
    try { fs.rmSync(TMP, { recursive: true, force: true }); } catch (e) {}
  }
});

/* -------------------------------------------------------------------------
   4. EEN FACTUUR DIE MISLUKT, VALT NIET STIL

   De zeven toetsen hierboven kijken naar het geval waarin het GOED gaat. Een
   mutatie op de melder (de twee handlers vervangen door lege functies) kwam er
   ongestraft doorheen -- terwijl juist die melder de reden is dat dit gat niet
   opnieuw kan ontstaan zonder dat iemand het ziet. LAT.md regel 5: niets faalt
   stil. Een regel die niets bewaakt, is geen regel.

   Hier zonder server: de helper krijgt een nep-motor die eerst NEE zegt en
   daarna ONTPLOFT, en de fout-aggregatie van server/log.js (dezelfde die het
   techniekbord leest) moet ze allebei geteld hebben.
   ------------------------------------------------------------------------- */
const { maakFactuurVoorLid } = require('../server/kern/lidacties/factuur');
const { log } = require('../server/log');

test('8. een factuur die NIET lukt komt op het techniekbord, en trekt de betaling niet omver', async () => {
  const bon = { supplierCode: 'X', supplierNaam: 'Zaak', codenaam: 'Gast',
    regels: [{ omschrijving: 'Iets', aantal: 1, stuk: 10 }] };

  // 1. de motor zegt netjes NEE ({ error: ... }) -- geen uitzondering, dus dit
  //    is precies de vorm die een lege catch zou inslikken
  log.foutenReset();
  maakFactuurVoorLid({ boekMetCodenaam: async () => ({ error: 'Geen bedrag om te factureren.' }) })
    (Object.assign({ ref: 'REF-NEE' }, bon));
  await new Promise(r => setTimeout(r, 50));
  const naNee = log.foutenSamenvatting();
  assert.equal(naNee.totaal, 1, 'een nette weigering wordt geteld');
  assert.match(naNee.recent[0].bericht, /Geen bedrag/, 'met de reden van de motor erin');

  // 2. de motor ontploft
  log.foutenReset();
  maakFactuurVoorLid({ boekMetCodenaam: async () => { throw new Error('opslag onbereikbaar'); } })
    (Object.assign({ ref: 'REF-BOEM' }, bon));
  await new Promise(r => setTimeout(r, 50));
  const naBoem = log.foutenSamenvatting();
  assert.equal(naBoem.totaal, 1, 'een afgewezen belofte wordt ook geteld');
  assert.match(naBoem.recent[0].bericht, /opslag onbereikbaar/);

  /* 3. en in geen van beide gevallen komt de fout naar buiten: de klant heeft
        betaald, en die betaling mag niet omvallen omdat de factuur hapert. */
  log.foutenReset();
  assert.doesNotThrow(() => maakFactuurVoorLid({ boekMetCodenaam: () => { throw new Error('meteen stuk'); } })
    (Object.assign({ ref: 'REF-SYNC' }, bon)), 'een synchrone knal blijft binnen');
  assert.equal(log.foutenSamenvatting().totaal, 1, 'en wordt geteld');

  // zonder facturatiemotor gebeurt er niets, en dat is geen fout
  log.foutenReset();
  maakFactuurVoorLid(null)(Object.assign({ ref: 'REF-GEEN' }, bon));
  assert.equal(log.foutenSamenvatting().totaal, 0, 'geen motor is geen storing');
  log.foutenReset();
});

/* -------------------------------------------------------------------------
   5. DE ANDERE KANT: de boekhouding telde zelf dubbel

   Toets 7 hierboven legt de ene richting vast (de aangifte miste omzet die de
   boekhouding wel had). Deze twee leggen de andere richting vast: de
   boekhouding telde een bedrag twee keer terwijl de aangifte het een keer had.
   Dat komt allebei uit dezelfde vorm -- een BUNDEL die naast zijn onderdelen
   werd geteld -- maar langs twee verschillende wegen, dus twee toetsen.

   De maat is hier bewust NIET "aangifte gelijk aan boekhouding" alleen. Twee
   getallen die allebei fout zijn kunnen ook gelijk zijn; daarom wordt de
   boekhouding eerst tegen de SOM VAN DE BONNEN gelegd -- een derde getal dat
   niet uit dezelfde optelling komt.
   ------------------------------------------------------------------------- */
test('9. een tafelticket op contant telt EEN keer: de boekhouding is de som van de bonnen', async () => {
  const TMP = verseDataDir();
  const { child, base } = await startServer({ env: { SMTP_URL: '', RTG_DATA_DIR: TMP } });
  try {
    const mgr = await managerVan(base, 'KIKUNOI');
    await api(base, '/api/supplier/settings', { code: 'KIKUNOI', opties: { betaalVooraf: false } }, mgr);
    const tafel = '7';
    const lid = await registreer(base);
    const item = await eersteItem(base, lid, 'KIKUNOI');
    const r1 = await api(base, '/api/order', { supplierCode: 'KIKUNOI', items: [{ id: item, qty: 1 }], table: tafel }, lid);
    const r2 = await api(base, '/api/order', { supplierCode: 'KIKUNOI', items: [{ id: item, qty: 3 }], table: tafel }, lid);
    assert.equal(r2.status, 200, JSON.stringify(r2.body).slice(0, 200));
    const somBonnen = Math.round((r1.body.order.total + r2.body.order.total) * 100);

    const tk = await api(base, '/api/supplier/tafelticket', { table: tafel }, mgr);
    assert.equal(tk.status, 200, JSON.stringify(tk.body).slice(0, 200));
    const af = await api(base, '/api/supplier/tafelticket/afrekenen',
      { table: tafel, zegel: tk.body.ticket.zegel, at: tk.body.ticket.at, method: 'contant' }, mgr);
    assert.equal(af.status, 200, JSON.stringify(af.body).slice(0, 200));
    assert.equal(Math.round(af.body.subtotaal * 100), somBonnen, 'het ticket is de som van de bonnen');
    await even();

    /* DIT is de reparatie. Hiervoor stond hier het dubbele: de twee
       bestellingen werden geteld EN de gebundelde kassabon die er overheen
       gaat. `omzet` is inclusief btw, net als het bedrag op de bon. */
    const fin = await api(base, '/api/supplier/finance', {}, mgr);
    assert.equal(fin.status, 200);
    const omzetBoekhouding = Math.round((fin.body.btw || []).reduce((s, r) => s + r.omzet, 0) * 100);
    assert.equal(omzetBoekhouding, somBonnen,
      'de maandboekhouding telt de tafel EEN keer, niet twee');

    /* En de aangifte, die de FACTUREN telt, komt op dezelfde omzet uit -- met
       een marge van een cent per factuur, en dat is geen slordigheid maar de
       vorm. Een factuur staat in hele centen, dus de btw wordt per factuur
       afgerond; de boekhouding rondt een keer over de hele pot. Hier: 16,00 en
       48,00 tegen 10% geven per factuur 14,55 + 43,64 = 58,19 grondslag, en in
       een keer over 64,00 komt er 58,18 uit. Toets 7 hierboven eist exacte
       gelijkheid en dat gaat daar goed, maar dat is het TOEVAL van de bedragen
       en geen belofte van de code -- zie TAKEN.md 6.14. Wat hier bewaakt wordt
       is dat het om afronding gaat en niet om een bon die ontbreekt of dubbel
       staat: bij een dubbeltelling scheelt het de helft, niet een cent. */
    const grondslag = Math.round((fin.body.btw || []).reduce((s, r) => s + r.grondslag, 0) * 100);
    const op = await api(base, '/api/supplier/btw/opmaken', { periode: fin.body.maand }, mgr);
    assert.equal(op.status, 200, JSON.stringify(op.body).slice(0, 200));
    const omzetAangifte = (op.body.aangifte.tarieven || []).reduce((s, t) => s + t.omzetCenten, 0);
    assert.ok(Math.abs(omzetAangifte - grondslag) <= 2,
      'de aangifte staat op hooguit een cent per factuur van de boekhouding: ' + omzetAangifte + ' tegen ' + grondslag);

    /* De gebundelde bon is niet verdwenen -- hij is het kassastuk van de zaak
       en hoort in het kassaoverzicht te staan. Hij draagt alleen een merk. */
    const dag = await api(base, '/api/supplier/state', { code: 'KIKUNOI' }, mgr);
    const bonnen = (((dag.body.state || {}).pos || {}).sales || []);
    const bundel = bonnen.find(b => String(b.desc || '').startsWith('Tafelticket'));
    assert.ok(bundel, 'de gebundelde kassabon staat gewoon in het kassaoverzicht');
    assert.equal(bundel.omzetElders, 'bonnen', 'met het merk waaraan de boekhouding hem herkent');
  } finally {
    stop(child);
    try { fs.rmSync(TMP, { recursive: true, force: true }); } catch (e) {}
  }
});

test('10. een verzilverde cadeaukaart is een bon met een factuur, en telt EEN keer', async () => {
  const TMP = verseDataDir();
  const { child, base } = await startServer({ env: { SMTP_URL: '', RTG_DATA_DIR: TMP } });
  try {
    const mgr = await managerVan(base, 'KIKUNOI');

    // een kaart van honderd verkopen: dat is nog GEEN omzet (het saldo is een
    // verplichting), dus de boekhouding hoort hier nog op nul te staan
    const kk = await api(base, '/api/supplier/giftcard/sell', { bedrag: 100 }, mgr);
    assert.equal(kk.status, 200, JSON.stringify(kk.body).slice(0, 200));
    const code = kk.body.kaart.code;
    await even();
    const na0 = await api(base, '/api/supplier/finance', {}, mgr);
    assert.equal(Math.round((na0.body.btw || []).reduce((s, r) => s + r.omzet, 0) * 100), 0,
      'de verkoop van een cadeaukaart is nog geen omzet');
    assert.equal(na0.body.giftcards.open, 100, 'het saldo staat als verplichting open');

    // veertig ervan aan de balie innen zonder dat er een bon wordt aangeslagen
    const inn = await api(base, '/api/supplier/giftcard/redeem', { code, bedrag: 40 }, mgr);
    assert.equal(inn.status, 200, JSON.stringify(inn.body).slice(0, 200));
    assert.equal(inn.body.saldo, 60, 'het saldo is er echt af');
    assert.ok(inn.body.sale, 'de inwisseling levert een kassabon op -- dat was het gat');
    assert.equal(inn.body.sale.method, 'cadeaukaart');
    await even();

    const fin = await api(base, '/api/supplier/finance', {}, mgr);
    const omzet = Math.round((fin.body.btw || []).reduce((s, r) => s + r.omzet, 0) * 100);
    assert.equal(omzet, 4000, 'de inwisseling telt EEN keer als omzet, niet twee');

    /* En nu de kant waar het echt misging: de aangifte telt het
       factuurregister, en daar stond een inwisseling helemaal niet in. */
    const grondslag = Math.round((fin.body.btw || []).reduce((s, r) => s + r.grondslag, 0) * 100);
    const op = await api(base, '/api/supplier/btw/opmaken', { periode: fin.body.maand }, mgr);
    assert.equal(op.status, 200, JSON.stringify(op.body).slice(0, 200));
    assert.equal((op.body.aangifte.tarieven || []).reduce((s, t) => s + t.omzetCenten, 0), grondslag,
      'de aangifte komt op de cent uit op de boekhouding');
    assert.ok(grondslag > 0, 'en het is niet allebei nul');

    /* De tweede weg: de kassa slaat de bon WEL aan, en betaalt hem met de
       kaart. Dat is precies het geval waarvoor de betaalwijze bestaat -- de
       bon draagt de omzet, de kaart is alleen de betaling. */
    const bon = await api(base, '/api/supplier/pos/sale',
      { total: 25, desc: 'Lunch', method: 'cadeaukaart', gcCode: code }, mgr);
    assert.equal(bon.status, 200, JSON.stringify(bon.body).slice(0, 200));
    assert.equal(bon.body.sale.method, 'cadeaukaart');
    assert.equal(bon.body.sale.kaart, code, 'de bon noemt de kaart die hem betaalde');
    await even();

    const fin2 = await api(base, '/api/supplier/finance', {}, mgr);
    assert.equal(Math.round((fin2.body.btw || []).reduce((s, r) => s + r.omzet, 0) * 100), 6500,
      '40 + 25, en geen euro dubbel');
    assert.equal(fin2.body.giftcards.open, 35, 'en de kaart is nog eens 25 lichter');

    // meer dan er op de kaart staat: geen bon, en het saldo blijft staan
    const teveel = await api(base, '/api/supplier/pos/sale',
      { total: 1000, desc: 'Te duur', method: 'cadeaukaart', gcCode: code }, mgr);
    assert.equal(teveel.status, 409, 'onvoldoende saldo, dus geen bon');
    const fin3 = await api(base, '/api/supplier/finance', {}, mgr);
    assert.equal(fin3.body.giftcards.open, 35, 'en er is niets van de kaart af');
    assert.equal(Math.round((fin3.body.btw || []).reduce((s, r) => s + r.omzet, 0) * 100), 6500,
      'en geen omzet uit een bon die er niet is');
  } finally {
    stop(child);
    try { fs.rmSync(TMP, { recursive: true, force: true }); } catch (e) {}
  }
});

test('11. een tafelrekening uitchecken telt EEN keer: de losse posten of de bundel, niet allebei', async () => {
  const TMP = verseDataDir();
  const { child, base } = await startServer({ env: { SMTP_URL: '', RTG_DATA_DIR: TMP } });
  try {
    const mgr = await managerVan(base, 'KIKUNOI');
    const lid = await registreer(base);
    const kaart = (await api(base, '/api/supplier/menu/get', { code: 'KIKUNOI' }, lid)).body;
    const m = (kaart.menu || [])[0];
    assert.ok(m, 'de zaak heeft een menukaart');
    const tafel = ((await api(base, '/api/supplier/state', { code: 'KIKUNOI' }, mgr)).body.state.tables || [])[0];
    assert.ok(tafel, 'en een tafel om de bon op te zetten');

    /* Twee posten OP DE TAFEL. Dat is geen betaling maar uitstel: de last komt
       bij het uitchecken alsnog langs de kassa, en tot dat moment telt hij
       niet als omzet (zie POS_METHODS in kern/leverancier.js). */
    for (const qty of [1, 2]) {
      const r = await api(base, '/api/supplier/pos/sale',
        { total: m.price * qty, items: [{ name: m.name, qty, price: m.price }], method: 'tafel', room: tafel.name }, mgr);
      assert.equal(r.status, 200, JSON.stringify(r.body).slice(0, 200));
    }
    const somPosten = Math.round(m.price * 3 * 100);
    await even();

    const open = await api(base, '/api/supplier/finance', {}, mgr);
    assert.equal(Math.round((open.body.btw || []).reduce((s, r) => s + r.omzet, 0) * 100), 0,
      'een openstaande tafelrekening is nog geen omzet');

    /* En ook nog geen GELD. Het kassaoverzicht zet het dagtotaal en de
       bedragen per medewerker als euro's naast elkaar op een kaart, dus die
       horen bij elkaar op te tellen -- byActor telde ook de openstaande
       posten mee en dan klopt de kaart niet met zichzelf (TAKEN.md 4.30).
       Dit is de plek waar dat bijt: er staan hier twee posten op de tafel en
       er is nog niets afgerekend. */
    const kas = (await api(base, '/api/supplier/state', { code: 'KIKUNOI' }, mgr)).body.state.pos;
    assert.equal(Math.round(kas.total * 100), 0, 'er is nog niets door de kassa gegaan');
    assert.equal(Math.round(Object.values(kas.byActor).reduce((x, v) => x + v, 0) * 100), 0,
      'en dus staat er ook niets op naam van een medewerker');

    const uit = await api(base, '/api/supplier/pos/checkout', { room: tafel.name, method: 'contant' }, mgr);
    assert.equal(uit.status, 200, JSON.stringify(uit.body).slice(0, 200));
    assert.equal(Math.round(uit.body.sale.total * 100), somPosten, 'de bundel is de som van de posten');
    await even();

    /* DIT was de tweede helft van 4.28: `financeVoor` sloeg 'kamer' over maar
       'tafel' niet, dus na het uitchecken stonden de losse posten EN de
       gebundelde bon in de boekhouding. Het dagrapport deed het al goed, en
       dat verschil tussen twee tellers over dezelfde bonnen was het defect. */
    const na = await api(base, '/api/supplier/finance', {}, mgr);
    assert.equal(Math.round((na.body.btw || []).reduce((s, r) => s + r.omzet, 0) * 100), somPosten,
      'na het uitchecken telt de rekening EEN keer');

    /* EN DE AANGIFTE KOMT ERBIJ UIT. Dat was de tweede helft (TAKEN.md 4.29):
       een post op de kamer of de tafel is nog geen verkoop, dus /pos/sale
       boekt er geen factuur bij -- anders zou de omzet in de aangifte in de
       maand van BESTELLEN staan en in de boekhouding in de maand van
       AFREKENEN. De factuur hoort bij het uitchecken, en daar staat hij nu.
       Precies EEN, want twee wegen naar dezelfde rekening geven geen twee
       facturen. */
    const facturen = (await api(base, '/api/supplier/facturen/mijn', {}, mgr)).body.verkocht || [];
    const opBundel = facturen.filter(f => f.ref === uit.body.sale.id);
    assert.equal(opBundel.length, 1, 'het uitchecken levert precies EEN factuur op');
    assert.equal(Math.round(opBundel[0].totaal * 100), somPosten, 'voor het hele bedrag van de rekening');
    assert.equal(facturen.length, 1, 'en de losse posten hebben er zelf geen -- die waren uitstel');

    const grondslagNa = Math.round((na.body.btw || []).reduce((s, r) => s + r.grondslag, 0) * 100);
    const op = await api(base, '/api/supplier/btw/opmaken', { periode: na.body.maand }, mgr);
    assert.equal(op.status, 200, JSON.stringify(op.body).slice(0, 200));
    assert.equal((op.body.aangifte.tarieven || []).reduce((s, t) => s + t.omzetCenten, 0), grondslagNa,
      'en de aangifte telt dezelfde omzet als de boekhouding');
  } finally {
    stop(child);
    try { fs.rmSync(TMP, { recursive: true, force: true }); } catch (e) {}
  }
});

/* ---------------------------------------------------------------------------
   6. DE KASSA EN DE BOEKHOUDING STELLEN TWEE VERSCHILLENDE VRAGEN

   Toets 9 tot en met 11 gaan over de BOEKHOUDING: draagt deze bon omzet? Het
   kassa-dagoverzicht stelt een andere vraag -- ging dit geld door de la? -- en
   die twee lopen op precies twee punten uiteen. Dat verschil hoort zichtbaar
   te zijn, want het is bij het bouwen van 4.28 twee keer misgegaan: eerst
   telde de boekhouding een tafel dubbel, en daarna haalde mijn eigen
   reparatie het contante geld van dezelfde tafel uit het kassatotaal.

   Een gebundelde bon van een tafelticket draagt geen omzet (die staat op de
   bestellingen) maar wel geld (de gasten betaalden contant). Een openstaande
   tafelrekening draagt geen van beide: dat is uitstel.
   --------------------------------------------------------------------------- */
test('12. het kassatotaal telt de contante tafel WEL, de boekhouding niet nog eens', async () => {
  const TMP = verseDataDir();
  const { child, base } = await startServer({ env: { SMTP_URL: '', RTG_DATA_DIR: TMP } });
  try {
    const mgr = await managerVan(base, 'KIKUNOI');
    await api(base, '/api/supplier/settings', { code: 'KIKUNOI', opties: { betaalVooraf: false } }, mgr);
    const tafel = '7';
    const lid = await registreer(base);
    const item = await eersteItem(base, lid, 'KIKUNOI');
    const r1 = await api(base, '/api/order', { supplierCode: 'KIKUNOI', items: [{ id: item, qty: 2 }], table: tafel }, lid);
    assert.equal(r1.status, 200, JSON.stringify(r1.body).slice(0, 200));
    const som = Math.round(r1.body.order.total * 100);

    const voor = (await api(base, '/api/supplier/state', { code: 'KIKUNOI' }, mgr)).body.state.pos;
    const tk = await api(base, '/api/supplier/tafelticket', { table: tafel }, mgr);
    const af = await api(base, '/api/supplier/tafelticket/afrekenen',
      { table: tafel, zegel: tk.body.ticket.zegel, at: tk.body.ticket.at, method: 'contant' }, mgr);
    assert.equal(af.status, 200, JSON.stringify(af.body).slice(0, 200));
    await even();

    /* DE KASSA: het geld ligt in de la, dus het telt. Dit is de fout die ik
       zelf maakte bij 4.28 -- de bundel overslaan omdat de boekhouding hem
       overslaat, terwijl de onderdelen van een tafelticket BESTELLINGEN zijn
       en dus helemaal niet in het kassaoverzicht staan. */
    const na = (await api(base, '/api/supplier/state', { code: 'KIKUNOI' }, mgr)).body.state.pos;
    assert.equal(Math.round((na.total - voor.total) * 100), som,
      'het kassatotaal groeit met precies het bedrag van de tafel');
    assert.equal(Math.round((na.byMethod.contant || 0) * 100), som, 'en staat onder contant');

    /* EN DE BEDRAGEN NAAST DE NAMEN TELLEN OP TOT DAT TOTAAL. Ze stonden in
       het scherm als euro's naast elkaar terwijl byActor ook openstaande
       posten meetelde -- twee getallen op een kaart die niet bij elkaar
       optellen (TAKEN.md 4.30). */
    const somActors = Object.values(na.byActor).reduce((s, x) => s + x, 0);
    assert.equal(Math.round(somActors * 100), Math.round(na.total * 100),
      'per medewerker telt op tot het dagtotaal');

    // DE BOEKHOUDING: EEN keer, want de bestellingen dragen de omzet al
    const fin = await api(base, '/api/supplier/finance', {}, mgr);
    assert.equal(Math.round((fin.body.btw || []).reduce((s, r) => s + r.omzet, 0) * 100), som,
      'de boekhouding telt de tafel EEN keer');
  } finally {
    stop(child);
    try { fs.rmSync(TMP, { recursive: true, force: true }); } catch (e) {}
  }
});

test('13. een minibarlast komt buiten de kassa om binnen, en belandt toch in de aangifte', async () => {
  /* DIT is TAKEN.md 4.29 in zijn zuiverste vorm. Een minibartelling zet de
     kamerlast RECHTSTREEKS op de rekening (routes/supplier/kamers/
     voorzieningen.js), buiten /api/supplier/pos/sale om. Die post boekte dus
     nooit een factuur, en omdat de boekhouding hem bij het uitchecken wel
     telde, stond die omzet wel in de maandcijfers van de zaak en NIET in de
     btw-aangifte. Precies het gat dat dit hele bestand voor de app-kant heeft
     gedicht, maar dan aan de hotelkant.

     Hetzelfde geldt voor de logies bij het inchecken. Die weg is hier niet
     nagelopen omdat er een heel verblijf voor nodig is; de reparatie zit niet
     bij de bron maar bij het AFREKENEN, en dat is precies waarom deze ene
     bron genoeg is om hem te bewijzen: welke weg de post ook nam, hij komt
     langs dezelfde check-out. */
  const TMP = verseDataDir();
  const { child, base } = await startServer({ env: { SMTP_URL: '', RTG_DATA_DIR: TMP } });
  try {
    const mgr = await managerVan(base, 'HOSHI');
    const st = (await api(base, '/api/supplier/state', { code: 'HOSHI' }, mgr)).body.state;
    const kamer = (st.rooms || [])[0];
    const mb = ((st.minibar || {}).catalog || [])[0];
    assert.ok(kamer && mb, 'het hotel heeft een kamer en een minibar-catalogus');

    const tel = await api(base, '/api/supplier/minibar/count',
      { room: kamer.name, items: [{ id: mb.id, qty: 2 }] }, mgr);
    assert.equal(tel.status, 200, JSON.stringify(tel.body).slice(0, 200));
    const last = Math.round(mb.price * 2 * 100);
    assert.equal(Math.round(tel.body.charged * 100), last, 'het verbruik staat als kamerlast op de rekening');
    await even();

    // nog niets: de last is uitstel, dus geen omzet, geen factuur, geen geld
    const voor = await api(base, '/api/supplier/finance', {}, mgr);
    assert.equal(Math.round((voor.body.btw || []).reduce((s, r) => s + r.omzet, 0) * 100), 0,
      'een openstaande kamerlast is nog geen omzet');
    assert.equal(((await api(base, '/api/supplier/facturen/mijn', {}, mgr)).body.verkocht || []).length, 0,
      'en nog geen factuur');

    const uit = await api(base, '/api/supplier/pos/checkout', { room: kamer.name, method: 'contant' }, mgr);
    assert.equal(uit.status, 200, JSON.stringify(uit.body).slice(0, 200));
    await even();

    const na = await api(base, '/api/supplier/finance', {}, mgr);
    const omzet = Math.round((na.body.btw || []).reduce((s, r) => s + r.omzet, 0) * 100);
    assert.equal(omzet, last, 'na het uitchecken telt de kamerlast EEN keer als omzet');

    const facturen = (await api(base, '/api/supplier/facturen/mijn', {}, mgr)).body.verkocht || [];
    assert.equal(facturen.length, 1, 'en er staat precies EEN factuur -- dat was er nul');
    assert.equal(Math.round(facturen[0].totaal * 100), last, 'voor het bedrag van de rekening');

    const grondslag = Math.round((na.body.btw || []).reduce((s, r) => s + r.grondslag, 0) * 100);
    const op = await api(base, '/api/supplier/btw/opmaken', { periode: na.body.maand }, mgr);
    assert.equal(op.status, 200, JSON.stringify(op.body).slice(0, 200));
    assert.equal((op.body.aangifte.tarieven || []).reduce((s, t) => s + t.omzetCenten, 0), grondslag,
      'en de aangifte komt uit op de boekhouding -- dat was nul tegenover de volle last');
  } finally {
    stop(child);
    try { fs.rmSync(TMP, { recursive: true, force: true }); } catch (e) {}
  }
});
