/* DE WOORDEN DIE OP EEN SCHERM ZELF STAAN.

   Eén lezer voor twee gebruikers: scripts/sprongindex.js zet ze in de index
   zodat de sprong ze kan vinden, en scripts/vindbaar.js meet of dat lukt. Zou
   elk zijn eigen woordenlijst maken, dan meet de meter iets anders dan het huis
   doet -- en dat is precies het soort meting dat altijd groen staat.

   Wat een woord is: vier letters of meer, geen huiswoord dat overal staat. Die
   stoplijst is met opzet kort en saai; hij haalt ruis weg ("RTG", "beheer",
   "overzicht") en nooit een woord dat iets onderscheidt. */
'use strict';
const fs = require('fs');
const path = require('path');
/* GEEN REGEX MEER OP HTML. CodeQL noemde de vorige lezer twee keer HIGH
   (js/bad-tag-filter) en had gelijk: `<script[\s\S]*?<\/script>` is te
   misleiden, en dan lekt er code in de woordenlijst -- wat hier al een keer
   gebeurd is (`fromCharCode` stond als woord op een scherm). scripts/lib/ontleed.js
   loopt de tekst een keer door en weet in welke stand hij staat. */
const ontleed = require('./ontleed');

const STOP = new Set(['rtg', 'de', 'het', 'een', 'en', 'van', 'in', 'op', 'uw', 'je', 'mijn',
  'voor', 'met', 'bij', 'aan', 'die', 'dat', 'is', 'als', 'naar', 'over', 'onder', 'per',
  'alles', 'alle', 'meer', 'nieuw', 'nieuwe', 'beheer', 'overzicht', 'pagina', 'scherm',
  'app', 'apps', 'platform', 'foundation', 'rtfoundation', 'title', 'html']);

function woordenUit(tekst) {
  return String(tekst || '').toLowerCase()
    .replace(/&[a-z]+;/g, ' ')
    .split(/[^a-z0-9]+/)
    .filter((w) => w.length >= 4 && !STOP.has(w));
}

/* De titel en de eerste kop van een scherm: dat is wat een lid ervan ONTHOUDT.
   Bestaat het bestand niet, dan zijn er geen woorden -- geen verzonnen woorden. */
function vanScherm(wortel, url) {
  const pad = path.join(wortel, 'public', String(url || '').split('?')[0].split('#')[0]);
  if (!url || !fs.existsSync(pad)) return [];
  const html = fs.readFileSync(pad, 'utf8');
  const titel = ontleed.eersteElement(html, 'title');
  const h1 = ontleed.eersteElement(html, 'h1');
  return [...new Set(woordenUit(titel + ' ' + h1))];
}

/* BREDER, EN MET OPZET UIT EEN ANDERE HOEK. vanScherm() levert wat er IN de
   index gaat (titel en eerste kop); dit levert waar een lid het scherm verder
   aan herkent: de tussenkoppen. Zou de meter dezelfde woorden gebruiken die de
   index vult, dan meet hij zichzelf en staat hij altijd op honderd procent --
   en een meter die niet kan zakken, is geen meter. */
function vanSchermBreed(wortel, url) {
  const pad = path.join(wortel, 'public', String(url || '').split('?')[0].split('#')[0]);
  if (!url || !fs.existsSync(pad)) return [];
  const html = fs.readFileSync(pad, 'utf8');
  /* De woordenschat van een scherm zit in zijn BEDIENING en zijn tussenkoppen:
     etiketten die een mens leest en onthoudt. Niet in de lopende tekst -- die is
     proza, en wie daarop meet, meet of iemand de marketing kan navertellen.
     Script en stijl slaat de lezer zelf over, dus die kunnen hier niet meer
     binnensluipen als 'woord op het scherm'. */
  const koppen = ontleed.elementen(html, ['h2', 'h3'], 40).join(' ');
  return [...new Set(woordenUit(koppen).concat(woordenUit(etikettenVan(wortel, url).join(' '))))]
    .filter((w) => /^[a-zà-ÿ]+$/.test(w));
}

/* DE ETIKETTEN VAN EEN SCHERM, als etiketten en niet als woorden.

   vanSchermBreed() hakt ze in losse woorden voor de meting; dit levert ze heel,
   want een handeling heet "Fooi verdelen" en niet "fooi" plus "verdelen". Wat
   eruit gefilterd wordt is troep die door de ruwe lezer heen komt: stukken
   script, attributen, en alles wat geen zin is die een mens leest. Liever een
   etiket te weinig dan een lijst met `fromCharCode` erin. */
function etikettenVan(wortel, url) {
  const pad = path.join(wortel, 'public', String(url || '').split('?')[0].split('#')[0]);
  if (!url || !fs.existsSync(pad)) return [];
  const html = fs.readFileSync(pad, 'utf8');
  const uit = [];
  const zie = new Set();
  const neem = (t) => {
    t = String(t || '').replace(/\s+/g, ' ').trim();
    if (!t || t.length < 3 || t.length > 28) return;
    if (t.split(' ').length > 3) return;
    if (!/^[A-Za-zÀ-ÿ][A-Za-zÀ-ÿ' -]*$/.test(t)) return;   // geen code, geen cijfers
    const sleutel = t.toLowerCase();
    if (zie.has(sleutel) || STOP.has(sleutel)) return;
    zie.add(sleutel);
    uit.push(t);
  };
  /* HET GEGENEREERDE WERELDROOSTER TELT NIET MEE. Dat blok bevat de NAMEN van
     andere apps (scripts/wereldrooster.js schrijft ze in het huis van hun
     wereld); ze als HANDELING van dit huis opvoeren zou "Mall" een verrichting
     van Ontdekken maken, en zou de index bovendien van zichzelf laten groeien.
     Ze zijn al bestemming in shared/sprongindex.json, en daar horen ze.

     Met een indexOf-lus en niet met een patroon: de merktekens zijn vaste tekst,
     en dan is zoeken eerlijker dan matchen. */
  let schoon = html;
  for (;;) {
    const a = schoon.indexOf('<!-- WERELDROOSTER:');
    if (a < 0) break;
    const b = schoon.indexOf('<!-- /WERELDROOSTER -->', a);
    if (b < 0) break;
    schoon = schoon.slice(0, a) + ' ' + schoon.slice(b + '<!-- /WERELDROOSTER -->'.length);
  }
  ontleed.elementen(schoon, ['button'], 200).forEach(neem);
  /* De links die als tab, navigatie, kaart of knop bedoeld zijn -- dezelfde
     keuze als hiervoor, alleen leest de lezer nu de tag in plaats van een
     patroon over de hele pagina. Alle andere links zijn navigatie naar een
     ander scherm en geen handeling van dit scherm. */
  const bedienend = (tag) => /class\s*=\s*"[^"]*(?:tab|nav|kaart|knop)[^"]*"/i.test(tag);
  ontleed.elementen(schoon, ['a'], 200, bedienend).forEach(neem);
  return uit.slice(0, 40);
}

module.exports = { STOP, woordenUit, vanScherm, vanSchermBreed, etikettenVan };
