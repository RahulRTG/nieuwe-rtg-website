/* ============================================================================
   DE GEZINSDEUR VAN HET LABFONDS -- wie komt er door, en wat doet een TWEEDE
   aanroep.

   WAAROM DEZE TOETS BESTAAT. routes/labfonds.js heeft er acht routes bij
   gekregen op /api/rtf/labfonds/*, zodat een gezin bij het fonds van de
   RTFoundation kan waar tot 14 september 2026 alleen een RTG-LID bij kon. Een
   nieuwe schrijfroute zonder uitspraak over herhaling landt in
   MUTATIECONTRACT.json als LEGACY_PENDING_CLASSIFICATION -- de enige stand daar
   die naar nul moet. Deze toets is de MEETRONDE onder die uitspraak: wat hier
   staat, staat in server/lib/mutatiecontracten-rtflabfonds.js als contract.

   HIJ MEET EN HIJ HOOPT NIET. Elke bewering hieronder is een waarneming tegen
   een echte server: twee keer dezelfde aanroep, en daarna kijken wat er in het
   grootboek staat. Waar het antwoord "hij telt gewoon op" is, staat dat er zo
   in -- een tweede toezegging IS een tweede toezegging, en dat is geen gebrek
   maar de bedoeling (MUTATIECONTRACT.md: een route die met opzet een tweede
   handeling uitvoert, is klaar zodra dat vaststaat en bewezen is).
   ========================================================================== */
'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');
const os = require('os');
const { startServer, stop } = require('./helper');

/* EEN SERVER VOOR ALLE TOETSEN, en de isolatie zit in de GEGEVENS.

   De eerste opzet startte er een per toets: acht servers, vijfentwintig
   seconden, en in de mutatiemotor loopt dat volledig uit de hand. Toch is
   "gewoon delen" niet vanzelf goed -- test/afbouwketen.test.js liet zien wat
   gedeelde staat tussen toetsen aanricht. Daarom deelt dit bestand alleen de
   SERVER en niets anders: elke toets maakt zijn eigen gezin (eigen code, eigen
   handles) en zijn eigen locatie (eigen naam, dus een eigen id en een eigen
   pot). Twee toetsen kunnen elkaars grootboek niet raken, ook niet als ze door
   elkaar zouden lopen. */
let SRV = null;
test.before(async () => {
  const TMP = fs.mkdtempSync(path.join(os.tmpdir(), 'rtg-rtflabfonds-'));
  SRV = await startServer({ env: { SMTP_URL: '', RTG_DATA_DIR: TMP,
    NODE_ENV: 'test', RTG_DEMO: '1' } });
});
test.after(async () => { if (SRV) await stop(SRV.child); });

const roep = async (base, pad, lijf) => {
  const r = await fetch(base + pad, { method: 'POST',
    headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(lijf || {}) });
  return { status: r.status, d: await r.json().catch(() => ({})) };
};
const metTok = async (base, pad, lijf, token) => {
  const r = await fetch(base + pad, { method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + token },
    body: JSON.stringify(lijf || {}) });
  return { status: r.status, d: await r.json().catch(() => ({})) };
};

/* EEN EIGEN STAD PER TOETS, EN EEN GEDEELD GEZIN -- en die tweede helft is een
   geleerde les. De eerste opzet maakte per toets een nieuw gezin, en bij de
   tiende sloeg /api/foundation/gezin/maak om naar 429: "hooguit 8 nieuwe
   gezinnen per adres per half uur" (server/foundation/gezin.js). Dat is geen
   toeval dat je een keer treft maar een plafond dat elke volgende toets in dit
   bestand zou raken -- en het zou zich melden als een raadselachtige flake bij
   wie er de elfde toets bij zet.

   Delen mag hier, omdat de isolatie NIET van het gezin komt maar van de STAD:
   elke toets krijgt een eigen locatie-id, dus een eigen pot en een eigen
   `mijnBijdrage`. Wie een toets toevoegt die WEL twee gezinnen nodig heeft,
   gebruikt `eigenGezin()` hieronder -- en let dan op datzelfde plafond. */
let teller = 0;
let GEDEELD = null;

async function eigenGezin(base, nr) {
  const g = await roep(base, '/api/foundation/gezin/maak', { gezinsnaam: 'Proefgezin' + nr,
    naam: 'Papa', pin: '1234', bevoegdGezin: true, privacyAkkoord: true });
  assert.ok(g.d && g.d.token,
    'geen gezin kunnen maken (' + g.status + ' ' + JSON.stringify(g.d).slice(0, 140) + ')');
  return { code: g.d.code, token: g.d.token };
}

