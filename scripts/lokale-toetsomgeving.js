'use strict';
// Browser/release/staging tests create their own local stores. A CI service URL
// must not silently override those stores; dedicated PG tests keep their own env.
const { spawnSync } = require('node:child_process');
const { lokaleOmgeving } = require('./lib/suite-pg');
const [command, ...args] = process.argv.slice(2);
if (!command) throw Error('Geef de lokale toetsopdracht mee.');
const result = spawnSync(command, args, { env:lokaleOmgeving(process.env), stdio:'inherit' });
if (result.error) console.error('[lokale-toetsomgeving] ' + result.error.message);
process.exitCode = result.status == null ? 1 : result.status;
