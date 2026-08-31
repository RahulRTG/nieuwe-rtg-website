/* ============================================================================
   MUTATIECONTRACTEN -- DE VIERENVIJFTIG UIT DE OBJECTRONDE (31 augustus 2026).

   Deel van ./mutatiecontracten.js; de bouwers staan in
   ./mutatiecontracten-proefronde-bouw.js en het verschil in bewijskracht tussen
   `gemerkt` en `metSleutel` staat daar uitgeschreven.

   Toen de proefopstelling vijf voorwerpen kreeg -- een festival, een entiteit,
   een onderneming, een onderzoek en een stadsafdeling -- gaven 192 routes voor
   het eerst een uitslag, en vielen er vierenvijftig terug op LEGACY. Voor de
   derde keer deze week dezelfde beweging, en om dezelfde reden: er IS gemeten,
   dus BLOCKED_BY_TEST_FIXTURE geldt niet meer.

   Negen staan op de sterkste grond (ook zonder sleutel opgevangen), en dat is
   geen toeval: het zijn precies de negen die in dezelfde ronde een
   duplicaatregel kregen (./idemsleutels-objectronde.js). Bedoeling en gedrag
   vallen aantoonbaar samen.

   TWEE STAAN APART, en allebei omdat de handeling zelf iets zegt.
   ========================================================================== */
'use strict';

const { CONTRACTEN, gemerkt, metSleutel, tweedeHandeling } = require('./mutatiecontracten-proefronde-bouw');

gemerkt('POST /api/concern/discovery/neem', 'concern.discovery.neem');
gemerkt('POST /api/lab2/bewijs/dataset', 'lab2.bewijs.dataset');
gemerkt('POST /api/lab2/plan/bron', 'lab2.plan.bron');
gemerkt('POST /api/lab2/werk/besluit', 'lab2.werk.besluit');
gemerkt('POST /api/lab2/werk/document', 'lab2.werk.document');
gemerkt('POST /api/lab2/werk/log', 'lab2.werk.log');
gemerkt('POST /api/lab2/werk/taak', 'lab2.werk.taak');
gemerkt('POST /api/onderneming/kas/saldo', 'onderneming.kas.saldo');
gemerkt('POST /api/rtfos/stad/kernteam', 'rtfos.stad.kernteam');
metSleutel('POST /api/concern/boom', 'concern.boom');
metSleutel('POST /api/concern/discovery', 'concern.discovery');
metSleutel('POST /api/concern/entiteit', 'concern.entiteit');
metSleutel('POST /api/festival/groep/mijn', 'festival.groep.mijn');
metSleutel('POST /api/festival/vooruit', 'festival.vooruit');
metSleutel('POST /api/lab2/bewoner/studie', 'lab2.bewoner.studie');
metSleutel('POST /api/lab2/studie', 'lab2.studie');
metSleutel('POST /api/lab2/studie/watnu', 'lab2.studie.watnu');
metSleutel('POST /api/onderneming/aanvraag/stand', 'onderneming.aanvraag.stand');
metSleutel('POST /api/onderneming/beeld', 'onderneming.beeld');
metSleutel('POST /api/onderneming/belasting', 'onderneming.belasting');
metSleutel('POST /api/onderneming/bestuur', 'onderneming.bestuur');
metSleutel('POST /api/onderneming/capaciteit', 'onderneming.capaciteit');
metSleutel('POST /api/onderneming/contracten', 'onderneming.contracten');
metSleutel('POST /api/onderneming/crediteuren', 'onderneming.crediteuren');
metSleutel('POST /api/onderneming/dagbeeld', 'onderneming.dagbeeld');
metSleutel('POST /api/onderneming/debiteuren', 'onderneming.debiteuren');
metSleutel('POST /api/onderneming/eersteklant', 'onderneming.eersteklant');
metSleutel('POST /api/onderneming/intake', 'onderneming.intake');
metSleutel('POST /api/onderneming/kas', 'onderneming.kas');
metSleutel('POST /api/onderneming/klussen', 'onderneming.klussen');
metSleutel('POST /api/onderneming/mallprofiel', 'onderneming.mallprofiel');
metSleutel('POST /api/onderneming/oprichting', 'onderneming.oprichting');
metSleutel('POST /api/onderneming/pijplijn', 'onderneming.pijplijn');
metSleutel('POST /api/onderneming/relaties', 'onderneming.relaties');
metSleutel('POST /api/onderneming/toegang', 'onderneming.toegang');
metSleutel('POST /api/onderneming/verkenning', 'onderneming.verkenning');
metSleutel('POST /api/onderneming/voorraad', 'onderneming.voorraad');
metSleutel('POST /api/onderneming/werving', 'onderneming.werving');
metSleutel('POST /api/rtfos/audit', 'rtfos.audit');
metSleutel('POST /api/rtfos/benchmark', 'rtfos.benchmark');
metSleutel('POST /api/rtfos/berichten', 'rtfos.berichten');
metSleutel('POST /api/rtfos/blauwdrukken', 'rtfos.blauwdrukken');
metSleutel('POST /api/rtfos/campagnes', 'rtfos.campagnes');
metSleutel('POST /api/rtfos/inkoop', 'rtfos.inkoop');
metSleutel('POST /api/rtfos/jaarverslagen', 'rtfos.jaarverslagen');
metSleutel('POST /api/rtfos/koppelbord', 'rtfos.koppelbord');
metSleutel('POST /api/rtfos/meldingen', 'rtfos.meldingen');
metSleutel('POST /api/rtfos/rapport/landelijk', 'rtfos.rapport.landelijk');
metSleutel('POST /api/rtfos/stad', 'rtfos.stad');
metSleutel('POST /api/rtfos/stad/maak', 'rtfos.stad.maak');
metSleutel('POST /api/rtfos/veld/lijst', 'rtfos.veld.lijst');
metSleutel('POST /api/supplier/kantoorpakket/ster', 'supplier.kantoorpakket.ster');
tweedeHandeling('POST /api/lab2/coach/conclusie', 'lab2.coach.conclusie');

