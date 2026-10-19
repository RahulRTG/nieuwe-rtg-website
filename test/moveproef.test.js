/* DE MOVEPROEF -- het instrument, niet de keten.

   scripts/moveproef.js opent RTG Move in een echte browser en meet
   BETROUWBAARHEID.md bewijs 1: kan een LID hier werkelijk bij? Die vraag was
   hier duur -- RTG Move bestond drie commits lang als een API die geen enkel
   scherm aanriep, en zag er in elk register compleet uit.

   Die ronde duurt minuten en vraagt een Chromium; hier staat wat er van het
   INSTRUMENT waar moet blijven, plus een paar lexicale grendels op het scherm.

   WAT DIE TWEEDE HELFT WAARD IS. De browserproef is het echte bewijs -- hij
   vond de cookiemelding die over de primaire actie lag en zag hem zakken. De
   grendels hieronder zijn met opzet lexicaal (graad `vermoed`, LAT.md): ze
   bewijzen niet dat het scherm werkt, ze houden alleen de vorm tegen waarin het
   aantoonbaar stuk was. Wie ze voor het bewijs aanziet, meet een tekst.

   Draai los: node --test test/moveproef.test.js
   De keten zelf: npm run moveproef */
'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');

const WORTEL = path.join(__dirname, '..');
const bron = fs.readFileSync(path.join(WORTEL, 'scripts', 'moveproef.js'), 'utf8');
const scherm = fs.readFileSync(path.join(WORTEL, 'public', 'apps', 'move.html'), 'utf8');
/* Commentaar eruit voordat er iets over de CODE wordt beweerd -- anders zakt een
   toets op de uitleg van de reparatie die hij bewaakt. Dat is in
   test/navigatieproef.test.js en test/ritproef.test.js al eens gebeurd. */
