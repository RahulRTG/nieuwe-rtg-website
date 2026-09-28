/* DE EDGEKAART LOOPT NIET ACHTER, EN ZE KAN ZAKKEN (EDGE.md par. 0 en 7).

   scripts/edgekaart.js legt vast wie in de Edge-lagen schrijft, beslist en leest,
   en welke rtg-gebeurtenissen nergens aankomen. Een kaart die niet meer bij de
   code past is erger dan geen kaart: hij wordt geloofd. Deze toets houdt zes
   dingen vast:

   1. elk citaat in de verklaring staat LETTERLIJK in zijn bestand;
   2. het ingecheckte register is wat de code vandaag oplevert (behalve de
      stempel) -- anders loopt EDGEKAART.json achter;
   3. elke dubbele eigenaar draagt een verklaring, en elke verklaring hoort bij
      een dubbele eigenaar;
   4. er is geen dood rtg-kanaal (sinds ronde 1), en de meting ziet levende;
   5. een etiket hangt aan een citaat, in beide richtingen (sinds ronde 2);
   6. wat de lexicale lezer in public/ vindt -- wie het tweede register vult, wie
      de wereld en wie de Edge 2-stand op body zet -- staat op de kaart (sinds
      ronde 2).

   DE MUTATIES, elk nagetrokken: verander een letter in een citaat van de
   verklaring (toets 1 zakt en noemt het bestand), voeg in een scherm een
   dispatchEvent van een nieuwe rtg-gebeurtenis toe zonder de kaart te draaien
   (toets 2 zakt), en haal een WAAROM-regel weg (toets 3 zakt). */
'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');
const kaart = require('../scripts/edgekaart.js');

const REGISTER = path.join(__dirname, '..', 'EDGEKAART.json');
/* De wandeling over public/ een keer: elk bestand met zijn bron zonder
   commentaar. Tijdens deze toets verandert er geen bestand op schijf; de
   mutaties hieronder raken alleen de KAART in het geheugen. */
const WAND = kaart.wandeling();

test('elk citaat van de verklaring staat letterlijk in zijn bestand', () => {
  assert.deepEqual(kaart.keur(), []);
  /* En de grendel kan zakken: een citaat dat er niet staat, wordt gemeld. */
  const rij = kaart.KAART[0], oud = rij[3][0][3];
  rij[3][0][3] = oud + ' /* bestaat niet */';
  try {
    const f = kaart.keur();
    assert.equal(f.length, 1);
    assert.match(f[0], /citaat staat er niet/);
  } finally { rij[3][0][3] = oud; }
});

/* EEN ETIKET HANGT AAN EEN CITAAT, IN BEIDE RICHTINGEN (EDGE.md par. 1, ronde 2).
   Toen etiketten en citaten los naast elkaar stonden, verlaagde het weghalen van
   ALLEEN een etiket de schuld (edgeDubbeleEigenaars) zonder een enkele keurfout.
   Nu wijst elk citaat naar het etiket waar het over gaat, en heeft elk etiket s
   of b minstens een citaat dat het draagt -- met een uitgeschreven tabel voor
   welke rol welke letter kan dragen (DRAAGT).

   Elke mutatie hieronder draait op de echte KAART in het geheugen en wordt
   teruggezet, zodat de toets zijn eigen grendel ijkt. DE MUTATIES OP DE BRON,
   elk nagetrokken: haal in scripts/edgekaart.js alleen het etiket
   'gebaar-drempel:b' weg bij rtg-edge-2-context.js (keur zakt: twee citaten
   hangen aan een etiket dat er niet meer staat), en zet op een citaat een naam
   die niet in de rij staat (keur zakt). */
function rij(pad) {
  const r = kaart.KAART.find((x) => x[0] === pad);
  assert.ok(r, pad + ' staat niet meer op de kaart; kies een andere rij voor deze proef');
  return r;
}
function metMutatie(r, veld, waarde, doe) {
  const oud = r[veld];
  r[veld] = waarde;
  try { return doe(); } finally { r[veld] = oud; }
}

