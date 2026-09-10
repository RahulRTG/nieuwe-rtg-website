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
   `vakIsGeenGrens` en een `grond` die zegt HOE het gekozen is. De regel zelf
   staat in ./gebiedkeuze.js -- daar is ook opgeschreven welke fout hij herstelt.

   DE LICENTIE IS EEN GRENDEL EN GEEN VELD. Het NWB is CC0 en vraagt niets, OSM
   is ODbL en vraagt naamsvermelding; een pakket dat die plicht draagt en geen
   vermelding meelevert komt hier niet door. Zie `mag()`. */
'use strict';

const fs = require('node:fs');
const path = require('node:path');
/* De gebiedsbepaling woont in een eigen module -- zie de kop daar voor waarom
   een rechthoek geen grens is. Hier alleen doorgegeven, zodat een aanroeper
   niet hoeft te weten dat het twee bestanden zijn. */
const keuze = require('./gebiedkeuze');

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

/* EEN GEBIEDSCODE WORDT EEN BESTANDSNAAM, DUS HIJ IS STRENG. Dit is geen
   voorzorg maar een reparatie: de code kwam uit een index die van BUITEN wordt
   opgehaald, en `pakketVan('../../../etc/passwd')` gaf gewoon
   `./etc/passwd.sqlite` terug -- de datamap uit. En het is niet eens een
   kwaadwillend geval: de bronindex draagt ids MET schuine strepen
   (`europe/netherlands`), dus het gewone geval maakte al stilletjes submappen
   aan waar `pakketLigt()` nooit meer keek.

   Alleen kleine letters, cijfers en koppeltekens, niet beginnend of eindigend
   op een koppelteken. Geen punt (dus geen `..`), geen streep, geen scheidingsteken.
   Wie een pad wil samenstellen uit iets van buiten, hoort het eerst te laten
   afkeuren; het VERTALEN van een bron-id naar een veilige code doet de
   indexschrijver, want alleen die kan een botsing zien. */
const VEILIG = /^[a-z0-9](?:[a-z0-9-]*[a-z0-9])?$/;
const codeVeilig = (code) => VEILIG.test(String(code || ''));

/* HET PAKKET VAN EEN GEBIED. Twee bestanden per gebied: de SQLite met de
   r-tree-indexen en een map met de binaire graaf ernaast.

   DE GRAAFMAP KOMT UIT DE CODE en niet uit een vaste tekst. Hier stond
   `path.join(dirname(bestand), 'nederland-graaf')`, en dat werkt zolang er een
   gebied is: een tweede pakket in dezelfde map zou de graaf van Nederland
   inlezen en er een Franse route op rekenen.

   Een onveilige code levert `null` en geen pad. Fail closed: een pad
   teruggeven dat "toch wel klopt" is precies hoe zo'n gat blijft bestaan. */
function pakketVan(code) {
  const c = String(code || '').toLowerCase();
  if (!codeVeilig(c)) return null;
  return { code: c, db: path.join(navMap(), c + '.sqlite'),
    graafMap: path.join(navMap(), c + '-graaf') };
}
const pakketLigt = (code) => {
  const p = pakketVan(code);
  if (!p) return false;
  try { return fs.existsSync(p.db) && fs.existsSync(path.join(p.graafMap, 'graaf.json')); }
  catch (e) { return false; }
};

/* Wat de bron ons kan leveren. Ontbreekt de index, dan is het antwoord LEEG met
   een reden -- nooit stilzwijgend nul, want dat leest als "er is niets aan te
   bieden" in plaats van "wij hebben niet gekeken". */
/* DE INDEX WORDT GECACHET OP ZIJN WIJZIGINGSTIJD, en dat is geen optimalisatie
   om de optimalisatie. `dekkingsbeeld()` hangt aan navStatus, dus dit bestand
   zou bij ELK statusverzoek van schijf komen. Op de mtime en niet blind: een
   cache die nooit vervalt, vraagt een herstart na een import -- en dat is
   precies het soort stille voorwaarde waar iemand een uur aan kwijt is. */
let cache = null;
function index() {
  const p = indexPad();
  let stempel = null;
  try { stempel = fs.existsSync(p) ? String(fs.statSync(p).mtimeMs) + ':' + p : 'weg:' + p; }
  catch (e) { stempel = 'onleesbaar:' + p; }
  if (cache && cache.stempel === stempel) return cache.uit;
  const uit = leesIndex(p);
  cache = { stempel, uit };
  return uit;
}
function leesIndex(p) {
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

/* DE CATALOGUS: per gebied de drie standen, afgeleid en niet verklaard. */
function catalogus() {
  const idx = index();
  /* EEN ONVEILIGE CODE VALT NIET STIL WEG. Hij komt uit een index van buiten,
     dus hij hoort geweigerd te worden EN geteld -- een gebied dat zonder een
     woord verdwijnt, zoekt iemand een middag. */
  const geweigerd = idx.gebieden.filter(g => g && g.code && g.naam && !codeVeilig(String(g.code).toLowerCase()))
    .map(g => String(g.code));
  const rij = idx.gebieden
    .filter(g => g && g.code && g.naam && codeVeilig(String(g.code).toLowerCase()))
    .map(g => ({
      code: String(g.code).toLowerCase(),
      naam: String(g.naam),
      soort: g.soort === 'stad' ? 'stad' : 'land',
      /* DE OUDER KOMT UIT DE BRON en is geen gok. De bronindex hangt
         `netherlands/noord-holland` onder `netherlands`; dat is verklaarde
         omvatting, en ./gebiedkeuze.js laat een kind daarom van zijn ouder
         winnen. Zonder dit veld zou de keuze terugvallen op oppervlak, en juist
         daarop kwam Maastricht een keer op Belgie uit. */
      ouder: g.ouder ? String(g.ouder).toLowerCase() : null,
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
    telling: { aangeboden: rij.length, gebouwd: rij.filter(g => g.gebouwd).length,
      geweigerd: geweigerd.length },
    geweigerd,
    bron: idx.bron || null,
    gelezenAt: idx.gelezenAt || null,
    reden: idx.reden || null
  };
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

/* Zonder lijst wordt de catalogus gebruikt: een aanroeper die alleen een punt
   heeft, hoeft niet te weten waar de gebieden vandaan komen. */
const gebiedVoor = (punt, lijst) => keuze.gebiedVoor(punt, Array.isArray(lijst) ? lijst : catalogus().gebieden);

module.exports = { catalogus, index, gebiedVoor, pakketVan, pakketLigt, mag,
  eistNaamsvermelding, codeVeilig, indexPad, navMap,
  /* Doorgegeven zodat er EEN adres is voor deze laag; de code staat in
     ./gebiedkeuze.js en niet twee keer. */
  vakGeldig: keuze.vakGeldig, inVak: keuze.inVak, vakOppervlak: keuze.vakOppervlak };
