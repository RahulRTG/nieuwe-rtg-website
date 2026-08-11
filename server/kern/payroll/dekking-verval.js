/* Payroll OS, deel "verval": welke jaargang loopt af zonder opvolger?

   EEN JAARGANG DIE AFLOOPT ZONDER OPVOLGER IS DE KLASSIEKE JANUARIFOUT. Op 31
   december draait alles; op 1 januari kan er geen enkele loonrun meer, en dat
   is precies de week waarin er gedraaid moet worden. Daarom kijkt dit VOORUIT
   en niet terug: het meldt een verval zolang er nog tijd is om er iets aan te
   doen, en zwijgt zodra de opvolger er ligt.

   Het staat naast ./dekking.js en niet erin, zoals ./dekking-bronnen.js: dat
   bestand beantwoordt "kan dit land vandaag draaien", dit "kan het dat straks
   nog". Twee vragen, twee bestanden. */
'use strict';

module.exports = ({ tijd, regelpakket, landenMetWerk }) => {
  function verlooptBinnen(dagen, peildatum) {
    const d = Number(dagen) > 0 ? Number(dagen) : 60;
    const nuDag = new Date(String(peildatum || tijd()).slice(0, 10) + 'T00:00:00Z').getTime();
    const grens = new Date(nuDag + d * 86400000).toISOString().slice(0, 10);
    const uit = [];
    for (const w of landenMetWerk()) {
      const p = regelpakket.opDatum(w.land, String(peildatum || tijd()).slice(0, 10));
      if (!p || !p.geldigTot || p.geldigTot > grens) continue;
      // is er al een opvolger die ingaat op de dag na het verval?
      const dagErna = new Date(new Date(p.geldigTot + 'T00:00:00Z').getTime() + 86400000).toISOString().slice(0, 10);
      const opvolger = regelpakket.opDatum(w.land, dagErna);
      if (opvolger) continue;
      uit.push({ land: w.land, versie: p.versie, geldigTot: p.geldigTot,
        personeel: w.personeel, zaken: w.zaken,
        uitleg: 'Na ' + p.geldigTot + ' ligt er geen regelpakket voor ' + w.land +
          '. Vanaf dat moment kan er geen loonrun meer draaien.' });
    }
    return uit;
  }
  return { verlooptBinnen };
};
