/* pgwire: eigen PostgreSQL-client (wireprotocol v3) op node:net/tls, i.p.v. het
   pakket `pg`. Zie docs/de-lijn.md. Opgesplitst in protocol/client/pool; deze
   index houdt de publieke vorm identiek: new Pool({connectionString,...}),
   pool.query(text, params?), pool.connect(), pool.end(). De _-exports zijn voor
   de unit-test (test/pgwire.test.js). */
'use strict';
const { Client } = require('./client');
const { Pool } = require('./pool');
const { decodeer, paramTekst, int16 } = require('./protocol');

module.exports = { Pool, Client, _decodeer: decodeer, _paramTekst: paramTekst, _int16: int16 };
