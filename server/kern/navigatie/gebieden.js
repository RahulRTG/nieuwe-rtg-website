/* DE GEBIEDEN VAN DE NAVIGATIE -- welke kaarten biedt RTG aan, welke staan er
   werkelijk, en welk gebied ligt er onder de voeten van deze gebruiker?

   WAAROM DEZE LAAG ER IS. De motor kende precies EEN gebied: Nederland, met
   een bbox en een bestandsnaam in de code (`binnenNederland`, `nederland.sqlite`,
   en een graafmap die letterlijk `nederland-graaf` heet). Daarbuiten viel alles
   terug op het demonstratieraster. Zolang er een land was, was dat eerlijk;
   zodra RTG er meer aanbiedt, is elke hardgecodeerde landsnaam een tweede
   waarheid (LAT.md regel 4).

   DE CATALOGUS IS EEN AFDRUK EN GEEN WENSLIJST. Een met de hand getypte lijst
   van tweehonderd landen ziet eruit als dekking en is het niet. Wat hier staat
   wordt daarom AFGELEID uit twee bronnen zonder mening:

     de INDEX      wat de bron ons kan leveren (het importscript schrijft hem
                   weg uit de bronindex; zonder index is de catalogus leeg MET
                   een reden, en niet stilzwijgend nul)
     de SCHIJF     welk pakket er werkelijk ligt in RTG_DATA_DIR

   Daaruit volgen drie standen die nooit door elkaar mogen lopen:

     aangeboden   de bron heeft dit gebied; wij kunnen het bouwen
     gebouwd      het pakket ligt er, en is dus te activeren
     actief       het is geladen en er valt hier werkelijk op te routeren

   "Aangeboden" is geen dekking. Wie die drie samentelt, belooft een kaart die
   niemand heeft gebouwd.

   EEN BBOX IS GEEN GRENS, en dat staat in elk antwoord: elk gebied draagt
   `vakIsGeenGrens` en een `grond` die zegt HOE het gekozen is. Zie
   `gebiedVoor()` hieronder voor wat er gebeurt als twee vakken overlappen.

   DE LICENTIE IS EEN GRENDEL EN GEEN VELD. Het NWB is CC0 en vraagt niets, OSM
   is ODbL en vraagt naamsvermelding; een pakket dat die plicht draagt en geen
   vermelding meelevert komt hier niet door. Zie `mag()`. */
'use strict';

const fs = require('node:fs');
const path = require('node:path');

/* Licenties die naamsvermelding EISEN. Niet "welke licenties bestaan er" maar
   "welke leggen ons een plicht op" -- de enige vraag die deze laag hoeft te
   beantwoorden. Onbekend telt als eisend: een licentie die wij niet kennen,
   krijgt niet het voordeel van de twijfel. */
const VRIJ = ['CC0', 'PUBLIC DOMAIN', 'PD'];
const eistNaamsvermelding = (licentie) => {
  const l = String(licentie || '').toUpperCase();
  if (!l) return true;
  return !VRIJ.some(v => l.startsWith(v));
};

const dataMap = () => process.env.RTG_DATA_DIR || path.join(__dirname, '..', '..', 'data');
const navMap = () => path.join(dataMap(), 'navigatie');
/* De index die het importscript wegschrijft uit de bronindex. Buiten Git: het
   is invoer voor een meting en geen bron (zelfde regel als het routejournaal). */
const indexPad = () => path.join(navMap(), 'gebieden.json');

/* HET PAKKET VAN EEN GEBIED. Twee bestanden per gebied: de SQLite met de
   r-tree-indexen en een map met de binaire graaf ernaast.

   DE GRAAFMAP KOMT UIT DE BESTANDSNAAM en niet uit een vaste tekst. Hier stond
   `path.join(dirname(bestand), 'nederland-graaf')`, en dat werkt zolang er een
   gebied is: een tweede pakket in dezelfde map zou de graaf van Nederland
   inlezen en er een Franse route op rekenen. */
