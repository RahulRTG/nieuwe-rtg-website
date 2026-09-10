/* RTG MOVE, DE VOLLE KETEN -- van twee echte boekingen naar een oordeel.

   test/move.test.js toetst de rekenkern puur. Dit toetst wat er niet puur te
   toetsen valt: dat de laag werkelijk AANGESLOTEN is. Dat is een andere vraag,
   en het is de vraag waarop deze laag drie keer is gezakt voordat hij werkte:

     - de tijdlijn gooide de leverancierscode en de duur weg die de boeking al
       had, dus er viel niets te rekenen;
     - de bron filterde op `b.datum`, een veld dat op een boeking niet bestaat
       (die heet `wanneer`), dus geen enkele betaalde afspraak kwam ooit op de
       reistijdlijn;
     - en de volgorde werd aangenomen, waardoor Move een overgang TERUG IN DE
       TIJD rekende en dat met een echte reistijd en bron onderbouwde.

   Geen van die drie was met een pure toets te vinden. Vandaar deze.

   Draai los: node --test --test-timeout=300000 test/move-keten.test.js */
'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const { startServer, stop } = require('./helper');

const morgen = () => new Date(Date.now() + 86400000).toISOString().slice(0, 10);

async function post(base, pad, lijf, tok) {
  const r = await fetch(base + pad, { method: 'POST',
    headers: Object.assign({ 'Content-Type': 'application/json' }, tok ? { Authorization: 'Bearer ' + tok } : {}),
    body: JSON.stringify(lijf || {}) });
  return { status: r.status, data: await r.json().catch(() => null) };
}

test('RTG Move: twee echte boekingen worden een naad met een oordeel', async (t) => {
  const { child, base } = await startServer({ env: { SMTP_URL: '' } });
  t.after(() => stop(child));

  const u = Date.now().toString().slice(-8) + Math.floor(Math.random() * 90 + 10);
  const reg = await post(base, '/api/auth/register', { name: 'Proeflid', email: 'mvk' + u + '@voorbeeld.nl',
    phone: '06' + u.slice(0, 8), password: 'geheim12345', geboortedatum: '1985-05-05', tier: 'rtg' });
  const tok = reg.data && reg.data.token;
  assert.ok(tok, 'proeflid aangemaakt');

  /* Twee zaken op VERSCHILLENDE plekken, met een dienst die een duur kent --
     zonder duur is er geen moment waarop je weg kunt en dus geen overgang. */
  const d = morgen();
  const boek = async (code, dienst, tijd) => {
    const r = await post(base, '/api/booking/request', { supplierCode: code, serviceId: dienst, date: d, time: tijd }, tok);
    assert.equal(r.status, 200, 'boeking bij ' + code);
    const ref = r.data.boeking.ref;
    const p = await post(base, '/api/booking/pay', { ref }, tok);
    assert.equal(p.status, 200, 'boeking bij ' + code + ' betaald');
    return ref;
  };
  const eerste = await boek('KAITO', 's1', '10:00');   // 60 minuten
  await boek('SERENA', 'w1', '11:15');

  /* 1. DE NAAD BESTAAT, met een echte reistijd en een echte bron. Faalt dit,
     dan is de keten ergens onderbroken -- en dat is precies wat er drie keer
     gebeurde zonder dat een pure toets er iets van merkte. */
  const reis = await post(base, '/api/move/reis', {}, tok);
  assert.equal(reis.status, 200);
  assert.equal(reis.data.onderdelen, 2, 'beide betaalde afspraken staan op de tijdlijn');
  assert.equal(reis.data.metPlek, 2, 'en hun plek is opgelost uit de zaakcode');
  assert.equal(reis.data.metTijd, 2, 'en hun tijd komt uit `wanneer`');
  assert.equal(reis.data.naden.length, 1, 'twee onderdelen geven een overgang');
  const n = reis.data.naden[0];
  assert.notEqual(n.uitkomst, 'NIET_TE_BEPALEN', 'de overgang is te bepalen');
  assert.ok(n.beschikbaarMin >= 0, 'de overgang rekent niet terug in de tijd');
  assert.ok(Number.isFinite(n.nodigMin) && n.nodigMin > 0, 'er is een echte reistijd gerekend');
  assert.match(String(n.bron || ''), /wegennet|NWB/i, 'en die komt uit de eigen motor');
  assert.equal(reis.data.dekking, 100);
  assert.equal(n.drempel.grond, 'huiskeuze', 'de drempel doet zich niet voor als meting');

  /* 2. DE VOLGENDE BEWEGING is afgeleid en niet verzonnen. */
  const volg = await post(base, '/api/move/volgende', {}, tok);
  assert.equal(volg.status, 200);
  assert.ok(volg.data.volgende, 'er is een komend onderdeel met plek en tijd');
  assert.ok(Number.isFinite(volg.data.volgende.plek.lat), 'met een echte plek');
  assert.equal(volg.data.volgende.plek.bron, 'zaak', 'opgelost uit de zaakcode en niet geraden');

  /* 3. EEN VERSCHUIVING MAAKT HET SLECHTER, wijst het juiste onderdeel aan en
     zet een voorstel KLAAR zonder het uit te voeren. */
  const g = await post(base, '/api/move/gevolg', { kenmerk: eerste, minuten: 45 }, tok);
  assert.equal(g.status, 200);
  assert.equal(g.data.oordeelNa, 'ONHAALBAAR', '45 minuten later haalt de tweede afspraak het niet');
  assert.equal(g.data.geraakt, 1);
  const geraakt = g.data.regels.find(r => r.geraakt);
  assert.match(geraakt.titel, /massage/i, 'het onderdeel waar je NAARTOE gaat wordt geraakt');
  assert.equal(geraakt.voorstel.uitgevoerd, false, 'een voorstel wordt klaargezet, nooit uitgevoerd');
  assert.equal(geraakt.voorstel.bevestigt, 'een mens');

  /* 4. EN ER IS GEEN SCHRIJFWEG. Move mag niets veranderen; dat een route
     bestaat die dat wel doet, hoort de bouw te laten zakken. */
  const schrijf = await post(base, '/api/move/verzet', { kenmerk: eerste }, tok);
  assert.equal(schrijf.status, 404, 'RTG Move heeft met opzet geen route die iets verandert');
});

