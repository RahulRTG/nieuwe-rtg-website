/* HET OVERZICHT: wat heeft deze gebruiker deze maand gekost, en hoe hard is dat.

   Elke regel draagt drie dingen die je op een gewone kostenrapportage niet
   vindt: het AANTAL (waar het uit gerekend is), de BRON van het tarief, en de
   BEWIJSGRAAD. Die derde is de reden dat deze laag bestaat. BESTUUR.md par. 3:
   een bord dat een getal toont zonder te zeggen waar het vandaan komt, zegt
   alleen dat niemand heeft gekeken.

   ER STAAT NOOIT EEN GETAL WAAR ER GEEN IS. Drie dingen kunnen ontbreken, en
   alle drie komen ze als reden terug in plaats van als nul:

     - een soort die niemand meet (er is geen teller aangesloten);
     - een tarief dat niemand heeft ingevoerd (./tarieven.js);
     - een nota die niemand heeft ingevoerd (./huisrekening.js).

   Nul zou hier "gratis" betekenen, en dat is precies de bewering die je niet
   moet doen als je het niet weet.

   HET TARIEF VAN TOEN, NIET VAN NU. Voor de maand juni rekent dit met het
   tarief zoals het in juni gold. Anders verandert een verstuurde factuur zodra
   een aanbieder zijn prijs aanpast.

   DE AFSTEMMING IS DE ZELFCONTROLE. Voor elke gemeten soort waarvan het huis
   ook de echte nota heeft ingevoerd, staan er twee getallen naast elkaar: de
   optelsom van alle gebruikers, en de rekening. Lopen ze uiteen, dan klopt het
   tarief niet of mist de meter verbruik. Dat verschil wordt getoond en niet
   weggewerkt. */
'use strict';

const { SOORTEN, soort, gemeten, plafond, GRAAD } = require('./soorten');
const { ontleed } = require('./haak');

/* Het einde van een maand als ISO-achtige string. De 31e bestaat niet in elke
   maand, en dat mag hier: deze waarde wordt alleen VERGELEKEN met een echte
   tijdstempel, nooit als datum gelezen. '2026-02-31T23:59:59.999Z' ligt netjes
   na elke tijdstempel in februari en voor elke in maart, en dat is precies wat
   "het tarief zoals het toen gold" nodig heeft. Wie hier een echte datum van
   maakt, moet ook weten hoeveel dagen de maand had -- voor een vergelijking
   die dat niet nodig heeft. */
const eindeVan = (periode) => String(periode) + '-31T23:59:59.999Z';

