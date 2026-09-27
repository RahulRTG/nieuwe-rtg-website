/* VRIJHEID: WAT VOORUIT MOET -- verjaardagen, herkeuring, capaciteit, herstel
   en de afstemming met het rooster. Dit zijn de "jobs" van de laag: elk is
   een functie die een teambeeld krijgt en veilig herhaald kan worden, zodat
   de bestaande tikker (kern/command/tikker.js) of een mens ze kan draaien.
   Er komt geen eigen scheduler bij. */
'use strict';
const D = require('./dekking');
const S = require('./standen');
const J = require('./verjaardag');
const K = require('./capaciteit');
const { herstelSignaal } = require('./rust');

module.exports = (ctx) => {
  const { org, id, fout, tijd, bewaar, zend, teamKlopt, afwezig, boek, roosterPas, rooster, TOEGEKEND } = ctx;

  /* Verjaardagen van een heel jaar, ruim vooraf. Idempotent per mens per jaar.
     Een dekkingsgat maakt de verjaardag NIET ongedaan: het wordt een signaal
     aan de planning, maanden voordat het een probleem is. */
  function planVerjaardagen(code, team, jaar, { beleid }) {
    if (!teamKlopt(code, team)) return fout(403, 'Dit teambeeld hoort niet bij deze organisatie.');
    const staat = org(code); const uit = [];
    for (const mens of team.mensen || []) {
      const jid = id('vj', code, mens.id, jaar);
      if (staat.verjaardagen[jid]) { uit.push(staat.verjaardagen[jid]); continue; }
      const p = J.plan(team, mens, jaar, beleid);
      const j = { id: jid, ...p, stand: 'DETECTED', beleidVersie: beleid.versie };
      staat.verjaardagen[jid] = j;
      if (p.stand === 'NOT_APPLICABLE' || p.stand === 'NEEDS_REVIEW') { S.zet(j, 'verjaardag', p.stand, 'systeem', tijd()); uit.push(j); continue; }
      S.zet(j, 'verjaardag', 'ELIGIBILITY_CONFIRMED', 'systeem', tijd());
      const dek = D.toets(team, j.afwezigheid, afwezig(code, jid));
      j.dekking = dek.stand;
      if (dek.stand !== 'SAFE') {
        j.dekkingsgat = dek.uitleg;
        staat.signalen.push({ soort: 'COVERAGE_GAP_DETECTED', bron: jid, datum: j.datum, uitleg: 'Een geplande vrije dag laat een gat: ' + dek.uitleg, op: tijd() });
        zend('COVERAGE_GAP_DETECTED', { organisatie: code, id: jid });
      }
      S.zet(j, 'verjaardag', 'COVERAGE_PLANNED', 'systeem', tijd());
      S.zet(j, 'verjaardag', 'SCHEDULED', 'systeem', tijd());
      boek(code, jid, { categorie: 'BIRTHDAY_LEAVE', uren: j.uren, datum: j.datum, persoon: mens.id, betaaldeUren: j.uren }, j.afwezigheid);
      roosterPas(code, j, { soort: 'afwezig', persoon: mens.id, afwezigheid: j.afwezigheid, bron: jid });
      zend('BIRTHDAY_LEAVE_SCHEDULED', { organisatie: code, id: jid });
      uit.push(j);
    }
    bewaar();
    return { ok: true, verjaardagen: uit };
  }

  /* Toch willen werken op je verjaardag mag -- maar alleen jij zegt dat. */
  function werkOpVerjaardag(code, jid, door) {
    const j = org(code).verjaardagen[jid];
    if (!j) return fout(404, 'Niet gevonden.');
    if (door !== j.persoon) return fout(403, 'Alleen uzelf kiest ervoor om op uw verjaardag te werken.');
    if (j.stand !== 'SCHEDULED') return fout(409, 'Deze verjaardag staat niet (meer) gepland.');
    S.zet(j, 'verjaardag', 'WORKED_BY_CHOICE', door, tijd());
    const b = org(code).boekingen; const i = b.findIndex(x => x.id === jid);
    if (i >= 0) b[i] = Object.freeze({ ...b[i], ingetrokken: true, afwezigheid: null });
    bewaar();
    return { ok: true, verjaardag: j };
  }

  /* Herkeuring: wat al is toegekend, opnieuw tegen het rooster en de
     bevoegdheden van nu. Verloopt een certificaat na de goedkeuring, dan
     wordt dat een signaal en een herbeoordeling -- nooit het stil intrekken
     van iemands vrije tijd. Wie uit dienst is, heeft geen lopend verzoek. */
  function herkeur(code, team) {
    if (!teamKlopt(code, team)) return fout(403, 'Dit teambeeld hoort niet bij deze organisatie.');
    const staat = org(code); const gevonden = [];
    for (const v of Object.values(staat.verzoeken)) {
      if (!['SCHEDULED', 'CHECKING', 'HUMAN_REVIEW', 'ALTERNATIVE_PROPOSED'].includes(v.stand)) continue;
      const mens = (team.mensen || []).find(m => m.id === v.persoon);
      if (!D.inDienst(mens, v.datum)) { v.reden = 'Het dienstverband loopt op ' + v.datum + ' niet meer.'; S.zet(v, 'verzoek', 'CANCELLED', 'systeem', tijd()); gevonden.push({ id: v.id, wat: 'uit-dienst' }); continue; }
      if (v.stand !== 'SCHEDULED' || !v.afwezigheid) continue;
      const dek = D.toets(team, v.afwezigheid, afwezig(code, v.id));
      if (dek.stand === 'GAP' && !v.herbeoordeling) {
        v.herbeoordeling = dek.uitleg;
        staat.signalen.push({ soort: 'COVERAGE_GAP_DETECTED', bron: v.id, datum: v.datum, uitleg: dek.uitleg, op: tijd() });
        zend('COVERAGE_GAP_DETECTED', { organisatie: code, id: v.id });
        gevonden.push({ id: v.id, wat: 'dekking', uitleg: dek.uitleg });
      }
    }
    bewaar();
    return { ok: true, gevonden };
  }

  function capaciteit(code, team, { beleid, datum }) {
    if (!teamKlopt(code, team)) return fout(403, 'Dit teambeeld hoort niet bij deze organisatie.');
    const staat = org(code);
    const besl = Object.values(staat.verzoeken).map(v => ({ uitkomst: v.uitkomst, blokkades: v.blokkades || [] }));
    const a = K.blokkadeAnalyse(besl, team, beleid, datum);
    for (const g of a.gaten || []) {
      if (staat.behoeften.some(b => b.code === g.code && b.stand === 'OPEN')) continue;
      staat.behoeften.push({ code: g.code, stand: 'OPEN', zin: g.zin, duiding: g.duiding, houdersBijOntstaan: g.houders || 0, op: tijd() });
      zend('CAPABILITY_GAP_DETECTED', { organisatie: code, code: g.code });
    }
    for (const b of staat.behoeften) if (b.stand === 'OPEN' && K.vervuld(b, team, datum)) { b.stand = 'VERVULD'; b.vervuldOp = tijd(); }
    bewaar();
    return { ok: true, analyse: a, behoeften: staat.behoeften.slice() };
  }

  /* Herstel: het signaal gaat naar de mens zelf en naar de leidinggevende, en
     draagt alleen het roosterfeit. */
  function herstelSignalen(code, team, { beleid, datum }) {
    if (!teamKlopt(code, team)) return fout(403, 'Dit teambeeld hoort niet bij deze organisatie.');
    const uit = [];
    for (const m of team.mensen || []) {
      const s = herstelSignaal(team, m.id, datum, beleid);
      if (s.stand === 'NIET_GEMETEN') return { ok: true, stand: 'NIET_GEMETEN', uitleg: s.uitleg, signalen: [] };
      if (s.stand === 'REST_RISK') { uit.push({ persoon: m.id, uitleg: s.uitleg }); zend('REST_RISK_DETECTED', { organisatie: code, persoon: m.id }); }
    }
    return { ok: true, signalen: uit };
  }

  /* RECONCILE BEFORE RETRY: bij een onbekende uitkomst eerst kijken of de
     wijziging er al staat; pas als het rooster zegt dat hij er NIET staat,
     opnieuw proberen. Zegt het rooster niets, dan blijft het onbekend. */
  function reconcile(code) {
    const staat = org(code); const uit = [];
    const alle = [...Object.values(staat.verzoeken), ...Object.values(staat.aanbiedingen), ...Object.values(staat.verjaardagen)];
    for (const o of alle.filter(x => x.rooster === 'ONBEKEND')) {
      const er = rooster && rooster.heeft ? rooster.heeft(code, o.roosterWijziging) : undefined;
      if (er === true) o.rooster = 'BIJGEWERKT';
      else if (er === false) roosterPas(code, o, o.roosterWijziging);
      if (o.rooster === 'BIJGEWERKT' && o.stand === 'RECONCILE_PENDING') S.zet(o, 'vrijgaveAanbod', 'ROSTER_RECONCILED', 'systeem', tijd());
      uit.push({ id: o.id, rooster: o.rooster });
    }
    bewaar();
    return { ok: true, afgestemd: uit };
  }

  return { planVerjaardagen, werkOpVerjaardag, herkeur, capaciteit, herstelSignalen, reconcile, TOEGEKEND_STANDEN: TOEGEKEND };
};
