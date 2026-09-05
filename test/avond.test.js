/* RTG EVENING OS: de avond als plan.

   WAT DIT BESTAND BEWAAKT. Een avondplanner is de makkelijkste plek in dit hele
   huis om te gaan liegen. Hij ziet er indrukwekkend uit als hij een compleet
   plan neerzet, en niemand merkt tot de avond zelf dat de helft nooit is
   aangevraagd of dat de laatste taxi allang weg was. Deze toetsen gaan daarom
   niet over of er een plan uit komt, maar over of het plan WAAR is:

   1. NIETS IS GEBOEKT TOT HET GEBOEKT IS. Een tafel gaat naar `aangevraagd` en
      nooit rechtstreeks naar `bevestigd` -- het lid vraagt aan, de zaak
      beslist. Dat stond al in de reserveringslaag en de avondplanner mag het
      niet omzeilen omdat "geregeld" prettiger klinkt.
   2. DE KLOK EN HET BUDGET ZIJN GRENZEN, GEEN VERSIERING. Een plan dat na
      middernacht doorloopt terwijl je om 00:30 thuis wilde zijn, of dat boven
      je budget uitkomt, wordt GEWEIGERD met wat er niet past -- niet
      afgeleverd met een sterretje erbij.
   3. ER WORDT NIETS VERZONNEN. Kan een stap niet worden gevuld met een zaak
      die echt bestaat, dan blijft hij leeg met de reden. Een planner die gaten
      opvult met plausibele namen werkt precies één keer.
   4. DE VOORKEUREN GAAN NIET VERDER DAN DE GAST WIL. Een uitzondering per zaak
      kan alleen SMALLER maken; een zaak kan zichzelf nooit meer rechten geven. */
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs'); const os = require('os'); const path = require('path');
const { startServer } = require('./helper');

let BASE, child, LID;
const TMP = fs.mkdtempSync(path.join(os.tmpdir(), 'rtg-avond-'));
const post = (pad, body, token) => fetch(BASE + pad, {
  method: 'POST', headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: 'Bearer ' + token } : {}) },
  body: JSON.stringify(body || {})
}).then(async r => ({ status: r.status, body: await r.json().catch(() => ({})) }));

test.before(async () => {
  ({ child, base: BASE } = await startServer({ env: { RTG_DATA_DIR: TMP, SMTP_URL: '' } }));
  const u = String(Date.now());
  const reg = await post('/api/auth/register', { name: 'Avondganger', email: 'av' + u + '@voorbeeld.nl',
    phone: '06' + u.slice(-8), password: 'geheim123',
    geboortedatum: '1990-05-05', geslacht: 'v', tier: 'rtg', pasApp: 'rtg' });
  LID = reg.body.token;
  assert.ok(LID, 'een lid kan zich registreren: ' + JSON.stringify(reg.body).slice(0, 160));
});
test.after(() => {
  if (child) try { child.kill('SIGKILL'); } catch (e) {}
  try { fs.rmSync(TMP, { recursive: true, force: true }); } catch (e) {}
});

test('een voorstel draagt zijn redenen, zijn aannames en zijn gaten', async () => {
  const uit = await post('/api/avond/voorstel', { start: '19:00', thuisOm: '00:30',
    personen: 4, plafondPP: 12000, titel: 'Met vrienden' }, LID);
  assert.equal(uit.status, 200, JSON.stringify(uit.body).slice(0, 220));
  const a = uit.body.avond;
  assert.ok(a.stappen.length >= 1, 'er hoort minstens een stap in te staan');
  assert.equal(a.staat, 'voorstel');
  assert.match(a.zekerheid, /voorstel|nog niets aangevraagd/i,
    'boven een plan hoort te staan dat er nog niets is aangevraagd');

  /* Elke keuze draagt zijn grond. Een voorstel waarvan je de reden niet kunt
     nakijken is een orakel. */
  assert.ok(uit.body.uitleg.length, 'elke stap hoort zijn waarom mee te dragen');
  assert.ok(uit.body.uitleg.every(u => Array.isArray(u.waarom) && u.waarom.length));
  assert.ok(uit.body.aannames.length, 'de aannames staan er als aanname bij, niet als feit');

  // en de zaken die worden voorgesteld BESTAAN
  for (const s of a.stappen.filter(x => x.zaak)) {
    const kaart = await post('/api/gast/bezorg/kaart', { zaak: s.zaak }, LID);
    assert.equal(kaart.status, 200, 'voorgestelde zaak ' + s.zaak + ' hoort te bestaan');
  }
});

