/* ============================================================================
   DE BEWAARVEGER AANSLUITEN, EN DE VRAAG DIE ERONDER LIGT: TOT WANNEER IS
   IEMAND LID?

   De veger zelf staat in server/bewaarveger.js; dit is de aansluiting. Hij
   stond middenin het opstartblok van server/server.js, en dat is de verkeerde
   plek voor het stukje dat hier het meeste weegt: lidmaatschapTot() bepaalt
   wanneer de bewaartermijn van een lid begint te lopen, en dat is een regel
   over IEMANDS GEGEVENS -- geen opstartdetail.

   De regel zelf: het lidmaatschap loopt tot een maand na de laatste termijn
   die als voldaan geboekt staat. Geen voldane termijn, geen einddatum, en dan
   veegt de veger niets -- de veilige kant, want te vroeg wissen kun je niet
   terugdraaien.
   ========================================================================== */
'use strict';

module.exports = function sluitBewaarvegerAan(deps) {
  const { db, save, accounts, log, UPLOAD_DIR } = deps;
  /* De bewaarveger: de wisregels die de eigenaar in het papierwerkregister
     heeft gekozen (locatiesporen 7 dagen, ID-bewijs 1 jaar na goedkeuring,
     afgewezen bewijs als vangnet). Draait elk uur en een keer bij de start. */
  const bewaarveger = require('../bewaarveger').maakBewaarveger({
    db, save, accounts, log,
    identiteitsmap: require('../identiteitsmap').maakIdentiteitsmap(UPLOAD_DIR),
    /* TOT WANNEER IS DIT LIDMAATSCHAP BETAALD? Elke maandtermijn draagt zijn
       eigen vervaldatum (het begin van de maand die hij dekt), dus de dekking
       loopt tot de laatste VOLDANE termijn plus een maand. Verlengen betekent
       nieuwe voldane termijnen en schuift dat einde dus vanzelf op. 0 = er is
       nooit een termijn voldaan (de gratis app); de veger valt dan terug op de
       jaartermijn na de goedkeuring. */
    lidmaatschapTot: (uId) => {
      let laatst = 0;
      const vanLid = new Set((db.data.aanmeldingen || []).filter(a => a.accountId === uId).map(a => a.id));
      for (const r of (db.data.lidmaatschapBetalingen || [])) {
        if (!vanLid.has(r.aanmeldingId)) continue;
        for (const t of (r.termijnen || []))
          if (t.status === 'voldaan') laatst = Math.max(laatst, Date.parse(t.vervalt) || 0);
      }
      if (!laatst) return 0;
      const d = new Date(laatst);
      d.setMonth(d.getMonth() + 1);
      return d.getTime();
    }
  });
  try { bewaarveger.veeg(); } catch (e) { log.warn && log.warn('[bewaarveger] eerste ronde: ' + e.message); }
  bewaarveger.start();

  return bewaarveger;
};
