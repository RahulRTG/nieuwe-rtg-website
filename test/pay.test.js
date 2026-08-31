/* RTG Pay: de interne betaallaag. Een wallet per lid op een dubbel grootboek,
   alles EEN knop: opladen via de betaal-naad, Klompjes (de RTG-eigen betaalverzoeken, ook gesplitst) die je
   met een tik betaalt waarbij de wallet zelf bijlaadt, de kassacode bij de
   partner, en uitbetalen. De sluitcontrole bewaakt dat de som van alle saldi
   altijd exact nul is. Draai los:
   node --test test/pay.test.js */
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { startServer, stop } = require('./helper');

let srv, base;
let lidA, lidB;       // { token, codenaam }
let supToken, supCode; // de partner voor de kassa
const TMP = fs.mkdtempSync(path.join(os.tmpdir(), 'rtg-pay-'));

const api = (pad, body, token) => fetch(base + '/api/' + pad, {
  method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + token },
  body: JSON.stringify(body || {})
}).then(async r => ({ status: r.status, body: await r.json().catch(() => ({})) }));

async function lid(tier) {
  const r = await fetch(base + '/api/login', {
    method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ tier })
  });
  const d = await r.json();
  const o = await api('pay/overzicht', {}, d.token);
  return { token: d.token, codenaam: o.body.codenaam };
}

test.before(async () => {
  srv = await startServer({ env: { SMTP_URL: '', RTG_DATA_DIR: TMP } });
  base = srv.base;
  lidA = await lid('rtg');
  lidB = await lid('lifestyle');
  assert.ok(lidA.codenaam && lidB.codenaam && lidA.codenaam !== lidB.codenaam, 'twee leden met eigen codenaam');
  const login = await fetch(base + '/api/supplier/login', {
    method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ username: 'rahul', password: 'Imran' })
  });
  const d = await login.json();
  supToken = d.token;
  supCode = d.state.supplier.code;
  assert.ok(supToken && supCode, 'de partner logt in voor de kassa');
});
test.after(() => {
  stop(srv && srv.child);
  try { fs.rmSync(TMP, { recursive: true, force: true }); } catch (e) {}
});

test('opladen: een tik en het staat op de wallet; dubbel tikken laadt nooit dubbel', async () => {
  const sleutel = 'oplaad-eenmalig-1';
  const r1 = await api('pay/oplaad', { centen: 5000, idem: sleutel }, lidA.token);
  assert.equal(r1.status, 200);
  assert.equal(r1.body.saldo, 5000, 'vijftig euro geladen');
  const r2 = await api('pay/oplaad', { centen: 5000, idem: sleutel }, lidA.token);
  assert.equal(r2.body.herhaald, true, 'de dubbeltik is hetzelfde antwoord');
  assert.equal((await api('pay/overzicht', {}, lidA.token)).body.saldo, 5000, 'en boekt niet dubbel');
});

test('het Klompje: gesplitst uitsturen, en de ander betaalt met EEN knop (autolaad doet de rest)', async () => {
  // A schoot 30 euro voor en splitst met zichzelf mee: B moet 15 euro
  const t = await api('pay/verzoek', { aan: [lidB.codenaam], totaalCenten: 3000, oms: 'Strandbedjes', splitsMetMij: true }, lidA.token);
  assert.equal(t.status, 200);
  assert.equal(t.body.perPersoon, 1500, 'het totaal is eerlijk gesplitst');
  // B ziet hem staan en betaalt met een knop, ZONDER saldo: de wallet laadt zelf bij
  const zicht = await api('pay/overzicht', {}, lidB.token);
  const v = zicht.body.aanMij.find(x => x.van === lidA.codenaam);
  assert.ok(v, 'B ziet het verzoek van A');
  const betaal = await api('pay/verzoek/betaal', { id: v.id, idem: 'tikkie-1' }, lidB.token);
  assert.equal(betaal.status, 200);
  assert.equal(betaal.body.bijgeladen, 2000, 'de wallet laadde zelf 20 euro bij (tientjes)');
  assert.equal(betaal.body.saldo, 500, 'en er blijft 5 euro saldo over');
  assert.equal((await api('pay/overzicht', {}, lidA.token)).body.saldo, 6500, 'A heeft de 15 euro binnen');
  // nog een keer dezelfde knop: geen dubbele boeking, verzoek is dicht
  assert.equal((await api('pay/verzoek/betaal', { id: v.id, idem: 'tikkie-2' }, lidB.token)).status, 409);
});

