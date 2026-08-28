/* ============================================================================
   DE RECHTERHAND: HET HUIS EN DE MENSEN ERBUITEN.

   De tegenhanger van test/rechterhand-reis.test.js. Daar ging het over de reis;
   hier over wat thuis blijft: het onderhoud, het personeel, de garderobe, de
   diners, de relaties -- en het dossier voor later.

   DE ZWAARSTE STAAT VOOROP

   Nalatenschap belooft iets dat je van buiten niet kunt controleren: de
   gevoelige velden staan VERSLEUTELD op schijf, met de sleutel apart buiten de
   database, "zodat ze onleesbaar zijn als het databasebestand ooit in verkeerde
   handen valt". Dat is precies het soort belofte dat jarenlang waar LIJKT: de
   app werkt, de tekst komt terug, en niemand kijkt ooit in het bestand.

   Deze toets kijkt wel in het bestand. Hij schrijft een zin die nergens anders
   voorkomt, leest hem via de app gewoon terug, en eist dan dat diezelfde zin
   NIET letterlijk op schijf staat. Als enc() ooit een doorgeefluik wordt --
   door een refactor, door een ontbrekende sleutel, door een stille terugval --
   dan valt hij hier om en nergens anders in de suite.

   VERDER: de getallen die worden uitgerekend en dus stil kunnen kantelen. Hoe
   veel dagen tot een verjaardag als die net geweest is (dan telt hij naar
   VOLGEND jaar). Wat er gebeurt met de taken van een personeelslid dat uit
   dienst gaat. Of onderhoudskosten optellen. Of een lijst opnieuw sorteert als
   er iets afgevinkt wordt.

   Draai los: node --test test/rechterhand-huis.test.js
   ========================================================================== */
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { startServer, stop, elevateTier, binnenEenDag } = require('./helper');

const TMP = fs.mkdtempSync(path.join(os.tmpdir(), 'rtg-rh-huis-'));
let srv, base, lid, office;

const raw = (pad, body, token) => fetch(base + '/api/' + pad, {
  method: 'POST',
  headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: 'Bearer ' + token } : {}) },
  body: JSON.stringify(body || {})
}).then(async r => ({ status: r.status, body: await r.json().catch(() => ({})) }));
const rh = (pad, body) => raw('member/rechterhand/' + pad, body, lid);

const dag = (n) => new Date(Date.now() + n * 86400000).toISOString().slice(0, 10);
const dagmaand = (n) => dag(n).slice(5);

test.before(async () => {
  srv = await startServer({ env: { SMTP_URL: '', RTG_DATA_DIR: TMP, OFFICE_CODE: 'KANTOOR-HUIS' } });
  base = srv.base;
  office = (await raw('office/login', { code: 'KANTOOR-HUIS' })).body.token;
  const u = Date.now().toString().slice(-9);
  const r = await raw('auth/register', { name: 'Huisheer', email: 'rhh' + u + '@x.nl',
    phone: '06' + u.slice(0, 8), password: 'geheim12345', geboortedatum: '1971-09-02', tier: 'rtg' });
  assert.ok(r.body.token, 'het lid is geregistreerd');
  await elevateTier(base, r.body.token, 'lifestyle', office);
  lid = r.body.token;
  assert.equal((await rh('maison', {})).status, 200, 'en draagt de Lifestyle Pass');
});

test.after(() => { stop(srv && srv.child); try { fs.rmSync(TMP, { recursive: true, force: true }); } catch (e) {} });

/* Alles wat er op schijf staat, als een lange string. Welk bestand de motor
   gebruikt (db.json of rtg.db) hangt van de opstelling af, dus we lezen wat er
   ligt -- inclusief de losse WAL-bestanden van sqlite, want een schrijfactie kan
   daar nog in staan en niet in het hoofdbestand. Een toets die alleen db.json
   leest zou groen blijven puur omdat hij op de verkeerde plek keek. */
function allesOpSchijf() {
  let uit = '';
  const loop = (map) => {
    for (const naam of fs.readdirSync(map)) {
      const p = path.join(map, naam);
      let st; try { st = fs.statSync(p); } catch (e) { continue; }
      if (st.isDirectory()) { loop(p); continue; }
      try { uit += fs.readFileSync(p, 'latin1'); } catch (e) { /* onleesbaar telt als niet gevonden */ }
    }
  };
  loop(TMP);
  return uit;
}