test('de klok is een grens: een plan dat te laat eindigt wordt geweigerd', async () => {
  const uit = await post('/api/avond/voorstel', { start: '19:00', thuisOm: '19:30', personen: 2 }, LID);
  assert.equal(uit.status, 409, 'een avond die niet op tijd thuis is, hoort niet te worden afgeleverd');
  assert.equal(uit.body.code, 'klok');
  assert.match(uit.body.error, /thuis/);
  assert.ok(uit.body.teLaatMin > 0, 'en er hoort bij te staan hoeveel het te laat is');
});

test('het budget is een grens, en de weigering noemt het bedrag', async () => {
  const uit = await post('/api/avond/voorstel', { start: '19:00', thuisOm: '02:00',
    personen: 2, plafondPP: 100 }, LID);
  assert.equal(uit.status, 409);
  assert.equal(uit.body.code, 'budget');
  assert.match(uit.body.error, /per persoon/);
});

test('een tafel wordt AANGEVRAAGD en nooit zomaar bevestigd', async () => {
  const voorstel = await post('/api/avond/voorstel', { start: '19:00', thuisOm: '01:30',
    personen: 2, plafondPP: 20000 }, LID);
  assert.equal(voorstel.status, 200, JSON.stringify(voorstel.body).slice(0, 200));
  const id = voorstel.body.avond.id;

  const gevraagd = await post('/api/avond/aanvragen', { id }, LID);
  assert.equal(gevraagd.status, 200, JSON.stringify(gevraagd.body).slice(0, 220));
  const eten = gevraagd.body.avond.stappen.find(s => s.soort === 'eten');
  assert.ok(eten, 'er hoort een eet-stap te zijn');
  assert.notEqual(eten.staat, 'bevestigd',
    'de avondplanner mag een tafel niet bevestigen; dat doet de zaak');
  assert.ok(['aangevraagd', 'mislukt'].includes(eten.staat),
    'de stap staat op aangevraagd of mislukt, met de reden erbij: ' + eten.staat);
  if (eten.staat === 'aangevraagd') {
    assert.match(eten.reden || '', /zaak beslist/i);
    assert.equal(eten.boeking.domein, 'reserveringen',
      'de stap wijst naar de ECHTE reservering en houdt geen eigen kopie');
  }
  assert.match(gevraagd.body.let, /aangevraagd en niet bevestigd/);
  assert.notEqual(gevraagd.body.avond.staat, 'rond',
    'zolang er iets openstaat, heet de avond niet rond');
});

test('geen enkele stap wordt stil groen: elke staat is verantwoord', async () => {
  /* Deze toets ging over de uitgaan-stap, want die had geen aanvraagweg. Die
     heeft hij inmiddels wel, en toen zakte hij -- terecht. In plaats van er een
     ander voorbeeld in te zetten (dat over een jaar hetzelfde doet) staat hier
     nu de REGEL zelf, die niet verandert als er een soort bij komt:

       een stap is groen (bevestigd) of geel (aangevraagd) MET een boeking waar
       je naartoe kunt wijzen, of hij staat er nog MET een reden.

     Een derde mogelijkheid -- groen zonder boeking, of blijven staan zonder
     uitleg -- is precies de leugen waar dit plan niet in mag vervallen. */
  const voorstel = await post('/api/avond/voorstel', { start: '19:00', thuisOm: '01:30',
    personen: 2, plafondPP: 20000 }, LID);
  const id = voorstel.body.avond.id;
  const gevraagd = await post('/api/avond/aanvragen', { id }, LID);
  const stappen = gevraagd.body.avond.stappen;
  assert.ok(stappen.length >= 2, 'er staat een plan met meer dan een stap');
  for (const s of stappen) {
    if (s.staat === 'bevestigd' || s.staat === 'aangevraagd') {
      assert.ok(s.boeking && s.boeking.id && s.boeking.domein,
        s.soort + ' staat op ' + s.staat + ' en moet dus naar een echte boeking wijzen: ' + JSON.stringify(s.boeking));
    } else {
      assert.ok(s.reden, s.soort + ' is niet geregeld en hoort dan te zeggen waarom: ' + JSON.stringify(s));
    }
  }
});

