/* DE ISOLATIEMODUS VAN EEN LID -- end-to-end, tegen een draaiende server.

   WAT DEZE TOETS BEWIJST, en de tweede is verreweg de belangrijkste:

   1. een lid kan zichzelf, deze sessie of dit toestel strenger zetten, en dat
      werkt meteen door in wat hij nog mag;
   2. hij kan dat NIET voor iemand anders. De sleutel komt uit de sessie, en er
      is geen pad waarlangs er een uit het verzoek binnenkomt. Zonder die regel
      is "bescherm mij" in werkelijkheid een uitlogknop voor willekeurige leden;
   3. verlagen loopt ook voor een lid langs de ceremonie -- juist bij een lid is
      het scenario dat zij moet vangen (iemand heeft de sessie overgenomen en zet
      de bescherming weer uit) het meest waarschijnlijk;
   4. een lid kan de ceremonie van een ANDER lid niet aftekenen, en krijgt
      daarop hetzelfde antwoord als op een nummer dat niet bestaat -- anders is
      de foutmelding zelf een manier om te ontdekken wie er in isolatie staat;
   5. `huis` en `organisatie` staan niet open voor een lid.

   MUTATIES die zijn gedraaid en welke toets erop zakte (LAT.md regel 2):
   - laagOf() de sleutel uit req.body laten halen  -> 2 ZAKT (RAAK).
   - EIGEN_LAGEN uitbreiden met "huis"             -> 5 ZAKT (RAAK).
   - mijnVerzoek() de eigendomscontrole eruit      -> 4 ZAKT (RAAK).
   - de verlagingscontrole uit zet() in de kern    -> 3 ZAKT (RAAK).

   TOETS 2 VING DIE EERSTE MUTATIE TWEE KEER NIET, en dat hoort hier te staan
   omdat het de reden is dat hij nu is zoals hij is:

   1. hij stuurde een VERZONNEN sleutel mee (`cn-a`). Met het gat open schreef de
      route die netjes weg -- naar een sleutel die niemand is. A bewoog niet, dus
      de toets bleef groen. Nu haalt B de ECHTE sleutel van A op, langs dezelfde
      weg als een aanvaller: uit iets wat het slachtoffer zelf heeft laten zien.
   2. daarna zette A zichzelf meteen op `isolatie`. Elke poging van B ketste toen
      af op de VERLAGINGScontrole in plaats van op de sleutelcontrole -- de toets
      mat de verkeerde grens en bleef opnieuw groen. A staat nu op `beschermd`,
      zodat B moet VERSTRENGEN en de sleutelcontrole de enige is die hem stopt.

   Een toets die een gat niet vindt terwijl hij er precies voor is geschreven, is
   de gevaarlijkste soort: hij geeft dekking zonder te dekken.

   Draai los: node --test test/isolatie-lid.test.js */
'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const { startServer, stop } = require('./helper');

let srv;
function api(pad, body, token) {
  const headers = { 'Content-Type': 'application/json' };
  if (token) headers.Authorization = 'Bearer ' + token;
  return fetch(srv.base + pad, { method: 'POST', headers, body: JSON.stringify(body || {}) })
    .then(async r => ({ status: r.status, body: await r.json().catch(() => ({})) }));
}
async function nieuwLid() {
  const u = Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
  const r = await api('/api/auth/register', {
    name: 'Isolatie Lid', email: u + '@x.nl',
    phone: '06' + u.replace(/\D/g, '').padEnd(8, '1').slice(0, 8),
    password: 'geheim123', geboortedatum: '1990-01-01', tier: 'business', pasApp: 'business'
  });
  assert.ok(r.body.token, 'lid geregistreerd: ' + JSON.stringify(r.body).slice(0, 200));
  return r.body.token;
}

test.before(async () => { srv = await startServer({ env: { SMTP_URL: '', RTG_OWNER_EMAIL: 'lid-poort-eigenaar@x.nl' } }); });
test.after(() => stop(srv && srv.child));

