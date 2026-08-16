/* Live integriteitscontrole tegen het releasebewijs in het gebouwde image.

   De controle leest uitsluitend paden, groottes en SHA-256-hashes. Broninhoud
   of geheimen komen nooit in het antwoord. Een optionele, extern ingestelde
   RTG_RELEASE_BEWIJS_SHA256 verankert ook het bewijs zelf: zonder die pin merkt
   dit veranderingen ten opzichte van het bewijs, maar kan een aanvaller met
   volledige schrijfrechten in theorie bron EN bewijs samen vervangen. */
'use strict';

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const release = require('../../scripts/release-bewijs');
const klok = require('../lib/klok');

const MAX_BEWIJS = 16 * 1024 * 1024;
const SHA = /^[a-f0-9]{64}$/i;

module.exports = function maakIntegriteitswacht(opties) {
  opties = opties || {};
  const root = path.resolve(opties.root || path.join(__dirname, '../..'));
  const ingesteldePin = String(opties.pin == null ? (process.env.RTG_RELEASE_BEWIJS_SHA256 || '') : opties.pin)
    .trim().toLowerCase();
  let laatst = null;

  function integriteitsKandidaten() {
    const eigen = opties.bewijsPad || process.env.RTG_RELEASE_BEWIJS;
    const lijst = eigen ? [eigen] : ['release-bewijs.json', '.release/release-bewijs.json'];
    return lijst.map(p => path.isAbsolute(p) ? p : path.resolve(root, p));
  }

  function lees() {
    const bewijsPad = integriteitsKandidaten().find(p => fs.existsSync(p));
    if (!bewijsPad) return { beschikbaar: false, fout: 'Geen releasebewijs gevonden.',
      gezocht: integriteitsKandidaten().map(p => path.relative(root, p) || path.basename(p)) };
    try {
      const stat = fs.lstatSync(bewijsPad);
      if (!stat.isFile() || stat.isSymbolicLink()) throw new Error('Het releasebewijs is geen gewoon bestand.');
      if (stat.size > MAX_BEWIJS) throw new Error('Het releasebewijs is onverwacht groot.');
      const rauw = fs.readFileSync(bewijsPad);
      const bewijsSha256 = crypto.createHash('sha256').update(rauw).digest('hex');
      const manifest = JSON.parse(rauw.toString('utf8'));
      if (!manifest || manifest.formaat !== 'rtg-release-bewijs-v1' || !Array.isArray(manifest.bestanden))
        throw new Error('Het releasebewijs heeft een onbekend formaat.');
      const pinGeldig = !ingesteldePin || (SHA.test(ingesteldePin) && bewijsSha256 === ingesteldePin);
      return { beschikbaar: true, bewijsPad, bewijsSha256, pinIngesteld: !!ingesteldePin,
        pinGeldig, manifest };
    } catch (e) {
      return { beschikbaar: false, fout: String(e && e.message || e), bewijsPad };
    }
  }

  function status() {
    const b = lees();
    return {
      beschikbaar: b.beschikbaar,
      bewijs: b.beschikbaar ? path.relative(root, b.bewijsPad) || path.basename(b.bewijsPad) : null,
      bewijsSha256: b.bewijsSha256 || null,
      pinIngesteld: !!b.pinIngesteld,
      pinGeldig: b.beschikbaar ? b.pinGeldig : null,
      gemaakt: b.manifest && b.manifest.gemaakt || null,
      bestandAantal: b.manifest && b.manifest.bestandAantal || 0,
      inhoudSha256: b.manifest && b.manifest.inhoudSha256 || null,
      fout: b.fout || null,
      laatst
    };
  }

  function controleer() {
    const begonnen = klok.nu();
    const b = lees();
    if (!b.beschikbaar) {
      laatst = { ok: false, at: klok.datum().toISOString(), duurMs: klok.nu() - begonnen,
        verschillen: 1, details: [{ soort: 'bewijs', pad: null, uitleg: b.fout }] };
      return status();
    }
    let r;
    try { r = release.verifieer(root, b.manifest); }
    catch (e) { r = { ok: false, verschillen: [{ soort: 'scan', pad: null, uitleg: String(e.message || e) }] }; }
    const details = (r.verschillen || []).slice(0, 200);
    if (!b.pinGeldig) details.unshift({ soort: 'pin', pad: null,
      uitleg: SHA.test(ingesteldePin) ? 'De SHA-256 van het releasebewijs wijkt af van de externe pin.' :
        'RTG_RELEASE_BEWIJS_SHA256 is geen geldige SHA-256.' });
    laatst = {
      ok: !!r.ok && b.pinGeldig,
      at: klok.datum().toISOString(),
      duurMs: klok.nu() - begonnen,
      verschillen: (r.verschillen || []).length + (b.pinGeldig ? 0 : 1),
      details,
      detailsBegrensd: (r.verschillen || []).length > details.length,
      bestandAantal: r.bestandAantal || 0
    };
    return status();
  }

  function bestanden() {
    const b = lees();
    if (!b.beschikbaar) return [];
    return b.manifest.bestanden.map(x => ({ pad: x.pad, bytes: x.bytes, sha256: x.sha256 }));
  }

  return { status, controleer, bestanden };
};
