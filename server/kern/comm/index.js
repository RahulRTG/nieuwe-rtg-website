/* ==================== RTG COMMUNICATION CORE ====================

   EEN GESPREK IS EEN GESPREK, WAAR HET OOK VANDAAN KOMT.

   Wat hier veranderde. Dit huis had zes berichtenvoorraden naast elkaar --
   db.data.memberChats (vrienden), applyChats (sollicitaties), guestChats
   (gast en zaak), collegaChats (werkvloer), podiumChat en rijkBerichten
   (overheid) -- en elke module die er een gesprek bij wilde, bouwde de
   zevende. Elk met een eigen berichtvorm, een eigen verstuurroute, een eigen
   leesstand, en geen van alle met zoiets gewoons als een reactie, een
   antwoord-op of een correctie. De Berichten-app was daarbovenop een LEESLIJST
   die naar de bron-app doorverwees: hij kon tonen dat er iets was, en verder
   niets.

   Dat is de fout die je maar een keer moet maken. Een chatfunctie per module
   betekent dat "verwijderen voor iedereen", "gelezen op dit apparaat" of
   "zoeken over alles" zes keer gebouwd en zes keer net anders wordt -- en dat
   de zevende module weer bij nul begint.

   Dus: communicatie is hier INFRASTRUCTUUR, geen functie. Er is een
   gesprekmodel, een berichtmodel en een standenmodel, en elke module vraagt
   het aan deze kern:

       comm.gesprekMaak({ soort: 'ride', deelnemers: [chauffeur, reiziger],
                          titel: 'Rit RT-1941', meta: { sleutel: 'rit:RT-1941' } })

   Taxi bouwt dus geen berichtenbackend. Horeca ook niet. School ook niet.

   HET SOORT IS DE CONTEXT, en dat is meer dan een etiket: het bepaalt in welke
   la van de inbox het gesprek valt en welke regels erop staan. De twaalf staan
   in SOORTEN hieronder en zijn bewust een gesloten lijst -- een vrij tekstveld
   was binnen een maand een verzameling spelfouten geweest.

   DRIE REGELS DIE HET ONTWERP STUREN, en die verderop worden afgedwongen en
   niet alleen beschreven:

   1. ALLES OP CODENAAM. Deze kern kent sleutels en codenamen, nooit echte
      namen; die staan in de gescheiden kluis (accounts.js) en komen hier niet
      langs. Ook niet in een titel, ook niet in een zoekindex.
   2. WIE ER NIET IN ZIT, LEEST NIET MEE. Elke leesweg loopt langs magErin().
      Een gesprek-id raden mag nooit genoeg zijn.
   3. DE AI STELT OP, DE MENS VERSTUURT. Deze kern heeft geen enkele weg waarop
      een model zelf een bericht plaatst; @Rahul levert tekst terug (zie ./ai)
      en die belandt in het invoerveld. Dezelfde drempel als bij geld.

   EEN DEELNEMER IS NIET PER SE EEN LID. In `deelnemers` staan sleutels, en
   sinds ./wie.js kan zo'n sleutel ook een zaak zijn ('zaak:AB12'), een
   medewerker ('mens:AB12:7') of het kantoor. Dat is wat de laatste voorraden
   ontsluit -- het gastcontact, de collega-DM, de sollicitatie stonden niet
   apart omdat ze anders waren, maar omdat de andere kant van het gesprek geen
   naam had in dit model. Deze kern verandert er nauwelijks door: de poort is
   nog steeds de deelnemerslijst, en die kent alleen sleutels. Wie zo'n sleutel
   MAG dragen, wordt beantwoord waar de sessie is (routes/supplier/comm.js) en
   niet hier.

   WAT HIER (NOG) NIET IN ZIT, zodat niemand het hier gaat zoeken: end-to-end
   encryptie, rollen en rechten binnen een zaak (RBAC), legal hold, eDiscovery
   en de publieke API voor externe ontwikkelaars. Die horen in dit model thuis
   -- het is er ook op gebouwd, zie meta en het feit dat elk bericht een
   gesprek met een soort heeft -- maar ze staan er niet. Een half aangezette
   compliance-laag is gevaarlijker dan een afwezige. Het retentiebeleid staat
   er sinds de verhuizing wel (server/bewaarbeleid.js).
   ================================================================ */
'use strict';

/* De twaalf contexten. Een gesprek hoort bij precies een van deze, en de
   inbox groepeert erop. `personal` en `group` zijn de gewone menselijke
   gesprekken; de rest komt uit een module en draagt in meta.bron mee waar
   vandaan. */
const SOORTEN = ['personal', 'group', 'business', 'order', 'ride', 'school',
  'project', 'support', 'marketplace', 'government', 'event', 'ai'];

/* De laden van de inbox: welke soorten onder welke kop vallen. Dit is de
   "Universal Inbox" uit een gebruikersoogpunt -- Chats > Mobiliteit > Rit
   #RT-1941 -- terwijl het technisch allemaal gesprekken blijven. */
const LADEN = [
  { id: 'mensen', naam: 'Mensen', soorten: ['personal', 'group'] },
  { id: 'zaken', naam: 'Zaken', soorten: ['business', 'project', 'marketplace'] },
  { id: 'onderweg', naam: 'Onderweg', soorten: ['ride', 'order', 'event'] },
  { id: 'officieel', naam: 'Officieel', soorten: ['government', 'school', 'support'] },
  { id: 'rahul', naam: 'Rahul', soorten: ['ai'] }
];

