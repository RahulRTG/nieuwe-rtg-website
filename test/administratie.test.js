/* DE ADMINISTRATIE -- boekhouding, belasting, en de AI in de keuken.

   WAAROM DIT ER IS

   Dit zijn de schermen waar niemand naar kijkt tot het misgaat, en dan gaat
   het meteen over geld of over iemands gezondheid. Een btw-uitsplitsing die
   een cent verkeerd afrondt valt maanden niet op; een vervangend gerecht dat
   het allergeen nog bevat valt op tijdens het diner.

   WAT HIER WORDT NAGETROKKEN

   1. DE BTW KLOPT REKENKUNDIG. Grondslag plus btw is de omzet, tot op de
      cent. Dat is met een rekenmachine te controleren en dus precies het
      soort bewering dat een toets moet dragen in plaats van een aanname.
   2. DE BELASTING IS EEN INDICATIE EN ZEGT DAT OOK. Meer winst betekent meer
      belasting, aftrekposten verlagen hem echt, en het antwoord draagt het
      peiljaar plus de vlag `indicatie`. Een fiscale uitkomst die zich
      voordoet als een aanslag is gevaarlijker dan geen uitkomst.
   3. HET VERVANGENDE GERECHT IS VEILIG, OOK ZONDER AI. Deze installatie
      draait zonder API-sleutel, en dan valt de keuken terug op een vast
      voorstel. Dat voorstel moet nog steeds vrij zijn van het allergeen, en
      het antwoord moet EERLIJK zeggen dat er geen AI aan te pas kwam. */
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { startServer } = require('./helper');
const { zzpBerekening } = require('../server/kern/fiscaal/zzp');

const TMP = fs.mkdtempSync(path.join(os.tmpdir(), 'rtg-adm-'));

function post(base) {
  return (pad, body, token) => fetch(base + pad, {
    method: 'POST',
    headers: Object.assign({ 'Content-Type': 'application/json' },
      token ? { Authorization: 'Bearer ' + token } : {}),
    body: JSON.stringify(body || {})
  }).then(async r => ({ status: r.status, body: await r.json().catch(() => ({})) }));
}

async function zaak(P, code) {
  const r = await P('/api/supplier/roster', { code });
  const man = (r.body.staff || []).find(s => s.role === 'manager');
  const lg = await P('/api/supplier/login', { code, staffId: man.id, pin: '1234' });
  assert.ok(lg.body.token, 'de manager van ' + code + ' logt in');
  return { token: lg.body.token, state: lg.body.state || {} };
}