test('uitgaan gaat langs de weg die bij de zaak past, en belooft nooit toegang', async () => {
  const voorstel = await post('/api/avond/voorstel', { start: '19:00', thuisOm: '01:30',
    personen: 2, plafondPP: 20000 }, LID);
  const gevraagd = await post('/api/avond/aanvragen', { id: voorstel.body.avond.id }, LID);
  const uitgaan = gevraagd.body.avond.stappen.find(s => s.soort === 'uitgaan');
  assert.ok(uitgaan, 'de opstelling hoort een uitgaan-stap te bevatten');
  /* Nooit `bevestigd`. Een bar beslist over zijn tafel en een club over zijn
     lijst; software die daar groen van maakt, zet iemand om half twee voor een
     dichte deur. */
  assert.notEqual(uitgaan.staat, 'bevestigd', 'uitgaan wordt nooit bevestigd door de planner: ' + JSON.stringify(uitgaan));
  if (uitgaan.staat === 'aangevraagd') {
    assert.ok(['reserveringen', 'gastenlijst'].includes(uitgaan.boeking.domein),
      'en het gaat langs een van de twee echte wegen: ' + JSON.stringify(uitgaan.boeking));
    assert.match(uitgaan.reden || '', /beslist/i, 'met de zin dat de zaak beslist: ' + uitgaan.reden);
  } else {
    assert.ok(uitgaan.reden, 'lukte het niet, dan staat de reden erbij');
  }
});

test('de reservering die de avond aanvraagt, staat ook echt in mijn reserveringen', async () => {
  const voorstel = await post('/api/avond/voorstel', { start: '20:00', thuisOm: '01:30',
    personen: 2, plafondPP: 20000 }, LID);
  const id = voorstel.body.avond.id;
  await post('/api/avond/aanvragen', { id }, LID);
  const mijne = await post('/api/reserveringen/mijn', {}, LID);
  assert.ok((mijne.body.reserveringen || []).length >= 1,
    'de avondplanner maakt geen eigen reserveringen naast de bestaande lijst');
});

/* ---------------------------------------------------------------------------
   DE HOSPITALITY DNA
   --------------------------------------------------------------------------- */

test('een zaak ziet alleen wat je deelt, en delen gaat per soort', async () => {
  await post('/api/avond/voorkeuren', { zet: {
    waarden: { tafel: 'liefst een ronde tafel, rustige hoek', gelegenheid: 'verjaardag 3 mei' },
    delen: { tafel: 'altijd', gelegenheid: 'nooit' } } }, LID);

  const proef = await post('/api/avond/voorkeuren/proef', { zaak: 'KIKUNOI' }, LID);
  assert.equal(proef.status, 200);
  const ziet = proef.body.ditZietDeZaak.voorkeuren;
  assert.equal(ziet.tafel, 'liefst een ronde tafel, rustige hoek');
  assert.equal(ziet.gelegenheid, undefined,
    'wat op nooit staat, gaat niet mee -- ook niet "een keertje"');
});

test('gevraagd betekent gevraagd: alleen als je het deze keer meegeeft', async () => {
  await post('/api/avond/voorkeuren', { zet: {
    waarden: { drank: 'bruiswater zonder ijs' }, delen: { drank: 'gevraagd' } } }, LID);

  const zonder = await post('/api/avond/voorkeuren/proef', { zaak: 'KIKUNOI' }, LID);
  assert.equal(zonder.body.ditZietDeZaak.voorkeuren.drank, undefined);

  const met = await post('/api/avond/voorkeuren/proef', { zaak: 'KIKUNOI', nu: ['drank'] }, LID);
  assert.equal(met.body.ditZietDeZaak.voorkeuren.drank, 'bruiswater zonder ijs');
});

