/* ============================================================================
   DE WACHTERS -- en of ze echt kunnen zakken.

   LAT.md regel 10: een meter die je niet hebt zien uitslaan, meet niets.
   Deze toetsen bestaan daarom niet om te bevestigen dat de wacht groen wordt
   (dat is de makkelijke helft), maar om elk van zijn oordelen ECHT te laten
   omvallen: een onbekende Node-lijn, versiebronnen die het oneens zijn, een
   vlag die verdwijnt, een sonde die op TLS in plaats van op de app stukloopt.

   Waar dat het scherpst zit: `vlag gedrag telt nooit als overbodig`. Die
   toets legt een fout vast die deze wacht in zijn eerste versie ECHT maakte
   -- hij meldde --experimental-test-coverage als overbodig omdat de proef
   process.exit(0) was, en dat heeft geen enkele vlag nodig. Zonder deze
   toets komt die fout terug zodra iemand er een proef bij zet.

   Draai los: node --test test/grondwacht.test.js
   ========================================================================== */
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const os = require('os');
const path = require('path');

const grondwacht = require('../scripts/grondwacht.js');
const triage = require('../scripts/triage.js');

/* Een vaste kalender: de echte van nodejs.org verandert, en een toets die
   met de kalender meebeweegt toetst niets. Dit is een uitsnede van de vorm
   die nodejs/Release publiceert. */
const KALENDER = {
  v20: { start: '2023-04-18', lts: '2023-10-24', maintenance: '2024-10-22', end: '2026-04-30', codename: 'Iron' },
  v22: { start: '2024-04-24', lts: '2024-10-29', maintenance: '2025-10-21', end: '2027-04-30', codename: 'Jod' },
  v23: { start: '2024-10-16', maintenance: '2025-04-01', end: '2025-06-01' },
  v24: { start: '2025-05-06', lts: '2025-10-28', maintenance: '2026-10-20', end: '2028-04-30', codename: 'Krypton' },
  v25: { start: '2025-10-15', maintenance: '2026-04-01', end: '2026-06-01' }
};
const NU = new Date('2026-08-18T00:00:00Z');

/* ---------------------------------------------------------------- het einde */

test('eol: kent de fase en telt de dagen tot het einde', () => {
  const s = grondwacht.eol(KALENDER, 22, NU);
  assert.equal(s.eind, '2027-04-30');
  assert.equal(s.fase, 'onderhoud');       // maintenance ging in op 2025-10-21
  assert.equal(s.lts, true);
  assert.ok(s.dagen > 250 && s.dagen < 260, 'nog ruim 250 dagen, kreeg ' + s.dagen);
});

test('eol: een lijn die al voorbij is heet voorbij, met negatieve dagen', () => {
  const s = grondwacht.eol(KALENDER, 20, NU);   // eind 2026-04-30, dus al gepasseerd
  assert.equal(s.fase, 'voorbij');
  assert.ok(s.dagen < 0, 'dagen moet negatief zijn, kreeg ' + s.dagen);
});

/* DE MUTATIE: draait het huis op een major die de kalender niet kent, dan mag
   de wacht NIET groen worden. Stil doorlopen is hier het gevaarlijkste
   gedrag, want dat is precies de situatie waarin niemand meer patcht. */
test('eol: een onbekende major gooit, hij wordt niet stil overgeslagen', () => {
  assert.throws(() => grondwacht.eol(KALENDER, 99, NU), /kent v99 niet/);
  assert.throws(() => grondwacht.eol({}, 22, NU), /kent v22 niet/);
});

test('eol: een major zonder einddatum in de kalender gooit ook', () => {
  assert.throws(() => grondwacht.eol({ v22: { start: '2024-04-24' } }, 22, NU), /kent v22 niet/);
});

test('opvolger: kiest de hoogste lijn die al LTS is en nog niet afloopt', () => {
  assert.equal(grondwacht.opvolger(KALENDER, 22, NU).major, 24);
});

/* De oneven lijnen (23, 25) zijn hoger dan 22 maar nooit LTS. Een wacht die
   daarheen zou wijzen stuurt je naar een runtime die zelf binnen een halfjaar
   dood is. */
