/* DE ECONOMISCHE FIREWALL -- wie mag wie iets in rekening brengen.

   Eén functie, en het antwoord is standaard NEE. Dat is de hele waarde: een
   firewall die standaard doorlaat is een logboek.

   VIER VRAGEN, IN DEZE VOLGORDE, EN ELKE NEE STOPT DE REST:

     1. Kennen we beide werelden? Onbekend is nee -- niet 'waarschijnlijk het
        huis'.
     2. Is het dezelfde wereld? Dan mag het. Binnen een rechtspersoon is
        doorbelasten een interne verdeling en geen levering.
     3. Bestaat er een RELATIE tussen die twee werelden (./relaties.js)? Zo nee:
        geweigerd, met de reden en met wat er zou moeten gebeuren om het wel te
        mogen. Een weigering die niet zegt hoe het wel kan, wordt omzeild.
     4. Past het bedrag onder het plafond van die relatie? Zo nee: geweigerd,
        met het plafond en het bedrag erbij.

   EN ER IS EEN VIJFDE DIE GEEN RELATIE KAN OPENEN. Een rekening landt bij de
   ENTITEIT van een wereld, nooit bij een gebruiker van die wereld. RTG mag de
   stichting factureren voor infrastructuur; RTG mag daarvoor nooit een gezin
   factureren, ook niet als de relatie rtg-intern -> rtfoundation wagenwijd
   openstaat. Dat is `magDragerBelasten` hieronder, en het is met opzet een
   aparte vraag: wie de twee door elkaar haalt, denkt dat een open relatie een
   open deur naar de leden van die wereld is.

   WAAROM DIT EEN EIGEN BESTAND IS EN GEEN IF IN DE BOEKING. Om dezelfde reden
   als kern/aipoort.js: zo is het BESLUIT te beproeven zonder een server op te
   starten en zonder een factuur te maken. Een grens die alleen bestaat op het
   moment dat er geld beweegt, is een grens waar nooit een toets op staat. */
'use strict';

const { wereld, factureerbaar, wereldVan } = require('./werelden');

module.exports = (ctx) => {
  const { relatieVoor } = ctx;

  const nee = (code, uitleg, extra) => Object.assign({ ok: false, code, uitleg }, extra || {});

  /* Mag wereld `van` het bedrag `centen` bij wereld `naar` in rekening brengen?
     `centen` mag ontbreken: dan toetst hij alleen of de weg openstaat, en niet
     of dit bedrag erdoor past. Dat scheelt een tweede functie voor de vraag
     "zou dit uberhaupt mogen". */
  function magBelasten({ van, naar, centen }) {
    if (!wereld(van) || !wereld(naar)) {
      return nee('onbekende-wereld', 'Een van beide werelden ken ik niet, en onbekend is hier geen synoniem voor het huis.');
    }
    if (van === naar) return { ok: true, code: 'eigen-wereld', uitleg: 'Binnen een wereld is dit een interne verdeling en geen levering.' };
    const r = relatieVoor(van, naar);
    if (!r) {
      return nee('geen-relatie',
        'Er is geen economische relatie van ' + van + ' naar ' + naar + '. Kosten van de ene wereld komen niet ' +
        'zomaar bij de andere terecht; daar hoort een overeenkomst of een bestuursbesluit onder te liggen.',
        { hoeWel: 'Leg de relatie vast met een grondslag en een plafond (kern/economie/relaties.js).' });
    }
    const bedrag = centen == null ? null : Math.round(Number(centen));
    if (bedrag != null && !(Number.isFinite(bedrag) && bedrag >= 0)) {
      return nee('geen-bedrag', 'Dat is geen bedrag in centen.');
    }
    if (bedrag != null && bedrag > r.plafondCenten) {
      return nee('boven-plafond',
        'Dit bedrag ligt boven het plafond van deze relatie. Een plafond dat meebuigt met het bedrag is geen plafond.',
        { plafondCenten: r.plafondCenten, bedragCenten: bedrag,
          hoeWel: 'Verhoog het plafond bewust, of splits de doorbelasting.' });
    }
    return { ok: true, code: 'relatie', uitleg: r.grondslag,
      relatie: { van: r.van, naar: r.naar, grondslag: r.grondslag, plafondCenten: r.plafondCenten, door: r.door, op: r.op } };
  }

  /* Mag deze DRAGER een rekening krijgen voor kosten uit wereld `vanWereld`?
     Dit is de laatste poort voor een factuurregel, en hij is strenger dan de
     vorige: een gebruiker is geen wereld. */
  function magDragerBelasten({ drager, vanWereld }) {
    const naar = wereldVan(drager);
    if (!factureerbaar(naar)) {
      return nee('wereld-factureert-niet',
        'De wereld ' + naar + ' stuurt haar gebruikers geen rekeningen. Kosten van deze wereld worden door de ' +
        'entiteit zelf gedragen, uit haar eigen begroting.', { wereld: naar });
    }
    if (vanWereld && vanWereld !== naar) {
      return nee('andere-wereld',
        'Deze kosten komen uit ' + vanWereld + ' en deze gebruiker hoort bij ' + naar + '. Een gebruiker draagt ' +
        'nooit de kosten van een andere wereld; die verrekening loopt tussen de entiteiten en niet via een factuur ' +
        'aan een mens.', { wereld: naar, vanWereld });
    }
    return { ok: true, code: 'eigen-wereld', wereld: naar };
  }

  return { magBelasten, magDragerBelasten };
};
