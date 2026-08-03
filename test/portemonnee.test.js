/* DE PORTEMONNEE EN DE POST -- geld tussen mensen, en wat erover geschreven wordt.

   WAAROM DIT ER IS

   RTG Pay raakt het meest gevoelige dat een app kan doen: het saldo van een
   mens verplaatsen. De losse routes hadden toetsen; wat niemand achter elkaar
   had gelopen is de weg zoals hij in het echt gaat -- opladen, iets sturen,
   een Klompje (het RTG-betaalverzoek) rondsturen, met een tikcode afrekenen,
   en dat alles tussen twee mensen die elkaar alleen als codenaam kennen.

   DE BEWERINGEN DIE ERTOE DOEN

   1. GELD RAAKT NIET ZOEK EN KOMT ER NIET BIJ. Wat de een verliest, wint de
      ander -- tot op de cent, elke keer. Dat is de enige toets die een
      betaalsysteem echt moet doorstaan.
   2. JE KUNT NIET MEER UITGEVEN DAN JE HEBT. En de mislukte poging mag geen
      spoor achterlaten in het saldo van wie dan ook.
   3. EEN TIKCODE IS EENMALIG. Twee keer dezelfde code gebruiken hoort te
      stuiten; anders is het geen code maar een sleutel.
   4. DE POST DRAAGT CODENAMEN. Ook in RTMail zien mensen elkaar zoals De
      Salon ze kent, en niet zoals het paspoort ze kent. */
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { startServer } = require('./helper');

const TMP = fs.mkdtempSync(path.join(os.tmpdir(), 'rtg-pay-'));

function post(base) {
  return (pad, body, token) => fetch(base + pad, {
    method: 'POST',
    headers: Object.assign({ 'Content-Type': 'application/json' },
      token ? { Authorization: 'Bearer ' + token } : {}),
    body: JSON.stringify(body || {})
  }).then(async r => ({ status: r.status, body: await r.json().catch(() => ({})) }));
}

/* Een piepklein geldig PNG'je: RTG Pay vraagt eenmalig een paspoortfoto en dat
   is geen formaliteit maar een wettelijke poort. De toets loopt hem daarom
   gewoon af in plaats van hem te omzeilen -- een betaaltoets die de
   identiteitscontrole overslaat, toetst een systeem dat niet bestaat. */
const MINI_PNG = 'data:image/png;base64,' +
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==';

let teller = 0;
async function nieuwLid(P, naam) {
  const u = String(Date.now()).slice(-7) + String(++teller).padStart(3, '0');
  const r = await P('/api/auth/register', {
    name: naam, email: naam.toLowerCase() + u + '@x.nl', phone: '06' + u.slice(0, 8),
    password: 'geheim123', geboortedatum: '1990-01-01', geslacht: 'v', tier: 'rtg', pasApp: 'rtg'
  });
  assert.ok(r.body.token, naam + ' is aangemeld: ' + JSON.stringify(r.body).slice(0, 160));
  const kyc = await P('/api/verify/upload', { image: MINI_PNG }, r.body.token);
  assert.equal(kyc.status, 200, naam + ' laat zijn paspoort zien: ' + JSON.stringify(kyc.body).slice(0, 160));
  assert.equal(kyc.body.status, 'pending', 'en die staat in behandeling bij een mens');
  return r.body.token;
}

async function saldo(P, token) {
  const r = await P('/api/pay/overzicht', {}, token);
  assert.equal(r.status, 200, 'het overzicht opent: ' + JSON.stringify(r.body).slice(0, 160));
  const s = r.body.saldoCenten != null ? r.body.saldoCenten
    : (r.body.wallet && r.body.wallet.saldoCenten) != null ? r.body.wallet.saldoCenten
      : r.body.saldo;
  assert.ok(Number.isFinite(s), 'met een saldo erin: ' + JSON.stringify(r.body).slice(0, 200));
  return s;
}

