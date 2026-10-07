/* Harde release-gate voor geld dat het huis ECHT verlaat (audit A-P0-02).

   Een uitbetaling of terugbetaling via een echte provider (Stripe, Mollie,
   Adyen) is standaard DICHT. De stand staat in het gecommitte register
   uitbetaalgate.json en niet in een omgevingsvariabele: een beheerder kan hem
   dus niet per ongeluk aanzetten, en openen is een zichtbare wijziging in
   review. Zonder leesbaar register geldt dicht. Sandbox, simulatie en de
   Magnaat-testrail verplaatsen geen echt geld en vallen hier buiten.

   Openen mag pas als `bewijs` naar een bestaand dossier wijst
   (test/uitbetaalgrendel.test.js houdt dat vast).

   EN DAT DOSSIER MOET ER WERKELIJK ZIJN, VOOR DEZE RELEASE. Tot 6 oktober 2026
   was `bewijs` een vrij veld: iedere niet-lege tekst naast `open: true` zette de
   rail open, ook een pad naar niets. Een gecommitte grendel die met een woord
   te openen is, is een boolean met een omweg. Nu vraagt `stand()` de bewijsas
   van de vrijgavepoort (server/kern/vrijgave/bewijs.js): release-bewijs.json
   moet de draaiende code dekken, het externe dossier moet voor DEZE commit
   getekend zijn, en iedere controle uit `voorwaarden` moet daarin PASS staan
   (OUT_OF_SCOPE is het bewijs van een release zonder rail en telt hier niet).
   Deze grendel blijft de BEWIJSAS voor echt geld naar buiten; de vrijgavepoort
   ernaast beslist over de andere vier (server/betaal/uitbetaling.js en
   naslag.js vragen beide). */
'use strict';
const fs = require('node:fs');
const path = require('node:path');

const PAD = path.join(__dirname, 'uitbetaalgate.json');

let bewijsAs = null;
const bewijs = () => { if (!bewijsAs) bewijsAs = require('../kern/vrijgave/bewijs').maakBewijs({}); return bewijsAs; };

function stand() {
  let r;
  try { r = JSON.parse(fs.readFileSync(PAD, 'utf8')); }
  catch (e) { return { open: false, reden: 'register uitbetaalgate.json onleesbaar: dicht' }; }
  if (!r || r.open !== true || !r.bewijs) return { open: false, reden: (r && r.reden) || 'register zonder reden' };
  const voorwaarden = Array.isArray(r.voorwaarden) ? r.voorwaarden.filter(v => typeof v === 'string') : [];
  if (!voorwaarden.length) return { open: false, reden: 'open zonder voorwaarden: dicht' };
  let o;
  try { o = bewijs().oordeel({ bewijs: { controles: voorwaarden } }); } catch (e) { o = null; }
  if (!o || o.geverifieerd !== true)
    return { open: false, reden: 'open zonder release-gebonden bewijs (' + ((o && o.reden) || 'onbekend') + '): dicht' };
  return { open: true, commit: o.commit, inhoudSha256: o.inhoudSha256 };
}

function eisOpen(kanaal) {
  const s = stand();
  if (s.open) return;
  const e = new Error('Echt geld uit het huis (' + kanaal + ') is gesloten: ' + s.reden + ' Er is niets verstuurd.');
  e.code = 'UITBETAALGRENDEL_DICHT';
  e.nietVerstuurd = true;
  throw e;
}

module.exports = { stand, eisOpen, PAD };
