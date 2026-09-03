/* ============================================================================
   HOE GOED IS DEZE SERVICE -- en waarom niet op afhandeltijd.

   EEN CALLCENTER MEET average handling time en tickets per medewerker. Die twee
   getallen belonen precies het verkeerde: wie een zaak snel sluit scoort beter
   dan wie hem oplost, en wie doorverwijst scoort beter dan wie doorbijt. Binnen
   een half jaar meet je dan hoe snel mensen van een probleem afkomen.

   DE MAAT DIE HIER TELT is een andere:

     Hoeveel problemen zijn opgelost zonder dat de melder zijn verhaal
     opnieuw hoefde te vertellen?

   Dat is te meten, het is niet te halen door harder te werken, en het gaat over
   wat een melder werkelijk overkomt. Het is ook precies wat deze laag mogelijk
   maakt: de zaak draagt zijn context mee, dus een overdracht hoeft geen herstart
   te zijn.

   WAT "OPNIEUW UITLEGGEN" HIER BETEKENT, en het is met opzet streng: de melder
   heeft na een menselijke overname nog een keer zelf een bericht moeten sturen
   VOORDAT die mens iets zei. Dan is de overdracht de melder zijn tijd gaan
   kosten. Wij meten dus niet of hij iets herhaalde -- dat is niet vast te
   stellen zonder zijn woorden te wegen -- maar of de STRUCTUUR hem dwong.

   VIJF DINGEN DIE HIER NIET STAAN, EN WAAROM:

   - AFHANDELTIJD PER MEDEWERKER. Zie boven. De doorlooptijd staat er wel, maar
     per ZAAK en zonder naam eronder; wie hem per mens wil, bouwt een ranglijst
     op mensen, en dat doet dit huis nergens (HORECA.md voert dezelfde regel).
   - TEVREDENHEID. Er wordt niets gevraagd, dus er is niets te melden. Een
     geschat cijfer is erger dan geen cijfer.
   - EEN SAMENGESTELD RAPPORTCIJFER. Zes eerlijke getallen bij elkaar optellen
     geeft een gevoel van zekerheid dat geen van de zes draagt -- exact waar
     scripts/zekerheid.js voor bestaat.
   - EEN PERCENTAGE ZONDER NOEMER. Elke verhouding hieronder draagt zijn
     `van`-getal, want 100% van twee zaken is geen 100%.
   - EEN GETAL WAAR ER GEEN IS. Te weinig zaken? Dan `nietTeZeggen` met de reden,
     en geen nul.
   ========================================================================== */
'use strict';

const klok = require('../../lib/klok');
const { STANDEN } = require('./klassen');

/* Onder deze grens wordt er geen verhouding getoond. Tien is laag, en dat mag:
   het gaat er niet om dat het getal statistisch hard is, maar dat het geen
   stemming wordt van drie zaken. */
const MINIMUM = 10;
/* Heropend binnen deze termijn telt als "was niet opgelost". */
const HEROPEN_DAGEN = 7;

