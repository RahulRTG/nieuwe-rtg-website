/* ============================================================================
   BELLEN NAAR RTG -- binnen de app, en dus zonder telefoonnet.

   WAAROM DIT GEEN TELEFONIE IS, EN BETER. Een telefoonkanaal vraagt een
   provider, een nummer en een telefoonnummer dat de identiteitskluis verlaat.
   Geen van die drie is hier nodig: dit huis heeft al een belstack tussen leden
   (routes/social/leden.js, WebRTC met ring/accept/offer/answer/ice). Wat
   ontbrak was een kant waar RTG de telefoon OPNEEMT.

   En het levert iets op wat een telefooncentrale nooit heeft: de zaak ligt
   ernaast open. Wie belt, belt niet "RTG" maar over SUP-xxxxxx -- met de
   tijdlijn, de klokken en de bevoegdheden erbij. Een gesprek komt daarom ook IN
   die tijdlijn te staan; anders is het een half uur werk waar later niets van
   terug te vinden is.

   WIE MAG BELLEN, EN DE GRENS DIE DAARBIJ NIET MAG SNEUVELEN. Bellen is een
   dienst van de Lifestyle Pass en de Business Pass -- een besluit van de
   eigenaar, en het past op de ladder waar De Rechterhand ook op staat.

   MAAR: EEN MENS IS GEEN PREMIUM-DIENST. kern/service/mens.js houdt vast dat
   ELK lid met een account zelfstandig een mens kan vragen; dat is een
   ondergrens en die verandert hier niet. Wat premium is, is de STEM. Een
   RTG-lid krijgt dus nog steeds een mens, schriftelijk, in zijn zaak -- en dit
   bestand raakt die weg met geen enkele regel aan. Wie dat door elkaar haalt,
   verkoopt straks toegang tot hulp, en dat is iets anders dan een kanaal.

   WAT ER NIET WORDT BELOOFD. Geen wachttijd, geen "u bent nummer drie", geen
   "wij komen eraan". Dat wordt niet gemeten en dus niet gezegd. Neemt er
   niemand op, dan is het gesprek GEMIST -- en dan blijft de zaak gewoon staan
   met een regel in de tijdlijn, zodat de melder niet voor niets heeft gebeld.
   ========================================================================== */
'use strict';

const klok = require('../../lib/klok');
const { pasVan } = require('../passen');

/* De passen die mogen bellen. Een lijst en geen `tier !== 'rtg'`: wie hier een
   pas bij wil, doet dat op EEN plek, en wie hem eruit haalt ziet meteen wat hij
   wegneemt. */
const BELPASSEN = ['lifestyle', 'business'];

/* Een oproep die niemand aanneemt, rinkelt niet eeuwig door. Twee minuten is
   lang genoeg om op te staan en kort genoeg dat een rij niet volloopt met
   oproepen waar allang niemand meer zit. */
const RINKEL_SECONDEN = 120;

module.exports = function maakGesprekken({ db, save, crypto, zaken, loop, sseToCustomer, sseToOffice }) {
  const eigen = require('../eigencollectie')({ db, domein: 'kern/service-gesprek', bezit: { serviceGesprekken: 'lijst' } });
  const G = () => eigen.bak('serviceGesprekken');
  const nu = () => klok.datum().toISOString();
  const schoon = (v, n) => String(v == null ? '' : v).replace(/[<>]/g, '').trim().slice(0, n);

  /* Mag deze pas bellen? Geeft altijd een REDEN mee: een knop die er niet is
     zonder uitleg laat een lid denken dat er iets stuk is. En de tweede zin is
     er omdat hij waar moet blijven -- hulp is geen premium-dienst. */
  function magBellen(tier) {
    const pas = pasVan(tier);
    if (BELPASSEN.includes(pas)) return { mag: true, pas };
    return { mag: false, pas,
      waarom: 'Bellen hoort bij de Lifestyle Pass en de Business Pass.',
      wel: 'U kunt hier wel om een mens vragen; een medewerker van RTG kijkt dan naar uw zaak en antwoordt u.' };
  }

  /* Verlopen wordt GEREKEND en niet opgeruimd -- zelfde regel als de
     bijstandssessie en de machtiging. Een oproep die pas gemist heet als er een
     schoonmaker langskomt, staat tussendoor te rinkelen in een lege kamer. */
  function stand(g) {
    if (g.status === 'bezig' || g.status === 'beeindigd') return g.status;
    return Date.parse(g.at) + RINKEL_SECONDEN * 1000 <= klok.nu() ? 'gemist' : 'rinkelt';
  }
  const vind = (id) => G().find(g => g.id === String(id || '')) || null;
  const kort = (g) => ({ id: g.id, zaak: g.zaak, melder: g.melder, video: !!g.video,
    status: stand(g), at: g.at, mens: g.mens || null, aangenomenAt: g.aangenomenAt || null,
    beeindigdAt: g.beeindigdAt || null, seconden: g.seconden == null ? null : g.seconden });

  /* Opbellen, aannemen, signaleren en ophangen -- het DOEN -- staat in
     ./gesprek-lijn.js. De naad ligt op een echte grens: hierboven staat WIE mag
     bellen en WAT de stand is, daaronder wordt er geschreven en gerinkeld. Dat
     scheelt dit bestand bovendien de omvangsgrens van keuringsregel 13. */
  const lijn = require('./gesprek-lijn')({ G, vind, stand, kort, magBellen, nu, schoon,
    zaken, loop, save, crypto, sseToCustomer, sseToOffice });

  /* De belrij van het kantoor. Alleen wat er NU rinkelt of loopt; een gemiste
     oproep hoort in de zaak thuis en niet in een rij die iemand nog kan
     aannemen. */
  const rij = () => G().filter(g => ['rinkelt', 'bezig'].includes(stand(g))).slice(0, 50).map(kort);
  const mijne = (melder) => G().filter(g => g.melder === String(melder || '')).slice(0, 20).map(kort);

  return { magBellen, bel: lijn.bel, neem: lijn.neem, signaal: lijn.signaal, eind: lijn.eind,
    rij, mijne, stand, vind, kort,
    BELPASSEN, RINKEL_SECONDEN };
};
