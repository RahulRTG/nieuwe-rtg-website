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
      runs: runbooks.runs(8)
    };
  }

  return { journaal, beleid, risico, toegang, zaken, runbooks, toezicht, operator, puls,
    simulatie, werkbesparing, zoek, bereik, dossier, actiesVoor, start, register };
}

module.exports = { maakCommand };