async function wereld() {
  const base = SRV.base;
  const nr = ++teller;
  if (!GEDEELD) GEDEELD = await eigenGezin(base, 'gedeeld');
  return { base, stad: 'Proefstad' + nr, locId: 'proefstad' + nr, nr, gez: GEDEELD };
}

test('1. de deur laat een gezinsprofiel binnen en een vreemde niet', async () => {
  const w = await wereld();
  {
    const open = await roep(w.base, '/api/rtf/labfonds/overzicht', w.gez);
    assert.equal(open.status, 200, 'een gezinsprofiel hoort het fonds te kunnen lezen');

    assert.equal((await roep(w.base, '/api/rtf/labfonds/overzicht', {})).status, 403,
      'zonder gezinscode hoort de deur dicht te zijn');
    /* EEN ECHTE CODE MET EEN VERZONNEN TOKEN, en dat is het geval dat ertoe
       doet: de gezinscode staat op briefjes en in adresbalken, het TOKEN is
       het geheim. Wie hier doorkomt, komt met een geraden code binnen. */
    assert.equal((await roep(w.base, '/api/rtf/labfonds/overzicht',
      { code: w.gez.code, token: 'niet-mijn-token' })).status, 403,
      'een vreemd token bij een echte gezinscode hoort geweigerd te worden');
  }
});

test('2. het gezin en het lid houden ieder hun eigen bijdrage in hetzelfde grootboek', async () => {
  const w = await wereld();
  {
    await roep(w.base, '/api/rtf/labfonds/locatie/maak', { ...w.gez, naam: w.stad, land: 'NL' });
    const lid = await roep(w.base, '/api/login', { tier: 'rtg' });
    assert.ok(lid.d.token, 'geen lid kunnen inloggen');

    const a = await roep(w.base, '/api/rtf/labfonds/doneer', { ...w.gez, locId: w.locId, bedrag: 25 });
    const b = await metTok(w.base, '/api/labfonds/doneer', { locId: w.locId, bedrag: 40 }, lid.d.token);
    assert.equal(a.status, 200);
    assert.equal(b.status, 200);

    const na = await roep(w.base, '/api/rtf/labfonds/overzicht', w.gez);
    const loc = (na.d.locaties || []).find((l) => l.id === w.locId);
    assert.ok(loc, 'de locatie staat niet in het overzicht');
    assert.equal(loc.mijnBijdrage, 25, 'het gezinsprofiel hoort ALLEEN zijn eigen 25 te zien');
    assert.equal(loc.pot, 65, 'de pot hoort beide toezeggingen te dragen');

    /* DE DRAGENDE BEWERING VAN DEZE DEUR, en die staat of valt met een TWEEDE
       PROFIEL in HETZELFDE gezin. De sleutel in het grootboek is de HANDLE
       (`rtf:CODE:pid`) en niet de gezinscode. Met de gezinscode als sleutel
       klopt alles hierboven namelijk nog steeds -- binnen een gezin is die
       even uniek -- en pas hier valt het om: twee mensen uit hetzelfde gezin
       zouden dan elkaars toezegging als de hunne zien staan. Dit is met een
       mutatie nagetrokken: de handle vervangen door req.body.code laat alleen
       DEZE bewering zakken. */
    const tweede = await roep(w.base, '/api/foundation/gezin/profiel/maak',
      { code: w.gez.code, token: w.gez.token, naam: 'Mama', rol: 'ouder' });
    assert.equal(tweede.status, 200, 'geen tweede profiel kunnen maken: ' + JSON.stringify(tweede.d).slice(0, 140));
    const pid = (tweede.d.profiel || {}).id;
    assert.ok(pid, 'het tweede profiel heeft geen id');
    /* HET TOKEN KOMT UIT DE INLOG EN NIET UIT HET AANMAKEN, en dat is geen
       omweg maar de bedoeling: pubProfiel() geeft het token met opzet niet
       terug. Een beheerder die een profiel aanmaakt, krijgt dus niet meteen de
       sleutel van dat profiel in handen. */
    const kies = await roep(w.base, '/api/foundation/gezin/profiel/kies',
      { code: w.gez.code, token: w.gez.token, profielId: pid });
    assert.equal(kies.status, 200, 'het tweede profiel kon niet inloggen: ' + JSON.stringify(kies.d).slice(0, 140));
    const ptok = kies.d.token || (kies.d.profiel || {}).token;
    assert.ok(ptok, 'de profielinlog levert geen eigen token op');
    assert.notEqual(ptok, w.gez.token, 'het tweede profiel hoort een EIGEN token te hebben');

    const gez2 = { code: w.gez.code, token: ptok };
    await roep(w.base, '/api/rtf/labfonds/doneer', { ...gez2, locId: w.locId, bedrag: 5 });
    const mijn1 = await roep(w.base, '/api/rtf/labfonds/overzicht', w.gez);
    const mijn2 = await roep(w.base, '/api/rtf/labfonds/overzicht', gez2);
    const bij = (r) => ((r.d.locaties || []).find((l) => l.id === w.locId) || {}).mijnBijdrage;
    assert.equal(bij(mijn1), 25, 'het eerste profiel hoort zijn eigen 25 te houden');
    assert.equal(bij(mijn2), 5, 'het tweede profiel hoort zijn eigen 5 te zien en niet de 30 van het gezin');
  }
});