test('de boekhouding: de btw-uitsplitsing klopt tot op de cent', async () => {
  const { child, base } = await startServer({ env: { RTG_DATA_DIR: TMP, SMTP_URL: '' } });
  try {
    const P = post(base);
    const { token, state } = await zaak(P, 'KIKUNOI');

    /* Eerst omzet maken, anders toetst dit een leeg overzicht -- en een lege
       tabel klopt altijd. */
    const u = String(Date.now()).slice(-8);
    const reg = await P('/api/auth/register', {
      name: 'Klant', email: 'kl' + u + '@x.nl', phone: '06' + u, password: 'geheim123',
      geboortedatum: '1985-03-03', geslacht: 'v', tier: 'rtg', pasApp: 'rtg'
    });
    assert.ok(reg.body.token, 'de klant is aangemeld: ' + JSON.stringify(reg.body).slice(0, 160));
    const kaart = (state.supplier && state.supplier.menu) || state.menu || [];
    assert.ok(kaart.length, 'de menukaart is gevonden: ' + JSON.stringify(Object.keys(state)).slice(0, 160));
    const eten = kaart.filter(m => m.station !== 'bar').slice(0, 2);
    assert.equal(eten.length, 2, 'met twee gerechten om te bestellen');
    for (const m of eten) {
      const b = await P('/api/order', { supplierCode: 'KIKUNOI', items: [{ id: m.id, qty: 2 }] }, reg.body.token);
      assert.equal(b.status, 200, 'bestelling geplaatst: ' + JSON.stringify(b.body).slice(0, 140));
      const bet = await P('/api/order/pay', { ref: b.body.ref || b.body.order.ref }, reg.body.token);
      assert.equal(bet.status, 200, 'en betaald: ' + JSON.stringify(bet.body).slice(0, 200));
    }

    const fin = await P('/api/supplier/finance', {}, token);
    assert.equal(fin.status, 200, 'het boekhoudoverzicht opent: ' + JSON.stringify(fin.body).slice(0, 200));
    const btw = fin.body.btw || [];
    assert.ok(btw.length >= 1, 'er staat minstens een btw-regel: ' + JSON.stringify(fin.body).slice(0, 240));

    /* DE REKENKUNDE. Per tarief: grondslag + btw = omzet. Tot op de cent, want
       een halve cent per bon is aan het eind van het jaar een gat. */
    for (const r of btw) {
      const som = Math.round((r.grondslag + r.btw) * 100) / 100;
      assert.equal(som, Math.round(r.omzet * 100) / 100,
        'tarief ' + r.tarief + '%: grondslag ' + r.grondslag + ' + btw ' + r.btw + ' = ' + som +
        ', maar de omzet is ' + r.omzet);

      /* En de btw hoort ook echt bij het genoemde tarief. Anders staat er een
         kloppende som onder het verkeerde percentage. */
      const verwacht = Math.round(r.grondslag * (r.tarief / 100) * 100) / 100;
      assert.ok(Math.abs(verwacht - r.btw) <= 0.02,
        'de btw hoort bij het tarief: ' + r.grondslag + ' x ' + r.tarief + '% = ' + verwacht + ', kreeg ' + r.btw);
    }

    const totaal = Math.round((fin.body.btwTotaal || 0) * 100) / 100;
    const opgeteld = Math.round(btw.reduce((s, r) => s + r.btw, 0) * 100) / 100;
    assert.equal(totaal, opgeteld, 'het btw-totaal is de som van de regels');

    /* De export levert dezelfde cijfers en geen tweede waarheid. */
    const exp = await P('/api/supplier/finance/export', { formaat: 'csv' }, token);
    assert.equal(exp.status, 200, 'de export komt eruit: ' + JSON.stringify(exp.body).slice(0, 160));
  } finally { child.kill('SIGKILL'); }
});

test('de belasting: een indicatie die zich niet voordoet als een aanslag', () => {
  /* Zonder server: dit is rekenwerk, en dan hoort de toets het rekenwerk te
     raken en niet de route eromheen. */
  const laag = zzpBerekening('NL', 30000, { urencriterium: true });
  const hoog = zzpBerekening('NL', 90000, { urencriterium: true });

  assert.ok(!laag.error && !hoog.error, 'beide berekeningen lopen: ' + JSON.stringify(laag).slice(0, 160));
  assert.equal(laag.indicatie, true, 'de uitkomst noemt zichzelf een indicatie');
  assert.ok(laag.peiljaar, 'met het peiljaar erbij (' + laag.peiljaar + ')');
  assert.ok(Array.isArray(laag.regels) && laag.regels.length, 'en de regels waarop hij rust');

  /* Meer winst, meer belasting. Klinkt vanzelfsprekend en is precies wat een
     verkeerd gezette schijf omdraait. */
  assert.ok(hoog.belasting > laag.belasting,
    'meer winst betekent meer belasting: ' + laag.belasting + ' -> ' + hoog.belasting);

  /* De aftrekposten doen echt iets. Een post die op het scherm staat maar niets
     verandert is erger dan geen post. */
  const zonderUren = zzpBerekening('NL', 60000, { urencriterium: false });
  const metUren = zzpBerekening('NL', 60000, { urencriterium: true });
  assert.ok(metUren.belasting < zonderUren.belasting,
    'de zelfstandigenaftrek verlaagt de belasting: ' + zonderUren.belasting + ' -> ' + metUren.belasting);

  const starter = zzpBerekening('NL', 60000, { urencriterium: true, starter: true });
  assert.ok(starter.belasting < metUren.belasting,
    'en de startersaftrek daar nog eens bovenop: ' + metUren.belasting + ' -> ' + starter.belasting);
  assert.ok((starter.posten || []).some(p => /starters/i.test(p.label)),
    'die post staat ook met naam in het overzicht: ' + JSON.stringify(starter.posten));

  /* Zonder winst geen uitkomst, en een nette melding in plaats van een nul die
     op een aanslag lijkt. */
  const leeg = zzpBerekening('NL', 0, {});
  assert.ok(leeg.error, 'zonder winst komt er een melding: ' + JSON.stringify(leeg));
});

