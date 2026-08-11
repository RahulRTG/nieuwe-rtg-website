/* ============================================================================
   EEN GENRE MAG ALLEEN OPEN STAAN ALS ZIJN GEREEDSCHAP ER IS.

   WAAROM DIT BESTAAT

   Het register kende ooit 31 aanvraagbare genres. Dat getal kwam uit een lijst
   die iemand met de hand had ingetikt in kern/aanmeldingen/bedrijf.js, en alles
   daarbuiten werd stil omgezet naar 'zzp'. Die lijst is weg en vervangen door
   een toegangsstand per genre.

   Maar daarmee was de fout nog niet uit de wereld: die 42 gesloten genres
   kregen hun stand ook van een MENS -- van mij, in dezelfde ronde. Een
   handgemaakte lijst vervangen door een handgemaakte indeling is geen
   vooruitgang; het is dezelfde fout met een ander gezicht.

   Toen is er GEMETEN wat er werkelijk aan gereedschap bestond, en dat viel heel
   anders uit dan de indeling suggereerde: van de 24 genres die op 'binnenkort'
   stonden hadden er 24 hun caps volledig bediend. De zaak-app had tabs voor
   `marina` en `petcare`, de PDA kende de modules, en er stonden zelfs demozaken
   van type `golfclub`, `wintersport` en `weddingplanner` in de seed. Ze stonden
   dus niet dicht omdat er iets ontbrak -- ze stonden dicht omdat ze ooit niet
   in die 31 waren getypt.

   DEZE TOETS IS DE MAAT DIE DAT VOORTAAN AFDWINGT. Hij vraagt niet of iemand
   een genre terecht heeft ingedeeld; hij vraagt of de CAPS van dat genre ergens
   worden bediend. Vier bewijzen tellen, en elk is een gemeten feit:

     1. de zaak-app heeft er een tab voor   (cap: '...' in de TABDEF)
     2. de PDA kent hem als module          (kern/pda/modules.js)
     3. hij is een werkvorm-cap             (kern/werkvormen.js)
     4. hij heeft een eigen scherm of kern  (apps/<cap>.html, kern/<cap>.js)

   ER STOND HIER EEN VIJFDE, EN DIE IS ERUIT: "een genre dat al open staat
   draagt hem". Dat leek het sterkste bewijs -- bewezen in de praktijk -- en het
   was het zwakste, want het bevestigt zichzelf. Een mutatie liet dat zien: een
   verzonnen cap ('gehaktbal') op het open genre `hotel` kwam er glansrijk
   doorheen, omdat hotel open is en hotel hem draagt. Dat is geen meting maar
   een spiegel. De vier die overblijven wijzen allemaal naar code die ergens
   anders staat, en die kan een genre niet zelf produceren.

   Wie een genre openzet zonder dat zijn caps bediend worden, zakt hier. En wie
   een genre op 'binnenkort' laat staan terwijl het gereedschap er wel is, zakt
   ook -- want dat is een deur die zonder reden dicht zit.
   ========================================================================== */
'use strict';
const { test } = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const path = require('node:path');

const register = require('../server/seed/genres');
const VORMEN = require('../server/kern/werkvormen').VORMEN;

const WORTEL = path.join(__dirname, '..');

/* location en pricing krijgt ELKE zaak, ongeacht genre -- capsVan() zet ze er
   altijd bij. Ze bewijzen dus niets over gereedschap. */
const ALTIJD = new Set(['location', 'pricing']);