/* ============================================================================
   1 -- NALATENSCHAP: DE VERSLEUTELING IS ECHT, OF ZE IS NIETS
   ========================================================================== */
test('nalatenschap: de app leest het terug, de schijf niet', async () => {
  /* Zinnen die nergens anders in dit huis voorkomen, zodat een vondst op schijf
     niet toevallig iets anders kan zijn. */
  const WAAR = 'kluis achter het paneel in de bibliotheek, Wenen';
  const WENS = 'De Riva gaat naar mijn petekind, niet naar de veiling';
  const TEL = '0031205558812';

  /* De TITEL is met opzet niet versleuteld -- daar navigeert u op, en de module
     zegt dat ook eerlijk ("ik ken alleen de aantallen en de titels"). Dat is een
     ontwerpkeuze, geen omissie, en die staat hier vast zodat niemand hem per
     ongeluk omdraait in de veronderstelling dat alles wel versleuteld zal zijn. */
  assert.equal((await rh('nalatenschap/doc', { titel: 'Testament 2026', soort: 'testament',
    waar: WAAR, notitie: 'De notaris heeft het origineel.' })).status, 200, 'het testament staat in het dossier');
  assert.equal((await rh('nalatenschap/contact', { naam: 'Mr. Adriaanse', rol: 'notaris',
    telefoon: TEL, email: 'kantoor@voorbeeld.nl' })).status, 200, 'de notaris staat erbij');
  assert.equal((await rh('nalatenschap/wens', { titel: 'De boot', tekst: WENS })).status, 200,
    'en de wens is vastgelegd');

  /* ---- DE APP LEEST HET GEWOON TERUG. Zonder dit is "onleesbaar op schijf"
     triviaal te halen door het simpelweg niet op te slaan. ---- */
  const n = (await rh('nalatenschap', {})).body;
  assert.equal(n.documenten[0].waar, WAAR, 'de app weet waar het testament ligt');
  assert.equal(n.contacten[0].telefoon, TEL, 'en het nummer van de notaris');
  assert.equal(n.wensen[0].tekst, WENS, 'en de wens staat er woordelijk');

  /* ---- EN DE SCHIJF NIET. ---- */
  const schijf = allesOpSchijf();
  assert.ok(schijf.length > 0, 'er staat wel degelijk iets op schijf (anders toetst het volgende niets)');
  assert.ok(schijf.includes('Testament 2026'),
    'de titel staat er onversleuteld in -- dat is de ontwerpkeuze, en dit bewijst tegelijk dat we in het JUISTE bestand kijken');
  assert.ok(!schijf.includes(WAAR), 'maar waar de kluis hangt staat er niet leesbaar in');
  assert.ok(!schijf.includes(WENS), 'de wens ook niet');
  assert.ok(!schijf.includes(TEL), 'en het telefoonnummer van de notaris evenmin');

  /* Bijwerken houdt het versleuteld -- de tweede keer schrijven is een ander
     pad in de code dan de eerste, en juist daar zou een enc() kunnen ontbreken. */
  const wensId = n.wensen[0].id;
  const NIEUW = 'De Riva gaat toch naar het maritiem museum in Rotterdam';
  assert.equal((await rh('nalatenschap/wens', { id: wensId, titel: 'De boot', tekst: NIEUW })).status, 200,
    'de wens is herzien');
  assert.equal((await rh('nalatenschap', {})).body.wensen[0].tekst, NIEUW, 'en de app kent de nieuwe tekst');
  assert.ok(!allesOpSchijf().includes(NIEUW), 'ook de herziene wens staat niet leesbaar op schijf');

  /* Een wens zonder tekst is geen wens, en een bijwerking van iets dat er niet
     is hoort niet stilzwijgend een nieuw record te maken. */
  assert.equal((await rh('nalatenschap/wens', { tekst: '   ' })).status, 400, 'een lege wens wordt geweigerd');
  assert.equal((await rh('nalatenschap/wens', { id: 'bestaat-niet', tekst: 'x' })).status, 404,
    'en bijwerken van iets onbekends geeft 404, geen stille nieuwe regel');
  assert.equal((await rh('nalatenschap', {})).body.wensen.length, 1, 'er is nog steeds precies een wens');
});

