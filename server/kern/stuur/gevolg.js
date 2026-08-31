/* DE GEVOLGVOORSPELLING -- wat een plan zou aanraken, zonder het te doen.
   EXECUTIE.md blok 4.

   DE VRAAG die een gebruiker stelt voordat hij bevestigt is niet "welke routes
   ga je aanroepen" maar "wat verandert er dan". Dit bestand beantwoordt daar de
   helft van, en zegt van de andere helft dat hij hem niet weet.

   HET KOMT UIT EEN METING EN NIET UIT EEN MODEL. De idempotentieproef draaide
   elke bereikbare route drie keer tegen een wegwerpserver en noteerde per
   oproep WELKE COLLECTIES daarbij veranderden -- dat is het veld `opslag` in
   IDEMPROEF.json. Voor /api/bank/overboek staat daar bankSaldi, bankBoekingen,
   bankIdem en bankIdemAfdruk. Die vier zijn dus geen aanname: ze zijn een keer
   echt gebeurd.

   DRIE GRADEN, en de derde is de grootste:

     gemeten              de proef raakte deze collecties aan
     geen-effect-gemeten  de proef draaide en raakte niets aan
     onbekend             de proef kwam er niet bij (404, 403, geen invoer)

   Over de 176 paden die de AI mag bedienen: 36 gemeten, 44 zonder effect, en 96
   ONBEKEND. Een droogloop die dat verzwijgt en alleen de 36 toont, leest als
   volledigheid -- en dat is precies de leugen die bon.js op een bon weigert.

   VIER DINGEN DIE DEZE VOORSPELLING NIET IS, en ze staan ook in de uitslag:

   1 Zij zegt WELKE collecties, nooit WAT erin verandert. "bankSaldi" betekent
     niet hoeveel.
   2 Zij is gemeten met de INVOER VAN DE PROEF. Een ander lichaam kan andere
     collecties raken; een route met een tak die de proef niet nam, laat die tak
     hier niet zien.
   3 Zij kijkt niet naar buiten. Een mail, een betaalprovider, een derde partij:
     die staan in geen enkele collectie.
   4 Zij is een MOMENTOPNAME van de laatste proefronde, niet van deze commit.

   HIJ VOERT NIETS UIT -- net als ./plan.js: geen fetch, geen aanroep, geen weg
   naar een effect. En hij hangt NAAST het plan en niet erin: PLAN bezit niets,
   en dat blijft zo. */
'use strict';

let REGISTER = null;

/* Per pad: welke collecties de proef zag veranderen, en of hij er uberhaupt bij
   kon. Een keer opgebouwd; het register is een bestand en verandert niet tijdens
   een verzoek. */
function register() {
  if (REGISTER) return REGISTER;
  const uit = new Map();
  let rijen = [];
  try { rijen = require('../../../IDEMPROEF.json').perRoute || []; } catch (e) { rijen = []; }
  for (const r of rijen) {
    if (!r || r.methode !== 'POST' || typeof r.pad !== 'string') continue;
    const huidig = uit.get(r.pad) || { collecties: new Set(), geenWerk: false, gezien: false };
    huidig.gezien = true;
    for (const sleutel of ['a', 'b', 'c'])
      for (const naam of Object.keys((r.opslag || {})[sleutel] || {})) huidig.collecties.add(naam);
    if (/deed geen werk/.test(String(r.reden || ''))) huidig.geenWerk = true;
    uit.set(r.pad, huidig);
  }
  REGISTER = uit;
  return uit;
}

/* Het gevolg van EEN capability. Geeft altijd een graad en altijd een reden. */
function gevolgVan(pad) {
  const r = register().get(String(pad || ''));
  if (!r || !r.gezien)
    return { graad: 'onbekend', collecties: [],
      reden: 'deze route staat niet in de proefronde; er is nooit gemeten wat zij aanraakt' };
  const collecties = [...r.collecties].sort();
  if (collecties.length) return { graad: 'gemeten', collecties,
    reden: 'de proef zag deze collectie(s) veranderen, met de invoer van de proef' };
  if (r.geenWerk) return { graad: 'onbekend', collecties: [],
    reden: 'de proef kwam niet bij de muterende code (geen geldige invoer of geen rechten), ' +
      'dus dat er niets veranderde zegt niets over deze handeling' };
  return { graad: 'geen-effect-gemeten', collecties: [],
    reden: 'de proef draaide en zag geen enkele collectie veranderen' };
}

const GRENZEN = Object.freeze([
  'welke collecties, nooit wat erin verandert',
  'gemeten met de invoer van de proef; een ander lichaam kan andere collecties raken',
  'alles buiten de opslag valt erbuiten: mail, een betaalprovider, een derde partij',
  'een momentopname van de laatste proefronde, niet van deze commit'
]);

/* DE VOORSPELLING OVER EEN GEWOGEN PLAN (de uitvoer van ./plan.js). Hij leest
   het plan en verandert het niet: PLAN bezit niets, en deze laag hoort er niet
   in te kruipen. */
function voorspel(plan) {
  const stappen = (plan && Array.isArray(plan.stappen) ? plan.stappen : [])
    .map(s => Object.assign({ id: s.id, capability: s.capability }, gevolgVan(s.capability)));
  const geraakt = [...new Set(stappen.flatMap(s => s.collecties))].sort();
  const tel = { gemeten: 0, 'geen-effect-gemeten': 0, onbekend: 0 };
  for (const s of stappen) tel[s.graad]++;

  const zinnen = [];
  if (geraakt.length) zinnen.push('raakt ' + geraakt.length + ' collectie(s): ' + geraakt.join(', '));
  if (tel.onbekend) zinnen.push('van ' + stappen.length + ' stappen is bij ' + tel.onbekend +
    ' NIET gemeten wat zij aanraken');
  if (!zinnen.length) zinnen.push('geen enkele stap raakte in de proef iets aan');

  return { stappen, geraakteCollecties: geraakt, telling: tel,
    samenvatting: zinnen.join('; '),
    grenzen: GRENZEN,
    grens: 'Dit is een voorspelling uit een eerdere meting en geen droogloop van DEZE opdracht. ' +
      'Wat hier ontbreekt, ontbreekt zichtbaar: ' + tel.onbekend + ' van de ' + stappen.length +
      ' stappen staan op onbekend.' };
}

module.exports = { voorspel, gevolgVan, GRENZEN };
