/* Payroll OS: de bedrading.

   Zet de zeven delen aan elkaar en levert er EEN ding uit, zodat de rest van
   het huis niet hoeft te weten hoe de motor van binnen loopt:

     regels       jaargangen met versies, keuring en automatisch bijwerken
     componenten  het looncomponentenregister
     contracten   ingangsdatum-gestuurde versies
     motor        de herhaalbare berekening
     run          concept -> vier ogen -> definitief -> correctie
     journaal     de boeking en het betaalbestand
     aangifte     de loonaangifte: dezelfde run, derde uitgang
     uren         de klok vertaald naar meetbare feiten, en die gewogen tot
                  componenten (meten en wegen apart, zie ./uren.js)
     samenstellen van contract + klok + verzuim naar de invoer van een run
     controles    de automatische controles; hoog blokkeert tot het verklaard is
     verzuim      verlof en ziekte, met de scheiding die de AP eist
     dekking      per land: kan hier loon draaien, en zo nee wat ontbreekt er
     dossier      de vier vragen per bedrag, op een plek
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
const { maakAangifte } = require('./aangifte');
const { maakPayrollHerkomst } = require('./herkomst');
const { maakVerzuim } = require('./verzuim');
const { maakIdentiteit } = require('./identiteit');
const { maakBijwerken, urlBron } = require('./bijwerken');
const { maakDekking } = require('./dekking');
const { maakDossier } = require('./dossier');
const { LANDEN } = require('../fiscaal/landen');
const { maakUren } = require('./uren');
const { maakSamenstellen } = require('./samenstellen');
const { maakControles } = require('./controles');
const motor = require('./motor');

function maakPayrollOS({ db, save, crypto, accounts, nu, inzagelog, notify, logActivity, log }) {
  const regels = maakRegelpakket({ db, save, nu });
  const componenten = maakComponenten({ db, save, nu });
  const contracten = maakContracten({ db, save, nu });
  const run = maakRun({ db, save, nu, crypto, motor, regelpakket: regels, componenten });
  const journaal = maakJournaal({ db, save, nu, crypto });
  const aangifte = maakAangifte({ db, save, nu, crypto, run });
  /* Het dossier verzamelt alleen; het rekent niets opnieuw uit en vult geen
     gaten. Daarom krijgt het de andere lagen mee in plaats van de database. */
  const dossier = maakDossier({ run, journaal, aangifte, regelpakket: regels, contracten });
  /* De bewijsketen van de aangifte: van het collectieve bedrag omlaag naar de
     nominatieve regels, en van daaruit naar het dossier hierboven. Hij bouwt
     dat detail niet na -- hij wijst ernaar. */
  const { payrollHerkomst } = maakPayrollHerkomst({ aangifte, run, regelpakket: regels, dossier });
  const verzuim = maakVerzuim({ db, save, nu });
  const identiteit = maakIdentiteit({ accounts, db, save, nu, inzagelog, notify, logActivity });
  /* De dekking eerst: de bijwerklaag leest er zijn bronnen uit, per land. Zo is
     een land erbij een adres neerzetten en geen uitrol. */
  const dekking = maakDekking({ db, save, nu, regelpakket: regels, LANDEN, accounts });
  const bijwerken = maakBijwerken({ regelpakket: regels, db, save, nu, log, dekking });
  const uren = maakUren({ db });
  /* De invoer van een loonrun begint bij het CONTRACT en niet bij de klok.
     Stond die samenstelling in de route, dan was hij niet te toetsen zonder
     server -- en dan kon een maandsalaris eruit vallen zonder dat iets het zei.
     Zie ./samenstellen.js voor wat daar mis ging. */
  const samenstellen = maakSamenstellen({ contracten, uren, verzuim });
  const controles = maakControles({ db, save, nu });

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
      regels, componenten, contracten, motor, run, journaal, aangifte, verzuim, identiteit, uren, samenstellen, controles, dekking, dossier, herkomst: payrollHerkomst,
      bijwerken, urlBron, laadMeegeleverd
    }
  };
}

module.exports = { maakPayrollOS };
