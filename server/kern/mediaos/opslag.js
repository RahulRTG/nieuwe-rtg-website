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
  begrensMomenten(max) {
    if (db.data.mediaMomenten.length > max) db.data.mediaMomenten = db.data.mediaMomenten.slice(-max);
  },
  bewaar: save
});
