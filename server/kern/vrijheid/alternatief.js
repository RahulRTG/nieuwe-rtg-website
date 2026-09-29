/* VRIJHEID: DE AFWEZIGHEID EN DE ALTERNATIEVEN van een verzoek (deel van
   besluit.js, apart gezet voor de 10 kB-grens). ALTERNATIVE BEFORE DECLINE:
   later weg, een andere dag, of een gekwalificeerde collega die vrijwillig wil
   dekken -- dat laatste is een mogelijkheid en nooit een opdracht. */
'use strict';
const T = require('./tijd');
const D = require('./dekking');

const dienstOp = (team, persoon, datum) => (team.diensten || []).find(d => d.persoon === persoon && d.datum === datum && T.interval(d));

/* De afwezigheid die dit verzoek zou veroorzaken, in absolute minuten. */
function afwezigheidVan(team, v) {
  const d = dienstOp(team, v.persoon, v.datum);
  if (!d) return null;
  const iv = T.interval(d);
  if (v.soort === 'EERDER_WEG') { const van = T.punt(v.datum, v.vanaf); return van > iv.van && van < iv.tot ? { persoon: v.persoon, van, tot: iv.tot } : null; }
  if (v.soort === 'LATER_BEGINNEN') { let tot = T.punt(v.datum, v.tot); if (tot <= iv.van) tot += T.DAG; return tot > iv.van && tot < iv.tot ? { persoon: v.persoon, van: iv.van, tot } : null; }
  return { persoon: v.persoon, van: iv.van, tot: iv.tot };
}

function alternatieven(team, v, afwezig, grenzen) {
  const uit = [];
  const d = dienstOp(team, v.persoon, v.datum);
  if (v.soort === 'EERDER_WEG' && d) {
    const eind = T.interval(d).tot;
    for (let t = T.punt(v.datum, v.vanaf) + 30; t < eind; t += 30) {
      const a = { persoon: v.persoon, van: t, tot: eind };
      if (D.toets(team, a, afwezig).stand === 'SAFE') { uit.push({ soort: 'later-weg', datum: v.datum, vanaf: T.klokVan(t), zin: 'Vertrek om ' + T.klokVan(t) + '.' }); break; }
    }
  }
  for (let n = 1; n <= 7 && uit.filter(a => a.soort === 'andere-dag').length < 2; n++) {
    const datum = T.plusDagen(v.datum, n);
    const alt = afwezigheidVan(team, { ...v, datum });
    if (alt && D.toets(team, alt, afwezig).stand === 'SAFE')
      uit.push({ soort: 'andere-dag', datum, vanaf: v.vanaf || null, zin: 'Op ' + datum + (v.vanaf ? ' om ' + v.vanaf : '') + '.' });
  }
  /* Een collega die NIET is ingepland en de ontbrekende bevoegdheid geldig
     heeft, kan vrijwillig dekken. Dat is een mogelijkheid en nooit een
     opdracht: de naam gaat alleen naar de manager, en zonder instemming
     gebeurt er niets. */
  const codes = grenzen.filter(g => g.ontbreekt !== 'bezetting').map(g => g.ontbreekt);
  const ingepland = new Set((team.diensten || []).filter(x => x.datum === v.datum).map(x => x.persoon));
  const vrijwilligers = (team.mensen || []).filter(m => m.id !== v.persoon && !ingepland.has(m.id) && D.inDienst(m, v.datum) &&
    codes.every(c => D.geldigeKwalificaties(team, m.id, v.datum).codes.has(c))).map(m => m.id);
  if (codes.length && vrijwilligers.length) uit.push({ soort: 'vrijwillige-vervanging', aantal: vrijwilligers.length, namen: vrijwilligers,
    zin: 'Een gekwalificeerde collega kan vrijwillig vervangen, als die daarmee instemt.' });
  return uit;
}

module.exports = { dienstOp, afwezigheidVan, alternatieven };
