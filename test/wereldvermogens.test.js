/* De vermogens van de Lifestyle- en Business Pass die eerst alleen een NAAM in
   rechten.js hadden: geavanceerd zoeken, netwerkanalyse en "wie bekeek mijn
   profiel".

   De belangrijkste bewering staat in het midden: ZOEKEN VINDT ALLEEN WAT JE MAG
   ZIEN. Dat wordt hier niet getoetst door te kijken of er een uitslag komt,
   maar door hetzelfde lid twee keer te zoeken met alleen de zichtbaarheid
   ertussen veranderd. Een zoekmachine die matcht op een veld dat hij daarna
   niet toont, is een lek met een nette voorkant.

   Draai los: node --experimental-sqlite --test test/wereldvermogens.test.js */
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { startServer, elevateTier } = require('./helper');
const rechten = require('../server/kern/wereld/rechten');

let BASE, child;
const TMP = fs.mkdtempSync(path.join(os.tmpdir(), 'rtg-wverm-'));

function post(pad, body, token) {
  const headers = { 'Content-Type': 'application/json' };
  if (token) headers['Authorization'] = 'Bearer ' + token;
  return fetch(BASE + pad, { method: 'POST', headers, body: JSON.stringify(body || {}) });
}
const json = r => r.json();

async function lid(naam, email, tier) {
  const regTier = (tier === 'lifestyle' || tier === 'business') ? 'rtg' : tier;
  const d = await json(await post('/api/auth/register', {
    name: naam, email, phone: '0612345678', password: 'geheim123',
    geboortedatum: '1990-01-01', tier: regTier
  }));
  assert.ok(d.token, 'registratie geeft een sessietoken');
  if (regTier !== tier) {
    const office = (await json(await post('/api/office/login', { code: 'RTG-OFFICE' }))).token;
    await elevateTier(BASE, d.token, tier, office);
  }
  const mij = await json(await post('/api/member/connections', {}, d.token));
  const p = await json(await post('/api/metier/ik', {}, d.token));
  return { token: d.token, codenaam: p.profiel.codenaam, key: mij.me };
}
const verbind = async (a, b) => {
  await post('/api/member/connect', { key: b.key }, a.token);
  await post('/api/member/connect/respond', { key: a.key, action: 'accept' }, b.token);
};

test.before(async () => {
  ({ child, base: BASE } = await startServer({ env: { RTG_DATA_DIR: TMP, SMTP_URL: '' } }));
});
test.after(() => {
  if (child) try { child.kill('SIGKILL'); } catch (e) {}
  try { fs.rmSync(TMP, { recursive: true, force: true }); } catch (e) {}
});

/* ---------- de registratie: geen lege namen meer ----------

   Dit is de belangrijkste toets in dit bestand, en hij is er gekomen omdat de
   lijst vol stond met beloftes die niets deden: `werving.suite`, `sales.suite`,
   `events.zakelijk`, `leren.certificaten`, `ai.loopbaan`, `creator.gereedschap`
   -- namen achter een betaalde pas, waarvan sommige iets beloofden dat elders
   GRATIS al bestond (Rahul als loopbaancoach staat in kern/metier/ai.js en is er
   voor elk lid). Dat is LAT-regel 6, en een toets die alleen de gebouwde
   vermogens nakijkt had het nooit gezien.

   Daarom draait deze de vraag om: hij loopt over ELK vermogen in rechten.js en
   eist dat het aantoonbaar iets DOET -- als poort in de code, of met een
   opgeschreven reden waarom het bewust geen poort is. Wie er een toevoegt zonder
   een van beide, ziet hem zakken. */

