/* ============================================================================
   DE TAALSCHIL -- WELKE TALEN WERKEN ZONDER NETWERK, EN WAAROM DIE.

   `schil` betekent in dit huis precies een ding: de bestandenlijst die
   public/sw.js voorcachet, oftewel wat een bezoeker ziet als hij offline start
   ("DE CACHENAAM IS DE VINGERAFDRUK VAN DE SCHIL"). Dit register vertaalt dat
   begrip naar taal: voor welke talen leveren we die schiltekst mee?

   WAAROM DIT NIET DE 114 IS. De vertaallaag kan 114 talen, maar dat werkt
   vandaag alleen MET netwerk: de tekst wordt van het scherm geschraapt, langs
   /api/vertaal/ui gestuurd en in de kast bewaard. Wie voor het eerst zonder
   verbinding binnenkomt, krijgt Nederlands. Gemeten: het offline oppervlak
   (html + client) is 13.965 unieke teksten, waarvan er 1409 in de voorgecachete
   schil staan -- dat is wat een offline start werkelijk toont. Alle 114 talen
   meeleveren zou ~199 kB gzip per taal kosten en iedereen laten betalen voor
   113 talen die hij nooit kiest.

   DE KEUZE IS VAN DE EIGENAAR EN GEEN AFLEIDING. Dit is de tien grootste
   sprekersgroepen ter wereld plus Nederlands. Een andere lijst is verdedigbaar
   (de VN-zes is de enige met een bron buiten onze eigen smaak); wat NIET
   verdedigbaar is, is de lijst op twee plekken laten staan. Daarom woont hij
   hier, en leiden sw.js, de bouwer en de meter hem hieruit af.

   NEDERLANDS STAAT ERIN EN KRIJGT GEEN BESTAND. Het is de brontaal: de tekst
   staat al in de HTML. Offline werkt het dus door constructie en niet door een
   catalogus -- vandaar dat SCHILTALEN elf lang is en DOELTALEN tien. Wie die
   twee door elkaar haalt, bouwt een leeg nl-bestand dat niets toevoegt en de
   dekking van de meter verwatert.

   FAIL CLOSED. Een code die niet in server/talen.js staat, laat het laden
   zakken in plaats van stil een taal over te slaan. Een taalregister dat
   zwijgend krimpt is precies de stilte waar BESTUUR.md tegen is.
   ========================================================================== */
'use strict';
const { bestaat, taal } = require('./talen');

/* De brontaal van dit huis. Alle schiltekst is Nederlands; een schil voor `nl`
   zou een tabel zijn die elke regel op zichzelf afbeeldt. */
const BRON = 'nl';

const SCHILTALEN = Object.freeze([
  'nl', // brontaal -- staat al in de HTML
  'zh', // Chinees
  'hi', // Hindi
  'es', // Spaans
  'ar', // Arabisch
  'bn', // Bengaals
  'pt', // Portugees
  'ru', // Russisch
  'ja', // Japans
  'fr', // Frans
  'en'  // Engels
]);

/* Een naam die nergens bestaat is geen taal maar een typefout, en die hoort
   hier hard te vallen -- niet pas in de browser van een bezoeker. */
const onbekend = SCHILTALEN.filter(c => !bestaat(c));
if (onbekend.length) {
  throw new Error('taalschil: onbekende taalcode(s) ' + onbekend.join(', ') +
    ' -- staat het wel in server/talen.js?');
}

/* De talen die werkelijk een bestand nodig hebben. */
const DOELTALEN = Object.freeze(SCHILTALEN.filter(c => c !== BRON));

const ALS_SET = new Set(SCHILTALEN);
function isSchiltaal(code) { return ALS_SET.has(String(code || '').toLowerCase()); }

/* Het adres van een schil. Op EEN plek, zodat de bouwer, de service worker en
   de leesweg in de client nooit uiteen kunnen lopen. */
const MAP = '/shared/taalschil';
function padVan(code) { return MAP + '/' + String(code).toLowerCase() + '.json'; }

/* Wat de service worker moet voorcachen. Afgeleid, nooit overgetypt. */
function schilPaden() { return DOELTALEN.map(padVan); }

function naamVan(code) { const t = taal(code); return t ? t.naam : String(code); }

module.exports = { BRON, SCHILTALEN, DOELTALEN, isSchiltaal, padVan, schilPaden, naamVan, MAP };
