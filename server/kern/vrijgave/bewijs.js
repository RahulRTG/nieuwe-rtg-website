/* DE BEWIJSAS: is deze capability op DEZE release aantoonbaar gekwalificeerd?

   WAT HIER NIET WORDT UITGEVONDEN. Dit huis heeft al een cryptografische keten
   voor precies deze vraag, en een tweede zou de eerste ondermijnen:
     - server/config/foundation-vrijgave.js `commitUitBewijs()` leest
       release-bewijs.json uit de alleen-lezen imagelaag en VERIFIEERT ieder
       bestand van de draaiende code ertegen. Een gekopieerd bewijs van commit A
       geeft code B dus nooit vrij.
     - server/config/external-release.js `controleerBestanden()` controleert het
       externe dossier: Ed25519-handtekening op het gepinde anker, de commit, en
       de hash van ieder bewijsbestand per controle.
   Deze module zet die twee achter elkaar, per capability met haar EIGEN lijst
   controles, en voegt twee dingen toe die voor geld nodig zijn en daar niet
   stonden:

   1. `OUT_OF_SCOPE` IS GEEN BEWIJS. De dossierlaag aanvaardt voor een
      geldcontrole ook OUT_OF_SCOPE -- dat is het geldige verslag van een release
      ZONDER rail. Voor de vraag "mag deze rail open" is dat precies het
      omgekeerde antwoord. Hier telt dus alleen PASS.
   2. DE PROVIDER MOET KLOPPEN. Een geslaagde Mollie-keten zegt niets over
      Stripe. Voor een providerregel moet de gemeten provider in ieder
      machineverslag die provider zijn.

   EN DE BINDING AAN HET IMAGE. Het oordeel draagt de commit en de inhoudshash
   uit release-bewijs.json mee (`inhoudSha256`), zodat een statusbord en een
   auditregel kunnen zeggen OP WELKE code het bewijs rust -- niet alleen dat er
   ergens een dossier lag.

   DE PRIJS VAN DE CONTROLE, en waarom er een cache is. Het releasebewijs
   verifieert ieder bestand van de runtime; dat per verzoek doen is onbetaalbaar.
   Het oordeel wordt daarom bewaard tot een van de bewijsbestanden van grootte,
   tijd of inode verandert, en hoogstens VIJF MINUTEN. Dat is geen uitstel van
   de noodknop: uitzetten loopt via ./stand.js en is niet aan deze cache
   gebonden. Bewijs dat tijdens het draaien VERDWIJNT, valt binnen een
   verzoek weg (de stat ziet het meteen); bewijs dat erbij komt telt binnen
   vijf minuten. */
'use strict';
const fs = require('node:fs');
const path = require('node:path');

const CACHE_MS = 5 * 60 * 1000;
const ROOT = path.join(__dirname, '..', '..', '..');

function merk(paden) {
  return paden.map(p => {
    try { const s = fs.statSync(p); return [p, s.size, s.mtimeMs, s.ino].join(':'); }
    catch (e) { return p + ':weg'; }
  }).join('|');
}

