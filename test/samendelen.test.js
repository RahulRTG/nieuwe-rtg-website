/* SAMEN DELEN -- vrienden worden, samen uitgeven, verrekenen, en de wekker.

   WAAROM DIT ER IS

   Wie betaalt wat (WBW) is het lijstje waar vriendschappen op stuklopen: een
   weekend weg, vier mensen, iedereen legt iets voor, en aan het eind moet er
   een som kloppen die niemand met de hand narekent. Precies daarom hoort een
   toets hem wel na te rekenen.

   En de keten ervoor telt mee: een lijstje kan alleen met SALON-VRIENDEN, dus
   de weg begint bij elkaar vinden en een verzoek accepteren. Dat is geen
   omweg maar de beveiliging -- zonder die grens kan iedereen iedereen in een
   geldlijstje trekken.

   WAT ER WORDT NAGETROKKEN

   1. EEN VREEMDE KOMT ER NIET IN. Een lijstje maken met iemand die je niet
      als vriend hebt, hoort te stuiten.
   2. DE BALANS KLOPT. Wie voorschiet staat in de plus, wie meegeniet in de
      min, en alles bij elkaar opgeteld is nul. Een lijstje waarvan de balans
      niet op nul uitkomt, heeft geld verzonnen of laten verdwijnen.
   3. VERREKENEN VERPLAATST ECHT GELD, via RTG Pay, en daarna staat de balans
      op nul.
   4. DE WEKKER onthoudt wat je zet en gaat niet af op een verzonnen tijd. */
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { startServer } = require('./helper');

const TMP = fs.mkdtempSync(path.join(os.tmpdir(), 'rtg-samen-'));

const MINI_PNG = 'data:image/png;base64,' +
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==';

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
  assert.ok(r.body.token, naam + ' is aangemeld: ' + JSON.stringify(r.body).slice(0, 160));
  await P('/api/verify/upload', { image: MINI_PNG }, r.body.token);   // RTG Pay vraagt een paspoort
  const wie = await P('/api/salon/lid', {}, r.body.token);
  return { token: r.body.token, codenaam: wie.body.codenaam };
}

/* Vrienden worden zoals het hoort: de een stuurt een verzoek, de ander
   accepteert. Beide kanten zijn nodig -- daar gaat het bij zo'n grens om. */
async function wordVrienden(P, a, b) {
  /* Eerst zoeken. Leden vinden elkaar op CODENAAM en nooit op echte naam, en
     de sleutel waarmee je verbindt komt uit dat zoekresultaat -- je typt hem
     niet zelf. */
  const gevonden = await P('/api/member/find', { q: b.codenaam }, a.token);
  assert.equal(gevonden.status, 200, 'het zoeken werkt: ' + JSON.stringify(gevonden.body).slice(0, 180));
  const treffer = (gevonden.body.results || []).find(x => x.codename === b.codenaam || x.key === b.codenaam);
  assert.ok(treffer, 'de ander is te vinden op codenaam: ' + JSON.stringify(gevonden.body).slice(0, 220));
  const sleutel = treffer.key || treffer.codename;

  const heen = await P('/api/member/connect', { key: sleutel }, a.token);
  assert.equal(heen.status, 200, 'het verzoek gaat de deur uit: ' + JSON.stringify(heen.body).slice(0, 160));
  const terugZoek = await P('/api/member/find', { q: a.codenaam }, b.token);
  const terugTreffer = (terugZoek.body.results || []).find(x => x.codename === a.codenaam || x.key === a.codenaam);
  const terug = await P('/api/member/connect/respond',
    { key: (terugTreffer && (terugTreffer.key || terugTreffer.codename)) || a.codenaam, action: 'accept' }, b.token);
  assert.equal(terug.status, 200, 'en wordt geaccepteerd: ' + JSON.stringify(terug.body).slice(0, 160));

  const lijst = await P('/api/member/connections', {}, a.token);
  const vrienden = lijst.body.connections || [];
  const contact = vrienden.find(c => c.codename === b.codenaam || c.key === b.codenaam);
  assert.ok(contact, 'ze staan nu in elkaars lijst: ' + JSON.stringify(vrienden).slice(0, 220));
  /* De SLEUTEL van het contact, niet zijn codenaam: daarmee praat de rest van
     het huis over mensen. De codenaam is wat je ziet, de sleutel is wat de
     lijstjes gebruiken. */
  return contact.key;
}

async function saldo(P, token) {
  const r = await P('/api/pay/overzicht', {}, token);
  return r.body.saldo;
}

