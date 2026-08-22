/* DE IJKING VAN HET VERVAL -- regel 2 van de lat, op de bewaker van de ratel.

   scripts/normverval.js bewaakt de enige plek waar de lat omlaag kan: de hand.
   Hij meldde bij zijn eerste draai groen, en dat zei niets -- er stond nog geen
   enkele notitie onder de eis. Een bewaker die nog nooit iets heeft
   tegengehouden is een geruststelling en geen bewaker.

   Elke proef hieronder zet een bekend-FOUTE NORM.json neer in een wegwerprepo
   en eist dat hij zakt, en meteen daarna de goede vorm en eist dat hij opent.
   Dat tweede is niet vanzelfsprekend: een regel die op alles uitslaat, houdt
   net zo weinig tegen als een regel die op niets uitslaat.

   VANDAAG KOMT UIT EEN OMGEVINGSVARIABELE (RTG_VERVAL_VANDAAG). Zonder dat
   haakje zou een verlopen schuld alleen te beproeven zijn door de klok van de
   machine te verzetten, en dat laat rommel achter zodra de proef halverwege
   sneuvelt -- de val die test/meterijk.test.js een halve bladzijde beschrijft.

   Draai los: node --test test/normverval.test.js */
'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const os = require('os');
const path = require('path');
const cp = require('child_process');

const SCRIPT = path.join(__dirname, '..', 'scripts', 'normverval.js');
const VANAF = '2026-01-01';

function metRepo(doe) {
  const map = fs.mkdtempSync(path.join(os.tmpdir(), 'rtg-verval-'));
  const git = (...a) => cp.execFileSync('git', a, { cwd: map, encoding: 'utf8' });
  const schrijfNorm = (obj) => fs.writeFileSync(path.join(map, 'NORM.json'), JSON.stringify(obj, null, 2) + '\n');
  try {
    git('init', '-q', '-b', 'main');
    git('config', 'user.email', 'ijking@rtg.test');
    git('config', 'user.name', 'ijking');
    return doe({
      map, git, schrijfNorm,
      draai: (vandaag, ...extra) => {
        const r = cp.spawnSync(process.execPath, [SCRIPT, ...extra], {
          cwd: map, encoding: 'utf8',
          env: { ...process.env, RTG_VERVAL_WORTEL: map, RTG_VERVAL_VANDAAG: vandaag || '2026-06-01' }
        });
        return { code: r.status, uit: (r.stdout || '') + (r.stderr || '') };
      }
    });
  } finally { fs.rmSync(map, { recursive: true, force: true }); }
}

/* Een NORM.json met de vervalregel erin en een echte meter (keuringTeGroot is
   'omlaag': hoger is slechter). Bewust een BESTAANDE meter, want de richting
   moet uit dezelfde bron komen als waar de ratel hem vandaan haalt. */
const grond = (extra) => ({ vastgelegd: '2026-01-01', vervalregel: { vanaf: VANAF }, meters: { keuringTeGroot: 10 }, ...extra });

function commitGrond(h, extra) {
  h.schrijfNorm(grond(extra));
  h.git('add', '-A'); h.git('commit', '-qm', 'grondslag');
  return h.git('rev-parse', 'HEAD').trim();
}

/* ==================== 1. DE STILLE VERLAGING ==================== */

test('een lat die met de hand wordt verlaagd ZONDER notitie laat hem zakken', () => {
  metRepo(h => {
    const basis = commitGrond(h);
    h.schrijfNorm(grond({ meters: { keuringTeGroot: 14 } }));      // slechter: hoger mag niet
    const r = h.draai(null, '--basis', basis);
    assert.equal(r.code, 1, 'dit is het gat waar dit script voor bestaat\n' + r.uit);
    assert.match(r.uit, /met de hand verlaagd van 10 naar 14 zonder notitie/);
  });
});

test('dezelfde verlaging MET een notitie die de meter noemt, komt erdoor', () => {
  metRepo(h => {
    const basis = commitGrond(h);
    h.schrijfNorm(grond({
      meters: { keuringTeGroot: 14 },
      notities: [{ datum: '2026-05-01', meter: 'keuringTeGroot 10 -> 14', reden: 'vier modules meeverhuisd',
        soort: 'schuld', sleutel: 'keuringTeGroot', van: 10, vervalt: '2026-12-01' }]
    }));
    const r = h.draai(null, '--basis', basis);
    assert.equal(r.code, 0, 'een verantwoorde verlaging hoort erdoor te komen\n' + r.uit);
    assert.match(r.uit, /verzet van 10 naar 14, met notitie/);
  });
});

