'use strict';

/* De enige db.data-deur voor publieke aanwezigheden en hun momenten. */
module.exports = ({ db, save }) => ({
  aanwezigheid() {
    if (!db.data.mediaAanwezig || typeof db.data.mediaAanwezig !== 'object') db.data.mediaAanwezig = {};
    if (!db.data.mediaVolgt || typeof db.data.mediaVolgt !== 'object') db.data.mediaVolgt = {};
    return db.data;
  },
  momenten() {
    if (!Array.isArray(db.data.mediaMomenten)) db.data.mediaMomenten = [];
    return db.data.mediaMomenten;
  },
  /* De werkherkomst: wie maakte wat. PAKKEN maakt aan, PEILEN niet -- dat
     onderscheid staat hier en niet in ./werkherkomst.js, want een lezer die
     zijn eigen bak aanlegt laat de opslag groeien door ernaar te kijken. */
  werken() {
    if (!Array.isArray(db.data.mediaWerkherkomst)) db.data.mediaWerkherkomst = [];
    return db.data.mediaWerkherkomst;
  },
  peilWerken() {
    return Array.isArray(db.data.mediaWerkherkomst) ? db.data.mediaWerkherkomst : [];
  },
  begrensWerken(max) {
    const n = db.data.mediaWerkherkomst.length - max;
    if (n > 0) { db.data.mediaWerkherkomst = db.data.mediaWerkherkomst.slice(n); return n; }
    return 0;
  },
  begrensMomenten(max) {
    if (db.data.mediaMomenten.length > max) db.data.mediaMomenten = db.data.mediaMomenten.slice(-max);
  },
  bewaar: save
});
