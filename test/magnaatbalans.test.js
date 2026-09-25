/* Magnaat World 1.0: DE BALANS. De moeilijkheid schoof in V4 alleen het begin
   (startgeld, hoe laat klanten betalen, huur), en de automatische speler
   (./lib-magnaatspeler.js) liet zien dat het einde daardoor op alle drie de
   niveaus rond dag 60 lag. Sinds 1.0 bepaalt de moeilijkheid ook wanneer je
   bedrijf je draagt (hoe lang het bestaat, hoeveel keer je loon het binnenbrengt,
   en hoeveel weken loon je als buffer op de bank hebt), en op normaal en zwaar
   kun je echt verliezen: staat je huur te lang open, dan is dit leven voorbij.
   De speler is de meetlat: rond dag 70, 100 en 140. */
const test = require('node:test');
const assert = require('node:assert/strict');
const { maakSpeler } = require('./lib-magnaatspeler');
const R = require('../server/kern/magnaat-leven/regels');
const B = require('../server/kern/magnaat-leven/regels-bedrijf');
const { boekVan } = require('../server/kern/magnaat-leven/boek');
const { controleer } = require('../server/kern/magnaat-leven/bewaking');

const DOEL = { licht: [55, 80], normaal: [85, 115], zwaar: [125, 155] };

function totZelfstandig(moeilijkheid, aanbod) {
  const p = maakSpeler({ moeilijkheid, aanbod });
  for (let i = 0; i < 200 && !p.st().zelfstandig; i++) p.dag();
  return p.st().zelfstandig;
}

test('de moeilijkheid raakt het einde: de speler leeft van zijn bedrijf rond dag 70, 100 en 140', () => {
  for (const aanbod of ['websites', 'foto', 'administratie']) {
    const dagen = Object.keys(DOEL).map(m => totZelfstandig(m, aanbod));
    Object.keys(DOEL).forEach((m, i) => {
      assert.ok(dagen[i] >= DOEL[m][0] && dagen[i] <= DOEL[m][1], aanbod + ' op ' + m + ': dag ' + dagen[i] + ', verwacht ' + DOEL[m].join('-'));
    });
    assert.ok(dagen[0] < dagen[1] && dagen[1] < dagen[2], aanbod + ': zwaarder is later (' + dagen.join(', ') + ')');
  }
});

/* Slecht spelen: zodra je een onderneming hebt drie mensen aannemen, en dan
   alleen nog slapen. Het loon eet je rekening leeg en de huur blijft open. */
function slechtSpel(moeilijkheid) {
  const p = maakSpeler({ moeilijkheid });
  for (let i = 0; i < 80 && !p.st().onderneming; i++) p.dag();
  assert.ok(p.st().onderneming, 'de speler heeft een onderneming');
  for (const k of B.TEAMKANDIDATEN) assert.ok(!p.L.actie(p.key, { actie: 'werf', kandidaat: k.id }).error);
  for (let i = 0; i < 150 && !p.st().voorbij; i++) p.L.actie(p.key, { actie: 'slaap' });
  return p;
}

test('op zwaar en normaal kun je verliezen: na te lang open huur is dit leven voorbij, met een week waarschuwing', () => {
  for (const m of ['zwaar', 'normaal']) {
    const p = slechtSpel(m);
    const v = p.st().voorbij;
    assert.ok(v, m + ': het leven is voorbij');
    assert.match(v.reden, new RegExp('stond ' + R.MOEILIJKHEID[m].uitzetting + ' dagen open'));
    const huur = p.st().posten.find(x => x.soort === 'huur' && x.achterstand);
    assert.ok(huur && v.dag - huur.dag === R.MOEILIJKHEID[m].uitzetting, m + ': het is de huur van je kamer die de termijn haalde');
    assert.ok(p.st().meldingen.some(x => /Loon .* kon niet worden betaald/.test(x.tekst) && x.dag < v.dag - R.MOEILIJKHEID[m].uitzetting),
      m + ': het loon stond al eerder open, en dat alleen zette niemand uit');
    const w = p.st().meldingen.find(x => /zegt hij je kamer op/.test(x.tekst));
    assert.ok(w, m + ': de verhuurder waarschuwde');
    assert.equal(v.dag - w.dag, 7, m + ': een week van tevoren');
    assert.deepEqual(controleer(p.st(), boekVan(p.st())), [], 'de boeken kloppen ook bij het einde');
  }
  assert.equal(slechtSpel('licht').st().voorbij, undefined, 'op licht zet niemand je uit');
});