test('geld sturen op codenaam werkt met een knop; onbekende namen ketsen af', async () => {
  const r = await api('pay/stuur', { aan: lidB.codenaam, centen: 500, oms: 'Terug voor de taxi', idem: 'stuur-1' }, lidA.token);
  assert.equal(r.status, 200);
  assert.equal(r.body.saldo, 6000);
  assert.equal((await api('pay/overzicht', {}, lidB.token)).body.saldo, 1000, 'B ving de 5 euro');
  assert.equal((await api('pay/stuur', { aan: 'BestaatNiet999', centen: 100 }, lidA.token)).status, 404);
});

test('de kassacode: het lid toont een code, de zaak int, en uitbetalen leegt de partnerpot', async () => {
  const k = await api('pay/kascode', { maxCenten: 5000 }, lidA.token);
  assert.equal(k.status, 200);
  assert.match(k.body.code, /^[0-9A-F]{6}$/);
  // boven het maximum weigert de kassa
  assert.equal((await api('supplier/pay/in', { code: k.body.code, centen: 9000 }, supToken)).status, 402);
  const inn = await api('supplier/pay/in', { code: k.body.code, centen: 2500, oms: 'Lunch aan zee', idem: 'kas-1' }, supToken);
  assert.equal(inn.status, 200);
  assert.equal(inn.body.centen, 2500);
  // de kosten van de betaaldienst gaan DIRECT naar de ondernemer: 10 centen
  // vaste voet + 1% van 2500 = 35 centen, per transactie meteen verrekend
  assert.equal(inn.body.kosten, 35, 'de kosten staan meteen op de transactie');
  // de code is eenmalig
  assert.equal((await api('supplier/pay/in', { code: k.body.code, centen: 100 }, supToken)).status, 404);
  const pot = await api('supplier/pay/overzicht', {}, supToken);
  assert.equal(pot.body.saldo, 2465, 'de partnerpot telt de kassabetaling netto (kosten direct verrekend)');
  assert.equal(pot.body.kostenVandaag, 35, 'en toont de betaaldienstkosten van vandaag transparant');
  /* EERST DE BESTEMMING, EN DIE ONTBRAK HIER JAREN. Deze toets heette
     "uitbetalen leegt de partnerpot" en stond op groen terwijl de betaalopdracht
     de rail op ging met een LEGE iban -- die reserveert dan en verstuurt niet,
     terwijl het saldo er al af was. De pot was inderdaad leeg; er was alleen
     nooit een rekening genoemd. Zie kern/pay/zaakrekening.js. */
  const zonder = await api('supplier/pay/uitbetaal', { idem: 'uit-0' }, supToken);
  assert.equal(zonder.status, 409, 'uitbetalen kon zonder dat er een rekening bekend was');
  assert.equal(zonder.body.reden, 'geen-rekening');
  assert.equal((await api('supplier/pay/overzicht', {}, supToken)).body.saldo, 2465,
    'de weigering had het saldo al afgeboekt -- dan is de volgorde niet de veiligheid');

  assert.equal((await api('supplier/pay/rekening', { iban: 'NL91ABNA0417164301' }, supToken)).status, 400,
    'een IBAN met verkeerde controlecijfers werd aangenomen');
  const rek = await api('supplier/pay/rekening', { iban: 'NL91 ABNA 0417 1643 00', naam: 'Strandtent' }, supToken);
  assert.equal(rek.status, 200, JSON.stringify(rek.body));

  const uit = await api('supplier/pay/uitbetaal', { idem: 'uit-1' }, supToken);
  assert.equal(uit.body.uitbetaald, 2465);
  /* EN DE REKENING GING MEE NAAR DE RAIL. Dit is de eigenlijke fout: zonder
     `bestemming` op de betaalopdracht reserveert server/betaal.js en verstuurt
     hij niet. Deze regel leest hem terug uit de opdracht zelf, want een
     assertie op wat we net hebben ingevuld bewijst niets. */
  assert.equal(uit.body.naarRekening, '4300',
    'de uitbetaling ging de rail op zonder de rekening van de zaak');

  /* EN DE WACHTTIJD OP EEN WIJZIGING. Die staat er niet tegen een tikfout
     (daar is de mod-97-toets voor) maar tegen een OVERNAME: wie de
     manager-inlog kaapt, zet zijn eigen rekening erin en trekt de pot leeg.
     Zijn hele plan hangt op snelheid. Op de eerste registratie staat hij
     bewust niet -- dat hindert alleen eerlijke zaken. */
  const anders = await api('supplier/pay/rekening', { iban: 'NL44 RABO 0123 4567 89', naam: 'Strandtent' }, supToken);
  assert.equal(anders.status, 200);
  assert.match(anders.body.melding, /gewijzigd/);
  const meteen = await api('supplier/pay/uitbetaal', { idem: 'uit-2' }, supToken);
  assert.equal(meteen.status, 409, 'een net gewijzigde rekening kon meteen ontvangen');
  assert.equal(meteen.body.reden, 'nog-in-wachttijd');
  assert.equal((await api('supplier/pay/overzicht', {}, supToken)).body.saldo, 0, 'uitbetaald naar de bank');
  /* De uitbetaling gaat sinds TAKEN.md 4.22 door de opdrachtenrij. Hier stond
     een compensatie: bij een fout van de betaal-naad werd de afboeking
     teruggedraaid en kreeg de partner 502. Dat klopt alleen als de payout zeker
     NIET is aangemaakt, en dat weet je bij een timeout juist niet -- dan kreeg
     hij zijn saldo terug terwijl het geld al onderweg was. Vandaar dat het
     antwoord nu zegt wat we echt weten: aangenomen, nog niet afgerond. */
  assert.ok(uit.body.opdrachtId, 'er hangt een betaalopdracht aan');
  assert.equal(uit.body.opdrachtStatus, 'INGEDIEND', 'aangenomen door de rail, niet "gelukt"');
});

