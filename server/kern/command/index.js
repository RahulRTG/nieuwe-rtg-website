/* RTG COMMAND -- de bestuurslaag van het RTG- en RTF-kantoor.

   Eén app in plaats van veertien schermen. Niet doordat er een menu overheen
   is gelegd, maar doordat er één objectmodel onder ligt: het register kent de
   soorten, de zoekbalk leest het register, het objectdossier leest het
   register, de runbooks schrijven alleen via het register, en alles wat er
   gebeurt gaat door hetzelfde journaal.

   DE ZES NIVEAUS waar deze laag naartoe werkt, en waar hij nu staat:

     1 Observe    zien           ./puls.js, ./zoek.js, ./object.js
     2 Control    aanpassen      ./runbooks.js, ./beleid.js
     3 Automate   zelf laten doen ./operator.js, ./risico.js (auto-route)
     4 Predict    aan zien komen  ./simulatie.js
     5 Prevent    vóór zijn      ./gezondheid.js (doet het het, en hoe hard)
                                 ./risico.js + ./toezicht.js (grenzen, budgetten)
                                 ./slo.js + ./sonde.js (foutbudget, van buitenaf)
                                 ./canary.js (uitrollen met een terugroldrempel)
                                 ./zandbak.js (proeven zonder productiegegevens)
     6 Autonomous mensen sturen alleen beleid en uitzonderingen

   Wat er van 5 en 6 staat, is de MACHINERIE en niet de eindtoestand: de
   grenzen, de budgetten, de uitzonderingenrij en de meter die zegt hoeveel
   handwerk er nog is. Dat laatste (./werkbesparing.js) is met opzet het
   scherm waarop deze hele opzet zichzelf kan tegenspreken.

   DE ONTWERPREGEL, in elke module: handmatig, assisted, autonomous. Welk van
   de drie geldt, is nooit een eigenschap van de knop maar een uitkomst van
   ./risico.js uit het beleid van dat moment. */
'use strict';

