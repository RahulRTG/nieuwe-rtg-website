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
    name: naam, email: naam.toLowerCase() + u + '@x.nl', phone: '06' + u.slice(0, 8),
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

    /* 3. Registreren is gratis en sluit geen betaalde overeenkomst. Een
       contributiefactuur ontstaat pas uit een getekend abonnement, nooit uit
       het aangevraagde clienttier of alleen het bestaan van een account. */
    assert.equal(st.user.tier, 'guest', 'een aangevraagd RTG-clienttier kent geen betaalde pas toe');
    assert.equal(st.invoices.length, 0, 'zonder getekend contract is er ook geen contributiefactuur');
    for (const id of ['RTG-2026-0158', 'RTG-2026-0141', 'RTG-2026-0093', 'RTG-2026-0207'])
      assert.ok(!st.invoices.some(i => i.id === id), 'geen geërfde demo-factuur ' + id);

    /* 4. de partnerlijst gaf de bestemming van de DEMO-reis terug ("RTG-partners
       in Ibiza"), voor iedereen. Zonder eigen reis hoort daar geen stad te staan. */
    const lev = await P('/api/suppliers', {}, bij.token);
    assert.equal(lev.status, 200, 'de partnerlijst opent gewoon');
    assert.ok(!lev.body.city, 'zonder eigen reis komt er geen bestemming terug, kreeg: ' + lev.body.city);

    /* 5. Betaalde Rahul-AI ontstaat evenmin uit registratie. De gratis laag
       weigert de dienst en mag daarbij ook geen demo-reis als antwoord lekken. */
    const vragen = ['Wat moet ik inpakken?', 'Heb ik een visum nodig?', 'Wat voor weer wordt het?',
      'Maak een dagplan', 'Welk restaurant raad je aan?', 'Ja, regel het maar.'];
    for (const v of vragen) {
      const a = await P('/api/ai', { messages: [{ role: 'user', content: v }] }, bij.token);
      const tekst = String(a.body.reply || '');
      assert.equal(a.status, 403, 'gratis registratie opent geen betaalde AI op "' + v + '"');
      assert.equal(tekst, '', 'een weigering verzint geen inhoud');
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
  assert.match(thuis, /reisbureau\.html/, 'met een knop naar de plek waar een reis ontstaat');

  const reizen = lees('app-main-45.js');
  assert.match(reizen, /if \(!trip\)\{/, 'het reisscherm vangt de lege stand af');
  assert.match(reizen, /Beginnen doe je bij het reisbureau/,
    'en zegt waar je begint: op de plek waar een reis echt ontstaat');

  const start = lees('app-main-01.js');
  assert.match(start, /let trip = null;/, 'de app begint zonder reis');
  assert.match(start, /let invoices = \[\];/, 'en zonder facturen');
  assert.doesNotMatch(start, /Ibiza/,
    'en draagt geen demo-inhoud meer die als eigen gegevens doorgaat');

  // de training bestaat nog, maar uitsluitend in Magnaats losse gegevensbestand
  const scheiding = lees('app-main-01b.js');
  assert.match(scheiding, /magnaat-data\.js/, 'de app verwijst voor trainingsinhoud naar Magnaats losse bestand');
  assert.doesNotMatch(scheiding, /Ibiza|TEST-0158/, 'de echte app-bundel draagt zelf geen trainingsdossiers');
  assert.match(lees('app-main-03.js'), /function laadMagnaatData\(/,
    'die alleen in de afgeschermde Magnaat-kopie geladen wordt');
});

/* Een gratis account mag het aanbod bekijken, maar het aangevraagde clienttier
   is geen abonnement. De betaalde mutatie blijft dicht en schrijft ook geen
   half reisdossier. De volledige betaalde reis- en kantoorflow wordt in
   reisaanbod.test.js en reisbureau.test.js met een echte betaalde actor gedekt. */
test('een gratis account kan reisaanbod bekijken maar geen betaalde reis aanvragen', async () => {
  const { child, base } = await startServer({ env: { SMTP_URL: '' } });
  try {
    const P = post(base);
    const bij = await nieuwLid(P, 'Fabienne');
    const staat = async () => (await P('/api/state', {}, bij.token)).body.state;
    assert.equal((await staat()).trip, undefined, 'hij begint zonder reis');
    const aanbod = await P('/api/reisbureau', {}, bij.token);
    assert.equal(aanbod.status, 200, 'het reisbureau opent');
    const reis = (aanbod.body.reizen || [])[0];
    assert.ok(reis && reis.id, 'er staat een reis klaar om aan te vragen');
    const vertrek = new Date(Date.now() + 40 * 86400000).toISOString().slice(0, 10);
    const gevraagd = await P('/api/reisbureau/boek', { tripId: reis.id, personen: 2, vertrek }, bij.token);
    assert.equal(gevraagd.status, 403, JSON.stringify(gevraagd.body).slice(0, 160));
    assert.match(String(gevraagd.body.error || ''), /Alleen voor leden/);
    assert.equal((await staat()).trip, undefined, 'de weigering laat geen half reisdossier achter');
  } finally { child.kill('SIGKILL'); }
});

test('een gratis account kan partners zien en navigeren zonder betaalde pas', async () => {
  const { child, base } = await startServer({ env: { SMTP_URL: '' } });
  try {
    const P = post(base);
    const bij = await nieuwLid(P, 'Gijs');
    const gids = await P('/api/suppliers', {}, bij.token);
    assert.equal(gids.status, 200, JSON.stringify(gids.body).slice(0, 160));
    const zaak = (gids.body.suppliers || []).find(x => x && x.code);
    assert.ok(zaak, 'de gratis gids bevat ten minste één zichtbare partner');
    const start = await P('/api/live/start', { destCode: zaak.code }, bij.token);
    assert.equal(start.status, 200, JSON.stringify(start.body).slice(0, 160));
    assert.equal(start.body.live.active, true, 'navigatie is basisfunctionaliteit, geen betaalde dienst');
  } finally { child.kill('SIGKILL'); }
});