test('Wie betaalt wat: alleen met vrienden, en de balans komt op nul uit', async () => {
  const { child, base } = await startServer({ env: { RTG_DATA_DIR: TMP, SMTP_URL: '' } });
  try {
    const P = post(base);
    const anna = await nieuwLid(P, 'Anouschka');
    const bram = await nieuwLid(P, 'Bertram');
    const vreemde = await nieuwLid(P, 'Vreemdeling');

    /* ---- 1. EEN VREEMDE KOMT ER NIET IN. Zonder deze grens kan iedereen
       iedereen in een geldlijstje trekken. ---- */
    const metVreemde = await P('/api/wbw/maak',
      { naam: 'Weekend', leden: [vreemde.codenaam] }, anna.token);
    assert.notEqual(metVreemde.status, 200,
      'een lijstje met een vreemde stuit: ' + metVreemde.status + ' ' + JSON.stringify(metVreemde.body).slice(0, 160));

    const bramKey = await wordVrienden(P, anna, bram);
    assert.ok(bramKey, 'we kennen zijn sleutel');

    const groep = await P('/api/wbw/maak', { naam: 'Weekend Formentera', leden: [bramKey] }, anna.token);
    assert.equal(groep.status, 200, 'met een vriend lukt het wel: ' + JSON.stringify(groep.body).slice(0, 200));
    const gid = (groep.body.groep && groep.body.groep.id) || groep.body.id;
    assert.ok(gid, 'het lijstje heeft een kenmerk');

    /* ---- 2. DE BALANS. Anna legt 60 euro voor de boot voor, Bram 20 voor de
       lunch. Beide uitgaven zijn voor hen samen, dus ieder de helft: Anna
       heeft 60 betaald en 40 verbruikt (+20), Bram 20 betaald en 40 verbruikt
       (-20). Dat is met een pen na te rekenen, en dat is precies de bedoeling. ---- */
    const u1 = await P('/api/wbw/uitgave', { id: gid, centen: 6000, oms: 'Boot' }, anna.token);
    assert.equal(u1.status, 200, 'de boot staat erop: ' + JSON.stringify(u1.body).slice(0, 160));
    const u2 = await P('/api/wbw/uitgave', { id: gid, centen: 2000, oms: 'Lunch' }, bram.token);
    assert.equal(u2.status, 200, 'de lunch ook');

    const beeld = await P('/api/wbw/groep', { id: gid }, anna.token);
    assert.equal(beeld.status, 200, 'het lijstje opent: ' + JSON.stringify(beeld.body).slice(0, 200));
    const leden = (beeld.body.groep && beeld.body.groep.leden) || [];
    assert.equal(leden.length, 2, 'er staan twee mensen in het lijstje: ' + JSON.stringify(leden));
    const waarden = leden.map(l => l.saldo);

    const som = waarden.reduce((s, v) => s + v, 0);
    assert.equal(som, 0, 'alles bij elkaar is nul -- er is geen geld verzonnen of verdwenen: ' +
      JSON.stringify(leden.map(l => l.codenaam + ': ' + l.saldo)));
    assert.ok(waarden.includes(2000) && waarden.includes(-2000),
      'Anna staat 20 euro in de plus en Bram 20 in de min: ' +
      JSON.stringify(leden.map(l => l.codenaam + ': ' + l.saldo)));

    /* En de codenamen staan erbij, niet de echte namen -- ook in een lijstje
       over geld tussen vrienden. */
    const alsTekst = JSON.stringify(leden);
    assert.ok(!/Anouschka|Bertram/i.test(alsTekst), 'het lijstje draagt codenamen: ' + alsTekst.slice(0, 200));

    /* ---- 3. VERREKENEN verplaatst echt geld. ---- */
    const aVoor = await saldo(P, anna.token);
    const bVoor = await saldo(P, bram.token);

    const verkeerdeKant = await P('/api/wbw/verreken', { id: gid }, anna.token);
    assert.notEqual(verkeerdeKant.status, 200,
      'wie in de plus staat heeft niets te verrekenen: ' + JSON.stringify(verkeerdeKant.body).slice(0, 160));

    const verrekend = await P('/api/wbw/verreken', { id: gid }, bram.token);
    assert.equal(verrekend.status, 200, 'Bram vereffent zijn schuld: ' + JSON.stringify(verrekend.body).slice(0, 200));

    assert.equal(await saldo(P, anna.token) - aVoor, 2000, 'Anna krijgt precies 20 euro');
    const bNa = await saldo(P, bram.token);
    assert.ok(bNa <= bVoor, 'en bij Bram is het eraf (' + bVoor + ' -> ' + bNa + ')');

    const na = await P('/api/wbw/groep', { id: gid }, anna.token);
    for (const l of ((na.body.groep && na.body.groep.leden) || [])) {
      assert.equal(l.saldo, 0, 'na het verrekenen staat iedereen op nul (' + l.codenaam + ': ' + l.saldo + ')');
    }
  } finally { child.kill('SIGKILL'); }
});