test('een etiket hangt aan een citaat, in beide richtingen', () => {
  /* Alleen een etiket weg: de citaten die eraan hingen, wijzen nergens meer heen. */
  const context = rij('rtg-edge-2-context.js');
  assert.match(context[2], /gebaar-drempel:b/);
  const zonderEtiket = metMutatie(context, 2, context[2].replace(/ ?gebaar-drempel:b/, ''), () => kaart.keur());
  assert.equal(zonderEtiket.filter((f) => /hangt aan gebaar-drempel:b/.test(f)).length, 2, zonderEtiket.join('\n'));

  /* Alleen een LETTER weg (sb wordt s): de beslisser verdwijnt niet stil. */
  const casco = rij('rtg-edge-system.js');
  const zonderLetter = metMutatie(casco, 2, casco[2].replace('wereld:sb', 'wereld:s'), () => kaart.keur());
  assert.ok(zonderLetter.some((f) => /hangt aan wereld:b/.test(f)), zonderLetter.join('\n'));

  /* Een verkeerde naam op een citaat: een etiket dat niet in de rij staat. */
  const r0 = context[3][0], goed = r0[1];
  r0[1] = 'wereld:b';
  try {
    const f = kaart.keur();
    assert.ok(f.some((x) => /hangt aan wereld:b, en dat etiket staat niet in de rij/.test(x)), f.join('\n'));
  } finally { r0[1] = goed; }

  /* Een etiket s of b zonder citaat: het laatste citaat dat het droeg zegt '-'. */
  const signals = rij('rtg-adaptive-edge-signals.js');
  const pending = signals[3].find((c) => c[1] === 'presence:b');
  pending[1] = '-';
  try {
    const f = kaart.keur();
    assert.ok(f.some((x) => /etiket presence:b heeft geen citaat dat het draagt/.test(x)), f.join('\n'));
  } finally { pending[1] = 'presence:b'; }

  /* De tabel: een lezing draagt nooit een schrijver. */
  const schrijver = rij('rtg-adaptive-edge.js')[3].find((c) => c[1] === 'presence:s');
  schrijver[0] = 'leest';
  try {
    const f = kaart.keur();
    assert.ok(f.some((x) => /een citaat dat leest draagt geen schrijver/.test(x)), f.join('\n'));
  } finally { schrijver[0] = 'schrijft'; }

  assert.deepEqual(kaart.keur(), [], 'na elke mutatie staat de kaart weer zoals hij was');
});

test('de tabel DRAAGT zegt voor elke rol welke letters hij kan dragen', () => {
  assert.deepEqual(Object.keys(kaart.DRAAGT).sort(), [...kaart.ROLLEN].sort(), 'een rol zonder regel in de tabel kan niets dragen, en een regel zonder rol is dood');
  assert.equal(kaart.DRAAGT.leest, 'l', 'een lezing maakt niemand eigenaar');
  for (const [rol, letters] of Object.entries(kaart.DRAAGT)) {
    assert.match(letters, /^[sbl]+$/, rol);
    if (rol !== 'beslist') assert.ok(!letters.includes('b'), rol + ' is geen beslissing');
    if (rol === 'beslist') assert.ok(!letters.includes('s'), 'een beslissing is geen schrijver');
  }
  /* Rendert en projecteert tellen: ze dragen in de echte kaart een schrijver. */
  const r = kaart.bouw(WAND);
  const dragers = r.bestanden.flatMap((b) => b.rollen).filter((x) => x.etiket && x.etiket.endsWith(':s'));
  assert.ok(dragers.some((x) => x.rol === 'rendert'), 'geen enkel rendert-citaat draagt een schrijver');
  assert.ok(dragers.some((x) => x.rol === 'projecteert'), 'geen enkel projecteert-citaat draagt een schrijver');
});

test('EDGEKAART.json is wat de code vandaag oplevert', () => {
  const oud = JSON.parse(fs.readFileSync(REGISTER, 'utf8'));
  delete oud.stempel;
  const vers = kaart.bouw(WAND);
  assert.equal(JSON.stringify(vers), JSON.stringify(oud), 'EDGEKAART.json loopt achter op de code. Draai: npm run edgekaart');
});

