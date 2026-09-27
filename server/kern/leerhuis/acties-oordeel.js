/* ============================================================================
   HET LEERHUIS -- bewijs, simulatie en beoordeling.

   WIE MAG WELK BEWIJS ZETTEN. De sterkte van een stuk volgt uit WIE het
   schrijft, niet uit wat de aanvrager zegt (de regel van CONNECT.md: een trede
   die je zelf kunt zetten, bewijst niets over een ander):
     SELF_REPORTED    de mens zelf, en dat is ook het hoogste wat hij zelf haalt
     DOCUMENTED       een geldige trainer of een assessor die een stuk zag
     OBSERVED         een geldige trainer of assessor die het zag gebeuren
     ASSESSED         alleen een assessor, binnen een beoordeling
     SYSTEM_VERIFIED  alleen de simulatiemotor, uit vaste regels
   Een stuk dat iemand over zichzelf sterker zet dan SELF_REPORTED, wordt
   geweigerd (forged evidence).

   De simulatie staat in ./acties-simulatie.js.
   ========================================================================== */
'use strict';

const { overgang, BEWIJSSOORTEN, STERKTE } = require('./standen');
const { relatieActief, heeftBestuur, trainerGeldig, bewijsVoldoet } = require('./oordeel');
const { weiger, eisPersoon, eisBestuur, eisNiet, eisOrg, kennisNu, eigenId } = require('./hulp');

const curriculaMet = (st, v) => Object.values(st.curricula).filter(c => c.vaardigheden.includes(v)).map(c => c.id);
const isTrainerVoor = (st, door, v) => curriculaMet(st, v).some(c => trainerGeldig(st, door, c).ok);
const tekst = (x, n) => String(x == null ? '' : x).slice(0, n || 300);

function magSterkte(st, door, persoon, v, sterkte) {
  if (door === persoon) return sterkte === 'SELF_REPORTED';
  if (sterkte === 'SYSTEM_VERIFIED') return false;
  if (sterkte === 'ASSESSED') return heeftBestuur(st, door, 'ASSESSOR');
  if (sterkte === 'SELF_REPORTED') return false;
  return isTrainerVoor(st, door, v) || heeftBestuur(st, door, 'ASSESSOR');
}

