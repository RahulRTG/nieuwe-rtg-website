const klok = require('../../../lib/klok');
/* Afdelingsregister deel 2, kamergroep "reisbalie" (kern/afdelingen): DE KAMER
   REISBUREAU van het RTG-kantoor.

   Het reisbureau verkocht al (kern/reisbureau.js + de leden-app), maar er zat
   niemand achter de balie: een aanvraag bleef "aangevraagd" tot het lid hem
   zelf introk, want bevestigen kon niemand. Deze kamer is die mens. Ze rekent
   op codenamen, zoals elke kamer, en mag via de identiteitskluis de echte naam
   opvragen -- een reis bevestigen zonder het lid te kunnen bereiken is geen
   bevestiging. Elke opvraging staat in het auditlog, en het besluit zelf ook.

   Het besluit zelf zit niet hier maar in kern/reisbureau.js (`besluit`), waar de
   aanvraag woont; deze kamer telt en toont. */
module.exports = (ctx) => {
  const { d, lijst, tel, recent } = ctx;

  return {
    reisbureau: { naam: 'Reisbureau', icoon: 'reisboek', naamInzage: true,
      missie: 'Elke reisaanvraag door een mens bevestigd, en nooit iets beloven wat nog niet rond is.',
      kpis: () => {
        const alle = lijst(d().reisAanvragen);
        const open = alle.filter(a => a.status === 'aangevraagd');
        const grens = klok.nu() - 2 * 86400000;
        return [
          ['Aanvragen open', open.length],
          ['Wacht langer dan twee dagen', open.filter(a => a.at && new Date(a.at).getTime() < grens).length],
          ['Bevestigd', alle.filter(a => a.status === 'bevestigd').length],
          ['Afgewezen', alle.filter(a => a.status === 'afgewezen').length],
          ['Aanvragen deze week', recent(d().reisAanvragen, 'at', 7)],
          ['Reizen in de etalage', tel(d().partnerTrips)]
        ];
      },
      lijsten: () => {
        const alle = lijst(d().reisAanvragen);
        return [
          { titel: 'Aanvragen die op een besluit wachten', items: alle.filter(a => a.status === 'aangevraagd').slice(0, 10)
            .map(a => a.ref + ' · ' + a.titel + ' (' + a.bestemming + ') · ' + a.personen + ' pers'
              + (a.vertrek ? ' · vertrek ' + a.vertrek : ' · datum nog open') + ' · ' + (a.codename || 'lid')) },
          { titel: 'Laatst genomen besluiten', items: alle.filter(a => a.besluit).slice(0, 8)
            .map(a => a.ref + ' · ' + a.status + ' door ' + a.besluit.door + (a.besluit.bericht ? ': ' + a.besluit.bericht.slice(0, 60) : '')) },
          { titel: 'Harde grens', items: [
            'Een aanvraag heet "aangevraagd" tot u hem bevestigt. Bevestig pas als het verblijf, het vervoer en de datum echt rond zijn -- een bevestiging is een toezegging aan een lid, geen statusveld.',
            'Afwijzen kan alleen met een reden; die reden leest het lid.',
            'Geen luchtvaart- of hotelmerk als bevestigde partner noemen zolang dat niet zwart op wit staat.'
          ] }
        ];
      } },
  };
};