test('opvolger: slaat oneven niet-LTS-lijnen over', () => {
  const alleenOneven = { v22: KALENDER.v22, v23: KALENDER.v23, v25: KALENDER.v25 };
  assert.equal(grondwacht.opvolger(alleenOneven, 22, NU), null);
});

test('opvolger: een lijn die nog geen LTS is telt nog niet mee', () => {
  const vroeg = new Date('2025-06-01T00:00:00Z');   // v24 wordt pas LTS op 2025-10-28
  assert.equal(grondwacht.opvolger(KALENDER, 22, vroeg), null);
});

/* ------------------------------------------------------------ een waarheid */

const bron = (naam, major, verplicht = true) => ({ naam, major, verplicht, hoe: 'zet hem gelijk' });

test('eenWaarheid: alle bronnen eens is geen bevinding', () => {
  const u = grondwacht.eenWaarheid([bron('package.json', 22), bron('.nvmrc', 22), bron('ci.yml#1', 22, false)]);
  assert.deepEqual(u.bevindingen, []);
  assert.equal(u.major, 22);
});

/* DE MUTATIE die er het meest toe doet: de CI op 24 en de container op 22 is
   geen schoonheidsfoutje maar een gat in het bewijs. Groen in de CI zegt dan
   niets over de runtime die de klant raakt. */
test('eenWaarheid: bronnen die het oneens zijn geven een HARDE bevinding', () => {
  const u = grondwacht.eenWaarheid([bron('Dockerfile', 22), bron('ci.yml#1', 24, false)]);
  const b = u.bevindingen.find(x => x.code === 'VERSIES_ONEENS');
  assert.ok(b, 'VERSIES_ONEENS ontbreekt');
  assert.equal(b.ernst, 'hard');
  assert.match(b.wat, /Dockerfile=22/);
  assert.match(b.wat, /ci\.yml#1=24/);
  assert.equal(u.major, null, 'bij onenigheid mag de wacht geen winnaar verzinnen');
});

test('eenWaarheid: een ontbrekende verplichte bron is hard, een losse workflow zacht', () => {
  const u = grondwacht.eenWaarheid([bron('package.json engines.node', null), bron('ci.yml#1', null, false)]);
  const per = Object.fromEntries(u.bevindingen.map(b => [b.wat.split(' ')[0], b.ernst]));
  assert.equal(per['package.json'], 'hard');
  assert.equal(per['ci.yml#1'], 'zacht');
});

test('majorUit: leest de major uit elke vorm waarin hij hier voorkomt', () => {
  for (const [tekst, verwacht] of [['22', 22], ['v22', 22], ['22.11.0', 22], ['>=22', 22], ['^22.0.0', 22], ['22-slim', 22]]) {
    assert.equal(grondwacht.majorUit(tekst), verwacht, tekst);
  }
  assert.equal(grondwacht.majorUit(null), null);
  assert.equal(grondwacht.majorUit('lts/*'), null);
});

/* --------------------------------------------------------------- de bronnen */

test('versiebronnen: leest package.json, .nvmrc, Dockerfile en elke workflow', () => {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'rtg-wacht-'));
  fs.writeFileSync(path.join(tmp, 'package.json'), JSON.stringify({ engines: { node: '>=22' }, scripts: {} }));
  fs.writeFileSync(path.join(tmp, '.nvmrc'), '22\n');
  fs.writeFileSync(path.join(tmp, 'Dockerfile'), 'FROM rust:1.97-slim AS motor\nFROM node:22-slim\n');
  fs.mkdirSync(path.join(tmp, '.github', 'workflows'), { recursive: true });
  fs.writeFileSync(path.join(tmp, '.github/workflows/ci.yml'), "        with:\n          node-version: '22'\n          node-version: \"24\"\n");

  const bronnen = grondwacht.versiebronnen(tmp);
  const kaart = Object.fromEntries(bronnen.map(b => [b.naam, b.major]));
  assert.equal(kaart['package.json engines.node'], 22);
  assert.equal(kaart['.nvmrc'], 22);
  assert.equal(kaart['Dockerfile'], 22, 'de rust-FROM mag de node-FROM niet verdringen');
  assert.equal(kaart['.github/workflows/ci.yml#1'], 22);
  assert.equal(kaart['.github/workflows/ci.yml#2'], 24, 'elke node-version in een workflow telt apart');
  fs.rmSync(tmp, { recursive: true, force: true });
});