function pakketVan(code) {
  const c = String(code || '').toLowerCase();
  const db = path.join(navMap(), c + '.sqlite');
  return { code: c, db, graafMap: path.join(navMap(), c + '-graaf') };
}
const pakketLigt = (code) => {
  const p = pakketVan(code);
  try { return fs.existsSync(p.db) && fs.existsSync(path.join(p.graafMap, 'graaf.json')); }
  catch (e) { return false; }
};

/* Wat de bron ons kan leveren. Ontbreekt de index, dan is het antwoord LEEG met
   een reden -- nooit stilzwijgend nul, want dat leest als "er is niets aan te
   bieden" in plaats van "wij hebben niet gekeken". */
function index() {
  const p = indexPad();
  if (!fs.existsSync(p)) {
    return { gebieden: [], reden: 'Er is nog geen gebiedsindex ingelezen; draai `npm run navigatie:index`. ' +
      'Zonder index weet RTG niet wat de bron kan leveren, en dat is iets anders dan dat er niets is.' };
  }
  try {
    const j = JSON.parse(fs.readFileSync(p, 'utf8'));
    const rij = Array.isArray(j.gebieden) ? j.gebieden : [];
    return { gebieden: rij, bron: j.bron || null, licentie: j.licentie || null, gelezenAt: j.gelezenAt || null };
  } catch (e) {
    return { gebieden: [], reden: 'De gebiedsindex is niet te lezen (' + e.message + '); hij wordt niet geraden.' };
  }
}

/* Een vak is geldig als het vier eindige getallen heeft die de aarde niet
   verlaten EN niet omgekeerd staan. Een omgedraaid vak omvat NIETS en zou als
   "past nergens" langskomen in plaats van als fout. */
function vakGeldig(v) {
  if (!v) return false;
  const n = [v.lat0, v.lat1, v.lng0, v.lng1].map(Number);
  if (!n.every(Number.isFinite)) return false;
  if (Math.abs(n[0]) > 90 || Math.abs(n[1]) > 90) return false;
  if (Math.abs(n[2]) > 180 || Math.abs(n[3]) > 180) return false;
  return n[0] < n[1] && n[2] < n[3];
}
const inVak = (v, p) => vakGeldig(v) && p && Number.isFinite(Number(p.lat)) && Number.isFinite(Number(p.lng))
  && Number(p.lat) >= v.lat0 && Number(p.lat) <= v.lat1
  && Number(p.lng) >= v.lng0 && Number(p.lng) <= v.lng1;
const vakOppervlak = (v) => (v.lat1 - v.lat0) * (v.lng1 - v.lng0);

/* DE CATALOGUS: per gebied de drie standen, afgeleid en niet verklaard. */
function catalogus() {
  const idx = index();
  const rij = idx.gebieden
    .filter(g => g && g.code && g.naam)
    .map(g => ({
      code: String(g.code).toLowerCase(),
      naam: String(g.naam),
      soort: g.soort === 'stad' ? 'stad' : 'land',
      vak: g.vak || null,
      bron: g.bron || idx.bron || null,
      licentie: g.licentie || idx.licentie || null,
      naamsvermelding: g.naamsvermelding || null,
      /* Bytes van de bron, niet van ons pakket: wat een lid straks downloadt is
         de GEBOUWDE graaf en die is kleiner. Daarom heet dit veld naar zijn
         herkomst en niet `omvang` -- een getal dat het verkeerde ding meet is
         erger dan geen getal. */
      bronBytes: Number.isFinite(Number(g.bronBytes)) ? Number(g.bronBytes) : null,
      aangeboden: true,
      gebouwd: pakketLigt(g.code)
    }));
  return {
    gebieden: rij,
    telling: { aangeboden: rij.length, gebouwd: rij.filter(g => g.gebouwd).length },
    bron: idx.bron || null,
    gelezenAt: idx.gelezenAt || null,
    reden: idx.reden || null
  };
}

