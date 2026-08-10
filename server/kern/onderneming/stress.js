/* DE STRESS TEST: wij proberen het plan te breken.

   DIT IS DE TEGENKRACHT VAN DE SIMULATIE. De simulatie rekent de aannames van
   de ondernemer netjes door, en netjes doorgerekende aannames zien er altijd
   goed uit -- dat is precies het probleem. Deze module gaat er met opzet
   tegenin, en hij mag als uitkomst 'niet starten' geven.

   DAT MOET HIJ OOK KUNNEN. Een adviseur die alleen enthousiasme produceert is
   geen adviseur maar een verkoper. De regels hieronder komen daarom niet uit
   een stemming maar uit rekenkundige feiten over het plan zelf: verkopen onder
   kostprijs, een kas die binnen het jaar onder nul duikt, een marge waar geen
   tegenvaller in past. Wat blokkerend is, is blokkerend in elk scenario dat de
   ondernemer zelf heeft opgegeven -- niet in een somber scenario dat wij erbij
   hebben verzonnen.

   WAT ER OOK IN STAAT: WAT WEL HOUDT. `sterk` is geen troostprijs maar
   informatie. Een lijst die alleen problemen noemt, wordt na twee keer
   weggeklikt, en dan doet ook de blokkerende bevinding er niet meer toe.

   HET OORDEEL IS ADVIES EN GEEN SLOT. plan.js laat een 'niet starten' wel
   degelijk vastleggen, maar alleen met een expliciete bevestiging die in het
   plan wordt opgeschreven. De mens beslist; wij zorgen dat hij het wist. */
'use strict';

const { MARGE_LAAG, KLANT_GROOT, UREN_WEINIG } = require('./stress-toetsen');

module.exports = () => {

  /* De toetsen staan in ./stress-toetsen.js -- dit bestand ging over de 10 kB
     van het modulebeleid, en dat is de goede naad: daar staat WAT er wordt
     getoetst, hier wat de uitkomsten samen betekenen. */
  const TOETSEN = require('./stress-toetsen').TOETSEN;

  /* Wat er juist wél houdt. Zie de kop: dit is informatie, geen troost. */
  function sterkeKanten(i, sim) {
    const uit = [];
    const b = sim.scenarios.basis;
    if (b.runwayMaanden === null && sim.scenarios.slecht.runwayMaanden === null) {
      uit.push('Uw kas blijft ook in het slechte scenario het hele jaar positief.');
    }
    if (b.jaar.margePercentage !== null && b.jaar.margePercentage >= 50) {
      uit.push('Een brutomarge van ' + b.jaar.margePercentage + '% geeft ruimte om tegenvallers op te vangen.');
    }
    if (i.idee.verkoopmodel === 'abonnement' || i.idee.verkoopmodel === 'herhaling') {
      uit.push('Terugkerende omzet: u begint niet elke maand opnieuw bij nul.');
    }
    if (i.persoon.ervaringJaren >= 5) {
      uit.push(i.persoon.ervaringJaren + ' jaar ervaring in het vak is uw grootste voorsprong op een nieuwkomer.');
    }
    if (i.idee.onderscheid && i.idee.onderscheid.length >= 15) {
      uit.push('U heeft opgeschreven waarom een klant voor u kiest.');
    }
    return uit;
  }

  /* De stress test zelf. Vraagt de simulatie als invoer, want zonder
     doorgerekend plan valt er niets te breken. */
  function stresstest(o, sim, kans) {
    if (!sim || !sim.ok) {
      return { status: 400, error: 'Er is nog geen doorgerekend plan om te toetsen.',
        ontbreekt: (sim && sim.ontbreekt) || null };
    }
    const i = o.intake || { persoon: {}, idee: {} };
    const bevindingen = TOETSEN.map(t => t(i, sim, kans)).filter(Boolean);

    const blokkerend = bevindingen.filter(b => b.zwaarte === 'blokkerend');
    const zwaar = bevindingen.filter(b => b.zwaarte === 'zwaar');

    let oordeel, toelichting;
    if (blokkerend.length) {
      oordeel = 'niet starten';
      toelichting = 'Niet starten met dit model. ' + (blokkerend.length === 1
        ? 'Er is een probleem dat niet met harder werken op te lossen is.'
        : 'Er zijn ' + blokkerend.length + ' problemen die niet met harder werken op te lossen zijn.') +
        ' Pas het model aan en reken opnieuw.';
    } else if (zwaar.length) {
      oordeel = 'pas aan';
      toelichting = 'Dit plan kan werken, maar niet zoals het er nu staat. Er ' +
        (zwaar.length === 1 ? 'is één zwaar punt' : 'zijn ' + zwaar.length + ' zware punten') + ' die u eerst hoort op te lossen.';
    } else {
      oordeel = 'ga door';
      toelichting = 'Wij vinden geen breekpunt in uw eigen cijfers. Dat is geen garantie: wij toetsen uw aannames, niet uw markt.';
    }

    return {
      ok: true, oordeel, toelichting,
      bevindingen,
      sterk: sterkeKanten(i, sim),
      getoetst: TOETSEN.length,
      /* Wat deze test NIET heeft gekeken. Zonder dit leest 'ga door' als een
         goedkeuring van het hele idee. */
      nietGetoetst: 'Wij toetsen uw eigen cijfers en de RTG-data. Wij kennen uw markt niet, uw concurrenten buiten RTG niet, en uw persoonlijke situatie niet.'
    };
  }

  return { STRESS_TOETSEN: TOETSEN.length, stresstest };
};

module.exports.MARGE_LAAG = MARGE_LAAG;
module.exports.KLANT_GROOT = KLANT_GROOT;
module.exports.UREN_WEINIG = UREN_WEINIG;