/* ============================================================================
   2 -- ATTENTIES: HOEVEEL DAGEN NOG, OVER DE JAARGRENS HEEN

   Een verjaardag is 'MM-DD' zonder jaar. Wie er gisteren een had, is pas over
   bijna een jaar weer aan de beurt -- niet gisteren, en zeker niet negatief.
   Dat is de rekensom die stil fout gaat en waar niemand een melding van krijgt.
   ========================================================================== */
test('attenties: de teller loopt over de jaargrens, en telt de eerstvolgende gelegenheid', async () => {
  const zet = async (naam, extra) => {
    assert.equal((await rh('attenties/relatie', Object.assign({ naam }, extra))).status, 200, naam + ' staat erin');
    return (await rh('attenties', {})).body.relaties.find(r => r.naam === naam).id;
  };

  /* dagmaand() rekent vanaf vandaag en de server telt de dagen vanaf ZIJN
     vandaag. Loopt de suite over middernacht, dan schuift alles een dag op en
     zakt de telling zonder dat er iets stuk is; binnenEenDag() doet de meting
     dan een keer over. */
  await binnenEenDag(async () => {
  const bijna = await zet('Wouter Sluis', { band: 'vriend', verjaardag: dagmaand(9) });
  const net = await zet('Hanne Bos', { band: 'familie', verjaardag: dagmaand(-3) });
  const beide = await zet('Otto Prins', { band: 'mentor', verjaardag: dagmaand(200), jubileum: dagmaand(15) });
  await zet('Lena Vos', { band: 'buur' });   // geen enkele datum

  const a = (await rh('attenties', {})).body;
  const r = (naam) => a.relaties.find(x => x.naam === naam);

  assert.equal(r('Wouter Sluis').dagenTot, 9, 'over negen dagen is Wouter jarig');
  assert.equal(r('Wouter Sluis').volgendeSoort, 'verjaardag', 'en dat is een verjaardag');

  /* DE JAARGRENS. Drie dagen geleden jarig betekent 362 of 363 dagen wachten
     (schrikkeljaar), maar in geen geval een negatief getal of nul. */
  const wacht = r('Hanne Bos').dagenTot;
  assert.ok(wacht > 350 && wacht < 367,
    'Hanne was net jarig en is pas over bijna een jaar weer aan de beurt, niet ' + wacht);

  /* De eerstvolgende GELEGENHEID telt, niet de verjaardag per se. Otto is pas
     over 200 dagen jarig maar heeft over 15 dagen een jubileum. */
  assert.equal(r('Otto Prins').dagenTot, 15, 'bij Otto telt het jubileum, want dat komt eerder');
  assert.equal(r('Otto Prins').volgendeSoort, 'jubileum', 'en de app zegt welke gelegenheid het is');

  /* Zonder datum is het antwoord null en niet 0 of 9999 -- "ik weet het niet"
     is iets anders dan "vandaag" of "over 27 jaar". */
  assert.equal(r('Lena Vos').dagenTot, null, 'van Lena is geen datum bekend');
  assert.equal(r('Lena Vos').volgendeSoort, '', 'dus ook geen soort');

  /* De lijst staat op volgorde van wie er het eerst aan de beurt is, met wie
     geen datum heeft achteraan. Dat is de enige zinnige volgorde voor deze app. */
  assert.deepEqual(a.relaties.map(x => x.naam), ['Wouter Sluis', 'Otto Prins', 'Hanne Bos', 'Lena Vos'],
    'de eerstvolgende bovenaan, de onbekende onderaan: ' + a.relaties.map(x => x.naam).join(', '));

  /* AANKOMEND is het venster van dertig dagen. Wouter en Otto wel, Hanne niet. */
  assert.deepEqual(a.aankomend.map(x => x.naam).sort(), ['Otto Prins', 'Wouter Sluis'],
    'binnen dertig dagen: ' + JSON.stringify(a.aankomend));

  /* DE GIFTGESCHIEDENIS bestaat om niet twee keer hetzelfde te geven. Ze hangt
     aan de relatie, en gaat mee als de relatie verdwijnt -- een gift zonder
     ontvanger is een regel die nergens meer opduikt maar wel blijft staan. */
  assert.equal((await rh('attenties/gift', { relatieId: bijna, wat: 'Eerste druk Slauerhoff',
    gelegenheid: 'verjaardag', datum: dag(-370), bedrag: 240 })).status, 200, 'vorig jaar een boek gegeven');
  assert.equal((await rh('attenties/gift', { relatieId: net, wat: 'Wijnmand', datum: dag(-3) })).status, 200,
    'en Hanne kreeg een mand');

  const zonderRelatie = await rh('attenties/gift', { relatieId: 'bestaat-niet', wat: 'Bloemen' });
  assert.equal(zonderRelatie.status, 404, 'een gift zonder relatie kan niet');
  const zonderWat = await rh('attenties/gift', { relatieId: bijna });
  assert.equal(zonderWat.status, 400, 'en een gift zonder inhoud ook niet');

  assert.equal((await rh('attenties', {})).body.relaties.find(x => x.id === bijna).giften[0].wat,
    'Eerste druk Slauerhoff', 'de gift staat bij de juiste relatie');

  assert.equal((await rh('attenties/relatie/weg', { id: bijna })).status, 200, 'Wouter gaat uit de lijst');
  const na = (await rh('attenties', {})).body;
  assert.equal(na.relaties.length, 3, 'er blijven er drie over');
  assert.equal(na.giften.length, 1, 'en zijn gift is meegegaan, die van Hanne niet: ' +
    JSON.stringify(na.giften.map(g => g.wat)));
  assert.equal(na.giften[0].relatie, 'Hanne Bos', 'de overgebleven gift hangt aan Hanne');
  assert.equal(beide && na.relaties.some(x => x.id === beide), true, 'en Otto staat er gewoon nog');
  });
});