test('elke dubbele eigenaar is verklaard, en elke verklaring hoort bij een dubbele eigenaar', () => {
  const r = kaart.bouw(WAND);
  assert.ok(r.dubbeleEigenaars.length > 0, 'de kaart hoort de meting te dragen');
  assert.deepEqual(r.dubbeleEigenaars.filter((d) => !d.waarom).map((d) => d.naam), []);
  assert.deepEqual(Object.keys(kaart.WAAROM).filter((n) => !r.dubbeleEigenaars.some((d) => d.naam === n)), []);
  assert.equal(r.telling.dodeKanalen, r.dodeKanalen.luisterZonderZender.length + r.dodeKanalen.zendZonderLuisteraar.length);
});

/* GEEN DOOD RTG-KANAAL (EDGE.md par. 11, ronde 1). Er waren er 17: zestien
   zijn weggehaald en rtg-palet-open is aangesloten. Een nieuwe zender zonder
   luisteraar (of andersom) laat deze toets zakken met de naam erbij.

   "Nul dood" mag nooit groen zijn doordat de wandeling niets zag (LAT regel 9):
   daarom eerst `levendeKanalen > 0`, en een zelfijking op de lezer.

   DE MUTATIES, elk nagetrokken: zet d.addEventListener('rtg-adaptive-identity',
   ...) terug in rtg-adaptive-edge-signals.js (zakt op luisteren zonder zender),
   zet de dispatch van rtg-volscherm terug (zakt op zenden zonder luisteraar),
   haal de rtg-palet-open-luisteraar uit werkruimte.html (idem), en laat de
   wandeling in kanalen() een map lezen die niet bestaat (zakt op levend). */
test('geen rtg-gebeurtenis zonder zender of zonder luisteraar', () => {
  const r = kaart.bouw(WAND);
  assert.ok(r.telling.levendeKanalen > 0, 'de wandeling over public/ zag geen enkel levend kanaal, dus deze toets meet niets');
  assert.deepEqual(r.dodeKanalen.luisterZonderZender.map((k) => k.naam), [], 'luistert naar een rtg-gebeurtenis die niemand verstuurt');
  assert.deepEqual(r.dodeKanalen.zendZonderLuisteraar.map((k) => k.naam), [], 'verstuurt een rtg-gebeurtenis waar niemand naar luistert');
  assert.deepEqual(kaart.events('x.js', "d.addEventListener('rtg-proef', f);").luistert, ['rtg-proef'], 'de lezer ziet een luisteraar');
  assert.deepEqual(kaart.events('x.js', "d.dispatchEvent(new CustomEvent('rtg-proef'));").zendt, ['rtg-proef'], 'de lezer ziet een zender');
});

/* DE AFGELEIDE CONTROLES HOUDEN DE KAART AAN DE CODE (EDGE.md par. 1, ronde 2).
   De kaart is verklaard, dus wat niemand opschrijft, staat er niet op -- zo stond
   de gebaarlaag er na ronde 1 niet op. Drie controles lezen de schrijvers
   lexicaal uit public/ en leggen ze naast de kaart: wie registerAction aanroept
   op de Edge-kern (gelijk aan de schrijvers van capability-register met die
   aanroep als citaat), wie data-rtg-world en wie data-rtg-edge-2-state op body
   zet (die staan erop met een s). Met de eerste is "het tweede register is
   leeg" in ronde 2 BEWEZEN: die lijst staat op nul (stap 18), en de zelfijking
   hieronder houdt vast dat hij nog kan zakken.

   Nul fouten mag nooit groen zijn doordat de lezer niets zag (LAT regel 9):
   daarom eerst dat elke controle iets vindt, en daarna een zelfijking met een
   nagemaakt bestand in de wandeling.

   DE MUTATIES OP DE BRON, elk nagetrokken: zet een bestand onder public/ met
   edge.registerAction(...) erin (controle 1 zakt), haal de rij van
   rtg-world-identity.js van de kaart (controle 2 zakt), en haal de rij van
   werk/command-entry.js van de kaart (controle 3 zakt). */