test('de kassabon op RTG Pay: code tonen, afrekenen, en de betaler staat op de bon', async () => {
  // het lid maakt een verse betaalcode; de kassa rekent de bon ermee af
  const k = await api('pay/kascode', { maxCenten: 5000 }, lidA.token);
  assert.equal(k.status, 200);
  const bon = await api('supplier/pos/sale', {
    total: 21, method: 'rtgpay', payCode: k.body.code, idem: 'bon-rtgpay-1',
    items: [{ name: 'Gazpacho de sandia', qty: 1, price: 21 }]
  }, supToken);
  assert.equal(bon.status, 200);
  assert.equal(bon.body.sale.method, 'rtgpay');
  assert.equal(bon.body.betaler, lidA.codenaam, 'de bon weet wie er betaalde');
  assert.equal(bon.body.sale.betaaldienstKosten, 31, 'de bon draagt de direct verrekende betaaldienstkosten (10 + 1% van 2100)');
  assert.equal((await api('supplier/pay/overzicht', {}, supToken)).body.saldo, 2069, 'de partnerpot ving 21 euro netto');
  // een verkeerde of verlopen code betekent: geen betaling en geen bon
  const mis = await api('supplier/pos/sale', { total: 10, method: 'rtgpay', payCode: 'FFFFFF', idem: 'bon-rtgpay-2' }, supToken);
  assert.equal(mis.status, 404);
  assert.ok(mis.body.error, 'de kassa legt uit waarom het niet lukte');
});

test('de tik: ontvangen met een aanraking, betalen met een knop', async () => {
  // B zet zijn toestel op ontvangen; A tikt en betaalt
  const t = await api('pay/tikcode', {}, lidB.token);
  assert.equal(t.status, 200);
  assert.match(t.body.code, /^[0-9A-F]{6}$/);
  const voorB = (await api('pay/overzicht', {}, lidB.token)).body.saldo;
  const r = await api('pay/tik', { code: t.body.code, centen: 750, oms: 'Koffie terug', idem: 'tik-1' }, lidA.token);
  assert.equal(r.status, 200);
  assert.equal(r.body.aan, lidB.codenaam, 'de betaler ziet naar wie het ging');
  assert.equal((await api('pay/overzicht', {}, lidB.token)).body.saldo, voorB + 750);
  // dezelfde tik mag binnen zijn vijf minuten door een hele tafel gebruikt worden
  assert.equal((await api('pay/tik', { code: t.body.code, centen: 250, idem: 'tik-2' }, lidA.token)).status, 200);
  // naar jezelf tikken kan niet, en een onzincode ketst af
  assert.equal((await api('pay/tik', { code: t.body.code, centen: 100, idem: 'tik-3' }, lidB.token)).status, 400);
  assert.equal((await api('pay/tik', { code: '000000', centen: 100, idem: 'tik-4' }, lidA.token)).status, 404);
});