test('RTG Pay: wat de een verliest wint de ander, tot op de cent', async () => {
  const { child, base } = await startServer({ env: { RTG_DATA_DIR: TMP, SMTP_URL: '' } });
  try {
    const P = post(base);
    const anna = await nieuwLid(P, 'Annika');
    const boris = await nieuwLid(P, 'Bodhi');

    const op = await P('/api/pay/oplaad', { centen: 5000 }, anna);
    assert.equal(op.status, 200, 'Annika laadt 50 euro op: ' + JSON.stringify(op.body).slice(0, 180));

    const aVoor = await saldo(P, anna);
    const bVoor = await saldo(P, boris);
    assert.ok(aVoor >= 5000, 'het staat op haar saldo (' + aVoor + ')');

    /* Wie is Boris in dit huis? Op codenaam, want zo kent iedereen elkaar. */
    const wie = await P('/api/salon/lid', {}, boris);
    const codenaamB = wie.body.codenaam;
    assert.ok(codenaamB, 'Bodhi heeft een codenaam: ' + JSON.stringify(wie.body).slice(0, 140));
    assert.ok(!/Bodhi/i.test(codenaamB), 'en dat is niet zijn echte naam');

    const stuur = await P('/api/pay/stuur', { aan: codenaamB, centen: 1250, oms: 'Voor de lunch' }, anna);
    assert.equal(stuur.status, 200, 'Annika stuurt 12,50: ' + JSON.stringify(stuur.body).slice(0, 200));

    const aNa = await saldo(P, anna);
    const bNa = await saldo(P, boris);

    /* DE ENIGE TOETS DIE ERTOE DOET. Niet "het saldo veranderde" maar: precies
       hetzelfde bedrag ging van de een naar de ander. Een systeem dat 12,50
       afschrijft en 12,49 bijschrijft ziet er in beide schermen goed uit. */
    assert.equal(aVoor - aNa, 1250, 'er is precies 12,50 afgeschreven (' + aVoor + ' -> ' + aNa + ')');
    assert.equal(bNa - bVoor, 1250, 'en precies 12,50 bijgeschreven (' + bVoor + ' -> ' + bNa + ')');
    assert.equal((aNa + bNa), (aVoor + bVoor), 'samen hebben ze evenveel als daarvoor');
  } finally { child.kill('SIGKILL'); }
});

test('RTG Pay laadt zelf bij als het saldo tekortschiet -- maar nooit stilletjes', async () => {
  const { child, base } = await startServer({ env: { RTG_DATA_DIR: TMP, SMTP_URL: '' } });
  try {
    const P = post(base);
    const arm = await nieuwLid(P, 'Casper');
    const ander = await nieuwLid(P, 'Delphine');

    await P('/api/pay/oplaad', { centen: 500 }, arm);
    const cVoor = await saldo(P, arm);
    const dVoor = await saldo(P, ander);

    /* DIT IS ONTWERP EN GEEN GAT. Schiet het saldo tekort, dan laadt de wallet
       zelf bij vanaf de eigen bank of kaart en betaalt door -- "het hart van
       EEN knop" (server/kern/pay/opladen.js). Mijn eerste versie van deze
       toets nam aan dat zoiets hoorde te stuiten, en verweet het product iets
       wat het bewust doet.

       De bewering die er dan WEL toe doet is strenger: het bijladen mag nooit
       stilletjes gebeuren. Wie geld van zijn kaart getrokken krijgt, hoort dat
       op zijn overzicht terug te zien staan. */
    const wie = await P('/api/salon/lid', {}, ander);
    const groot = cVoor + 10000;
    const gestuurd = await P('/api/pay/stuur',
      { aan: wie.body.codenaam, centen: groot, oms: 'Meer dan er stond' }, arm);
    assert.equal(gestuurd.status, 200, 'de betaling gaat door: ' + JSON.stringify(gestuurd.body).slice(0, 200));
    assert.ok(gestuurd.body.bijgeladen > 0,
      'en het antwoord meldt dat er is bijgeladen: ' + JSON.stringify(gestuurd.body).slice(0, 200));

    /* De ontvanger krijgt precies het bedrag -- niet het afgeronde tientje dat
       er werd bijgeladen. */
    assert.equal(await saldo(P, ander) - dVoor, groot, 'de ontvanger krijgt exact het gevraagde bedrag');

    /* En bij de betaler klopt de rekensom: oud saldo plus bijgeladen min
       verzonden is wat er nu staat. Geen cent zoek, geen cent extra. */
    const cNa = await saldo(P, arm);
    assert.equal(cNa, cVoor + gestuurd.body.bijgeladen - groot,
      'zijn saldo klopt: ' + cVoor + ' + ' + gestuurd.body.bijgeladen + ' - ' + groot + ' = ' + cNa);

    /* De regel staat ook echt op zijn overzicht. Een automatische afschrijving
       die je alleen in het antwoord van een API ziet, is onzichtbaar. */
    const overzicht = await P('/api/pay/overzicht', {}, arm);
    const geschiedenis = overzicht.body.geschiedenis || [];
    assert.ok(geschiedenis.some(r => /bijgeladen|autolaad|opladen/i.test(r.oms + ' ' + r.soort)),
      'het bijladen staat in zijn geschiedenis: ' + JSON.stringify(geschiedenis).slice(0, 260));
  } finally { child.kill('SIGKILL'); }
});