test('de afgeleide controles vinden wat de kaart moet dragen, en kunnen zakken', () => {
  const wand = WAND, nu = kaart.afgeleid(wand);
  assert.deepEqual(nu.fouten, []);
  for (const k of ['wereld', 'zichtbaarheidsstand']) {
    assert.ok(nu.gevonden[k].length > 0, 'de lezer vond niemand voor ' + k + ', dus deze controle meet niets');
  }
  assert.deepEqual(nu.gevonden.registerAction, [], 'het tweede register hoort leeg te zijn: niemand roept registerAction aan op de Edge-kern');
  const met = (pad, code) => kaart.afgeleid(wand.concat([[pad, code]])).fouten;
  const zakt = (fouten, re, wat) => assert.ok(fouten.some((f) => re.test(f)), wat + '\n' + fouten.join('\n'));

  zakt(met('public/shared/proef.js', "edge.registerAction({ id: 'proef' });"),
    /proef\.js: roept registerAction aan op de Edge-kern en staat niet op de kaart/, 'een nieuwe vuller van het tweede register');
  zakt(met('public/shared/proef.js', "w.RTGAdaptiveEdge.registerAction({ id: 'proef' });"),
    /proef\.js: roept registerAction aan/, 'de global zelf als ontvanger');
  zakt(met('public/shared/proef.js', "vreemd.registerAction({ id: 'proef' });"),
    /onbekende ontvanger `vreemd`/, 'een ontvanger die niemand kent');
  zakt(met('public/shared/proef.js', "document.body.setAttribute('data-rtg-world', 'work');"),
    /proef\.js: zet data-rtg-world op body en staat niet op de kaart als wereld:s/, 'een nieuwe wereldschrijver');
  zakt(met('public/apps/proef.html', "document.body.setAttribute('data-rtg-edge-2-state', 'focus');"),
    /proef\.html: zet data-rtg-edge-2-state op body/, 'een nieuwe schrijver van de Edge 2-stand, ook in een .html');
  zakt(met('public/apps/proef.html', '<script src="/site/platform-app.js"></script>'),
    /platform-app\.js: staat als zonder lader uitgezonderd, maar public\/apps\/proef\.html noemt/, 'een uitzondering waarvan de grond vervalt');

  /* Een uitzondering die niets meer uitzondert, zakt -- net als een WAAROM
     zonder dubbele eigenaar. */
  kaart.ANDERE_REGISTERS.push({ pad: 'public/shared/proef.js', ontvanger: 'x', reden: 'proef' });
  try { zakt(kaart.afgeleid(wand).fouten, /proef\.js: uitzondering voor `x\.registerAction` zonder aanroep/, 'een dode uitzondering'); }
  finally { kaart.ANDERE_REGISTERS.pop(); }
  kaart.ZONDER_LADER.push('public/site/proef.js');
  try { zakt(kaart.afgeleid(wand).fouten, /proef\.js: uitzondering zonder lader, maar het bestand zet de wereld niet/, 'een lege uitzondering'); }
  finally { kaart.ZONDER_LADER.pop(); }

  /* Andersom: de kaart noemt een aanroep die de lezer niet vindt. */
  kaart.KAART.push(['public/shared/proef.js', 'proef', 'capability-register:s', [['schrijft', 'capability-register:s', 'proef', 'x.registerAction(']]]);
  try { zakt(kaart.afgeleid(wand).fouten, /proef\.js: staat op de kaart als schrijver via registerAction, maar de lezer vindt de aanroep niet/, 'kaart zonder aanroep'); }
  finally { kaart.KAART.pop(); }

  /* En van de kant van de kaart: een rij weg, terwijl de code gelijk blijft. */
  for (const [p, re] of [['rtg-world-identity.js', /rtg-world-identity\.js: zet data-rtg-world/],
    ['public/apps/werk/command-entry.js', /command-entry\.js: zet data-rtg-edge-2-state/]]) {
    const i = kaart.KAART.findIndex((x) => x[0] === p);
    assert.ok(i >= 0, p + ' staat niet meer op de kaart; kies een andere rij voor deze proef');
    const [weg] = kaart.KAART.splice(i, 1);
    try { zakt(kaart.afgeleid(wand).fouten, re, 'de rij van ' + p + ' weg'); } finally { kaart.KAART.splice(i, 0, weg); }
  }
  assert.deepEqual(kaart.afgeleid(wand).fouten, [], 'na elke proef staat de kaart weer zoals hij was');
});
