/* Kleine poort van de opslagorchestrator naar de echte PostgreSQL-
   collectietransactie. */
'use strict';

const context = require('./verzoekcontext');
const state = require('./state');
const verzoekspoor = require('./verzoekspoor');

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
  /* Het auditspoor van het verzoek gaat mee in DEZE transactie (audit P0-1,
     ./verzoekspoor.js): geen vastgelegde mutatie zonder haar spoor. */
  const spoor = verzoekspoor.voorVroegeCommit([sleutel], state.getRuweData());
  const uit = await pg.bewerkCollectie(sleutel, state.getRuweData(), werk, spoor);
  context.eigenCommit(sleutel);
  verzoekspoor.naVroegeCommit(spoor);
  return uit;
};
