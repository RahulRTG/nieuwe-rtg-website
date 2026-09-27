/* VRIJHEID: DE MOTOR -- Mijn tijd, voor RTG en voor elke organisatie apart.

   Dit bestand legt vast wat besluit.js beslist. Het BEZIT drie dingen, en
   verder niets:
     - de verzoeken (met hun standmachine en de besluitstappen);
     - het eerlijkheidsgrootboek (alleen aanvullen, nooit wijzigen);
     - de boekingen per tijdcategorie (categorieen.js).
   Het rooster, de mensen, het dienstverband en de bevoegdheden BEZIT het niet:
   die komen binnen als een TEAMBEELD van de domeinen die ze al hebben
   (kern/concern/employment.js, kern/vakbewijs.js, de roosters). Zo ontstaat er
   geen tweede personeelsadministratie (PLANNING.md grens 3).

   ISOLATIE. Alles hangt aan een organisatiecode, en een teambeeld van een
   andere organisatie wordt geweigerd. Er is geen functie die over organisaties
   heen leest (NO_CROSS_TENANT_PEOPLE_LEAK).

   IDEMPOTENT. Een verzoek met dezelfde sleutel en dezelfde inhoud geeft het
   eerdere antwoord terug; dezelfde sleutel met andere inhoud is 409.

   ONBEKENDE UITKOMST. Mislukt het bijwerken van het rooster na een besluit,
   dan staat er ONBEKEND en niet "gelukt" -- en `reconcile()` kijkt EERST of
   de wijziging er toch staat voordat hij hem opnieuw probeert (RECONCILE
   BEFORE RETRY). */
'use strict';
const crypto = require('crypto');
const B = require('./besluit');
const D = require('./dekking');
const C = require('./categorieen');
const S = require('./standen');

const ACTIEF = ['CHECKING', 'HUMAN_REVIEW', 'AUTO_APPROVED', 'APPROVED', 'SCHEDULED', 'HANDOVER_READY', 'TAKEN'];
const TOEGEKEND = ['AUTO_APPROVED', 'APPROVED', 'SCHEDULED', 'HANDOVER_READY', 'TAKEN', 'COMPLETED'];

