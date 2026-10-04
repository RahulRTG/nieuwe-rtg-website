#!/usr/bin/env node
/* Read-only, versleutelde runtime-evidence-export.

   De bron wordt via een aparte read-only adapter gelezen. Dit programma laadt
   server/kluis pas nadat de sleutel is gecontroleerd en schrijft uitsluitend
   naar de afzonderlijke exportmap. */
'use strict';

const fs = require('node:fs');
const path = require('node:path');

const BEVESTIGING = 'EXPORT-RUNTIME-TRUST-EVIDENCE';

function argument(naam) {
  const gelijk = process.argv.find(x => x.startsWith('--' + naam + '='));
  if (gelijk) return gelijk.slice(naam.length + 3);
  const i = process.argv.indexOf('--' + naam);
  return i >= 0 ? process.argv[i + 1] : null;
}

function stop(code, melding, status) {
  let veilig = String(melding || 'Evidence-export geweigerd.').replace(/[\r\n]+/g, ' ');
  for (const pad of [process.env.RTG_EVIDENCE_EXPORT_DIR, process.env.RTG_DATA_DIR]) {
    if (pad) veilig = veilig.split(String(pad)).join('[afgeschermd pad]');
  }
  fs.writeSync(2, JSON.stringify({ ok: false, code: code || 'EVIDENCE_EXPORT_FAILED',
    error: veilig.slice(0, 500) }) + '\n');
  process.exit(status || 1);
}

if (!process.env.RTG_ENC_KEY)
  stop('EVIDENCE_EXPORT_KEY_REQUIRED', 'RTG_ENC_KEY is verplicht; een plaintext-export is niet toegestaan.', 64);

const verifyId = argument('verify');
const statusMode = process.argv.includes('--status');
if (verifyId && statusMode)
  stop('EVIDENCE_EXPORT_MODE_INVALID', 'Kies één handeling: --status, --verify of --execute.', 64);
if (!statusMode && !process.env.RTG_EVIDENCE_EXPORT_DIR)
  stop('EVIDENCE_EXPORT_PATH_REQUIRED', 'RTG_EVIDENCE_EXPORT_DIR is verplicht.', 64);
if (!verifyId && !statusMode && (!process.argv.includes('--execute') || argument('confirm') !== BEVESTIGING)) {
  stop('EVIDENCE_EXPORT_CONFIRMATION_REQUIRED',
    'Gebruik --execute --confirm=' + BEVESTIGING + '. De export is read-only en maakt geen capaciteit vrij.', 64);
}

/* server/kluis leest de sleutel eenmalig bij require. Daarom pas na de
   bovenstaande procesgrens laden en nooit een process-global achteraf vullen. */
const kluis = require('../server/kluis');
if (!kluis.AAN) stop('EVIDENCE_EXPORT_KEY_REQUIRED', 'RTG_ENC_KEY kon de RTG-kluis niet activeren.', 64);
const exporter = require('../server/kern/bewijsvlak/runtime-evidence-export');

async function draai() {
  const directory = process.env.RTG_EVIDENCE_EXPORT_DIR;
  const dataDirectory = path.resolve(process.env.RTG_DATA_DIR || path.join(__dirname, '..', 'server', 'data'));
  let receipt;
  if (verifyId) {
    receipt = exporter.verifieer({ archiveId: verifyId, kluis, directory, dataDirectory });
  } else {
    const source = require('../server/kern/bewijsvlak/runtime-evidence-source');
    const snapshot = await source.lees({ env: process.env, kluis });
    if (statusMode) {
      const plan = exporter.maakPlan(snapshot);
      fs.writeSync(1, JSON.stringify({ ok: true, mode: 'status', stateDigest: plan.stateDigest,
        capacity: plan.capacity }) + '\n');
      return;
    }
    receipt = exporter.archiveer({ source: snapshot, kluis, directory,
      dataDirectory: snapshot.dataDirectory });
  }
  fs.writeSync(1, JSON.stringify({ ok: true, verified: true, receipt }) + '\n');
}

draai().then(() => process.exit(0)).catch(error =>
  stop(error && error.code || 'EVIDENCE_EXPORT_FAILED', error && error.message));
