/* ============================================================================
   HET LEERHUIS -- oefenen en simuleren.

   NARRATIEF IS GEEN OORDEEL (NARRATIVE GENERATION is geen ASSESSMENT TRUTH).
   Een simulatie mag verhalend worden aangekleed, later ook door een model, maar
   de uitslag komt uit het scenario: vereiste stappen, verboden stappen,
   volgorde. Een model beslist hier niets, en daarom mag alleen deze motor
   bewijs van sterkte SYSTEM_VERIFIED zetten.

   Een mislukte poging laat GEEN bewijs achter: oefenen is zonder gevolgen
   (de opdracht, par. 11), en een dossier vol mislukkingen is een
   gedragslogboek en geen leerdossier.
   ========================================================================== */
'use strict';

const { relatieActief } = require('./oordeel');
const { weiger, eisId, eisBestuur, eisOrg, kennisNu } = require('./hulp');

const tekst = (x, n) => String(x == null ? '' : x).slice(0, n || 300);

module.exports = {
  scenarioZet(st, i, door) {
    eisBestuur(st, door, ['CURRICULUM_OWNER'], 'een simulatiescenario vastleggen');
    eisId(i.id, 'scenario');
    for (const v of i.vaardigheden || []) if (!st.vaardigheden[v]) weiger('vaardigheid ' + v + ' bestaat niet', 404);
    if (!(i.vereist || []).length) weiger('een scenario zonder vereiste stap meet niets', 400);
    return [{ soort: 'scenario', data: { id: i.id, domein: tekst(i.domein, 60), vaardigheden: i.vaardigheden || [],
      moeilijkheid: tekst(i.moeilijkheid || 'normaal', 20), begin: tekst(i.begin, 600), vereist: (i.vereist || []).map(String),
      verboden: (i.verboden || []).map(String), volgorde: !!i.volgorde, veiligheid: tekst(i.veiligheid, 300) } }];
  },

  /* De leerling speelt; de motor oordeelt uit het scenario. */
  simulatieAfronden(st, i, door, ctx) {
    eisOrg(st);
    const s = st.scenarios[i.scenario]; if (!s) weiger('scenario bestaat niet', 404);
    if (!relatieActief(st, door)) weiger('alleen wie hier een relatie heeft, oefent hier', 403);
    const k = (i.keuzes || []).map(String);
    const fout = k.filter(x => s.verboden.includes(x));
    const mist = s.vereist.filter(x => !k.includes(x));
    const orde = !s.volgorde || s.vereist.every((x, n) => n === 0 || k.indexOf(x) > k.indexOf(s.vereist[n - 1]));
    const geslaagd = !fout.length && !mist.length && orde;
    const uitslag = { geslaagd, verboden: fout, ontbreekt: mist, volgorde: orde };
    if (!geslaagd) return { gebeurtenissen: [], uit: { uitslag, herstel: 'oefen opnieuw; niets hiervan komt in je dossier als bewijs' } };
    return s.vaardigheden.map(v => ({ soort: 'bewijs', door: 'systeem:simulatie', data: { id: ctx.id(), persoon: door,
      vaardigheid: v, soort: 'SIMULATION_EVIDENCE', sterkte: 'SYSTEM_VERIFIED', bron: 'scenario ' + s.id,
      notitie: 'alle vereiste stappen, geen verboden stap', kennis: kennisNu(st, v) } }));
  }
};