test('RTG Move: een gast heeft geen reis om te wegen', async (t) => {
  const { child, base } = await startServer({ env: { SMTP_URL: '' } });
  t.after(() => stop(child));
  const zonder = await post(base, '/api/move/reis', {});
  assert.equal(zonder.status, 401, 'zonder sessie komt er niets uit');
});

/* ============================================================================
   DE DEKKING: WELKE BRONNEN LEVEREN EEN PLEK?

   Move stond op 1 van de 6 bronnen met een oplosbare plek, en dat is de reden
   dat hij over de meeste echte reizen `NIET_TE_BEPALEN` zei. Deze toetsen
   houden de drie vast die er sinds 10 september 2026 bij zijn, en vooral de
   GRENS eronder: een plek wordt opgelost of hij bestaat niet -- er komt nooit
   een benadering op een stadsnaam.
   ========================================================================== */

test('een vlucht wijst naar de LUCHTHAVEN en niet naar zijn bestemming', async (t) => {
  /* DE FOUT DIE DEZE TOETS TEGENHOUDT. Bij een hotel of een restaurant zijn
     "waar ga ik heen" en "waar moet ik zijn" dezelfde plek. Bij een vlucht niet:
     u moet op de luchthaven zijn en het vliegtuig brengt u naar Parijs. Wie
     `bestemming` als plek zou meesturen, laat Move de reistijd naar Parijs Le
     Bourget uitrekenen voor iemand die naar de gate moet -- een oordeel dat
     compleet oogt en onzin is. Vandaar dat deze toets het LABEL naleest en niet
     alleen of er een plek is. */
  const { child, base } = await startServer({ env: { SMTP_URL: '', NODE_ENV: 'test', RTG_DEMO: '1' } });
  t.after(() => stop(child));

  const u = Date.now().toString().slice(-8) + Math.floor(Math.random() * 90 + 10);
  const reg = await post(base, '/api/auth/register', { name: 'Proeflid', email: 'mvl' + u + '@voorbeeld.nl',
    phone: '06' + u.slice(0, 8), password: 'geheim12345', geboortedatum: '1985-05-05', tier: 'rtg' });
  const tok = reg.data && reg.data.token;
  assert.ok(tok, 'proeflid aangemaakt');

  /* Een CHARTER en geen lijnvlucht: boeken vraagt een paspoort (een echte
     poort, geen tekort van de toets) en een charter loopt langs exact dezelfde
     luchthaven-plek. De bestemming is met opzet een plaats die NIET de
     luchthaven is. */
  const ch = await post(base, '/api/member/vluchten/charter',
    { soort: 'privejet', bestemming: 'Parijs Le Bourget', datum: morgen(), tijd: '09:30' }, tok);
  assert.equal(ch.status, 200, 'charter aangevraagd');

  const volg = await post(base, '/api/move/volgende', {}, tok);
  assert.equal(volg.status, 200);
  assert.ok(volg.data.volgende, 'de charter staat op de tijdlijn met plek en tijd');
  const plek = volg.data.volgende.plek;
  assert.equal(plek.bron, 'zaak', 'de luchthaven is opgelost uit een verwijzing en niet geraden');
  assert.match(plek.label, /airport|luchthaven/i, 'de plek IS de luchthaven');
  assert.doesNotMatch(plek.label, /parijs|bourget/i, 'en niet de bestemming van de vlucht');
  assert.ok(Number.isFinite(plek.lat) && Number.isFinite(plek.lng), 'met een echt punt');
});