test('de tikgeschiedenis leest als een sociaal logboek: wie tikte wie', async () => {
  const vanA = await api('pay/tiks', {}, lidA.token);
  assert.equal(vanA.status, 200);
  const uit = vanA.body.tiks.find(x => x.richting === 'uit' && x.met === lidB.codenaam && x.centen === 750);
  assert.ok(uit, 'A ziet: jij tikte B');
  assert.equal(uit.oms, 'Koffie terug', 'met het verhaaltje erbij');
  const vanB = await api('pay/tiks', {}, lidB.token);
  assert.ok(vanB.body.tiks.some(x => x.richting === 'in' && x.met === lidA.codenaam), 'B ziet: A tikte jou');
  // gewone stortingen en kassabetalingen horen er niet in: alleen tikken
  assert.ok(vanA.body.tiks.every(x => x.met !== 'opgeladen'), 'opladen staat niet in de tikgeschiedenis');
});

test('het grootboek sluit op de cent en gasten komen er niet in', async () => {
  const g = await fetch(base + '/api/pay/gezond');
  assert.equal(g.status, 200);
  assert.equal((await g.json()).klopt, true, 'som van alle saldi is nul, niemand staat rood');
  // een gast heeft geen wallet
  const gast = await fetch(base + '/api/login', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ tier: 'guest' }) });
  const gastToken = (await gast.json()).token;
  assert.equal((await api('pay/overzicht', {}, gastToken)).status, 403);
  // en de geschiedenis leest als een bankafschrift
  const o = await api('pay/overzicht', {}, lidA.token);
  assert.ok(o.body.geschiedenis.some(h => h.centen === -2500 && /zaak /.test(h.tegen)), 'de kassabetaling staat erin');
  assert.ok(o.body.geschiedenis.some(h => h.centen === 5000 && h.tegen === 'opgeladen'), 'het opladen staat erin');
});

/* Idempotentie is aan het VERZOEK gebonden, niet alleen aan de sleutel. De apps
   bouwen hun idem-sleutel uit Date.now(), dus twee verschillende acties in
   dezelfde milliseconde krijgen echt dezelfde sleutel. Zonder binding kreeg de
   tweede stil het antwoord van de eerste terug: "gelukt" voor een overboeking
   die nooit is geboekt. Nu is dat een zichtbare 409. */
test('dezelfde idem-sleutel met een ander verzoek geeft een conflict, geen valse "gelukt"', async () => {
  const voor = (await api('pay/overzicht', {}, lidB.token)).body.saldo;
  const sleutel = 'bind-' + Date.now();

  // A stuurt 111 cent naar B
  const eerste = await api('pay/stuur', { aan: lidB.codenaam, centen: 111, oms: 'eerste', idem: sleutel }, lidA.token);
  assert.equal(eerste.status, 200, 'de eerste boeking lukt');
  const naEerste = (await api('pay/overzicht', {}, lidB.token)).body.saldo;
  assert.equal(naEerste, voor + 111, 'B kreeg 111 cent');

  // exact hetzelfde verzoek nog eens: herhaling, niet dubbel boeken
  const herhaal = await api('pay/stuur', { aan: lidB.codenaam, centen: 111, oms: 'eerste', idem: sleutel }, lidA.token);
  assert.equal(herhaal.status, 200, 'identiek verzoek mag herhalen');
  assert.equal(herhaal.body.herhaald, true, 'en is als herhaling gemarkeerd');
  assert.equal((await api('pay/overzicht', {}, lidB.token)).body.saldo, voor + 111, 'niet dubbel geboekt');

  // ander bedrag onder dezelfde sleutel: conflict, en er beweegt geen cent
  const anderBedrag = await api('pay/stuur', { aan: lidB.codenaam, centen: 99999, oms: 'eerste', idem: sleutel }, lidA.token);
  assert.equal(anderBedrag.status, 409, 'ander bedrag onder dezelfde sleutel is een conflict');
  assert.equal((await api('pay/overzicht', {}, lidB.token)).body.saldo, voor + 111, 'saldo onveranderd na het conflict');

  // alleen een andere omschrijving is GEEN ander verzoek: vrije tekst telt niet mee
  const andereOms = await api('pay/stuur', { aan: lidB.codenaam, centen: 111, oms: 'heel andere tekst', idem: sleutel }, lidA.token);
  assert.equal(andereOms.status, 200, 'andere omschrijving blijft een herhaling');
  assert.equal(andereOms.body.herhaald, true);

  // en het grootboek sluit nog steeds
  assert.equal((await (await fetch(base + '/api/pay/gezond')).json()).klopt, true, 'grootboek sluit');
});