test('elk vermogen is een echte poort, of staat met reden als beschrijvend', () => {
  const wortel = path.join(__dirname, '..');
  const bronnen = [];
  (function loop(dir) {
    for (const naam of fs.readdirSync(dir)) {
      if (naam === 'node_modules' || naam === '.git' || naam === 'data') continue;
      const p = path.join(dir, naam);
      const st = fs.statSync(p);
      if (st.isDirectory()) loop(p);
      else if (/\.(js|html)$/.test(naam) && !p.includes(path.join(wortel, 'test'))) bronnen.push(p);
    }
  })(path.join(wortel, 'server'));
  (function loop(dir) {
    for (const naam of fs.readdirSync(dir)) {
      const p = path.join(dir, naam);
      const st = fs.statSync(p);
      if (st.isDirectory()) loop(p);
      else if (/\.html$/.test(naam)) bronnen.push(p);
    }
  })(path.join(wortel, 'public', 'apps'));

  /* De inhoud van rechten.js zelf telt NIET mee als gebruik: daar staat elke
     naam per definitie in, en dan zou elke naam zichzelf bewijzen. */
  const code = bronnen
    .filter(p => !p.endsWith(path.join('kern', 'wereld', 'rechten.js')))
    .map(p => fs.readFileSync(p, 'utf8')).join('\n');

  const alle = [...new Set(rechten.TRAP.flatMap(t => rechten.ERBIJ[t]))];
  assert.ok(alle.length > 10, 'er zijn vermogens om na te kijken');

  const leeg = [];
  for (const v of alle) {
    const reden = rechten.BESCHRIJVEND[v];
    if (reden) {
      assert.ok(typeof reden === 'string' && reden.length > 20,
        'het vermogen ' + v + ' staat als beschrijvend maar zonder echte reden');
      continue;
    }
    // een poort: de naam komt letterlijk voor in de code die hem afdwingt
    if (!code.includes("'" + v + "'") && !code.includes('"' + v + '"')) leeg.push(v);
  }
  assert.deepEqual(leeg, [],
    'deze vermogens doen nergens iets en staan ook niet als beschrijvend opgeschreven: ' + leeg.join(', '));
});

test('een vermogen dat nergens meer bestaat, staat ook niet als beschrijvend', () => {
  // de tegenkant: BESCHRIJVEND mag geen namen bevatten die uit de trap zijn gehaald
  const alle = new Set(rechten.TRAP.flatMap(t => rechten.ERBIJ[t]));
  const wees = Object.keys(rechten.BESCHRIJVEND).filter(v => !alle.has(v));
  assert.deepEqual(wees, [], 'deze staan als beschrijvend maar zitten in geen enkele pas: ' + wees.join(', '));
});

/* ---------- de poort: dit hoort bij een andere pas ---------- */

test('de drie vermogens zijn dicht voor de gratis pas en open voor Lifestyle', async () => {
  const g = await lid('Verm Gratis', 'v1@x.nl', 'rtg');
  const l = await lid('Verm Lief', 'v2@x.nl', 'lifestyle');

  for (const [pad, body] of [['/api/wereld/zoek', { q: 'x' }],
    ['/api/wereld/introductie', { codenaam: l.codenaam }],
    ['/api/wereld/bezoekers', {}]]) {
    const dicht = await post(pad, body, g.token);
    assert.equal(dicht.status, 403, pad + ' hoort dicht te zijn voor een gratis pas');
    assert.match((await json(dicht)).error, /Lifestyle en Business/);
    assert.equal((await post(pad, body, l.token)).status, 200, pad + ' hoort open te zijn voor Lifestyle');
  }
});

/* ---------- zoeken vindt alleen wat je mag zien ---------- */