test('3. een tweede toezegging is een TWEEDE toezegging, en dat is de bedoeling', async () => {
  const w = await wereld();
  {
    await roep(w.base, '/api/rtf/labfonds/locatie/maak', { ...w.gez, naam: w.stad, land: 'NL' });
    const een = await roep(w.base, '/api/rtf/labfonds/doneer', { ...w.gez, locId: w.locId, bedrag: 10 });
    const twee = await roep(w.base, '/api/rtf/labfonds/doneer', { ...w.gez, locId: w.locId, bedrag: 10 });
    assert.equal(een.status, 200);
    assert.equal(twee.status, 200);
    /* GEEN IDEMPOTENTIE, EN DAT IS GEEN GEBREK. Twee keer tien euro toezeggen
       is twintig euro toezeggen; een fonds dat de tweede zou negeren, verliest
       een echte toezegging. Dit staat zo in het contract, zodat niemand later
       een "bug" repareert die een besluit is. */
    const na = await roep(w.base, '/api/rtf/labfonds/overzicht', w.gez);
    const loc = (na.d.locaties || []).find((l) => l.id === w.locId);
    assert.equal(loc.mijnBijdrage, 20, 'twee toezeggingen horen op te tellen');
  }
});

test('4. een locatie twee keer aanmaken levert er niet twee op', async () => {
  const w = await wereld();
  {
    const een = await roep(w.base, '/api/rtf/labfonds/locatie/maak', { ...w.gez, naam: w.stad, land: 'NL' });
    const twee = await roep(w.base, '/api/rtf/labfonds/locatie/maak', { ...w.gez, naam: w.stad, land: 'NL' });
    assert.equal(een.status, 200);
    const na = await roep(w.base, '/api/rtf/labfonds/overzicht', w.gez);
    const hoeveel = (na.d.locaties || []).filter((l) => l.id === w.locId).length;
    assert.equal(hoeveel, 1, 'dezelfde locatie hoort er maar EEN keer te staan (status tweede: ' + twee.status + ')');
  }
});

test('5. de leesroutes veranderen niets, hoe vaak je ze ook aanroept', async () => {
  const w = await wereld();
  {
    await roep(w.base, '/api/rtf/labfonds/locatie/maak', { ...w.gez, naam: w.stad, land: 'NL' });
    await roep(w.base, '/api/rtf/labfonds/doneer', { ...w.gez, locId: w.locId, bedrag: 15 });
    const voor = await roep(w.base, '/api/rtf/labfonds/overzicht', w.gez);
    for (let i = 0; i < 3; i++) {
      await roep(w.base, '/api/rtf/labfonds/overzicht', w.gez);
      await roep(w.base, '/api/rtf/labfonds/financiering', { ...w.gez, onderzoek: 'bestaat-niet' });
      await roep(w.base, '/api/rtf/labfonds/scheidsrechter', { ...w.gez, id: 'bestaat-niet' });
    }
    const na = await roep(w.base, '/api/rtf/labfonds/overzicht', w.gez);
    const pot = (l) => ((l.d.locaties || []).find((x) => x.id === w.locId) || {}).pot;
    assert.equal(pot(na), pot(voor), 'een leesronde hoort het fonds niet te bewegen');
  }
});

