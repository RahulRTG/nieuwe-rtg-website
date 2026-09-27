/* ============================================================================
   HET LEERHUIS -- certificaat, geschiktheidsbeleid, echt werk, EVC en bezwaar.

   CERTIFICATION IS GEEN AUTHORITY (grondwet 4). Een certificaat legt vast dat
   een mens een vaardigheid bewezen heeft; of hij daarmee iets MAG, zegt een
   apart beleid dat twee mensen hebben vastgesteld (./brug.js). Een certificaat
   dat naar een beoordeling wijst die later ongeldig wordt, valt vanzelf mee
   (./oordeel.js certStand).

   ECHT WERK GAAT LANGS DE BRUG. `werkVastleggen` is de plek waar het leerhuis
   de praktijk raakt: zonder AUTHORITY_ELIGIBLE geen werkbewijs. Dit is de
   domeinpoort binnen het leerhuis; hoe een RTG-route die ene uitslag als feit
   leest, is een besluit dat ACADEMY.md par. 5 open laat -- niet stil ingebouwd.

   EXTERN BEWIJS IS GEEN INTERN RECHT. EVC accepteert een extern stuk hoogstens
   als DOCUMENTED bewijs; PROVEN komt nog steeds uit een eigen beoordeling.
   ========================================================================== */
'use strict';

const { overgang } = require('./standen');
const { relatieActief, certStand } = require('./oordeel');
const { geschiktheid } = require('./brug');
const { weiger, eisPersoon, eisId, eisBestuur, eisNiet, eisOrg, kennisNu, nieuwId } = require('./hulp');

const tekst = (x, n) => String(x == null ? '' : x).slice(0, n || 300);
const DAG = 86400000;

