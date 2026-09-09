/* Kleine poort van de opslagorchestrator naar de echte PostgreSQL-
   collectietransactie. */
'use strict';

const context = require('./verzoekcontext');
const state = require('./state');

module.exports = ({ store, db, motor, klaar }) => async function collectieSlotPostgres(sleutel, werk) {
  const pg = motor();
  /* PG_ONGEZOND, en die code draagt hier betekenis. Deze fout ontstaat juist
     WANNEER de schrijfpoort al dicht staat, dus hij is een gevolg en geen
     oorzaak. postgres-verzoeken.js gebruikt de code om hem niet als tweede
     storingsreden te tellen en zo de echte oorzaak niet te overschrijven; de
     poort blijft er onverkort dicht van. */
  if (store !== 'postgres' || !pg || !klaar() || !db.writable)
    throw Object.assign(new Error('De gedeelde PostgreSQL-opslag is nog niet schrijfbaar.'),
      { code: 'PG_ONGEZOND' });
  const uit = await pg.bewerkCollectie(sleutel, state.getRuweData(), werk);
  context.eigenCommit(sleutel);
  return uit;
};