test('een notitie over een ANDERE meter dekt de verlaging niet af', () => {
  metRepo(h => {
    const basis = commitGrond(h);
    h.schrijfNorm(grond({
      meters: { keuringTeGroot: 14 },
      notities: [{ datum: '2026-05-01', meter: 'dekkingPct 71 -> 70', reden: 'x', soort: 'structureel', waarheen: 'elders' }]
    }));
    const r = h.draai(null, '--basis', basis);
    assert.equal(r.code, 1, 'anders dekt een willekeurige notitie elke verlaging af\n' + r.uit);
    assert.match(r.uit, /zonder notitie/);
  });
});

test('de lat STRAKKER zetten mag zonder enige notitie', () => {
  metRepo(h => {
    const basis = commitGrond(h);
    h.schrijfNorm(grond({ meters: { keuringTeGroot: 6 } }));
    assert.equal(h.draai(null, '--basis', basis).code, 0, 'beter mag altijd, anders straft de bewaker vooruitgang af');
  });
});

test('een meter die HELEMAAL uit NORM.json verdwijnt, is de stilste verlaging van allemaal', () => {
  metRepo(h => {
    const basis = commitGrond(h);
    h.schrijfNorm(grond({ meters: {} }));
    const r = h.draai(null, '--basis', basis);
    assert.equal(r.code, 1, 'een weggehaalde meter mag niet als "niets veranderd" gelden\n' + r.uit);
    assert.match(r.uit, /is weg/);
  });
});

/* ==================== 2. DE VORM VAN DE NOTITIE ==================== */

test('een notitie onder de eis zonder soort laat hem zakken; met soort niet', () => {
  metRepo(h => {
    const basis = commitGrond(h);
    const met = (n) => { h.schrijfNorm(grond({ notities: [n] })); return h.draai(null, '--basis', basis); };

    let r = met({ datum: '2026-05-01', meter: 'iets', reden: 'omdat' });
    assert.equal(r.code, 1, 'zonder soort hoort hij te zakken\n' + r.uit);
    assert.match(r.uit, /geen soort/);

    r = met({ datum: '2026-05-01', meter: 'iets', reden: 'omdat', soort: 'structureel', waarheen: 'test/x.test.js' });
    assert.equal(r.code, 0, 'een volledige structurele notitie hoort erdoor\n' + r.uit);
  });
});

test('structureel zonder WAARHEEN is verlies en geen vormverandering', () => {
  metRepo(h => {
    const basis = commitGrond(h);
    h.schrijfNorm(grond({ notities: [{ datum: '2026-05-01', meter: 'iets', reden: 'omdat', soort: 'structureel' }] }));
    const r = h.draai(null, '--basis', basis);
    assert.equal(r.code, 1, r.uit);
    assert.match(r.uit, /WAARHEEN/);
  });
});

test('een schuld zonder vervaldatum, zonder sleutel of zonder "van" laat hem zakken', () => {
  metRepo(h => {
    const basis = commitGrond(h);
    const met = (n) => { h.schrijfNorm(grond({ notities: [Object.assign({ datum: '2026-05-01', meter: 'keuringTeGroot', reden: 'r', soort: 'schuld' }, n)] })); return h.draai(null, '--basis', basis); };
    assert.match(met({ sleutel: 'keuringTeGroot', van: 10 }).uit, /zonder vervaldatum/);
    assert.match(met({ sleutel: 'keuringTeGroot', vervalt: '2026-12-01' }).uit, /zonder "van"/);
    assert.match(met({ van: 10, vervalt: '2026-12-01' }).uit, /zonder bekende meter/);
    assert.equal(met({ sleutel: 'keuringTeGroot', van: 10, vervalt: '2026-12-01' }).code, 0, 'compleet hoort erdoor');
  });
});

test('een notitie van VOOR de begindatum wordt niet met terugwerkende kracht ingedeeld', () => {
  metRepo(h => {
    const basis = commitGrond(h);
    h.schrijfNorm(grond({ notities: [{ datum: '2025-11-01', meter: 'oud', reden: 'uit het register van voor de regel' }] }));
    assert.equal(h.draai(null, '--basis', basis).code, 0,
      'zonder deze grens struikelt de regel over de eigen historie en wordt hij binnen een dag uitgezet');
  });
});

