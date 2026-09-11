/* DE BRONNEN MET HERKOMST `partner` (hoort bij kern/reiswereld-bronnen.js):
   het verblijf bij een hotel en de activiteiten en afspraken bij een zaak.
   Afgeknipt op de naad die elke rij toch al draagt -- de HERKOMST -- toen
   reiswereld-bronnen.js tegen de tien kilobyte liep. De regels uit de kop van
   dat bestand gelden hier onverkort: een bron die stukgaat neemt de andere
   niet mee en verdwijnt niet stil. */
'use strict';

const { datumVan, tijdVan } = require('./agendatijd');

function verblijven({ kern, regel, bron }, key, uit, stil) {
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
}

function activiteiten({ kern, regel, bron }, key, uit, stil) {
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
}

module.exports = { verblijven, activiteiten };
