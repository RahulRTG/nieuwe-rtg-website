'use strict';

/* Een verse, minimale lezing voor de publieke aanbodgrens. Bewaar duplicaten:
   twee gelijke codes zijn ambigu, geen reden om de eerste zaak te vertrouwen.
   Geen mutable zaakobjecten, contactgegevens of geheimen over deze grens. */
module.exports = function leveranciersVoorAanbod(db) {
  return (db.data.suppliers || []).filter(Boolean).map(s => Object.freeze({
    code: s.code, verborgen: !!(s.mall && s.mall.verborgen), status: s.partnerStatus
  }));
};