/* ============================================================================
   3 -- LOGBOEK: WAT IS ER BINNENKORT AAN DE BEURT

   Het onderhoudsboek seint op de datum 'volgende', binnen zestig dagen. De
   kosten tellen op over alle regels. Beide staan nergens in de gegevens.
   ========================================================================== */
test('het logboek: het seint wat aan de beurt is, telt de kosten op, en laat niets verweesd achter', async () => {
  const zonderNaam = await rh('logboek/object', { soort: 'jacht' });
  assert.equal(zonderNaam.status, 400, 'een object zonder naam gaat niet in het logboek');

  assert.equal((await rh('logboek/object', { naam: 'De Riva', soort: 'jacht', merk: 'Riva',
    bouwjaar: 1968, registratie: 'NL-4412' })).status, 200, 'het jacht staat in het logboek');
  assert.equal((await rh('logboek/object', { naam: 'De Alfa', soort: 'oldtimer', merk: 'Alfa Romeo',
    bouwjaar: 1972 })).status, 200, 'de oldtimer ook');

  const objecten = (await rh('logboek', {})).body.objecten;
  const riva = objecten.find(o => o.naam === 'De Riva').id;
  const alfa = objecten.find(o => o.naam === 'De Alfa').id;

  const zonderObject = await rh('logboek/regel', { objectId: 'bestaat-niet', wat: 'Beurt' });
  assert.equal(zonderObject.status, 404, 'een regel zonder object kan niet');
  const zonderWat = await rh('logboek/regel', { objectId: riva });
  assert.equal(zonderWat.status, 400, 'en een regel zonder inhoud ook niet');

  /* Drie regels met drie uitkomsten: een die verlopen is, een die binnen het
     venster van zestig dagen valt, en een die er ruim buiten ligt. */
  assert.equal((await rh('logboek/regel', { objectId: riva, wat: 'Winterstalling betaald',
    soort: 'stalling', datum: dag(-200), volgende: dag(-5), kosten: 3400 })).status, 200,
    'de stalling is verlopen');
  assert.equal((await rh('logboek/regel', { objectId: riva, wat: 'Motorbeurt 200 uur',
    soort: 'service', datum: dag(-90), volgende: dag(40), kosten: 1850 })).status, 200,
    'de motorbeurt komt eraan');
  assert.equal((await rh('logboek/regel', { objectId: alfa, wat: 'APK',
    soort: 'keuring', datum: dag(-30), volgende: dag(330), kosten: 65 })).status, 200,
    'de APK van de Alfa is net gedaan');

  const lb = (await rh('logboek', {})).body;
  assert.equal(lb.attenties.length, 2, 'twee dingen vragen aandacht, de APK niet: ' +
    JSON.stringify(lb.attenties.map(a => a.wat)));
  assert.equal(lb.attenties[0].wat, 'Winterstalling betaald', 'de verlopen staat bovenaan');
  assert.equal(lb.attenties[0].verlopen, true, 'en is als verlopen gemerkt');
  assert.equal(lb.attenties[1].verlopen, false, 'de motorbeurt is alleen aanstaande');

  const rivaNa = lb.objecten.find(o => o.id === riva);
  assert.equal(rivaNa.regelAantal, 2, 'het jacht heeft twee regels');
  assert.equal(rivaNa.kosten, 5250, 'die samen 5250 kosten: ' + rivaNa.kosten);
  assert.equal(rivaNa.laatste.wat, 'Motorbeurt 200 uur', 'en de recentste is de motorbeurt');
  assert.equal(lb.totaalKosten, 5315, 'over alles heen is het 5315: ' + lb.totaalKosten);

  /* Het object weghalen neemt ZIJN regels mee en die van het andere niet. Bleven
     ze staan, dan telde totaalKosten kosten van een boot die verkocht is. */
  assert.equal((await rh('logboek/object/weg', { id: riva })).status, 200, 'de Riva is verkocht');
  const na = (await rh('logboek', {})).body;
  assert.equal(na.objecten.length, 1, 'alleen de Alfa staat er nog');
  assert.equal(na.regels.length, 1, 'met een regel');
  assert.equal(na.totaalKosten, 65, 'en de kosten zijn die van de Alfa alleen: ' + na.totaalKosten);
  assert.equal(na.attenties.length, 0, 'er vraagt niets meer aandacht');
});