test('een afspraak vóór een vlucht wordt een weegbare naad', async (t) => {
  /* DIT IS DE DEKKINGSWINST, en hij is met een mutatie nagemeten: haal de plek
     van de charter weg en deze naad wordt NIET_TE_BEPALEN met mist ['plek-naar']
     en dekking 0. Een vlucht draagt als enige van de vijf toegevoegde bronnen
     een datum EN een uur, en is daarmee de enige die een naad echt weegbaar
     maakt -- een verblijf levert alleen een plek. */
  const { child, base } = await startServer({ env: { SMTP_URL: '', NODE_ENV: 'test', RTG_DEMO: '1' } });
  t.after(() => stop(child));

  const u = Date.now().toString().slice(-8) + Math.floor(Math.random() * 90 + 10);
  const reg = await post(base, '/api/auth/register', { name: 'Proeflid', email: 'mvn' + u + '@voorbeeld.nl',
    phone: '06' + u.slice(0, 8), password: 'geheim12345', geboortedatum: '1985-05-05', tier: 'rtg' });
  const tok = reg.data && reg.data.token;
  assert.ok(tok, 'proeflid aangemaakt');

  const d = morgen();
  const bk = await post(base, '/api/booking/request',
    { supplierCode: 'KAITO', serviceId: 's1', date: d, time: '08:00' }, tok);
  assert.equal(bk.status, 200, 'afspraak van 08:00 geboekt');
  assert.equal((await post(base, '/api/booking/pay', { ref: bk.data.boeking.ref }, tok)).status, 200);
  assert.equal((await post(base, '/api/member/vluchten/charter',
    { soort: 'privejet', bestemming: 'Parijs Le Bourget', datum: d, tijd: '09:30' }, tok)).status, 200);

  const reis = await post(base, '/api/move/reis', {}, tok);
  assert.equal(reis.status, 200);
  assert.equal(reis.data.metPlek, 2, 'beide onderdelen hebben een opgeloste plek');
  assert.equal(reis.data.dekking, 100, 'en de overgang ertussen is te bepalen');
  const n = reis.data.naden[0];
  assert.notEqual(n.uitkomst, 'NIET_TE_BEPALEN', 'de naad afspraak -> luchthaven is weegbaar');
  assert.ok(Number.isFinite(n.nodigMin) && n.nodigMin > 0, 'met een echte reistijd');
  /* De marge zelf staat er NIET in als vast getal: hij hangt aan de zaakdata in
     de seed, en een toets die 13 minuten eist zakt zodra iemand een zaak
     verplaatst -- dan meet hij de seed en niet de laag. */
});