function maakCommand({ db, save, crypto, anthropic, sseToOffice, kern }) {
  /* HET RTG-REGISTER, en het gaat er expliciet in. Elke laag die gegevens leest
     krijgt hem mee in plaats van hem te importeren; dat is wat het mogelijk
     maakt om dezelfde motoren op een BEPERKT register te draaien (de zaak-kant,
     server/kern/zaak/). Wie een beperkt register geeft, krijgt gegarandeerd een
     beperkt antwoord -- er is geen pad omheen. */
  const opslag = require('./opslag')({ db });   // de enige db-aanraking; zie ./opslag.js
  const register = require('./register').RTG;
  const journaal = require('./journaal').maakJournaal({ db, save, crypto, opslag });
  const beleid = require('./beleid').maakBeleid({ db, save, crypto, journaal, opslag });
  const risico = require('../frictie').maakRisico({ beleid });
  const toegang = require('./toegang').maakToegang({ db, save, crypto, journaal, opslag });
  const zaken = require('./zaken').maakZaken({ db, save, crypto, journaal, beleid, opslag });
  const runbooks = require('./runbooks').maakRunbooks({ db, save, crypto, journaal, risico, beleid, register, opslag });
  const toezicht = require('./toezicht').maakToezicht({ db, save, journaal, beleid, opslag });
  const operator = require('./operator').maakOperator({ db, save, crypto, journaal, risico, runbooks, zaken, beleid, anthropic, register, opslag });
  const puls = require('./puls').maakPuls({ db, runbooks, zaken, toezicht, journaal, beleid, register });
  const simulatie = require('./simulatie').maakSimulatie({ db, runbooks, zaken, beleid, risico, register });
  const werkbesparing = require('./werkbesparing').maakWerkbesparing({ journaal, zaken, runbooks });
  /* De gegevenskwaliteit en de kennisgraaf leunen allebei op DEZELFDE meting:
     welk veld blijkt in de praktijk naar welke soort te verwijzen. Daar komen
     hier de wezen uit en daar komen bij de graaf de randen uit. Twee keer meten
     zou twee keer iets anders kunnen zeggen over dezelfde gegevens. */
  const kwaliteit = require('./kwaliteit').maakKwaliteit({ db, register });
  const graaf = require('./graaf').maakGraaf({ db, register, kwaliteit });
  /* De herkomst is de DERDE vraag op diezelfde meting: de kwaliteitslaag levert
     de wezen, de graaf de randen en deze laag de afhankelijkheden. Hij krijgt
     het bewaarbeleid mee in plaats van het te importeren, want de zaak-kant
     draait dezelfde module en heeft dat beleid niet -- daar hoort dan "geen
     termijn" uit te komen en niet stilzwijgend dat van RTG. */
  const herkomst = require('./herkomst').maakHerkomst({ db, register, graaf, journaal, runbooks,
    bewaarbeleid: require('../../bewaarbeleid').BELEID });
  /* DE LAGEN DIE OP DE RUGGENGRAAT STAAN, en die staan in ./lagen.js. Hier
     boven staat de ruggengraat zelf: register, journaal, beleid, risico,
     recepten, operator, puls. Daaronder komen de lagen die daarop leunen --
     master data, landpakketten, de API-poort, de overname, de zandbak en de
     canary. Ze zijn uit dit bestand gehaald toen het over de 10 kB-grens ging;
     de naad lag er al, want dit zijn allemaal dingen die de ruggengraat
     GEBRUIKEN en die de ruggengraat zelf niet nodig heeft. */
  const lagen = require('./lagen').maakLagen({ db, save, crypto, journaal, register, kern, opslag });
  const { mdm, landpakket, apipoort, overname, zandbak, canary, uitrolregie, stadstart } = lagen;

  /* DE MEETKANT VAN NIVEAU 5, sinds de gezondheidskaart een eigen bestand: de
     sonde, de servicedoelen, het alarm, de kaart die ze naast elkaar legt en
     het incident dat onthoudt. De volgorde waarin ze elkaar nodig hebben staat
     daar; wat ze delen is dat geen van vijven iets twee keer meet. */
  const { sonde, slo, alarm, gezondheid, incident, bijstand, vlootbeeld } =
    require('./meetlagen').maakMeetlagen({ db, save, crypto, journaal, kwaliteit, canary, sseToOffice,
      tenant: () => kern && kern.tenant, opslag,
      // de bestaande webhook-melder van server.js, laat opgehaald: het alarm heeft
      // er een uitgang naar buiten aan (zie ./alarm.js, meld -> naarBuiten)
      foutmelder: () => kern && kern.foutmelder });

  /* HERSTEL ALS TRANSACTIE: het enige pad waarlangs de routes een recept
     draaien. Na de kaart: zijn voorcontrole leest die. */
  const transactie = require('./transactie').maakTransactie({ db, runbooks, register, journaal, gezondheid });

  /* DE CONFIGURATIETIJDLIJN: drie bestaande bronnen op één lijn, niets eigens. */
  const tijdlijn = require('./tijdlijn').maakTijdlijn({ db, journaal, opslag });

  const zoeklaag = require('./zoek');
  const objectlaag = require('./object');

  /* Welke acties horen bij dit object, en op welk niveau staan ze nu? Hier
     komen het register (welke runbooks passen op deze soort) en de risicomotor
     (wat mag de machine ermee) bij elkaar. Het objectdossier weet daardoor
     zelf niets van risico -- het krijgt de uitkomst. */
  function actiesVoor(k, rij) {
    const uit = [];
    for (const rb of runbooks.RUNBOOKS) {
      if (rb.type !== k.type) continue;
      const past = rb.past(rij);
      const o = risico.beoordeel(rb.actie, { aantal: 1, klantImpact: rb.klantImpact,
        onomkeerbaar: !rb.terugDraaibaar, centen: k.bedrag || 0 });
      uit.push({ soort: 'runbook', id: rb.id, naam: rb.naam, wat: rb.wat, past,
        niveau: o.niveau, score: o.score, waarom: o.waarom, vierOgen: o.vierOgen,
        waaromNiet: past ? null : 'dit object voldoet nu niet aan de voorwaarde van dit runbook' });
    }
    uit.push({ soort: 'zaak', id: 'zaak-openen', naam: 'Uitzondering openen',
      wat: 'Maak hier een zaak van, met eigenaar en termijn.', past: true,
      niveau: 'hand', score: risico.beoordeel('zaak toewijzen', {}).score, waarom: 'een zaak openen is altijd mensenwerk' });
    return uit;
  }

  const zoek = (vraag, opties) => zoeklaag.zoek(register, db, vraag, opties);
  const bereik = () => zoeklaag.bereik(register);
  const dossier = (type, id) => objectlaag.dossier(register, db, type, id, { journaal, actiesVoor });

  /* Het beginscherm in één aanroep staat in ./beginscherm.js: dit bestand hangt
     de lagen op, dat leest ze uit. */
  const start = require('./beginscherm').maakBeginscherm({
    puls, zaken, runbooks, werkbesparing, toegang, operator, kwaliteit, slo, canary, alarm,
    gezondheid, incident, bijstand }).start;

  return { journaal, beleid, risico, toegang, zaken, runbooks, toezicht, operator, puls,
    simulatie, werkbesparing, kwaliteit, graaf, herkomst, slo, sonde, canary, uitrolregie, zandbak, mdm, overname, apipoort, landpakket, stadstart, alarm, gezondheid, transactie, incident, tijdlijn, bijstand, vlootbeeld,
    zoek, bereik, dossier, actiesVoor, start, register };
}

module.exports = { maakCommand };