/* ============================================================================
   4 -- MAISON: EEN PERSONEELSLID GAAT UIT DIENST

   De vraag die deze module stilzwijgend beantwoordt: wat gebeurt er met de taken
   van iemand die vertrekt? Ze worden NIET weggegooid -- het werk moet nog steeds
   gebeuren -- maar ze raken hun eigenaar kwijt. Dat is een keuze, en zonder toets
   is het een keuze die niemand kent.
   ========================================================================== */
test('maison: wie vertrekt neemt zijn taken niet mee, en afvinken herschikt de lijst', async () => {
  assert.equal((await rh('maison/staf', { naam: 'Mevrouw Duarte', rol: 'huishouding',
    telefoon: '0611110000' })).status, 200, 'de huishoudster is in dienst');
  assert.equal((await rh('maison/staf', { naam: 'De heer Silva', rol: 'tuin' })).status, 200,
    'de tuinman ook');
  assert.equal((await rh('maison/staf', {})).status, 400, 'een personeelslid zonder naam kan niet');

  const staf = (await rh('maison', {})).body.staf;
  const duarte = staf.find(s => s.naam === 'Mevrouw Duarte').id;
  const silva = staf.find(s => s.naam === 'De heer Silva').id;

  assert.equal((await rh('maison/taak', { wat: 'Zilverwerk poetsen', voor: duarte, dag: dag(2) })).status, 200,
    'een taak voor de huishoudster');
  assert.equal((await rh('maison/taak', { wat: 'Haag knippen', voor: silva, dag: dag(1) })).status, 200,
    'een voor de tuinman');
  assert.equal((await rh('maison/taak', { wat: 'Schoorsteen laten vegen', dag: dag(5) })).status, 200,
    'en een die aan niemand hangt');
  assert.equal((await rh('maison/taak', {})).status, 400, 'een taak zonder inhoud kan niet');

  /* Een taak toewijzen aan iemand die niet bestaat hoort geen 404 te geven maar
     de taak zonder eigenaar aan te maken -- het werk moet immers wel gebeuren.
     Ook dat is een keuze die je alleen ziet als hij vastligt. */
  assert.equal((await rh('maison/taak', { wat: 'Ramen lappen', voor: 'bestaat-niet' })).status, 200,
    'een taak voor een onbekend personeelslid wordt wel aangemaakt');
  const ramen = (await rh('maison', {})).body.taken.find(t => t.wat === 'Ramen lappen');
  assert.equal(ramen.voor, '', 'maar zonder eigenaar');

  const m = (await rh('maison', {})).body;
  assert.equal(m.openTaken, 4, 'er staan vier taken open');
  assert.equal(m.taken.find(t => t.wat === 'Zilverwerk poetsen').voorNaam, 'Mevrouw Duarte',
    'en de app zet er de naam bij, niet alleen het nummer');

  /* AFVINKEN. De lijst zet klaar-taken achteraan: wat af is hoort niet boven
     wat nog moet. */
  const zilver = m.taken.find(t => t.wat === 'Zilverwerk poetsen').id;
  assert.equal((await rh('maison/taak/klaar', { id: zilver, klaar: true })).status, 200, 'het zilver is gedaan');
  const na = (await rh('maison', {})).body;
  assert.equal(na.openTaken, 3, 'er staan er nog drie open');
  assert.equal(na.taken[na.taken.length - 1].wat, 'Zilverwerk poetsen', 'en de afgeronde staat onderaan');

  /* Weer openzetten kan ook -- afvinken hoort geen eenrichtingsverkeer te zijn,
     want dan is een vergissing niet te herstellen. */
  assert.equal((await rh('maison/taak/klaar', { id: zilver, klaar: false })).status, 200, 'toch niet gedaan');
  assert.equal((await rh('maison', {})).body.openTaken, 4, 'dus weer vier open');
  assert.equal((await rh('maison/taak/klaar', { id: 'bestaat-niet', klaar: true })).status, 404,
    'een taak die niet bestaat kun je niet afvinken');

  /* UIT DIENST. De taak blijft, de eigenaar valt weg. */
  assert.equal((await rh('maison/staf/weg', { id: duarte })).status, 200, 'de huishoudster gaat uit dienst');
  const eind = (await rh('maison', {})).body;
  assert.equal(eind.staf.length, 1, 'er is nog een personeelslid');
  const verweesd = eind.taken.find(t => t.wat === 'Zilverwerk poetsen');
  assert.ok(verweesd, 'het zilver moet nog steeds gepoetst worden');
  assert.equal(verweesd.voor, '', 'maar er hangt niemand meer aan');
  assert.equal(verweesd.voorNaam, '', 'en er staat geen naam meer bij van iemand die weg is');
  assert.equal(eind.taken.find(t => t.wat === 'Haag knippen').voorNaam, 'De heer Silva',
    'de taak van de tuinman is ongemoeid gebleven');

  /* Het logboek van het huis: nieuwste bovenaan. */
  assert.equal((await rh('maison/log', { tekst: 'Lekkage in de bijkeuken gemeld.' })).status, 200, 'een notitie');
  assert.equal((await rh('maison/log', { tekst: 'Loodgieter komt donderdag.' })).status, 200, 'en nog een');
  assert.equal((await rh('maison/log', { tekst: '  ' })).status, 400, 'een lege notitie niet');
  assert.equal((await rh('maison', {})).body.logboek[0].tekst, 'Loodgieter komt donderdag.',
    'de nieuwste notitie staat bovenaan');
});

