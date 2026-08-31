/* ============================================================================
   DE DOELPOORT -- mag dit gegeven voor DIT doel gebruikt worden?

   Het register staat in ./doelen.js; dit bestand BESLIST. Die scheiding is
   dezelfde als bij gegevenssoorten/gegevenskaart en sessievelden/sessiecontext.

   DRIE STANDEN, EN HIJ BEGINT IN DE SCHADUW, precies zoals het bezitsbewijs.
   CONTROLPLANE.md: je kunt niet afdwingen wat nooit in de schaduw heeft gelopen.

     schaduw      (standaard) weigert NOOIT. Rekent wel uit wat er zou zijn
                  gebeurd en telt dat, zodat er iets te beslissen valt.
     afdwingen    weigert echt.

   Twee en niet drie: bij het bezitsbewijs bestaat `aanbevolen` omdat een
   waarschuwing aan een MENS daar betekenis heeft ("bind uw toestel"). Hier
   staat geen mens; hier vraagt code of zij dit gegeven mag gebruiken, en
   "eigenlijk niet" is geen antwoord waar een aanroeper iets mee kan. Een derde
   stand die niemand kan uitvoeren, is een knop die niets doet.

   ER KOMT GEEN TWEEDE TOESTEMMINGSBOEKHOUDING BIJ. Een doel met grond
   `toestemming` vraagt het aan kern/identiteit/commercieel.js -- dezelfde laag
   die het scherm en het Consent Center lezen. Zou deze poort een eigen ja/nee
   bewaren, dan zijn er binnen een jaar twee waarheden over hetzelfde en
   verschilt de ene van de andere precies wanneer het ertoe doet (LAT-regel 4).

   VIER UITKOMSTEN EN NIET TWEE, in de geest van CONTROLPLANE.md: `onbekend` is
   met opzet geen synoniem van `geweigerd`. Een doel dat niemand kent is een
   fout van de aanroeper; een storing is geen overtreding. Ze klinken hier dus
   ook niet hetzelfde.
   ========================================================================== */
'use strict';

const { DOELEN, GRONDEN, DOEL_IDS } = require('./doelen');

const STANDEN = ['schaduw', 'afdwingen'];

function standVan() {
  const v = String(process.env.RTG_DOELBINDING || '').trim().toLowerCase();
  if (!v) return { stand: 'schaduw', reden: 'niet ingesteld' };
  if (!STANDEN.includes(v)) return { stand: 'schaduw', reden: 'onbekende waarde "' + v + '"; teruggevallen op schaduw' };
  return { stand: v, reden: 'ingesteld' };
}