test('versiebronnen: een lege map levert lege bronnen, geen stille 22', () => {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'rtg-wacht-leeg-'));
  const bronnen = grondwacht.versiebronnen(tmp);
  assert.ok(bronnen.every(b => b.major === null), 'niets aanwezig, dus niets vastgelegd');
  assert.ok(bronnen.length >= 3, 'de verplichte bronnen worden wel genoemd');
  fs.rmSync(tmp, { recursive: true, force: true });
});

/* ---------------------------------------------------------------- de vlaggen */

test('vlaggenInGebruik: haalt de vlaggen uit de scripts zelf, ontdubbeld', () => {
  const v = grondwacht.vlaggenInGebruik({ scripts: {
    a: 'node --experimental-sqlite server.js',
    b: 'node --experimental-sqlite --test test/*.js',
    c: 'node --experimental-test-coverage --test',
    d: 'node gewoon.js'
  } });
  assert.deepEqual(v, ['--experimental-sqlite', '--experimental-test-coverage']);
});

/* DE MUTATIE: verdwijnt de vlag uit node, dan start elk script dat hem draagt
   niet meer. Dat is een storing en dus hard. */
test('vlagbevindingen: een vlag die node niet meer accepteert is HARD', () => {
  const nep = () => ({ metVlag: false, zonderVlag: true });
  const b = grondwacht.vlagbevindingen(['--experimental-sqlite'], nep);
  assert.equal(b.length, 1);
  assert.equal(b[0].code, 'VLAG_WEG');
  assert.equal(b[0].ernst, 'hard');
});

test('vlagbevindingen: een toegangsvlag die zonder vlag ook werkt is opruimwerk', () => {
  const nep = () => ({ metVlag: true, zonderVlag: true });
  const b = grondwacht.vlagbevindingen(['--experimental-sqlite'], nep);
  assert.equal(b[0].code, 'VLAG_OVERBODIG');
  assert.equal(b[0].ernst, 'zacht');
});

test('vlagbevindingen: een toegangsvlag die nog echt nodig is geeft niets', () => {
  const nep = () => ({ metVlag: true, zonderVlag: false });
  assert.deepEqual(grondwacht.vlagbevindingen(['--experimental-sqlite'], nep), []);
});

/* DE REGRESSIE. Een gedragsvlag verandert alleen HOE node draait; de code
   loopt zonder die vlag net zo goed, dus "werkt ook zonder" bewijst daar
   niets. De eerste versie van deze wacht meldde hem toch als overbodig. */
test('vlagbevindingen: een gedragsvlag telt nooit als overbodig', () => {
  const nep = () => ({ metVlag: true, zonderVlag: true });
  assert.deepEqual(grondwacht.vlagbevindingen(['--experimental-test-coverage'], nep), [],
    'een gedragsvlag die zonder vlag ook loopt is normaal, geen bevinding');
});

test('vlagbevindingen: een gedragsvlag die node weigert is nog steeds hard', () => {
  const nep = () => ({ metVlag: false, zonderVlag: true });
  const b = grondwacht.vlagbevindingen(['--experimental-test-coverage'], nep);
  assert.equal(b[0].code, 'VLAG_WEG');
  assert.equal(b[0].ernst, 'hard');
});

/* Een vlag zonder proef mag niet stil doorglippen: dan denkt de lezer van het
   rapport dat hij bewaakt wordt terwijl er niets gemeten is. */
test('vlagbevindingen: een vlag zonder proef meldt dat hij niet bewaakt wordt', () => {
  const b = grondwacht.vlagbevindingen(['--experimental-onbekend'], () => { throw new Error('mag niet gemeten worden'); });
  assert.equal(b[0].code, 'VLAG_ONGETOETST');
});

/* vlagstand meet met een ECHTE node, geen nabootsing. Als deze toets zakt is
   de meting zelf stuk en niet de code eronder. */