test('de kascode: een bedrag dat de zaak niet zelf mag ophogen', async () => {
  const { child, base } = await startServer({ env: { RTG_DATA_DIR: TMP, SMTP_URL: '' } });
  try {
    const P = post(base);
    const gast = await nieuwLid(P, 'Kasgast');
    await P('/api/pay/oplaad', { centen: 10000 }, gast.token);

    /* De kascode is de betaalcode uit de app: de gast bepaalt het MAXIMUM, de
       zaak int een bedrag daarbinnen. Dat maximum is de hele veiligheid van
       het ding -- kan de zaak er zelf overheen, dan is het geen plafond. */
    const code = await P('/api/pay/kascode', { maxCenten: 3000 }, gast.token);
    assert.equal(code.status, 200, 'de kascode is er: ' + JSON.stringify(code.body).slice(0, 200));
    const kas = code.body.code;
    assert.ok(kas, 'met een code');

    const r = await P('/api/supplier/roster', { code: 'KIKUNOI' });
    const man = (r.body.staff || []).find(s => s.role === 'manager');
    const lg = await P('/api/supplier/login', { code: 'KIKUNOI', staffId: man.id, pin: '1234' });
    const zaak = lg.body.token;

    const teVeel = await P('/api/supplier/pay/in', { code: kas, centen: 9000, oms: 'Te veel' }, zaak);
    assert.notEqual(teVeel.status, 200,
      'de zaak kan niet meer innen dan het plafond: ' + teVeel.status + ' ' + JSON.stringify(teVeel.body).slice(0, 160));

    const voor = await saldo(P, gast.token);
    const goed = await P('/api/supplier/pay/in', { code: kas, centen: 2500, oms: 'Diner' }, zaak);
    assert.equal(goed.status, 200, 'binnen het plafond gaat het wel: ' + JSON.stringify(goed.body).slice(0, 200));
    assert.equal(voor - await saldo(P, gast.token), 2500, 'en er gaat precies 25 euro af');
  } finally { child.kill('SIGKILL'); }
});

test('de wekker: onthoudt wat je zet, en verzint geen tijd', async () => {
  const { child, base } = await startServer({ env: { RTG_DATA_DIR: TMP, SMTP_URL: '' } });
  try {
    const P = post(base);
    const lid = await nieuwLid(P, 'Vroegop');

    const onzin = await P('/api/klok/wekker', { tijd: '25:99', aan: true }, lid.token);
    assert.notEqual(onzin.status, 200,
      'een tijd die niet bestaat wordt geweigerd: ' + onzin.status + ' ' + JSON.stringify(onzin.body).slice(0, 160));

    const gezet = await P('/api/klok/wekker', { tijd: '06:45', aan: true, label: 'Vlucht' }, lid.token);
    assert.equal(gezet.status, 200, 'de wekker staat: ' + JSON.stringify(gezet.body).slice(0, 200));
    assert.ok(gezet.body.id || gezet.body.ok, 'en krijgt een kenmerk: ' + JSON.stringify(gezet.body).slice(0, 160));

    /* Een timer is iets anders dan een wekker, en beide horen te bestaan
       zonder elkaar te overschrijven. */
    const teKort = await P('/api/klok/timer', { duurS: 2, label: 'Te kort' }, lid.token);
    assert.notEqual(teKort.status, 200, 'een timer van twee seconden wordt geweigerd');

    const timer = await P('/api/klok/timer', { duurS: 720, label: 'Eieren' }, lid.token);
    assert.equal(timer.status, 200, 'de timer loopt: ' + JSON.stringify(timer.body).slice(0, 200));
    assert.ok(timer.body.eindOp, 'met een eindtijd erbij');
    assert.ok(new Date(timer.body.eindOp) > new Date(), 'die in de toekomst ligt: ' + timer.body.eindOp);

    const bord = await P('/api/klok/mijn', {}, lid.token);
    assert.equal(bord.status, 200, 'het klokbord opent: ' + JSON.stringify(bord.body).slice(0, 200));
    const tekst = JSON.stringify(bord.body);
    assert.match(tekst, /06:45/, 'de wekker staat erop, op de opgegeven tijd: ' + tekst.slice(0, 240));
    assert.match(tekst, /Vlucht/, 'met zijn eigen etiket');
    assert.match(tekst, /Eieren/, 'en de timer staat er los naast, zonder de wekker te overschrijven');
  } finally {
    child.kill('SIGKILL');
    try { fs.rmSync(TMP, { recursive: true, force: true }); } catch (e) {}
  }
});