test('1. een lid zet zijn eigen stand, en dat werkt meteen door', async () => {
  const lid = await nieuwLid();
  const voor = await api('/api/isolatie/mijn', {}, lid);
  assert.equal(voor.status, 200, JSON.stringify(voor.body));
  assert.equal(voor.body.mijn.identiteit, 'normaal');

  const zet = await api('/api/isolatie/mijn/zet',
    { drager: 'identiteit', naar: 'beschermd', reden: 'Ik kreeg een vreemde inlogmelding' }, lid);
  assert.equal(zet.status, 200, JSON.stringify(zet.body));
  assert.equal(zet.body.uit.richting, 'verstrengd');

  const na = await api('/api/isolatie/mijn', {}, lid);
  assert.equal(na.body.mijn.identiteit, 'beschermd');
  assert.equal(na.body.effectief.beschermd, true);

  /* Verstrengen mag zonder ceremonie; nog strenger ook. */
  const strenger = await api('/api/isolatie/mijn/zet',
    { drager: 'identiteit', naar: 'isolatie', reden: 'Het wordt erger, alles dicht' }, lid);
  assert.equal(strenger.status, 200, JSON.stringify(strenger.body));
});

test('2. de sleutel komt uit de sessie: een lid raakt een ander lid niet', async () => {
  const a = await nieuwLid();
  const b = await nieuwLid();

  /* A gaat naar `beschermd` en niet meteen naar `isolatie`. Dat is geen detail:
     `zet` weigert elke VERLAGING, dus als A al op het strengste stond, zou elke
     poging van B afketsen op de verlagingscontrole in plaats van op de
     sleutelcontrole -- en dan meet deze toets de verkeerde grens. B probeert dus
     te VERSTRENGEN, want dat is de weg die openstaat. */
  await api('/api/isolatie/mijn/zet',
    { drager: 'identiteit', naar: 'beschermd', reden: 'Ik vertrouw het niet' }, a);

  /* DE ECHTE SLEUTEL VAN A, EN NIET EEN VERZONNEN STRING.

     De eerste versie van deze toets stuurde `cn-a` mee en zag daarna dat A niet
     bewoog. Hij liet zich niet zakken toen de route de sleutel WEL uit het lijf
     ging halen -- want `cn-a` bestaat niet, dus er gebeurde ook dan niets bij A.
     Een toets die een gat niet vindt terwijl hij er precies voor is geschreven,
     is de gevaarlijkste soort: hij geeft dekking zonder te dekken.

     B moet dus de WERKELIJKE sleutel van A meesturen. A haalt hem hier uit zijn
     eigen ontsluitverzoek -- dat is ook precies hoe een aanvaller eraan zou
     komen: uit iets wat het slachtoffer zelf heeft laten zien. */
  const vA = await api('/api/isolatie/mijn/ontsluiting',
    { drager: 'identiteit', naar: 'normaal', reden: 'Toestel opnieuw geverifieerd' }, a);
  const sleutelVanA = vA.body.verzoek.sleutel;
  assert.ok(sleutelVanA, 'de sleutel van A is bekend: ' + JSON.stringify(vA.body).slice(0, 200));

  /* B stuurt hem mee onder elke naam waaronder een route hem zou kunnen lezen.
     Geen ervan mag ergens landen behalve op de EIGEN laag van B. */
  for (const veld of ['sleutel', 'identiteit', 'key', 'lid', 'codenaam']) {
    const lijf = { drager: 'identiteit', naar: 'isolatie', reden: 'Poging op andermans laag' };
    lijf[veld] = sleutelVanA;
    const r = await api('/api/isolatie/mijn/zet', lijf, b);
    if (r.status === 200) {
      assert.notEqual(r.body.uit.sleutel, sleutelVanA,
        'veld "' + veld + '" landde op de laag van A');
    }
  }

  /* En de proef op de som: de stand van A is niet veranderd, en B heeft alleen
     zijn eigen laag gezet. */
  const naA = await api('/api/isolatie/mijn', {}, a);
  const naB = await api('/api/isolatie/mijn', {}, b);
  assert.equal(naA.body.mijn.identiteit, 'beschermd', 'A is door B niet aangeraakt');
  assert.equal(naB.body.mijn.identiteit, 'isolatie', 'B zette wel zijn eigen laag');
});

