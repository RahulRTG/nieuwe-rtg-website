/* DE KERN SAMENSTELLEN -- deel 1, het stadsweefsel.

   Geknipt uit ./kernlaag1.js toen dat bestand met de 18+-poort op de kern
   (kern.volwassen) over de leesgrens van dit huis ging (scripts/check.js regel
   13, 10 KB). Dit was het stuk met de duidelijkste naad: een eigen helper, een
   eigen module en een eigen verhaal over de volgorde. Het wordt vanuit kernlaag1
   aangeroepen op de plek waar het stond -- het weefsel moet VOOR zijn lezers
   staan, en die plek verhuist niet mee met de tekst. Zelfde vorm als
   ./kernlaag4-comm.js.

   Wat `kern` en `hulp` zijn: zie de kop van ./kernlaag1.js. */
'use strict';

module.exports = (kern, hulp) => {
  const { crypto, db, keyVanCodenaam, log, save, sseToCustomer, sseToOffice } = hulp;

/* Het stadsweefsel (kern/stadsweefsel/): de ondergrond onder de stad --
   geografie, objecten, indicatoren, begroting, besluitvorming en het
   algoritmeregister.

   DE VOLGORDE IS HIER GEDRAG. Het weefsel staat VOOR zijn lezers: kern/gemeente
   (laag 2) biedt zijn meldingen bij de zaakmotor aan en kern/stad (laag 5) leest
   zijn zones uit de geografie. Wie dit blok naar beneden schuift, start een stad
   zonder ondergrond -- en dan hangt een gemeentemelding aan geen enkele zaak.
   Het staat in deze laag en niet in laag 2 omdat die daarmee over de 10 KB ging;
   eerder is hier ook goed, want alles wat het weefsel nodig heeft bestaat al. */
const melderSeintje = (codenaam) => {
  try { Promise.resolve(keyVanCodenaam(codenaam)).then(t => { if (t && t.key) sseToCustomer(t.key, 'sync', { scope: 'stad' }); }).catch(() => {}); }
  catch (e) { log.uitzondering(e, { bron: 'weefsel', waar: 'melderSeintje' }); }
};
Object.assign(kern, require('../kern/stadsweefsel')({ db, save, crypto, sseToOffice, melderSeintje, log }));
};