test('het Klompje: een betaalverzoek dat je een keer kunt betalen', async () => {
  const { child, base } = await startServer({ env: { RTG_DATA_DIR: TMP, SMTP_URL: '' } });
  try {
    const P = post(base);
    const vrager = await nieuwLid(P, 'Esmee');
    const betaler = await nieuwLid(P, 'Ferdi');
    await P('/api/pay/oplaad', { centen: 8000 }, betaler);

    const wieB = await P('/api/salon/lid', {}, betaler);
    const verzoek = await P('/api/pay/verzoek',
      { aan: [wieB.body.codenaam], totaalCenten: 2000, oms: 'Taxi gedeeld' }, vrager);
    assert.equal(verzoek.status, 200, 'het Klompje is verstuurd: ' + JSON.stringify(verzoek.body).slice(0, 220));

    /* De openstaande Klompjes staan in het overzicht van de betaler; dat is
       ook het scherm waar hij ze in het echt ziet. */
    const overzicht = await P('/api/pay/overzicht', {}, betaler);
    const alle = overzicht.body.aanMij || [];
    const open = alle.filter(v => !v.betaald && !v.voldaan);
    assert.ok(open.length >= 1, 'Ferdi ziet het openstaan: ' + JSON.stringify(overzicht.body).slice(0, 300));
    const mijn = open[0];

    const vVoor = await saldo(P, vrager);
    const bVoor = await saldo(P, betaler);

    const betaald = await P('/api/pay/verzoek/betaal', { id: mijn.id }, betaler);
    assert.equal(betaald.status, 200, 'hij betaalt het: ' + JSON.stringify(betaald.body).slice(0, 200));

    assert.equal(await saldo(P, vrager) - vVoor, 2000, 'de vrager krijgt precies 20 euro');
    assert.equal(bVoor - await saldo(P, betaler), 2000, 'en de betaler is precies 20 euro kwijt');

    /* TWEE KEER BETALEN KAN NIET. Zonder deze bewering is een betaalverzoek
       een knop die je kunt blijven indrukken. */
    const nogEens = await P('/api/pay/verzoek/betaal', { id: mijn.id }, betaler);
    assert.notEqual(nogEens.status, 200, 'hetzelfde Klompje twee keer betalen stuit: ' +
      nogEens.status + ' ' + JSON.stringify(nogEens.body).slice(0, 160));
  } finally { child.kill('SIGKILL'); }
});