test('3. verlagen loopt ook voor een lid langs de ceremonie', async () => {
  const lid = await nieuwLid();
  await api('/api/isolatie/mijn/zet',
    { drager: 'identiteit', naar: 'isolatie', reden: 'Ik vertrouw het niet meer' }, lid);

  const rechtstreeks = await api('/api/isolatie/mijn/zet',
    { drager: 'identiteit', naar: 'normaal', reden: 'Toch maar weer open' }, lid);
  assert.equal(rechtstreeks.status, 409, JSON.stringify(rechtstreeks.body));
  assert.match(rechtstreeks.body.error, /verlaagt de beveiliging/);

  const v = await api('/api/isolatie/mijn/ontsluiting',
    { drager: 'identiteit', naar: 'normaal', reden: 'Nieuw toestel, opnieuw geverifieerd' }, lid);
  assert.equal(v.status, 200, JSON.stringify(v.body));
  const id = v.body.verzoek.id;

  /* Het verzoek verlaagt zelf niets. */
  assert.equal((await api('/api/isolatie/mijn', {}, lid)).body.mijn.identiteit, 'isolatie');

  const teVroeg = await api('/api/isolatie/mijn/ontsluiting/commit', { id }, lid);
  assert.equal(teVroeg.status, 409, JSON.stringify(teVroeg.body));

  /* DIT LID HEEFT GEEN PASSKEY, EN DAT WORDT HIER UITGESPROKEN.

     De lus hieronder loopt over `vereisten` en niet over een eigen lijst -- een
     toets die zijn stappen overtypt, merkt een verzwaring niet. Maar diezelfde
     vorm laat een WEGVAL ook niet merken: valt `passkey` weg, dan tekent de lus
     stilletjes een stap minder af en blijft groen. Vandaar deze vaststelling
     ervoor. Dat de eis wegvalt is met opzet (een eis die niemand kan halen sluit
     een mens buiten zijn eigen bescherming); dat het GEMERKT wordt, is de prijs.
     De passkey-weg zelf staat end-to-end in test/isolatie-passkey.test.js. */
  const gronden = (v.body.verzoek.noodGronden || []).map(g => g.grond);
  assert.deepEqual(gronden, ['geenPasskey'],
    'dit lid heeft geen passkey, dus de eis valt weg -- gemerkt en met grond: ' +
    JSON.stringify(v.body.verzoek.noodGronden));
  assert.ok(!v.body.verzoek.vereisten.includes('passkey'));

  for (const soort of v.body.verzoek.vereisten) {
    if (soort === 'reden' || soort === 'wachttijd') continue;
    const r = await api('/api/isolatie/mijn/ontsluiting/stap', { id, soort }, lid);
    assert.equal(r.status, 200, soort + ': ' + JSON.stringify(r.body));
  }

  /* De wachttijd van tien minuten is er nog, en die IS de grens. Dat de toets
     hier stopt in plaats van de klok te verzetten, is het punt: een ceremonie
     die een toets kan overslaan, kan een aanvaller ook overslaan. */
  const nogSteeds = await api('/api/isolatie/mijn/ontsluiting/commit', { id }, lid);
  assert.equal(nogSteeds.status, 409);
  assert.match(nogSteeds.body.error, /wachttijd/);
  assert.equal((await api('/api/isolatie/mijn', {}, lid)).body.mijn.identiteit, 'isolatie');
});

