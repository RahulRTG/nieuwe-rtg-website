/* De zichtbare enterprise-belofte van RTG School.

   Deze toets voorkomt dat School Partner en het gezinsscherm opnieuw twee
   losse producten worden, of dat een schoolsleutel stilletjes permanent in
   de browser terechtkomt. De servertoetsen bewijzen de echte rolrechten;
   hier bewaken we de gezamenlijke schil en de extra clientgrens. */
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const PUB = path.join(__dirname, '..', 'public');
const lees = (...delen) => fs.readFileSync(path.join(PUB, ...delen), 'utf8');
/* Meten aan de CODE en niet aan het commentaar. Een bestand dat belooft "hier
   komt geen ranglijst" bevat het woord ranglijst, en een toets die daarover
   valt dwingt je om de uitleg weg te halen -- precies verkeerd om. Deze knipt
   blokcommentaar en hele commentaarregels eruit; wat overblijft is wat het
   scherm werkelijk doet. */
const codeVan = (bron) => bron.replace(/\/\*[\s\S]*?\*\//g, '')
  .split('\n').filter(r => !/^\s*\/\//.test(r)).join('\n');
const partner = lees('apps', 'schoolpartner.html');
const partnerApp = lees('apps', 'schoolpartner', 'app.js');
const school = lees('apps', 'foundation', 'school.html');
const leerpaspoort = lees('apps', 'foundation', 'leerpaspoort.html');
const sessie = lees('shared', 'rtg-school-session.js');
const schil = lees('shared', 'rtg-school-shell.css');
const offline = lees('apps', 'foundation', 'sw.js');

test('School en School Partner gebruiken dezelfde vaste RTG-randen', () => {
  for (const [naam, bron] of [['School', school], ['Leerpaspoort', leerpaspoort], ['School Partner', partner]]) {
    assert.match(bron, /rtg-school-shell\.css/, naam + ' mist de gedeelde schoolstijl');
    assert.match(bron, /class="school-kader"/, naam + ' mist het vaste kader');
    assert.match(bron, /class="school-zij"/, naam + ' mist de linkernavigatie');
    assert.match(bron, /class="school-boven/, naam + ' mist de bovenbalk');
    assert.match(bron, /enterprise-hero/, naam + ' mist het enterprise-overzicht');
  }
  assert.match(schil, /\.school-kader/);
  assert.match(schil, /\.school-dashboard-grid/);
});

test('de losse onderwijsdelen zijn vanuit de gezamenlijke schil verbonden', () => {
  for (const href of [
    '/apps/schoolpartner.html', '/apps/lesmaker.html',
    'campus.html', 'school.html', 'leerpaspoort.html', 'leren.html', 'schoolbieb.html', 'speelhal.html',
    '/apps/spelen.html?pas=foundation&amp;open=magnaat'
  ]) assert.ok(school.includes('href="' + href + '"'), 'ontbrekende schoolroute: ' + href);
  assert.match(partner, /href="\/apps\/foundation\/school\.html"/);
  assert.match(partner, /href="\/apps\/foundation\/schoolbieb\.html"/);
});

test('directie, leraar en gezin krijgen elk een eigen professioneel dashboard', () => {
  for (const id of ['vPoort', 'vDirectie', 'dKpis', 'dEnterprise', 'dBeheer', 'vLeraar', 'lKpis', 'lWerk']) {
    assert.ok(partner.includes('id="' + id + '"'), 'School Partner mist #' + id);
  }
  for (const id of ['vGezin', 'schoolWelkom', 'schoolKerncijfers', 'schoolLijst', 'vLeraar']) {
    assert.ok(school.includes('id="' + id + '"'), 'School mist #' + id);
  }
});

test('schoolsleutels blijven tijdelijk en verlopen na dertig minuten', () => {
  assert.match(partner, /\/shared\/rtg-school-session\.js/);
  assert.match(school, /\/shared\/rtg-school-session\.js/);
  assert.match(partnerApp, /RTGSchoolSession/);
  assert.match(school, /RTGSchoolSession/);
  assert.doesNotMatch(partnerApp, /localStorage\.(?:setItem|getItem)\s*\(/);
  assert.doesNotMatch(school, /localStorage\.(?:setItem|getItem)\s*\(/);
  assert.match(sessie, /sessionStorage\.setItem/);
  assert.match(sessie, /30 \* 60 \* 1000/);
  assert.match(sessie, /localStorage\.removeItem/,
    'de eenmalige migratie moet oude permanente sleutels verwijderen');
  assert.match(sessie, /\['pointerdown', 'keydown', 'focus'\]/);
  assert.ok(offline.includes("'/shared/rtg-school-session.js'"),
    'de veiligere sessielaag moet ook in de offline-schil zitten');
  for (const pad of ["'/apps/foundation/leerpaspoort.html'", "'/apps/rtgschool/leer.js'", "'/apps/rtgschool/examen.js'", "'/apps/rtgschool/bijles.js'"])
    assert.ok(offline.includes(pad), 'het leerlingpaspoort mist offline onderdeel ' + pad);
});

/* ---------------------------------------------------------------------------
   DEKKING: elk school-endpoint heeft een scherm, of staat hieronder met naam.

   Waarom deze toets bestaat. RTG School had 165 endpoints en 84 daarvan waren
   vanuit een scherm te bereiken; de rest bestond wel, maar niemand kon erbij.
   Dat is de vervelendste soort onaf: de tests waren groen, de belofte stond in
   de code, en toch kon een leraar geen presentie zetten en een leerling zijn
   toets niet maken.

   De lijst OPEN hieronder is dus geen uitzonderingenlijst maar een REGISTER
   van wat nog geen scherm heeft. Bouwt iemand er een, dan zakt deze toets tot
   de naam uit de lijst is gehaald -- en dat is precies de bedoeling: de lijst
   hoort korter te worden en mag nooit stilletjes langer worden. */
const OPEN = [
  // Leeg. Elk endpoint van server/school/*.js is vanuit een scherm te bereiken.
  // Komt hier ooit weer iets bij, dan hoort er een naam en een reden bij te
  // staan -- en hoort die reden een tijdelijke te zijn.
];

function endpointsVanDeServer() {
  const map = path.join(__dirname, '..', 'server', 'school');
  const uit = new Set();
  for (const f of fs.readdirSync(map).filter(x => x.endsWith('.js'))) {
    const bron = fs.readFileSync(path.join(map, f), 'utf8');
    for (const m of bron.matchAll(/router\.(?:post|get)\('\/school\/([a-z0-9/-]+)'/g)) uit.add(m[1]);
  }
  return uit;
}

function endpointsInDeSchermen() {
  const uit = new Set();
  const loop = (map) => {
    for (const naam of fs.readdirSync(map)) {
      const p = path.join(map, naam);
      if (fs.statSync(p).isDirectory()) { loop(p); continue; }
      if (!/\.(html|js)$/.test(naam)) continue;
      const bron = fs.readFileSync(p, 'utf8');
      /* Ook een pad dat als EventSource-URL begint (".../belkanaal?" + vraag)
         telt als een scherm dat het endpoint gebruikt; vandaar de ? in de sluitklasse. */
      for (const m of bron.matchAll(/['"](?:\/api\/foundation)?\/school\/([a-z0-9/-]+)['"?]/g)) uit.add(m[1]);
    }
  };
  loop(PUB);
  return uit;
}

test('elk school-endpoint heeft een scherm, of staat in het register van openstaande schermen', () => {
  const server = endpointsVanDeServer();
  const schermen = endpointsInDeSchermen();
  const zonderScherm = [...server].filter(e => !schermen.has(e)).sort();
  const geregistreerd = [...OPEN].sort();
  assert.deepEqual(zonderScherm, geregistreerd,
    'De lijst OPEN in deze toets loopt uit de pas met de werkelijkheid.\n' +
    'Wel op de server, geen scherm, niet in OPEN: ' + zonderScherm.filter(e => !OPEN.includes(e)).join(', ') + '\n' +
    'In OPEN maar inmiddels wel een scherm (haal ze uit de lijst): ' + OPEN.filter(e => !zonderScherm.includes(e)).join(', '));
  assert.ok(server.size >= 165, 'de school heeft minder endpoints dan verwacht: ' + server.size);
});

test('de vier schermen van deze ronde bestaan en spreken de juiste endpoints aan', () => {
  const presentie = lees('apps', 'schoolpartner', 'presentie.js');
  const rapport = lees('apps', 'schoolpartner', 'rapport.js');
  const dossier = lees('apps', 'schoolpartner', 'dossier.js');
  const zorg = lees('apps', 'schoolpartner', 'dossier-zorg.js');
  const toets = lees('apps', 'foundation', 'school-toets.js');

  // presentie: zetten EN het beeld, en via de rollenpoort (dus met schoolcode)
  assert.match(presentie, /\/school\/aanwezigheid\/zet/);
  assert.match(presentie, /\/school\/aanwezigheid\/klas/);
  assert.match(partnerApp, /schoolCode: S\.code[\s\S]{0,80}personeelToken/, 'sk() moet de schoolcode meesturen');

  // rapport: vaststellen kan alleen met een vinkje dat een mens zet
  assert.match(rapport, /\/school\/rapport\/stel-vast/);
  assert.match(rapport, /gelezen: true/);
  assert.match(rapport, /rapGelezen[\s\S]{0,200}checked/,
    'het scherm moet de vaststelling achter een expliciet vinkje houden');

  // zorgdeel: nooit open zonder reden
  assert.match(zorg, /zorg: true/);
  assert.match(zorg, /reden: reden/);
  assert.match(zorg, /journaal/i, 'het scherm hoort te zeggen wat er met de reden gebeurt');
  assert.match(dossier, /\/school\/dossier\/contact/);
  assert.match(dossier, /\/school\/document\/voeg/);

  // de toets van de leerling: starten, antwoorden, en GEEN goed/fout per vraag
  assert.match(toets, /\/school\/toets\/voor-mij/);
  assert.match(toets, /\/school\/toets\/start/);
  assert.match(toets, /\/school\/toets\/antwoord/);
  assert.doesNotMatch(toets, /juisteAntwoord/,
    'een toets kijk je na het inleveren na, niet halverwege');
  assert.match(toets, /\/school\/rapport\/mijn/);

  // en ze hangen ook echt in de pagina's
  assert.match(partner, /schoolpartner\/presentie\.js/);
  assert.match(partner, /schoolpartner\/rapport\.js/);
  assert.match(partner, /schoolpartner\/dossier\.js/);
  assert.ok(partner.includes('id="dDossier"'), 'School Partner mist #dDossier');
  assert.ok(partner.includes('id="presLijst"') && partner.includes('id="rapLijst"'),
    'de werkbank mist de nieuwe delen');
  assert.match(school, /school-toets\.js/);
});

test('de tweede ronde schermen draagt de beloftes van zijn serverlaag', () => {
  const veiligheid = lees('apps', 'schoolpartner', 'veiligheid.js');
  const hr = lees('apps', 'schoolpartner', 'hr.js');
  const mijnhr = lees('apps', 'schoolpartner', 'mijnhr.js');
  const geld = lees('apps', 'schoolpartner', 'geld.js');
  const organisatie = lees('apps', 'schoolpartner', 'organisatie.js');
  const omroep = lees('apps', 'schoolpartner', 'omroep.js');
  const oefenen = lees('apps', 'foundation', 'school-oefenen.js');
  const toets = lees('apps', 'foundation', 'school-toets.js');

  // veiligheid: wel de huidige stand, nooit een looproute
  assert.match(veiligheid, /\/school\/pas\/lijst/);
  assert.match(veiligheid, /HUIDIGE stand/i);
  assert.match(veiligheid, /esc\(d\.uitleg/, 'het scherm toont de belofte die de server zelf meestuurt');
  assert.doesNotMatch(veiligheid, /pas\/geschiedenis|pas\/spoor/i);

  // HR: het dossier gaat open met een reden, en er is geen scoreveld
  assert.match(hr, /\/school\/hr\/dossier/);
  assert.match(hr, /reden: reden/);
  assert.doesNotMatch(hr, /beoordelingscijfer|score:/i);

  // de medewerker heeft zijn eigen kant: ziek melden zonder redenveld
  assert.match(mijnhr, /soort: 'ziek'/);
  assert.doesNotMatch(mijnhr, /ziekReden|diagnose/i);
  assert.match(mijnhr, /\/school\/mijn-rechten/);

  // geld: geen enkele knop die een kind ergens van uitsluit
  assert.match(geld, /\/school\/factuur\/maak/);
  assert.doesNotMatch(geld, /blokkeer.{0,20}leerling|uitsluit(en)?\(/i);

  // de overgang vraagt het woord OVERGANG, en niet stilletjes op een tik
  assert.match(organisatie, /bevestig: q\('orBevestig'\)/);
  assert.match(organisatie, /OVERGANG/);

  // toestemming: geen antwoord is geen toestemming, en dat staat op het scherm
  assert.match(omroep, /\/school\/toestemming\/vraag/);
  assert.match(omroep, /Geen antwoord is geen toestemming/i);

  /* Het scherpste onderscheid van deze twee bestanden: oefenen geeft meteen
     goed of fout, een toets niet. Staan ze ooit in een bestand, dan is dat
     verschil een vergissing weg. */
  assert.match(oefenen, /juisteAntwoord/, 'oefenen hoort het juiste antwoord te tonen');
  assert.doesNotMatch(toets, /juisteAntwoord/, 'een toets kijk je na het inleveren na');

  for (const naam of ['veiligheid', 'hr', 'mijnhr', 'geld', 'organisatie', 'omroep', 'verlof'])
    assert.ok(partner.includes('/apps/schoolpartner/' + naam + '.js'), 'School Partner laadt ' + naam + '.js niet');
  for (const naam of ['school-toets.js', 'school-verlof.js', 'school-oefenen.js'])
    assert.ok(school.includes(naam), 'School laadt ' + naam + ' niet');
});

test('Proof of Learning staat op beide schermen: het bewijs en de observatie', () => {
  const leer = lees('apps', 'rtgschool', 'leer.js');
  const bewijs = lees('apps', 'schoolpartner', 'bewijs.js');

  // de leerling kan de vraag stellen die een zwarte doos niet beantwoordt
  assert.match(leer, /\/api\/onderwijs\/bewijs/);
  assert.match(leer, /waarom denkt RTG dat ik dit kan/i, 'de vraag staat er met zoveel woorden');
  /* Geen vergelijking en geen cijfer: het scherm toont het WOORD van de
     beheersing met de reden erbij. (Op het woord "ranglijst" toetsen kan niet:
     dit bestand belooft in zijn eigen kop dat het er geen heeft.) */
  assert.match(leer, /beheersing\.woord/, 'het scherm toont het woord, niet een getal');
  assert.match(leer, /beheersing\.uitleg/, 'met de reden erbij');
  assert.doesNotMatch(leer, /percentiel|beter dan de klas|gemiddelde van de klas/i, 'bewijs is geen vergelijking');

  // de leraar legt vast wat hij ZIET, met een waarneming erbij
  assert.match(bewijs, /\/school\/bewijs\/observatie/);
  assert.match(bewijs, /\/school\/bewijs\/leerling/);
  assert.match(bewijs, /Wat zag u/, 'een observatie zonder waarneming is een vinkje');
  assert.ok(partner.includes('/apps/schoolpartner/bewijs.js'), 'School Partner laadt bewijs.js niet');
  assert.ok(partner.includes('id="bewijsVorm"'));
});

test('de Memory Engine loopt door dezelfde oefenweg, zonder verwijt', () => {
  const leer = lees('apps', 'rtgschool', 'leer.js');
  const rtgschool = lees('apps', 'rtgschool.html');

  assert.match(leer, /\/api\/leerstof\/herhalen/, 'het scherm vraagt niet op wat er terugkomt');
  assert.match(leer, /\/api\/leerstof\/herhaal'/, 'en start de herhaling niet');

  /* De kern van de belofte: een herhaalvraag ziet er hetzelfde uit als een
     nieuwe vraag. Daarom loopt hij door dezelfde kaart (vraagToon op
     'oefenKaart') en is er GEEN eigen antwoordroute -- die zou het verschil
     alsnog binnenlaten. */
  const start = leer.slice(leer.indexOf('async function herhaalStart'), leer.indexOf('async function oefenStart'));
  assert.match(start, /vraagToon\('oefenKaart'/, 'een herhaling hoort door dezelfde kaart te lopen');
  assert.doesNotMatch(leer, /herhaal-antwoord|herhaalAntwoord/, 'een herhaling wordt beantwoord door dezelfde functie');

  /* En er komt geen merkteken bij dat zegt "dit had je moeten weten". Gemeten
     aan de code en niet aan het commentaar: dit bestand belooft in zijn eigen
     kop dat zo'n merkteken er niet komt, en die belofte hoort te mogen staan. */
  assert.doesNotMatch(codeVan(leer), /te laat|achterstand|had je moeten|vergeten/i);
  for (const bron of [rtgschool, leerpaspoort]) {
    assert.ok(bron.includes('id="herhaalLijst"'), 'het scherm mist de kaart met wat terugkomt');
    assert.match(bron, /Niet omdat het fout ging/, 'de kaart hoort zelf te zeggen waarom iets terugkomt');
  }
});

/* Deze toets komt uit een echte fout: leerpaspoort.html hergebruikt leer.js met
   een vertaaltabel naar /api/rtf/leerling/*, en een nieuwe route in leer.js
   zonder regel in die tabel wordt een verzoek aan "/api/rtf/leerlingundefined".
   Dat is stil kapot -- het scherm meldt alleen "er ging iets mis". */
test('elke route die leer.js aanroept staat in de vertaaltabel van het leerpaspoort', () => {
  const leer = lees('apps', 'rtgschool', 'leer.js');
  const gevraagd = [...new Set((leer.match(/api\('\/api\/[a-z0-9/-]+'/g) || [])
    .map(m => m.slice(5, -1)))];
  assert.ok(gevraagd.length >= 6, 'de scan vindt te weinig routes; klopt het patroon nog?');
  for (const pad of gevraagd)
    assert.ok(leerpaspoort.includes("'" + pad + "':"), 'leerpaspoort.html vertaalt ' + pad + ' niet');
});

test('de Misconception Graph staat op drie schermen, en noemt nooit een kind', () => {
  const leer = lees('apps', 'rtgschool', 'leer.js');
  const oefenen = lees('apps', 'foundation', 'school-oefenen.js');
  const kaart = lees('apps', 'schoolpartner', 'denkfout.js');

  // de leerling ziet WAT er gedacht is, en de stof meteen anders uitgelegd
  for (const bron of [leer, oefenen]) {
    assert.match(bron, /denkfout\.naam/, 'het scherm toont de duiding niet');
    assert.match(bron, /Anders uitgelegd/, 'Explain Differently ontbreekt');
  }

  // de leraar ziet het klasbeeld, en kan een patroon afsluiten
  assert.match(kaart, /\/school\/denkfout\/klas/);
  assert.match(kaart, /\/school\/denkfout\/besproken/);
  assert.match(kaart, /x\.aantal/, 'het klasbeeld hoort te tellen');
  /* En het noemt geen kind. Niet omdat het scherm zich inhoudt, maar omdat de
     server het niet stuurt -- deze toets bewaakt dat het scherm er ook niet om
     vraagt en er geen eigen lijstje van maakt. */
  assert.doesNotMatch(kaart, /leerling:|sleutel|profielId|\/school\/klas'/,
    'het klasbeeld hoort niets over losse leerlingen op te halen');

  assert.ok(partner.includes('/apps/schoolpartner/denkfout.js'), 'School Partner laadt denkfout.js niet');
  assert.ok(partner.includes('id="denkfoutVorm"'));
  assert.ok(school.includes('school-oefenen.js'));
});

test('het dagplan staat op drie schermen, zonder teller en zonder tijdsdruk', () => {
  const leer = lees('apps', 'rtgschool', 'leer.js');
  const dag = lees('apps', 'foundation', 'school-dag.js');
  const rtgschool = lees('apps', 'rtgschool.html');

  assert.match(leer, /\/api\/leerstof\/dag/);
  assert.match(dag, /\/school\/dag/);

  /* De twee dingen die een dagplan bederven: een teller over dagen heen (dan
     wordt het een reeks die je niet mag missen) en zelfverzonnen haast. Geen
     van beide hoort in een scherm te kunnen sluipen. */
  for (const bron of [codeVan(leer), codeVan(dag)]) {
    assert.doesNotMatch(bron, /streak|reeks|achter elkaar|op rij|dagen af/i, 'er sluipt een teller in het dagplan');
    assert.doesNotMatch(bron, /nog maar|schiet op|haast|te laat/i, 'er sluipt tijdsdruk in het dagplan');
  }
  /* Elk stuk toont zijn REDEN. Op het renderen gemeten en niet op het woord
     "waarom": dat staat in leer.js ook al op de knop van Proof of Learning, en
     dan slaagt deze toets zonder dat er iets getoond wordt. */
  assert.match(codeVan(leer), /esc\(x\.waarom\)/, 'het dagplan toont de reden per stuk niet');
  assert.match(codeVan(dag), /esc\(s\.waarom\)/, 'het dagplan toont de reden per stuk niet');
  // en het scherm zegt zelf dat het een voorstel is
  for (const bron of [rtgschool, leerpaspoort])
    assert.match(bron, /voorstel, geen opdracht/i, 'het scherm doet alsof het een opdrachtenlijst is');
  assert.ok(rtgschool.includes('id="dagLijst"') && leerpaspoort.includes('id="dagLijst"'));
  assert.ok(school.includes('school-dag.js'), 'School laadt school-dag.js niet');
});

test('de werkbank draagt een lijst in drie bakken en rondt niets vanzelf af', () => {
  const bron = lees('apps', 'schoolpartner', 'aandacht.js');
  const code = codeVan(bron);

  assert.match(code, /\/school\/aandacht/);
  assert.match(code, /\/school\/les\/concept/);
  assert.match(code, /\/school\/les\/rond-af/);
  // Teaching Memory staat er VOOR het afronden, want dan heeft het nut
  assert.match(code, /\/school\/les\/geheugen/);
  assert.match(code, /Wat we van deze stof weten/);
  for (const bak of ['nu', 'vandaag', 'kanWachten'])
    assert.match(code, new RegExp("'" + bak + "'"), 'de bak ' + bak + ' staat niet op het scherm');

  // afronden gaat met bevestiging en met een naam, net als bij een rapport
  assert.match(code, /bevestigd: true/);
  assert.match(code, /zonder eigenaar is van niemand/i, 'het scherm laat afronden zonder naam toe');

  /* Geen teller over de tijd heen: werkdruk is hulp en geen beoordeling, dus
     er hoort geen doorlooptijd of "opgelost binnen" op dit scherm te staan. */
  assert.doesNotMatch(code, /doorlooptijd|binnen \d|opgelost|streak|score/i, 'er sluipt een prestatiemeter in de werklijst');

  assert.ok(partner.includes('/apps/schoolpartner/aandacht.js'), 'School Partner laadt aandacht.js niet');
  assert.ok(partner.includes('id="aandachtVorm"') && partner.includes('id="lesVorm"'));
});

test('de vervanger en de nieuwe docent hebben een scherm, met de firewall erop', () => {
  const bron = lees('apps', 'schoolpartner', 'instap.js');
  const code = codeVan(bron);

  assert.match(code, /\/school\/vervanging\/briefing/);
  assert.match(code, /\/school\/personeel\/start/);

  /* Het scherm toont met zoveel woorden wat er NIET in staat. Zonder die zin
     denkt een vervanger dat hij alles ziet, en dus dat er niets speelt -- en
     dat is precies het moment waarop een kind tussen wal en schip valt. */
  assert.match(code, /bewust niet in staat/i, 'de briefing zegt niet wat er ontbreekt');
  assert.match(code, /nietHierin/, 'het scherm toont de uitsluitingslijst van de server niet');

  // en de vervanger krijgt het materiaal met de tweede uitleg erbij
  assert.match(code, /m\.uitleg/, 'juist een vervanger heeft aan een tweede uitleg wat');
  assert.match(code, /eerder/, 'wat eerdere lessen opschreven hoort in de briefing');

  // geen voortgangsmeter op een mens
  assert.doesNotMatch(code, /voortgang|voltooid|van de 5|percentage|balk/i, 'er sluipt een voortgangsmeter op een docent in');

  assert.ok(partner.includes('/apps/schoolpartner/instap.js'), 'School Partner laadt instap.js niet');
  assert.ok(partner.includes('id="startVorm"') && partner.includes('id="vervangVorm"'));
});