module.exports = (ctx) => {
  const { meter, tarieven, huisrekening } = ctx;

  /* De zwakste van een rij graden. Een optelsom is nooit harder dan zijn
     slapste term: één toegerekende post maakt het TOTAAL een schatting, ook al
     zijn de andere zes regels gemeten. */
  const zwakste = (graden) => graden.length
    ? graden.reduce((a, g) => (GRAAD.indexOf(g) < GRAAD.indexOf(a) ? g : a), GRAAD[GRAAD.length - 1])
    : 'onbekend';

  /* Wat kost dit aantal van deze soort, in millicenten? Geeft null met een
     reden als er geen tarief was. */
  function regelVan(periode, soortId, aantal) {
    const s = soort(soortId);
    const t = tarieven.tariefOp(soortId, eindeVan(periode));
    const basis = { soort: soortId, naam: s.naam, aantal: Math.round(aantal * 1000) / 1000,
      ruw: s.ruw, eenheid: s.eenheid };
    if (!t) return Object.assign(basis, { millicenten: null, graad: 'onbekend', bron: null,
      waarom: 'Er is geen tarief ingevoerd voor ' + s.naam.toLowerCase() + ', dus er wordt niets uitgerekend.' });
    return Object.assign(basis, {
      millicenten: Math.round(aantal / s.stap * t.perEenheid),
      tariefPerEenheid: t.perEenheid, bron: t.bron, tariefGezetOp: t.gezetOp,
      graad: plafond(soortId, 'gemeten')
    });
  }

  /* De gemeten regels van één drager. Soorten waar deze gebruiker niets van
     verbruikte staan er niet bij; soorten die NIEMAND meet staan apart in
     nietGemeten(), want dat is een gat in de meting en geen nulverbruik. */
  function directeRegels(periode, drager) {
    const rij = meter.kijk(periode, drager) || {};
    return gemeten().filter(s => Number(rij[s.id]) > 0).map(s => regelVan(periode, s.id, Number(rij[s.id])));
  }

  /* Voor ./toerekening.js: per drager de som van zijn gemeten kosten in
     millicenten. Alleen regels met een tarief tellen mee -- een soort zonder
     tarief mag geen gewicht krijgen, anders verdeelt hij stroom op een getal
     dat nul is omdat er iets ontbreekt. */
  function directeKostenPerDrager(periode) {
    const uit = {};
    for (const dr of meter.dragers(periode)) {
      uit[dr] = directeRegels(periode, dr).reduce((a, r) => a + (r.millicenten || 0), 0);
    }
    return uit;
  }

  /* Welke soorten heeft niemand gemeten in deze periode. Met de grond uit
     ./soorten.js erbij, zodat een lezer ziet of er een teller ontbreekt of dat
     er gewoon niets gebeurde. */
  function nietGemeten(periode) {
    const alles = meter.kijkPeriode(periode);
    const gezien = new Set();
    for (const dr of Object.keys(alles)) for (const k of Object.keys(alles[dr])) gezien.add(k);
    return gemeten().filter(s => !gezien.has(s.id))
      .map(s => ({ soort: s.id, naam: s.naam, waarom: 'Geen enkele meting in deze maand.', grond: s.grond }));
  }

  /* Het volledige beeld van één gebruiker: gemeten, toegerekend, totaal.

     `alVerdeeld` is de al berekende verdeling van die maand ({ drager -> regels }).
     Dat is geen versiering maar een noodzaak: de verdeelsleutel is een AANDEEL,
     dus elke toerekening rekent de hele maand door. Wie dat per gebruiker
     opnieuw doet, rekent bij duizend gebruikers duizend keer duizend -- en dan
     staat er een bord dat in een demo snel is en in productie vastloopt. De
     lezers die over alle dragers gaan, geven hem dus één keer mee. */
  function voorDrager(periode, drager, alVerdeeld) {
    const p = meter.periodeVan(periode);
    const directe = directeRegels(p, drager);
    const verdeeld = alVerdeeld ? (alVerdeeld[drager] || [])
      : (ctx.toerekening ? ctx.toerekening.verdeeldVoor(p, drager) : []);
    const millicenten = directe.reduce((a, r) => a + (r.millicenten || 0), 0);
    const verdeeldeCenten = verdeeld.reduce((a, r) => a + (r.centen || 0), 0);
    const centen = Math.round(millicenten / 1000) + verdeeldeCenten;
    const graad = zwakste(directe.concat(verdeeld).map(r => r.graad || 'onbekend'));
    return { periode: p, drager, wie: ontleed(drager), regels: directe, toegerekend: verdeeld,
      totaal: { centen, millicenten, graad },
      zonderTarief: directe.filter(r => r.millicenten == null).map(r => r.soort),
      nietGemeten: nietGemeten(p) };
  }

  /* Alle gebruikers van een maand, gesorteerd op wat ze kosten. Dit is het
     beeld waar de vraag "wie kost ons wat" mee begint. */
  function alleDragers(periode) {
    const p = meter.periodeVan(periode);
    const verdeeld = ctx.toerekening ? ctx.toerekening.verdeling(p).perDrager : {};
    return meter.dragers(p).map(dr => {
      const o = voorDrager(p, dr, verdeeld);
      return { drager: dr, wie: o.wie, centen: o.totaal.centen, graad: o.totaal.graad };
    }).sort((a, b) => b.centen - a.centen);
  }

  /* De zelfcontrole: gerekend tegenover werkelijk betaald. */
  function afstemming(periode) {
    const p = meter.periodeVan(periode);
    const alles = meter.kijkPeriode(p);
    return gemeten().map(s => {
      let aantal = 0;
      for (const dr of Object.keys(alles)) aantal += Number(alles[dr][s.id]) || 0;
      const r = regelVan(p, s.id, aantal);
      const post = huisrekening.postVan(p, s.id);
      const gerekend = r.millicenten == null ? null : Math.round(r.millicenten / 1000);
      return { soort: s.id, naam: s.naam, aantal, gerekendCenten: gerekend,
        notaCenten: post ? post.centen : null, notaBron: post ? post.bron : null,
        verschilCenten: (gerekend == null || !post) ? null : post.centen - gerekend,
        waarom: post ? null : 'Geen nota ingevoerd voor deze maand; er valt niets na te rekenen.' };
    });
  }

  /* De verdeling van een maand, voor lezers die over alle dragers gaan en hem
     dus maar EEN keer moeten uitrekenen. */
  const verdelingVan = (periode) => ctx.toerekening ? ctx.toerekening.verdeling(meter.periodeVan(periode)).perDrager : {};

  return { voorDrager, alleDragers, verdelingVan, directeRegels, directeKostenPerDrager, nietGemeten, afstemming, regelVan, SOORTEN };
};