test('zoeken op een AFGESCHERMD veld vindt niets, op hetzelfde veld open wel', async () => {
  /* Dezelfde persoon, dezelfde zoekterm, alleen de zichtbaarheid ertussen
     veranderd. Zo kan de toets niet slagen om een andere reden. */
  const doel = await lid('Zoek Doel', 's1@x.nl', 'business');
  const zoeker = await lid('Zoek Zoeker', 's2@x.nl', 'business');   // geen contact

  await post('/api/zakelijk/profiel/zet',
    { naam: 'D', kop: 'Scheepsbouwer', sector: 'Maritiem' }, doel.token);

  const treffers = async (filter) =>
    (await json(await post('/api/wereld/zoek', filter, zoeker.token))).treffers
      .filter(t => t.codenaam === doel.codenaam);

  // sector staat standaard op 'iedereen': te vinden
  assert.equal((await treffers({ sector: 'Maritiem' })).length, 1, 'open sector is vindbaar');

  // nu afschermen -- en dan mag dezelfde zoekopdracht hem niet meer vinden
  await post('/api/wereld/profiel/zicht', { pad: 'professioneel.sector', niveau: 'alleenik' }, doel.token);
  assert.equal((await treffers({ sector: 'Maritiem' })).length, 0,
    'een afgeschermde sector is niet op sector te vinden');

  // en ook de vrije zoekterm mag er niet omheen lopen
  assert.equal((await treffers({ q: 'maritiem' })).length, 0,
    'de vrije term mag niet matchen op een veld dat je niet mag zien');

  // wat wel open staat, blijft gewoon werken -- anders bewijst het bovenstaande
  // alleen dat zoeken kapot is
  assert.equal((await treffers({ q: 'scheepsbouwer' })).length, 1,
    'op een veld dat wel open staat is hij nog steeds te vinden');
});

test('de uitslag bevat alleen velden die de zoeker mag zien', async () => {
  const doel = await lid('Uit Doel', 's3@x.nl', 'business');
  const zoeker = await lid('Uit Zoeker', 's4@x.nl', 'business');

  await post('/api/salon/bio', { bio: 'Mijn persoonlijke verhaal.', plaats: 'Ibiza' }, doel.token);
  await post('/api/zakelijk/profiel/zet', { naam: 'D', kop: 'Kapitein' }, doel.token);

  const t = (await json(await post('/api/wereld/zoek', { q: 'kapitein' }, zoeker.token)))
    .treffers.find(x => x.codenaam === doel.codenaam);
  assert.ok(t, 'het lid staat in de uitslag');

  const paden = t.velden.map(v => v.pad);
  assert.ok(paden.includes('professioneel.kop'), 'de kop staat erbij (die is open)');
  assert.ok(!paden.includes('persoonlijk.over'),
    'de persoonlijke bio staat standaard op contacten en hoort er dus niet in');
  assert.ok(!JSON.stringify(t).includes('persoonlijke verhaal'),
    'en de waarde lekt nergens in de uitslag');
});

/* ---------- netwerkanalyse ---------- */

test('netwerkanalyse noemt wie je kan introduceren, op codenaam en begrensd', async () => {
  const ik = await lid('Intro Ik', 'n1@x.nl', 'business');
  const brug = await lid('Intro Brug', 'n2@x.nl', 'rtg');
  const doel = await lid('Intro Doel', 'n3@x.nl', 'business');
  const vreemde = await lid('Intro Vreemde', 'n4@x.nl', 'rtg');

  await verbind(ik, brug);
  await verbind(brug, doel);

  const r = await json(await post('/api/wereld/introductie', { codenaam: doel.codenaam }, ik.token));
  assert.equal(r.aantal, 1, 'er is precies één gedeelde connectie');
  assert.deepEqual(r.via, [brug.codenaam], 'en dat is de brug, op codenaam');
  assert.ok(!JSON.stringify(r).includes(brug.key), 'er staat nergens een sleutel in');

  // zonder gedeelde connectie is het antwoord leeg en niet "iemand"
  const geen = await json(await post('/api/wereld/introductie', { codenaam: vreemde.codenaam }, ik.token));
  assert.equal(geen.aantal, 0);
  assert.deepEqual(geen.via, []);

  assert.equal((await post('/api/wereld/introductie', { codenaam: 'BestaatNiet9' }, ik.token)).status, 404);
});

/* ---------- wie bekeek mijn profiel ---------- */

