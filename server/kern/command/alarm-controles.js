/* DE ALARMCONTROLES -- WAT het alarm leest, los van hoe het weegt.

   WAAROM DIT APART STAAT VAN ./alarm.js: daar woont de toestand van een alarm
   (ontstaan, doorlopen, opgelost, stilgezet) en de stand voor het kantoorbord.
   Hier woont alleen de vraag "is er nu iets aan de hand", gesteld aan lagen
   die er al zijn: de servicedoelen, de sonde, de canary, de hashketen van het
   journaal en het auditspoor (en via ./alarm-aanvullend.js de gegevens-
   kwaliteit, de capability-SLO's en de stille sensor). Een nieuwe controle
   raakt het wegen dus niet, en een wijziging in het wegen raakt geen enkele
   controle. Elke controle geeft null (niets aan de hand) of een bevinding, en
   vangt haar eigen storing af: een alarm dat zelf omvalt omdat de laag
   eronder een fout gooit, is stil op precies het verkeerde moment. */
'use strict';
const { voegAanvullendeAlarmcontrolesToe } = require('./alarm-aanvullend');

function alarmControles({ slo, sonde, canary, journaal, kwaliteit, d }) {
  const uit = [];
  const probeer = (id, naam, ernst, doe) => {
    try { const r = doe(); if (r) uit.push({ id, naam, ernst, wat: r }); }
    catch (e) { uit.push({ id, naam, ernst: 'midden', wat: 'deze controle kon niet draaien: ' + e.message }); }
  };
  /* EEN SLO-STAND PER WEGING. Vier controles hieronder (en twee in
     ./alarm-aanvullend.js) vragen dezelfde stand binnen dezelfde synchrone
     ronde, en elke aanroep kopieert alle meetreeksen (meting.reeksen(), ruim
     vierduizend routes). Gemeten in De Beproeving van 18 oktober 2026: 88 MB
     aan kopieen per 40 s storm. De stand wordt nu een keer gevraagd en
     gedeeld; een stand die niet berekend kon worden wordt niet onthouden,
     zodat elke controle haar eigen storing blijft melden zoals voorheen. */
  let sloStand = null;
  const sloStandNu = () => sloStand || (sloStand = slo.stand());
  const sloGedeeld = slo && typeof slo === 'object' ? Object.assign(Object.create(slo), { stand: sloStandNu }) : slo;

  probeer('doel-gezakt', 'Een servicedoel is niet gehaald', 'hoog', () => {
    const st = sloStandNu();
    const g = st.doelen.filter(x => x.genoeg && x.oordeel === 'niet gehaald');
    return g.length ? g.map(x => x.naam).join(', ') + ' staat over de streefwaarde' : null;
  });

  probeer('budget-bijna-op', 'Het foutbudget raakt op', 'midden', () => {
    const st = sloStandNu();
    const g = st.doelen.filter(x => x.genoeg && x.budget && !x.budget.op && x.budget.restDeel < d.budgetRestDeel);
    return g.length ? g.map(x => x.naam + ' (' + Math.round(x.budget.restDeel * 100) + '% over)').join(', ') : null;
  });

  probeer('niets-van-buiten', 'Er wordt niet van buitenaf gemeten', 'laag', () => {
    const b = sonde.buitenkort();
    return b.gemeten ? null : 'de sonde heeft in dertig dagen niets van buitenaf gemeld. Alles wat ' +
      'de servicedoelen tonen, komt dan van de app over zichzelf -- en die telt niets als hij plat ligt.';
  });

  probeer('sonde-storing', 'De sonde ziet storingen van buitenaf', 'hoog', () => {
    const st = sonde.stand(d.buitenStilUren);
    if (!st.buiten.pogingen || !st.buiten.mislukt) return null;
    return st.buiten.mislukt + ' van ' + st.buiten.pogingen + ' externe metingen mislukten in ' +
      d.buitenStilUren + ' uur';
  });

  probeer('canary-teruggerold', 'Een uitrol is automatisch teruggerold', 'midden', () => {
    if (!canary) return null;
    const g = canary.lopende().filter(x => x.stand === 'teruggerold' && x.automatisch);
    return g.length ? g.map(x => x.naam).join(', ') + ' ging over de terugroldrempel' : null;
  });

  probeer('journaal-gebroken', 'De hashketen van het journaal klopt niet', 'hoog', () => {
    const k = journaal.controleer();
    return k && k.heel === false ? (k.waarom || 'de keten is gebroken') + ' (bij ' + k.bij + ')' : null;
  });

  // audit P1-4
  probeer('auditspoor-gebroken', 'Auditspoor gebroken of niet verankerd', 'hoog', () =>
    require('../../lib/auditwacht').bevinding());

  voegAanvullendeAlarmcontrolesToe(probeer, { slo: sloGedeeld, kwaliteit, d });

  return uit;
}

module.exports = { alarmControles };
