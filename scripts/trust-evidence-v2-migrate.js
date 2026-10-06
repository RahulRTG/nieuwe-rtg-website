#!/usr/bin/env node
/* Offline migratie voor V2 trust-evidence met ruwe domeinpayload.

   Deze ingang is expres niet onderdeel van server-start. Eerst ontstaat een
   apart, geauthenticeerd en opnieuw gelezen archief; daarna verandert precies
   één trustEvidence-collectietransactie de primaire opslag. */
'use strict';

const fs = require('node:fs');

const BEVESTIGING = 'ARCHIVE-AND-MIGRATE-LEGACY-TRUST-EVIDENCE';

function argument(naam) {
  const gelijk = process.argv.find(x => x.startsWith('--' + naam + '='));
  if (gelijk) return gelijk.slice(naam.length + 3);
  const i = process.argv.indexOf('--' + naam);
  return i >= 0 ? process.argv[i + 1] : null;
}

function stop(code, melding, status) {
  const veilig = String(melding || 'Migratie geweigerd.').replace(/[\r\n]+/g, ' ').slice(0, 500);
  fs.writeSync(2, JSON.stringify({ ok: false, code: code || 'LEGACY_MIGRATION_FAILED', error: veilig }) + '\n');
  process.exit(status || 1);
}

if (!process.argv.includes('--execute') || !process.argv.includes('--offline') ||
    argument('confirm') !== BEVESTIGING) {
  stop('LEGACY_MIGRATION_CONFIRMATION_REQUIRED',
    'Verifieer extern nul verkeer en nul schrijvende instances; --offline is alleen uw verklaring. Gebruik --execute --offline --confirm=' + BEVESTIGING + '.', 64);
}
if (!process.env.RTG_ENC_KEY)
  stop('LEGACY_ARCHIVE_KEY_REQUIRED', 'RTG_ENC_KEY is verplicht; een plaintext-archief is niet toegestaan.', 64);
if (!process.env.RTG_EVIDENCE_ARCHIVE_DIR)
  stop('LEGACY_ARCHIVE_PATH_REQUIRED', 'RTG_EVIDENCE_ARCHIVE_DIR is verplicht en moet buiten RTG_DATA_DIR liggen.', 64);

/* Pas na bovenstaande controle laden: server/kluis leest RTG_ENC_KEY bij het
   laden. Zo kan deze standalone ingang niet per ongeluk een eerder zonder
   sleutel geïnitialiseerde kluis gebruiken. */
const kluis = require('../server/kluis');
if (!kluis.AAN) stop('LEGACY_ARCHIVE_KEY_REQUIRED', 'RTG_ENC_KEY kon de RTG-kluis niet activeren.', 64);
const opslag = require('../server/db');
const migratie = require('../server/kern/bewijsvlak/legacy-v2-migration');
const archief = require('../server/kern/bewijsvlak/legacy-archive');

async function migreer() {
  let resultaat;
  async function binnenAutoritatieveStart() {
    const root = opslag.db.data && opslag.db.data.trustEvidence || {};
    const plan = migratie.maakPlan(root, { sourceStore: opslag.STORE });
    if (!plan.needed) {
      const archiveVerified = plan.receipt ? archief.verifieerReceipt({ receipt: plan.receipt, kluis,
        directory: process.env.RTG_EVIDENCE_ARCHIVE_DIR, dataDirectory: opslag.DATA_DIR }).verified : null;
      resultaat = { changed: false, migrationId: migratie.MIGRATION_ID,
        store: opslag.STORE, alreadyMigrated: plan.alreadyMigrated, archiveVerified, receipt: plan.receipt };
      return;
    }
    const bewijsarchief = archief.archiveer({ plan, kluis,
      directory: process.env.RTG_EVIDENCE_ARCHIVE_DIR,
      dataDirectory: opslag.DATA_DIR });
    const toegepast = await migratie.voerUit({ plan, archive: bewijsarchief,
      bewerkCollectie: opslag.bewerkCollectie });
    resultaat = { changed: toegepast.changed, migrationId: migratie.MIGRATION_ID,
      store: opslag.STORE, migratedCount: plan.count, receipt: toegepast.receipt };
  }

  opslag.load();
  if (opslag.STORE === 'postgres') await opslag.startPostgres(binnenAutoritatieveStart);
  else await binnenAutoritatieveStart();
  if (!resultaat) throw Object.assign(new Error('De migratie leverde geen resultaat op.'),
    { code: 'LEGACY_MIGRATION_NO_RESULT' });
  fs.writeSync(1, JSON.stringify({ ok: true, ...resultaat }) + '\n');
}

migreer().then(() => process.exit(0)).catch(error =>
  stop(error && error.code || 'LEGACY_MIGRATION_FAILED', error && error.message));
