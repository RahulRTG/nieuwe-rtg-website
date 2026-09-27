/* ============================================================================
   HET LEERHUIS -- het Personal Start Plan, zonder opslag.

   Het plan wordt AFGELEID uit wat er al vaststaat: de rol, de relatie, de
   manager, wat iemand al bewezen heeft en welke curricula en trainers er
   werkelijk zijn. Er staat niets in dat niemand kan waarmaken: ontbreekt een
   curriculum of een trainer met ruimte, dan staat dat er als capaciteitsprobleem
   bij en niet als een lege regel (de opdracht, par. 8).

   Day Zero is rustig: wie je bent hier, wie je ontvangt, wat de eerste dag
   brengt. Geen informatiestort. De eerste dag bevat een veilige, echte eerste
   winst: een oefening zonder productiegevolgen, niet alleen lezen.

   Wat iemand al bewezen heeft, hoeft hij niet opnieuw te leren. Bewijs uit een
   ANDERE organisatie telt hier niet vanzelf: dat loopt via EVC.
   ========================================================================== */
'use strict';

const { trainerGeldig } = require('./oordeel');

const MAX_LEERLINGEN = 8;

function leerlingenVan(st, trainer) {
  let n = 0;
  for (const p of Object.values(st.personen))
    for (const l of Object.values(p.leren)) if (l.trainer === trainer && !['PROVEN', 'CERTIFIED', 'AUTHORITY_ELIGIBLE', 'PRACTICING_IN_ROLE'].includes(l.stand)) n++;
  return n;
}

/* Een trainer met ruimte, en bij gelijke geschiktheid de trainer met de minste
   leerlingen: we sorteren op wat iemand TOEKOMT (rust), nooit op wie "beter" is. */
function kiesTrainer(st, curriculumId, behalve) {
  return Object.keys(st.trainers)
    .filter(k => k !== behalve && trainerGeldig(st, k, curriculumId).ok && leerlingenVan(st, k) < MAX_LEERLINGEN)
    .sort((a, b) => leerlingenVan(st, a) - leerlingenVan(st, b) || (a < b ? -1 : 1))[0] || null;
}

function startplan(st, persoon, rolId, opties) {
  const o = opties || {};
  const rol = st.rollen[rolId];
  const rel = st.relaties[persoon] || {};
  const p = st.personen[persoon] || { bewezen: {}, leren: {} };
  const nodig = (rol ? rol.vaardigheden : []).filter(v => !p.bewezen[v]);
  const actief = Object.values(st.curricula).filter(c => c.stand === 'ACTIVE' || c.stand === 'MONITORED')
    .sort((a, b) => (a.id < b.id ? -1 : 1));
  const gekozen = []; const gedekt = new Set(); const capaciteit = [];
  for (const v of nodig) {
    if (gedekt.has(v)) continue;
    const c = actief.find(x => x.vaardigheden.includes(v));
    if (!c) { capaciteit.push({ soort: 'geen-curriculum', vaardigheid: v, waarom: 'er is geen actief curriculum dat ' + v + ' leert' }); continue; }
    c.vaardigheden.forEach(x => gedekt.add(x));
    const trainer = kiesTrainer(st, c.id, persoon);
    if (!trainer) capaciteit.push({ soort: 'geen-trainer', curriculum: c.id, waarom: 'geen geldige trainer met ruimte voor ' + c.id });
    gekozen.push({ curriculum: c.id, versie: c.versie, trainer,
      reden: 'rol ' + rolId + ' vraagt ' + c.vaardigheden.filter(x => nodig.includes(x)).join(', ') });
  }
  const fase = (c, namen) => (st.curricula[c.curriculum].fasen || []).filter(f => namen.includes(f.fase))
    .map(f => ({ curriculum: c.curriculum, fase: f.fase, wat: f.wat }));
  const eerste = gekozen[0];
  const mijlpalen = Object.values(st.beleid).filter(b => rol && (b.vaardigheden || []).every(v => rol.vaardigheden.includes(v)))
    .map(b => ({ handeling: b.handeling, beleid: b.id, waarom: 'mogelijk na bewijs van ' + b.vaardigheden.join(', ') + '; bevoegdheid blijft een apart besluit' }));
  return {
    persoon, rol: rolId, rolVersie: rol ? rol.versie : null, organisatie: st.org && st.org.id,
    startdatum: o.startdatum || null,
    reedsBewezen: (rol ? rol.vaardigheden : []).filter(v => p.bewezen[v]),
    fasen: {
      PREBOARDING: [{ wat: 'relatie vastgelegd (' + (rel.soort || 'onbekend') + ')' }, { wat: 'minimale toegang: alleen wat de eerste dag vraagt' }],
      DAY_ZERO: [{ wat: 'welkom bij ' + (st.org ? st.org.naam : '') }, { wat: 'jouw rol: ' + (rol ? rol.titel : rolId) },
        { wat: 'je manager: ' + (rel.manager || 'nog niet bekend') }, { wat: 'je buddy: ' + (o.buddy || 'nog niet bekend') }],
      DAY_ONE: eerste ? [{ wat: 'eerste veilige oefening, zonder gevolgen in productie', ...fase(eerste, ['PRACTICE'])[0] }] : [],
      FIRST_WEEK: gekozen.flatMap(c => fase(c, ['UNDERSTAND', 'OBSERVE'])),
      DAY_30: gekozen.flatMap(c => fase(c, ['PRACTICE', 'SIMULATE'])),
      DAY_60: gekozen.flatMap(c => fase(c, ['SUPERVISED_WORK'])),
      DAY_90: gekozen.flatMap(c => fase(c, ['PROVE', 'CERTIFY']))
    },
    leren: gekozen, buddy: o.buddy || null, mijlpalen, capaciteit
  };
}

module.exports = { startplan, kiesTrainer, leerlingenVan, MAX_LEERLINGEN };