test('4. een lid kan de ceremonie van een ander niet aftekenen', async () => {
  const a = await nieuwLid();
  const b = await nieuwLid();
  await api('/api/isolatie/mijn/zet', { drager: 'identiteit', naar: 'isolatie', reden: 'Verdachte inlog' }, a);
  const v = await api('/api/isolatie/mijn/ontsluiting',
    { drager: 'identiteit', naar: 'normaal', reden: 'Toestel opnieuw geverifieerd' }, a);
  const id = v.body.verzoek.id;

  for (const pad of ['/api/isolatie/mijn/ontsluiting/stap', '/api/isolatie/mijn/ontsluiting/commit',
    '/api/isolatie/mijn/ontsluiting/afbreken']) {
    const r = await api(pad, { id, soort: 'passkey', reden: 'poging' }, b);
    assert.equal(r.status, 404, pad + ': ' + JSON.stringify(r.body));
    /* HETZELFDE ANTWOORD ALS OP EEN VERZONNEN NUMMER. Zou dit "geen toegang"
       zeggen en een verzonnen nummer "bestaat niet", dan is het verschil tussen
       die twee een manier om te ontdekken wie er in isolatie staat. */
    const verzonnen = await api(pad, { id: 'deadbeefdeadbeef', soort: 'passkey', reden: 'poging' }, b);
    assert.equal(verzonnen.body.error, r.body.error);
  }
});

test('5. huis en organisatie staan niet open voor een lid', async () => {
  const lid = await nieuwLid();
  for (const drager of ['huis', 'organisatie', 'verzonnen']) {
    const r = await api('/api/isolatie/mijn/zet',
      { drager, naar: 'isolatie', reden: 'Poging op een laag die niet van mij is' }, lid);
    assert.equal(r.status, 403, drager + ': ' + JSON.stringify(r.body));
    assert.match(r.body.error, /uw eigen lagen/);
  }
});

/* ---------------------------------------------------------------------------
   6. WAT EEN TWEEDE AANROEP DOET op de ledenroutes -- gemeten, niet aangenomen.

   Deze toets bestaat omdat server/lib/mutatiecontracten-isolatie.js ernaar
   verwijst. Hij vraagt de route twee keer hetzelfde en kijkt of het ANTWOORD en
   de STAND daarna gelijk zijn. Dat is een zwakkere meting dan de byte-voor-byte
   vergelijking in test/isolatie.test.js -- hier draait een echte server met een
   eigen database die ik niet kan uitlezen -- en het contract zegt dat er dus bij.
   ------------------------------------------------------------------------ */
test('6. een tweede aanroep op de ledenroutes', async () => {
  const lid = await nieuwLid();
  const zet = { drager: 'identiteit', naar: 'beschermd', reden: 'Ik kreeg een vreemde inlogmelding' };
  const een = await api('/api/isolatie/mijn/zet', zet, lid);
  const twee = await api('/api/isolatie/mijn/zet', zet, lid);
  assert.equal(een.status, 200);
  assert.equal(twee.status, 200, 'een herhaling hoort niet te struikelen');
  assert.equal(twee.body.uit.richting, 'ongewijzigd',
    'de tweede aanroep ziet dat de stand al klopt en doet niets');

  /* Een tweede ontsluitVERZOEK is met opzet een tweede verzoek: het weigeren zou
     betekenen dat een vergeten open verzoek de drager voorgoed vastzet. */
  const v1 = await api('/api/isolatie/mijn/ontsluiting',
    { drager: 'identiteit', naar: 'normaal', reden: 'Toestel opnieuw geverifieerd' }, lid);
  const v2 = await api('/api/isolatie/mijn/ontsluiting',
    { drager: 'identiteit', naar: 'normaal', reden: 'Toestel opnieuw geverifieerd' }, lid);
  assert.notEqual(v1.body.verzoek.id, v2.body.verzoek.id);

  /* Dezelfde stap twee keer aftekenen laat de EERSTE aftekening staan.

     GEMETEN OP `apparaat` EN NIET OP `passkey`, en dat is geen uitwijkmanoeuvre.
     Deze toets vraagt of een HERHALING iets verandert. Bij een passkey-stap is
     een woordelijke herhaling per ontwerp onmogelijk: de uitdaging is eenmalig,
     dus de tweede aanroep is een ANDERE aanroep en meet iets anders. `apparaat`
     is de stap waar de vraag wel gesteld kan worden. Dat de tweede passkey-poging
     met dezelfde assertie wordt geweigerd, staat als eigen bewering in
     test/isolatie-passkey.test.js toets 6. */
  const s1 = await api('/api/isolatie/mijn/ontsluiting/stap',
    { id: v1.body.verzoek.id, soort: 'apparaat' }, lid);
  const s2 = await api('/api/isolatie/mijn/ontsluiting/stap',
    { id: v1.body.verzoek.id, soort: 'apparaat' }, lid);
  assert.equal(s1.status, 200, JSON.stringify(s1.body).slice(0, 160));
  assert.equal(s2.status, 200);
  assert.deepEqual(s2.body.verzoek.voltooid.apparaat, s1.body.verzoek.voltooid.apparaat);

  /* Afbreken is hooguit eens: de tweede aanroep wordt geweigerd. */
  const a1 = await api('/api/isolatie/mijn/ontsluiting/afbreken', { id: v2.body.verzoek.id, reden: 'toch niet' }, lid);
  const a2 = await api('/api/isolatie/mijn/ontsluiting/afbreken', { id: v2.body.verzoek.id, reden: 'toch niet' }, lid);
  assert.equal(a1.status, 200);
  assert.equal(a2.status, 409);

  /* En het overzicht verandert niets. */
  const o1 = await api('/api/isolatie/mijn', {}, lid);
  const o2 = await api('/api/isolatie/mijn', {}, lid);
  assert.deepEqual(o1.body.mijn, o2.body.mijn);
});

