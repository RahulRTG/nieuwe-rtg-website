/* VRIJHEID: UW VERJAARDAG -- geen aanvraag, maar een dag die al van u is.

   Grondregel: op uw verjaardag werkt u bij RTG in beginsel niet. Er is dus
   geen formulier "verlof aanvragen voor mijn verjaardag"; RTG ziet de dag
   aankomen en plant hem vrij, ruim vooraf, zodat een verjaardag nooit pas 24
   uur van tevoren een bezettingsprobleem wordt. En hij kost niets van het
   vakantiesaldo (BIRTHDAY_LEAVE heeft geen teller, categorieen.js).

   DATAMINIMALISATIE. Voor een verjaardag is dag en maand genoeg. Deze module
   krijgt `verjaardag: 'MM-DD'` en nooit een volledige geboortedatum; het
   geboortejaar is een leeftijdsgegeven dat voor vrij zijn niet nodig is.

   WAT NIET IS BESLOTEN, blijft open. Een verjaardag in het weekend, op een
   feestdag, op een dag dat een parttimer niet werkt, op 29 februari in een
   gewoon jaar, en welke dienst vrij is als een nachtdienst over middernacht
   loopt: dat zijn arbeidsvoorwaardenbesluiten (beleid.js). Zolang ze open
   staan, wordt zo'n verjaardag NEEDS_REVIEW met de reden -- en niet stil
   geschrapt of stil verschoven.

   Wat RTG er NIET mee doet: de dag tonen aan collega's als "verjaardag". Het
   team ziet hooguit dat iemand vrij is. */
'use strict';
const T = require('./tijd');
const D = require('./dekking');

const isSchrikkel = (j) => (j % 4 === 0 && j % 100 !== 0) || j % 400 === 0;

function verjaardagsDatum(mens, jaar, beleid) {
  const mmdd = String(mens.verjaardag || '');
  if (!mmdd) return { geen: true, reden: 'Er is geen verjaardag vastgelegd; die geeft u zelf op als u dat wilt.' };
  if (!/^\d{2}-\d{2}$/.test(mmdd)) return { open: true, reden: 'Ongeldige verjaardag.' };
  if (mmdd === '02-29' && !isSchrikkel(jaar)) {
    const k = beleid.waarde('verjaardag.schrikkeldag');
    if (k.open) return { open: true, reden: k.reden };
    return { datum: jaar + (k.waarde === '1-maart' ? '-03-01' : '-02-28') };
  }
  const datum = jaar + '-' + mmdd;
  return T.isDatum(datum) && !Number.isNaN(Date.parse(datum)) ? { datum } : { open: true, reden: 'Ongeldige verjaardag.' };
}

/* De dienst(en) die de verjaardag raken: begint op de dag, of loopt erin door. */
function dienstenOp(team, persoon, datum) {
  const dag = { van: T.punt(datum, '00:00'), tot: T.punt(datum, '00:00') + T.DAG };
  return (team.diensten || []).filter(d => d.persoon === persoon).map(d => ({ d, iv: T.interval(d) }))
    .filter(x => x.iv && T.overlapt(x.iv, dag))
    .map(x => ({ ...x, binnen: Math.min(x.iv.tot, dag.tot) - Math.max(x.iv.van, dag.van) }));
}

function plan(team, mens, jaar, beleid) {
  const basis = { persoon: mens.id, jaar };
  const dag = verjaardagsDatum(mens, jaar, beleid);
  if (dag.geen) return { ...basis, stand: 'NOT_APPLICABLE', uitleg: dag.reden };
  if (dag.open) return { ...basis, stand: 'NEEDS_REVIEW', uitleg: dag.reden };
  const verjaardag = dag.datum;
  if (!D.inDienst(mens, verjaardag))
    return { ...basis, verjaardag, stand: 'NOT_APPLICABLE', uitleg: 'Op ' + verjaardag + ' bent u (nog) niet in dienst.' };

  let raak = dienstenOp(team, mens.id, verjaardag);
  if (raak.length > 1) {
    const k = beleid.waarde('verjaardag.nachtdienst');
    if (k.open) return { ...basis, verjaardag, stand: 'NEEDS_REVIEW', uitleg: k.reden };
    raak = k.waarde === 'dienst-die-begint'
      ? raak.filter(x => x.d.datum === verjaardag).slice(0, 1)
      : raak.sort((a, b) => b.binnen - a.binnen).slice(0, 1);
  }
  if (raak.length === 1)
    return { ...basis, verjaardag, datum: raak[0].d.datum, stand: 'ELIGIBILITY_CONFIRMED',
      afwezigheid: { persoon: mens.id, van: raak[0].iv.van, tot: raak[0].iv.tot }, uren: T.uren(raak[0].iv),
      uitleg: 'Uw dienst op uw verjaardag is vrij. Uw normale verlofsaldo verandert niet.' };

  /* Geen dienst op de dag zelf: welke regel geldt er? */
  const feest = (team.feestdagen || []).includes(verjaardag);
  const wd = T.weekdag(verjaardag);
  const pad = feest ? 'verjaardag.feestdag' : (wd === 0 || wd === 6) ? 'verjaardag.weekend' : 'verjaardag.geenWerkdag';
  const k = beleid.waarde(pad);
  if (k.open) return { ...basis, verjaardag, stand: 'NEEDS_REVIEW', uitleg: 'U bent op uw verjaardag al vrij. ' + k.reden };
  if (k.waarde === 'vervalt') return { ...basis, verjaardag, stand: 'NOT_APPLICABLE', uitleg: 'Uw verjaardag valt op een dag waarop u al vrij bent.' };
  const stap = k.waarde === 'vorige-werkdag' ? -1 : 1;
  for (let n = 1; n <= 14; n++) {
    const datum = T.plusDagen(verjaardag, stap * n);
    const d = (team.diensten || []).find(x => x.persoon === mens.id && x.datum === datum && T.interval(x));
    if (!d) continue;
    if (!D.inDienst(mens, datum)) break;
    const iv = T.interval(d);
    return { ...basis, verjaardag, datum, stand: 'ELIGIBILITY_CONFIRMED', afwezigheid: { persoon: mens.id, van: iv.van, tot: iv.tot }, uren: T.uren(iv),
      uitleg: 'Uw verjaardag valt op een vrije dag; volgens beleid bent u op ' + datum + ' vrij. Uw normale verlofsaldo verandert niet.' };
  }
  return { ...basis, verjaardag, stand: 'NEEDS_REVIEW', uitleg: 'Er staat binnen twee weken geen dienst in het rooster om naar te verschuiven.' };
}

module.exports = { plan, verjaardagsDatum };
