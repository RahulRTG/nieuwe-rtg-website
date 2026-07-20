/* Eigen PostgreSQL-client (server/pgwire.js), die het pakket `pg` verving. De
   ECHTE end-to-end-borging staat in de *.pg.test.js-integratietests (tegen een
   draaiende Postgres, met DATABASE_URL). Hier toetsen we de pure kern die altijd
   draait: type-decodering (zoals node-pg), parameter-tekstcodering en het
   ontleden van de connection string. Los: node --test test/pgwire.test.js */
const { test } = require('node:test');
const assert = require('node:assert/strict');
const pg = require('../server/pgwire');

test('type-decodering matcht node-pg (int8 als string, int4 als getal, bool, json, null)', () => {
  assert.equal(pg._decodeer(16, 't'), true);            // bool
  assert.equal(pg._decodeer(16, 'f'), false);
  assert.equal(pg._decodeer(23, '42'), 42);             // int4 -> getal
  assert.strictEqual(pg._decodeer(20, '9007199254740993'), '9007199254740993'); // int8 -> string (precisie)
  assert.equal(pg._decodeer(701, '3.5'), 3.5);          // float8
  assert.strictEqual(pg._decodeer(1700, '9.99'), '9.99'); // numeric -> string
  assert.deepEqual(pg._decodeer(3802, '{"x":1}'), { x: 1 }); // jsonb -> object
  assert.ok(pg._decodeer(1184, '2026-07-20 12:00:00+00') instanceof Date); // timestamptz -> Date
  assert.equal(pg._decodeer(25, 'tekst'), 'tekst');     // text
  assert.equal(pg._decodeer(25, null), null);
});

test('parameter-tekstcodering: null/bool/getal/Date/Buffer/object/string', () => {
  assert.equal(pg._paramTekst(null), null);
  assert.equal(pg._paramTekst(undefined), null);
  assert.equal(pg._paramTekst(true), 't');
  assert.equal(pg._paramTekst(false), 'f');
  assert.equal(pg._paramTekst(1000000), '1000000');
  assert.equal(pg._paramTekst('hallo'), 'hallo');
  assert.equal(pg._paramTekst(new Date('2026-07-20T12:00:00Z')), '2026-07-20T12:00:00.000Z');
  assert.equal(pg._paramTekst(Buffer.from([0xab, 0xcd])), '\\xabcd');
  assert.equal(pg._paramTekst({ a: 1 }), '{"a":1}');
});

test('connection string wordt ontleed (host/port/user/password/database)', () => {
  const p = new pg.Pool({ connectionString: 'postgresql://u:p%40ss@db.host:5455/mijndb', max: 7 });
  assert.equal(p._cfg.host, 'db.host');
  assert.equal(p._cfg.port, 5455);
  assert.equal(p._cfg.user, 'u');
  assert.equal(p._cfg.password, 'p@ss', 'wachtwoord wordt url-gedecodeerd');
  assert.equal(p._cfg.database, 'mijndb');
  assert.equal(p.options.max, 7);
  // sslmode
  const s = new pg.Pool({ connectionString: 'postgresql://u@h:5432/d?sslmode=require' });
  assert.ok(s._cfg.ssl && s._cfg.ssl.rejectUnauthorized === false);
  const geen = new pg.Pool({ connectionString: 'postgres://u@h/d' });
  assert.equal(geen._cfg.ssl, false);
});

test('int16-teller is unsigned: 0..65535 zonder RangeError (batch-insert van 5000x9 params)', () => {
  // Het v3-protocol codeert het parameter-aantal als 16-bits teller. Postgres
  // staat tot 65535 params toe; een batch-insert van 5000 rijen x 9 kolommen =
  // 45000 > 32767. writeInt16BE zou daarop crashen -- dit borgt writeUInt16BE.
  assert.deepEqual([...pg._int16(0)], [0, 0]);
  assert.deepEqual([...pg._int16(1)], [0, 1]);
  assert.deepEqual([...pg._int16(32767)], [0x7f, 0xff]);      // grens signed int16
  assert.doesNotThrow(() => pg._int16(45000), 'geen RangeError meer boven 32767');
  assert.deepEqual([...pg._int16(45000)], [0xaf, 0xc8]);       // 45000 = 0xAFC8
  assert.deepEqual([...pg._int16(65535)], [0xff, 0xff]);       // maximum
});

test('lege pool: tellers en options kloppen (geen verbinding nodig)', () => {
  const p = new pg.Pool({ connectionString: 'postgres://u@127.0.0.1:1/d', max: 3 });
  assert.equal(p.totalCount, 0);
  assert.equal(p.idleCount, 0);
  assert.equal(p.waitingCount, 0);
  assert.equal(p.options.max, 3);
  assert.equal(typeof p.query, 'function');
  assert.equal(typeof p.connect, 'function');
  assert.equal(typeof p.end, 'function');
});