/* ---------------------------------------------------------------------------
   7. HET SCHERM ZEGT WAT ER DAN NOG WERKT.

   Een lid dat overweegt zichzelf dicht te zetten, hoort te weten wat dat kost --
   en vóór hij drukt, niet erna. Dezelfde meter als op de cockpit van het kantoor
   en met opzet niet een tweede lijst: wie de knop niet durft in te drukken, wordt
   er niet door beschermd, en dat is precies waarom `bruikbaarheid` bestaat.
   ------------------------------------------------------------------------ */
test('7. het antwoord vertelt wat er onder elke stand nog werkt', async () => {
  const lid = await nieuwLid();
  const r = await api('/api/isolatie/mijn', {}, lid);
  assert.equal(r.status, 200);
  assert.ok(r.body.werktNog, 'het antwoord hoort te zeggen wat er nog werkt');
  for (const stand of ['beschermd', 'isolatie']) {
    const w = r.body.werktNog[stand];
    assert.ok(w, stand + ' hoort erin te staan');
    assert.ok(w.werkt > 0, 'er hoort onder ' + stand + ' iets te blijven werken');
    assert.deepEqual(w.belofteGezakt, [],
      'onder ' + stand + ' zakt een belofte: ' + JSON.stringify(w.belofteGezakt));
  }
  /* En de stand die niets sluit hoort er NIET in: een lid dat op normaal staat,
     heeft geen lijst nodig van wat er zou wegvallen als hij niets doet. */
  assert.ok(!r.body.werktNog.normaal);
});

/* ---------------------------------------------------------------------------
   8. HET SCHERM BELOOFT NIET MEER DAN DE CODE DOET.

   Het ledenscherm zei "dat werkt meteen". Dat was niet waar, en het is de
   duurste soort fout: een lid dat denkt dat hij beschermd is, gedraagt zich
   daarnaar. De per-drager-stand versmalt wél de lijst waaruit de AI kiest, maar
   middleware/functieschakelaars.js kijkt alleen naar de HUIS-modus -- een gewoon
   HTTP-verzoek van dit lid loopt vandaag gewoon door.

   De belofte is daarom vervangen door een GEMETEN veld. Deze toets houdt vast
   dat het gemeten blijft: hij vergelijkt wat de route zegt met wat er werkelijk
   in de code staat, en niet met een verwachte tekst. Zo slaat het scherm vanzelf
   om zodra de poort er is, en kan het nooit meer voorlopen op de werkelijkheid.

   MUTATIES die zijn gedraaid (LAT.md regel 2):
   - `http: true` hardcoderen in routes/isolatie.js -> ZAKT.
   - de zin "Dat werkt meteen" terugzetten in mijn-isolatie.html -> ZAKT.
   ------------------------------------------------------------------------ */
