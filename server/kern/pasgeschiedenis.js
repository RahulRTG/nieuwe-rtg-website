/* DE PASGESCHIEDENIS -- welke pas een lid had, en sinds wanneer.

   HET GAT DAT DIT DICHT. accounts.setTier overschreef de pas (UPDATE users SET
   tier) en bewaarde de vorige stand nergens. Daardoor was niet vast te stellen
   wanneer iemand LID werd, in welk cohort hij viel of wanneer hij wegging -- drie
   maten die de eigenaar op 25 september 2026 heeft gedefinieerd:
     - nieuw lid  = het moment van de eerste pas boven gast;
     - cohort     = de ISO-week van dat moment;
     - churn      = de pas gaat naar gast (of het contract eindigt), in de maand
                    waarin het ingaat; een stap naar een lagere betaalde pas is
                    AFWAARDERING en geen churn.

   HET KNOOPPUNT IS DE ACCOUNTLAAG en niet een van de aanroepers. Een pas ontstaat
   in accounts.createUser en verandert in accounts.setTier; daar meldt de laag elke
   overgang (accounts.opPasOvergang), en dit bestand legt hem vast. Zo wordt ook
   een weg die er nog niet is -- er bestaat vandaag GEEN weg van een betaalde pas
   naar gast -- vanzelf meegenomen zodra hij komt.

   WAT ER STAAT: per codenaam de overgangen met van, naar, dag en tijd, en de
   weg (aanmaak of besluit).
   Geen naam, geen reden, geen bedrag. Bewaard zeven jaar, dezelfde termijn als de
   lidmaatschapstermijnen (server/bewaarbeleid.js): een pasovergang hoort bij de
   administratie van het lidmaatschap. */
'use strict';

const PASSEN = ['guest', 'rtg', 'lifestyle', 'business'];
const NAAM = 'pasOvergangen';

/* DE VORM IS EEN KAART PER CODENAAM ({ codenaam: [overgang, ...] }) en geen
   platte lijst. Niet uit smaak: in de PostgreSQL-stand met meer instanties
   commit elk verzoek zijn gewijzigde collecties optimistisch, en twintig
   gelijktijdige registraties die elk dezelfde lijst verlengen botsen dan
   (409, en 5xx onder spitsdruk -- gezien in pgtoetsen). Daarom schrijft deze
   module via bewerkCollectie: een eigen transactie per collectie met een rijslot,
   en die kent alleen een kaart als verse vorm. */
module.exports = ({ db, save, bewerkCollectie, accounts }) => {
  const eigen = require('./eigencollectie')({ db, domein: 'kern/pasgeschiedenis', bezit: { [NAAM]: 'kaart' } });
  const schrijf = require('./eigentransactie')({ naam: NAAM, eigen, save, bewerkCollectie });

  function noteerPasOvergang({ codenaam, van, naar, op, bron } = {}) {
    if (!codenaam || !PASSEN.includes(naar)) return false;
    if (van != null && !PASSEN.includes(van)) return false;
    if (van === naar) return false;
    const cn = String(codenaam);
    const rij = { van: van || null, naar, op: op || new Date().toISOString(),
      bron: bron === 'aanmaak' ? 'aanmaak' : 'besluit' };
    schrijf(kaart => { (Array.isArray(kaart[cn]) ? kaart[cn] : (kaart[cn] = [])).push(rij); });
    return true;
  }

  if (accounts && typeof accounts.opPasOvergang === 'function') accounts.opPasOvergang(noteerPasOvergang);

  /* Lezen maakt niets aan (eigencollectie.kijk) en geeft een platte lijst met de
     codenaam erbij: de lezers hoeven de opslagvorm niet te kennen. */
  function pasOvergangen() {
    const kaart = eigen.kijk(NAAM), uit = [];
    for (const cn of Object.keys(kaart || {}))
      for (const r of Array.isArray(kaart[cn]) ? kaart[cn] : []) uit.push(Object.assign({ codenaam: cn }, r));
    return uit;
  }

  return { noteerPasOvergang, pasOvergangen, PASSEN };
};
