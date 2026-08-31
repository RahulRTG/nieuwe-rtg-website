/* ============================================================================
   DE RIJKSOVERHEID-HELFT van ./mutatiecontracten-proefronde-lijst.js.

   Apart bestand om dezelfde reden als de splitsing daar: samen liepen ze tegen
   de grootte-grens van scripts/check.js aan. De drie bouwers en het verschil in
   bewijskracht staan in ./mutatiecontracten-proefronde-bouw.js.
   ========================================================================== */
'use strict';

const { CONTRACTEN, gemerkt, metSleutel } = require('./mutatiecontracten-proefronde-bouw');

/* ---- 4. DE RIJKSOVERHEID (26) ----

   Toen het genre `rijk` werd aangesloten (besluit van de eigenaar, 30 augustus
   2026) gingen de 64 deuren met "Alleen voor het rijk." open en gaven 97
   overheidsroutes voor het eerst een uitslag. Zesentwintig daarvan kwamen op
   LEGACY terecht -- dezelfde beweging als bij de vorige groep, en om dezelfde
   reden: er IS gemeten, dus BLOCKED_BY_TEST_FIXTURE geldt niet meer.

   Vier zijn ook ZONDER sleutel beschermd; drie daarvan doordat ze op diezelfde
   dag een duplicaatregel kregen (bekendmaking, rb/zaak, verkiezing/sluit -- zie
   ./idemsleutels-proefronde.js voor wat elk van drieen kostte). De andere
   tweeentwintig zijn alleen MET sleutel gemeten, met dezelfde beperking als
   hierboven. */
gemerkt('POST /api/overheid/bekendmaking', 'overheid.bekendmaking');
gemerkt('POST /api/overheid/rb/zaak', 'overheid.rb.zaak');
gemerkt('POST /api/overheid/verkiezing/sluit', 'overheid.verkiezing.sluit');
gemerkt('POST /api/supplier/horeca/club/deur', 'supplier.horeca.club.deur');
metSleutel('POST /api/overheid/bd/aanslagen', 'overheid.bd.aanslagen');
metSleutel('POST /api/overheid/bd/ai', 'overheid.bd.ai');
metSleutel('POST /api/overheid/bd/btw', 'overheid.bd.btw');
metSleutel('POST /api/overheid/bd/btw/aansluiting', 'overheid.bd.btw.aansluiting');
metSleutel('POST /api/overheid/bd/cockpit', 'overheid.bd.cockpit');
metSleutel('POST /api/overheid/bd/naheffingen', 'overheid.bd.naheffingen');
metSleutel('POST /api/overheid/bezwaren', 'overheid.bezwaren');
metSleutel('POST /api/overheid/bieb', 'overheid.bieb');
metSleutel('POST /api/overheid/bieb/catalogus', 'overheid.bieb.catalogus');
metSleutel('POST /api/overheid/bieb/mijn', 'overheid.bieb.mijn');
metSleutel('POST /api/overheid/kvk/lijst', 'overheid.kvk.lijst');
metSleutel('POST /api/overheid/pda/zittingen', 'overheid.pda.zittingen');
metSleutel('POST /api/overheid/rb/ai', 'overheid.rb.ai');
metSleutel('POST /api/overheid/rb/cockpit', 'overheid.rb.cockpit');
metSleutel('POST /api/overheid/rb/rol', 'overheid.rb.rol');
metSleutel('POST /api/overheid/rb/zaken', 'overheid.rb.zaken');
metSleutel('POST /api/overheid/regie', 'overheid.regie');
metSleutel('POST /api/overheid/subsidies/lijst', 'overheid.subsidies.lijst');
metSleutel('POST /api/overheid/toeslagen', 'overheid.toeslagen');
metSleutel('POST /api/overheid/uitgifte', 'overheid.uitgifte');
metSleutel('POST /api/overheid/uitkeringen', 'overheid.uitkeringen');
metSleutel('POST /api/overheid/water/meldingen', 'overheid.water.meldingen');


module.exports = CONTRACTEN;