test('vlagstand: meet met een echte node en ziet een onzinvlag geweigerd worden', () => {
  const echt = grondwacht.vlagstand('--experimental-sqlite', "require('node:sqlite')");
  assert.equal(echt.metVlag, true, 'node:sqlite hoort met de vlag te laden');
  const onzin = grondwacht.vlagstand('--experimental-bestaat-niet', '0');
  assert.equal(onzin.metVlag, false, 'node hoort een onbekende vlag te weigeren');
});

/* ------------------------------------------------------------------ triage */

test('triage: onbereikbare naam is DNS en geen appstoring', () => {
  const u = triage.duid([{ pad: '/', fout: 'getaddrinfo ENOTFOUND rtg.example.com', status: 0 }]);
  assert.equal(u.laag, 'dns');
  assert.equal(u.terugrollen, false, 'een naam die niet oplost repareer je niet met een vorige versie');
});

test('triage: een verlopen certificaat is TLS en geen appstoring', () => {
  const u = triage.duid([{ pad: '/', fout: 'CERT_HAS_EXPIRED', status: 0 }]);
  assert.equal(u.laag, 'tls');
  assert.equal(u.terugrollen, false);
});

/* DE MUTATIE die het duurste onderscheid maakt: alles bereikbaar maar alles
   500 betekent dat de app zelf stuk is, en DAT is het geval waarin de vorige
   versie terugzetten wel helpt. */
test('triage: overal 5xx is de app, en dan mag er teruggerold worden', () => {
  const u = triage.duid([
    { pad: '/', status: 500 },
    { pad: '/api/gezond', status: 500 },
    { pad: '/apps/app.html', status: 502 }
  ]);
  assert.equal(u.laag, 'app');
  assert.equal(u.terugrollen, true);
});

test('triage: een 502 op alles is de rand, niet de app erachter', () => {
  const u = triage.duid([{ pad: '/', status: 502, fout: 'ECONNREFUSED' }, { pad: '/api/gezond', status: 0, fout: 'ECONNREFUSED' }]);
  assert.equal(u.laag, 'rand');
  assert.equal(u.terugrollen, false, 'een dichte rand komt niet door een vorige versie terug');
});

/* Eén reis stuk en de rest goed is GEEN volledige storing. Terugrollen op een
   enkele route is duurder dan de storing zelf. */
test('triage: een enkele stukke reis rolt nooit terug', () => {
  const u = triage.duid([
    { pad: '/', status: 200 },
    { pad: '/api/gezond', status: 200 },
    { pad: '/api/zoek', status: 500 }
  ]);
  assert.equal(u.laag, 'deels');
  assert.equal(u.terugrollen, false);
});

test('triage: alles groen is geen incident', () => {
  const u = triage.duid([{ pad: '/', status: 200 }, { pad: '/api/gezond', status: 204 }]);
  assert.equal(u.laag, 'geen');
  assert.equal(u.terugrollen, false);
});

/* Regel 3: een meter zakt als zijn invoer ontbreekt. Nul reizen betekent dat
   de sonde niets heeft gemeten, en dat is nadrukkelijk niet "alles goed". */
test('triage: zonder reizen is de uitslag onbekend, niet groen', () => {
  const u = triage.duid([]);
  assert.equal(u.laag, 'onbekend');
  assert.equal(u.terugrollen, false);
  assert.match(u.waarom, /niets gemeten|geen reizen/i);
});

/* ---------------------------------------------------------------- wetwacht */

const wetwacht = require('../scripts/wetwacht.js');

test('wetwacht: normaliseren haalt opmaak, scripts en sessieruis weg', () => {
  const a = wetwacht.normaliseer('<html><script>sessie("abc")</script><p>Artikel  5</p><!-- x --></html>');
  const b = wetwacht.normaliseer('<html><script>sessie("xyz")</script><P>ARTIKEL 5</P></html>');
  assert.equal(a, b, 'dezelfde wettekst met andere ruis hoort dezelfde vorm te geven');
  assert.equal(a, 'artikel 5');
});

