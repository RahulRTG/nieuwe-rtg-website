/* DE KAART VAN DE VERMOGENS -- wat dit huis KAN, en wat waarvan afhangt.

   HET VERSCHIL MET DE PULS. ./puls.js kijkt naar de GEGEVENS: hoeveel objecten,
   wat staat open, waar verloopt een termijn. Dat is niet dezelfde vraag als
   "doet betalen het?". Een domein kan brandschoon zijn terwijl de dienst eronder
   plat ligt, en andersom.

   DEZE KAART IS DE ENIGE NIEUWE GEGEVENS IN DEZE LAAG: hij GROEPEERT en MEET
   NIET. Elk getal dat ./gezondheid.js toont, komt uit een laag die er al was.
   Een kaart die zelf telt, zegt op een dag iets anders dan het scherm waar hij
   over gaat -- dezelfde reden die in ./alarm.js staat.

   DE GROEPERING GAAT PER CATEGORIE, NIET PER FUNCTIE-ID. Er zijn 191
   schakelaars; een kaart die ze stuk voor stuk noemt, loopt binnen een maand
   achter en controleert dan precies de nieuwe niet. Per categorie VEROUDERT
   niet: een nieuwe schakelaar landt vanzelf goed. Dat elke categorie ergens
   valt, wordt onderaan afgedwongen -- eentje die nergens valt, verdwijnt stil,
   en dan staat er groen omdat er niets staat.

   HET FUNDAMENT DRAAGT DE REST. `bereikbaar` en `binnenkomen` hebben geen
   categorie: het zijn geen functies maar voorwaarden. Wie ze weghaalt, houdt een
   kaart over waarop alles groen staat terwijl de voordeur dicht zit. */
'use strict';

const { CATEGORIEEN } = require('../../functies/register');

/* `bronnen` zegt welke bestaande laag over dit vermogen iets mag zeggen; de
   motor weigert te oordelen als ze allemaal zwijgen. `proefHoudbaarUren` is hoe
   lang een gedraaide proef nog iets betekent -- daarna is het vervallen bewijs,
   en vervallen bewijs is geen bewijs. `alarmen` KOPPELT een alarm uit ./alarm.js
   aan het vermogen waar het over gaat; het oordeel blijft van het alarm. Een
   alarm dat hier bij niemand hangt, verdwijnt niet: ./gezondheid.js meldt het
   als "buiten de kaart" -- een alarm dat afgaat terwijl de kaart groen staat, is
   precies het geval waarvoor de kaart bestaat. */
