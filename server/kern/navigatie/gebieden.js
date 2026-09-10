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

/* De paden en de strenge codecontrole wonen in ./pakket.js -- zie de kop daar
   voor waarom dat een grens is en geen hulpfunctie. Hier alleen doorgegeven,
   zodat een aanroeper EEN adres heeft voor deze laag. */
const { pakketVan, pakketLigt, codeVeilig, indexPad, navMap } = require('./pakket');

/* De index van schijf staat in ./gebiedsindex.js -- lezen en onthouden is een
   eigen taak, en dit bestand gaat over wat je met die index BEWEERT. */
const { index, indexStempel } = require('./gebiedsindex');

/* DE CATALOGUS WORDT OOK GECACHET, en dat is geen optimalisatie om de
   optimalisatie: `pakketLigt()` doet twee bestandscontroles per gebied, en de
   catalogus hangt via kern/navigatie.js aan navKaart, navBestemmingen, navPoi
   en navStatus. Bij tweehonderd aangeboden landen zijn dat vierhonderd
   schijfvragen per verzoek van een lid -- en die kosten staan nergens op een
   nota, dus niemand vindt ze terug.

   TWEE STEMPELS, want er zijn twee dingen die kunnen veranderen: de index
   (nieuwe gebieden) en de MAP waarin de pakketten liggen (een gebouwd pakket).
   Een map-mtime beweegt wanneer er een bestand bij komt of weggaat, dus een
   nieuw pakket verschijnt gewoon -- een cache die daarvoor een herstart vraagt,
   is het soort stille voorwaarde waar iemand een uur aan kwijt is. Eentje
   blijft er: de MOTOR van een nieuw pakket wordt pas na een herstart geladen,
   en dat zegt navigatie/gebiednetten.js zelf in zijn antwoord. */
let catCache = null;
function mapStempel() {
  try { return String(fs.statSync(navMap()).mtimeMs); }
  catch (e) { return 'geen-map'; }
}
function catalogus() {
  const stempel = indexStempel() + '|' + mapStempel();
  if (catCache && catCache.stempel === stempel) return catCache.uit;
  const uit = catalogusVers();
  catCache = { stempel, uit };
  return uit;
}
function catalogusVers() {
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
      /* `bron` mag erven (waar de index vandaan komt), `downloadAdres` NOOIT:
         dat is het adres van DIT pakket, en erven maakte van een gebied zonder
         adres een gebied dat te bouwen leek. */
      bron: g.bron || idx.bron || null,
      downloadAdres: g.downloadAdres || null,
      licentie: g.licentie || idx.licentie || null,
      /* DE NAAMSVERMELDING ERFT NET ALS DE LICENTIE, en dat is een reparatie:
         hij deed dat niet, en `mag()` weigerde daardoor ELK gebied van een
         bron die zijn plicht op de index verklaart in plaats van per rij. Zo
         staat het in de ODbL-index van OpenStreetMap, dus de hele catalogus
         viel stil om -- gevonden door test/navigatie-index.test.js, niet door
         te lezen. Een plicht per rij overtypen raakt bovendien een rij kwijt. */
      naamsvermelding: g.naamsvermelding || idx.naamsvermelding || null,
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
    /* De licentie van de BRON hoort in de catalogus: het scherm van een lid
       moet hem kunnen noemen, en hij stond wel in de index en niet hier. */
    licentie: idx.licentie || null,
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
  /* De stempel van de PAKKETMAP gaat mee naar buiten: ./gebiednetten.js hangt
     zijn hertest aan dezelfde verandering als deze cache, zodat catalogus en
     motor niet uit elkaar kunnen lopen. */
  pakketStempel: mapStempel,
  eistNaamsvermelding, codeVeilig, indexPad, navMap,
  /* Doorgegeven zodat er EEN adres is voor deze laag; de code staat in
     ./gebiedkeuze.js en niet twee keer. */
  vakGeldig: keuze.vakGeldig, inVak: keuze.inVak, vakOppervlak: keuze.vakOppervlak };