test('7. voorstel, stem en beslis: elk een ANDER antwoord op een tweede aanroep', async () => {
  const w = await wereld();
  {
    await roep(w.base, '/api/rtf/labfonds/locatie/maak', { ...w.gez, naam: w.stad, land: 'NL' });
    await roep(w.base, '/api/rtf/labfonds/doneer', { ...w.gez, locId: w.locId, bedrag: 500 });
    const voorstel = { ...w.gez, locId: w.locId, titel: 'Luchtmeting',
      doel: 'fijnstof meten in de wijk', bedrag: 100 };

    /* VOORSTEL: een tweede identiek voorstel is een TWEEDE voorstel, met een
       eigen id. Dat is een besluit en geen slordigheid -- twee buren mogen
       hetzelfde willen, en samenvoegen zou de tweede zijn stem afnemen. */
    const v1 = await roep(w.base, '/api/rtf/labfonds/voorstel/maak', voorstel);
    const v2 = await roep(w.base, '/api/rtf/labfonds/voorstel/maak', voorstel);
    assert.equal(v1.status, 200);
    assert.equal(v2.status, 200);
    assert.notEqual(v1.d.voorstel.id, v2.d.voorstel.id, 'het tweede voorstel hoort een eigen id te krijgen');

    const na = await roep(w.base, '/api/rtf/labfonds/overzicht', w.gez);
    assert.equal((na.d.voorstellen || []).filter((x) => x.titel === 'Luchtmeting').length, 2,
      'twee keer indienen hoort twee voorstellen op te leveren');

    /* DE INDIENER STAAT ER ALS CODENAAM. Geen echte naam, aan geen van beide
       deuren -- de kluis blijft waar hij hoort. */
    assert.ok(v1.d.voorstel.door && !/Papa/.test(v1.d.voorstel.door),
      'de indiener hoort een codenaam te zijn en niet de opgegeven naam');

    /* STEM: tweemaal dezelfde stem blijft EEN stem. Wie het vaakst klikt, stemt
       hier niet het hardst. */
    const id = v1.d.voorstel.id;
    const s1 = await roep(w.base, '/api/rtf/labfonds/stem', { ...w.gez, id, keuze: 'voor' });
    const s2 = await roep(w.base, '/api/rtf/labfonds/stem', { ...w.gez, id, keuze: 'voor' });
    assert.equal(s1.status, 200);
    assert.equal(s2.status, 200);
    assert.equal(s2.d.voorstel.voor, 1, 'dezelfde stem twee keer hoort EEN stem te blijven');
    assert.equal(s2.d.voorstel.tegen, 0);

    /* BESLIS: de tweede aanroep wordt GEWEIGERD met 409. Dat is een
       toestandscontrole en geen idempotentie, en die twee worden in het
       contract nooit op een hoop gegooid (MUTATIECONTRACT.md). */
    const b1 = await roep(w.base, '/api/rtf/labfonds/beslis', { ...w.gez, id });
    const b2 = await roep(w.base, '/api/rtf/labfonds/beslis', { ...w.gez, id });
    assert.equal(b1.status, 200, 'beslissen hoort te lukken');
    assert.equal(b2.status, 409, 'een tweede besluit hoort geweigerd te worden');
    assert.match(String(b2.d.error || ''), /al beslist/i, 'en te zeggen waarom');
  }
});

test('8. een kindprofiel mag kijken maar niet toezeggen of stemmen', async () => {
  const w = await wereld();
  {
    await roep(w.base, '/api/rtf/labfonds/locatie/maak', { ...w.gez, naam: w.stad, land: 'NL' });
    const kind = await roep(w.base, '/api/foundation/gezin/profiel/maak',
      { code: w.gez.code, token: w.gez.token, naam: 'Kind', rol: 'kind' });
    assert.equal(kind.status, 200, 'geen kindprofiel kunnen maken');
    const kies = await roep(w.base, '/api/foundation/gezin/profiel/kies',
      { code: w.gez.code, token: w.gez.token, profielId: kind.d.profiel.id });
    assert.equal(kies.status, 200);
    const kid = { code: w.gez.code, token: kies.d.token };

    /* KIJKEN MAG. Wie een kind zijn eigen fonds niet laat zien, velt een
       oordeel over wie zijn eigen mogelijkheden mag kennen -- FOUNDATION.md
       par. 5. */
    assert.equal((await roep(w.base, '/api/rtf/labfonds/overzicht', kid)).status, 200,
      'een kindprofiel hoort het fonds te kunnen lezen');

    /* TOEZEGGEN EN STEMMEN NIET, en de weigering zegt waarom. */
    const don = await roep(w.base, '/api/rtf/labfonds/doneer', { ...kid, locId: w.locId, bedrag: 5 });
    assert.equal(don.status, 403, 'een kindprofiel hoort niet te kunnen toezeggen');
    assert.match(String(don.d.error || ''), /volwassene/i, 'en de weigering hoort te zeggen waarom');
    assert.equal((await roep(w.base, '/api/rtf/labfonds/stem',
      { ...kid, id: 'wat-dan-ook', keuze: 'voor' })).status, 403,
      'een kindprofiel hoort niet te kunnen stemmen');

    /* EN ER IS NIETS GEBEURD. Een geweigerde toezegging hoort geen spoor in het
       grootboek te laten -- anders staat er een bedrag dat niemand heeft gedaan. */
    const na = await roep(w.base, '/api/rtf/labfonds/overzicht', w.gez);
    const loc = (na.d.locaties || []).find((l) => l.id === w.locId) || {};
    assert.equal(loc.pot || 0, 0, 'een geweigerde toezegging hoort de pot niet te raken');
  }
});