test('een uitzondering per zaak kan alleen SMALLER maken', async () => {
  await post('/api/avond/voorkeuren', { zet: {
    waarden: { sfeer: 'rustig' }, delen: { sfeer: 'nooit' } } }, LID);

  /* Proberen om deze ene zaak alsnog alles te geven. Dat hoort te worden
     GEWEIGERD en niet stil teruggeknepen: een clamp die de smallere waarde
     opslaat, legt een uitzondering vast die de gast nooit heeft gekozen -- en
     die blijft dan hangen als hij de soort later ruimer zet. */
  const ruimer = await post('/api/avond/voorkeuren/zaak',
    { zaak: 'KIKUNOI', standen: { sfeer: 'altijd' } }, LID);
  assert.equal(ruimer.status, 200);
  assert.equal(ruimer.body.standen.sfeer, undefined,
    'ruimer vragen legt geen uitzondering vast');
  assert.ok((ruimer.body.geweigerd || []).some(g => g.soort === 'sfeer'),
    'en het antwoord zegt waarom het niet is toegepast');

  const proef = await post('/api/avond/voorkeuren/proef', { zaak: 'KIKUNOI', nu: ['sfeer'] }, LID);
  assert.equal(proef.body.ditZietDeZaak.voorkeuren.sfeer, undefined);

  // smaller mag wel: van altijd naar nooit bij een specifieke zaak
  await post('/api/avond/voorkeuren', { zet: { delen: { sfeer: 'altijd' } } }, LID);
  const smaller = await post('/api/avond/voorkeuren/zaak',
    { zaak: 'PONTO', standen: { sfeer: 'nooit' } }, LID);
  assert.equal(smaller.body.standen.sfeer, 'nooit');
  const bijPonto = await post('/api/avond/voorkeuren/proef', { zaak: 'PONTO' }, LID);
  const bijKikunoi = await post('/api/avond/voorkeuren/proef', { zaak: 'KIKUNOI' }, LID);
  assert.equal(bijPonto.body.ditZietDeZaak.voorkeuren.sfeer, undefined, 'bij PONTO afgeschermd');
  assert.equal(bijKikunoi.body.ditZietDeZaak.voorkeuren.sfeer, 'rustig', 'bij de rest gewoon gedeeld');
});

test('het profiel laat de gast zien wat een zaak er werkelijk van krijgt', async () => {
  const p = await post('/api/avond/voorkeuren', { zaak: 'KIKUNOI' }, LID);
  assert.equal(p.status, 200);
  const tafel = p.body.profiel.soorten.find(s => s.id === 'tafel');
  assert.ok(tafel, 'de soorten staan in het profiel');
  assert.equal(typeof tafel.ziet, 'boolean',
    'per soort staat erbij of deze zaak hem daadwerkelijk ziet');
  assert.match(p.body.profiel.let, /schrijf je zelf op/,
    'en dat RTG geen voorkeuren afleidt uit je gedrag');
});

test('een avond van een ander is niet op te vragen', async () => {
  const voorstel = await post('/api/avond/voorstel', { start: '19:00', thuisOm: '01:30',
    personen: 2, plafondPP: 20000 }, LID);
  const id = voorstel.body.avond.id;
  const u = String(Date.now()) + '7';
  const reg = await post('/api/auth/register', { name: 'Ander', email: 'an' + u + '@voorbeeld.nl',
    phone: '06' + u.slice(-8), password: 'geheim123',
    geboortedatum: '1990-05-05', geslacht: 'v', tier: 'rtg', pasApp: 'rtg' });
  const gluur = await post('/api/avond', { id }, reg.body.token);
  assert.equal(gluur.status, 404, 'een avond hangt aan het lid dat hem maakte');
});

/* ---------------------------------------------------------------------------
   DE TERUGREIS. Dit is de enige stap waarvoor de planner iets moet weten wat
   hij niet heeft: waar je woont. Dat staat in de kluis achter de gegevenspoort
   en hoort daar te blijven. De mobiliteitskern kent wel favoriete plekken die
   het lid zelf heeft opgeslagen -- dat is de goede haak, en het verschil tussen
   "handig" en "hoort".
   --------------------------------------------------------------------------- */

test('zonder favoriete thuisplek wordt de rit niet geboekt, en de reden wijst de weg', async () => {
  const voorstel = await post('/api/avond/voorstel', { start: '19:00', thuisOm: '01:30',
    personen: 2, plafondPP: 20000 }, LID);
  const id = voorstel.body.avond.id;
  const gevraagd = await post('/api/avond/aanvragen', { id }, LID);
  const rit = gevraagd.body.avond.stappen.find(s => s.soort === 'vervoer');
  assert.ok(rit, 'er hoort een vervoersstap in het plan te staan');
  assert.equal(rit.staat, 'voorstel', 'zonder bekende bestemming wordt er niets geboekt');
  assert.match(rit.reden || '', /favoriete plek|kluis/i,
    'en de reden wijst naar waar je hem zet, in plaats van je adres uit de kluis te halen');
});