function bedieningsbewijs() {
  const uit = new Map();   // cap -> hoe hij bediend wordt

  // 1. de tabs van de zaak-app
  const app = path.join(WORTEL, 'public/apps/leverancier');
  for (const f of fs.readdirSync(app)) {
    for (const m of fs.readFileSync(path.join(app, f), 'utf8').matchAll(/cap: *'([a-z]+)'/g)) {
      if (!uit.has(m[1])) uit.set(m[1], 'tab in de zaak-app (' + f + ')');
    }
  }

  // 2. de modules van de PDA
  const pda = fs.readFileSync(path.join(WORTEL, 'server/kern/pda/modules.js'), 'utf8');
  for (const m of pda.matchAll(/^ {2}([a-z]+): '/gm)) {
    if (!uit.has(m[1])) uit.set(m[1], 'module in de PDA');
  }

  // 3. de werkvormen: caps die vanzelf verschijnen zodra een zaak iets DOET
  for (const [id, v] of Object.entries(VORMEN)) {
    for (const c of v.caps) if (!uit.has(c)) uit.set(c, 'werkvorm ' + id + ' (' + v.app + ')');
  }

  /* 4. een eigen scherm of kernmodule met de naam van de cap. Zo worden de
     wereld-caps bediend (ov, luchthaven, gemeente, marechaussee) en de twee die
     een hele app achter zich hebben: `redactie` heeft apps/redactie.html en
     `sportclub` heeft apps/sportclub.html. Die staan niet als tab in de
     zaak-app omdat ze een eigen scherm ZIJN. */
  for (const c of new Set(Object.values(register.GENRES).flatMap(g => g.caps))) {
    if (uit.has(c)) continue;
    if (fs.existsSync(path.join(WORTEL, 'public/apps/' + c + '.html'))) uit.set(c, 'eigen scherm apps/' + c + '.html');
    else if (fs.existsSync(path.join(WORTEL, 'server/kern/' + c + '.js'))) uit.set(c, 'eigen kern kern/' + c + '.js');
  }

  for (const c of ALTIJD) uit.set(c, 'krijgt elke zaak van capsVan()');
  return uit;
}

test('elk genre dat openstaat heeft gereedschap voor al zijn caps', () => {
  const bewijs = bedieningsbewijs();
  const kaal = [];
  for (const [id, g] of Object.entries(register.GENRES)) {
    if (!register.genreToegang(id, { viaUitnodiging: true }).ok) continue;
    for (const c of g.caps) {
      if (!bewijs.has(c)) kaal.push(id + ' draagt cap "' + c + '" die nergens bediend wordt');
    }
  }
  assert.deepEqual(kaal, [],
    'een genre dat je kunt aanvragen moet ook te bedienen zijn:\n  ' + kaal.join('\n  '));
});

test('geen genre staat dicht terwijl het gereedschap er wel is', () => {
  const bewijs = bedieningsbewijs();
  const onnodig = [];
  for (const id of register.genresMetStand('binnenkort')) {
    const mist = register.GENRES[id].caps.filter(c => !bewijs.has(c));
    if (!mist.length) onnodig.push(id);
  }
  assert.deepEqual(onnodig, [],
    'deze genres staan op "binnenkort" maar al hun caps worden bediend; ' +
    'een deur die zonder reden dicht zit is precies wat de 31-lijst was: ' + onnodig.join(', '));
});

test('de standen die NIET over gereedschap gaan, blijven met opzet dicht', () => {
  /* `intern` en `uitnodiging` zijn geen technische standen en horen dus NIET
     door de meting hierboven te worden opengezet. Een gemeente heeft prima
     gereedschap; zij hoort alleen niet door een partner te worden aangevraagd.
     Deze toets bewaakt dat het openen-op-bewijs die twee nooit meepakt. */
  for (const id of register.genresMetStand('intern')) {
    assert.equal(register.genreToegang(id).ok, false, id + ' hoort intern te blijven');
    assert.equal(register.genreToegang(id, { viaUitnodiging: true }).ok, false,
      id + ' hoort ook met een uitnodiging intern te blijven');
  }
  for (const id of register.genresMetStand('uitnodiging')) {
    assert.equal(register.genreToegang(id).ok, false, id + ' hoort alleen op uitnodiging open te gaan');
    assert.equal(register.genreToegang(id, { viaUitnodiging: true }).ok, true);
  }
  assert.ok(register.genresMetStand('intern').length >= 8);
  assert.ok(register.genresMetStand('uitnodiging').length >= 2);
});

test('geen enkel bewijs komt uit het register zelf', () => {
  /* De grendel op de meting. Elk van de vier bronnen moet naar code wijzen die
     BUITEN het genre-register staat -- anders bevestigt de lijst zichzelf, en
     dat is precies wat een mutatie hier heeft laten zien: een verzonnen cap op
     een open genre kwam er doorheen zolang "een open genre draagt hem" meetelde.

     Deze toets bewijst dat die bron weg is, door hem na te bootsen: een cap die
     ALLEEN door genres wordt gedragen en nergens anders voorkomt, hoort NIET
     als bediend te tellen. */
  const bewijs = bedieningsbewijs();
  const verzonnen = 'gehaktbal';
  assert.equal(bewijs.has(verzonnen), false, 'een cap die nergens bestaat hoort niet bediend te heten');

  /* En elke bron die WEL meetelt, noemt zijn vindplaats. Een bewijs zonder
     vindplaats is niet na te lopen. */
  for (const [cap, hoe] of bewijs) {
    assert.ok(hoe && hoe.length > 3, cap + ' heeft een leeg bewijs');
    assert.equal(/genre/.test(hoe), false,
      cap + ' wordt "bewezen" door het register zelf (' + hoe + '); dat is een spiegel, geen meting');
  }
});

/* ----------------------------------------------------------------------------
   DE MUTATIES DIE ZIJN GEDAAN (LAT-regel 2)

   1. een verzonnen cap ('gehaktbal') op een open genre  -> toets 1 zakt
   2. een genre met bediende caps op 'binnenkort' zetten -> toets 2 zakt
   3. 'intern' laten meelopen met viaUitnodiging         -> toets 3 zakt
   4. de tab- en PDA-bron uit bedieningsbewijs() halen    -> toets 4 zakt
   -------------------------------------------------------------------------- */