/* /api/festival/scan -- de toegangsscan aan een hek, en de enige van de
   vierenvijftig die GEEN uitspraak kreeg: twee geslaagde oproepen, geen spoor
   in de gemeten collecties, geen hindernis.

   Dat is hier geen tekort maar het antwoord. kern/festival/toegang.js herkent
   dubbelgebruik ZELF en meldt het als `oranje` -- "er is iets, en het is aan een
   mens". Precies wat je aan een hek wilt: een tweede scan van hetzelfde bandje
   is meestal iemand die zijn kaartje over het hek heeft teruggegeven, en dat
   hoort een beveiliger te zien in plaats van door een cache te worden
   opgeslikt. Een duplicaatregel zou die melding wegnemen -- dezelfde fout als
   bij de nachtrun en de herstelknop in ./idemsleutels-nooit.js.

   De route verandert niets aan de opslag zolang de scan wordt herkend, en dat is
   waarom de meter niets zag. */
CONTRACTEN['POST /api/festival/scan'] = {
  mutatieId: 'festival.scan', herkomst: 'mens',
  semantiek: { klasse: 'idempotent' },
  toegang: { klasse: 'OBJECT_SCOPED', objectVeld: 'festival' },
  stand: 'PROTECTED',
  bewijs: {
    gemeten: 'objectronde: twee geslaagde oproepen, geen spoor in de gemeten collecties en geen hindernis',
    op: '2026-08-31'
  },
  nagekeken: 'handler gelezen in server/routes/festival/poort.js en kern/festival/toegang.js: de scanlaag ' +
    'herkent dubbelgebruik zelf en geeft stand `oranje` met de eerdere scan erbij. De bescherming zit dus ' +
    'in de route en niet in een laag erboven -- en die melding hoort zichtbaar te blijven, dus krijgt deze ' +
    'route met opzet GEEN duplicaatregel',
  afgetekend: {
    door: 'Claude (Opus 5), op grond van de gelezen handler; niet door een mens nagelezen',
    op: '2026-08-31'
  }
};

module.exports = CONTRACTEN;