test('haalbaarheid VOOR de verkoop weegt een voornemen en weigert niets', async (t) => {
  /* De vraag uit de opzet, gesteld voordat er iets vaststaat: past een tafel om
     zeven uur nog bij een reis die er al staat? Move geeft het oordeel MET en
     ZONDER het voornemen; drukken doet de reiziger (MOVE.md grens 5). */
  const { child, base } = await startServer({ env: { SMTP_URL: '', NODE_ENV: 'test', RTG_DEMO: '1' } });
  t.after(() => stop(child));

  const u = Date.now().toString().slice(-8) + Math.floor(Math.random() * 90 + 10);
  const reg = await post(base, '/api/auth/register', { name: 'Proeflid', email: 'mvv' + u + '@voorbeeld.nl',
    phone: '06' + u.slice(0, 8), password: 'geheim12345', geboortedatum: '1985-05-05', tier: 'rtg' });
  const tok = reg.data && reg.data.token;
  assert.ok(tok, 'proeflid aangemaakt');

  const d = morgen();
  /* Een afspraak MET een duur, want alleen dan is er een moment waarop je weg
     kunt en dus een weegbare naad. */
  const bk = await post(base, '/api/booking/request',
    { supplierCode: 'KAITO', serviceId: 's1', date: d, time: '08:00' }, tok);
  assert.equal(bk.status, 200);
  assert.equal((await post(base, '/api/booking/pay', { ref: bk.data.boeking.ref }, tok)).status, 200);

  const weeg = (uur) => post(base, '/api/move/vooraf',
    { titel: 'Vlucht halen', soort: 'voornemen', plek: { zaak: 'LUCHT' }, dag: d, uur }, tok);

  /* Drie tijden, drie uitkomsten -- en de MARGE staat er niet als vast getal in:
     die hangt aan de zaakdata in de seed, en een toets die 13 minuten eist meet
     de seed en niet de laag. Wat hier vastligt is de ORDE. */
  const vroeg = await weeg('09:00');
  assert.equal(vroeg.status, 200);
  assert.equal(vroeg.data.oordeelMet, 'ONHAALBAAR', 'meteen na een afspraak van een uur haal je het niet');
  /* GEEN vergelijking, want er stond nog niets: dit is de eerste boeking van
     deze reis. Dat is een eigen uitkomst en geen "niet slechter" -- op precies
     die verwarring is deze toets een keer gezakt, en de code is aangepast in
     plaats van de bewering. */
  assert.equal(vroeg.data.vergelijking, 'niet-te-vergelijken',
    'een reis van een onderdeel valt niet te vergelijken');
  assert.ok(vroeg.data.naden.length >= 1, 'met de naad die het voornemen zelf raakt');
  assert.ok(vroeg.data.naden[0].margeMin < 0, 'een negatieve marge is hoe "te laat" zich uit');

  const ruim = await weeg('11:00');
  assert.equal(ruim.data.oordeelMet, 'RUIM');
  assert.equal(ruim.data.vergelijking, 'niet-te-vergelijken', 'ook hier was er niets om mee te vergelijken');

  /* EN NU MET EEN REIS DIE AL EEN OORDEEL HEEFT. Pas met twee bestaande
     onderdelen valt er te vergelijken, en dan hoort een krap voornemen de reis
     aantoonbaar slechter te maken. Zonder dit stuk raakt geen enkele bewering
     de vergelijking zelf en zou `vergelijking` altijd 'niet-te-vergelijken'
     mogen teruggeven. */
  assert.equal((await post(base, '/api/member/vluchten/charter',
    { soort: 'privejet', bestemming: 'Ibiza', datum: d, tijd: '14:00' }, tok)).status, 200);
  const basis = await post(base, '/api/move/reis', {}, tok);
  assert.equal(basis.data.oordeel, 'RUIM', 'de reis van 08:00 naar 14:00 heeft lucht');

  const krap = await weeg('09:00');
  assert.equal(krap.data.oordeelZonder, 'RUIM', 'zonder het voornemen was de reis ruim');
  assert.equal(krap.data.oordeelMet, 'ONHAALBAAR', 'met het voornemen niet meer');
  assert.equal(krap.data.vergelijking, 'slechter', 'en dat is een verslechtering');

  const laat = await weeg('11:00');
  assert.equal(laat.data.vergelijking, 'gelijk', 'een ruim voornemen verandert het oordeel niet');

  /* EN HIJ WEIGERT NIETS. De boeking die het voornemen was, gaat gewoon door --
     dat Move hem ONHAALBAAR noemt, mag hem niet tegenhouden. */
  const alsnog = await post(base, '/api/booking/request',
    { supplierCode: 'SERENA', serviceId: 'w1', date: d, time: '09:00' }, tok);
  assert.equal(alsnog.status, 200, 'een krappe planning boeken blijft toegestaan');
});

