/* VRIJHEID: WIE WAT ZIET -- drie lezers, drie beelden, een waarheid.

   De MEDEWERKER ziet vijf dingen en geen HR-dashboard: vakantie, RTG Days,
   zijn verjaardag, zijn komende verzoeken en wat RTG hem aanbiedt.
   De LEIDINGGEVENDE ziet per verzoek de stappen in gewone standen (werkstand,
   dekking, bevoegdheden, teamimpact, eerlijkheid) en de alternatieven -- maar
   niet waarom iemand vrij wil, en bij ziekte of bijzonder verlof alleen
   "afwezig". De persoonlijke reden van bijzonder verlof leest alleen wie
   beoordeelt, en die staat in een aparte la.
   Het TEAM ziet dekking en open plekken, en van een collega alleen dat hij
   afwezig is -- nooit de categorie, nooit een reden.

   GEZONDHEID meet het SYSTEEM en nooit de mensen: hoeveel verzoeken er
   konden, hoe vaak een alternatief werkte, hoeveel capaciteitsgaten er open
   staan. Een lage goedkeuring is een vraag aan de ORGANISATIE, en wordt nergens
   per mens uitgesplitst. */
'use strict';
const T = require('./tijd');
const { CATEGORIEEN } = require('./categorieen');

const OPENBAAR_TEAM = (v) => ({ datum: v.datum, van: v.afwezigheid ? T.klokVan(v.afwezigheid.van) : null, tot: v.afwezigheid ? T.klokVan(v.afwezigheid.tot) : null, persoon: v.persoon, wat: 'afwezig' });

