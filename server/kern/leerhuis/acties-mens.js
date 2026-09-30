/* ============================================================================
   HET LEERHUIS -- mensen: een rol, een startplan, het leerpad, trainers, en
   vertrek.

   Een functietitel is geen bewijs (grondwet 2): een rol toewijzen zet alleen
   een LEERPAD in gang. Wat iemand mag, volgt pas uit bewijs, beoordeling en een
   apart beleid (./brug.js).

   Een goede vakman is niet automatisch trainer (grondwet 7): trainer word je
   door een eigen curriculum (trainerschap) te bewijzen EN de vaardigheden die je
   gaat overdragen zelf bewezen te hebben. En een trainer die niet bij is na een
   kennisverandering, geeft dat curriculum niet tot hij zelf is bijgewerkt.
   ========================================================================== */
'use strict';

const { overgang, TRAINERLADDER } = require('./standen');
const { relatieActief, heeftBestuur, trainerGeldig, verversen, certStand, certTelt } = require('./oordeel');
const { startplan, leerlingenVan, MAX_LEERLINGEN } = require('./startplan');
const { weiger, eisPersoon, eisBestuur, eisNiet, eisOrg } = require('./hulp');

const isManager = (st, door, persoon) => !!(st.relaties[persoon] && st.relaties[persoon].manager === door);
/* Stappen die de leerling zelf zet, en stappen die een trainer moet zien. */
const ZELF = ['LEARNING', 'PRACTICING', 'SIMULATING'];
const TRAINER = ['SUPERVISED', 'READY_FOR_ASSESSMENT'];