test('een voornemen zonder plek of tijd levert geen oordeel', async (t) => {
  /* De faalvorm van deze laag: een groen oordeel over iets wat niet gemeten is.
     Zonder plek hoort er `null` te staan en 0% dekking -- niet RUIM. */
  const { child, base } = await startServer({ env: { SMTP_URL: '', NODE_ENV: 'test', RTG_DEMO: '1' } });
  t.after(() => stop(child));

  const u = Date.now().toString().slice(-8) + Math.floor(Math.random() * 90 + 10);
  const reg = await post(base, '/api/auth/register', { name: 'Proeflid', email: 'mvw' + u + '@voorbeeld.nl',
    phone: '06' + u.slice(0, 8), password: 'geheim12345', geboortedatum: '1985-05-05', tier: 'rtg' });
  const tok = reg.data && reg.data.token;

  /* EN DE DUUR-FOUT, HIER GEMETEN EN NIET IN DE PURE TOETS. `tijdenVan()` woont
     in kern/move/index.js achter een fabriek met de hele kern erin, dus alleen
     langs een echte server valt te zien wat hij doet. Een charter kent geen
     duur, dus is er geen moment waarop je weg kunt: de naad ERNA hoort
     NIET_TE_BEPALEN te zijn met `tijd-van` in de mist-lijst.

     Vóór de reparatie werd `Number(null)` nul en gaf deze naad "50 min
     beschikbaar, 17 nodig -- RUIM": een verzonnen marge met een compleet
     ogende onderbouwing. Een pure toets op naad() ziet dat NIET, want die
     krijgt zijn klaarAt al meegegeven -- dat is met een mutatie nagemeten. */
  const d2 = morgen();
  assert.equal((await post(base, '/api/member/vluchten/charter',
    { soort: 'privejet', bestemming: 'Ibiza', datum: d2, tijd: '18:10' }, tok)).status, 200);
  const na = await post(base, '/api/move/vooraf',
    { titel: 'Diner', soort: 'afspraak', plek: { zaak: 'KAITO' }, dag: d2, uur: '19:00', duurMin: 90 }, tok);
  assert.equal(na.status, 200);
  const naadNaVlucht = na.data.naden.find(n => n.van && n.van.soort === 'charter');
  assert.ok(naadNaVlucht, 'de naad na de charter staat erbij');
  assert.equal(naadNaVlucht.uitkomst, 'NIET_TE_BEPALEN',
    'na een vlucht weet niemand wanneer je het vliegveld uit bent');
  assert.ok(naadNaVlucht.mist.includes('tijd-van'), 'en de reden staat erbij');
  assert.equal(naadNaVlucht.beschikbaarMin, undefined, 'er staat geen verzonnen marge');
  assert.equal(na.data.oordeelMet, null, 'en dus geen oordeel over deze reis');

  const kaal = await post(base, '/api/move/vooraf', { titel: 'Iets', dag: morgen(), uur: '19:00' }, tok);
  assert.equal(kaal.status, 200);
  assert.equal(kaal.data.oordeelMet, null, 'geen plek, geen oordeel');
  assert.equal(kaal.data.vergelijking, 'niet-te-vergelijken',
    'en er staat geen "niet slechter" waar er niets is vergeleken');
  assert.match(String(kaal.data.grens), /u beslist/, 'de grens zegt dat Move niets tegenhoudt');
});