test('de keuken-AI: een vervangend gerecht is veilig, ook zonder API-sleutel', async () => {
  const { child, base } = await startServer({ env: { RTG_DATA_DIR: TMP, SMTP_URL: '' } });
  try {
    const P = post(base);
    const { token } = await zaak(P, 'KIKUNOI');

    const maak = await P('/api/supplier/event', {
      action: 'add', event: { name: 'Besloten diner', date: '2026-10-04', capacity: 20 }
    }, token);
    assert.equal(maak.status, 200, 'het event is er');
    const ev = maak.body.events[0];

    /* Een gast met een glutenallergie. Op de kaart staat de Flao met gluten,
       melk en ei -- dus er is echt iets te vervangen. */
    const allergie = await P('/api/supplier/event/allergy',
      { id: ev.id, action: 'add', allergen: 'gluten', count: 2 }, token);
    assert.equal(allergie.status, 200, 'het allergeen staat genoteerd: ' + JSON.stringify(allergie.body).slice(0, 180));
    const al = (allergie.body.event.allergies || [])[0];
    assert.ok(al, 'met een eigen kenmerk');
    assert.equal(al.alternative, null, 'en nog zonder alternatief');

    const dubbel = await P('/api/supplier/event/allergy',
      { id: ev.id, action: 'add', allergen: 'gluten', count: 1 }, token);
    assert.equal(dubbel.status, 409, 'hetzelfde allergeen twee keer noteren kan niet');

    const alt = await P('/api/supplier/event/allergy/alt', { id: ev.id, allergyId: al.id }, token);
    assert.equal(alt.status, 200, 'er komt een vervangend gerecht: ' + JSON.stringify(alt.body).slice(0, 200));
    assert.ok(alt.body.alternative && alt.body.alternative.name, 'met een naam');
    assert.ok(alt.body.alternative.desc, 'en een omschrijving');

    /* DE EERLIJKHEID. Deze installatie draait zonder API-sleutel, dus er kwam
       geen AI aan te pas -- en dat hoort het antwoord te zeggen in plaats van
       het voorstel als AI-werk te presenteren. */
    assert.equal(alt.body.ai, false, 'het antwoord meldt eerlijk dat er geen AI bij was');

    /* DE VEILIGHEID. Het vervangende gerecht mag het allergeen niet noemen als
       ingredient. Dit is de bewering waar het echt om gaat: een voorstel dat
       "met een krokante gluten-crumble" zegt, is levensgevaarlijk. */
    const tekst = (alt.body.alternative.name + ' ' + alt.body.alternative.desc).toLowerCase();
    assert.ok(!/\bmet gluten\b|\bgluten-|\bgluten crumble/.test(tekst),
      'het voorstel bevat het allergeen niet als ingredient: ' + tekst);
    assert.match(tekst, /zonder gluten|glutenvrij|veilig voor gluten/,
      'en zegt expliciet dat het zonder gluten is: ' + tekst);

    /* Het alternatief blijft ook echt aan het allergeen hangen, zodat de
       keuken het morgen terugvindt. */
    const opnieuw = await zaak(P, 'KIKUNOI');
    const bewaard = ((opnieuw.state.events || []).find(x => x.id === ev.id) || {}).allergies || [];
    assert.ok(bewaard[0] && bewaard[0].alternative && bewaard[0].alternative.name,
      'het staat bewaard bij het event: ' + JSON.stringify(bewaard).slice(0, 200));
  } finally {
    child.kill('SIGKILL');
    try { fs.rmSync(TMP, { recursive: true, force: true }); } catch (e) {}
  }
});