/* ============================================================================
   5 -- TABLE EN GARDEROBE: DE TELLINGEN
   ========================================================================== */
test('table en garderobe: de tellingen kloppen met wat erin staat', async () => {
  const gemaakt = await rh('table/zet', { naam: 'Kerstdiner', datum: dag(30), tijd: '19:00',
    locatie: 'De eetkamer' });
  assert.equal(gemaakt.status, 200, 'de gelegenheid staat er');
  const eventId = gemaakt.body.event.id;
  assert.equal((await rh('table/zet', { naam: 'Zomerlunch', datum: dag(-60) })).status, 200,
    'en een die al is geweest');

  assert.equal((await rh('table/gast', { eventId, naam: 'Iris Mendes', dieet: 'geen vis', tafel: '1' })).status, 200,
    'de eerste gast');
  assert.equal((await rh('table/gast', { eventId, naam: 'Paul Brandt', tafel: '1' })).status, 200, 'de tweede');
  assert.equal((await rh('table/gast', { eventId, naam: '' })).status, 400, 'een gast zonder naam niet');
  assert.equal((await rh('table/gast', { eventId: 'bestaat-niet', naam: 'X' })).status, 404,
    'en een gast bij een gelegenheid die niet bestaat ook niet');

  assert.equal((await rh('table/menu', { eventId, gang: 'voor', gerecht: 'Oesters',
    wijn: 'Chablis' })).status, 200, 'het voorgerecht');
  assert.equal((await rh('table/menu', { eventId, gerecht: 'Tarbot' })).status, 200, 'en het hoofdgerecht');
  assert.equal((await rh('table/menu', { eventId })).status, 400, 'een gang zonder gerecht niet');

  const t = (await rh('table', {})).body;
  const kerst = t.events.find(e => e.naam === 'Kerstdiner');
  assert.equal(kerst.gastenAantal, 2, 'twee gasten aan tafel');
  assert.equal(kerst.komend, true, 'het diner moet nog komen');
  assert.equal(t.events.find(e => e.naam === 'Zomerlunch').komend, false, 'de lunch is geweest');
  assert.equal(kerst.menu.find(m => m.gerecht === 'Tarbot').gang, 'gang',
    'een gerecht zonder gangnaam krijgt er een, want een naamloze gang is niet te serveren');

  /* Een gast bijwerken raakt alleen de velden die je meestuurt. Zou het alles
     overschrijven, dan wist het wijzigen van een tafelnummer stil het dieet --
     en dat merk je pas aan tafel. */
  const paul = kerst.gasten.find(g => g.naam === 'Paul Brandt').id;
  assert.equal((await rh('table/gast/zet', { eventId, gastId: paul, dieet: 'noten-allergie' })).status, 200,
    'Paul blijkt een notenallergie te hebben');
  const naZet = (await rh('table', {})).body.events.find(e => e.id === eventId);
  const paulNa = naZet.gasten.find(g => g.id === paul);
  assert.equal(paulNa.dieet, 'noten-allergie', 'het dieet staat erbij');
  assert.equal(paulNa.tafel, '1', 'en zijn tafel is niet stilzwijgend gewist');
  assert.equal(naZet.gasten.find(g => g.naam === 'Iris Mendes').dieet, 'geen vis',
    'en het dieet van Iris is ongemoeid');

  assert.equal((await rh('table/gast/zet', { eventId, gastId: 'bestaat-niet', dieet: 'x' })).status, 404,
    'een gast die er niet is kun je niet wijzigen');

  /* De garderobe telt per categorie, en wat er niet in de lijst staat valt onder
     'overig' -- niet onder een categorie die het lid heeft verzonnen. */
  for (const s of [
    { naam: 'Grijs krijtstreep', categorie: 'pak', merk: 'Huntsman', waar: 'Amsterdam, kast 2' },
    { naam: 'Marineblauw', categorie: 'pak', waar: 'Amsterdam, kast 2' },
    { naam: 'Zwarte oxfords', categorie: 'schoenen', maat: '44' },
    { naam: 'Zeilbroek', categorie: 'kombuiskleding' }
  ]) assert.equal((await rh('garderobe/stuk', s)).status, 200, s.naam + ' hangt in de kast');
  assert.equal((await rh('garderobe/stuk', { naam: '' })).status, 400, 'een stuk zonder naam niet');

  const g = (await rh('garderobe', {})).body;
  assert.equal(g.aantal, 4, 'vier stukken');
  assert.equal(g.perCategorie.pak, 2, 'twee pakken');
  assert.equal(g.perCategorie.schoenen, 1, 'een paar schoenen');
  assert.equal(g.perCategorie.overig, 1, 'en de zeilbroek valt onder overig: ' + JSON.stringify(g.perCategorie));
  assert.equal(g.stukken.find(s => s.naam === 'Zeilbroek').categorie, 'overig',
    'een verzonnen categorie wordt niet overgenomen');

  assert.equal((await rh('garderobe/vakman', { naam: 'Atelier Hendriks', vak: 'kleermaker',
    plaats: 'Amsterdam' })).status, 200, 'de kleermaker staat erbij');
  assert.equal((await rh('garderobe/vakman', { naam: '' })).status, 400, 'een vakman zonder naam niet');
  assert.equal((await rh('garderobe', {})).body.vaklui.length, 1, 'een vakman in de lijst');
});
