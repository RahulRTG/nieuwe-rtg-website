/* DE BRONNEN VAN DE REISWERELD (hoort bij kern/reiswereld.js).

   Welk domein welke rij levert. Dat is iets anders dan wat de wereld met die
   rijen doet -- sorteren, oordelen, tellen -- en sinds de Invoerbalie erbij
   kwam past het ook niet meer in één bestand.

   Twee regels gelden hier voor elke bron, en ze staan allebei in wereldkern.js
   uitgelegd: een bron die stukgaat mag de andere niet meenemen EN mag niet stil
   verdwijnen (zijn naam belandt in `stil` en reist door tot op het scherm), en
   elke rij draagt zijn HERKOMST mee -- de bron weet waar de rij vandaan komt en
   de lagen erboven niet (REIZEN.md par. 2.2). */
'use strict';

const { datumVan, tijdVan } = require('./agendatijd');

module.exports = function bronnen({ kern, regel, bron }, key, uit, stil) {
    bron('verblijven', () => (kern.mijnVerblijven(key) || [])
      .filter(v => v.status !== 'geannuleerd')
      .map(v => regel('verblijf', {
        titel: v.roomName, bestemming: v.plaats || '', van: v.aankomst, tot: v.vertrek,
        /* Het hotel IS een zaak en die code stond al op het verblijf;
           mijnVerblijven() zocht hem zelfs op voor `plaats` en gooide hem weg.
           Dit lost de PLEK op en niet de TIJD: een verblijf draagt een
           aankomstdatum zonder uur, dus de naad blijft NIET_TE_BEPALEN met een
           kortere mist-lijst. Een check-in van 15:00 verzinnen zou de marge een
           gok maken. */
        plek: v.supplierCode ? { zaak: v.supplierCode } : null,
        status: v.status, kenmerk: v.id, herkomst: 'partner',
        app: 'Verblijven', link: '/apps/hotels.html'
      })), uit, stil);

    /* HET REISBUREAU DRAAGT GEEN PLEK, en dat blijft zo: een reispakket heeft
       een bestemming als vrije tekst ("Barcelona") en geen zaak. Geen benadering
       op de stadsnaam -- op zo'n marge wordt straks een reservering verzet. Het
       hotel dat het reisbureau boekt IS een zaak, dus daar zit de volgende
       dekkingswinst: in dat domein en niet hier. */
    bron('reisbureau', () => (kern.reisbureau.mijn(key) || [])
      .filter(a => a.status !== 'geannuleerd')
      .map(a => regel('reis', {
        titel: a.titel, bestemming: a.bestemming, van: a.vertrek, personen: a.personen,
        status: a.status, kenmerk: a.ref, herkomst: 'rtg',
        app: 'Reisbureau', link: '/apps/reisbureau.html'
      })), uit, stil);

    /* DE PLEK IS HIER NIET DE BESTEMMING. Bij elk ander onderdeel vallen "waar
       ga ik heen" en "waar moet ik zijn" samen; bij een vlucht niet -- u moet op
       de LUCHTHAVEN zijn. Wie `bestemming` als plek meestuurt, laat Move de
       reistijd naar Parijs Le Bourget rekenen voor iemand die naar de gate moet.
       De bestemming blijft dus vrije tekst ('Ibiza (uit Geneve)') en wordt nooit
       een coordinaat; de luchthaven komt als verwijzing uit kern/luchthaven.
       Dit is de bron die de dekking echt verhoogt: een vlucht draagt als enige
       van de vijf een datum EN een uur. Zie MOVE.md par. 6. */
    bron('vluchten', () => {
      const d = kern.lucht.mijn(key) || {};
      const luchthaven = kern.lucht.plek ? kern.lucht.plek() : null;
      const b = (d.boekingen || []).filter(x => x.status !== 'geannuleerd').map(x => regel('vlucht', {
        titel: (x.vlucht || {}).nummer, bestemming: (x.vlucht || {}).bestemming,
        van: (x.vlucht || {}).datum, tijd: (x.vlucht || {}).tijd, plek: luchthaven,
        status: x.status, kenmerk: x.id, herkomst: 'rtg',
        app: 'Vluchten', link: '/apps/vluchten.html'
      }));
      const c = (d.charters || []).filter(x => x.status !== 'geannuleerd').map(x => regel('charter', {
        titel: x.soort, bestemming: x.bestemming, van: x.datum, tijd: x.tijd, plek: luchthaven,
        status: x.status, kenmerk: x.code, herkomst: 'rtg', app: 'Hangar', link: '/apps/hangar.html'
      }));
      return b.concat(c);
    }, uit, stil);

  /* DE ACTIVITEITEN: tickets en dienstboekingen bij partners (excursies,
     tours, musea, afspraken met een datum). Ze stonden al in de Mall-
     bestellingen en de reisagenda, maar NIET in de reiswereld -- een gekochte
     excursie in Ibiza hoorde dus niet bij de reis naar Ibiza. Sinds fase 4
     van REIZEN.md wel.

     Alleen wat betaald of bevestigd is: een boeking in 'wacht-op-betaling'
     vervalt na een half uur vanzelf (lidacties.js geeft er 410 op) en zou hier
     eeuwig als spook blijven staan. De statusfilter staat NAAST paid en dat is
     verdedigingsdiepte, geen dubbeling: de lid-annulering zet paid op false
     (dus die dekt paid al), maar een annuleringsweg die paid laat staan --
     een zaak die afzegt zonder terug te betalen -- mag hier nooit als reis
     verschijnen. De mutatie die de statusfilter weghaalde sloeg af op de
     bestaande toetsen, precies omdat de demoroutes altijd terugbetalen; dat
     is opgeschreven in plaats van de filter geschrapt (LAT-regel 2). De BESTEMMING komt uit de zaak zelf --
     dezelfde reparatie als bij de verblijven: een boeking draagt de zaak, de
     zaak draagt de stad, en die projectie hoort bij het lezen en op een plek.

     En de wachttekst: een betaald ticket heet 'aangevraagd', maar er wacht
     geen reisadviseur -- de ZAAK bevestigt. Vandaar de eigen wacht-override;
     het woordenboek houdt zijn betekenis, de bron kent zijn wachter. */
  bron('activiteiten', () => {
    const rij = kern.db.boekingenVanKlant ? kern.db.boekingenVanKlant(key)
      : (kern.db.data.boekingen || []).filter(b => (b.customerKey || b.customerTier) === key);
    return rij
      /* WANNEER EEN BOEKING IS, KOMT UIT KERN/AGENDATIJD.JS -- en hier stond een
         derde waarheid. Deze bron filterde op `b.datum` en las `b.tijd`, en die
         velden bestaan niet op een boeking: routes/member/boeken.js zet
         `wanneer` ('JJJJ-MM-DD HH:MM'). Gevolg: het filter was ALTIJD onwaar en
         geen enkele betaalde activiteit of afspraak kwam ooit op de reistijdlijn
         terecht. Stil, want een bron die niets oplevert leest als "u hebt geen
         afspraken" -- precies de faalvorm waar de kop van agendatijd.js voor
         waarschuwt, en die module bestaat om deze twee plekken niet te laten
         uiteenlopen (LAT.md regel 4). */
      .filter(b => datumVan(b) && b.paid && !['geannuleerd', 'geweigerd', 'terugbetaald'].includes(b.status))
      .map(b => {
        const zaak = kern.findSupplier(b.supplierCode);
        return regel(b.kind === 'ticket' ? 'activiteit' : 'afspraak', {
          titel: (b.service && b.service.name) || b.supplierName,
          bestemming: (zaak && zaak.city) || '',
          /* De leverancierscode ging hier al door de handen (`findSupplier`
             hierboven) en werd daarna weggegooid: alleen de stadsnaam bleef
             over. Daarmee wist de tijdlijn WAAR het ongeveer was en niet waar
             het IS, en kon RTG Move geen enkele overgang rekenen. De code gaat
             nu mee als verwijzing; oplossen doet de plekkenlaag. */
          plek: b.supplierCode ? { zaak: b.supplierCode } : null,
          /* En de DUUR, die de boeking al bewaarde (routes/member/boeken.js
             regel 40 zet `service.duurMin`) en die hier net zo hard werd
             weggegooid. Zonder duur is er geen moment waarop u er weg kunt, en
             dus geen overgang naar het volgende onderdeel te rekenen. */
          duurMin: (b.service && b.service.duurMin) || null,
          van: datumVan(b), tijd: tijdVan(b), personen: b.personen,
          status: b.status, wacht: b.status === 'aangevraagd' ? 'de zaak' : null,
          kenmerk: b.ref, herkomst: 'partner',
          app: b.kind === 'ticket' ? 'Tickets' : 'Diensten', link: '/apps/portaal.html'
        });
      });
  }, uit, stil);

  /* DE INVOERBALIE: wat het lid zelf invoerde uit een eigen document, foto of
     e-mail (kern/invoer.js). Een domein als elk ander -- het bezit zijn eigen
     rijen -- met dit verschil: de herkomst komt hier PER RIJ mee en staat niet
     vast. Een ingevoerde regel kan uit een document, een beeld of uit de hand
     komen, en dat verschil bepaalt straks wat ermee mag (REIZEN.md par. 2.2).

     Ontbreekt de module, dan gaat deze bron stuk en meldt hij zich in `stil` --
     precies zoals bedoeld. Een reis die stilletjes zonder uw eigen ingevoerde
     onderdelen wordt getoond, ziet er compleet uit en is het niet. */
  /* EN DE INVOERBALIE DRAAGT ER OOK GEEN. Wat uit een document, een foto of de
     hand komt, is per definitie vrije tekst -- de balie kent geen zaakcode.
     Blijft dus zonder plek, met de reden hierboven bij het reisbureau. */
  bron('ingevoerd', () => (kern.invoer.mijnRegels(key) || []).map(x => regel(x.soort, {
    titel: x.titel, bestemming: x.bestemming, van: x.van, tot: x.tot,
    status: x.status, kenmerk: x.kenmerk, herkomst: x.herkomst,
    app: 'Invoerbalie', link: '/apps/reizen.html'
  })), uit, stil);
};
