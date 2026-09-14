'use strict';

/* De publieke tijdlijnfacade. De opslag blijft in opslag.js en de projectie in
   momenten.js; deze naam is de expliciete grens die de wekmotor gebruikt. */
module.exports = ({ opslag: gegevenOpslag, db, save, aanwezig, SOORT_NAAM }) => {
  const opslag = gegevenOpslag || require('./opslag')({ db, save });
  const momenten = require('./momenten')({ opslag, aanwezig, soortNaam: SOORT_NAAM || {} });
  return {
    leg: momenten.leg,
    momentenVoor: momenten.momentenVoor,
    mediaMomentenVoor: momenten.momentenVoor
  };
};