test('9. een gastprofiel komt de deur niet door, ook niet om te kijken', async () => {
  const w = await wereld();
  {
    const gast = await roep(w.base, '/api/foundation/gezin/profiel/maak',
      { code: w.gez.code, token: w.gez.token, naam: 'Oppas', rol: 'gast' });
    assert.equal(gast.status, 200, 'geen gastprofiel kunnen maken');
    const kies = await roep(w.base, '/api/foundation/gezin/profiel/kies',
      { code: w.gez.code, token: w.gez.token, profielId: gast.d.profiel.id });
    assert.equal(kies.status, 200);
    const gtok = { code: w.gez.code, token: kies.d.token };

    /* DE POORT HEET `gezinsPoort` EN DAT CONTRACT STAAT VERKLAARD in
       server/kern/handlerpoorten/buiten.js: gezinscode plus profieltoken, met
       gasten eruit. Hier wordt dat afgedwongen in plaats van beloofd -- zonder
       deze toets overleeft een mutatie die de gastregel weghaalt gewoon, en dan
       kijkt de oppas mee in het geld van het gezin. server/foundation/
       gezinshulp.js zegt bij isGast met zoveel woorden dat een gast niet bij de
       privezaken hoort, en geld is daar het eerste voorbeeld van. */
    const lees = await roep(w.base, '/api/rtf/labfonds/overzicht', gtok);
    assert.equal(lees.status, 403, 'een gastprofiel hoort het fonds niet te kunnen lezen');
    assert.match(String(lees.d.error || ''), /gezinsleden zelf/i, 'en de weigering hoort te zeggen waarom');

    await roep(w.base, '/api/rtf/labfonds/locatie/maak', { ...w.gez, naam: w.stad, land: 'NL' });
    const don = await roep(w.base, '/api/rtf/labfonds/doneer', { ...gtok, locId: w.locId, bedrag: 5 });
    assert.equal(don.status, 403, 'een gastprofiel hoort niet te kunnen toezeggen');
    const na = await roep(w.base, '/api/rtf/labfonds/overzicht', w.gez);
    const loc = (na.d.locaties || []).find((l) => l.id === w.locId) || {};
    assert.equal(loc.pot || 0, 0, 'een geweigerde gast hoort de pot niet te raken');
  }
});

