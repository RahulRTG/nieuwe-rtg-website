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
      .catch(e => { if (onFout) onFout(e, 'economische-transactie'); throw e; }),
    /* Een VERSE basis voor een verzoek dat een gezagsbesluit neemt
       (bedrijf/productie-identiteit.js): dezelfde inlees als LISTEN en de poll,
       maar nu, op de commitrij, en buiten de requestcontext zodat de werkkopie
       van het verzoek daarna uit de actuele stand wordt gemaakt. Geen gezonde
       motor is geen oude stand maar een fout: de deur blijft dan dicht. */
    verversPostgres: () => slot(() => {
      const pg = motor();
      if (store !== 'postgres' || !pg || !klaar() || typeof pg.haalNieuwer !== 'function')
        throw Object.assign(new Error('De actuele PostgreSQL-stand is niet leesbaar.'), { code: 'PG_ONGEZOND' });
      const state = require('./state');
      return require('./verzoekcontext').zonder(() => pg.haalNieuwer(state.getRuweData(), state.getExternCb()));
    })
  };
};
