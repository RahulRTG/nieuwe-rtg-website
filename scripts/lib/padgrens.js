/* ============================================================================
   EEN VOORVOEGSEL DEKT EEN PAD -- op een PADgrens en niet op een woordgrens.

   `'/api/ikea/bestel'.startsWith('/api/ik')` is waar, en dat is precies de
   fout die deze twee regels voorkomen: dan zou een routetabel voor /api/ik
   stilletjes een ander domein opeisen. Er zijn inmiddels twee registers die
   op voorvoegsels routeren (./accountroutes.js en ./persoonsroutes.js) en er
   komen er meer; een tweede kopie van deze twee regels loopt uiteen zonder
   dat iemand het merkt (LAT.md regel 4). */
'use strict';

function dekt(pad, voorvoegsel) {
  const p = String(pad || '');
  const v = String(voorvoegsel || '');
  if (!v) return false;
  if (p === v) return true;
  return p.startsWith(v.endsWith('/') ? v : v + '/');
}

/* Ligt het ene voorvoegsel BINNEN het andere -- twee registers die hetzelfde
   domein opeisen zijn niet meer uit elkaar te houden. */
const ligtBinnen = (a, b) => a !== b && dekt(a, b);

module.exports = { dekt, ligtBinnen };