test('een profielbezoek wordt genoteerd, en de kijker krijgt dat te horen', async () => {
  const ik = await lid('Bez Ik', 'b1@x.nl', 'lifestyle');
  const kijker = await lid('Bez Kijker', 'b2@x.nl', 'rtg');

  const leeg = await json(await post('/api/wereld/bezoekers', {}, ik.token));
  assert.equal(leeg.totaal, 0, 'nog niemand langs geweest');

  const bezoek = await json(await post('/api/wereld/profiel/van', { codenaam: ik.codenaam }, kijker.token));
  assert.equal(bezoek.bezoekGenoteerd, true,
    'de kijker hoort te weten dat zijn bezoek is genoteerd -- er is geen sluipstand');

  const na = await json(await post('/api/wereld/bezoekers', {}, ik.token));
  assert.equal(na.totaal, 1);
  assert.equal(na.bezoekers[0].codenaam, kijker.codenaam, 'op codenaam');
  assert.equal(na.bezoekers[0].keer, 1);
  assert.ok(!JSON.stringify(na).includes(kijker.key), 'nooit een sleutel');

  // twee keer kijken is EEN regel met een teller, geen tweede regel
  await post('/api/wereld/profiel/van', { codenaam: ik.codenaam }, kijker.token);
  const na2 = await json(await post('/api/wereld/bezoekers', {}, ik.token));
  assert.equal(na2.totaal, 1, 'nog steeds één bezoeker');
  assert.equal(na2.bezoekers[0].keer, 2, 'maar wel twee keer geteld');
});

/* ---------- bereik: over je eigen werk, zonder de lus ---------- */

test('bereik telt je eigen posts over de bronnen heen, en belooft geen vertoningen', async () => {
  const l = await lid('Bereik Lid', 'br1@x.nl', 'business');
  const ander = await lid('Bereik Ander', 'br2@x.nl', 'rtg');

  await post('/api/salon/plaats', { tekst: 'Een avond op zee.' }, l.token);
  await post('/api/zakelijk/profiel/zet', { naam: 'B', kop: 'Reder' }, l.token);
  await post('/api/zakelijk/post', { tekst: 'Wij zoeken een stuurman.' }, l.token);
  // en iemand anders plaatst ook iets: dat mag NIET in mijn bereik terechtkomen
  await post('/api/salon/plaats', { tekst: 'Niet van mij.' }, ander.token);

  const r = await json(await post('/api/wereld/bereik', {}, l.token));
  assert.equal(r.bronnen.salon.posts, 1, 'een Salon-post');
  assert.equal(r.bronnen.zakelijk.posts, 1, 'en een zakelijke post');
  assert.equal(r.totaal.posts, 2, 'twee samen -- en niet die van een ander');
  assert.ok(r.best.some(b => b.tekst === 'Een avond op zee.'), 'de stukken staan erbij');
  assert.ok(!JSON.stringify(r).includes('Niet van mij'), 'andermans post lekt er niet in');

  // de eerlijke voetnoot hoort in het ANTWOORD te staan, niet alleen op het scherm
  assert.match(r.voetnoot, /geen vertoningen|niet bij.*gezien/i,
    'het antwoord zegt niet dat vertoningen niet worden geteld: ' + r.voetnoot);

  // en er is geen enkele vergelijking-over-tijd in het antwoord (de lus die we niet willen)
  assert.ok(!/vorige week|procent|%|trend|groei/i.test(JSON.stringify(r)),
    'er staat een groei- of trendmaat in het bereik, en die hoort er niet te zijn');
});

test('het bedrijfsbeeld zegt ook wat we NIET weten', async () => {
  /* Deze toets ontbrak, en de keuring wees hem aan: van de vijftien
     wereld-endpoints was `/api/wereld/bedrijf` de enige die in geen enkele
     toets voorkwam. Een endpoint zonder toets is geen defect, maar wel een
     stuk code waarvan niemand kan zeggen wat het doet. */
  const b = await lid('Bedrijf Baas', 'bd1@x.nl', 'business');

  const leeg = await post('/api/wereld/bedrijf', {}, b.token);
  assert.equal(leeg.status, 400, 'zonder zoekterm: geweigerd');

  const r = await json(await post('/api/wereld/bedrijf', { q: 'zzz-bestaat-niet' }, b.token));
  assert.deepEqual(r.treffers, [], 'een onbekende naam geeft een lege lijst, geen gok');

  /* En de eigenschap die het ontwerp draagt: wat RTG niet weet, staat er als
     zodanig bij. Een lege regel leest anders als een nul (LAT-regel 5). */
  const demo = await json(await post('/api/wereld/bedrijf', { q: 'a' }, b.token));
  if (demo.treffers.length) {
    assert.ok(Array.isArray(demo.treffers[0].onbekend) && demo.treffers[0].onbekend.includes('omzet'),
      'het bedrijfsbeeld zegt niet welke gegevens het NIET heeft: ' + JSON.stringify(demo.treffers[0]));
  }
});