const zonderUitleg = t => String(t)
  .replace(/\/\*[\s\S]*?\*\//g, ' ')
  .replace(/(^|[^:])\/\/[^\n]*/g, '$1 ');
const schermCode = zonderUitleg(scherm);

test('-1. MOVEPROEF.json mag alleen verbeteren', () => {
  /* De ratel. Stond de proef op 5 gesloten schakels en 4 gehouden storingen,
     dan is minder een regressie -- ook als de nieuwe ronde "groen" heet omdat
     er een schakel is weggehaald. Vandaar dat het AANTAL meetelt. */
  const p = path.join(WORTEL, 'MOVEPROEF.json');
  assert.ok(fs.existsSync(p), 'MOVEPROEF.json bestaat; draai npm run moveproef:vast');
  const j = JSON.parse(fs.readFileSync(p, 'utf8'));
  const gesloten = j.schakels.filter(s => s.stand === 'gesloten').length;
  const gehouden = j.storingen.filter(s => s.stand === 'gehouden').length;
  assert.ok(j.schakels.length >= 5, 'minstens vijf schakels (nu ' + j.schakels.length + ')');
  assert.ok(j.storingen.length >= 4, 'minstens vier storingen (nu ' + j.storingen.length + ')');
  assert.equal(gesloten, j.schakels.length, gesloten + ' van ' + j.schakels.length + ' schakels gesloten');
  assert.equal(gehouden, j.storingen.length, gehouden + ' van ' + j.storingen.length + ' storingen gehouden');
  assert.equal(j.sluit, true, 'de proef sluit');
});

test('1. de proef meldt zich niet af als er geen browser is', () => {
  /* Een proef die zichzelf overslaat wanneer een dienst ontbreekt, geeft dekking
     zonder dekking te leveren -- dat is wat de norm `zelfpoortendeToetsen` telt.
     Hier hoort een ontbrekende Chromium te ZAKKEN. */
  assert.match(bron, /geen Chromium gevonden/, 'hij zegt het als er geen browser is');
  assert.match(bron, /throw new Error\('geen Chromium gevonden/, 'en hij gooit in plaats van over te slaan');
});

test('2. de proef gebruikt een ECHT lid langs de echte deur', () => {
  /* Een nagebouwd token meet je eigen aanname en niet de deur. */
  assert.match(bron, /\/api\/auth\/register/, 'het proeflid komt uit de registratieroute');
  assert.ok(!/rtg_member_token['"]\s*,\s*['"](?!\$)/.test(bron.replace(/localStorage\.setItem\('rtg_member_token', t\)/g, '')),
    'er wordt geen token verzonnen');
});

test('3. de proef meet paginafouten en laat ze niet vallen', () => {
  /* De gedeelde schil laadt met `defer` en verbouwt de header; een TypeError
     daar sloopt een heel werkblad en ziet eruit als een flake. */
  assert.match(bron, /page\.on\('pageerror'/, 'hij luistert naar paginafouten');
  assert.match(bron, /stuk\.length === 0 \? 'gehouden' : 'gebroken'/, 'en een fout breekt een storing');
});

test('4. de proef eist dat de knop de LUCHTHAVEN noemt en niet de bestemming', () => {
  /* Dit is de scherpste schakel: bij een vlucht lopen "waar ga ik heen" en
     "waar moet ik zijn" uiteen. Met een mutatie nagemeten -- de knop uit
     `v.titel` in plaats van `p.label` laat schakel 4 alleen zakken ("Naar
     privejet"), terwijl schakel 5 blijft staan omdat de coordinaten wel uit de
     opgeloste plek komen. */
  assert.match(bron, /airport\|luchthaven/i, 'hij eist de luchthaven in het label');
  assert.match(bron, /!\/parijs\|bourget\/i\.test\(label\)/, 'en verbiedt de bestemming erin');
});

test('5. het scherm toont de DEKKING naast het oordeel', () => {
  /* MOVE.md noemt als grootste risico dat iemand een oordeel over de helft van
     een reis voor een oordeel over de reis aanziet. Een dekkingsgetal dat er
     niet staat, is geen voorbehoud. */
  assert.match(schermCode, /#mDekking/, 'de dekking heeft een eigen plek op het scherm');
  assert.match(schermCode, /d\.dekking/, 'en wordt uit het antwoord gelezen');
  assert.match(bron, /\/%\/\.test\(dekking\)/, 'en de proef eist hem ook echt');
});

test('6. het scherm verzint geen bestemming en geen oordeel', () => {
  /* Twee grenzen van de laag, en beide moeten op het SCHERM staan: zonder plek
     geen knop, en `oordeel: null` wordt nooit stilzwijgend groen. */
  assert.match(schermCode, /if \(!Number\.isFinite\(p\.lat\) \|\| !Number\.isFinite\(p\.lng\)\) return;/,
    'zonder een echt punt komt er geen verderknop');
  assert.match(schermCode, /d\.oordeel \|\| 'NIET_TE_BEPALEN'/,
    'een ontbrekend oordeel valt terug op NIET_TE_BEPALEN en niet op RUIM');
  assert.ok(!/RUIM/.test(schermCode.replace(/TEKST[\s\S]*?\};/, '').replace(/--ruim[^;]*;/g, '')
    .replace(/data-u="RUIM"/g, '').replace(/var\(--ruim\)/g, '')),
    'RUIM staat alleen in de vertaaltabel en de kleuren, nergens als terugval');
});

test('7. het scherm voert niets uit', () => {
  /* RTG Move zet klaar; verzetten raakt een tweede persoon en gebeurt in het
     domein na een bevestiging (MOVE.md grens 5). Dit scherm mag dus alleen de
     drie lezende routes aanroepen. */
  const paden = [...schermCode.matchAll(/'\/api\/move\/([a-z]+)'/g)].map(m => m[1]);
  assert.ok(paden.length >= 3, 'het scherm noemt zijn move-paden letterlijk');
  for (const p of paden) assert.ok(['reis', 'gevolg', 'volgende'].includes(p), 'onbekend move-pad: ' + p);
  assert.ok(!/\/api\/(booking|reisbureau|member)\//.test(schermCode),
    'het scherm boekt en verzet niets');
});

test('8. de verderknop bestaat pas met een bestemming, ook voor de Edge', () => {
  /* Hier stond de reparatie van de eigen onderbalk (.verderbalk): een vaste,
     aanraakbare balk met een onzichtbare lege knop, zodat de cookiemelding er
     niet overheen viel. Sinds batch 4 van TRAVELOS-MIGRATIE.md staat het scherm
     op het Design System: de Edge is de enige onderbalk en de knop is een
     gewone handeling van het scherm (data-ds-actie). Wat de reparatie bewaakte,
     blijft: er staat nooit een knop die nergens heen gaat. De knop woont in een
     vak dat verborgen is tot /api/move/volgende een echte plek heeft, en de
     Edge slaat een handeling in een verborgen vak over (public/ds/edge-modi.js). */
  assert.match(scherm, /<div id="verderVak" hidden>\s*<button[^>]*id="verder"[^>]*data-ds-actie=/,
    'de verderknop staat in een verborgen vak en is een handeling van het scherm');
  assert.match(schermCode, /\$\('#verderVak'\)\.hidden = false;/, 'het vak gaat pas open met een plek');
  const edge = fs.readFileSync(path.join(WORTEL, 'public', 'ds', 'edge-modi.js'), 'utf8');
  assert.match(edge, /!x\.closest\('\[hidden\]'\)/, 'de Edge biedt geen handeling aan uit een verborgen vak');
});

test('9. de hoek van de route-inhoud komt uit het systeem en niet uit het scherm', () => {
  /* Keuring 58: route-inhoud is recht; een afgeronde systeemlaag mag alleen uit
     de centrale laag komen. Sinds het Design System draagt dit scherm geen
     eigen stijl meer: geen <style>-blok en geen stijlattribuut, dus ook geen
     eigen hoek. De hoeken komen uit de radius-tokens van public/ds/. */
  assert.ok(!/<style\b/i.test(scherm), 'move.html draagt een eigen <style>-blok');
  assert.ok(!/\sstyle=/.test(scherm), 'move.html draagt een stijlattribuut');
  for (const m of schermCode.matchAll(/border-radius\s*:\s*([^;}]+)/g)) {
    assert.fail('ongeclassificeerde hoek in move.html: ' + m[1].trim());
  }
});