test('wetwacht: een datum in de voettekst verandert de afdruk niet', () => {
  const a = wetwacht.afdruk(wetwacht.normaliseer('<p>tekst</p><footer>Bijgewerkt 01-02-2026</footer>'));
  const b = wetwacht.afdruk(wetwacht.normaliseer('<p>tekst</p><footer>Bijgewerkt 17-08-2026</footer>'));
  assert.equal(a, b);
});

/* DE MUTATIE die de wacht bestaansrecht geeft: verandert de wettekst zelf,
   dan MOET er een melding komen met de documenten erbij die eraan hangen. */
test('wetwacht: een gewijzigde bron geeft een melding met de geraakte documenten', () => {
  const register = { bronnen: [{ code: 'avg', naam: 'AVG', bron: 'x', afdruk: 'oud', gezienOp: '2026-01-01', raakt: ['DPIA.md'] }] };
  const b = wetwacht.vergelijk(register, { avg: { afdruk: 'nieuw' } });
  assert.equal(b.length, 1);
  assert.equal(b[0].code, 'BRON_GEWIJZIGD');
  assert.deepEqual(b[0].raakt, ['DPIA.md']);
});

test('wetwacht: een ongewijzigde bron geeft niets', () => {
  const register = { bronnen: [{ code: 'avg', naam: 'AVG', bron: 'x', afdruk: 'zelfde', raakt: [] }] };
  assert.deepEqual(wetwacht.vergelijk(register, { avg: { afdruk: 'zelfde' } }), []);
});

/* Regel 3, nogmaals, want hier is hij het duurst: een onbereikbare wetbron is
   NIET "niets veranderd". */
test('wetwacht: een onbereikbare bron is onmeetbaar, geen stil groen', () => {
  const register = { bronnen: [{ code: 'avg', naam: 'AVG', bron: 'x', afdruk: 'oud', raakt: [] }] };
  const b = wetwacht.vergelijk(register, { avg: { fout: 'HTTP 503' } });
  assert.equal(b[0].code, 'BRON_ONBEREIKBAAR');
  assert.equal(b[0].ernst, 'onmeetbaar');
  const b2 = wetwacht.vergelijk(register, {});
  assert.equal(b2[0].code, 'BRON_ONBEREIKBAAR', 'helemaal geen meting is ook onbereikbaar');
});

test('wetwacht: een bron zonder nulpunt vraagt om vastleggen, niet om paniek', () => {
  const register = { bronnen: [{ code: 'avg', naam: 'AVG', bron: 'x', afdruk: null, raakt: [] }] };
  const b = wetwacht.vergelijk(register, { avg: { afdruk: 'eerste' } });
  assert.equal(b[0].code, 'NOG_GEEN_AFDRUK');
  assert.equal(b[0].ernst, 'zacht');
});

/* De wacht spreekt nooit een oordeel uit over wat de wijziging betekent; hij
   wijst alleen. Dat is de grens uit CONCERN.md, en die hoort ook in de
   tekst van de melding zelf te staan. */
test('wetwacht: de melding legt het oordeel bij een mens, niet bij de wacht', () => {
  const register = { bronnen: [{ code: 'avg', naam: 'AVG', bron: 'x', afdruk: 'oud', raakt: ['DPIA.md'] }] };
  const b = wetwacht.vergelijk(register, { avg: { afdruk: 'nieuw' } });
  assert.match(b[0].waarom, /een mens/, 'de melding hoort zelf te zeggen dat het oordeel mensenwerk is');
});

test('wetwacht: meet gebruikt de meegegeven haler en vangt zijn fouten', async () => {
  const bronnen = [{ code: 'a', bron: 'url-a' }, { code: 'b', bron: 'url-b' }];
  const m = await wetwacht.meet(bronnen, async url => {
    if (url === 'url-b') throw new Error('HTTP 503');
    return '<p>tekst</p>';
  });
  assert.ok(m.a.afdruk);
  assert.equal(m.b.fout, 'HTTP 503');
});

test('wetwacht: het echte register laadt en elk raakt-doel bestaat', () => {
  const reg = wetwacht.leesRegister();
  assert.ok(reg.bronnen.length >= 4, 'AVG, AI-verordening, NIS2 en DORA horen er minstens in');
  for (const b of reg.bronnen) {
    for (const doel of b.raakt) {
      assert.ok(fs.existsSync(path.join(__dirname, '..', doel)), `${b.code} wijst naar ${doel}, maar dat bestaat niet`);
    }
  }
});

