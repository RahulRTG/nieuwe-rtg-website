'use strict';

const fs = require('fs');
const path = require('path');

/* Op de host komt de identiteit rechtstreeks uit Git. In het minimale image is
   .git terecht afwezig; daar geldt uitsluitend het intern ingebakken manifest,
   nadat dat tegen alle huidige runtimebytes is teruggeverifieerd. Een
   host-mount of losse omgevingsvariabele kan deze uitspraak niet vervangen. */
function lees(root, rechtstreeks) {
  const direct = rechtstreeks || require('./stempel').exactStempel();
  if (direct.commit) return direct;
  const pad = path.join(root, 'release-bewijs.json');
  try {
    const manifest = JSON.parse(fs.readFileSync(pad, 'utf8'));
    const commit = manifest && manifest.bron && String(manifest.bron.commit || '').toLowerCase();
    const controle = require('../release-bewijs').verifieer(root, manifest);
    if (manifest.formaat === 'rtg-release-bewijs-v1' && manifest.bron.gewijzigd === false &&
      /^[a-f0-9]{40,64}$/.test(commit) && controle.ok) {
      return { op: new Date().toISOString(), commit, boomVuil: false, boomAnders: 0,
        instrument: 'scripts/golive.js', node: process.version,
        herkomst: 'geverifieerd-imagebewijs', inhoudSha256: manifest.inhoudSha256 };
    }
  } catch (e) {}
  return direct; // null/unknown blijft fail-closed in productie-status
}

module.exports = { lees };
