/* EEN NIEUW LID BEGINT LEEG.

   Wie zich echt aanmeldde kreeg de DEMO-inhoud als zijn eigen persoonlijke
   gegevens: memberTemplate() kopieerde db.data.invoices en db.data.trip naar
   het verse account, de client droeg dezelfde reis als beginwaarde, en de
   system prompt van Rahul las db.data.trip. Gevolg: een reis naar Ibiza die
   niemand had geboekt, vier facturen op zijn naam, en een AI die er
   overtuigd over doorpraatte. Dat is precies de leugen die CLAUDE.md verbiedt
   (nooit claimen dat een boeking verwerkt is).

   Deze toets kijkt naar wat een NIEUW ACCOUNT werkelijk terugkrijgt, en niet
   naar de bron: dat is het verschil dat het hem doet (zie LAT.md regel 9 en de
   uitleg boven test/rahul-eerlijk.test.js). Zakt hij, dan lekt de demo weer
   door naar een echt mens. */
const test = require('node:test');
const assert = require('node:assert/strict');
const { startServer } = require('./helper');

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
    name: naam, email: naam.toLowerCase() + u + '@x.nl',
    password: 'geheim123', geboortedatum: '1990-01-01', tier: 'rtg', pasApp: 'rtg'
  });
  assert.ok(r.body.token, 'lid ' + naam + ' aangemeld: ' + JSON.stringify(r.body).slice(0, 140));
  return r.body;
}

test('een vers account krijgt geen reis en geen facturen van de demo', async () => {
  const { child, base } = await startServer({ env: { SMTP_URL: '' } });
  try {
    const P = post(base);
    const bij = await nieuwLid(P, 'Elske');

    // 1. de staat die de registratie zelf teruggeeft
    assert.equal(bij.state.trip, undefined, 'geen reis in de registratie-staat: ' + JSON.stringify(bij.state.trip));

    // 2. en de staat die de app daarna ophaalt (een tweede weg naar hetzelfde)
    const st = (await P('/api/state', {}, bij.token)).body.state;
    assert.equal(st.trip, undefined, 'ook /api/state geeft geen reis mee');
    assert.equal(st.creatorCredit, 0, 'geen geërfde creator-tegoeden');
    assert.equal(st.creatorLikes, 0, 'geen geërfde likes');

    /* 3. De facturen. Wat een nieuw lid WEL heeft is zijn eigen maandbijdrage --
       bij een pas hoort een bijdrage, dat is geen demo maar de afspraak. Wat hij
       niet heeft zijn de vier facturen uit de seed (een hotel op Ibiza, een villa
       in Cala Jondal, een gedeelde privéjet) die op zijn naam stonden. */
    assert.equal(st.invoices.length, 1, 'precies één factuur: de eigen bijdrage, kreeg: ' +
      JSON.stringify(st.invoices.map(i => i.desc)));
    const bijdrage = st.invoices[0];
    assert.match(bijdrage.desc, /maandbijdrage/i, 'en dat is de maandbijdrage: ' + bijdrage.desc);
    assert.equal(bijdrage.status, 'open', 'die staat open');
    assert.ok(bijdrage.bijdrage > 0, 'met een echt bedrag uit de boardroom, kreeg: ' + bijdrage.bijdrage);
    const nu = new Date();
    const maandNu = ['januari','februari','maart','april','mei','juni','juli','augustus',
      'september','oktober','november','december'][nu.getMonth()] + ' ' + nu.getFullYear();
    assert.ok(bijdrage.desc.includes(maandNu),
      'op de maand van vandaag (' + maandNu + ') en niet die van de seed: ' + bijdrage.desc);
    for (const id of ['RTG-2026-0158', 'RTG-2026-0141', 'RTG-2026-0093', 'RTG-2026-0207'])
      assert.ok(!st.invoices.some(i => i.id === id), 'geen geërfde demo-factuur ' + id);

    /* 4. de partnerlijst gaf de bestemming van de DEMO-reis terug ("RTG-partners
       in Ibiza"), voor iedereen. Zonder eigen reis hoort daar geen stad te staan. */
    const lev = await P('/api/suppliers', {}, bij.token);
    assert.equal(lev.status, 200, 'de partnerlijst opent gewoon');
    assert.ok(!lev.body.city, 'zonder eigen reis komt er geen bestemming terug, kreeg: ' + lev.body.city);

    /* 5. en Rahul zelf. Zonder API-sleutel -- deze suite -- gaan de vaste
       antwoorden uit, en die waren woordelijk voor de demo-reis geschreven. */
    const vragen = ['Wat moet ik inpakken?', 'Heb ik een visum nodig?', 'Wat voor weer wordt het?',
      'Maak een dagplan', 'Welk restaurant raad je aan?', 'Ja, regel het maar.'];
    for (const v of vragen) {
      const a = await P('/api/ai', { messages: [{ role: 'user', content: v }] }, bij.token);
      const tekst = String(a.body.reply || '');
      assert.ok(tekst.length > 20, 'er komt een echt antwoord op "' + v + '", kreeg: ' + tekst);
      assert.doesNotMatch(tekst, /Ibiza|Formentera|Sal de Mar|Cala Jondal|Aguamarina/i,
        'Rahul noemt de demo-reis tegen een lid dat nergens heen gaat, op "' + v + '": ' + tekst.slice(0, 160));
    }
  } finally { child.kill('SIGKILL'); }
});

/* De tegenproef: leeg beginnen mag geen leeg SCHERM opleveren. De app hoort in
   die stand te vertellen wat er komt te staan en hoe je het in gang zet --
   anders is "geen demo meer" gewoon een kaal vak. De teksten staan in de
   app-delen; deze toets bewaakt dat ze er staan en aan de reis hangen. */
test('de lege stand legt uit wat er komt te staan', () => {
  const fs = require('node:fs');
  const path = require('node:path');
  const lees = (p) => fs.readFileSync(path.join(__dirname, '..', 'public', 'apps', 'app-main', p), 'utf8');

  const thuis = lees('app-main-42.js');
  assert.match(thuis, /Util\.vervang\(\$\('#homeTrip'\), trip/,
    'de reistegel op het beginscherm kent het verschil tussen wel en geen reis');
  assert.match(thuis, /app\.notrip/, 'en heeft een eigen tekst voor "nog niets gepland"');

  const reizen = lees('app-main-45.js');
  assert.match(reizen, /if \(!trip\)\{/, 'het reisscherm vangt de lege stand af');
  assert.match(reizen, /app\.trip\.e3/, 'en zegt waar je begint (bij Rahul)');

  const start = lees('app-main-01.js');
  assert.match(start, /let trip = null;/, 'de app begint zonder reis');
  assert.match(start, /let invoices = \[\];/, 'en zonder facturen');
  assert.match(start, /const DEMO_DATA = \{/, 'de demo-inhoud bestaat nog, maar apart');
  const naStart = start.slice(start.indexOf('let user = null;'));
  assert.doesNotMatch(naStart, /Ibiza/,
    'na de beginwaarden staat er geen demo-inhoud meer die als eigen gegevens doorgaat');
});
