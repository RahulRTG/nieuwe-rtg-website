'use strict';
const crypto = require('crypto');

const TOETSEN = Object.freeze([
  'test/pg.test.js',
  'test/foundation-persoonscodes.pg.test.js',
  'test/spelprojectie.pg.test.js',
  'test/contactpin-live.pg.test.js',
  'test/boarding-pass.pg.test.js',
  'test/rtf-samen-credential.pg.test.js',
  'test/rtgid-credential.pg.test.js',
  'test/salon-claimcode.pg.test.js',
  'test/payout-terugboeking.pg.test.js',
  'test/postgres-requestcommit.pg.test.js',
  'test/duurzaamheid-pg.test.js',
  'test/pgaccounts.test.js',
  'test/chaos.pg.test.js',
  'test/leden-gids-pg.test.js',
  'test/txledger.pg.test.js',
  'test/pg-snapshot.test.js',
  'test/grafsteen.pg.test.js',
  'test/pg-wachten.test.js',
  'test/intrekking-multi-instance.pg.test.js',
  'test/grand-integratie.pg.test.js',
  'test/sloophamer.pg.test.js'
]);

const toetslijstSha256 = crypto.createHash('sha256').update(TOETSEN.join('\n') + '\n').digest('hex');
module.exports = { TOETSEN, toetslijstSha256 };