module.exports = {
  bewijsVastleggen(st, i, door, ctx) {
    eisOrg(st);
    const p = eisPersoon(i.persoon);
    if (!relatieActief(st, p)) weiger(p + ' heeft geen lopende relatie met ' + st.org.id, 409);
    if (!st.vaardigheden[i.vaardigheid]) weiger('vaardigheid bestaat niet in deze organisatie', 404);
    if (!BEWIJSSOORTEN.includes(i.soort)) weiger('bewijssoort: ' + BEWIJSSOORTEN.join(', '), 400);
    if (!STERKTE.includes(i.sterkte)) weiger('sterkte: ' + STERKTE.join(', '), 400);
    if (!magSterkte(st, door, p, i.vaardigheid, i.sterkte))
      weiger(door + ' kan geen ' + i.sterkte + '-bewijs over ' + (door === p ? 'zichzelf' : p) + ' vastleggen voor ' + i.vaardigheid, 403);
    return [{ soort: 'bewijs', data: { id: eigenId(st.bewijs, i.id, ctx), persoon: p, vaardigheid: i.vaardigheid, soort: i.soort,
      sterkte: i.sterkte, bron: tekst(i.bron, 200), notitie: tekst(i.notitie, 600), kennis: kennisNu(st, i.vaardigheid) } }];
  },

  bewijsIntrekken(st, i, door) {
    eisBestuur(st, door, ['QUALITY_AUTHORITY', 'ASSESSMENT_AUTHORITY'], 'bewijs intrekken');
    const b = st.bewijs[i.id]; if (!b) weiger('bewijs bestaat niet in deze organisatie', 404);
    if (b.ongeldig) weiger('dit bewijs is al ingetrokken', 409);
    if (!i.reden) weiger('intrekken zonder reden bestaat niet', 400);
    return [{ soort: 'bewijsOngeldig', data: { id: b.id, reden: tekst(i.reden) } }];
  },

  beoordelingAanvragen(st, i, door, ctx) {
    eisOrg(st);
    const p = eisPersoon(i.persoon);
    const l = st.personen[p] || { leren: {} };
    const trainer = Object.values(l.leren).some(x => x.trainer === door);
    const manager = st.relaties[p] && st.relaties[p].manager === door;
    if (door !== p && !trainer && !manager) weiger('een beoordeling vraagt de leerling, zijn trainer of zijn manager aan', 403);
    if (!st.vaardigheden[i.vaardigheid]) weiger('vaardigheid bestaat niet', 404);
    if (Object.values(st.beoordelingen).some(b => b.persoon === p && b.vaardigheid === i.vaardigheid && ['REQUESTED', 'ASSESSING'].includes(b.stand)))
      weiger('er loopt al een beoordeling voor deze vaardigheid', 409);
    if (!Object.values(st.bewijs).some(b => b.persoon === p && b.vaardigheid === i.vaardigheid && !b.ongeldig))
      weiger('zonder bewijs is er niets te beoordelen', 409, 'oefen, simuleer of werk onder toezicht');
    const id = eigenId(st.beoordelingen, i.id, ctx);
    const uit = [{ soort: 'beoordeling', data: { id, persoon: p, vaardigheid: i.vaardigheid, vorm: tekst(i.vorm || 'practical task', 40) } }];
    for (const [c, x] of Object.entries(l.leren || {}))
      if (x.stand === 'READY_FOR_ASSESSMENT' && st.curricula[c].vaardigheden.includes(i.vaardigheid))
        uit.push({ soort: 'lerenStand', data: { persoon: p, curriculum: c, naar: 'ASSESSING' } });
    return uit;
  },

  /* Een assessor moet bevoegd zijn, in deze organisatie, en mag de kandidaat,
     zijn trainer (bij kritieke vaardigheden) of zijn manager niet zijn. */
  beoordelingStart(st, i, door) {
    eisBestuur(st, door, ['ASSESSOR'], 'beoordelen');
    const b = st.beoordelingen[i.id]; if (!b) weiger('beoordeling bestaat niet in deze organisatie', 404);
    const o = overgang('beoordeling', b.stand, 'ASSESSING'); if (!o.ok) weiger(o.reden, 409);
    eisNiet(door, b.persoon, 'niemand beoordeelt zichzelf');
    const v = st.vaardigheden[b.vaardigheid];
    const p = st.personen[b.persoon] || { leren: {} };
    if (v.kritiek && Object.values(p.leren).some(l => l.trainer === door))
      weiger('bij een kritieke vaardigheid is de trainer niet de beoordelaar', 403, 'laat een onafhankelijke assessor beoordelen');
    if (st.relaties[b.persoon] && st.relaties[b.persoon].manager === door) weiger('een manager beoordeelt zijn eigen medewerker niet', 403);
    return [{ soort: 'beoordelingStand', data: { id: b.id, naar: 'ASSESSING' } }];
  },

  beoordelingAfronden(st, i, door, ctx) {
    eisOrg(st);
    const b = st.beoordelingen[i.id]; if (!b) weiger('beoordeling bestaat niet in deze organisatie', 404);
    if (b.assessor !== door) weiger('alleen de assessor die begon, rondt af', 403);
    if (!heeftBestuur(st, door, 'ASSESSOR') || !relatieActief(st, door)) weiger('de assessor is niet (meer) bevoegd', 403);
    const o = overgang('beoordeling', b.stand, i.uitkomst); if (!o.ok) weiger(o.reden, 409);
    const uit = [];
    let herstel = null;
    if (i.uitkomst === 'PROVEN') {
      const toets = bewijsVoldoet(st, i.bewijs, b.persoon, b.vaardigheid, ctx.nu());
      if (!toets.ok) weiger('dit bewijs draagt geen PROVEN: ' + toets.redenen.join('; '), 409);
      if (!i.criteria) weiger('een PROVEN noemt de criteria waartegen is beoordeeld', 400);
    } else if (i.uitkomst === 'NOT_YET_PROVEN') {
      herstel = tekst(i.herstel, 600) || bewijsVoldoet(st, i.bewijs, b.persoon, b.vaardigheid, ctx.nu()).redenen.join('; ') || 'opnieuw oefenen onder toezicht';
    }
    uit.push({ soort: 'beoordelingStand', data: { id: b.id, naar: i.uitkomst, bewijs: i.bewijs || [], criteria: tekst(i.criteria, 600),
      herstel, kennis: kennisNu(st, b.vaardigheid) } });
    if (i.uitkomst === 'PROVEN') uit.push({ soort: 'bewijs', data: { id: ctx.id(), persoon: b.persoon, vaardigheid: b.vaardigheid,
      soort: 'ASSESSMENT_EVIDENCE', sterkte: 'ASSESSED', bron: 'beoordeling ' + b.id, notitie: tekst(i.criteria), kennis: kennisNu(st, b.vaardigheid) } });
    const p = st.personen[b.persoon] || { leren: {}, bewezen: {} };
    for (const [c, l] of Object.entries(p.leren)) {
      if (l.stand !== 'ASSESSING' || !st.curricula[c].vaardigheden.includes(b.vaardigheid)) continue;
      if (i.uitkomst === 'NOT_YET_PROVEN') uit.push({ soort: 'lerenStand', data: { persoon: b.persoon, curriculum: c, naar: 'NOT_YET_PROVEN' } });
      if (i.uitkomst === 'PROVEN' && st.curricula[c].vaardigheden.every(v => v === b.vaardigheid || p.bewezen[v]))
        uit.push({ soort: 'lerenStand', data: { persoon: b.persoon, curriculum: c, naar: 'PROVEN' } });
    }
    return uit;
  },

  beoordelingOngeldig(st, i, door) {
    eisBestuur(st, door, ['QUALITY_AUTHORITY'], 'een beoordeling ongeldig verklaren');
    const b = st.beoordelingen[i.id]; if (!b) weiger('beoordeling bestaat niet', 404);
    eisNiet(door, b.assessor, 'een assessor verklaart zijn eigen oordeel niet ongeldig; dat doet een ander');
    const o = overgang('beoordeling', b.stand, 'INVALIDATED'); if (!o.ok) weiger(o.reden, 409);
    if (!i.reden) weiger('ongeldig zonder reden bestaat niet', 400);
    return [{ soort: 'beoordelingStand', data: { id: b.id, naar: 'INVALIDATED', reden: tekst(i.reden) } }];
  }
};