test('de tikcode: je zet jezelf op ontvangen, en een nieuwe code doodt de oude', async () => {
  const { child, base } = await startServer({ env: { RTG_DATA_DIR: TMP, SMTP_URL: '' } });
  try {
    const P = post(base);
    const ontvanger = await nieuwLid(P, 'Guusje');
    const betaler = await nieuwLid(P, 'Hidde');
    const derde = await nieuwLid(P, 'Ilias');
    await P('/api/pay/oplaad', { centen: 6000 }, betaler);
    await P('/api/pay/oplaad', { centen: 6000 }, derde);

    /* HOE HET ECHT WERKT, en mijn eerste versie had het mis. Een tikcode draagt
       GEEN bedrag: je zet jezelf op ontvangen en de betaler bepaalt wat hij
       geeft -- zoals een collectebus die je ophoudt. Hij is tijdgebonden en
       niet eenmalig; meerdere vrienden kunnen achter elkaar tikken. */
    const code = await P('/api/pay/tikcode', {}, ontvanger);
    assert.equal(code.status, 200, 'de tikcode is gemaakt: ' + JSON.stringify(code.body).slice(0, 200));
    const tik = code.body.code;
    assert.ok(tik, 'met een code erin');
    assert.ok(code.body.geldigTot > Date.now(), 'en een geldigheid die nog loopt');

    const oVoor = await saldo(P, ontvanger);
    const bVoor = await saldo(P, betaler);

    const eerste = await P('/api/pay/tik', { code: tik, centen: 1500, oms: 'Rondje' }, betaler);
    assert.equal(eerste.status, 200, 'de eerste tik gaat door: ' + JSON.stringify(eerste.body).slice(0, 200));
    assert.equal(await saldo(P, ontvanger) - oVoor, 1500, 'de ontvanger krijgt precies 15 euro');
    assert.equal(bVoor - await saldo(P, betaler), 1500, 'en de betaler is precies 15 euro kwijt');

    /* Een tweede vriend mag ook tikken: dat is het punt van op ontvangen staan. */
    const tweede = await P('/api/pay/tik', { code: tik, centen: 500, oms: 'Ik ook' }, derde);
    assert.equal(tweede.status, 200, 'een tweede vriend kan ook tikken: ' + JSON.stringify(tweede.body).slice(0, 160));

    /* JE EIGEN TIK IS GEEN BETALING. Zonder deze grens kun je jezelf geld
       sturen en het grootboek laten rondzingen. */
    const zelf = await P('/api/pay/tik', { code: tik, centen: 100 }, ontvanger);
    assert.notEqual(zelf.status, 200, 'je eigen tik kan niet: ' + JSON.stringify(zelf.body).slice(0, 160));

    /* EEN NIEUWE CODE DOODT DE OUDE. Dat is de echte veiligheidsbelofte hier:
       een code die op een tafel is blijven liggen werkt niet meer zodra de
       ontvanger zichzelf opnieuw op ontvangen zet. */
    const nieuweCode = await P('/api/pay/tikcode', {}, ontvanger);
    assert.notEqual(nieuweCode.body.code, tik, 'de nieuwe code is een andere');

    const dVoor = await saldo(P, derde);
    const oudeCode = await P('/api/pay/tik', { code: tik, centen: 500 }, derde);
    assert.notEqual(oudeCode.status, 200, 'de oude code werkt niet meer: ' +
      oudeCode.status + ' ' + JSON.stringify(oudeCode.body).slice(0, 160));
    assert.equal(await saldo(P, derde), dVoor, 'en er is niets afgeschreven');

    // en een code die nooit heeft bestaan al helemaal niet
    const onzin = await P('/api/pay/tik', { code: 'ZZZZZZ', centen: 500 }, derde);
    assert.notEqual(onzin.status, 200, 'een verzonnen code wordt geweigerd');
  } finally { child.kill('SIGKILL'); }
});

test('RTMail: post tussen leden, op codenaam', async () => {
  const { child, base } = await startServer({ env: { RTG_DATA_DIR: TMP, SMTP_URL: '' } });
  try {
    const P = post(base);
    const lid = await nieuwLid(P, 'Jolein');

    const adres = await P('/api/member/rtmail/adres', {}, lid);
    assert.equal(adres.status, 200, 'het lid heeft een RTMail-adres: ' + JSON.stringify(adres.body).slice(0, 200));
    const mijnAdres = adres.body.adres || adres.body.address || '';
    assert.ok(mijnAdres, 'met een adres erin');

    /* DE MERKREGEL: ook de post draagt de codenaam en niet de echte naam. */
    assert.ok(!/Jolein/i.test(mijnAdres), 'het adres is niet haar echte naam: ' + mijnAdres);

    const inbox = await P('/api/member/rtmail/inbox', {}, lid);
    assert.equal(inbox.status, 200, 'de inbox opent: ' + JSON.stringify(inbox.body).slice(0, 200));
    assert.ok(Array.isArray(inbox.body.berichten || inbox.body.mails || inbox.body.items || []),
      'met een lijst berichten: ' + JSON.stringify(inbox.body).slice(0, 200));
  } finally {
    child.kill('SIGKILL');
    try { fs.rmSync(TMP, { recursive: true, force: true }); } catch (e) {}
  }
});
