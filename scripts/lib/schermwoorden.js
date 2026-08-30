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
  const titel = (/<title[^>]*>([\s\S]*?)<\/title>/i.exec(html) || [])[1] || '';
  const h1 = (/<h1[^>]*>([\s\S]*?)<\/h1>/i.exec(html) || [])[1] || '';
  return [...new Set(woordenUit(titel + ' ' + h1.replace(/<[^>]+>/g, ' ')))];
}

/* BREDER, EN MET OPZET UIT EEN ANDERE HOEK. vanScherm() levert wat er IN de
   index gaat (titel en eerste kop); dit levert waar een lid het scherm verder
   aan herkent: de tussenkoppen. Zou de meter dezelfde woorden gebruiken die de
   index vult, dan meet hij zichzelf en staat hij altijd op honderd procent --
   en een meter die niet kan zakken, is geen meter. */
function vanSchermBreed(wortel, url) {
  const pad = path.join(wortel, 'public', String(url || '').split('?')[0].split('#')[0]);
  if (!url || !fs.existsSync(pad)) return [];
  let html = fs.readFileSync(pad, 'utf8');
  /* Script en stijl eruit VOORDAT er iets geteld wordt. Zonder dit sluipen
     `fromCharCode`, `svgHtml` en `disabled` binnen als 'woorden op het scherm',
     en dan meet je hoe een pagina geschreven is in plaats van wat er staat. */
  html = html.replace(/<script[\s\S]*?<\/script>/gi, ' ').replace(/<style[\s\S]*?<\/style>/gi, ' ');
  /* De woordenschat van een scherm zit in zijn BEDIENING en zijn tussenkoppen:
     etiketten die een mens leest en onthoudt. Niet in de lopende tekst -- die is
     proza, en wie daarop meet, meet of iemand de marketing kan navertellen. */
  const koppen = (html.match(/<h[23][^>]*>[\s\S]*?<\/h[23]>/gi) || [])
    .slice(0, 40).join(' ').replace(/<[^>]+>/g, ' ');
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
  let html = fs.readFileSync(pad, 'utf8');
  html = html.replace(/<script[\s\S]*?<\/script>/gi, ' ').replace(/<style[\s\S]*?<\/style>/gi, ' ');
  const uit = [];
  const zie = new Set();
  const pak = (re) => {
    let m;
    while ((m = re.exec(html)) && uit.length < 40) {
      let t = m[1].replace(/<[^>]+>/g, ' ').replace(/&[a-z]+;/g, ' ').replace(/\s+/g, ' ').trim();
      if (!t || t.length < 3 || t.length > 28) continue;
      if (t.split(' ').length > 3) continue;
      if (!/^[A-Za-zÀ-ÿ][A-Za-zÀ-ÿ' -]*$/.test(t)) continue;   // geen code, geen cijfers
      const sleutel = t.toLowerCase();
      if (zie.has(sleutel) || STOP.has(sleutel)) continue;
      zie.add(sleutel);
      uit.push(t);
    }
  };
  pak(/<button[^>]*>([\s\S]*?)<\/button>/gi);
  pak(/<a[^>]*class="[^"]*(?:tab|nav|kaart|knop)[^"]*"[^>]*>([\s\S]*?)<\/a>/gi);
  return uit;
}

module.exports = { STOP, woordenUit, vanScherm, vanSchermBreed, etikettenVan };