module.exports = (ctx) => {
  const { orgLees: org, fout, teamKlopt, TOEGEKEND } = ctx;

  function mijnTijd(code, persoon, { beleid, rechten, jaar }) {
    const staat = org(code);
    const mijn = staat.boekingen.filter(b => b.persoon === persoon && !b.ingetrokken && String(b.datum).startsWith(String(jaar)));
    const rtg = beleid.waarde('rtgDag.perJaar');
    const gebruikt = (cat) => mijn.filter(b => b.categorie === cat).reduce((s, b) => s + b.afschrijving, 0);
    const vj = Object.values(staat.verjaardagen).find(j => j.persoon === persoon && j.jaar === jaar);
    return {
      vakantie: rechten && rechten.wettelijk != null
        ? { recht: rechten.wettelijk, gebruikt: gebruikt('STATUTORY_LEAVE'), over: rechten.wettelijk - gebruikt('STATUTORY_LEAVE'), eenheid: 'uur', tekst: 'Normaal verlofsaldo' }
        : { recht: null, tekst: 'Normaal verlofsaldo', reden: 'Het saldo komt uit uw contract en payroll en is hier niet aangeleverd.' },
      rtgDagen: rtg.open ? { recht: null, tekst: 'Aanvullende betaalde dagen', reden: rtg.reden }
        : { recht: rtg.waarde, gebruikt: gebruikt('RTG_DAY'), over: rtg.waarde - gebruikt('RTG_DAY'), tekst: 'Een betaalde dag voor uzelf. Geen Academy. Geen werk. Geen uitleg nodig.' },
      verjaardag: vj ? { datum: vj.datum || vj.verjaardag || null, stand: vj.stand, tekst: vj.stand === 'SCHEDULED' ? 'Deze dag is voor u. Uw normale verlofsaldo verandert niet.' : vj.uitleg } : null,
      verzoeken: Object.values(staat.verzoeken).filter(v => v.persoon === persoon).map(v => ({ id: v.id, soort: v.soort, categorie: v.categorie, datum: v.datum, stand: v.stand,
        uitleg: v.afwijzing || v.menselijkeReden || (v.stappen || []).slice(-1).map(s => s.uitleg)[0] || null,
        alternatieven: (v.alternatieven || []).map(a => ({ soort: a.soort, datum: a.datum, vanaf: a.vanaf, zin: a.zin })) })),
      aanbod: Object.values(staat.aanbiedingen).filter(a => a.persoon === persoon && a.stand === 'OFFERED').map(a => ({ id: a.id, datum: a.datum, vanaf: a.vanaf, tekst: a.tekst }))
    };
  }

  function managerBeeld(code, team, vid, door) {
    if (!teamKlopt(code, team)) return fout(403, 'Dit teambeeld hoort niet bij deze organisatie.');
    if (!(team.managers || []).includes(door)) return fout(403, 'Alleen een leidinggevende van dit team.');
    const v = org(code).verzoeken[vid];
    if (!v) return fout(404, 'Verzoek niet gevonden.');
    const std = (n) => { const s = (v.stappen || []).find(x => x.stap === n); return s ? { stand: s.stand, uitleg: s.uitleg } : null; };
    const vertrouwelijk = CATEGORIEEN[v.categorie] && v.categorie === 'SPECIAL_LEAVE';
    return {
      id: v.id, persoon: v.persoon, datum: v.datum, vanaf: v.vanaf, stand: v.stand, uitkomst: v.uitkomst,
      soort: vertrouwelijk ? 'afwezig' : v.categorie,
      werkstand: std('WORK_STATE'), dekking: std('COVERAGE'), bevoegdheden: std('QUALIFICATION_COVERAGE'),
      teamImpact: std('TEAM_IMPACT'), rust: std('REST'), eerlijkheid: std('FAIRNESS'),
      alternatieven: v.alternatieven || [], beleidVersie: v.beleidVersie, rosterVersie: v.rosterVersie,
      reden: vertrouwelijk && v.stand === 'HUMAN_REVIEW' ? (org(code).vertrouwelijk[v.id] || null) : undefined
    };
  }

  function teamBeeld(code, team) {
    if (!teamKlopt(code, team)) return fout(403, 'Dit teambeeld hoort niet bij deze organisatie.');
    const staat = org(code);
    const afwezig = [
      ...Object.values(staat.verzoeken).filter(v => TOEGEKEND.includes(v.stand) && v.afwezigheid),
      ...Object.values(staat.aanbiedingen).filter(a => ['ACCEPTED', 'RECONCILE_PENDING', 'ROSTER_RECONCILED'].includes(a.stand)),
      ...Object.values(staat.verjaardagen).filter(j => j.stand === 'SCHEDULED')
    ].map(OPENBAAR_TEAM);
    return { afwezig, dekkingssignalen: staat.signalen.filter(s => s.soort === 'COVERAGE_GAP_DETECTED').map(s => ({ datum: s.datum, uitleg: s.uitleg })) };
  }

  /* Deterministische uitleg: uit de opgeslagen stappen, nooit verzonnen. Een
     AI mag deze tekst herformuleren, niet aanvullen. */
  function verzoekUitleg(code, vid, persoon) {
    const v = org(code).verzoeken[vid];
    if (!v || v.persoon !== persoon) return fout(404, 'Verzoek niet gevonden.');
    const c = CATEGORIEEN[v.categorie];
    return {
      kostSaldo: c && c.teller ? 'Ja, van ' + (c.teller === 'rtgDag' ? 'uw RTG Days' : 'uw ' + c.naam.toLowerCase() + 'saldo') + '.' : 'Nee. Dit gaat van geen enkel verlofsaldo af.',
      betaald: c && c.betaald === 'ja' ? 'Ja, deze tijd wordt betaald.' : c && c.betaald === 'nee' ? 'Nee, dit is onbetaald.' : 'Dat volgt uit het beleid van uw organisatie.',
      stappen: (v.stappen || []).map(s => ({ stap: s.stap, stand: s.stand, uitleg: s.uitleg })),
      rotatie: v.rotatieUitleg || null,
      beleidVersie: v.beleidVersie, rosterVersie: v.rosterVersie
    };
  }

  function gezondheid(code) {
    const staat = org(code);
    const vv = Object.values(staat.verzoeken);
    const tel = (f) => vv.filter(f).length;
    const beslist = tel(v => v.stand !== 'CHECKING');
    const alt = tel(v => v.uitkomst === 'ALTERNATIVE_AVAILABLE');
    return {
      FREEDOM_REQUEST_APPROVAL_RATE: beslist ? { waarde: tel(v => TOEGEKEND.includes(v.stand)) / beslist, noemer: beslist } : { waarde: null, reden: 'Nog geen besliste verzoeken.' },
      ALTERNATIVE_SUCCESS_RATE: alt ? { waarde: null, reden: 'Nog niet gemeten: een aanvaard alternatief wordt nog niet aan zijn oorsprong gekoppeld.', noemer: alt } : { waarde: null, reden: 'Nog geen alternatieven voorgesteld.' },
      FAIRNESS_CONFLICT_BACKLOG: tel(v => v.stand === 'CHECKING' && v.moment),
      COVERAGE_HEALTH: { openSignalen: staat.signalen.filter(s => s.soort === 'COVERAGE_GAP_DETECTED').length },
      CAPABILITY_COVERAGE: { openBehoeften: staat.behoeften.filter(b => b.stand === 'OPEN').length, vervuld: staat.behoeften.filter(b => b.stand === 'VERVULD').length },
      nietGemeten: ['TIME_FREEDOM_HEALTH', 'REST_COMPLIANCE', 'LEAVE_CONFLICT_RATE'].map(n => ({ naam: n, reden: 'Vraagt feitelijke klokuren of verlofconflicten over tijd; nog niet aangesloten.' }))
    };
  }

  return { mijnTijd, managerBeeld, teamBeeld, verzoekUitleg, gezondheid };
};
