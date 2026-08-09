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
     5 Prevent    vóór zijn      ./risico.js + ./toezicht.js (grenzen, budgetten)
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

function maakCommand({ db, save, crypto, anthropic }) {
  /* HET RTG-REGISTER, en het gaat er expliciet in. Elke laag die gegevens leest
     krijgt hem mee in plaats van hem te importeren; dat is wat het mogelijk
     maakt om dezelfde motoren op een BEPERKT register te draaien (de zaak-kant,
     server/kern/zaak/). Wie een beperkt register geeft, krijgt gegarandeerd een
     beperkt antwoord -- er is geen pad omheen. */
  const register = require('./register').RTG;
  const journaal = require('./journaal').maakJournaal({ db, save, crypto });
  const beleid = require('./beleid').maakBeleid({ db, save, crypto, journaal });
  const risico = require('./risico').maakRisico({ beleid });
  const toegang = require('./toegang').maakToegang({ db, save, crypto, journaal });
  const zaken = require('./zaken').maakZaken({ db, save, crypto, journaal, beleid });
  const runbooks = require('./runbooks').maakRunbooks({ db, save, crypto, journaal, risico, beleid, register });
  const toezicht = require('./toezicht').maakToezicht({ db, save, journaal, beleid });
  const operator = require('./operator').maakOperator({ db, save, crypto, journaal, risico, runbooks, zaken, beleid, anthropic, register });
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
  const lagen = require('./lagen').maakLagen({ db, save, crypto, journaal, register });
  const { mdm, landpakket, apipoort, overname, zandbak, canary, stadstart } = lagen;

  /* De meetkant van niveau 5. De sonde levert de metingen van BUITENAF en de
     SLO-meter houdt het foutbudget bij; ze staan in deze volgorde omdat de
     meter de sonde erbij zet en niet andersom. De reizen komen uit dezelfde
     SLO.json als de doelen, via slo.laadNorm() -- dus één bestand met de norm,
     en geen tweede lijstje reizen dat langzaam iets anders gaat toetsen. */
  const slolaag = require('./slo');
  const sonde = require('./sonde').maakSonde({ db, save,
    reizen: () => slolaag.laadNorm().reizen || [] });
  const slo = slolaag.maakSlo({ meting: require('../../meting'), sonde });
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

  /* Het beginscherm van de app in één aanroep: de puls, de open uitzonderingen,
     wat er te herstellen valt en waar het handwerk zit. Eén verzoek, omdat vier
     verzoeken op een beginscherm vier momenten zijn waarop het scherm halfvol
     kan blijven staan. */
  function start() {
    const b = puls.beeld();
    return {
      puls: b,
      zaken: zaken.lijst({ status: 'open', max: 12 }),
      runbooks: runbooks.lijst(),
      werk: werkbesparing.bord(30),
      rechten: toegang.graaf(),
      plannen: operator.recent(5),
      runs: runbooks.runs(8),
      kwaliteit: kwaliteit.meet().tel,
      /* De SLO-stand hoort op het beginscherm omdat een foutbudget dat je moet
         opzoeken geen rem is. Hij staat hier wel INGEPAKT: ontbreekt SLO.json,
         dan hoort dat één luide tegel te zijn en niet een leeg beginscherm. */
      slo: sloKort()
    };
  }

  function sloKort() {
    try {
      const st = slo.stand();
      return { tel: st.tel, uitrol: st.uitrol };
    } catch (e) {
      return { fout: String(e.message).slice(0, 200) };
    }
  }

  return { journaal, beleid, risico, toegang, zaken, runbooks, toezicht, operator, puls,
    simulatie, werkbesparing, kwaliteit, graaf, herkomst, slo, sonde, canary, zandbak, mdm, overname, apipoort, landpakket, stadstart,
    zoek, bereik, dossier, actiesVoor, start, register };
}

module.exports = { maakCommand };
