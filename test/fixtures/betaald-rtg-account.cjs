'use strict';
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

// Alleen bestaande wegwerpdatabases; nooit de standaard- of productiedatamap.
if (process.env.NODE_ENV !== 'test' || !process.env.RTG_DATA_DIR || process.env.DATABASE_URL)
  throw new Error('betaalde fixture vereist een lokale testdatabase');
const dataDir = fs.realpathSync(process.env.RTG_DATA_DIR);
const relative = path.relative(fs.realpathSync(os.tmpdir()), dataDir);
if (!relative || relative.startsWith('..') || path.isAbsolute(relative))
  throw new Error('betaalde fixture vereist een eigen tijdelijke datamap');
const accounts = require('../../server/accounts');
accounts.init();
const user = accounts.findByLogin(process.argv[2]);
if (!user) throw new Error('testaccount niet gevonden');
if (!accounts.setTier(user.id, 'rtg')) throw new Error('RTG-testpas kon niet worden gezet');
if (accounts.checkpoint) accounts.checkpoint();
