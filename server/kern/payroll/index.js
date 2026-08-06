/* Payroll OS: de bedrading.

   Zet de zeven delen aan elkaar en levert er EEN ding uit, zodat de rest van
   het huis niet hoeft te weten hoe de motor van binnen loopt:

     regels       jaargangen met versies, keuring en automatisch bijwerken
     componenten  het looncomponentenregister
     contracten   ingangsdatum-gestuurde versies
     motor        de herhaalbare berekening
     run          concept -> vier ogen -> definitief -> correctie
     journaal     de boeking en het betaalbestand
     verzuim      verlof en ziekte, met de scheiding die de AP eist
     identiteit   ja/nee voor de werkgever, opvragen met reden en journaal

   NAAST DE OUDE kern/payroll.js EN NIET ERIN. Die draait de bestaande
   demo-loonrun (uren x uurloon, vlakke heffing) en er hangen schermen en
   routes aan. Hem in een keer vervangen zou die schermen breken zonder dat er
   iets voor in de plaats staat -- er is nog geen invoer uit de klok naar de
   nieuwe motor, en geen scherm voor de goedkeuringen. Deze laag is de basis
   waar dat op gebouwd wordt; het overzetten is een eigen stap, met de
   bestaande toetsen ernaast.

   De bijwerkronde wordt hier NIET vanzelf gestart. Een module die bij het
   laden een timer aanzet, doet dat ook in elke toets en in elk script. Het
   opstarten roept start() aan; zie server/opzet/. */
'use strict';

const { maakRegelpakket } = require('./regelpakket');
const { maakComponenten } = require('./componenten');
const { maakContracten } = require('./contracten');
const { maakRun } = require('./run');
const { maakJournaal } = require('./journaal');
const { maakVerzuim } = require('./verzuim');
const { maakIdentiteit } = require('./identiteit');
const { maakBijwerken, urlBron } = require('./bijwerken');
const motor = require('./motor');

function maakPayrollOS({ db, save, crypto, accounts, nu, inzagelog, notify, logActivity, log }) {
  const regels = maakRegelpakket({ db, save, nu });
  const componenten = maakComponenten({ db, save, nu });
  const contracten = maakContracten({ db, save, nu });
  const run = maakRun({ db, save, nu, crypto, motor, regelpakket: regels, componenten });
  const journaal = maakJournaal({ db, save, nu, crypto });
  const verzuim = maakVerzuim({ db, save, nu });
  const identiteit = maakIdentiteit({ accounts, db, save, nu, inzagelog, notify, logActivity });
  const bijwerken = maakBijwerken({ regelpakket: regels, db, save, nu, log });

  /* De meegeleverde jaargang een keer binnenhalen. Hij komt binnen langs
     dezelfde keuring als elk ander pakket -- geen achterdeur voor "onze eigen"
     tarieven -- en staat daarna als ongecontroleerd klaar. Zie
     ./jaargangen/nl-2026.json voor waarom dat zo hoort te blijven tot iemand
     hem tegen het Handboek Loonheffingen heeft gelegd. */
  function laadMeegeleverd() {
    const uit = [];
    for (const naam of ['nl-2026']) {
      try {
        const pakket = require('./jaargangen/' + naam + '.json');
        uit.push(regels.neemOp(pakket, { soort: 'meegeleverd', naam: naam + '.json' }));
      } catch (e) { uit.push({ error: 'jaargang ' + naam + ' kon niet worden geladen: ' + e.message }); }
    }
    return uit;
  }

  return {
    payrollOS: {
      regels, componenten, contracten, motor, run, journaal, verzuim, identiteit,
      bijwerken, urlBron, laadMeegeleverd
    }
  };
}

module.exports = { maakPayrollOS };
