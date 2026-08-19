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
  // aanwezigheid: het verzuimbeeld van EEN leerling (de klaslijst en het zetten
  // hebben sinds deze ronde wel een scherm)
  'aanwezigheid/leerling',
  // oudergesprekken: momenten en boeken
  'afspraak/boek', 'afspraak/momenten',
  // gebouw en veiligheid: passen en bezoekers
  'bezoeker/aanmeld', 'bezoeker/uit', 'pas/blokkeer', 'pas/geef', 'pas/passeer',
  // incidenten (melden, lijst, afhandelen)
  'incident/handel-af', 'incident/lijst', 'incident/meld',
  // geld: facturen, budgetten, subsidies, kantine, rapportage
  'budget/zet', 'factuur/boek', 'factuur/herinner', 'factuur/maak', 'financien/rapport',
  'kantine/saldo', 'subsidie/zet', 'machtiging/intrek', 'machtiging/lijst', 'machtiging/zet',
  // personeelszaken
  'hr/afwezig', 'hr/dossier', 'hr/gesprek', 'hr/gesprek/reactie', 'hr/mijn', 'hr/overzicht',
  'hr/uren', 'hr/verlof/besluit', 'hr/vervanging', 'hr/zet',
  // verlof van een leerling
  'verlof/aanvraag', 'verlof/besluit', 'verlof/lijst', 'verlof/mijn',
  // omroep: nieuwsbrief, herinneringen, vakgroep
  'herinnering/verstuur', 'herinneringen', 'nieuwsbrief', 'nieuwsbrief/lijst', 'vakgroep',
  // organisatie: vestigingen, opleidingen, schooljaarovergang
  'opleiding/zet', 'vestiging/zet', 'schooljaar/voer-uit', 'schooljaar/voorstel',
  // in- en uitschrijven van een geplaatste leerling
  'leerling/overstap', 'leerling/uitschrijf',
  // klasbeheer dat alleen via de andere kant loopt
  'klas/leraar-weg', 'klas/overname', 'klas/team', 'klas/vestiging',
  // oefen-huiswerk maakt de leerling nu in de leerapp, niet in het gezinsscherm
  'huiswerk/oefen', 'huiswerk/oefen-antwoord',
  // koppelingen en webhooks: aanzetten en weghalen
  'koppeling/zet', 'webhook/weg', 'webhook/zet',
  // toestemming vragen, peiling sluiten, personeelspeiling
  'toestemming/overzicht', 'toestemming/vraag', 'peiling/antwoord-personeel', 'peiling/sluit',
  // overig
  'export', 'mijn-rechten', 'signalen', 'toets/sluit', 'voortgang'
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
