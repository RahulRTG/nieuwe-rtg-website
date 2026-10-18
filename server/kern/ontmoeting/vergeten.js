/* Ontmoeting (deelbestand): WAT ONTMOETEN VAN EEN LID VERGEET (AVG art. 17).

   De vergeetroute wiste de voorkeur en de radarpositie (EIGEN_TAKKEN in
   server/kern/vergeten/eigen.js), maar niet de afspraken zelf. Daar stond na
   "verwijder mijn gegevens" nog de live-positie van het lid tijdens de date,
   de plek van zijn SOS, zijn sleutel als deelnemer en zijn handtekening onder
   het veiligheidscontract.

   Een afspraak en een voorstel zijn van TWEE mensen. Weggooien zou de ander
   zijn eigen geschiedenis afpakken, en de meldkamer een afgehandelde SOS. Dus
   DE PERSOON ERUIT, DE REST BLIJFT:
     - elke positie van dit lid gaat weg (de live-positie en die van zijn SOS);
     - waar hij deelnemer was, staat daarna `null` en geen sleutel;
     - zijn SOS blijft als melding voor het kantoor, zonder naam en zonder plek;
     - een afspraak die nog liep, stopt: er is niemand meer aan deze kant. Een
       open voorstel vervalt om dezelfde reden.
   Van de ander blijft alles staan, ook zijn eigen positie bij een open SOS --
   die hoort bij zijn melding en heeft een eigen termijn (N18). */
'use strict';
const WEG = '(verwijderd)';
const LOOPT = ['wacht-op-tekenen', 'actief', 'noodgeval'];

module.exports = ({ db, save, lijsten, nu }) => {
  function ontmoetVergeetLid(key) {
    if (!key) return { dates: 0, voorstellen: 0 };
    lijsten();
    let dates = 0, voorstellen = 0;
    for (const d of db.data.ontmoetDates) {
      if (!d || (d.a !== key && d.b !== key)) continue;
      if (d.posities) delete d.posities[key];
      if (d.contract && d.contract.ondertekend) delete d.contract.ondertekend[key];
      for (const s of Array.isArray(d.sos) ? d.sos : []) {
        if (!s || s.door !== key) continue;
        delete s.lat; delete s.lng;
        s.door = null; s.codenaam = WEG;
      }
      if (LOOPT.includes(d.status)) {
        d.status = d.status === 'wacht-op-tekenen' ? 'geannuleerd' : 'afgerond';
        d.afgerondAt = nu();
      }
      if (d.a === key) d.a = null;
      if (d.b === key) d.b = null;
      dates++;
    }
    for (const v of db.data.ontmoetVoorstellen) {
      if (!v || (v.a !== key && v.b !== key)) continue;
      if (v.keuzes) delete v.keuzes[key];
      if (v.status === 'open') v.status = 'verlopen';
      if (v.a === key) v.a = null;
      if (v.b === key) v.b = null;
      voorstellen++;
    }
    save();
    return { dates, voorstellen };
  }

  return { ontmoetVergeetLid };
};