/* ==================== 3. DE SCHULD WORDT GEIND ==================== */

test('een VERLOPEN schuld laat hem zakken zolang de meter niet terug is, en opent zodra hij dat wel is', () => {
  metRepo(h => {
    const schuld = (meterstand) => grond({
      meters: { keuringTeGroot: meterstand },
      notities: [{ datum: '2026-05-01', meter: 'keuringTeGroot 10 -> 14', reden: 'even niet', soort: 'schuld',
        sleutel: 'keuringTeGroot', van: 10, vervalt: '2026-07-01' }]
    });
    h.schrijfNorm(schuld(14));
    h.git('add', '-A'); h.git('commit', '-qm', 'met schuld');
    const basis = h.git('rev-parse', 'HEAD').trim();

    /* VOOR de vervaldatum: een lopende schuld is geen fout. */
    const voor = h.draai('2026-06-01', '--basis', basis);
    assert.equal(voor.code, 0, 'een schuld binnen zijn termijn mag staan\n' + voor.uit);
    assert.match(voor.uit, /loopt tot 2026-07-01/);

    /* NA de vervaldatum, meter nog steeds slecht: innen. */
    const na = h.draai('2026-08-01', '--basis', basis);
    assert.equal(na.code, 1, 'na de datum hoort de schuld geind te worden\n' + na.uit);
    assert.match(na.uit, /verlopen op 2026-07-01/);
    assert.match(na.uit, /staat op 14 en hoort terug naar 10/);

    /* NA de vervaldatum, meter hersteld: dan is hij afbetaald. */
    h.schrijfNorm(schuld(9));
    const betaald = h.draai('2026-08-01', '--basis', basis);
    assert.equal(betaald.code, 0, 'een afbetaalde schuld hoort geen fout meer te zijn\n' + betaald.uit);
    assert.match(betaald.uit, /afbetaald/);
  });
});

/* ==================== 4. DE UITZONDERINGEN VAN DE DELTAPOORT ==================== */

test('een uitzondering zonder vervaldatum of over de datum laat hem zakken', () => {
  metRepo(h => {
    const basis = commitGrond(h);
    const met = (u) => { h.schrijfNorm(grond({ uitzonderingen: [u] })); return h.draai('2026-06-01', '--basis', basis); };
    assert.match(met({ regel: 'inline-stijl', pad: 'public/x.html', reden: 'r' }).uit, /geen vervaldatum/);
    assert.match(met({ regel: 'inline-stijl', pad: 'public/x.html', reden: 'r', vervalt: '2026-01-05' }).uit, /verlopen op/);
    assert.equal(met({ regel: 'inline-stijl', pad: 'public/x.html', reden: 'r', vervalt: '2026-12-01' }).code, 0);
  });
});

/* ==================== 5. WAT ER GEBEURT ALS HIJ NIETS KAN ZIEN ==================== */

test('zonder vervalregel.vanaf zakt hij, en meldt hij niet dat het in orde is', () => {
  metRepo(h => {
    const basis = commitGrond(h);
    h.schrijfNorm({ vastgelegd: '2026-01-01', meters: { keuringTeGroot: 10 } });
    const r = h.draai(null, '--basis', basis);
    assert.equal(r.code, 2, r.uit);
    assert.match(r.uit, /geen vervalregel\.vanaf/);
    assert.doesNotMatch(r.uit, /Geen verlaging zonder reden/);
  });
});

test('zonder basis zakt hij met exitcode 2 en zegt hij dat de verlaging NIET is gemeten', () => {
  metRepo(h => {
    commitGrond(h);
    h.git('branch', '-m', 'main', 'losse-tak');
    const r = h.draai();
    assert.equal(r.code, 2, r.uit);
    assert.match(r.uit, /GEEN BASIS/);
    assert.doesNotMatch(r.uit, /Geen verlaging zonder reden/);
  });
});

test('een meter in NORM.json zonder vindbare richting laat hem zakken in plaats van gokken', () => {
  metRepo(h => {
    h.schrijfNorm(grond({ meters: { keuringTeGroot: 10, zzVerzonnenMeter: 5 } }));
    h.git('add', '-A'); h.git('commit', '-qm', 'met vreemde meter');
    const basis = h.git('rev-parse', 'HEAD').trim();
    h.schrijfNorm(grond({ meters: { keuringTeGroot: 10, zzVerzonnenMeter: 9 } }));
    const r = h.draai(null, '--basis', basis);
    assert.equal(r.code, 1, 'zonder richting is "slechter" niet te bepalen; dan hoort hij te zakken\n' + r.uit);
    assert.match(r.uit, /nergens een richting/);
  });
});