module.exports = {
  certificaatUitgeven(st, i, door, ctx) {
    eisBestuur(st, door, ['ASSESSMENT_AUTHORITY'], 'een certificaat uitgeven');
    const p = eisPersoon(i.persoon);
    eisNiet(p, door, 'niemand certificeert zichzelf');
    if (!relatieActief(st, p)) weiger(p + ' heeft geen lopende relatie met ' + st.org.id, 409);
    const vs = i.vaardigheden || [];
    if (!vs.length) weiger('een certificaat noemt de vaardigheden die het dekt', 400);
    const bs = (i.beoordelingen || []).map(id => st.beoordelingen[id] || weiger('beoordeling ' + id + ' bestaat niet in deze organisatie', 404));
    for (const b of bs) {
      if (b.persoon !== p) weiger('beoordeling ' + b.id + ' gaat over iemand anders', 409);
      if (b.stand !== 'PROVEN') weiger('beoordeling ' + b.id + ' staat op ' + b.stand + ', niet PROVEN', 409);
      const v = st.vaardigheden[b.vaardigheid];
      if (v && v.kritiek && b.assessor === door) weiger('bij een kritieke vaardigheid geeft de assessor niet zelf het certificaat uit', 403);
    }
    for (const v of vs) if (!bs.some(b => b.vaardigheid === v)) weiger('geen PROVEN beoordeling voor ' + v, 409);
    /* Geen tweede certificaat op dezelfde beoordeling: een herhaling met een
       andere sleutel is een toestandsfout en geen idempotentie. */
    const dubbel = Object.values(st.certificaten).find(c => (c.beoordelingen || []).some(x => bs.some(b => b.id === x))
      && certStand(st, c, ctx.nu()).stand !== 'REVOKED');
    if (dubbel) weiger('op deze beoordeling staat al certificaat ' + dubbel.id, 409);
    const dagen = Number(i.geldigDagen) || null;
    const id = nieuwId(st.certificaten, i.id, ctx);
    const uit = [{ soort: 'certificaat', data: { id, persoon: p, vaardigheden: vs, beoordelingen: bs.map(b => b.id),
      bewijs: bs.flatMap(b => b.bewijs || []), geldigTot: dagen ? new Date(ctx.nu() + dagen * DAG).toISOString().slice(0, 10) : null,
      beleidHercert: tekst(i.hercertificering || 'EVENT_DRIVEN', 40), kennis: Object.assign({}, ...vs.map(v => kennisNu(st, v))), versie: 1 } }];
    const pp = st.personen[p] || { leren: {}, bewezen: {} };
    for (const [c, l] of Object.entries(pp.leren))
      if (l.stand === 'PROVEN' && st.curricula[c].vaardigheden.every(v => vs.includes(v) || pp.bewezen[v]))
        uit.push({ soort: 'lerenStand', data: { persoon: p, curriculum: c, naar: 'CERTIFIED' } });
    return uit;
  },

  certificaatStand(st, i, door, ctx) {
    eisBestuur(st, door, ['QUALITY_AUTHORITY', 'ASSESSMENT_AUTHORITY'], 'een certificaat schorsen of intrekken');
    const c = st.certificaten[i.id]; if (!c) weiger('certificaat bestaat niet in deze organisatie', 404);
    if (!['SUSPENDED', 'REVOKED', 'ACTIVE'].includes(i.naar)) weiger('naar SUSPENDED, REVOKED of (na schorsing) ACTIVE', 400);
    const nu = certStand(st, c, ctx.nu()).stand;
    if (nu === 'REVOKED') weiger('een ingetrokken certificaat komt niet terug; geef zo nodig een nieuw uit', 409);
    if (i.naar === 'ACTIVE' && nu !== 'SUSPENDED') weiger('alleen een geschorst certificaat kan weer actief', 409);
    if (!i.reden) weiger('zonder reden geen schorsing of intrekking', 400);
    return [{ soort: 'certificaatStand', data: { id: c.id, naar: i.naar, reden: tekst(i.reden) } }];
  },

  beleidZet(st, i, door) {
    eisBestuur(st, door, ['ACADEMY_OWNER', 'QUALITY_AUTHORITY'], 'een geschiktheidsbeleid voorstellen');
    eisId(i.id, 'beleid');
    if (!i.handeling) weiger('een beleid gaat over een handeling', 400);
    const vs = i.vaardigheden || [];
    if (!vs.length) weiger('een beleid zonder vaardigheid maakt iedereen geschikt; dat is geen beleid', 400);
    for (const v of vs) if (!st.vaardigheden[v]) weiger('vaardigheid ' + v + ' bestaat niet', 404);
    if (i.rol && !st.rollen[i.rol]) weiger('rol bestaat niet', 404);
    if (Object.values(st.beleid).some(b => b.handeling === i.handeling && b.id !== i.id)) weiger('er is al een beleid voor ' + i.handeling, 409);
    return [{ soort: 'beleid', data: { id: i.id, handeling: tekst(i.handeling, 80), rol: i.rol || null, vaardigheden: vs, certificaat: !!i.certificaat } }];
  },

  beleidGoedkeuren(st, i, door) {
    eisBestuur(st, door, ['QUALITY_AUTHORITY', 'ACADEMY_OWNER'], 'een geschiktheidsbeleid goedkeuren');
    const b = st.beleid[i.id]; if (!b) weiger('beleid bestaat niet', 404);
    eisNiet(door, b.voorgesteldDoor, 'wie een beleid voorstelt, keurt het niet zelf goed');
    return [{ soort: 'beleidGoedgekeurd', data: { id: b.id } }];
  },

  werkVastleggen(st, i, door, ctx) {
    eisOrg(st);
    const g = geschiktheid(st, door, i.handeling, ctx.nu());
    if (g.uitkomst !== 'AUTHORITY_ELIGIBLE') {
      const e = new Error('niet geschikt voor ' + i.handeling + ': ' + g.opbouw.filter(x => !x.ok).map(x => x.waarom).join('; '));
      e.status = 403; e.opbouw = g.opbouw; throw e;
    }
    const b = st.beleid[g.beleid];
    const uit = [{ soort: 'werk', data: { id: ctx.id(), persoon: door, handeling: g.handeling, beleid: b.id, uitkomst: tekst(i.uitkomst, 400) } }];
    for (const v of b.vaardigheden) uit.push({ soort: 'bewijs', data: { id: ctx.id(), persoon: door, vaardigheid: v, soort: 'WORK_EVIDENCE',
      sterkte: 'SELF_REPORTED', bron: 'werk ' + g.handeling, notitie: tekst(i.uitkomst, 300), kennis: kennisNu(st, v) } });
    const p = st.personen[door] || { leren: {} };
    for (const [c, l] of Object.entries(p.leren)) {
      if (!st.curricula[c].vaardigheden.some(v => b.vaardigheden.includes(v))) continue;
      if (l.stand === 'PROVEN' || l.stand === 'CERTIFIED') uit.push({ soort: 'lerenStand', data: { persoon: door, curriculum: c, naar: 'AUTHORITY_ELIGIBLE' } });
      if (['PROVEN', 'CERTIFIED', 'AUTHORITY_ELIGIBLE'].includes(l.stand)) uit.push({ soort: 'lerenStand', data: { persoon: door, curriculum: c, naar: 'PRACTICING_IN_ROLE' } });
    }
    return uit;
  },

  evcIndienen(st, i, door, ctx) {
    eisOrg(st);
    if (!relatieActief(st, door)) weiger('EVC vraagt een lopende relatie', 403);
    if (!st.vaardigheden[i.vaardigheid]) weiger('vaardigheid bestaat niet', 404);
    if (!i.extern) weiger('noem het externe stuk (wat, van wie, wanneer)', 400);
    const id = nieuwId(st.evc, i.id, ctx);
    return [{ soort: 'evc', data: { id, persoon: door, vaardigheid: i.vaardigheid, extern: tekst(i.extern, 400) } },
      { soort: 'evcStand', data: { id, naar: 'EVIDENCE' } }];
  },

  evcBeoordeel(st, i, door, ctx) {
    eisBestuur(st, door, ['ASSESSOR'], 'een EVC beoordelen');
    const e = st.evc[i.id]; if (!e) weiger('EVC bestaat niet', 404);
    eisNiet(door, e.persoon, 'niemand beoordeelt zijn eigen EVC');
    const uit = [];
    if (e.stand === 'EVIDENCE') uit.push({ soort: 'evcStand', data: { id: e.id, naar: 'REVIEW' } });
    const o = overgang('evc', 'REVIEW', i.uitkomst); if (!o.ok) weiger(o.reden, 409);
    uit.push({ soort: 'evcStand', data: { id: e.id, naar: i.uitkomst } });
    if (i.uitkomst !== 'REJECTED') uit.push({ soort: 'bewijs', data: { id: ctx.id(), persoon: e.persoon, vaardigheid: e.vaardigheid,
      soort: 'KNOWLEDGE_EVIDENCE', sterkte: 'DOCUMENTED', bron: 'EVC ' + e.id + ': ' + e.extern, notitie: i.uitkomst, kennis: kennisNu(st, e.vaardigheid) } });
    return uit;
  },

  bezwaarIndienen(st, i, door, ctx) {
    eisOrg(st);
    const b = st.beoordelingen[i.beoordeling]; if (!b) weiger('beoordeling bestaat niet', 404);
    if (b.persoon !== door) weiger('bezwaar maakt de beoordeelde zelf', 403);
    return [{ soort: 'bezwaar', data: { id: ctx.id(), beoordeling: b.id, reden: tekst(i.reden, 800) } }];
  },

  /* Onafhankelijk: niet de assessor, niet de indiener. REASSESSMENT maakt de
     oude beoordeling ongeldig, zodat een nieuwe kan beginnen. */
  bezwaarStand(st, i, door) {
    eisBestuur(st, door, ['QUALITY_AUTHORITY'], 'een bezwaar behandelen');
    const z = st.bezwaren[i.id]; if (!z) weiger('bezwaar bestaat niet', 404);
    const b = st.beoordelingen[z.beoordeling];
    eisNiet(door, b.assessor, 'de assessor behandelt geen bezwaar tegen zijn eigen oordeel');
    const o = overgang('bezwaar', z.stand, i.naar); if (!o.ok) weiger(o.reden, 409);
    if (z.stand === 'INDEPENDENT_REVIEW' && z.reviewer !== door) weiger('de reviewer die begon, rondt af', 403);
    const uit = [{ soort: 'bezwaarStand', data: { id: z.id, naar: i.naar, notitie: tekst(i.notitie, 600) } }];
    if (i.naar === 'REASSESSMENT' && overgang('beoordeling', b.stand, 'INVALIDATED').ok)
      uit.push({ soort: 'beoordelingStand', data: { id: b.id, naar: 'INVALIDATED', reden: 'bezwaar ' + z.id + ': opnieuw beoordelen' } });
    return uit;
  }
};
