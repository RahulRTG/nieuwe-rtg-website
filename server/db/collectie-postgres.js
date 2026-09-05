/* Kleine poort van de opslagorchestrator naar de echte PostgreSQL-
   collectietransactie. */
'use strict';

const context = require('./verzoekcontext');
const state = require('./state');

module.exports = ({ store, db, motor, klaar }) => async function collectieSlotPostgres(sleutel, werk) {
  const pg = motor();
  if (store !== 'postgres' || !pg || !klaar() || !db.writable)
    throw new Error('De gedeelde PostgreSQL-opslag is nog niet schrijfbaar.');
  const uit = await pg.bewerkCollectie(sleutel, state.getRuweData(), werk);
  context.eigenCommit(sleutel);
  return uit;
};