function maakDoelpoort({ commercieel }) {
  /* DE TELLERS, en met opzet geen journaal. Wie welk gegeven waarvoor gebruikte
     is een gedragslogboek per lid, en dat is voor deze vraag niet nodig -- het
     gaat erom HOE VAAK er iets langskomt dat niet mag. Zelfde keuze als in
     kern/kosten/meterstand.js, en om dezelfde reden. */
  const tellers = { toegestaan: 0, geweigerd: 0, onbekend: 0, storing: 0 };
  const gemist = new Map(); // "doel/gegeven" -> aantal

  const doelVan = (id) => DOELEN.find(d => d.id === String(id)) || null;

  /* Het oordeel, zonder de stand. Los omdat de schaduw hem óók moet kunnen
     uitrekenen zonder te weigeren -- en omdat een besluit dat je niet apart
     kunt navragen, niet te toetsen is. */
  function beoordeel(lidKey, doelId, gegevenId) {
    if (!DOEL_IDS.has(String(doelId))) {
      return { uitkomst: 'onbekend', reden: 'Het doel "' + doelId + '" bestaat niet in het register.' };
    }
    const doel = doelVan(doelId);
    if (!doel.gegevens.includes(String(gegevenId))) {
      /* DIT IS DE KERN VAN DOELBINDING. Het gegeven bestaat, het doel bestaat,
         en toch mag het niet -- want dit doel is niet waarvoor dit gegeven er
         is. Zonder deze regel is "doel" een woord op een scherm. */
      return { uitkomst: 'geweigerd',
        reden: 'Dit gegeven hoort niet bij dit doel: ' + doel.naam.toLowerCase() + ' raakt ' + gegevenId + ' niet.' };
    }
    const grond = GRONDEN[doel.grond];
    if (!grond.weigerbaar) return { uitkomst: 'toegestaan', grond: doel.grond, reden: grond.naam };

    /* Weigerbaar betekent: het staat UIT tot het lid ja zei. Het antwoord komt
       uit de laag die dat al bijhoudt. */
    if (!commercieel || typeof commercieel.standVan !== 'function') {
      return { uitkomst: 'storing', reden: 'De toestemmingslaag is hier niet aangesloten; dit is dus onbekend en geen ja.' };
    }
    let aan = false;
    try {
      const stand = commercieel.standVan(lidKey);
      const rij = (stand.soorten || []).find(s => s.id === doel.viaPost);
      aan = !!(rij && rij.aan);
    } catch (e) {
      return { uitkomst: 'storing', reden: 'De toestemmingslaag liep stuk; dit is onbekend en geen ja.' };
    }
    return aan
      ? { uitkomst: 'toegestaan', grond: doel.grond, reden: 'U heeft hier toestemming voor gegeven.' }
      : { uitkomst: 'geweigerd', grond: doel.grond, reden: 'Hier heeft u geen toestemming voor gegeven.' };
  }

  /* De poort zelf. Geeft `mag` terug -- in de schaduw ALTIJD true, want daar
     weigert hij nooit. Het oordeel reist mee, zodat een aanroeper die het wil
     weten het kan zien zonder de stand te hoeven kennen. */
  function mag(lidKey, doelId, gegevenId) {
    const { stand } = standVan();
    const oordeel = beoordeel(lidKey, doelId, gegevenId);
    tellers[oordeel.uitkomst] = (tellers[oordeel.uitkomst] || 0) + 1;
    if (oordeel.uitkomst !== 'toegestaan') {
      const sleutel = doelId + '/' + gegevenId;
      gemist.set(sleutel, (gemist.get(sleutel) || 0) + 1);
    }
    /* EEN STORING WEIGERT NOOIT, ook niet in de stand `afdwingen`. Als de
       toestemmingslaag stuk is, weten we het niet -- en een onbekende als
       weigering behandelen zet de app stil om een reden die niets met het lid
       te maken heeft. Hij blijft wel geteld, en juist die teller hoort iemand
       op te vallen. */
    const blokkeert = stand === 'afdwingen' && oordeel.uitkomst === 'geweigerd';
    return Object.assign({ mag: !blokkeert, stand }, oordeel);
  }

  function meter() {
    const totaal = Object.values(tellers).reduce((a, b) => a + b, 0);
    return {
      stand: standVan(),
      tellers,
      /* GEEN PERCENTAGE ZOLANG ER NIETS IS GEMETEN. Nul zou "alles gaat mis"
         kunnen lezen terwijl er domweg niets langskwam. Zelfde regel als in
         kern/identiteit/bezitsmeter.js. */
      aandeelGeweigerd: totaal ? Math.round((tellers.geweigerd / totaal) * 1000) / 10 : null,
      vaakstGeweigerd: [...gemist.entries()].sort((a, b) => b[1] - a[1]).slice(0, 10)
        .map(([sleutel, n]) => ({ sleutel, aantal: n })),
      nietGemeten: 'Deze tellers lopen per werkproces en beginnen opnieuw bij een herstart. Dit huis draait er meerdere, dus dit is een steekproef en geen totaal.'
    };
  }

  return { mag, beoordeel, meter, standVan, STANDEN };
}

module.exports = { maakDoelpoort, standVan, STANDEN };