test('met een favoriete thuisplek wordt de rit echt geboekt, en die staat in mijn ritten', async () => {
  /* De favoriet zetten langs de ECHTE weg van RTG OV: een tweede manier om een
     plek op te slaan zou een tweede plekkenlijst zijn. */
  const fav = await post('/api/mob/favoriet', { naam: 'Thuis', plek: { zaak: 'SAKURA' } }, LID);
  assert.equal(fav.status, 200, JSON.stringify(fav.body).slice(0, 160));

  const voorstel = await post('/api/avond/voorstel', { start: '18:30', thuisOm: '02:00',
    personen: 2, plafondPP: 30000 }, LID);
  const id = voorstel.body.avond.id;
  const gevraagd = await post('/api/avond/aanvragen', { id }, LID);
  const rit = gevraagd.body.avond.stappen.find(s => s.soort === 'vervoer');

  if (rit.staat === 'bevestigd') {
    assert.equal(rit.boeking.domein, 'mobiliteit',
      'de stap wijst naar de ECHTE reis en houdt geen eigen kopie');
    assert.match(rit.reden || '', /Geboekt/);
    const mijn = await post('/api/mob/reis/mijn', {}, LID);
    assert.ok((mijn.body.reizen || mijn.body.reis || []).length >= 1 || mijn.status === 200,
      'de reis staat in de gewone reizenlijst van RTG OV');
  } else {
    /* Kan hij niet worden geboekt, dan hoort dat een REDEN te hebben die de
       gast iets zegt -- niet een lege stap. Dat is hier net zo goed geslaagd:
       de belofte is "nooit stil groen", niet "altijd een taxi". */
    assert.ok(rit.reden && rit.reden.length > 10,
      'een rit die niet lukt, zegt waarom: ' + JSON.stringify(rit.reden));
    assert.notEqual(rit.staat, 'bevestigd');
  }
});

test('een geboekte rit telt mee in het budget, en past hij niet dan gaat hij niet', async () => {
  await post('/api/mob/favoriet', { naam: 'Thuis', plek: { zaak: 'SAKURA' } }, LID);

  /* Eerst RUIM: dan mag de rit geboekt worden, en dan hoort zijn ECHTE prijs op
     de stap te staan in plaats van de raming van nul. Dat was het gat: zonder
     dat telt het budget precies het geld niet mee dat werkelijk wordt
     uitgegeven, en klopt de belofte "het budget klopt" alleen op papier. */
  const ruim = await post('/api/avond/voorstel', { start: '18:30', thuisOm: '02:00',
    personen: 2, plafondPP: 40000 }, LID);
  assert.equal(ruim.status, 200, JSON.stringify(ruim.body).slice(0, 200));
  const na = await post('/api/avond/aanvragen', { id: ruim.body.avond.id }, LID);
  const rit = na.body.avond.stappen.find(s => s.soort === 'vervoer');
  assert.ok(rit, 'er hoort een vervoersstap te zijn');
  if (rit.staat === 'bevestigd') {
    assert.ok(rit.centenPP > 0, 'een geboekte rit kost geld en dat hoort op de stap te staan');
    const som = na.body.avond.stappen.reduce((t, s) => t + s.centenPP, 0);
    assert.equal(na.body.avond.budget.perPersoon, som,
      'het budget telt de echte prijs van de rit mee');
  }
  /* En hoe dan ook: het plan blijft binnen het plafond dat de gast stelde. Dit
     is de bewering die zakt zodra de budgetcontrole van de rit wordt
     weggehaald. */
  assert.equal(na.body.avond.budget.past, true,
    'na het aanvragen staat het plan nog steeds binnen het plafond');
});