/* ---------- de bewaarde lijsten ---------- */

test('de talentpool bewaart een codenaam, nooit een sleutel, en alleen wie je mag zien', async () => {
  const baas = await lid('Pool Baas', 'pl1@x.nl', 'business');
  const kandidaat = await lid('Pool Kandidaat', 'pl2@x.nl', 'lifestyle');
  /* `verstopt` heeft een GRATIS pas, en dat is hier geen toevalligheid maar de
     eigenschap die wordt vastgelegd: een RTG Pass heeft alleen de persoonlijke
     laag, en die staat standaard op 'contacten'. Wie dus niets professioneels
     deelt, komt niet in andermans talentpool terecht -- ook niet als de
     werkgever zijn codenaam kent. De professionele zoeklaag vindt mensen die
     zich professioneel laten zien, en niemand anders. */
  const verstopt = await lid('Pool Verstopt', 'pl3@x.nl', 'rtg');

  await post('/api/salon/bio', { bio: 'Ik vaar.', plaats: 'Ibiza' }, kandidaat.token);
  await post('/api/zakelijk/profiel/zet', { naam: 'K', kop: 'Stuurman' }, kandidaat.token);

  const toevoegen = (codenaam, notitie) => post('/api/wereld/lijst/zet',
    { soort: 'talent', nieuw: true, codenaam, notitie }, baas.token);

  const r = await json(await toevoegen(kandidaat.codenaam, 'Sprak hem op het kansenbord.'));
  assert.ok(r.ok, 'de kandidaat is bewaard: ' + JSON.stringify(r).slice(0, 120));
  assert.equal(r.stand, 'gezien', 'met de eerste stand van deze lijst');

  const pool = await json(await post('/api/wereld/lijst', { soort: 'talent' }, baas.token));
  assert.equal(pool.items.length, 1);
  assert.equal(pool.items[0].codenaam, kandidaat.codenaam);
  assert.ok(!JSON.stringify(pool).includes(kandidaat.key), 'er staat nergens een sleutel in');

  // iemand die niets zichtbaars heeft, kun je niet bewaren: de lijst mag geen
  // omweg zijn om te toetsen of een codenaam bestaat
  const dicht = await toevoegen(verstopt.codenaam, '');
  assert.equal(dicht.status, 400);
  assert.match((await json(dicht)).error, /niet voor je zichtbaar/);

  // dubbel toevoegen mag niet, en een onbekende stand ook niet
  assert.equal((await toevoegen(kandidaat.codenaam, '')).status, 400, 'niet twee keer dezelfde');
  const raar = await post('/api/wereld/lijst/zet',
    { soort: 'talent', codenaam: kandidaat.codenaam, stand: 'aangenomen' }, baas.token);
  assert.equal(raar.status, 400, 'een stand die niet bij deze lijst hoort, wordt geweigerd');

  const goed = await post('/api/wereld/lijst/zet',
    { soort: 'talent', codenaam: kandidaat.codenaam, stand: 'benaderd' }, baas.token);
  assert.equal(goed.status, 200, 'een stand die er wel bij hoort, mag');
});

