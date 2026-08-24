/* Horeca (kern): DE BAR -- welke drankgolf moet nu gemaakt worden?

   WAAROM DE BAR EEN EIGEN WERKSTAND KRIJGT en niet een filter op het
   keukenbord. Een keuken groepeert op GANG: een gang gaat samen de deur uit,
   dat is de hele belofte van gangregie. Een bar groepeert op twee assen
   tegelijk, en die twee vechten met elkaar:

     PER TAFEL -- een ronde moet samen landen. Vier mensen proosten samen; een
     glas dat vijf minuten eerder komt is geen service maar een probleem.
     PER DRANK -- drie gin-tonics over twee tafels zijn EEN handeling achter de
     bar. Eén keer de gin pakken, één keer de tonic open, drie glazen naast
     elkaar. Wie dat per tafel afwerkt, doet het werk drie keer.

   Dit bestand lost die botsing niet op met een algoritme, want dat zou een
   volgorde verzinnen. Het toont ze allebei: de GOLVEN (per tafel, oudste eerst)
   en de STAPEL (dezelfde drank over alle open golven). De barman ziet wat er
   moet en wat er samen kan, en beslist zelf. Dat is dezelfde grens als bij de
   drukterem in keukenlaag.js: het systeem rekent, de mens bepaalt.

   WAT ER NIET IS, EN DAT IS EXPRES:

   - GEEN GRENS OP HOE LANG EEN DRANKJE MAG STAAN. IJs smelt en schuim zakt, dus
     zo'n grens is echt -- maar hij is nergens vastgelegd, en hem hier verzinnen
     zou een getal maken dat niemand gemeten heeft (HORECA.md, grens 7). Wat er
     wél staat is hoeveel minuten het eerste glas al staat te wachten op de rest
     van zijn ronde. Een feit waar een mens op mag handelen.
   - GEEN TWEEDE ORDERSTAAT. Een golf is een projectie op de regels van de
     bestaande rekening. Er wordt hier niets aangemaakt en niets afgevinkt; het
     zetten van een stand gaat over dezelfde deur als bij de keuken.
   - GEEN ALCOHOLCONTROLE. De kaart weet welk item alcohol bevat, de REGEL niet;
     de leeftijdsregel woont in kern/gast/beleid.js en de controle aan tafel is
     een menselijke handeling. Een half vlaggetje hier zou de indruk wekken dat
     de bar het bewaakt, en dat is erger dan niets. */
'use strict';

const klok = require('../../lib/klok');
const { bereidingsMinuten } = require('./keukenlaag');

/* Twee stations, want ze delen het probleem: een koffie wordt koud zoals een
   cocktail warm wordt, en allebei worden ze achter een toog gemaakt terwijl de
   keuken doorwerkt. */
const STATIONS = ['bar', 'koffie'];

const MIN = 60000;
const minutenSinds = (at, nuMs) => at ? Math.max(0, Math.round((nuMs - Date.parse(at)) / MIN)) : 0;

module.exports = ({ horeca, schoon }) => {
  const gezelschap = require('./gezelschap')({ horeca, schoon });

  const isDrank = (r) => STATIONS.includes(String(r.station || '').toLowerCase());

  /* De open drankgolven: per rekening en per gang, alles wat is vrijgegeven en
     nog niet is uitgeserveerd. Oudste eerst -- niet tafel 1 en niet de duurste
     tafel, want het enige waar op deze lijst tijd doorheen loopt is wachten. */
  function golven(h, nuMs) {
    const nuT = typeof nuMs === 'number' ? nuMs : klok.nu();
    const uit = [];
    for (const rek of Object.values(h.rekeningen || {})) {
      if (rek.status !== 'open' && rek.status !== 'betaald') continue;
      const perGang = new Map();
      for (const r of (rek.regels || [])) {
        if (!isDrank(r)) continue;
        if (!r.vrijAt || r.stand === 'uitgegeven') continue;
        if (r.bevestiging === 'wacht') continue;   // wacht op een mens
        const k = String(r.gang || 0);
        if (!perGang.has(k)) perGang.set(k, []);
        perGang.get(k).push(r);
      }
      for (const [gang, regels] of perGang) {
        const vroegste = regels.reduce((v, r) => {
          const t = Date.parse(r.vrijAt);
          return isNaN(t) ? v : (v === null ? t : Math.min(v, t));
        }, null);
        const klaar = regels.filter((r) => r.stand === 'klaar');
        const compleet = klaar.length === regels.length;
        /* Het getal dat er voor een bar het meest toe doet: hoe lang staat het
           EERSTE glas al te wachten op de rest van zijn ronde. Bij een complete
           ronde is dat nul -- dan wacht hij op een drager, en dat staat op de
           pas (kern/horeca/pas.js). */
        const staat = (!compleet && klaar.length)
          ? Math.max(...klaar.map((r) => minutenSinds(r.klaarAt, nuT))) : 0;
        uit.push({
          rekeningId: rek.id, tafel: rek.tafel || rek.kanaal, kanaal: rek.kanaal,
          gang: Number(gang),
          sinds: minutenSinds(vroegste ? new Date(vroegste).toISOString() : null, nuT),
          klaar: klaar.length, totaal: regels.length, compleet, staat,
          regels: regels.map((r) => ({
            regelId: r.id, naam: r.naam, aantal: r.aantal, stand: r.stand,
            station: String(r.station || 'bar').toLowerCase(),
            norm: bereidingsMinuten(h, r),
            allergie: r.allergie || null,
            notitie: r.notitie || null,
            stoel: gezelschap.handleVan(rek, r.gastNr)
          })).sort((a, b) => a.naam.localeCompare(b.naam))
        });
      }
    }
    return uit.sort((a, b) => b.sinds - a.sinds);
  }

  /* DE STAPEL: dezelfde drank over alle open golven, opgeteld. Alleen wat nog
     NIET klaar is -- een glas dat al staat, hoef je niet nog eens te maken.

     Dit hergroepeert niets en verplaatst niets: het is dezelfde verzameling
     regels, een andere kant op geteld. */
  function stapel(h, nuMs) {
    const perDrank = new Map();
    for (const g of golven(h, nuMs)) {
      for (const r of g.regels) {
        if (r.stand === 'klaar') continue;
        const sleutel = r.naam.toLowerCase();
        if (!perDrank.has(sleutel)) {
          perDrank.set(sleutel, { naam: r.naam, station: r.station, aantal: 0, tafels: [], regelIds: [] });
        }
        const d = perDrank.get(sleutel);
        d.aantal += r.aantal;
        if (!d.tafels.includes(g.tafel)) d.tafels.push(g.tafel);
        d.regelIds.push(r.regelId);
      }
    }
    return [...perDrank.values()].sort((a, b) => b.aantal - a.aantal || a.naam.localeCompare(b.naam));
  }

  return { golven, stapel, STATIONS };
};
