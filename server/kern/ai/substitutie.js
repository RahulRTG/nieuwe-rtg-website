/* HET INTELLIGENCE SUBSTITUTION PROTOCOL -- bewijzen dat een eenvoudiger
   techniek een begrensde AI-taak kan overnemen.

   Dit protocol routeert niets en activeert niets. Het beoordeelt uitsluitend
   tellers uit de bestaande routerschaduw. Zelfs de beste uitkomst heet daarom
   KLAAR_VOOR_BESLUIT: versiebeheer, toetsen en menselijke goedkeuring blijven
   nodig. Overeenstemming met het model telt niet als oracle; de teller moet
   expliciet zeggen dat de vergelijking onafhankelijk was. */
'use strict';

const EISEN = Object.freeze({ minOracle: 200, minDagen: 7, minJuistPct: 100, maxVeiligheidsfouten: 0 });
const STANDEN = Object.freeze(['NIET_BEPROEFD', 'ONBRUIKBAAR_BEWIJS', 'AFGEWEZEN', 'SCHADUW', 'KLAAR_VOOR_BESLUIT']);

function pct(deel, totaal) { return totaal ? Math.round(1000 * deel / totaal) / 10 : null; }

function teller(v) {
  const n = Number(v || 0);
  return Number.isFinite(n) && n >= 0 && Number.isInteger(n) ? n : null;
}

function beoordeel(vak, opties) {
  const v = vak || {};
  const o = opties || {};
  const eisen = Object.assign({}, EISEN, o.eisen || {});
  const waarden = [v.oracleBeproefd, v.oracleOnafhankelijk, v.juist, v.onjuist,
    v.afgezien, v.veiligheidsfout].map(teller);
  const [oracle, onafhankelijk, juist, onjuist, afgezien, veiligheidsfouten] = waarden;
  if (waarden.some(x => x === null)) return { stand: 'ONBRUIKBAAR_BEWIJS',
    bewijs: null, reden: 'de correctheidstelling bevat een negatief, gebroken of niet-geheel getal.',
    activeert: false };
  const behandeld = juist + onjuist;
  const juistPct = pct(juist, behandeld);
  const dekkingPct = pct(behandeld, oracle);
  const bewijs = { oracle, onafhankelijk, juist, onjuist, afgezien, veiligheidsfouten,
    juistPct, dekkingPct, dagen: Number(o.dagen || 0) };

  if (veiligheidsfouten > eisen.maxVeiligheidsfouten) return { stand: 'AFGEWEZEN', bewijs,
    reden: veiligheidsfouten + ' veiligheidsfout(en) overschrijden de harde grens van ' + eisen.maxVeiligheidsfouten + '.',
    activeert: false };
  if (!oracle) return { stand: 'NIET_BEPROEFD', bewijs,
    reden: 'er is geen onafhankelijke juiste uitkomst gemeten. Dekking of overeenstemming met Rahul is geen correctheidsbewijs.',
    activeert: false };
  if (onafhankelijk !== oracle || juist + onjuist + afgezien !== oracle) return {
    stand: 'ONBRUIKBAAR_BEWIJS', bewijs,
    reden: onafhankelijk !== oracle
      ? 'niet elke vergelijking kwam van een onafhankelijke oracle; een model mag niet zijn eigen vervanging goedkeuren.'
      : 'de uitkomsten juist, onjuist en afgezien sluiten niet exact aan op het aantal oracle-gevallen.',
    activeert: false };
  if (oracle < eisen.minOracle || Number(o.dagen || 0) < eisen.minDagen) return { stand: 'SCHADUW', bewijs,
    reden: 'nog niet rijp: ' + oracle + ' van ' + eisen.minOracle + ' oracle-gevallen en ' +
      Number(o.dagen || 0) + ' van ' + eisen.minDagen + ' dagen.', activeert: false };
  if (!behandeld || juistPct < eisen.minJuistPct) return { stand: 'SCHADUW', bewijs,
    reden: 'de behandelde gevallen halen ' + (juistPct == null ? 'geen gemeten' : juistPct + '%') +
      ' juistheid tegenover de eis van ' + eisen.minJuistPct + '%. Onthouden mag; onjuist overnemen niet.',
    activeert: false };
  return { stand: 'KLAAR_VOOR_BESLUIT', bewijs,
    reden: 'de begrensde deelcategorie haalt de bewijsgrens. Dit is een voorstel voor menselijke ' +
      'promotie onder versiebeheer, geen automatische omschakeling.',
    activeert: false, vereist: ['menselijke goedkeuring', 'versiegebonden wijziging', 'terugval naar Rahul', 'rollback'] };
}

module.exports = { beoordeel, EISEN, STANDEN };