/* De slotcode: het cijfer waar de CI en de herstellus op afgaan. De eerste
   versie gaf 0 bij een ontbrekend nulpunt -- een maandronde die niets mat en
   toch slaagde. Deze toetsen leggen vast dat dat nooit terugkomt. */
test('wetwacht slotcode: geen nulpunt is KON NIET METEN (2), geen stil groen', () => {
  assert.equal(wetwacht.slotcode([{ code: 'NOG_GEEN_AFDRUK', ernst: 'zacht' }]), 2);
});

test('wetwacht slotcode: bij --vastleggen is het nulpunt net gezet, dan wel 0', () => {
  assert.equal(wetwacht.slotcode([{ code: 'NOG_GEEN_AFDRUK', ernst: 'zacht' }], true), 0);
});

test('wetwacht slotcode: onbereikbaar blijft 2, ook onder --vastleggen', () => {
  assert.equal(wetwacht.slotcode([{ code: 'BRON_ONBEREIKBAAR', ernst: 'onmeetbaar' }], true), 2,
    'vastleggen legt vast wat gemeten is; wat niet gemeten is blijft niet gemeten');
});

test('wetwacht slotcode: gewijzigd is 1, afgehandeld met vastleggen is 0, niets is 0', () => {
  assert.equal(wetwacht.slotcode([{ code: 'BRON_GEWIJZIGD', ernst: 'melden' }]), 1);
  assert.equal(wetwacht.slotcode([{ code: 'BRON_GEWIJZIGD', ernst: 'melden' }], true), 0);
  assert.equal(wetwacht.slotcode([]), 0);
});

/* De vooruitkijkende TLS-meting: de sonde meldt een certificaat dat binnen
   veertien dagen verloopt als mislukte reis, terwijl al het andere nog
   gewoon doorkomt. De triage moet dat als TLS duiden -- niet als 'deels'
   (dan gaat iemand in een route zoeken) en zeker niet als aanleiding om
   terug te rollen (een oude versie draagt hetzelfde certificaat). */
test('triage: een verlopend certificaat is TLS, ook als de reizen nog slagen', () => {
  const u = triage.duid([
    { pad: '/', status: 200 },
    { pad: '/api/gezond', status: 200 },
    { reis: 'tls-geldigheid', status: 0, gelukt: false, reden: 'certificaat verloopt over 9 dagen -- de vernieuwing hoort rond dag 30 te draaien' }
  ]);
  assert.equal(u.laag, 'tls', 'vooraankondiging hoort bij de TLS-laag, niet bij een route');
  assert.equal(u.terugrollen, false, 'een oude versie draagt hetzelfde certificaat');
});

/* De scanner die de opmaak eruit haalt is lineair en met de hand geschreven;
   dan horen de randen er expliciet in. De laatste toets is de reden dat hij
   bestaat: een sluittag met attributen (</script foo="bar">) glipte door het
   oude regex-patroon heen, en zoiets is precies waar half werkende filtering
   en een instabiele vingerafdruk beginnen. */
test('wetwacht: de scanner haalt script, style, commentaar en tags weg', () => {
  assert.equal(wetwacht.zonderOpmaak('<p>a</p><script>x=1</script>b<style>.c{}</style><!-- weg -->d').replace(/\s+/g, ' ').trim(), 'a b d');
});

test('wetwacht: hoofdletters en attributen in de tag maken niet uit', () => {
  assert.equal(wetwacht.zonderOpmaak('<SCRIPT type="text/javascript">gevaar()</SCRIPT>tekst').trim(), 'tekst');
});

test('wetwacht: een nooit gesloten script eet niet de hele wereld maar stopt netjes', () => {
  assert.equal(wetwacht.zonderOpmaak('voor<script>open blijft open').trim(), 'voor');
});

test('wetwacht: een sluittag met attributen sluit ook', () => {
  assert.equal(wetwacht.zonderOpmaak('<script>x</script data-a="b">na').trim(), 'na');
});
