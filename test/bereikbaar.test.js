/* ELK SCHERM MOET TE BEREIKEN ZIJN DOOR TE TIKKEN. Geen aannames.

   DE AFSPRAAK (Rahul, 11 augustus 2026, strengste variant): een scherm telt
   pas als bereikbaar wanneer je er vanaf het beginscherm naartoe kunt TIKKEN.
   Vindbaar-via-zoeken telt NIET. Dat is een zwaardere eis dan het huis tot nu
   toe hanteerde, en met opzet.

   WAAROM. Er werd gevraagd waar Magnaat te spelen was. Antwoord: nergens --
   alleen door /apps/spelen.html met de hand in te typen. De oorzaak was
   algemeen: sinds een wereldtegel RECHTSTREEKS naar zijn wereldpagina
   navigeert, wordt de items-lijst van die tegel nergens meer getekend. Wat
   alleen daar stond, had geen enkele klikroute meer. Bij het meten bleek dat
   242 schermen 13 bereikbare opleverden.

   HOE ER GEMETEN WORDT. Als GRAAF, niet per pagina: begin bij /apps/app.html,
   volg elk /apps/*.html-pad dat een pagina of een van haar eigen scripts noemt,
   en herhaal. Zo telt ook een route van drie stappen mee, en zo valt een
   pagina die alleen naar zichzelf verwijst er juist uit.

   WAT DEZE TOETS NIET IS. Hij bewijst niet dat een scherm WERKT -- alleen dat
   er een weg heen is. Het bewijs dat het werkt hoort uit de schermtoetsen te
   komen, en die werden zonder browser stilzwijgend overgeslagen; zie
   test/skipwacht.test.js, die daar sinds vandaag rood van wordt.

   DE SCHULDLIJST staat in BEREIK.json en MAG ALLEEN KRIMPEN -- zelfde afspraak
   als BEKEND in scripts/check.js regel 45. Een nieuw scherm zonder klikroute
   zakt meteen; wie er een aansluit, haalt hem van de lijst (en ook dat zakt,
   anders slijt de lijst tot namen die niets meer zeggen). */
'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');

const WORTEL = path.join(__dirname, '..');
const { MERK: IJKMERK } = require('../scripts/lib/schonebron');
const START = '/apps/app.html';

function alleSchermen() {
  const uit = [];
  (function loop(d, pre) {
    for (const f of fs.readdirSync(d)) {
      const v = path.join(d, f);
      if (f.includes(IJKMERK)) continue;              // een ijkrestant is geen scherm; zie scripts/lib/schonebron.js
      if (fs.statSync(v).isDirectory()) loop(v, pre + f + '/');
      else if (f.endsWith('.html')) uit.push(pre + f);
    }
  })(path.join(WORTEL, 'public', 'apps'), '/apps/');
  return uit;
}

/* De paden die EEN pagina noemt -- inclusief haar eigen script en bundeldelen,
   want een tegelrij wordt vaak in JavaScript opgebouwd en staat dus niet in de
   HTML zelf. */
function noemt(p) {
  const naam = p.replace(/^\/apps\//, '').replace(/\.html$/, '');
  const eigen = path.join(WORTEL, 'public', p.replace(/^\//, ''));
  const bestanden = [eigen];
  /* De scripts die de pagina ZELF binnenhaalt tellen mee. Zonder deze stap las
     de graaf het beginscherm verkeerd: app.html noemt geen enkele app, want
     zijn tegels worden opgebouwd in /apps/app-main.js -- en dat bestand heet
     niet naar de pagina. De meting kwam daardoor op dertien bereikbare
     schermen uit terwijl de drie hoofdwerelden er gewoon stonden. Een graaf die de
     verkeerde randen volgt, meet niets. */
  try {
    for (const m of fs.readFileSync(eigen, 'utf8').matchAll(/<script[^>]+src="(\/[^"]+\.js)"/g)) {
      bestanden.push(path.join(WORTEL, 'public', m[1].replace(/^\//, '')));
    }
  } catch (e) { /* pagina onleesbaar: dan levert hij ook geen randen */ }
  for (const kand of [path.join(WORTEL, 'public', 'apps', naam + '.js'),
                      path.join(WORTEL, 'public', 'apps', naam)]) {
    try {
      if (fs.statSync(kand).isDirectory()) for (const f of fs.readdirSync(kand)) bestanden.push(path.join(kand, f));
      else bestanden.push(kand);
    } catch (e) { /* bestaat niet: geen script bij dit scherm */ }
  }
  /* RELATIEVE PADEN TELLEN OOK MEE, en dat is geen detail: het RTFoundation-huis
     linkt zijn drieenzestig schermen als 'agenda.html' en niet als
     '/apps/foundation/agenda.html'. Een graaf die alleen absolute paden leest
     verklaarde ze alle drieenzestig onbereikbaar terwijl ze gewoon op de hub
     staan. Tweede keer dat deze graaf de verkeerde randen volgde; vandaar dat
     het hier met zoveel woorden staat. */
  const map = path.posix.dirname(p);
  const uit = new Set();
  for (const b of bestanden) {
    let s = ''; try { s = fs.readFileSync(b, 'utf8'); } catch (e) { continue; }
    for (const m of s.matchAll(/\/apps\/[a-z0-9/-]+\.html/g)) uit.add(m[0]);
    // href="agenda.html" of src/href zonder schuine streep: los op tegen de eigen map
    for (const m of s.matchAll(/(?:href|src)=["']([a-z0-9-]+\.html)["']/g)) uit.add(path.posix.join(map, m[1]));
    for (const m of s.matchAll(/['"`]([a-z0-9-]+\.html)(?:[?#][^'"`]*)?['"`]/g)) uit.add(path.posix.join(map, m[1]));
  }
  return [...uit];
}

function bereikbaar(alle) {
  const gezien = new Set([START]), rij = [START];
  while (rij.length) {
    for (const q of noemt(rij.shift())) {
      if (alle.includes(q) && !gezien.has(q)) { gezien.add(q); rij.push(q); }
    }
  }
  return gezien;
}

test('geen NIEUW scherm zonder klikroute vanaf het beginscherm', () => {
  const alle = alleSchermen();
  assert.ok(alle.length > 100, 'de schermen zijn niet gevonden; dan meet deze regel niets');
  const schuld = new Set(JSON.parse(fs.readFileSync(path.join(WORTEL, 'BEREIK.json'), 'utf8')).schuld);
  const weg = alle.filter((a) => !bereikbaar(alle).has(a));
  const nieuw = weg.filter((w) => !schuld.has(w));
  assert.deepEqual(nieuw, [],
    'deze schermen zijn nergens aan te tikken en staan niet als schuld genoteerd:\n  ' + nieuw.join('\n  '));
});

test('en wie er een aansluit, haalt hem van de schuldlijst', () => {
  const alle = alleSchermen();
  const bron = JSON.parse(fs.readFileSync(path.join(WORTEL, 'BEREIK.json'), 'utf8'));
  const kan = bereikbaar(alle);
  const opgelost = bron.schuld.filter((s) => kan.has(s));
  assert.deepEqual(opgelost, [],
    'deze staan als schuld genoteerd maar zijn inmiddels aan te tikken; haal ze uit BEREIK.json:\n  ' + opgelost.join('\n  '));
  const verdwenen = bron.schuld.filter((s) => !alle.includes(s));
  assert.deepEqual(verdwenen, [],
    'deze schermen bestaan niet meer; haal ze uit BEREIK.json:\n  ' + verdwenen.join('\n  '));
});