/* UITBETALEN IS EEN GELDHANDELING, GEEN WERKHANDELING.

   /api/supplier/pay/uitbetaal stuurt het hele RTG Pay-saldo van de zaak naar
   de bank en roept daarvoor de echte betaaldienst aan. Hij stond op
   supplierAuth, en dat is ELKE ingelogde medewerker: de afwasser met een
   pincode kon de kas van de zaak leegtrekken. Innen en het saldo bekijken
   blijven van iedereen -- dat is het werk. */
test('het saldo van de zaak uitbetalen is van de manager, innen en kijken van iedereen', async () => {
  const roster = await (await fetch(base + '/api/supplier/roster', {
    method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ code: supCode })
  })).json();
  const staf = (roster.staff || []).find(x => x.role !== 'manager');
  assert.ok(staf, 'de zaak heeft personeel zonder managerrechten');
  const inlog = await (await fetch(base + '/api/supplier/login', {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ code: supCode, staffId: staf.id, pin: '5678' })
  })).json();
  assert.ok(inlog.token, 'het personeelslid is ingelogd');

  // kijken mag: het saldo zien hoort bij het werk aan de kassa
  assert.equal((await api('supplier/pay/overzicht', {}, inlog.token)).status, 200, 'het saldo bekijken blijft van iedereen');
  // innen mag: dat IS het werk
  assert.equal((await api('supplier/pay/in', { code: 'BESTAATNIET', centen: 100 }, inlog.token)).status, 404,
    'innen komt gewoon door de deur (en struikelt pas op de onbekende code)');
  // weghalen niet
  const uit = await api('supplier/pay/uitbetaal', { idem: 'staf-probeert-1' }, inlog.token);
  assert.equal(uit.status, 403, 'een medewerker zonder managerrechten betaalt niets uit');
  assert.match(uit.body.error, /manager/i);
});

/* DE HERHALING OP DE ROUTES DIE GELD VERPLAATSEN.

   Elke geldbeweging in server/kern/pay/ loopt door metIdem() -- stuur, huisIn,
   huisUit, het Klompje, de kassa, de uitbetaling en het opladen. Wat er niet was,
   is een toets die dat voor STUREN en TIKKEN natrekt. `npm run idemproef` kon het
   ook niet zeggen: van de 85 geldroutes staan er 79 op "ongemeten", omdat de
   proef zelf geen geldige codenaam of kascode kan verzinnen en dus een 404 vangt.
   Een route die alleen maar niet weerlegd is, is niet bewezen.

   Dat is geen theoretische zorg. Een telefoon op een slechte verbinding stuurt
   een POST twee keer -- de gebruiker ziet geen antwoord en tikt nog eens -- en
   dan hangt het aan deze sleutel of er een of twee keer geld weggaat. */
