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

test('directie, personeel, leraar en gezin krijgen elk een eigen professioneel dashboard', () => {
  for (const id of ['vPoort', 'linkBevestiging', 'vDirectie', 'dUitnodigen', 'dKpis', 'dEnterprise', 'dBeheer',
    'vPersoneel', 'pWerk', 'vLeraar', 'lKpis', 'lWerk']) {
    assert.ok(partner.includes('id="' + id + '"'), 'School Partner mist #' + id);
  }
  for (const script of ['toegang.js', 'directie-personeel.js', 'personeel.js'])
    assert.ok(partner.includes('/apps/schoolpartner/' + script), 'School Partner mist personeelsmodule ' + script);
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
