/* ============================================================================
   HET LEERHUIS -- de Authority Bridge.

   BEKWAAM IS NIET BEVOEGD (grondwet 3 en 4). `geschiktheid()` geeft hoogstens
   AUTHORITY_ELIGIBLE en draagt altijd `verleent: false`. De bevoegdheid zelf
   blijft bij de poort van het domein en bij de beleidsmotor
   (kern/beleidsmotor/); dit bestand deelt geen rechten uit. Er is geen tweede
   rechtenmodel naast die twee (CONCERN.md, AUTHORITY.md INT-01).

   Zonder beleid geen geschiktheid (NO_AUTHORITY_WITHOUT_POLICY), en een beleid
   telt pas als een TWEEDE mens het heeft goedgekeurd: wie een beleid voorstelt,
   keurt het niet zelf (grondwet 22, AUTHORITY_REQUESTER is niet de enige
   APPROVER). Elke eis staat in de opbouw, ook de eisen die slaagden.
   ========================================================================== */
'use strict';

const { verversen, blokkeert, certStand, certTelt, relatieActief, ms } = require('./oordeel');

function geschiktheid(st, persoon, handeling, nu) {
  const opbouw = [];
  const eis = (naam, ok, waarom) => { opbouw.push({ eis: naam, ok: !!ok, waarom }); return !!ok; };
  const uit = (ok, b) => ({ uitkomst: ok ? 'AUTHORITY_ELIGIBLE' : 'NOT_ELIGIBLE', handeling, persoon,
    beleid: b ? b.id : null, opbouw, verleent: false,
    let: 'Geschiktheid is geen bevoegdheid: de poort van het domein beslist, met dit oordeel als een van zijn feiten.' });

  const b = Object.values(st.beleid).find(x => x.handeling === handeling);
  if (!eis('beleid', b, b ? 'beleid ' + b.id : 'er is geen beleid voor ' + handeling + '; zonder beleid geen geschiktheid')) return uit(false, null);
  if (!eis('beleid-goedgekeurd', b.goedgekeurd, b.goedgekeurd ? 'goedgekeurd door ' + b.goedgekeurd.door : 'nog niet door een tweede mens goedgekeurd')) return uit(false, b);
  const herzien = st.impacts.filter(im => im.klasse === 'AUTHORITY_REVIEW_REQUIRED'
    && (im.vaardigheden || []).some(v => (b.vaardigheden || []).includes(v)) && ms(im.at) > ms(b.herzien));
  eis('beleid-actueel', !herzien.length, herzien.length ? 'kennis ' + herzien[0].kennis + ' vraagt een herziening van dit beleid' : 'geen openstaande herziening');
  eis('relatie', relatieActief(st, persoon), relatieActief(st, persoon) ? 'lopende relatie' : 'geen lopende relatie met deze organisatie');
  const p = st.personen[persoon] || { rollen: [], bewezen: {} };
  if (b.rol) eis('rol', p.rollen.includes(b.rol), p.rollen.includes(b.rol) ? 'draagt rol ' + b.rol : 'draagt rol ' + b.rol + ' niet');
  const open = verversen(st, persoon, nu).filter(blokkeert);
  for (const v of b.vaardigheden || []) {
    const bew = p.bewezen[v];
    if (!eis('bewezen:' + v, bew, bew ? 'bewezen in beoordeling ' + bew.beoordeling : v + ' is niet bewezen')) continue;
    const o = open.find(x => x.vaardigheid === v);
    eis('actueel:' + v, !o, o ? o.waarom : 'geen verversing nodig');
    if (b.certificaat) {
      const c = Object.values(st.certificaten).find(x => x.persoon === persoon && (x.vaardigheden || []).includes(v) && certTelt(certStand(st, x, nu).stand));
      eis('certificaat:' + v, c, c ? 'certificaat ' + c.id : 'geen geldig certificaat voor ' + v);
    }
  }
  return uit(opbouw.every(x => x.ok), b);
}

module.exports = { geschiktheid };