test('10. twee GEZINNEN delen de pot, maar niet hun eigen bijdrage', async () => {
  const a = await wereld();
  /* DEZE toets heeft er wel twee nodig: de vraag IS of twee gezinnen elkaars
     bijdrage zien. Hij maakt daarom een tweede gezin naast het gedeelde -- twee
     aanmaakacties in het hele bestand, ruim onder het plafond van acht. */
  const b = { base: a.base, stad: a.stad, locId: a.locId,
    gez: await eigenGezin(a.base, 'tweede') };
  {
    /* DE VRAAG DIE DE GLUURRONDE STELT, en die deze deur moet kunnen
       beantwoorden. `scripts/gluurronde.js` geeft A en B allebei een EIGEN
       gezin en laat A daarna met zijn eigen gezin lezen wat B heeft
       aangemaakt. Op deze route ziet A dan inderdaad iets van B -- en dat is
       geen lek maar het fonds: een locatie is openbaar, leden doneren eraan en
       stemmen erover (dezelfde reden waarom /api/labfonds/locatie/maak al in
       GEDEELD_BEDOELD staat). Wat NIET gedeeld mag worden, staat hieronder, en
       zonder deze toets is die vrijstelling een belofte in plaats van een
       grens. */
    await roep(a.base, '/api/rtf/labfonds/locatie/maak', { ...a.gez, naam: a.stad, land: 'NL' });
    await roep(a.base, '/api/rtf/labfonds/doneer', { ...a.gez, locId: a.locId, bedrag: 100 });
    await roep(b.base, '/api/rtf/labfonds/doneer', { ...b.gez, locId: a.locId, bedrag: 7 });

    const zA = await roep(a.base, '/api/rtf/labfonds/overzicht', a.gez);
    const zB = await roep(b.base, '/api/rtf/labfonds/overzicht', b.gez);
    const loc = (r) => ((r.d.locaties || []).find((l) => l.id === a.locId) || {});

    assert.equal(loc(zA).pot, 107, 'de POT is van het fonds en hoort gedeeld te zijn');
    assert.equal(loc(zB).pot, 107, 'beide gezinnen horen dezelfde pot te zien');
    assert.equal(loc(zA).mijnBijdrage, 100, 'gezin A hoort alleen zijn eigen 100 te zien');
    assert.equal(loc(zB).mijnBijdrage, 7, 'gezin B hoort alleen zijn eigen 7 te zien');

    /* EN ER GAAT GEEN GELOOFSBRIEF MEE. Een gedeeld grootboek mag de pot tonen
       en nooit de sleutel waarmee een ander binnenkomt. */
    const tekst = JSON.stringify(zA.d);
    assert.ok(!tekst.includes(b.gez.code), 'de gezinscode van B hoort niet in het antwoord van A te staan');
    assert.ok(!tekst.includes(b.gez.token), 'het token van B hoort al helemaal niet in het antwoord van A te staan');

    /* MEESTEMMEN MAG, AFHAMEREN NIET. Dat onderscheid is de grens die telt:
       zonder hem zou "openbaar fonds" betekenen dat een vreemde de stemming van
       een ander kan sluiten. */
    const v = await roep(b.base, '/api/rtf/labfonds/voorstel/maak',
      { ...b.gez, locId: a.locId, titel: 'Voorstel van B', doel: 'iets nuttigs in de wijk', bedrag: 50 });
    assert.equal(v.status, 200);
    const id = v.d.voorstel.id;
    assert.equal((await roep(a.base, '/api/rtf/labfonds/stem', { ...a.gez, id, keuze: 'tegen' })).status, 200,
      'meestemmen over een voorstel van een ander hoort te mogen -- dat IS een fonds');
    const dicht = await roep(a.base, '/api/rtf/labfonds/beslis', { ...a.gez, id });
    assert.equal(dicht.status, 403, 'de stemming sluiten hoort alleen de indiener te mogen');
    assert.match(String(dicht.d.error || ''), /indiende/i, 'en de weigering hoort te zeggen waarom');
  }
});

test('6. de beloofde poort staat er ook echt, als middleware en niet in de handler', () => {
  const bron = fs.readFileSync(path.join(__dirname, '..', 'server', 'routes', 'labfonds.js'), 'utf8');
  const regels = bron.split('\n').filter((r) => /app\.post\('\/api\/rtf\/labfonds/.test(r));
  assert.equal(regels.length, 8, 'er horen acht gezinsroutes te staan');
  for (const r of regels) {
    assert.match(r, /gezinsPoort/, 'elke gezinsroute hoort gezinsPoort als middleware te dragen: ' + r.trim());
  }
  /* DE VOLWASSEN-EIS STAAT OP VIJF ROUTES EN OP DE ANDERE DRIE NIET, en dat is
     het besluit: toezeggen, voorstellen, stemmen, beslissen en een locatie
     aanmaken doet een volwassene; kijken mag elk gezinslid. Zou deze telling
     stil naar acht kruipen, dan is de leeskant dichtgezet zonder dat iemand dat
     heeft gekozen; kruipt hij naar nul, dan kan een kind over onderzoeksgeld
     stemmen. Allebei zakt hier. */
  const metVolwassen = regels.filter((r) => /nietBeschermd/.test(r));
  assert.equal(metVolwassen.length, 5,
    'vijf gezinsroutes horen een volwassen profiel te eisen, niet ' + metVolwassen.length);
  for (const naam of ['locatie/maak', 'doneer', 'voorstel/maak', 'stem', 'beslis']) {
    assert.ok(metVolwassen.some((r) => r.includes('/api/rtf/labfonds/' + naam)),
      naam + ' hoort een volwassen profiel te eisen');
  }
});
