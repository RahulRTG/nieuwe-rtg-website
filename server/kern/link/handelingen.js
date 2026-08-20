/* RTG Link: HET HANDELINGENREGISTER -- welke capabilities er bestaan, en wat er
   per soort geldt. Zie LINK.md par. 3.4 en de bouwvolgorde, stap 2.

   EEN CAPABILITY IS DE HANDDRUK, NIET DE TOEGANG. Dat onderscheid draagt dit
   hele bestand. De code leeft minuten en sterft daarna; wat er blijft is wat de
   handeling heeft opgeleverd -- een boeking, een band, een verzoek. Wie hier een
   handeling wil neerzetten die BLIJVENDE toegang uitdeelt, bouwt een sleutel die
   in een oude foto van een QR blijft zitten. Die hoort niet hier maar in de laag
   waar die toegang woont, met een intrekknop erbij.

   HET DOMEIN SCHRIJFT ZIJN EIGEN HANDELING, en dat is geen vormkwestie. De
   capabilitylaag weet niet wat geld is, wat een reis is of wat een kaartje is;
   hij weet alleen dat er iets is dat een mens moet BEGRIJPEN voordat hij ja zegt,
   en dat er daarna iemand is die het UITVOERT. Beide horen bij het domein: de
   beschrijving (par. 3.5: nooit met een echte naam erin) en de uitvoering (die
   langs de eigen poorten van dat domein gaat). Zou de linklaag zelf geld
   verplaatsen, dan is er een tweede plek waar dat kan -- en RTG Pay zegt met
   zoveel woorden dat er maar EEN plek is waar geld beweegt.

   EEN DEFINITIE DIE NIET DEUGT, GOOIT BIJ HET OPHANGEN. Niet bij het eerste
   gebruik, en zeker niet stil: een half register is een register dat je pas
   wantrouwt nadat er iets misging (LAT.md regel 5). */
'use strict';

/* Nooit langer dan de ondertekenaar aankan (kern/dyncode.js staat maximaal vijf
   minuten toe). Staat hier als eigen bovengrens zodat een handeling die zich
   vergist, hier stukloopt en niet pas bij het tekenen. */
const TTL_PLAFOND = 5 * 60 * 1000;
const ROLLEN = ['lid', 'supplier', 'staff', 'office'];

module.exports = () => {

const register = new Map();

function eis(waar, wat) { if (!waar) throw new Error('linkhandeling: ' + wat); }

/* Een handeling aanmelden. Wordt bij het opstarten aangeroepen door het domein
   dat hem bezit; alles wat hier binnenkomt is dus code van ons en geen invoer van
   een gebruiker -- vandaar gooien in plaats van een nette fout teruggeven. */
function registreer(def) {
  eis(def && typeof def === 'object', 'een definitie is verplicht');
  eis(/^[a-z]+\.[a-z]+$/.test(String(def.id || '')), 'id moet de vorm "domein.handeling" hebben');
  eis(!register.has(def.id), 'de handeling ' + def.id + ' is al aangemeld');
  eis(typeof def.wat === 'string' && def.wat, def.id + ': `wat` beschrijft de soort handeling');
  for (const veld of ['uitgever', 'aanvaarder']) {
    eis(Array.isArray(def[veld]) && def[veld].length, def.id + ': ' + veld + ' is een lijst rollen');
    for (const r of def[veld]) eis(ROLLEN.includes(r), def.id + ': onbekende rol "' + r + '" in ' + veld);
  }
  eis(Number.isFinite(def.ttlMs) && def.ttlMs >= 5000 && def.ttlMs <= TTL_PLAFOND,
    def.id + ': ttlMs moet tussen 5 seconden en ' + (TTL_PLAFOND / 1000) + ' seconden liggen');
  eis(typeof def.eenmalig === 'boolean', def.id + ': zeg met zoveel woorden of hij eenmalig is');
  eis(typeof def.lees === 'function', def.id + ': `lees` maakt van de invoer een gebonden opdracht');
  eis(typeof def.beschrijf === 'function', def.id + ': `beschrijf` maakt het bedoelingsscherm');
  eis(typeof def.doe === 'function', def.id + ': `doe` voert hem uit');
  /* De drie die MOGEN ontbreken, maar geen half werk mogen zijn: `neem` leest
     wat de aanvaarder zelf invult (een bedrag binnen een maximum), `nog` zegt of
     datgene waar de code aan hangt nog leeft, en `voorUitgever` is wat alleen de
     maker terugkrijgt. Staat er iets anders dan een functie, dan is dat een
     tikfout die anders pas bij het eerste gebruik opvalt. */
  for (const naam of ['neem', 'nog', 'voorUitgever'])
    eis(def[naam] === undefined || typeof def[naam] === 'function', def.id + ': `' + naam + '` moet een functie zijn (of ontbreken)');
  register.set(def.id, Object.freeze({ ...def }));
  return def.id;
}

const haal = (id) => register.get(String(id || '')) || null;
const alle = () => [...register.values()].map(d => ({ id: d.id, wat: d.wat, uitgever: [...d.uitgever],
  aanvaarder: [...d.aanvaarder], ttlMs: d.ttlMs, eenmalig: d.eenmalig }));

return { registreer, haal, alle, TTL_PLAFOND, ROLLEN };
};