test('8. het scherm belooft niet meer dan de code doet', async () => {
  const fs2 = require('fs');
  const path2 = require('path');
  const lid = await nieuwLid();
  const r = await api('/api/isolatie/mijn', {}, lid);
  assert.equal(r.status, 200);

  const a = r.body.afgedwongen;
  assert.ok(a && typeof a === 'object', 'het antwoord hoort te zeggen WAAR deze stand geldt');
  assert.equal(a.ai, true, 'de AI-kant wordt wel afgedwongen (kern/stuur/isolatiefilter.js)');
  assert.ok(String(a.waarom || '').length > 40, 'en met een reden, niet met een vlaggetje');

  /* DE BEWERING WORDT TEGEN DE CODE GEHOUDEN. Meldt er geen handhaver zich in
     kern/isolatie/handhaving.js, dan MAG het antwoord niet zeggen dat http wordt
     afgedwongen. Dit is de kern van deze toets: niet "de tekst is goed" maar "de
     tekst is afgeleid". */
  /* DE BEWERING WORDT TEGEN DE BRON GEHOUDEN EN NIET TEGEN EEN REGISTER IN DIT
     PROCES. Die eerste versie deed dat wel, en dat was fout: kern/isolatie/handhaving.js
     draagt MODULESTAND, en de server draait in een KIND-proces. De toets vroeg
     dus zijn eigen (lege) register en vergeleek dat met het antwoord van een
     andere node -- hij zou nooit iets anders dan "niet gemonteerd" hebben gezien,
     en dus ook nooit een verkeerde belofte hebben gevangen zodra de poort er wel
     stond. Een toets die het verkeerde proces vraagt, geeft dekking zonder te
     dekken.

     De bron zegt het wel: `zetLaag(isolatie)` ZONDER `{ afdwingen: true }` is de
     schaduwstand. Zodra iemand die vlag ergens omzet, hoort deze toets te zakken
     tot ook de verwachting is bijgewerkt -- dat is precies de bedoeling, want de
     vlag omzetten is een besluit en geen configuratiedetail. */
  const bronnen = ['server/routes/isolatie.js', 'server/routes/techniek/isolatie.js']
    .map(f => fs2.readFileSync(path2.join(__dirname, '..', f), 'utf8')).join('\n');
  const meldt = /zetLaag\(isolatie\)/.test(bronnen);
  const dwingtAf = /zetLaag\(isolatie,\s*\{[^}]*afdwingen:\s*true/.test(bronnen);
  assert.ok(meldt, 'de isolatielaag hoort zich bij de HTTP-poort aan te melden');

  /* DRIE STANDEN, EN ELK HEEFT ZIJN EIGEN ZIN. De middelste glijdt het makkelijkst
     weg: een poort die MEELOOPT is gemonteerd en dwingt niets af, en wie die twee
     samenvat liegt opnieuw -- nu met een teller als dekmantel. */
  assert.equal(a.http, dwingtAf,
    'het scherm zegt iets anders dan de bron: gemeld=' + meldt + ' afdwingen=' + dwingtAf);
  if (!dwingtAf) {
    assert.match(String(a.waarom), meldt ? /houdt nog niets tegen/ : /staat er nog niet/,
      'SCHADUW IS GEEN HANDHAVING, en de zin hoort dat te zeggen: ' + a.waarom);
  }

  /* EN SCHADUW IS GEEN HANDHAVING -- de aanmeldplek zelf, in dit proces. Hij mag
     hier wel worden aangeroepen: dit is een eigenschap van de MODULE en geen
     vraag over de draaiende server, dus het kind-proces doet er niet toe. */
  const handhaving = require('../server/kern/isolatie/handhaving');
  handhaving.meldHandhaver({ waar: 'toets', modus: 'schaduw' });
  assert.equal(handhaving.stand().afdwingen, false, 'schaduw is geen handhaving');
  assert.equal(handhaving.stand().gemonteerd, true, 'maar hij is wel gemonteerd');
  assert.throws(() => handhaving.meldHandhaver({ waar: 'toets', modus: 'misschien' }),
    /schaduw. of .afdwingen/, 'een onbekende modus hoort te gooien en niet stil door te lopen');

  /* En de oude belofte staat niet meer in de pagina. Een gemeten veld naast een
     stellige zin is nog steeds een stellige zin. */
  const html = fs2.readFileSync(
    path2.join(__dirname, '..', 'public/apps/mijn-isolatie.html'), 'utf8');
  assert.ok(!/Dat werkt meteen/.test(html),
    'de pagina belooft nog steeds handhaving in vaste tekst; die hoort uit het antwoord te komen');
});

test('9. de AI-kaart versmalt echt, en zegt erbij wat er wegviel', async () => {
  /* DIT IS DE ENIGE BELOFTE DIE DEZE LAAG VANDAAG WERKELIJK WAARMAAKT, en tot nu
     toe was hij alleen per module getoetst. Een lid dat zichzelf dichtzet, ziet
     de assistent minder kunnen -- en dat hoort end-to-end te kloppen, over de
     route, de sessie, de dragervertaling en het filter heen.

     DE TWEEDE HELFT IS DE BELANGRIJKSTE. Een kaart die stilletjes korter is,
     laat het model denken dat die vermogens niet BESTAAN, en dan zegt het tegen
     een mens "dat kan ik niet" in plaats van "dat kan nu niet, omdat".
     EXECUTIE.md blok 0 noemt dat de gevaarlijkste faalvorm van deze laag.

     GEMETEN bij het schrijven: 120 paden voor, 50 erna, 70 weggevallen met de
     zin "er staat een beveiligingsstand aan op identiteit". De getallen staan
     hier NIET hard in -- ze schuiven met elke route die het huis erbij krijgt --
     maar de VERHOUDING wel: er moet fors zijn versmald, er moet iets overblijven,
     en het verschil moet worden uitgelegd.

     MUTATIES die zijn gedraaid (LAT.md regel 2):
     - `isoContext(req)` weghalen uit de /kaart-route -> ZAKT (geen versmalling).
     - `metUitleg` de beveiligingsstand laten weglaten -> ZAKT op de uitleg.
     - de vlag `isolatie` niet meegeven over het WERK-filter heen -> ZAKT op de
       uitleg (dat is een echte val: `filter()` levert een nieuwe array en die
       draagt een niet-opsombare eigenschap niet vanzelf mee). */
  const lid = await nieuwLid();

  const voor = await api('/api/member/doe/kaart', {}, lid);
  assert.equal(voor.status, 200);
  const nVoor = (voor.body.paden || []).length;
  assert.ok(nVoor > 50, 'een lid zonder stand hoort een ruime kaart te krijgen: ' + nVoor);
  assert.equal(voor.body.beveiligingsstand, undefined,
    'zonder stand hoort er geen beveiligingszin te staan; anders went hij en leest niemand hem nog');

  await api('/api/isolatie/mijn/zet',
    { drager: 'identiteit', naar: 'isolatie', reden: 'Ik kreeg een vreemde inlogmelding' }, lid);

  const na = await api('/api/member/doe/kaart', {}, lid);
  const nNa = (na.body.paden || []).length;
  assert.ok(nNa < nVoor, 'onder isolatie hoort de kaart korter te zijn: ' + nVoor + ' -> ' + nNa);
  assert.ok(nNa > 0,
    'maar niet leeg -- een assistent die niets meer kan, is een assistent die iemand uitzet');

  const b = na.body.beveiligingsstand;
  assert.ok(b, 'de kaart hoort te ZEGGEN dat er iets wegviel; stilletjes korter is de gevaarlijkste vorm');
  assert.equal(b.weggevallen, nVoor - nNa, 'en het getal hoort te kloppen met het verschil');
  assert.match(String(b.uitleg), /beveiligingsstand/,
    'met een zin die een mens kan lezen: ' + b.uitleg);
  assert.match(String(b.uitleg), /identiteit/, 'en die zegt op WELKE drager hij staat');

  /* En wat er wegviel is niet willekeurig: geld sturen hoort erbij te zitten,
     lezen niet. Zonder deze twee zou de toets ook slagen op een filter dat de
     helft van de lijst weggooit. */
  const weg = (voor.body.paden || []).filter(p => !(na.body.paden || []).includes(p));
  assert.ok(weg.includes('/api/pay/stuur'), 'geld sturen hoort dicht te gaan');
  assert.ok((na.body.paden || []).includes('/api/agenda/mijn'),
    'en de eigen agenda lezen hoort te blijven -- lezen loopt door');
});

test('10. de poort ZIET een stand op identiteit, en niet alleen op sessie', async () => {
  /* DE DUURSTE BEVINDING VAN DEZE LAAG, hier vastgepind.

     De isolatiepoort staat als middleware VOOR `auth`, dus req.session bestaat
     daar niet. `identiteit` viel daardoor terug op null -- en dat is precies de
     drager die een lid zet als hij zijn account beschermt
     (routes/isolatie.js: `String(b.drager || 'identiteit')`). De laag stond aan,
     telde netjes, en keek langs de gewoonste beschermstand heen.

     Gemeten met scripts/isolatieschaduw.js: een stand op `sessie` gaf 117
     gewogen verzoeken, dezelfde stand op `identiteit` gaf er NUL. De reparatie
     is kern/isolatie/sessiedragers.js + opzet/diensten2.js: dezelfde
     resolveSession wordt ingehangen in plaats van nagebouwd.

     MUTATIE: de zetSessieOplosser-regel uit opzet/diensten2.js halen -> ZAKT op
     `gewogen === 0`, gedraaid. Dat is de faalvorm die terug zou komen.

     Waarom deze toets de TELLER leest en niet een geweigerd verzoek: de poort
     loopt in de schaduw en houdt niets tegen, dus "het verzoek kwam door" bewijst
     hier niets. De teller is het enige dat zegt of hij heeft gekeken. */
  const token = await nieuwLid();
  const zet = await api('/api/isolatie/mijn/zet', { naar: 'isolatie' }, token);
  assert.equal(zet.status, 200, JSON.stringify(zet.body));
  assert.equal(zet.body.uit.drager, 'identiteit',
    'de standaarddrager van een lid is identiteit; verandert dat, dan meet deze toets iets anders');

  const voor = await poortstand();
  await api('/api/agenda/mijn', {}, token);
  const na = await poortstand();
  assert.ok(na.gewogen > voor.gewogen,
    'de poort heeft dit verzoek niet gewogen; een stand op identiteit is dan onzichtbaar ' +
    'voor de handhaving (gewogen bleef ' + voor.gewogen + ')');
});

/* De teller staat achter de kantoordeur; kan de toets er niet bij, dan zakt hij
   in plaats van nul te melden -- niet gemeten is geen bewijs van niets. */
let _techtoken = null;
async function poortstand() {
  if (!_techtoken) {
    const r = await api('/api/techniek/inloggen',
      { login: 'lid-poort-eigenaar@x.nl', wachtwoord: 'Imran' });
    _techtoken = r.body && r.body.token;
    assert.ok(_techtoken, 'zonder techniek-inlog is de teller niet te lezen, en dan meet deze toets niets');
  }
  const r = await fetch(srv.base + '/api/techniek/isolatie',
    { headers: { Authorization: 'Bearer ' + _techtoken } }).then(x => x.json());
  assert.ok(r.poort, 'het overzicht draagt geen poort-stand');
  return r.poort;
}