const MAX_TEKST = 4000;         // een bericht is een bericht, geen document
const MAX_PER_GESPREK = 500;    // wat we per gesprek bewaren
const MAX_GESPREKKEN = 400;     // per lid, in de inbox
/* De grenzen die van de MENS zijn (een kwartier corrigeren, een por per
   minuut) staan bij de handelingen zelf: ./deelnemer.js. En hoeveel deelnemers
   een gesprek draagt staat waar het gesprek wordt aangelegd: ./gesprek.js. */

const wie = require('./wie');
const { maakTonen } = require('./tonen');
const { maakDeelnemer } = require('./deelnemer');
const { maakGesprek } = require('./gesprek');
const { maakBericht } = require('./bericht');

function maakComm({ db, save, crypto, codenaamVan, naamVan, sein, sseToCustomer }) {
  const nu = () => new Date().toISOString();
  const id = (p) => p + '_' + crypto.randomBytes(8).toString('hex');

  /* Een deelnemer heet bij zijn naam en nooit bij zijn sleutel. Welke naam dat
     is, hangt af van wat voor actor het is (./wie.js): een lid draagt zijn
     codenaam, een zaak zijn zaaknaam. Staat er geen naamVan opgehangen, dan is
     dit precies de oude regel -- alleen leden hebben een naam. */
  const noem = (key) => {
    const f = naamVan || codenaamVan;
    return (f ? f(key) : null) || null;
  };

  /* De opslag, de toegangspoort en het aanleggen van een gesprek: ./gesprek.js.
     Deze kern houdt de binnenkant ervan vast, want de andere helften
     (./tonen.js, ./deelnemer.js, ./bericht.js) leunen er allemaal op. */
  const gespr = maakGesprek({ db, save, nu, id, SOORTEN });
  const { G, B, standVan, standZet, gesprekVan, magErin, eis,
    gesprekMaak, gesprekMetSleutel, tussen } = gespr;

  /* Iedereen behalve de afzender krijgt het sein. Wie het gesprek stil heeft
     gezet krijgt het OOK -- stil gaat over meldingen, niet over of het scherm
     bijwerkt; een gesprek dat pas na een verversing verandert voelt kapot.

     WELKE STROOM dat is, hangt af van wie de deelnemer is: een lid luistert op
     de ledenapp, een zaak op de leveranciersstroom. Die wissel staat in
     ./wie.js (maakSein) en niet hier, zodat er een plek is waar "waar woont
     deze actor" wordt beantwoord. Zonder `sein` valt de kern terug op de oude
     weg, en dan zijn alleen leden bereikbaar -- eerlijk, want dan zijn er ook
     geen actoren opgehangen. */
  const stuurSein = sein || (sseToCustomer
    ? (sleutel, event, data) => { if (wie.isLid(sleutel)) sseToCustomer(sleutel, event, data); }
    : null);
  function seinNaarDeRest(g, behalve, event, data) {
    if (!stuurSein) return;
    for (const d of g.deelnemers) {
      if (d === behalve) continue;
      try { stuurSein(d, 'comm', Object.assign({ soort: event }, data)); } catch (e) {}
    }
  }

  /* De andere helften krijgen de binnenkant mee en niet de db: zo is aan deze
     regels af te lezen wat ze precies mogen aanraken.

     ./deelnemer.js eerst, want ./tonen.js leunt op isAanwezig en wieTypt --
     "wie is er online" en "wie typt er" horen bij de handelingen en niet bij de
     weergave, maar de weergave laat ze wel zien. */
  const deelnemer = maakDeelnemer({
    B, eis, nu, save, seinNaarDeRest, standZet, standVan, noem, MAX_TEKST
  });
  const tonen = maakTonen({
    G, B, standVan, magErin, eis, noem,
    isAanwezig: deelnemer.isAanwezig, wieTypt: deelnemer.wieTypt,
    LADEN, MAX_GESPREKKEN
  });
  /* ./bericht.js als laatste, want een nieuw bericht gaat als sein de deur uit
     in de vorm die ./tonen.js ervan maakt -- en dan moet die er zijn. */
  const brc = maakBericht({
    B, eis, nu, id, save, standZet, standVan, seinNaarDeRest,
    toon: (m, mij) => tonen.toonBericht(m, mij), MAX_TEKST, MAX_PER_GESPREK
  });
  const { bericht, berichtenVan, leesZet } = brc;

  return {
    SOORTEN, LADEN,
    // voor andere modules: dit is de hele koppelvlakte
    gesprekMaak, tussen, bericht, gesprekVan, gesprekMetSleutel, magErin,
    berichtenVan, leesZet,
    // voor de app -- de leeskant uit ./tonen.js, de handelingen uit ./deelnemer.js
    inbox: tonen.inbox, gesprek: tonen.gesprek, zoek: tonen.zoek, draad: tonen.draad,
    lees: deelnemer.lees, vlag: deelnemer.vlag, concept: deelnemer.concept,
    wijzig: deelnemer.wijzig, wis: deelnemer.wis, reactie: deelnemer.reactie,
    levensteken: deelnemer.levensteken, isAanwezig: deelnemer.isAanwezig,
    typtNu: deelnemer.typtNu, wieTypt: deelnemer.wieTypt, nudge: deelnemer.nudge
  };
}

module.exports = { SOORTEN, LADEN, maakComm };