const VERMOGENS = [
  { id: 'bereikbaar', naam: 'Bereikbaar', laag: 'fundament', leuntOp: [],
    mens: 'Het platform antwoordt.',
    waarvoor: 'Staat dit niet, dan doet niets het -- ook niet wat hieronder groen staat.',
    categorieen: [], bronnen: ['sonde', 'slo'], proefHoudbaarUren: 6,
    alarmen: ['doel-gezakt', 'budget-bijna-op', 'niets-van-buiten', 'sonde-storing'] },

  { id: 'binnenkomen', naam: 'Binnenkomen', laag: 'fundament', leuntOp: ['bereikbaar'],
    mens: 'Mensen kunnen inloggen en zijn wie ze zeggen.',
    waarvoor: 'Inloggen, sleutels, SSO, het paspoort en de identiteitskluis.',
    categorieen: ['Toegang en identiteit', 'Identiteit en veiligheid'],
    bronnen: ['meting', 'schakelaars'], proefHoudbaarUren: 24 },

  { id: 'betalen', naam: 'Betalen', laag: 'dienst', leuntOp: ['binnenkomen'],
    mens: 'Geld komt binnen en gaat de goede kant op.',
    waarvoor: 'De rekening, de wallet, SEPA, incasso, de kaart en de verificatie eromheen.',
    categorieen: ['Betalen & verificatie', 'Geld'],
    bronnen: ['meting', 'schakelaars'], proefHoudbaarUren: 24 },

  { id: 'leden', naam: 'De ledenkant', laag: 'dienst', leuntOp: ['binnenkomen'],
    mens: 'Leden kunnen boeken, bestellen en hun diensten gebruiken.',
    waarvoor: 'De RTG-app, de diensten eronder, de genres, het gezelschap.',
    categorieen: ['Leden (RTG-app)', 'Diensten (leden)', 'Genres & diensten', 'Cultuur en gezelschap'],
    bronnen: ['meting', 'schakelaars'], proefHoudbaarUren: 24 },

  { id: 'sociaal', naam: 'Het sociale', laag: 'dienst', leuntOp: ['binnenkomen'],
    mens: 'Mensen bereiken elkaar.',
    waarvoor: 'De Salon, ontmoetingen, de sociale laag en de familiekoppeling.',
    categorieen: ['Sociaal (De Salon)'],
    bronnen: ['meting', 'schakelaars'], proefHoudbaarUren: 24 },

  { id: 'apps', naam: 'De eigen apps', laag: 'dienst', leuntOp: ['binnenkomen'],
    mens: 'De eigen apps en de winkel doen het.',
    waarvoor: 'Spelen, podium, media, mall, bestanden, notities.',
    categorieen: ['Eigen apps', 'Winkel en media'],
    bronnen: ['meting', 'schakelaars'], proefHoudbaarUren: 24 },

  { id: 'zaken', naam: 'De zakenkant', laag: 'dienst', leuntOp: ['binnenkomen', 'betalen'],
    mens: 'Partners en personeel kunnen werken.',
    waarvoor: 'De kassa, de zaak-app, personeel, payroll en werving.',
    /* Festival hoort bij de zakenkant: terrein en diensten zijn werk van een
       zaak, en het gastzicht is een venster daarop. */
    categorieen: ['Partners (leveranciers)', 'Werk (zaken en personeel)', 'Personeel & integraties', 'Festival'],
    bronnen: ['meting', 'schakelaars'], proefHoudbaarUren: 24 },

  { id: 'foundation', naam: 'De RTFoundation', laag: 'dienst', leuntOp: ['binnenkomen'],
    mens: 'De stichting draait.',
    waarvoor: 'Het RTF-kantoor, de school, het lab en het levend laboratorium.',
    categorieen: ['RTFoundation'],
    bronnen: ['meting', 'schakelaars'], proefHoudbaarUren: 24 },

  { id: 'kantoor', naam: 'Het kantoor', laag: 'dienst', leuntOp: ['binnenkomen'],
    mens: 'Wij kunnen bij onze eigen bediening.',
    waarvoor: 'De backoffice, RTG Command zelf, de bedrijven- en tenantlaag.',
    categorieen: ['RTG-Backoffice'],
    bronnen: ['meting', 'schakelaars'], proefHoudbaarUren: 24,
    alarmen: ['canary-teruggerold'] },

  { id: 'gegevens', naam: 'De gegevens', laag: 'fundament', leuntOp: [],
    mens: 'De gegevens hangen aan elkaar.',
    waarvoor: 'Wezen, dubbele sleutels, verwijzingen die nergens aankomen.',
    categorieen: [], bronnen: ['kwaliteit'], proefHoudbaarUren: 24,
    alarmen: ['gegevens-kapot'] },

  { id: 'sporen', naam: 'De sporen', laag: 'fundament', leuntOp: [],
    mens: 'Wat er gebeurde is achteraf terug te lezen.',
    waarvoor: 'De hashketen van het journaal van RTG Command.',
    categorieen: [], bronnen: ['journaal'], proefHoudbaarUren: 24,
    alarmen: ['journaal-gebroken'] },

  { id: 'bewaren', naam: 'Het bewaren', laag: 'fundament', leuntOp: [],
    mens: 'Er staat een back-up, en er zit iets in.',
    waarvoor: 'De dagback-up: de marker van de schrijver, de bestanden, db.json.',
    categorieen: [], bronnen: ['backup'], proefHoudbaarUren: 30 * 24,
    /* HET PLAFOND. Dit komt niet op `bewezen`, ook niet na een controleronde:
       backupstand.js kijkt na of de bestanden er zijn en of db.json opent, en
       dat is geen terugzetproef -- die bestaat platformbreed niet (zie
       kern/tenant/bewijs-sla.js). Het staat hier en niet bij de bron, zodat er
       een plek is waar het weggaat op de dag dat die proef er wel is. */
    graadPlafond: 'gemeten' }
];