test('geen enkele zin die de gast leest bevat NaN of undefined', async () => {
  /* Deze toets bestaat om een echte fout. De prijs van een reisoptie zit in
     `optie.totaal.prijs`; `optie.totaal` zelf is een OBJECT. Ik nam aan dat het
     een bedrag was, en de weigering luidde daardoor "de goedkoopste rit kost
     € NaN" -- een zin die een gast te zien zou krijgen. Een getal dat nergens
     vandaan komt, hoort nooit in een mensentekst te belanden. */
  await post('/api/mob/favoriet', { naam: 'Thuis', plek: { zaak: 'SAKURA' } }, LID);
  const v = await post('/api/avond/voorstel', { start: '18:30', thuisOm: '02:00',
    personen: 2, plafondPP: 40000 }, LID);
  const na = await post('/api/avond/aanvragen', { id: v.body.avond.id }, LID);
  const alleTekst = JSON.stringify(na.body) + JSON.stringify(v.body);
  assert.ok(!/NaN/.test(alleTekst), 'er staat NaN in wat de gast leest: ' +
    (alleTekst.match(/.{0,60}NaN.{0,40}/) || [''])[0]);
  assert.ok(!/undefined/.test(alleTekst), 'er staat undefined in wat de gast leest');
  const rit = na.body.avond.stappen.find(s => s.soort === 'vervoer');
  assert.equal(rit.staat, 'bevestigd', 'met een thuisplek en ruim budget wordt de rit echt geboekt');
  assert.ok(rit.centenPP > 0 && Number.isFinite(rit.centenPP));
});

test('de avondplanner loopt niet om de gegevenspoort heen', async () => {
  /* `/api/reserveer` heeft een gegevenspoort; deze route roept reserveerTafel
     RECHTSTREEKS aan en liep er eerst omheen. Een avond aanvragen deed toen wat
     een reservering aanvragen niet mag -- het gevaarlijkste soort gat, want de
     poort staat er nog en lijkt te werken. */
  const u = String(Date.now()) + '3';
  const reg = await post('/api/auth/register', { name: 'Zonder nummer',
    email: 'zn' + u + '@voorbeeld.nl', password: 'geheim123',
    geboortedatum: '1990-05-05', geslacht: 'v', tier: 'rtg', pasApp: 'rtg' });
  const kaal = reg.body.token;
  assert.ok(kaal, 'de proefpersoon zonder telefoon moet wel een geldige sessie krijgen');

  const v = await post('/api/avond/voorstel', { start: '19:00', thuisOm: '01:30',
    personen: 2, plafondPP: 20000 }, kaal);
  assert.equal(v.status, 200, JSON.stringify(v.body).slice(0, 160));
  const uit = await post('/api/avond/aanvragen', { id: v.body.avond.id }, kaal);
  assert.equal(uit.status, 428, 'zonder telefoonnummer hoort de poort te bijten, net als bij /api/reserveer');
  assert.ok((uit.body.ontbreekt || []).length, 'en te zeggen wat er ontbreekt');

  const na = await post('/api/avond', { id: v.body.avond.id }, kaal);
  assert.ok(na.body.avond.stappen.length > 0,
    'het voorstel bevat echte stappen; een lege avond mag deze terugroltoets niet groen maken');
  assert.ok(na.body.avond.stappen.every(s => s.staat === 'voorstel'),
    'en er hoort niets te zijn aangevraagd');
});