test('sturen met dezelfde sleutel boekt EEN keer, ook al vraag je het twee keer', async () => {
  const voorA = (await api('pay/overzicht', {}, lidA.token)).body.saldo;
  const voorB = (await api('pay/overzicht', {}, lidB.token)).body.saldo;
  await api('pay/oplaad', { centen: 3000, idem: 'oplaad-voor-herhaling' }, lidA.token);

  const sleutel = 'stuur-dubbel-1';
  const een = await api('pay/stuur', { aan: lidB.codenaam, centen: 700, oms: 'Koffie', idem: sleutel }, lidA.token);
  assert.equal(een.status, 200, 'de eerste gaat door: ' + JSON.stringify(een.body).slice(0, 120));
  const twee = await api('pay/stuur', { aan: lidB.codenaam, centen: 700, oms: 'Koffie', idem: sleutel }, lidA.token);
  assert.equal(twee.status, 200, 'de herhaling is geen fout maar hetzelfde antwoord');

  const naA = (await api('pay/overzicht', {}, lidA.token)).body.saldo;
  const naB = (await api('pay/overzicht', {}, lidB.token)).body.saldo;
  assert.equal(naA, voorA + 3000 - 700, 'A is EEN keer 7 euro kwijt, niet twee keer');
  assert.equal(naB, voorB + 700, 'en B kreeg er EEN keer 7 euro bij');
});

test('een VERSE sleutel is een tweede opdracht, en die hoort wel te boeken', async () => {
  /* De tegenproef bij de toets hierboven: zonder deze zou een stuur() die
     alles weigert ook slagen. Het verschil tussen "hij herkent de herhaling" en
     "hij doet niets meer" is precies wat hier gemeten wordt. */
  const voorB = (await api('pay/overzicht', {}, lidB.token)).body.saldo;
  const r = await api('pay/stuur', { aan: lidB.codenaam, centen: 300, oms: 'Nog een rondje', idem: 'stuur-vers-2' }, lidA.token);
  assert.equal(r.status, 200);
  assert.equal((await api('pay/overzicht', {}, lidB.token)).body.saldo, voorB + 300,
    'een andere sleutel is een andere opdracht en boekt gewoon');
});

test('en de tik gaat langs dezelfde sleutel: twee keer aanraken kost een keer geld', async () => {
  const code = await api('pay/tikcode', {}, lidB.token);
  assert.equal(code.status, 200, 'B toont een tikcode');
  const voorA = (await api('pay/overzicht', {}, lidA.token)).body.saldo;
  const voorB = (await api('pay/overzicht', {}, lidB.token)).body.saldo;

  const sleutel = 'tik-dubbel-1';
  const een = await api('pay/tik', { code: code.body.code, centen: 450, oms: 'Tik', idem: sleutel }, lidA.token);
  assert.equal(een.status, 200, 'de tik gaat door: ' + JSON.stringify(een.body).slice(0, 120));
  await api('pay/tik', { code: code.body.code, centen: 450, oms: 'Tik', idem: sleutel }, lidA.token);

  assert.equal((await api('pay/overzicht', {}, lidA.token)).body.saldo, voorA - 450, 'A betaalde EEN keer');
  assert.equal((await api('pay/overzicht', {}, lidB.token)).body.saldo, voorB + 450, 'B ontving EEN keer');
});

/* TWEE KEER OP DE KNOP IS IETS ANDERS DAN EEN HERHAALD VERZOEK.

   `/api/pay/kascode` en `/api/pay/tikcode` MAKEN een code van vijf minuten. Wie
   twee keer op de knop drukt, wil een verse code -- en krijgt die ook. Wat
   daarbij niet mag gebeuren is dat er twee codes tegelijk open staan: allebei
   zetten ze de vorige code van dit lid eerst dood, dus na twee oproepen leeft er
   precies een en valt er niets op te tellen. Er beweegt hier ook geen cent; geld
   gaat pas lopen bij `/api/supplier/pay/in` en `/api/pay/tik`, en die dragen een
   idem-sleutel (de toetsen daarvoor staan hierboven).

   Het andere geval -- HETZELFDE verzoek dat nog een keer binnenkomt, met dezelfde
   idem-sleutel -- staat onderaan dit bestand. Daar hoort de code van de eerste
   oproep juist te blijven leven. De twee toetsen zijn elkaars tegenhanger, en ze
   staan er allebei omdat de proef anders niet kan zien welk gedrag bedoeld was. */