/* `bronnen` is injecteerbaar voor de toetsen; standaard de echte keten. */
function maakBewijs({ root = ROOT, nu = () => Date.now(), bronnen } = {}) {
  const b = bronnen || standaardBronnen(root);
  const cache = new Map();

  function oordeel(cap) {
    const eis = (cap && cap.bewijs) || null;
    if (!eis || !Array.isArray(eis.controles))
      return { geverifieerd: false, reden: 'geen-bewijseis', uitleg: 'Deze capability noemt geen bewijseis.' };
    const sleutel = eis.controles.slice().sort().join(',') + '#' + (eis.provider || '');
    const paden = b.paden();
    const m = merk(paden);
    const c = cache.get(sleutel);
    if (c && c.merk === m && nu() - c.op < CACHE_MS) return c.uitslag;
    const uitslag = bereken(eis);
    cache.set(sleutel, { merk: m, op: nu(), uitslag });
    return uitslag;
  }

  function bereken(eis) {
    let release;
    try { release = b.release(); } catch (e) { release = null; }
    if (!release || !release.commit)
      return { geverifieerd: false, reden: 'releasebewijs-ongeldig',
        uitleg: 'Er is geen geverifieerd releasebewijs voor de draaiende code.' };
    let dossier;
    try { dossier = b.dossier(release.commit, eis.controles); }
    catch (e) { dossier = { ok: false, reden: 'dossier-onleesbaar' }; }
    if (!dossier || !dossier.ok)
      return { geverifieerd: false, reden: 'dossier-' + String((dossier && dossier.reden) || 'ontbreekt'),
        uitleg: 'Het externe bewijsdossier voor deze release is er niet of klopt niet.',
        commit: release.commit, inhoudSha256: release.inhoudSha256 || null };
    const controles = dossier.controles || {};
    for (const naam of eis.controles) {
      const k = controles[naam];
      if (!k || k.status !== 'PASS')
        return { geverifieerd: false, reden: 'controle-niet-pass:' + naam,
          uitleg: 'Controle ' + naam + ' staat niet op PASS (OUT_OF_SCOPE is het bewijs van een release ZONDER rail).',
          commit: release.commit, inhoudSha256: release.inhoudSha256 || null };
      if (eis.provider) {
        const gemeten = k.provider || null;
        if (gemeten !== eis.provider)
          return { geverifieerd: false, reden: 'provider-wijkt-af:' + naam,
            uitleg: 'Controle ' + naam + ' is gemeten op een andere provider dan deze.',
            commit: release.commit, inhoudSha256: release.inhoudSha256 || null };
      }
    }
    return { geverifieerd: true, reden: 'release-gebonden-bewijs',
      commit: release.commit, inhoudSha256: release.inhoudSha256 || null,
      dossierSha256: dossier.dossierSha256 || null };
  }

  return { oordeel, leeg: () => cache.clear() };
}

/* De echte keten. Alles fail-closed: een fout bij het lezen is geen bewijs. */
function standaardBronnen(root) {
  const fv = require('../../config/foundation-vrijgave');
  const extern = require('../../config/external-release');
  const dossierPad = () => fv.dossierPaden(root).find(p => {
    try { return fs.lstatSync(p).isFile(); } catch (e) { return false; }
  }) || null;
  return {
    paden() {
      const d = dossierPad();
      const uit = [path.join(root, 'release-bewijs.json')];
      if (d) { const p = extern.padenVoorDossier(d, root); uit.push(p.dossierPad, p.handtekeningPad); }
      return uit;
    },
    release() {
      const commit = fv.commitUitBewijs(root);
      if (!commit) return null;
      let inhoudSha256 = null;
      try {
        const rb = JSON.parse(fs.readFileSync(path.join(root, 'release-bewijs.json'), 'utf8'));
        inhoudSha256 = rb && rb.inhoudSha256 || null;
      } catch (e) { /* zonder inhoudshash geen binding: dan ook geen bewijs */ return null; }
      return inhoudSha256 ? { commit, inhoudSha256 } : null;
    },
    dossier(commit, controles) {
      const d = dossierPad();
      if (!d) return { ok: false, reden: 'ontbreekt' };
      const paden = extern.padenVoorDossier(d, root);
      const c = extern.controleerBestanden({ ...paden, releaseCommit: commit, vereisteControles: controles });
      if (!c.ok) return c;
      /* Pas NA een geldige handtekening lezen we de statussen en de providers;
         daarvoor zijn de bytes niet te vertrouwen. Ze zijn hier opnieuw gelezen
         en tegen de getekende hash gehouden, zodat er tussen de controle en het
         lezen niets kan zijn gewisseld. */
      const bytes = extern.leesRegulier(paden.dossierPad, extern.MAX_DOSSIER_BYTES);
      if (extern.sha256(bytes) !== c.dossierSha256) return { ok: false, reden: 'dossier-veranderd' };
      const dossier = JSON.parse(bytes.toString('utf8'));
      const uit = {};
      for (const naam of controles) {
        const k = dossier.controles[naam];
        let provider = null;
        const bestand = c.bewijsBestanden.find(x => x.controle === naam);
        if (bestand) {
          try {
            const rb = extern.leesRegulier(path.join(paden.bewijsRoot, bestand.bestand), extern.MAX_BEWIJS_BYTES);
            if (extern.sha256(rb) === bestand.sha256) {
              const rapport = JSON.parse(rb.toString('utf8'));
              const m = rapport && rapport.gegevens && rapport.gegevens.externalMeasurement;
              provider = m && m.observations && m.observations.provider || null;
            }
          } catch (e) { provider = null; }
        }
        uit[naam] = { status: k && k.status, provider };
      }
      return { ok: true, controles: uit, dossierSha256: c.dossierSha256 };
    }
  };
}

module.exports = { maakBewijs, CACHE_MS };