module.exports = {
  rolToewijzen(st, i, door) {
    eisOrg(st);
    const p = eisPersoon(i.persoon);
    if (!(heeftBestuur(st, door, 'ACADEMY_OWNER') || isManager(st, door, p))) weiger('een rol toewijzen doet de eigenaar of de manager', 403);
    eisNiet(p, door, 'niemand wijst zichzelf een rol toe');
    if (!st.rollen[i.rol]) weiger('rol bestaat niet in deze organisatie', 404);
    if (!relatieActief(st, p)) weiger(p + ' heeft geen lopende relatie met ' + st.org.id, 409);
    return [{ soort: 'rolToegewezen', data: { persoon: p, rol: i.rol } }];
  },

  /* Net als bewijs of een certificaat intrekken: zonder reden bestaat het niet, en
     een rol die iemand niet draagt valt niet in te trekken (dat was een lege regel
     in het spoor die er uitzag als een besluit). */
  rolIntrekken(st, i, door) {
    eisBestuur(st, door, ['ACADEMY_OWNER'], 'een rol intrekken');
    const p = eisPersoon(i.persoon);
    if (!(st.personen[p] && st.personen[p].rollen.includes(i.rol))) weiger(p + ' draagt rol ' + i.rol + ' niet', 409);
    if (!String(i.reden || '').trim()) weiger('een rol intrekken zonder reden bestaat niet', 400);
    return [{ soort: 'rolIngetrokken', data: { persoon: p, rol: i.rol, reden: String(i.reden || '').slice(0, 300) } }];
  },

  /* Het plan en de leeropdrachten in een handeling: wie het plan ziet, ziet ook
     de toewijzingen die eruit volgden, met dezelfde versies. */
  startplanMaak(st, i, door) {
    eisOrg(st);
    const p = eisPersoon(i.persoon);
    if (!(heeftBestuur(st, door, 'ACADEMY_OWNER') || isManager(st, door, p))) weiger('een startplan maakt de eigenaar of de manager', 403);
    if (!(st.personen[p] && st.personen[p].rollen.includes(i.rol))) weiger(p + ' draagt rol ' + i.rol + ' nog niet', 409, 'wijs eerst de rol toe');
    const plan = startplan(st, p, i.rol, { startdatum: i.startdatum, buddy: i.buddy });
    const uit = [{ soort: 'startplan', data: plan }];
    for (const l of plan.leren) {
      const al = st.personen[p].leren[l.curriculum];
      if (al && al.stand !== 'PRACTICING_IN_ROLE') continue;
      uit.push({ soort: 'leren', data: { persoon: p, curriculum: l.curriculum, versie: l.versie, reden: l.reden } });
      if (l.trainer) uit.push({ soort: 'trainerToegewezen', data: { persoon: p, curriculum: l.curriculum, trainer: l.trainer } });
    }
    return uit;
  },

  lerenStand(st, i, door) {
    eisOrg(st);
    const p = eisPersoon(i.persoon);
    const l = st.personen[p] && st.personen[p].leren[i.curriculum];
    if (!l) weiger('er loopt geen leerpad ' + i.curriculum + ' voor ' + p, 404);
    const o = overgang('leren', l.stand, i.naar); if (!o.ok) weiger(o.reden, 409);
    if (ZELF.includes(i.naar)) {
      if (door !== p && door !== l.trainer) weiger('deze stap zet de leerling of zijn trainer', 403);
    } else if (TRAINER.includes(i.naar)) {
      /* Praktijk onder toezicht: alleen een trainer die NU geldig is. */
      if (door !== l.trainer) weiger('onder toezicht werken en klaar voor beoordeling bevestigt de toegewezen trainer', 403);
      const t = trainerGeldig(st, door, i.curriculum); if (!t.ok) weiger(t.reden, 403);
    } else {
      weiger('stand ' + i.naar + ' volgt uit een beoordeling of certificaat, niet uit een handeling', 409);
    }
    return [{ soort: 'lerenStand', data: { persoon: p, curriculum: i.curriculum, naar: i.naar } }];
  },

  trainerToewijzen(st, i, door) {
    eisBestuur(st, door, ['ACADEMY_OWNER', 'TRAINER_AUTHORITY'], 'een trainer toewijzen');
    const p = eisPersoon(i.persoon);
    const l = st.personen[p] && st.personen[p].leren[i.curriculum];
    if (!l) weiger('er loopt geen leerpad ' + i.curriculum + ' voor ' + p, 404);
    eisNiet(i.trainer, p, 'niemand is zijn eigen trainer');
    const t = trainerGeldig(st, i.trainer, i.curriculum); if (!t.ok) weiger(t.reden, 409);
    if (leerlingenVan(st, i.trainer) >= MAX_LEERLINGEN) weiger(i.trainer + ' heeft al ' + MAX_LEERLINGEN + ' leerlingen', 409);
    return [{ soort: 'trainerToegewezen', data: { persoon: p, curriculum: i.curriculum, trainer: i.trainer } }];
  },

  trainerKwalificeer(st, i, door, ctx) {
    eisBestuur(st, door, ['TRAINER_AUTHORITY'], 'een trainer kwalificeren');
    const p = eisPersoon(i.persoon);
    eisNiet(p, door, 'niemand kwalificeert zichzelf als trainer');
    if (!TRAINERLADDER.includes(i.trede)) weiger('trede: ' + TRAINERLADDER.join(', '), 400);
    if (!relatieActief(st, p)) weiger(p + ' heeft geen lopende relatie met ' + st.org.id, 409);
    const nu = ctx.nu();
    if (TRAINERLADDER.indexOf(i.trede) >= TRAINERLADDER.indexOf('CERTIFIED_TRAINER')) {
      const trainerschap = Object.values(st.certificaten).some(c => c.persoon === p
        && (c.vaardigheden || []).some(v => st.vaardigheden[v] && st.vaardigheden[v].trainerschap)
        && certTelt(certStand(st, c, nu).stand));
      if (!trainerschap) weiger('een gecertificeerde trainer heeft een geldig certificaat op een trainerschapsvaardigheid (Train-the-Trainer)', 409);
    }
    const bewezen = (st.personen[p] || { bewezen: {} }).bewezen;
    const curricula = [];
    for (const cId of i.curricula || []) {
      const c = st.curricula[cId]; if (!c) weiger('curriculum ' + cId + ' bestaat niet', 404);
      const mist = c.vaardigheden.filter(v => !bewezen[v]);
      if (mist.length) weiger('wie ' + cId + ' geeft, heeft zelf bewezen: ' + mist.join(', '), 409);
      curricula.push({ id: cId, versie: c.versie });
    }
    return [{ soort: 'trainer', data: { persoon: p, trede: i.trede, curricula } }];
  },

  /* Een trainer is bijgewerkt als hij zelf niets meer hoeft te verversen voor
     de vaardigheden van zijn curricula -- en dan bevestigt een ander dat. */
  trainerBijwerken(st, i, door, ctx) {
    eisBestuur(st, door, ['TRAINER_AUTHORITY'], 'een trainer bijwerken');
    const p = eisPersoon(i.persoon);
    eisNiet(p, door, 'niemand werkt zichzelf bij');
    const t = st.trainers[p]; if (!t) weiger(p + ' is geen trainer', 404);
    const vs = new Set(t.curricula.flatMap(c => (st.curricula[c.id] || { vaardigheden: [] }).vaardigheden));
    const open = verversen(st, p, ctx.nu()).filter(x => vs.has(x.vaardigheid));
    if (open.length) weiger('de trainer moet eerst zelf verversen: ' + open.map(x => x.waarom).join('; '), 409);
    const nieuw = t.curricula.map(c => ({ id: c.id, versie: (st.curricula[c.id] || {}).versie || c.versie }));
    return [{ soort: 'trainer', data: { persoon: p, trede: t.trede, curricula: nieuw } }, { soort: 'trainerBijgewerkt', data: { persoon: p } }];
  },

  /* Vertrek: de relatie sluit, rollen en bestuursrollen vervallen, en de
     leerlingen van een vertrekkende trainer worden GENOEMD zodat een mens ze
     opnieuw koppelt. Er wordt niets gewist: bewijs en historie blijven. */
  uitDienst(st, i, door) {
    eisBestuur(st, door, ['ACADEMY_OWNER'], 'iemand uit dienst melden');
    const p = eisPersoon(i.persoon);
    eisNiet(p, door, 'een eigenaar meldt zichzelf niet uit dienst; dat doet een tweede eigenaar');
    const r = st.relaties[p]; if (!r) weiger(p + ' heeft hier geen relatie', 404);
    const uit = [{ soort: 'relatie', data: { ...r, persoon: p, actief: false } }];
    for (const rol of (st.personen[p] || { rollen: [] }).rollen) uit.push({ soort: 'rolIngetrokken', data: { persoon: p, rol, reden: 'uit dienst' } });
    for (const b of st.bestuur[p] || []) uit.push({ soort: 'bestuur', data: { persoon: p, rol: b, aan: false } });
    if (st.trainers[p]) uit.push({ soort: 'trainerIngetrokken', data: { persoon: p, reden: 'uit dienst' } });
    return uit;
  }
};
