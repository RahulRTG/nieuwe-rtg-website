/* ============================================================================
   DE SOORTEN INSTRUMENT -- wat een deelnemer gevraagd kan worden, en hoe een
   antwoord wordt gelezen.

   Afgesplitst van ./instrument.js toen die over de 10 KB-keuringsgrens ging, en
   langs een echte naad: hier staat WAT er gevraagd mag worden en hoe een waarde
   wordt begrepen, daar staat wat er met een protocol en een meting gebeurt. Het
   eerste is een tabel die een onderzoeksleider leest voordat hij iets inzendt;
   het tweede is machinerie.

   `NIET_GEBOUWD` hoort daarom hier: dat is het antwoord dat iemand krijgt
   wanneer hij een instrument vraagt dat hier niet bestaat -- geen wensenlijst,
   maar een reden.
   ========================================================================== */
'use strict';

/* De soorten instrument. Een gesloten lijst, want elke soort is een belofte over
   hoe de waarde later vergeleken mag worden. `vorm` zegt hoe hij wordt gelezen. */
const SOORTEN = [
  { soort: 'schaal', naam: 'Schaal 1-5', vorm: 'getal', min: 1, max: 5,
    uitleg: 'Hoe sterk ervaart u dit? Vijf standen, altijd dezelfde.' },
  { soort: 'getal', naam: 'Getal met eenheid', vorm: 'getal',
    uitleg: 'Een gemeten waarde, met de eenheid erbij (graden, decibel, uren).' },
  { soort: 'keuze', naam: 'Keuze uit een lijst', vorm: 'keuze',
    uitleg: 'Een van de antwoorden die de onderzoeker heeft opgeschreven.' },
  { soort: 'janee', naam: 'Ja of nee', vorm: 'janee', uitleg: 'Een vraag met twee antwoorden.' },
  { soort: 'tekst', naam: 'Korte toelichting', vorm: 'tekst',
    uitleg: 'Ruimte voor wat een cijfer niet vangt. Kort, want dit is geen dagboek.' }
];

/* WAT ER MET OPZET NIET IN STAAT. Het is geen wensenlijst maar het antwoord dat
   een onderzoeksleider krijgt wanneer hij het toch probeert -- zodat hij niet
   hoeft te raden waarom zijn instrument wordt geweigerd. */
const NIET_GEBOUWD = {
  foto: 'Een foto uit de woning van een deelnemer is een andere orde van gegeven dan een cijfer: er staat altijd meer op dan de meting. Dat vraagt een eigen ethische beoordeling en een eigen bewaartermijn, en die zijn er nog niet.',
  locatie: 'De locatie van een mens is de gevoeligste waarde in dit huis. Zolang er geen intrekbare, zichtbare en tijdgebonden vorm van staat, komt er geen ruwe vorm van (LINK.md par. 3).',
  audio: 'Een geluidsopname vangt de stem van de deelnemer en van iedereen om hem heen -- mensen die niets hebben verleend. Wie geluid wil meten, meet een decibelwaarde met een gekalibreerd apparaat.',
  doorlopend: 'Een instrument dat vanzelf blijft meten zonder dat de deelnemer iets doet, is een sensor in iemands huis. Dat loopt langs de apparatuurlaag met haar bevoegdheden, niet langs een vragenlijst.'
};

const OP_SOORT = new Map(SOORTEN.map(s => [s.soort, s]));
const soortVan = (s) => OP_SOORT.get(String(s || '')) || null;

/* Een waarde lezen. Buiten bereik is een WEIGERING met de grenzen erbij en geen
   stille afronding: wie meetwaarden bijschaaft, meet zijn eigen verwachting.
   `schoon` komt van de aanroeper, want de knipregels van dit huis staan in
   ./opslag.js en horen niet op twee plekken. */
function lees(inst, ruw, schoon) {

    if (inst.soort === 'schaal') {
      const n = Number(ruw);
      if (!Number.isInteger(n) || n < 1 || n > 5) return { fout: '"' + inst.vraag + '" is een heel getal van 1 tot en met 5.' };
      return { waarde: n };
    }
    if (inst.soort === 'getal') {
      const n = Number(ruw);
      if (!Number.isFinite(n)) return { fout: '"' + inst.vraag + '" is een getal in ' + inst.eenheid + '.' };
      if (n < inst.min || n > inst.max) {
        return { fout: '"' + inst.vraag + '" ligt tussen ' + inst.min + ' en ' + inst.max + ' ' + inst.eenheid
          + '. De waarde ' + n + ' wordt niet bijgesteld maar geweigerd: klopt hij toch, zet hem er dan bij als toelichting.' };
      }
      return { waarde: n };
    }
    if (inst.soort === 'keuze') {
      const t = String(ruw == null ? '' : ruw);
      if (!inst.opties.includes(t)) return { fout: '"' + inst.vraag + '" is een van: ' + inst.opties.join(', ') + '.' };
      return { waarde: t };
    }
    if (inst.soort === 'janee') {
      if (ruw === true || ruw === false) return { waarde: ruw };
      return { fout: '"' + inst.vraag + '" is ja of nee.' };
    }
    const t = schoon(ruw, 300);
    if (!t) return { fout: '"' + inst.vraag + '" is nog leeg.' };
    return { waarde: t };
}

module.exports = { SOORTEN, NIET_GEBOUWD, OP_SOORT, soortVan, lees };
