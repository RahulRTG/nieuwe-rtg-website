'use strict';
const context = require('./verzoekcontext');
const state = require('./state');
const verzoekspoor = require('./verzoekspoor');

/* Houdt de opslagpoort op één plek: zonder actieve, schrijfbare PostgreSQL-
   waarheid mag een economische transactie geen succes veinzen. */
module.exports = ({ store, db, motor, klaar }) => async (invoer, werk) => {
  const pg = motor();
  if (store !== 'postgres' || !pg || !klaar() || !db.writable || typeof pg.boekEenmaal !== 'function')
    throw new Error('PostgreSQL kan de economische boeking nu niet duurzaam bevestigen.');
  /* De economische motor zet zijn geisoleerde conceptprojecties heel kort op
     de ruwe wortel terwijl de synchrone domeinbewerker draait. Die callback mag
     daarom niet opnieuw de request-proxy zien. */
  /* Het auditspoor van het verzoek boekt mee (audit P0-1, ./verzoekspoor.js). */
  const spoor = verzoekspoor.voorVroegeCommit(invoer && invoer.collecties, state.getRuweData());
  const uit = await pg.boekEenmaal(state.getRuweData(), invoer,
    (...a) => context.eigenWerk(() => werk(...a)), spoor);
  context.eigenCommit(invoer && invoer.collecties);
  verzoekspoor.naVroegeCommit(spoor);
  return uit;
};
