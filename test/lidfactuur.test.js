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

   Punt 3 en 4 zijn het hele doel. Een factuur die er wel is maar een ander
   bedrag draagt, is geen reparatie maar een derde cijfer erbij.

   WAT DEZE TOETS NIET DEKT, en dat hoort erbij te staan: bij een cadeaukaart
   telt de maandboekhouding zelf dubbel (TAKEN.md 4.27). Dat geval staat met
   opzet niet in toets 7 -- niet omdat het niet bestaat, maar omdat het een
   defect aan de ANDERE kant is en hier dus niets over deze reparatie zou zeggen.
   Het tafelticket op 'contant' stond hier ook (TAKEN.md 4.28) en is sinds 19
   augustus 2026 gerepareerd; het heeft nu een eigen toets (6b), en die legt
   daarom een derde getal ernaast dat niet kan meebewegen: de som van de bonnen.

   Draai los: node --test test/lidfactuur.test.js */
const test = require('node:test');
const assert = require('node:assert/strict');
const { startServer, stop, keurLidGoed } = require('./helper');
const fs = require('fs'); const os = require('os'); const path = require('path');

function verseDataDir() { return fs.mkdtempSync(path.join(os.tmpdir(), 'rtg-lidfac-')); }
async function api(base, pad, body, token) {
  const h = { 'Content-Type': 'application/json' }; if (token) h.Authorization = 'Bearer ' + token;
  const r = await fetch(base + pad, { method: 'POST', headers: h, body: JSON.stringify(body || {}) });
  return { status: r.status, body: await r.json().catch(() => ({})) };
}
async function registreer(base, naam) {
  const u = Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
  const r = (await api(base, '/api/auth/register', {
    name: naam || 'Factuur Lid', email: u + '@x.nl',
    phone: '06' + u.replace(/\D/g, '').padEnd(8, '1').slice(0, 8),
    password: 'geheim123', geboortedatum: '1990-01-01', tier: 'business', pasApp: 'business'
  })).body;
  // achteraf betalen geldt alleen voor een geverifieerde volwassene
  await keurLidGoed(base, r.token, r.state.user.codename, '1990-01-01');
  return r.token;
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
/* WACHTEN TOT DE FACTUUR ER IS, niet 400 ms aftellen.

   De facturatiemotor boekt in een LOSSE belofte; de route antwoordt eerder.
   Hier stond daarom `const even = () => new Promise(r => setTimeout(r, 400))`,
   twaalf keer aangeroepen. Dat is een gok die twee kanten op fout gaat: op deze
   machine bijna altijd te lang (twaalf keer 400 ms voor niets) en onder
   belasting te kort -- en dan meldt deze toets "geen factuur" terwijl de motor
   nog bezig was. Precies de uitslag die niets over zijn onderwerp zegt.

   Het teken is de factuur zelf. wachtOpFacturen() vraagt de lijst op tot elke
   genoemde ref er een heeft, met een ruim budget en een leesbare fout als het
   niet lukt. Wat de toetsen daarna beweren -- PRECIES een, en voor dit bedrag --
   blijft ongewijzigd: dit wacht alleen tot er iets te beweren valt. */
async function wachtOpFacturen(base, mgrTok, refs, opties) {
  const lijst = Array.isArray(refs) ? refs : [refs];
  const ms = (opties && opties.ms) || 15000;
  const eind = Date.now() + ms;
  for (;;) {
    const uit = {};
    for (const ref of lijst) uit[ref] = await facturenOpRef(base, mgrTok, ref);
    if (lijst.every(ref => uit[ref].length)) return uit;
    if (Date.now() >= eind) {
      throw new Error('wachtte ' + ms + 'ms tot de facturatiemotor had geboekt, en dat gebeurde niet voor: ' +
        lijst.filter(ref => !uit[ref].length).join(', '));
    }
    await new Promise(r => setTimeout(r, 25));
  }
}

/* En hetzelfde voor het FOUTENBORD. De motor meldt zijn mislukking ook in een
   losse belofte, dus stond er twee keer `setTimeout(50)` voor de telling. 50 ms
   is genoeg tot het niet genoeg is, en dan meldt de toets "niet geteld" terwijl
   de melding onderweg was. Het teken is de teller zelf. */
async function wachtOpFouten(log, hoeveel, ms) {
  const eind = Date.now() + (ms || 10000);
  for (;;) {
    const stand = log.foutenSamenvatting();
    if (stand.totaal >= hoeveel) return stand;
    if (Date.now() >= eind) {
      throw new Error('wachtte ' + (ms || 10000) + 'ms op ' + hoeveel + ' gemelde fout(en) en er staan er ' + stand.totaal);
    }
    await new Promise(r => setTimeout(r, 25));
  }
}

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

    /* NOG NIET betaald = nog geen factuur. Een factuur bij het plaatsen zou een
       bon factureren die het lid nog kan laten lopen.

       Hier stond een wacht van 400 ms voor, en die is weg zonder dat de
       bewering zwakker wordt. Op een AFWEZIGHEID kun je niet wachten; wat deze
       regel echt hard maakt staat vier regels lager. Zou de motor bij het
       PLAATSEN al factureren, dan telt hij na de betaling twee -- en `fac.length
       === 1` zakt. Deze regel is dus een snellere fout met een duidelijker
       bericht, en niet de bewering die het draagt. */
    assert.deepEqual(await facturenOpRef(base, mgr, ref), [], 'een onbetaalde bon heeft geen factuur');

    assert.equal((await api(base, '/api/order/pay', { ref }, lid)).status, 200);
    const fac = (await wachtOpFacturen(base, mgr, ref))[ref];
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
    const beide = await wachtOpFacturen(base, mgr, [r1.body.order.ref, r2.body.order.ref]);

    const f1 = beide[r1.body.order.ref];
    const f2 = beide[r2.body.order.ref];
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
    const fb = (await wachtOpFacturen(base, mgrB, b.body.boeking.ref))[b.body.boeking.ref];
    assert.equal(fb.length, 1, 'de boeking heeft een factuur');
    assert.equal(fb[0].totaal, b.body.boeking.price);
    assert.equal(fb[0].soort, 'dienst', 'een boeking is een dienst en geen verkoop');

    // en een rit
    const mgrR = await managerVan(base, 'MKKX');
    const rit = await api(base, '/api/ride/request', { supplierCode: 'MKKX', toCode: 'KIKUNOI', passengers: 1 }, lid);
    assert.equal(rit.status, 200, JSON.stringify(rit.body).slice(0, 200));
    assert.equal((await api(base, '/api/ride/pay', { ref: rit.body.ride.ref }, lid)).status, 200);
    const fr = (await wachtOpFacturen(base, mgrR, rit.body.ride.ref))[rit.body.ride.ref];
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

    const fac = (await wachtOpFacturen(base, mgr, ref))[ref];
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
    assert.equal((await wachtOpFacturen(base, mgr, ref))[ref].length, 1, 'na de app-betaling: een');

    // en dan komt hij zijn bestelling ophalen
    const inn = await api(base, '/api/supplier/pos/redeem', { code: o.body.order.pickup }, mgr);
    assert.equal(inn.status, 200);
    assert.equal(inn.body.order.wasPaid, true, 'de balie ziet dat er al betaald is');
    /* HIER BLIJFT EEN WACHT STAAN, en dat is een besluit. Deze bewering gaat
       over iets dat NIET gebeurt -- er komt geen tweede factuur -- en daar
       bestaat geen teken voor om op te wachten. De motor boekt in een losse
       belofte, dus meteen tellen zou alleen zeggen "op dit moment nog niet".
       Overal in dit bestand waar wel een teken bestaat, staat nu
       wachtOpFacturen(); deze en die in toets 1 zijn de twee die overblijven,
       en die staan met naam in KLOKWACHT.json. */
    await new Promise(r => setTimeout(r, 400));
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
    const beide = await wachtOpFacturen(base, mgr, [r1.body.order.ref, r2.body.order.ref]);

    const f1 = beide[r1.body.order.ref];
    const f2 = beide[r2.body.order.ref];
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

/* WAT ER MIS WAS AAN DE ANDERE KANT: DE BOEKHOUDING TELDE HET TAFELTICKET TWEE
   KEER. Toets 6 hierboven laat zien dat elke bon aan de tafel zijn eigen factuur
   krijgt -- dat klopte. Maar `/api/supplier/tafelticket/afrekenen` legt daar ook
   nog EEN gebundelde kassabon overheen met het volle bedrag, en `financeVoor`
   sloeg alleen `rtg` en `kamer` over. Een tafel die contant of met RTG Pay
   afrekende, stond dus dubbel in de maandboekhouding (TAKEN.md 4.28).

   De aangifte had er geen last van (die telt facturen, en die staan per bon),
   dus toets 7 kon dit niet vinden: hij vergelijkt aangifte met boekhouding, en
   hier was ALLEEN de boekhouding fout. Deze toets legt daarom een derde getal
   ernaast dat niet kan meebewegen: de som van de bonnen zelf.

   De bundelbon draagt nu `omzetElders: true`. Mutatie: dat merk weghalen (of de
   regel in financeVoor) laat deze toets zakken op precies het dubbele. */
test('6b. een tafelticket op contant telt de maandboekhouding NIET dubbel', async () => {
  const TMP = verseDataDir();
  const { child, base } = await startServer({ env: { SMTP_URL: '', RTG_DATA_DIR: TMP } });
  try {
    const mgr = await managerVan(base, 'KIKUNOI');
    await api(base, '/api/supplier/settings', { code: 'KIKUNOI', opties: { betaalVooraf: false } }, mgr);
    const tafel = '9';
    const lid = await registreer(base);
    const item = await eersteItem(base, lid, 'KIKUNOI');
    const r1 = await api(base, '/api/order', { supplierCode: 'KIKUNOI', items: [{ id: item, qty: 2 }], table: tafel }, lid);
    const r2 = await api(base, '/api/order', { supplierCode: 'KIKUNOI', items: [{ id: item, qty: 1 }], table: tafel }, lid);
    assert.equal(r2.status, 200);

    const tk = await api(base, '/api/supplier/tafelticket', { table: tafel }, mgr);
    assert.equal(tk.status, 200, JSON.stringify(tk.body).slice(0, 200));
    const af = await api(base, '/api/supplier/tafelticket/afrekenen',
      { table: tafel, zegel: tk.body.ticket.zegel, at: tk.body.ticket.at, method: 'contant' }, mgr);
    assert.equal(af.status, 200, JSON.stringify(af.body).slice(0, 200));
    const beide = await wachtOpFacturen(base, mgr, [r1.body.order.ref, r2.body.order.ref]);

    /* De boekhouding rekent in grondslag (btw eraf) en het ticket in bedragen
       INCLUSIEF btw; ze naast elkaar leggen zou een tariefverschil meten in
       plaats van een dubbeltelling. De facturen dragen wel hetzelfde bedrag als
       het ticket, dus die zijn de eerlijke maat. */
    const f1 = beide[r1.body.order.ref];
    const f2 = beide[r2.body.order.ref];
    const somVanDeBonnen = Math.round((f1[0].totaal + f2[0].totaal) * 100);
    assert.equal(somVanDeBonnen, Math.round(af.body.subtotaal * 100), 'de bonnen samen zijn het ticket');

    const fin = await api(base, '/api/supplier/finance', {}, mgr);
    assert.equal(fin.status, 200);
    const omzetBoekhouding = Math.round((fin.body.btw || []).reduce((s2, r) => s2 + r.omzet, 0) * 100);
    assert.ok(omzetBoekhouding > 0, 'de boekhouding telt deze omzet uberhaupt');
    assert.equal(omzetBoekhouding, somVanDeBonnen,
      'de maandboekhouding telt het tafelticket EEN keer; stond hij op ' + (somVanDeBonnen * 2) +
      ', dan telt de bundelbon er weer bovenop');
  } finally {
    stop(child);
    try { fs.rmSync(TMP, { recursive: true, force: true }); } catch (e) {}
  }
});

/* EN DE CADEAUKAART, HET SPIEGELBEELD ERVAN (TAKEN.md 4.27).

   Er was GEEN betaalwijze 'cadeaukaart' aan de kassa. De kassa moest dus een bon
   aanslaan en daarnaast de kaart verzilveren, en dan telde `financeVoor` de
   omzet twee keer: een keer als bon en een keer als inwisseling. Een losse
   inwisseling is inmiddels expliciet een saldo-correctie zonder omzet of
   factuur; de boekhouding meldt hem apart.

   'cadeaukaart' is nu een betaalwijze: de bon draagt de omzet met zijn eigen
   regels (dus het juiste tarief per artikel) en de verzilveringen die bij een
   bon horen dragen `viaBon`, waarop de maandboekhouding ze overslaat. Deze
   toets legt beide kanten vast, want een reparatie die de ene kant dichtzet en
   de andere opentrekt, is geen reparatie. */
test('6c. een bon die met een cadeaukaart wordt betaald telt EEN keer, en de aangifte ziet hem', async () => {
  const TMP = verseDataDir();
  const { child, base } = await startServer({ env: { SMTP_URL: '', RTG_DATA_DIR: TMP } });
  try {
    const mgr = await managerVan(base, 'KIKUNOI');
    const kaart = await api(base, '/api/supplier/giftcard/sell', { bedrag: 100 }, mgr);
    assert.equal(kaart.status, 200, JSON.stringify(kaart.body).slice(0, 200));
    const code = kaart.body.kaart.code;

    /* De verkoop van de kaart is nog GEEN omzet: het saldo is een schuld aan de
       klant. Dat stond er al en blijft zo -- als de verkoop hier zou meetellen,
       meet de rest van deze toets niets. */
    const voor = await api(base, '/api/supplier/finance', {}, mgr);
    assert.equal(Math.round((voor.body.btw || []).reduce((x, r) => x + r.omzet, 0) * 100), 0,
      'een verkochte kaart is nog geen omzet');

    // de gast eet voor 40 euro en betaalt met de kaart
    const bon = await api(base, '/api/supplier/pos/sale', {
      total: 40, method: 'cadeaukaart', giftcardCode: code,
      items: [{ name: 'Kaiseki', qty: 1, price: 40 }]
    }, mgr);
    assert.equal(bon.status, 200, JSON.stringify(bon.body).slice(0, 200));
    assert.equal(bon.body.sale.method, 'cadeaukaart', 'de bon draagt de betaalwijze');
    assert.equal(bon.body.sale.kaartCode, code, 'en welke kaart het was');
    /* De kassabon boekt zijn factuur op `sale.id` (verkoop.js: `ref: sale.id`),
       dus dat is hier het teken dat de facturatiemotor klaar is. */
    await wachtOpFacturen(base, mgr, bon.body.sale.id);

    // het saldo is eraf, en precies een keer
    const na = await api(base, '/api/supplier/giftcard/redeem', { code, bedrag: 0 }, mgr);
    assert.equal(na.status, 400, 'nul blijft geen bedrag');
    const rest = await api(base, '/api/supplier/giftcard/redeem', { code, bedrag: 60 }, mgr);
    assert.equal(rest.status, 200, 'er staat nog zestig op: de kaart is EEN keer belast');
    assert.equal(rest.body.saldo, 0);

    /* Alleen de veertig euro op de kassabon is omzet. De resterende zestig is
       met de hand als saldo-correctie afgeboekt en hoort niet zonder bon in de
       omzet of aangifte terecht te komen. */
    const fin = await api(base, '/api/supplier/finance', {}, mgr);
    const omzet = Math.round((fin.body.btw || []).reduce((x, r) => x + r.omzet, 0) * 100);
    assert.equal(omzet, 4000,
      'alleen de bon (40); de handmatige saldo-correctie (60) is geen omzet');
    assert.equal(Math.round(fin.body.giftcards.ingewisseld * 100), 10000,
      'het kaartrapport blijft het VOLLE bedrag melden: dat is een andere vraag dan waar de omzet staat');
    assert.equal(Math.round(fin.body.giftcards.handmatig * 100), 6000,
      'de saldo-correctie staat afzonderlijk en zichtbaar in het rapport');

    /* En de andere kant: de bon boekt een factuur, dus de btw-aangifte ziet die
       omzet nu wel. De losse correctie blijft daar bewust buiten. */
    const op = await api(base, '/api/supplier/btw/opmaken', { periode: fin.body.maand }, mgr);
    assert.equal(op.status, 200, JSON.stringify(op.body).slice(0, 200));
    const omzetAangifte = (op.body.aangifte.tarieven || []).reduce((x, t) => x + t.omzetCenten, 0);
    assert.ok(omzetAangifte > 0, 'de aangifte ziet de bon die met een kaart is betaald');
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
    await wachtOpFacturen(base, mgr, refs);

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
  const naNee = await wachtOpFouten(log, 1);
  assert.equal(naNee.totaal, 1, 'een nette weigering wordt geteld');
  assert.match(naNee.recent[0].bericht, /Geen bedrag/, 'met de reden van de motor erin');

  // 2. de motor ontploft
  log.foutenReset();
  maakFactuurVoorLid({ boekMetCodenaam: async () => { throw new Error('opslag onbereikbaar'); } })
    (Object.assign({ ref: 'REF-BOEM' }, bon));
  const naBoem = await wachtOpFouten(log, 1);
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
   9. DE CADEAUKAART (TAKEN.md 4.27)

   Dit geval stond hierboven met zoveel woorden als NIET gedekt, en met reden:
   de inwisseling boekte geen factuur (dus de aangifte miste hem) EN de
   boekhouding telde hem apart naast de kassabon (dus die telde dubbel). Twee
   fouten in tegengestelde richting over hetzelfde geld.

   Sinds die reparatie is 'cadeaukaart' een BETAALWIJZE aan de kassa: de gewone
   bon draagt de omzet, de artikelen, de btw en de factuur, en diezelfde bon
   trekt het saldo van de kaart af. Deze toets rekent een echte bon af met een
   echte kaart en legt daarna dezelfde twee cijfers naast elkaar als toets 7.
   ------------------------------------------------------------------------- */
test('9. een bon die met een cadeaukaart wordt betaald: aangifte en boekhouding blijven gelijk', async () => {
  const TMP = verseDataDir();
  const { child, base } = await startServer({ env: { SMTP_URL: '', RTG_DATA_DIR: TMP } });
  try {
    const mgr = await managerVan(base, 'KIKUNOI');
    const lid = await registreer(base);
    const kaartMenu = (await api(base, '/api/supplier/menu/get', { code: 'KIKUNOI' }, lid)).body;
    const eten = (kaartMenu.menu || []).find(x => x.station !== 'bar');
    const bar = (kaartMenu.menu || []).find(x => x.station === 'bar');
    assert.ok(eten && bar, 'de zaak heeft eten en drank; anders meet deze toets maar een tarief');

    // een cadeaukaart van 500 verkopen -- dat is nog GEEN omzet
    const verkoop = await api(base, '/api/supplier/giftcard/sell', { bedrag: 500 }, mgr);
    assert.equal(verkoop.status, 200);
    const gcCode = verkoop.body.kaart.code;

    const voor = await api(base, '/api/supplier/finance', {}, mgr);
    assert.equal(Math.round((voor.body.btw || []).reduce((s, r) => s + r.grondslag, 0) * 100), 0,
      'een verkochte cadeaukaart is nog geen omzet: het saldo is een verplichting');

    // en nu een bon van 2 gerechten + 1 drankje, afgerekend MET de kaart
    const items = [{ name: eten.name, qty: 2, price: eten.price }, { name: bar.name, qty: 1, price: bar.price }];
    const totaal = Math.round((eten.price * 2 + bar.price) * 100) / 100;
    const bon = await api(base, '/api/supplier/pos/sale',
      { items, total: totaal, method: 'cadeaukaart', gcCode }, mgr);
    assert.equal(bon.status, 200, JSON.stringify(bon.body).slice(0, 200));
    assert.equal(bon.body.sale.method, 'cadeaukaart');
    assert.equal(bon.body.sale.gcRest, Math.round((500 - totaal) * 100) / 100, 'het saldo is met de bon afgeboekt');
    await wachtOpFacturen(base, mgr, bon.body.sale.id);

    // dezelfde twee cijfers als in toets 7, op de grondslag (exclusief btw)
    const fin = await api(base, '/api/supplier/finance', {}, mgr);
    const omzetBoekhouding = Math.round((fin.body.btw || []).reduce((s, r) => s + r.grondslag, 0) * 100);
    const btwBoekhouding = Math.round((fin.body.btwTotaal || 0) * 100);
    assert.ok(omzetBoekhouding > 0, 'de boekhouding telt deze bon');
    assert.equal(new Set((fin.body.btw || []).map(r => r.tarief)).size, 2, 'twee tarieven: eten en drank');

    const op = await api(base, '/api/supplier/btw/opmaken', { periode: fin.body.maand }, mgr);
    assert.equal(op.status, 200, JSON.stringify(op.body).slice(0, 200));
    const omzetAangifte = (op.body.aangifte.tarieven || []).reduce((s, t) => s + t.omzetCenten, 0);

    assert.equal(omzetAangifte, omzetBoekhouding,
      'de aangifte telt exact de omzet van de boekhouding; telde de inwisseling er nog apart bij, dan stond hier het dubbele');
    assert.equal(op.body.aangifte.verschuldigdCenten, btwBoekhouding, 'en dezelfde af te dragen btw');

    /* FAIL-CLOSED, net als RTG Pay: eerst het geld, dan pas de bon. Een kaart
       zonder dekking en een code die niet bestaat leveren geen bon op -- en dus
       ook geen omzet. Zonder deze twee zou de betaalwijze een gratis bon zijn:
       de omzet zou tellen terwijl er niets tegenover staat.

       EN ZE BEWAKEN NOG IETS DAT GEEN ASSERTIE HIER KAN ZIEN. Beide takken
       zitten binnen de herhalingslaag van de kassa (kern/kassa/herhaling.js),
       en die eist dat het werk zijn antwoord TERUGGEEFT in plaats van het zelf
       te versturen. Stond er `res.status(404).json(...)`, dan ging de Express-
       `res` als antwoord terug -- een object dat naar zichzelf verwijst
       (res.req.res...) -- en liep de serialisatie eromheen vast op "Maximum
       call stack size exceeded". De twee statuscodes hieronder blijven daarbij
       gewoon KLOPPEN, want het antwoord was al verstuurd; wat zakt is de
       strenge poort in test/helper.js, die de uitzondering van de server
       meeleest. Zo is deze fout ook gevonden. Wie hier ooit terugvalt op
       res.json(), ziet deze asserties dus groen blijven en het bestand toch
       rood worden -- dat is de bedoeling. */
    const teDuur = await api(base, '/api/supplier/pos/sale',
      { items, total: 5000, method: 'cadeaukaart', gcCode }, mgr);
    assert.equal(teDuur.status, 409, 'meer dan het saldo wordt geweigerd');
    const onbekend = await api(base, '/api/supplier/pos/sale',
      { items, total: 1, method: 'cadeaukaart', gcCode: 'RTG-GC-ZZZZZZ' }, mgr);
    assert.equal(onbekend.status, 404, 'een onbekende kaart wordt geweigerd');
    const naWeigering = await api(base, '/api/supplier/finance', {}, mgr);
    assert.equal(Math.round((naWeigering.body.btw || []).reduce((s, r) => s + r.grondslag, 0) * 100), omzetBoekhouding,
      'een geweigerde betaling laat geen bon en dus geen omzet achter');

    /* De handmatige afboeking blijft bestaan als correctiemiddel, maar draagt
       geen omzet -- en zegt dat ook, want geld dat buiten de boeken valt hoort
       nooit stilletjes te verdwijnen. */
    const hand = await api(base, '/api/supplier/giftcard/redeem', { code: gcCode, bedrag: 25 }, mgr);
    assert.equal(hand.status, 200);
    const na = await api(base, '/api/supplier/finance', {}, mgr);
    assert.equal(Math.round((na.body.btw || []).reduce((s, r) => s + r.grondslag, 0) * 100), omzetBoekhouding,
      'een handmatige afboeking verandert de omzet niet');
    assert.equal(na.body.giftcards.handmatig, 25, 'maar staat wel apart gemeld');
    assert.ok(na.body.regels.some(r => /met de hand/.test(r)), 'met een waarschuwing in het overzicht');
  } finally {
    stop(child);
    try { fs.rmSync(TMP, { recursive: true, force: true }); } catch (e) {}
  }
});

/* -------------------------------------------------------------------------
   10. EEN CADEAUKAART VERKOPEN WAS NIET IDEMPOTENT (TAKEN.md 4.60)

   Elke oproep maakte een NIEUWE kaart met saldo. Een hapering of een retry na
   een timeout gaf dus een tweede kaart van hetzelfde bedrag -- en die is
   gewoon inwisselbaar, dus de zaak geeft dat bedrag echt weg. Gevonden bij het
   opschrijven van de idempotentie-besluiten (4.30).

   Wat een idem-sleutel WEL en NIET doet, want dat verschil hoort hier te
   staan: hij vangt de HERHALING van dezelfde poging. Twee bewuste verkopen
   achter elkaar horen twee kaarten te geven, en dat blijft zo -- die hebben
   elk hun eigen sleutel. De dubbeltik zelf wordt aan de knop gevangen.
   ------------------------------------------------------------------------- */
test('10. een cadeaukaart verkopen met dezelfde sleutel geeft EEN kaart, geen twee', async () => {
  const TMP = verseDataDir();
  const { child, base } = await startServer({ env: { SMTP_URL: '', RTG_DATA_DIR: TMP } });
  try {
    const mgr = await managerVan(base, 'KIKUNOI');
    const eerste = await api(base, '/api/supplier/giftcard/sell', { bedrag: 250, idem: 'gc-vast-1' }, mgr);
    assert.equal(eerste.status, 200);
    const code = eerste.body.kaart.code;

    const herhaald = await api(base, '/api/supplier/giftcard/sell', { bedrag: 250, idem: 'gc-vast-1' }, mgr);
    assert.equal(herhaald.status, 200);
    assert.equal(herhaald.body.kaart.code, code, 'dezelfde kaart terug, geen tweede met saldo');
    assert.equal(herhaald.body.herhaald, true, 'de server merkt de herhaling zelf');

    // een verse sleutel is wel een echte tweede verkoop
    const tweede = await api(base, '/api/supplier/giftcard/sell', { bedrag: 250, idem: 'gc-vast-2' }, mgr);
    assert.notEqual(tweede.body.kaart.code, code, 'twee bewuste verkopen geven twee kaarten');

    // dezelfde sleutel voor een ander bedrag is een fout, geen stille echo
    const ander = await api(base, '/api/supplier/giftcard/sell', { bedrag: 500, idem: 'gc-vast-1' }, mgr);
    assert.equal(ander.status, 409, 'dezelfde sleutel voor een ander bedrag wordt geweigerd: ' + JSON.stringify(ander.body));

    /* En de proef op de som die er echt toe doet: hoeveel saldo staat er nu bij
       deze zaak open? Twee kaarten van 250, niet drie -- want de herhaling en
       de geweigerde 409 mogen geen saldo hebben aangemaakt. */
    const fin = await api(base, '/api/supplier/finance', {}, mgr);
    assert.equal(fin.body.giftcards.open, 500, 'het openstaande kaartsaldo is 2 x 250, niet meer');
    assert.equal(fin.body.giftcards.aantal, 2, 'en er staan twee kaarten, geen vier');
  } finally {
    stop(child);
    try { fs.rmSync(TMP, { recursive: true, force: true }); } catch (e) {}
  }
});