const OP_ID = Object.fromEntries(VERMOGENS.map(v => [v.id, v]));

/* De fail-fasts. Ze falen bij het OPSTARTEN en niet bij het tekenen: een kaart
   die pas op het scherm blijkt te rammelen, heeft iemand al gerustgesteld. */

/* 1. Leunen op iets dat niet bestaat, laat de doorwerking stil een tak overslaan. */
for (const v of VERMOGENS) for (const op of v.leuntOp)
  if (!OP_ID[op]) throw new Error('vermogens: "' + v.id + '" leunt op onbekend vermogen "' + op + '"');

/* 2. Een kring laat de doorwerking eeuwig lopen. */
{
  const staat = {};
  const loop = (id, pad) => {
    if (staat[id] === 'klaar') return;
    if (staat[id] === 'bezig') throw new Error('vermogens: kring in leuntOp: ' + pad.concat(id).join(' -> '));
    staat[id] = 'bezig';
    for (const o of OP_ID[id].leuntOp) loop(o, pad.concat(id));
    staat[id] = 'klaar';
  };
  for (const v of VERMOGENS) loop(v.id, []);
}

/* 3. Elke categorie valt in precies EEN vermogen. Nergens: die schakelaars
      verdwijnen van de kaart en er staat groen omdat er niets staat. Twee keer:
      dezelfde verzoeken worden dubbel geteld en elk cijfer erboven is onjuist. */
{
  const gezien = new Map();
  for (const v of VERMOGENS) for (const c of v.categorieen) {
    if (gezien.has(c)) throw new Error('vermogens: categorie "' + c + '" valt in twee vermogens (' +
      gezien.get(c) + ' en ' + v.id + '): elk verzoek erin wordt dan dubbel geteld');
    gezien.set(c, v.id);
  }
  const kwijt = CATEGORIEEN.filter(c => !gezien.has(c));
  if (kwijt.length) throw new Error('vermogens: categorie(en) zonder vermogen: ' + kwijt.join(', ') +
    ' -- zet ze hier neer, anders vallen die functies van de gezondheidskaart');
  const vreemd = [...gezien.keys()].filter(c => !CATEGORIEEN.includes(c));
  if (vreemd.length) throw new Error('vermogens: onbekende categorie(en): ' + vreemd.join(', '));
}

/* 4. Twee vermogens die hetzelfde alarm claimen, tellen dezelfde storing dubbel. */
{
  const gezien = new Map();
  for (const v of VERMOGENS) for (const a of (v.alarmen || [])) {
    if (gezien.has(a)) throw new Error('vermogens: alarm "' + a + '" hangt aan twee vermogens (' +
      gezien.get(a) + ' en ' + v.id + ')');
    gezien.set(a, v.id);
  }
}

/* Alles waar dit vermogen op leunt, ook twee stappen verderop. De doorwerking
   heeft de VOLLE keten nodig: een kassa die niet werkt omdat de voordeur dicht
   zit, hoort dat te lezen en niet "geen bekende oorzaak". */
function ketenVan(id) {
  const uit = [], zien = new Set();
  const loop = (x) => {
    for (const op of (OP_ID[x] ? OP_ID[x].leuntOp : [])) {
      if (zien.has(op)) continue;
      zien.add(op); uit.push(op); loop(op);
    }
  };
  loop(id);
  return uit;
}

/* Bij welk vermogen hoort dit alarm? Null is een uitslag, geen fout. */
function vermogenVanAlarm(alarmId) {
  const v = VERMOGENS.find(x => (x.alarmen || []).includes(alarmId));
  return v ? v.id : null;
}

module.exports = { VERMOGENS, OP_ID, ketenVan, vermogenVanAlarm };
