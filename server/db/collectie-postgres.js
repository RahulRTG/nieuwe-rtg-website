/* Kleine poort van de opslagorchestrator naar de echte PostgreSQL-
   collectietransactie. */
'use strict';

module.exports = ({ store, db, motor, klaar }) => function collectieSlotPostgres(sleutel, werk) {
  const pg = motor();
  if (store !== 'postgres' || !pg || !klaar() || !db.writable)
    throw new Error('De gedeelde PostgreSQL-opslag is nog niet schrijfbaar.');
  return pg.bewerkCollectie(sleutel, db.data, werk);
};
