/* ============================================================================
   HET LEERHUIS -- de opbouw: organisatie, bestuur, relaties, rollen en
   vaardigheden, en curricula.

   Elke handeling krijgt de projectie `st`, de invoer, de actor `door` (uit de
   sessie, nooit uit het verzoek -- AUTHORITY.md grens 1) en een `ctx` met de
   klok en een id-maker. Hij geeft gebeurtenissen terug of gooit een Weigering;
   hij schrijft zelf niets.
   ========================================================================== */
'use strict';

const { overgang, ORGSOORTEN, BRONSOORTEN, ROLSOORTEN, VAARDIGHEIDSNIVEAUS, STERKTE, LEERBEWIJS, LEERFASEN, BESTUUR, RELATIESOORTEN, DRAAGBAAR, HERCERT } = require('./standen');
const { cyclus } = require('./graaf');
const { relatieActief } = require('./oordeel');
const { weiger, eisPersoon, eisId, eisBestuur, eisNiet } = require('./hulp');

const lijstVan = (x) => (Array.isArray(x) ? x.map(String) : []);
const tekst = (x, n) => String(x == null ? '' : x).slice(0, n || 200);

module.exports = {
  /* Het leerhuis van een organisatie openen. De eerste eigenaar krijgt zijn
     rol in DEZELFDE handeling; dat is de enige plek waar iemand een
     bestuursrol krijgt zonder dat een ander hem benoemt, en de route die dit
     aanroept staat achter een kantoordeur op naam. */
  orgOpen(st, i, door) {
    if (st.org) weiger('deze organisatie heeft al een leerhuis', 409);
    eisId(i.id, 'organisatie');
    if (!ORGSOORTEN.includes(i.soort)) weiger('soort organisatie: ' + ORGSOORTEN.join(', '), 400);
    const eig = eisPersoon(i.eigenaar, 'eigenaar');
    let bron = null;
    if (i.bron) {
      if (!BRONSOORTEN.includes(i.bron.soort)) weiger('soort bron: ' + BRONSOORTEN.join(', '), 400);
      bron = { soort: i.bron.soort, id: eisId(String(i.bron.id || ''), 'bron') };
    }
    return [
      { soort: 'org', data: { id: i.id, soort: i.soort, naam: tekst(i.naam, 120), ouder: i.ouder || null, bron } },
      { soort: 'relatie', data: { persoon: eig, soort: i.relatie || 'EMPLOYEE', actief: true } },
      { soort: 'bestuur', data: { persoon: eig, rol: 'ACADEMY_OWNER', aan: true, door } }
    ];
  },

  /* Niemand benoemt zichzelf (AUTHORITY.md grens 3). */
  bestuurZet(st, i, door) {
    eisBestuur(st, door, ['ACADEMY_OWNER'], 'een bestuursrol toekennen');
    const p = eisPersoon(i.persoon);
    if (!BESTUUR.includes(i.rol)) weiger('bestuursrol: ' + BESTUUR.join(', '), 400);
    eisNiet(p, door, 'niemand benoemt zichzelf, ook de eigenaar niet');
    if (i.aan !== false && !relatieActief(st, p)) weiger(p + ' heeft geen lopende relatie met ' + st.org.id, 409, 'leg eerst de relatie vast');
    return [{ soort: 'bestuur', data: { persoon: p, rol: i.rol, aan: i.aan !== false } }];
  },

  relatieZet(st, i, door) {
    eisBestuur(st, door, ['ACADEMY_OWNER'], 'een relatie vastleggen');
    const p = eisPersoon(i.persoon);
    if (!RELATIESOORTEN.includes(i.soort)) weiger('soort relatie: ' + RELATIESOORTEN.join(', '), 400);
    if (i.manager) eisPersoon(i.manager, 'manager');
    /* Met een bron volgt het leerhuis de bron en niet andersom: een relatie die
       de bron niet draagt, kan niemand hier verklaren (besluit B2). */
    if (i.actief !== false && st.org.bron && typeof st.bronToets === 'function' && st.bronToets(p) !== true)
      weiger(p + ' staat niet in de bron van dit leerhuis (' + st.org.bron.soort + ' ' + st.org.bron.id + ')', 409,
        'leg de relatie vast waar hij woont: een dienstverband, een plek bij de zaak of een zetel');
    if (i.eenheid && !st.eenheden[i.eenheid]) weiger('eenheid ' + i.eenheid + ' bestaat niet in deze organisatie', 404);
    return [{ soort: 'relatie', data: { persoon: p, soort: i.soort, actief: i.actief !== false, eenheid: i.eenheid || null, manager: i.manager || null } }];
  },

  eenheidZet(st, i, door) {
    eisBestuur(st, door, ['ACADEMY_OWNER'], 'de organisatiegraaf wijzigen');
    eisId(i.id, 'eenheid');
    if (!String(i.naam || '').trim()) weiger('een eenheid heeft een naam', 400);
    if (i.ouder && !st.eenheden[i.ouder]) weiger('ouder-eenheid ' + i.ouder + ' bestaat niet', 404);
    /* Een bestaande eenheid onder een van haar eigen onderdelen hangen maakt een kring. */
    for (let o = i.ouder; o; o = (st.eenheden[o] || {}).ouder)
      if (o === i.id) weiger('een eenheid kan niet onder zichzelf of een van haar onderdelen hangen', 409);
    return [{ soort: 'eenheid', data: { id: i.id, soort: tekst(i.soort, 30), naam: tekst(i.naam, 120), ouder: i.ouder || null } }];
  },

  vaardigheidZet(st, i, door) {
    eisBestuur(st, door, ['CURRICULUM_OWNER'], 'een vaardigheid vastleggen');
    eisId(i.id, 'vaardigheid');
    if (!VAARDIGHEIDSNIVEAUS.includes(i.niveau)) weiger('niveau: ' + VAARDIGHEIDSNIVEAUS.join(', '), 400);
    const eis = i.bewijsEis || {};
    const sterkte = eis.sterkte || 'OBSERVED';
    if (!STERKTE.includes(sterkte)) weiger('sterkte: ' + STERKTE.join(', '), 400);
    for (const s of eis.soorten || []) if (!LEERBEWIJS.includes(s)) weiger('bewijssoort: ' + LEERBEWIJS.join(', '), 400);
    /* Een kritieke vaardigheid op eigen verklaring is geen kritieke vaardigheid. */
    if (i.kritiek && STERKTE.indexOf(sterkte) < STERKTE.indexOf('OBSERVED'))
      weiger('een kritieke vaardigheid vraagt minstens OBSERVED bewijs', 400);
    for (const k of lijstVan(i.kennis)) if (!st.kennis[k]) weiger('kennisitem ' + k + ' bestaat niet in deze organisatie', 404);
    if (i.draagbaar && !DRAAGBAAR.includes(i.draagbaar)) weiger('draagbaarheid: ' + DRAAGBAAR.join(', '), 400);
    if (i.hercertificering && !HERCERT.includes(i.hercertificering)) weiger('hercertificering: ' + HERCERT.join(', '), 400);
    return [{ soort: 'vaardigheid', data: { id: i.id, naam: tekst(i.naam, 120), niveau: i.niveau, kritiek: !!i.kritiek,
      bewijsEis: { sterkte, soorten: eis.soorten || [] }, geldigDagen: Number(i.geldigDagen) || null,
      kennis: lijstVan(i.kennis), draagbaar: i.draagbaar || 'ORGANIZATION_SPECIFIC',
      hercertificering: i.hercertificering || 'EVENT_DRIVEN', trainerschap: !!i.trainerschap } }];
  },

  rolZet(st, i, door) {
    eisBestuur(st, door, ['CURRICULUM_OWNER'], 'een rol vastleggen');
    eisId(i.id, 'rol');
    if (!ROLSOORTEN.includes(i.soort)) weiger('soort rol: ' + ROLSOORTEN.join(', '), 400);
    for (const v of lijstVan(i.vaardigheden).concat(lijstVan(i.certificaten)))
      if (!st.vaardigheden[v]) weiger('vaardigheid ' + v + ' bestaat niet in deze organisatie', 404);
    return [{ soort: 'rol', data: { id: i.id, titel: tekst(i.titel, 120), soort: i.soort, doel: tekst(i.doel, 400),
      niveau: i.niveau || null, vaardigheden: lijstVan(i.vaardigheden), certificaten: lijstVan(i.certificaten),
      grenzen: lijstVan(i.grenzen), toezicht: tekst(i.toezicht, 200), voorgangers: lijstVan(i.voorgangers), opvolgers: lijstVan(i.opvolgers) } }];
  },

  curriculumZet(st, i, door) {
    eisBestuur(st, door, ['CURRICULUM_OWNER'], 'een curriculum vastleggen');
    eisId(i.id, 'curriculum');
    const oud = st.curricula[i.id];
    if (oud && !['DRAFT', 'IMPROVEMENT'].includes(oud.stand) && oud.stand !== 'ACTIVE' && oud.stand !== 'MONITORED')
      weiger('curriculum ' + i.id + ' staat op ' + oud.stand + ' en krijgt geen nieuwe versie', 409);
    for (const v of lijstVan(i.vaardigheden)) if (!st.vaardigheden[v]) weiger('vaardigheid ' + v + ' bestaat niet', 404);
    for (const k of lijstVan(i.kennis)) if (!st.kennis[k]) weiger('kennisitem ' + k + ' bestaat niet', 404);
    for (const f of i.fasen || []) if (!LEERFASEN.includes(f.fase)) weiger('leerfase: ' + LEERFASEN.join(', '), 400);
    const vereist = {}; for (const c of Object.values(st.curricula)) vereist[c.id] = c.vereist || [];
    vereist[i.id] = lijstVan(i.vereist);
    for (const v of vereist[i.id]) if (!st.curricula[v]) weiger('voorkennis ' + v + ' bestaat niet', 404);
    const rond = cyclus(vereist);
    if (rond) weiger('deze voorkennis maakt een kring: ' + rond.join(' -> '), 409);
    return [{ soort: 'curriculum', data: { id: i.id, titel: tekst(i.titel, 120), vaardigheden: lijstVan(i.vaardigheden),
      kennis: lijstVan(i.kennis), fasen: (i.fasen || []).map(f => ({ fase: f.fase, wat: tekst(f.wat, 300) })), vereist: vereist[i.id] } }];
  },

  curriculumStand(st, i, door) {
    eisBestuur(st, door, ['CURRICULUM_OWNER', 'QUALITY_AUTHORITY'], 'een curriculum van stand veranderen');
    const c = st.curricula[i.id]; if (!c) weiger('curriculum bestaat niet', 404);
    const o = overgang('curriculum', c.stand, i.naar); if (!o.ok) weiger(o.reden, 409);
    if (i.naar === 'ACTIVE' || i.naar === 'PILOT') {
      /* Een curriculum leert alleen officiele kennis (grondwet 1). */
      for (const k of c.kennis) if (!st.kennis[k].actief) weiger('kennisitem ' + k + ' heeft geen ACTIVE versie; een curriculum leert geen concept', 409);
      if (!c.vaardigheden.length) weiger('een curriculum zonder vaardigheid leidt nergens heen', 409);
    }
    return [{ soort: 'curriculumStand', data: { id: c.id, naar: i.naar } }];
  }
};
