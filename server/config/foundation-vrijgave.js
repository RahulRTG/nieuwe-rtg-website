/* Afzonderlijke vrijgave van beschermde Foundation-functies. De vlag vraagt
   alleen vrijgave aan; dezelfde cryptografische externe-bewijsverifier als de
   volledige productiestatus beslist of de poort werkelijk open mag. */
'use strict';

const fs = require('node:fs');
const path = require('node:path');
const extern = require('./external-release');
const releaseBewijs = require('../../scripts/release-bewijs');

const ROOT = path.join(__dirname, '..', '..');
const ENV_NAAM = 'RTF_BESCHERMDE_FUNCTIES_VRIJGEGEVEN';

function leesJsonVast(bestand, maximum = extern.MAX_DOSSIER_BYTES) {
  try { return JSON.parse(extern.leesRegulier(bestand, maximum).toString('utf8')); }
  catch (e) { return null; }
}
function dossierPaden(root) {
  const lokaal = path.join(root, '.release', 'external-release.json');
  return root === ROOT ? ['/run/rtg-release/external-release.json', lokaal] : [lokaal];
}
function releaseBewijsPaden(root) {
  /* Dit is bewust maar één plaats. `/app/release-bewijs.json` wordt tijdens
     de imagebouw gemaakt en zit in de alleen-lezen imagelaag. Een dossier- of
     hostmount onder `/run` mag nooit zelf beweren welke code er draait. */
  return [path.join(root, 'release-bewijs.json')];
}
function commitUitBewijs(root = ROOT) {
  const bewijs = leesJsonVast(path.join(root, 'release-bewijs.json'), extern.MAX_BEWIJS_BYTES);
  if (!bewijs || bewijs.formaat !== 'rtg-release-bewijs-v1' || !bewijs.bron || bewijs.bron.gewijzigd !== false)
    return null;
  const commit = String(bewijs.bron.commit || '').toLowerCase();
  if (!/^[a-f0-9]{40,64}$/.test(commit)) return null;
  /* Niet alleen het manifestveld, maar ieder bestand en de volledige actuele
     runtime-inventaris moeten kloppen. Een gekopieerd JSON van commit A kan
     code B daardoor nooit vrijgeven. */
  try { return releaseBewijs.verifieer(root, bewijs).ok ? commit : null; }
  catch (e) { return null; }
}

function beoordeel({ env = process.env, root = ROOT } = {}) {
  const vlag = String(env[ENV_NAAM] || '');
  if (!vlag) return { aangevraagd:false, vrijgegeven:false, reden:'standaard-gesloten' };
  if (vlag !== '1') return { aangevraagd:true, vrijgegeven:false, reden:'vlag-ongeldig' };
  const commit = commitUitBewijs(root);
  if (!commit) return { aangevraagd:true, vrijgegeven:false, reden:'runtimebewijs-ongeldig' };
  const gekozen = dossierPaden(root).find(bestand => {
    try { return fs.lstatSync(bestand).isFile(); } catch (e) { return false; }
  });
  if (!gekozen) return { aangevraagd:true, vrijgegeven:false, reden:'bewijsbestand-ontbreekt' };
  const paden = extern.padenVoorDossier(gekozen, root);
  const controle = extern.controleerBestanden({ ...paden, releaseCommit:commit,
    vereisteControles:extern.FOUNDATION_CONTROLES, eisFoundationOpen:true });
  return { aangevraagd:true, vrijgegeven:controle.ok, reden:controle.reden,
    commit:controle.ok ? controle.commit : null,
    sleutelSha256:controle.ok ? controle.sleutelSha256 : null };
}

module.exports = { ENV_NAAM, EXTERNE_CONTROLES:extern.FOUNDATION_CONTROLES,
  MAX_BEWIJS_BYTES:extern.MAX_DOSSIER_BYTES, commitUitBewijs, dossierPaden,
  releaseBewijsPaden, beoordeel, controleerDossier:extern.controleerBestanden };
