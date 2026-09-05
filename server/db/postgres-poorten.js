/* Monteert de twee autoritatieve PostgreSQL-bewerkingen op dezelfde lokale
   commitrij als de gewone flush. Zo bestaat er één async opslageigenaar. */
'use strict';

module.exports = ({ store, db, motor, klaar, slot, onFout }) => {
  const collectie = require('./collectie-postgres')({ store, db, motor, klaar });
  const economisch = require('./economische-boeking-postgres')({ store, db, motor, klaar });
  return {
    bewerkCollectiePostgres: (sleutel, werk) => slot(() => collectie(sleutel, werk))
      .catch(e => { if (onFout) onFout(e, 'collectietransactie'); throw e; }),
    economischeBoekingPostgres: (invoer, werk) => slot(() => economisch(invoer, werk))
      .catch(e => { if (onFout) onFout(e, 'economische-transactie'); throw e; })
  };
};
