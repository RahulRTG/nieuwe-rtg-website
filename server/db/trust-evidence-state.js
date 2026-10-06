'use strict';

/* De Trust-runtime moet per verzoek de actuele databaseprojectie lezen. Deze
   ene opslaggrens voorkomt dat het bewijsvlak zelf rechtstreeks aan db.data
   hangt en houdt PostgreSQL request-COW en SQLite op dezelfde semantiek. */
function maakTrustEvidenceStateFor(db) {
  if (!db || typeof db !== 'object') throw new Error('bewijsvlak runtime: database ontbreekt');
  return () => {
    const data = db.data;
    if (!data || typeof data !== 'object') throw new Error('bewijsvlak runtime: database-state ontbreekt');
    if (!data.trustEvidence || typeof data.trustEvidence !== 'object') data.trustEvidence = {};
    return data.trustEvidence;
  };
}

module.exports = { maakTrustEvidenceStateFor };