module.exports = function maakKwaliteit({ zaken }) {
  const nu = () => klok.nu();

  const verhouding = (raak, van, waarom) => (van < MINIMUM
    ? { nietTeZeggen: true, van, waarom: waarom || ('Minder dan ' + MINIMUM + ' zaken; een verhouding over ' + van + ' zegt niets.') }
    : { deel: raak, van, procent: Math.round((raak / van) * 1000) / 10 });

  /* Moest de melder zijn verhaal opnieuw doen? Waar: hij vroeg om een mens, en
     daarna stuurde HIJ het eerstvolgende bericht. Dan wachtte de overdracht op
     hem in plaats van andersom. */
  function opnieuwUitleggen(z) {
    const vraag = z.tijdlijn.find(r => r.wat === 'mensGevraagd');
    if (!vraag) return null;                       // geen overdracht, geen oordeel
    const na = z.tijdlijn.filter(r => r.wat === 'bericht' && r.at >= vraag.at);
    const eerste = na.find(r => r.van === 'melder' || r.van === 'mens');
    return !!(eerste && eerste.van === 'melder');
  }

  /* Heropend: na een eindstand is de zaak weer gaan lopen. Uit de tijdlijn en
     niet uit een vlag -- een vlag die iemand vergeet te zetten, maakt dit getal
     stilletjes mooier. */
  function heropend(z) {
    let dicht = null;
    for (const r of z.tijdlijn) {
      if (r.wat !== 'stand') continue;
      const s = STANDEN[r.naar];
      if (!s) continue;
      if (s.eind) { dicht = r.at; continue; }
      if (dicht && Date.parse(r.at) - Date.parse(dicht) <= HEROPEN_DAGEN * 86400000) return true;
      dicht = null;
    }
    return false;
  }

  const gemeten = (k) => k && !k.nietGemeten && typeof k.minuten === 'number';

  function meting({ sinds, team } = {}) {
    const grens = sinds ? Date.parse(sinds) : 0;
    let alle = zaken.bak().filter(z => !grens || Date.parse(z.at) >= grens);
    if (team) alle = alle.filter(z => z.team === String(team));

    const klok2 = require('./klok');
    const metOverdracht = alle.filter(z => opnieuwUitleggen(z) !== null);
    const opnieuw = metOverdracht.filter(z => opnieuwUitleggen(z) === true);
    const afgerond = alle.filter(z => (STANDEN[z.stand] || {}).eind);
    const opgelost = alle.filter(z => z.stand === 'opgelost');
    const her = afgerond.filter(heropend);

    /* De hersteltijden, en alleen de GEMETEN. Een ongemeten klok als nul
       meetellen maakt het gemiddelde beter naarmate er minder is opgelost. */
    const tijden = opgelost.map(z => klok2.klokken(z).hersteltijd).filter(gemeten).map(k => k.minuten);
    const mediaan = tijden.length
      ? tijden.slice().sort((a, b) => a - b)[Math.floor(tijden.length / 2)]
      : null;

    return {
      at: new Date(nu()).toISOString(),
      zaken: alle.length,
      /* DE MAAT DIE ERTOE DOET, en hij staat vooraan. */
      zonderOpnieuwUitleggen: Object.assign(
        verhouding(metOverdracht.length - opnieuw.length, metOverdracht.length,
          'Minder dan ' + MINIMUM + ' zaken met een menselijke overdracht; hierover valt nog niets te zeggen.'),
        { wat: 'Overdrachten waarbij RTG als eerste iets zei, en de melder zijn verhaal dus niet opnieuw hoefde te doen.' }),
      heropendBinnenWeek: Object.assign(verhouding(her.length, afgerond.length),
        { wat: 'Afgeronde zaken die binnen ' + HEROPEN_DAGEN + ' dagen weer gingen lopen. Die waren dus niet opgelost.' }),
      omMensGevraagd: Object.assign(verhouding(metOverdracht.length, alle.length),
        { wat: 'Zaken waarin de melder om een mens vroeg. Dit is GEEN faalgetal: soms hoort dat gewoon.' }),
      /* De doorlooptijd per ZAAK en zonder naam eronder. Wie hem per mens wil,
         bouwt een ranglijst op mensen. */
      herstelMediaanMinuten: mediaan == null
        ? { nietTeZeggen: true, waarom: 'Geen enkele opgeloste zaak met een gemeten hersteltijd.' }
        : { minuten: mediaan, van: tijden.length,
            wat: 'De MEDIAAN en niet het gemiddelde: een enkele zaak van drie weken hoort het beeld niet te bepalen.' },
      /* En wat er met opzet niet in staat, zodat niemand het mist en zelf
         verzint. */
      nietGemeten: {
        tevredenheid: 'Er wordt niets gevraagd, dus er is niets te melden. Een geschat cijfer is erger dan geen cijfer.',
        afhandeltijdPerMedewerker: 'Niet gemeten en niet te bouwen zonder een ranglijst op mensen; dat doet dit huis nergens.',
        rapportcijfer: 'Deze getallen worden niet opgeteld. Zes eerlijke cijfers samen geven een zekerheid die geen van de zes draagt.'
      }
    };
  }

  return { meting, opnieuwUitleggen, heropend, MINIMUM, HEROPEN_DAGEN };
};