test('de twee lijsten staan los van elkaar en hebben eigen standen', async () => {
  const b = await lid('Lijst Baas', 'lj1@x.nl', 'business');
  const p = await lid('Lijst Persoon', 'lj2@x.nl', 'lifestyle');
  await post('/api/zakelijk/profiel/zet', { naam: 'P', kop: 'Inkoper' }, p.token);

  await post('/api/wereld/lijst/zet', { soort: 'lead', nieuw: true, codenaam: p.codenaam }, b.token);
  const leads = await json(await post('/api/wereld/lijst', { soort: 'lead' }, b.token));
  const talent = await json(await post('/api/wereld/lijst', { soort: 'talent' }, b.token));

  assert.equal(leads.items.length, 1, 'hij staat bij de leads');
  assert.equal(leads.items[0].stand, 'nieuw', 'met de eerste stand van DIE lijst');
  assert.equal(talent.items.length, 0, 'en niet in de talentpool');
  assert.notDeepEqual(leads.standen, talent.standen, 'de twee lijsten hebben eigen standen');

  // een lead-stand op de talentpool zetten mag niet
  assert.equal((await post('/api/wereld/lijst/zet',
    { soort: 'lead', codenaam: p.codenaam, stand: 'gewonnen' }, b.token)).status, 200);
  assert.equal((await post('/api/wereld/lijst/zet',
    { soort: 'lead', codenaam: p.codenaam, stand: 'niet nu' }, b.token)).status, 400,
  'een stand uit de andere lijst wordt geweigerd');
});

/* ---------- Rahul met drie lenzen ---------- */

test('Rahul krijgt alleen gegevens die de vrager zelf mag zien', async () => {
  const vrager = await lid('AI Vrager', 'ai1@x.nl', 'business');
  const doel = await lid('AI Doel', 'ai2@x.nl', 'business');

  await post('/api/salon/bio', { bio: 'Geheim verhaal.', plaats: 'Ibiza' }, doel.token);
  await post('/api/zakelijk/profiel/zet', { naam: 'D', kop: 'Werktuigbouwer' }, doel.token);

  /* Zonder AI-sleutel geeft het model niets terug -- maar de STOF wel, en dat
     is precies wat hier wordt nagetrokken: welke gegevens zouden er naar het
     model gaan. Zo bewijst deze toets iets echts, ook op een machine zonder
     sleutel (LAT-regel 3: stilvallen is geen uitkomst). */
  const r = await json(await post('/api/wereld/rahul',
    { lens: 'recruiter', q: 'werktuigbouwer' }, vrager.token));
  const stof = JSON.stringify(r.stof || []);

  assert.ok(stof.includes(doel.codenaam), 'het doel zit in de stof, op codenaam');
  assert.ok(!stof.includes('Geheim verhaal'),
    'de afgeschermde bio gaat NIET mee naar het model: ' + stof.slice(0, 200));
  assert.ok(!stof.includes(doel.key), 'en er gaat nooit een sleutel mee');

  assert.equal((await post('/api/wereld/rahul', { lens: 'bestaatniet' }, vrager.token)).status, 400);
});

test('een AI-lens is dicht zonder het bijbehorende vermogen', async () => {
  const lief = await lid('AI Lief', 'ai3@x.nl', 'lifestyle');
  // ai.netwerk hoort bij Lifestyle, ai.recruiter en ai.sales bij Business
  assert.equal((await post('/api/wereld/rahul', { lens: 'netwerk', q: 'x' }, lief.token)).status, 200);
  const dicht = await post('/api/wereld/rahul', { lens: 'recruiter', q: 'x' }, lief.token);
  assert.equal(dicht.status, 403, 'de recruiterbril hoort bij Business');
  assert.equal((await json(dicht)).vermogen, 'ai.recruiter', 'en zegt WELK vermogen ontbreekt');
});

test('je eigen profiel openen telt niet mee', async () => {
  const ik = await lid('Zelf Ik', 'b3@x.nl', 'lifestyle');
  const r = await json(await post('/api/wereld/profiel/van', { codenaam: ik.codenaam }, ik.token));
  assert.equal(r.bezoekGenoteerd, false, 'jezelf bekijken is geen bezoek');
  assert.equal((await json(await post('/api/wereld/bezoekers', {}, ik.token))).totaal, 0,
    'en je staat niet op je eigen lijst');
});