/* WELK GEBIED LIGT HIER.

   HIER STOND "HET KLEINSTE VAK WINT", EN DAT WAS FOUT -- gemeten en niet
   bedacht: het Belgische vak is kleiner dan het Nederlandse, dus Maastricht
   kwam op `belgie` uit, met een compleet ogende onderbouwing. Oppervlak zegt
   tussen twee LANDEN niets.

   Wat er nu staat zijn twee verschillende dingen. Een STAD in een LAND is echte
   omvatting, dus daar mag de fijnere winnen. Twee gebieden van DEZELFDE soort
   kan een rechthoek niet scheiden: dan wordt er niet gekozen -- is er precies
   een gebouwd pakket, dan is de keuze GEDWONGEN (en dat staat er zo bij), zijn
   er meer, dan komt er `null` met de kandidaten.

   Dat is met opzet onbevredigend: het juiste gereedschap is een grens en geen
   vak. Zolang die er niet is, is "met een rechthoek niet te zeggen" eerlijker
   dan een lid over het net van het buurland laten rijden. */
function gebiedVoor(punt, lijst) {
  const rij = Array.isArray(lijst) ? lijst : catalogus().gebieden;
  const passen = rij.filter(g => inVak(g.vak, punt));
  if (!passen.length) {
    return { gebied: null, grond: 'geen-vak', kandidaten: [],
      waarom: 'Geen aangeboden gebied omvat dit punt; RTG biedt hier (nog) geen kaart aan.' };
  }
  if (passen.length === 1) {
    return { gebied: passen[0], grond: 'enig-vak', vakIsGeenGrens: true, kandidaten: [] };
  }

  /* Een stad binnen een land is echte omvatting: is er precies een stad, dan
     wint die. Meer steden op hetzelfde punt is weer een overlap van gelijken. */
  const steden = passen.filter(g => g.soort === 'stad');
  if (steden.length === 1) {
    return { gebied: steden[0], grond: 'stad-in-land', vakIsGeenGrens: true,
      kandidaten: passen.filter(g => g !== steden[0]).map(g => g.code) };
  }

  const gebouwd = passen.filter(g => g.gebouwd);
  if (gebouwd.length === 1) {
    return { gebied: gebouwd[0], grond: 'enige-gebouwde', vakIsGeenGrens: true,
      kandidaten: passen.filter(g => g !== gebouwd[0]).map(g => g.code),
      waarom: 'Meerdere vakken omvatten dit punt; alleen van ' + gebouwd[0].code +
        ' ligt er een pakket, dus die keuze is gedwongen en niet gemeten.' };
  }
  return { gebied: null, grond: 'meerdere-vakken',
    kandidaten: passen.map(g => g.code).sort(),
    waarom: 'Dit punt ligt in ' + passen.length + ' vakken van dezelfde soort (' +
      passen.map(g => g.code).sort().join(', ') + '). Een rechthoek is geen grens en ' +
      'RTG kiest hier niet: een route over het net van het buurland is erger dan geen route.' };
}

/* DE POORT. Een pakket mag alleen worden aangeboden als zijn licentie is
   nagekomen. Weigeren geeft een REDEN terug en geen false: "mag niet" zonder
   waarom leidt tot een tweede onderzoek. */
function mag(gebied) {
  if (!gebied) return { ok: false, reden: 'Geen gebied opgegeven.' };
  if (!gebied.licentie) {
    return { ok: false, reden: 'Dit pakket noemt geen licentie. Zonder licentie weet RTG niet wat hij ' +
      'moet vermelden, en dan is doorlaten een gok met een juridisch gevolg.' };
  }
  if (eistNaamsvermelding(gebied.licentie) && !String(gebied.naamsvermelding || '').trim()) {
    return { ok: false, reden: 'De licentie ' + gebied.licentie + ' eist naamsvermelding, en dit pakket ' +
      'levert er geen. Een verplichting die nergens op het scherm staat, wordt hier niet doorgelaten.' };
  }
  return { ok: true, naamsvermelding: String(gebied.naamsvermelding || '').trim() || null,
    licentie: gebied.licentie };
}

module.exports = { catalogus, index, gebiedVoor, pakketVan, pakketLigt, mag,
  eistNaamsvermelding, vakGeldig, inVak, vakOppervlak, indexPad, navMap };