test('de richting van een meter die in een EIGEN script woont wordt gevonden', () => {
  /* Vijf meters wonen niet in norm.js maar in het script dat ze meet
     (dekking, samenhang, schermen, wetten). Die richting staat daar naast de
     METER-constante. Vindt dit script hem niet, dan valt elk van die vijf in
     de tak hierboven -- en dan is de bewaker onbruikbaar op precies de meters
     die het verst van de ratel af staan. */
    metRepo(h => {
    fs.mkdirSync(path.join(h.map, 'scripts'));
    fs.writeFileSync(path.join(h.map, 'scripts', 'proef.js'),
      "const METER = 'zzEigenMeter';\nconst RICHTING = 'omlaag';\n");
    h.schrijfNorm(grond({ meters: { keuringTeGroot: 10, zzEigenMeter: 3 } }));
    h.git('add', '-A'); h.git('commit', '-qm', 'eigen meter');
    const basis = h.git('rev-parse', 'HEAD').trim();

    h.schrijfNorm(grond({ meters: { keuringTeGroot: 10, zzEigenMeter: 8 } }));
    const r = h.draai(null, '--basis', basis);
    assert.equal(r.code, 1, r.uit);
    assert.match(r.uit, /zzEigenMeter/);
    assert.match(r.uit, /verlaagd van 3 naar 8 zonder notitie/,
      'hij moet de RICHTING kennen -- niet klagen dat hij hem niet weet');
  });
});

/* ==================== 6. DE TWEE FUNCTIES APART ====================
   Alles hierboven start het script als proces, en dat is met opzet: zo wordt de
   hele weg gelopen (git lezen, NORM.json parsen, oordelen, exitcode). Wat het
   NIET doet is de twee functies aanraken waar de fijne logica in zit, en de
   mutatiemotor merkte dat meteen op: hij vond geen module bij dit bestand, want
   het laadt er geen. Een toets waarvan de motor niet kan vaststellen WAT hij
   beproeft, telt terecht mee in `toetsenNietGemeten`.

   Deze twee proeven repareren dat bij de oorzaak in plaats van bij het getal. */
const verval = require('../scripts/normverval.js');

test('genoemdeMeters leest de metersleutels uit de vrije tekst van een notitie', () => {
  const bekend = new Set(['kernBreedte', 'kernGedeeld', 'dekkingPct']);
  assert.deepEqual(
    verval.genoemdeMeters({ meter: 'kernBreedte 1394 -> 1395; kernGedeeld 187 -> 188' }, bekend).sort(),
    ['kernBreedte', 'kernGedeeld'], 'twee meters in een notitie horen er allebei uit te komen');

  assert.deepEqual(verval.genoemdeMeters({ meter: 'niets bijzonders' }, bekend), []);
  assert.deepEqual(verval.genoemdeMeters({ sleutel: 'dekkingPct' }, bekend), ['dekkingPct'],
    'ook het gestructureerde veld telt mee, anders dekt een schuldnotitie zichzelf niet af');

  /* GEEN DEELWOORDEN. Zou dit op deelstring matchen, dan dekt een notitie over
     "kernBreedte" ook "kernBreedteXl" af, en dat is precies de soort stille
     dekking waar deze bewaker tegen is. */
  assert.deepEqual(verval.genoemdeMeters({ meter: 'kernBreedteXl 3 -> 4' }, new Set(['kernBreedte'])), [],
    'een langere naam die met een metersleutel begint, is niet die meter');
});

test('slechter kent het verschil tussen een vloer en een plafond', () => {
  assert.equal(verval.slechter('omlaag', 5, 3), true, 'hoger is slechter bij een plafond');
  assert.equal(verval.slechter('omlaag', 2, 3), false);
  assert.equal(verval.slechter('omhoog', 68, 71), true, 'lager is slechter bij een vloer');
  assert.equal(verval.slechter('omhoog', 75, 71), false);
  assert.equal(verval.slechter('omlaag', 3, 3), false, 'gelijk is niet slechter');
});