test('twee keer een code vragen laat er een leven, niet twee (kascode en tikcode)', async () => {
  // de kassacode: de tweede oproep verdringt de eerste
  const eerste = await api('pay/kascode', { maxCenten: 5000 }, lidA.token);
  const tweede = await api('pay/kascode', { maxCenten: 5000 }, lidA.token);
  assert.equal(tweede.status, 200);
  assert.notEqual(eerste.body.code, tweede.body.code,
    'de herhaling geeft een verse code -- daarom noemt de proef deze route onbeschermd');
  assert.equal((await api('supplier/pay/in', { code: eerste.body.code, centen: 100, idem: 'kas-oud-1' }, supToken)).status, 404,
    'maar de eerste code is dood; er staan er nooit twee tegelijk open');
  assert.equal((await api('supplier/pay/in', { code: tweede.body.code, centen: 100, idem: 'kas-nieuw-1' }, supToken)).status, 200,
    'de laatste code is de enige die het doet');

  // de tikcode: dezelfde vraag aan de kant van de ontvanger
  const t1 = await api('pay/tikcode', {}, lidB.token);
  const t2 = await api('pay/tikcode', {}, lidB.token);
  assert.equal(t2.status, 200);
  assert.notEqual(t1.body.code, t2.body.code, 'ook hier is de herhaling een verse code');
  assert.equal((await api('pay/tik', { code: t1.body.code, centen: 100, idem: 'tik-oud-1' }, lidA.token)).status, 404,
    'en ook hier vervalt de vorige zodra de nieuwe er is');
  assert.equal((await api('pay/tik', { code: t2.body.code, centen: 100, idem: 'tik-nieuw-1' }, lidA.token)).status, 200,
    'de laatste tik werkt wel');

  // en na dit alles sluit het grootboek nog steeds op de cent
  assert.equal((await (await fetch(base + '/api/pay/gezond')).json()).klopt, true, 'grootboek sluit');
});

/* EN DE ANDERE KANT VAN DEZELFDE VRAAG: EEN RETRY MAG GEEN NIEUWE CODE MAKEN.

   De toets hierboven zegt dat twee LOSSE keren vragen er een laat leven. Dat is
   het goede gedrag voor iemand die twee keer op de knop drukt. Maar een
   herhaling van HETZELFDE verzoek -- een load balancer die één keer opnieuw
   probeert -- is iets anders: die hoort de code terug te krijgen die de gast al
   op zijn scherm heeft, in plaats van hem te verdringen. De staatproef betrapte
   dat: dezelfde sleutel legde een tweede rij in `payCodes`.

   /api/pay/* gaat met opzet om de dubbeltik heen (geld heeft een duurzame,
   strengere laag), maar deze twee verplaatsen geen geld -- ze maken een token
   van vijf minuten. Ze staan daarom bij naam op de uitzonderingslijst in
   server/opzet/geldwegen.js. Mutatie: `GEEN_GELD` daar leegmaken laat deze
   toets zakken op "de herhaling gaf een nieuwe code". */
test('een retry met dezelfde sleutel geeft dezelfde code terug, en verdringt de vorige niet', async () => {
  const sleutel = 'kascode-retry-' + Date.now().toString(36);
  const a = await api('pay/kascode', { maxCenten: 5000, idem: sleutel }, lidA.token);
  const b = await api('pay/kascode', { maxCenten: 5000, idem: sleutel }, lidA.token);
  assert.equal(b.status, 200);
  assert.equal(b.body.code, a.body.code, 'de herhaling geeft dezelfde code');
  assert.equal(b.body.herhaald, true, 'en de server zegt zelf dat hij de herhaling herkende');
  assert.equal((await api('supplier/pay/in', { code: a.body.code, centen: 100, idem: 'kas-retry-in' }, supToken)).status, 200,
    'de code van de eerste oproep leeft nog: er is er geen verdrongen');

  const tSleutel = 'tikcode-retry-' + Date.now().toString(36);
  const t1 = await api('pay/tikcode', { idem: tSleutel }, lidB.token);
  const t2 = await api('pay/tikcode', { idem: tSleutel }, lidB.token);
  assert.equal(t2.body.code, t1.body.code, 'ook de tikcode overleeft een retry');
  assert.equal(t2.body.herhaald, true);
  assert.equal((await api('pay/tik', { code: t1.body.code, centen: 100, idem: 'tik-retry-1' }, lidA.token)).status, 200,
    'en die code doet het nog');

  assert.equal((await (await fetch(base + '/api/pay/gezond')).json()).klopt, true, 'grootboek sluit');
});
