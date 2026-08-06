/* ============================================================================
   DE RIJ UITGESTELDE SCRIPTS VINDEN, EN HEM VERVANGEN DOOR EEN VERWIJZING.

   De tegenhanger van ./stijlbundel-rij.js, en met opzet strenger. Zie de kop van
   ./scriptbundel.js voor waarom scripts hier lang NIET gebundeld werden en wat
   er is veranderd waardoor het nu wel mag.

   DRIE REGELS, en elke regel houdt een echt verschil in gedrag tegen:

   1. ALLEEN UITGESTELDE SCRIPTS (defer). Een gewoon script draait TIJDENS het
      ontleden, op de plek waar het staat; de DOM erna bestaat dan nog niet. Voeg
      je die samen, dan verschuift het moment waarop ze draaien en zien ze een
      andere pagina dan bedoeld. Uitgestelde scripts draaien allemaal pas na het
      ontleden, in volgorde -- precies wat een bundel ook doet.

   2. GEEN async. Die belooft juist GEEN volgorde; in een bundel krijgt hij er
      een. Dat is een andere belofte dan de pagina deed.

   3. ER MAG NIETS TUSSEN STAAN behalve witruimte en commentaar. Een gewoon
      script of een stijlblad tussen twee uitgestelde scripts breekt de rij:
      daar hangt volgorde aan die we niet stil mogen veranderen.

   Een rij van een is geen winst en blijft staan. test/scriptbundel.test.js
   loopt deze regels na, stuk voor stuk.
   ========================================================================== */
'use strict';

const PAD = '/scriptbundel.js';

/* Alleen gewone paden onder de eigen root: geen spaties, geen dubbele punten,
   geen .., en niet //ergens-anders (dat is voor een browser een VOLLEDIG adres
   bij een vreemde server, terwijl het met een schuine streep begint). Zelfde
   val als bij de stijlbundel, daar gevonden door een toets en niet door te
   kijken; hier meteen dichtgezet. */
const GOED_PAD = /^\/(?!\/)[A-Za-z0-9_\-/.]+\.js$/;

const codeer = (paden) => Buffer.from(paden.join('\n'), 'utf8').toString('base64url');
const decodeer = (s) => {
  try { return Buffer.from(String(s || ''), 'base64url').toString('utf8').split('\n').filter(Boolean); }
  catch (e) { return []; }
};

const SCRIPT = /<script\b[^>]*><\/script>/gi;
// tussen twee scripts mag alleen lucht en commentaar staan
const TUSSEN_OK = /^(?:\s|<!--[\s\S]*?-->)*$/;

/* Is dit een script dat mee mag? Alleen src, alleen defer, verder niets: een
   type, een nonce-vrije module, een async of een integriteitscontrole hangt
   gedrag aan dat samenvoegen zou veranderen. */
function bruikbaar(tag) {
  if (!/\bdefer\b/i.test(tag)) return null;
  if (/\basync\b/i.test(tag)) return null;
  if (/\btype\s*=/i.test(tag)) return null;
  if (/\bintegrity\s*=/i.test(tag)) return null;
  const m = /\bsrc\s*=\s*"([^"]+)"/i.exec(tag);
  if (!m || !GOED_PAD.test(m[1])) return null;
  return m[1];
}

function herschrijfHtml(html) {
  const scripts = [];
  SCRIPT.lastIndex = 0;
  let m;
  while ((m = SCRIPT.exec(html))) {
    const pad = bruikbaar(m[0]);
    scripts.push({ start: m.index, eind: m.index + m[0].length, pad });
  }

  // opeenvolgende bruikbare scripts groeperen tot rijen
  const rijen = [];
  let rij = [];
  for (let i = 0; i < scripts.length; i++) {
    const s = scripts[i];
    if (!s.pad) { if (rij.length > 1) rijen.push(rij); rij = []; continue; }
    if (rij.length) {
      const tussen = html.slice(rij[rij.length - 1].eind, s.start);
      if (!TUSSEN_OK.test(tussen)) { if (rij.length > 1) rijen.push(rij); rij = []; }
    }
    rij.push(s);
  }
  if (rij.length > 1) rijen.push(rij);
  if (!rijen.length) return html;

  // van achter naar voren vervangen, zodat de posities blijven kloppen
  let uit = html;
  for (let i = rijen.length - 1; i >= 0; i--) {
    const r = rijen[i];
    const verwijzing = '<script src="' + PAD + '?f=' + codeer(r.map((x) => x.pad)) + '" defer></script>';
    uit = uit.slice(0, r[0].start) + verwijzing + uit.slice(r[r.length - 1].eind);
  }
  return uit;
}

module.exports = { herschrijfHtml, codeer, decodeer, GOED_PAD, PAD, bruikbaar };