function maakVrijheid({ opslag, save, nu, meld, rooster }) {
  const tijd = nu || (() => new Date().toISOString());
  const bewaar = save || (() => {});
  const zend = meld || (() => {});
  const org = (code) => {
    const b = opslag.bak('vrijheid'); const k = String(code || '').toUpperCase();
    if (!k) throw new Error('Geen organisatie.');
    return b[k] || (b[k] = { verzoeken: {}, sleutels: {}, grootboek: [], boekingen: [], aanbiedingen: {}, verjaardagen: {}, signalen: [], behoeften: [], vertrouwelijk: {} });
  };
  const id = (pre, ...delen) => pre + '_' + crypto.createHash('sha256').update(delen.join('|')).digest('hex').slice(0, 12);
  const fout = (status, error, extra) => ({ status, error, ...extra });

  function teamKlopt(code, team) {
    return team && String(team.organisatie || '').toUpperCase() === String(code).toUpperCase();
  }
  /* Alle toegekende afwezigheid in deze organisatie, behalve die van `behalve`. */
  function afwezig(code, behalve) {
    const o = org(code); const uit = [];
    for (const v of Object.values(o.verzoeken)) if (v.id !== behalve && TOEGEKEND.includes(v.stand) && v.afwezigheid) uit.push(v.afwezigheid);
    for (const a of Object.values(o.aanbiedingen)) if (a.id !== behalve && ['ACCEPTED', 'RECONCILE_PENDING', 'ROSTER_RECONCILED', 'COMPLETED'].includes(a.stand)) uit.push(a.afwezigheid);
    for (const j of Object.values(o.verjaardagen)) if (j.id !== behalve && ['COVERAGE_PLANNED', 'SCHEDULED', 'TAKEN'].includes(j.stand) && j.afwezigheid) uit.push(j.afwezigheid);
    for (const b of o.boekingen) if (b.id !== behalve && b.afwezigheid && b.categorie === 'RECOVERY_RELEASE') uit.push(b.afwezigheid);
    return uit;
  }
  function schrijfGrootboek(code, g) { const o = org(code); o.grootboek.push(Object.freeze({ ...g, op: tijd() })); }
  function boek(code, bron, b, afw) {
    const r = C.boeking(b);
    if (r.fout) throw new Error(r.reden);
    org(code).boekingen.push(Object.freeze({ ...r, id: bron, afwezigheid: afw || null }));
  }
  function roosterPas(code, obj, wijziging) {
    obj.roosterWijziging = wijziging;
    if (!rooster) { obj.rooster = 'NIET_AANGESLOTEN'; return; }
    try { rooster.pas(code, wijziging); obj.rooster = 'BIJGEWERKT'; }
    catch (e) { obj.rooster = 'ONBEKEND'; obj.roosterFout = String(e && e.message || e); zend('RECONCILE_REQUIRED', { organisatie: code, id: obj.id }); }
  }
  function plan(code, v) {
    S.zet(v, 'verzoek', 'SCHEDULED', 'systeem', tijd());
    boek(code, v.id, { categorie: v.categorie, uren: v.uren, datum: v.datum, persoon: v.persoon }, v.afwezigheid);
    if (v.vervanger) schrijfGrootboek(code, { soort: 'EXTRA_COVERAGE', persoon: v.vervanger, datum: v.datum });
    roosterPas(code, v, { soort: 'afwezig', persoon: v.persoon, afwezigheid: v.afwezigheid, bron: v.id });
    zend(v.categorie === 'RTG_DAY' ? 'RTG_DAY_SCHEDULED' : 'FREEDOM_APPROVED', { organisatie: code, id: v.id });
  }

  function vraag(code, team, verzoek, opts) {
    const o = opts || {};
    if (!teamKlopt(code, team)) return fout(403, 'Dit teambeeld hoort niet bij deze organisatie.');
    if (!verzoek || !o.door || o.door !== verzoek.persoon) return fout(403, 'U kunt alleen voor uzelf een verzoek doen.');
    const staat = org(code);
    const inhoud = JSON.stringify([verzoek.soort, verzoek.categorie, verzoek.persoon, verzoek.datum, verzoek.vanaf || null, verzoek.tot || null, verzoek.vervanger || null]);
    if (o.sleutel) {
      const eerder = staat.sleutels[o.sleutel];
      if (eerder) return eerder.inhoud === inhoud ? { ok: true, herhaling: true, verzoek: staat.verzoeken[eerder.id] } : fout(409, 'Deze sleutel is al gebruikt voor een ander verzoek.');
    }
    const dubbel = Object.values(staat.verzoeken).find(x => x.inhoud === inhoud && ACTIEF.includes(x.stand));
    if (dubbel) return fout(409, 'U heeft dit verzoek al lopen.', { verzoek: dubbel });

    /* Het saldo komt uit de rechten (contract, payroll) plus de eigen boekingen
       van dit jaar; het RTG Day-recht uit het beleid. Nooit door de aanroeper
       voorgerekend: dan kan een saldo worden opgegeven in plaats van berekend. */
    const jaar = String(verzoek.datum || '').slice(0, 4);
    const rtg = o.beleid.waarde('rtgDag.perJaar');
    const r = o.rechten || {};
    const saldi = C.saldi({ wettelijk: r.wettelijk != null ? r.wettelijk : null, contractueel: r.contractueel != null ? r.contractueel : null, rtgDag: rtg.open ? null : rtg.waarde },
      staat.boekingen.filter(b => b.persoon === verzoek.persoon && !b.ingetrokken && String(b.datum).startsWith(jaar)));
    const vid = id('vv', code, inhoud, tijd(), Object.keys(staat.verzoeken).length);
    const oordeel = B.beoordeel({ team, beleid: o.beleid, verzoek, afwezig: afwezig(code), grootboek: staat.grootboek, saldi, vandaag: o.vandaag });
    const v = { id: vid, inhoud, stand: 'DRAFT', soort: verzoek.soort, categorie: verzoek.categorie, persoon: verzoek.persoon,
      datum: verzoek.datum, vanaf: verzoek.vanaf || null, tot: verzoek.tot || null, aangevraagd: tijd(), ...oordeel };
    if (verzoek.reden && verzoek.categorie === 'SPECIAL_LEAVE') staat.vertrouwelijk[vid] = String(verzoek.reden).slice(0, 500);
    S.zet(v, 'verzoek', 'SUBMITTED', v.persoon, tijd());
    S.zet(v, 'verzoek', 'CHECKING', 'systeem', tijd());
    staat.verzoeken[vid] = v;
    if (o.sleutel) staat.sleutels[o.sleutel] = { id: vid, inhoud };
    zend('FREEDOM_REQUESTED', { organisatie: code, id: vid });

    const u = oordeel.uitkomst;
    if (u === 'AUTO_APPROVED') { S.zet(v, 'verzoek', 'AUTO_APPROVED', 'systeem', tijd()); plan(code, v); }
    else if (u === 'HUMAN_REVIEW_REQUIRED' || u === 'UNKNOWN') S.zet(v, 'verzoek', 'HUMAN_REVIEW', 'systeem', tijd());
    else if (u === 'ALTERNATIVE_AVAILABLE') S.zet(v, 'verzoek', 'ALTERNATIVE_PROPOSED', 'systeem', tijd());
    else if (u === 'DECLINED' || u === 'BLOCKED_BY_LAW_OR_POLICY') { S.zet(v, 'verzoek', 'DECLINED', 'systeem', tijd()); zend('FREEDOM_DECLINED', { organisatie: code, id: vid }); }
    if ((oordeel.blokkades || []).length) zend('COVERAGE_GAP_DETECTED', { organisatie: code, id: vid, blokkades: oordeel.blokkades });
    bewaar();
    return { ok: true, verzoek: v };
  }

  const ctx = { org, id, fout, tijd, bewaar, zend, teamKlopt, afwezig, schrijfGrootboek, boek, roosterPas, plan, rooster, TOEGEKEND };
  return Object.assign({ vraag }, require('./mens')(ctx),
    require('./aanbod')(ctx), require('./herstel')(ctx), require('./jaarplan')(ctx), require('./beeld')(ctx));
}

module.exports = { maakVrijheid, ACTIEF, TOEGEKEND };