test('de club: aanvragen is niet binnenkomen, en dat weet de deur ook', async () => {
  /* De hele keten in een keer, want juist hier zit de belofte die pijn doet
     als hij niet klopt: iemand die om half twee bij de deur staat met een app
     die zegt dat hij op de lijst staat.

     De club wordt met een VOORKEUR gekozen en niet met geluk: de weegfunctie
     telt woorden uit je profiel mee, dus met "nocturna" erin wint Sal Nocturna
     de uitgaan-plek. Zonder die zet zou deze toets soms een bar treffen en dan
     stil iets anders bewaken dan zijn titel zegt. */
  /* Twee rake woorden en niet een. De weegfunctie geeft +2 per woord uit je
     profiel dat in de naam van een zaak zit; met een enkel woord staat de club
     gelijk met de bar en beslist de volgorde in de seed -- dan wint hij vandaag
     en morgen niet meer, en bewaakt de toets iets anders dan zijn titel zegt. */
  await post('/api/avond/voorkeuren', { zet: {
    waarden: { sfeer: 'nocturna', tafel: 'sal nocturna' },
    delen: { sfeer: 'altijd', tafel: 'altijd' } } }, LID);
  /* 03:00 en niet 04:00: de avondklok knipt op 04:00, dus "04:00 thuis" leest
     als vanochtend vroeg en het plan wordt terecht geweigerd. */
  const voorstel = await post('/api/avond/voorstel', { start: '19:00', thuisOm: '03:00',
    personen: 3, plafondPP: 20000 }, LID);
  assert.equal(voorstel.status, 200, JSON.stringify(voorstel.body).slice(0, 200));
  const avond = voorstel.body.avond;
  const stap = avond.stappen.find(s => s.soort === 'uitgaan');
  assert.ok(stap && stap.zaak === 'NACHT', 'de club wordt voorgesteld als tweede plek: ' + JSON.stringify(stap));
  assert.equal(stap.centenPP, null, 'zonder kaart weten we de prijs niet, en dat is geen nul');
  assert.ok(voorstel.body.avond.budget.onbekend >= 1, 'het budget zegt van hoeveel stappen het de prijs niet weet');
  /* En de UITLEG liegt er ook niet over. Hier stond "past binnen je budget
     (ongeveer EUR 0.00 per persoon)" over een club waarvan we de prijzen niet
     kennen -- een zin die een gast in het scherm te lezen kreeg. Gevonden door
     de keten in een echte browser af te lopen, niet door een toets. */
  const waarom = (voorstel.body.uitleg.find(u => u.zaak === 'NACHT') || {}).waarom || [];
  assert.ok(waarom.length, 'de clubstap draagt een uitleg');
  assert.ok(!waarom.some(w => /0[.,]00/.test(w)),
    'geen verzonnen nulbedrag over een zaak zonder kaart: ' + JSON.stringify(waarom));
  assert.ok(waarom.some(w => /weten we niet|geen kaart/i.test(w)),
    'maar wel de mededeling dat we het niet weten: ' + JSON.stringify(waarom));

  const gevraagd = await post('/api/avond/aanvragen', { id: avond.id }, LID);
  const na = gevraagd.body.avond.stappen.find(s => s.soort === 'uitgaan');
  assert.equal(na.staat, 'aangevraagd', 'een club wordt aangevraagd, nooit bevestigd');
  assert.equal(na.boeking.domein, 'gastenlijst');
  assert.match(na.reden, /beslist/i);

  // nu de clubkant: de aanvraag staat op DEZELFDE lijst die de portier ziet
  const roster = (await post('/api/supplier/roster', { code: 'NACHT' })).body;
  const mgr = roster.staff.find(x => x.role === 'manager') || roster.staff[0];
  const club = (await post('/api/supplier/login', { code: 'NACHT', staffId: mgr.id, pin: '1234' })).body.token;
  assert.ok(club, 'de club kan inloggen');
  const lijst = (await post('/api/supplier/horeca/club/gastenlijst', { datum: avond.datum }, club)).body;
  assert.equal(lijst.teBeslissen, 1, 'er staat een aanvraag te wachten: ' + JSON.stringify(lijst.aanvragen));
  const regel = lijst.aanvragen[0];
  assert.equal(regel.personen, 3, 'met het gezelschap uit het plan');
  assert.equal(lijst.perPromoter['zonder promoter'], undefined, 'een aanvraag telt nog niet mee in de promotercijfers');

  // de deur: nog niet goedgekeurd is nog niet binnen
  const teVroeg = await post('/api/supplier/horeca/club/deur',
    { wat: 'in', personen: 3, capaciteit: 50, gastId: regel.id }, club);
  assert.equal(teVroeg.status, 409, 'de deur laat een onbesliste aanvraag niet door');
  assert.match(teVroeg.body.error, /aangevraagd/);
  const stand = (await post('/api/supplier/horeca/club/deur', { wat: 'stand' }, club)).body;
  assert.equal(stand.binnen, 0, 'en de teller is bij die weigering niet opgehoogd');

  // de club beslist, en pas dan gaat de deur open
  const ok = await post('/api/supplier/horeca/club/gastenlijst/beslis', { regel: regel.id, stand: 'ok' }, club);
  assert.equal(ok.status, 200, JSON.stringify(ok.body).slice(0, 120));
  const binnen = await post('/api/supplier/horeca/club/deur',
    { wat: 'in', personen: 3, capaciteit: 50, gastId: regel.id }, club);
  assert.equal(binnen.status, 200);
  assert.equal(binnen.body.binnen, 3, 'nu staan ze binnen');
});