test('een leven dat voorbij is, staat stil: geen handelingen, de klok loopt niet, en opnieuw beginnen kan', () => {
  const p = slechtSpel('zwaar');
  const dag = p.st().dag;
  const s = p.L.staat(p.key);
  assert.deepEqual(s.vandaag.volgende, [], 'de Edge biedt niets meer aan');
  assert.match(s.verhaal.einde.tekst, /Op dag \d+ was het voorbij: je huur stond 21 dagen open/);
  assert.deepEqual(s.wereld.voorbij, p.st().voorbij);
  const r = p.L.actie(p.key, { actie: 'slaap' });
  assert.equal(r.status, 409);
  assert.match(r.error, /Dit leven is voorbij/);
  p.tijd(p.st().dagMs * 10);
  assert.equal(p.L.staat(p.key).dag, dag, 'er gaan geen dagen meer voorbij');
  const nieuw = p.L.actie(p.key, { actie: 'opnieuw', zeker: true, moeilijkheid: 'licht' });
  assert.ok(!nieuw.error);
  assert.equal(nieuw.dag, 1);
  assert.equal(nieuw.verhaal.einde, null);
  assert.equal(p.st().voorbij, undefined);
});

test('niets doen is geen verliezen: wie alleen in de keuken werkt, houdt zijn kamer', () => {
  for (const m of ['normaal', 'zwaar']) {
    const p = maakSpeler({ moeilijkheid: m });
    for (let i = 0; i < 200; i++) p.L.actie(p.key, { actie: 'slaap' });
    assert.equal(p.st().voorbij, undefined, m);
    assert.equal(p.st().dag, 201);
  }
});

test('zelfstandig vraagt ook een buffer: zonder weken loon op de bank zegt het spel nog niet dat het kan', () => {
  /* Twee keer hetzelfde leven (de speler is deterministisch): een keer gewoon,
     en een keer met de rekening de avond ervoor leeggehaald tot onder de buffer.
     De omzet is in beide gelijk; alleen de buffer verschilt. */
  const met = maakSpeler({ moeilijkheid: 'normaal' });
  for (let i = 0; i < 200 && !met.st().zelfstandigMag; i++) met.dag();
  const dag = met.st().zelfstandigMag;
  assert.ok(dag, 'met buffer kan het');
  const zonder = maakSpeler({ moeilijkheid: 'normaal' });
  while (zonder.st().dag < dag - 1) zonder.dag();
  const buffer = 4 * 24 * R.BAAN.uurloon, weg = zonder.st().kas - Math.round(buffer / 2);
  boekVan(zonder.st()).boekOver(zonder.st(), { soort: 'BOODSCHAPPEN', van: ['kas'], naar: ['winkels'], bedrag: weg, omschrijving: 'proef', sleutel: 'leeg' });
  zonder.dag();
  assert.equal(zonder.st().dag, dag);
  assert.equal(zonder.st().zelfstandigMag, undefined, 'zonder buffer niet, hoeveel er ook binnenkomt');
  const m = met.st().meldingen.find(x => /Je kunt je baan opzeggen/.test(x.tekst));
  assert.match(m.tekst, /afgelopen 9 weken .* meer dan twee keer je loon, en je hebt .* op de bank/);
});
