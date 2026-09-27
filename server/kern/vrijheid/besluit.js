/* VRIJHEID: DE BESLISWEG -- "is er een concrete reden waarom dit niet kan?"

   REQUEST -> ELIGIBILITY -> RIGHTS/POLICY -> WORK STATE -> COVERAGE ->
   QUALIFICATION COVERAGE -> TEAM IMPACT -> REST -> FAIRNESS -> DECISION

   Elke stap zet een stand EN een zin. Wie nee krijgt, krijgt de zin van de
   stap die nee zei -- er bestaat geen weigering zonder reden (EXPLAIN EVERY
   NO). En voor een nee wordt eerst naar een alternatief gezocht: later weg,
   een andere dag, of een gekwalificeerde collega die vrijwillig wil dekken
   (ALTERNATIVE BEFORE DECLINE).

   Deze functie is PUUR: zij krijgt het team, het beleid, de al toegekende
   afwezigheid en het grootboek, en beslist. Zij schrijft niets en bezit niets;
   index.js legt vast. Zo is elk besluit na te rekenen met dezelfde invoer, en
   draagt het de versie van het beleid en van het rooster waarop het rustte.

   Wat hier NIET in komt: waarom iemand vrij wil. Voor gewone persoonlijke tijd
   is dat geen vraag (PRIVACY BY DESIGN), en voor bijzonder verlof leest alleen
   de mens die beoordeelt het -- niet deze functie. */
'use strict';
const T = require('./tijd');
const D = require('./dekking');
const { werkstand } = require('./werkstand');
const { rustToets } = require('./rust');
const { oneerlijkeOverdracht } = require('./eerlijkheid');
const { CATEGORIEEN } = require('./categorieen');

const UITKOMSTEN = Object.freeze(['AUTO_APPROVED', 'APPROVED', 'ALTERNATIVE_AVAILABLE', 'HUMAN_REVIEW_REQUIRED',
  'DECLINED', 'BLOCKED_BY_LAW_OR_POLICY', 'UNKNOWN', 'ROTATION']);
const AANVRAAGBAAR = Object.freeze(['STATUTORY_LEAVE', 'CONTRACTUAL_LEAVE', 'RTG_DAY', 'SCHEDULE_FLEXIBILITY', 'SPECIAL_LEAVE', 'UNPAID_LEAVE']);
const ALTIJD_MENS = Object.freeze(['SPECIAL_LEAVE', 'UNPAID_LEAVE']);

const { afwezigheidVan, alternatieven } = require('./alternatief');

function beoordeel({ team, beleid, verzoek: v, afwezig, grootboek, saldi, vandaag }) {
  const stappen = [];
  const stap = (naam, stand, uitleg) => { stappen.push({ stap: naam, stand, uitleg }); };
  const klaar = (uitkomst, extra) => ({ uitkomst, stappen, beleidVersie: beleid.versie, rosterVersie: team.rosterVersie || null, ...extra });

  /* ELIGIBILITY */
  const mens = (team.mensen || []).find(m => m.id === v.persoon);
  if (!D.inDienst(mens, v.datum)) { stap('ELIGIBILITY', 'BLOCKED', 'Op ' + v.datum + ' loopt er geen dienstverband.'); return klaar('BLOCKED_BY_LAW_OR_POLICY'); }
  stap('ELIGIBILITY', 'OK', 'Dienstverband loopt op ' + v.datum + '.');

  /* RIGHTS/POLICY */
  if (!AANVRAAGBAAR.includes(v.categorie)) { stap('RIGHTS_POLICY', 'BLOCKED', CATEGORIEEN[v.categorie] ? CATEGORIEEN[v.categorie].naam + ' wordt niet aangevraagd maar door RTG gepland of door een mens toegekend.' : 'Onbekende categorie.'); return klaar('BLOCKED_BY_LAW_OR_POLICY'); }
  const afw = afwezigheidVan(team, v);
  if (!afw) { stap('RIGHTS_POLICY', 'NIET_NODIG', 'U staat op ' + v.datum + ' niet (op dat tijdstip) ingeroosterd; er hoeft niets vrij te worden gemaakt en er wordt niets afgeschreven.'); return klaar('DECLINED', { code: 'geen-dienst' }); }
  const uren = (afw.tot - afw.van) / 60;
  if (v.categorie === 'RTG_DAY') {
    const r = beleid.waarde('rtgDag.perJaar');
    if (r.open) { stap('RIGHTS_POLICY', 'BLOCKED', r.reden); return klaar('BLOCKED_BY_LAW_OR_POLICY'); }
  }
  const teller = CATEGORIEEN[v.categorie].teller;
  if (teller) {
    const s = saldi && saldi[teller];
    if (!s || s.recht == null) { stap('RIGHTS_POLICY', 'UNKNOWN', 'Het saldo voor ' + CATEGORIEEN[v.categorie].naam + ' is niet bekend.'); return klaar('UNKNOWN'); }
    const nodig = teller === 'rtgDag' ? 1 : uren;
    if (s.over < nodig) { stap('RIGHTS_POLICY', 'DECLINED', 'Er staat nog ' + s.over + ' over; nodig is ' + nodig + '.'); return klaar('DECLINED', { code: 'saldo' }); }
  }
  stap('RIGHTS_POLICY', 'OK', CATEGORIEEN[v.categorie].naam + ' past binnen de rechten' + (teller ? '' : ' en wordt van geen saldo afgeschreven') + '.');

  /* WORK STATE -- alleen op de dag zelf; vooraf is er nog geen werkstand. */
  let ws = null;
  if (vandaag && v.datum === vandaag && v.soort === 'EERDER_WEG') {
    ws = werkstand(team, v.persoon, v.datum);
    stap('WORK_STATE', ws.stand, ws.uitleg);
  } else stap('WORK_STATE', 'NVT', 'Vooraf aangevraagd; de werkstand wordt op de dag zelf bekeken bij de overdracht.');

  /* Een VERVANGER draagt het werk tijdens de afwezigheid. Dat telt voor de
     dekking alleen als hij instemt, en het gaat langs rust en eerlijkheid. */
  let dekTeam = team; const vervangers = [];
  if (v.vervanger && v.vervanger.persoon) {
    const nieuw = { persoon: v.vervanger.persoon, datum: v.datum, van: T.klokVan(afw.van), tot: T.klokVan(afw.tot) };
    vervangers.push({ persoon: v.vervanger.persoon, instemming: v.vervanger.instemming === true, rust: rustToets(team, v.vervanger.persoon, nieuw, beleid) });
    if (v.vervanger.instemming === true) dekTeam = { ...team, diensten: (team.diensten || []).concat([nieuw]) };
  }

  /* COVERAGE + QUALIFICATION COVERAGE */
  const dek = D.toets(dekTeam, afw, afwezig);
  const bezetting = dek.gaten.filter(g => g.ontbreekt === 'bezetting');
  const bevoegd = dek.gaten.filter(g => g.ontbreekt !== 'bezetting');
  stap('COVERAGE', dek.stand === 'UNKNOWN' ? 'UNKNOWN' : bezetting.length ? 'GAP' : 'SAFE', bezetting.length ? dek.uitleg : dek.stand === 'UNKNOWN' ? dek.uitleg : 'De bezetting blijft op het minimum of erboven.');
  stap('QUALIFICATION_COVERAGE', dek.stand === 'UNKNOWN' ? 'UNKNOWN' : bevoegd.length ? 'GAP' : 'SAFE', bevoegd.length ? dek.uitleg : 'Alle vereiste bevoegdheden blijven aanwezig.');
  const blokkades = [...new Set(dek.gaten.map(g => g.ontbreekt))];

  if (dek.stand === 'GAP' || (ws && ws.stand === 'CRITICAL_WORK_REMAINS')) {
    const alt = alternatieven(team, v, afwezig, dek.gaten);
    stap('TEAM_IMPACT', 'NVT', 'Niet beoordeeld: het gevraagde moment kan niet.');
    return klaar(alt.length ? 'ALTERNATIVE_AVAILABLE' : 'DECLINED', { alternatieven: alt, blokkades, afwezigheid: afw, uren, code: alt.length ? null : 'geen-alternatief' });
  }
  if (dek.stand === 'UNKNOWN') return klaar('HUMAN_REVIEW_REQUIRED', { afwezigheid: afw, uren, blokkades });

  /* TEAM IMPACT -- in woorden, niet als score. */
  stap('TEAM_IMPACT', dek.marge > 0 ? 'LOW' : 'AT_MINIMUM', dek.marge > 0 ? 'Het team blijft boven de minimale bezetting.' : 'Het team zit dan precies op de minimale bezetting.');

  /* REST -- bij een ruil verandert iemands dienst; anders niet. */
  if (v.soort === 'SHIFT_SWAP' && v.nieuweDienst) {
    const r = rustToets(team, v.ruilMet, { ...v.nieuweDienst }, beleid);
    stap('REST', r.stand, r.uitleg);
    if (r.stand !== 'SAFE') return klaar(r.stand === 'UNKNOWN' ? 'HUMAN_REVIEW_REQUIRED' : 'DECLINED', { afwezigheid: afw, uren, code: 'rust' });
  } else if (vervangers.length) stap('REST', vervangers[0].rust.stand, vervangers[0].rust.uitleg);
  else stap('REST', 'NVT', 'Niemand krijgt een andere dienst.');

  /* FAIRNESS */
  const schaars = (team.schaars || []).find(s => s.datum === v.datum);
  if (schaars) { stap('FAIRNESS', 'ROTATION', 'Dit is een schaars moment (' + schaars.moment + '); het wordt eerlijk verdeeld via de rotatie en niet op volgorde van aanvragen.'); return klaar('ROTATION', { afwezigheid: afw, uren, moment: schaars.moment }); }
  const eer = oneerlijkeOverdracht(vervangers, grootboek, beleid, v.datum);
  stap('FAIRNESS', eer.stand, eer.stand === 'FAIR' ? 'Niemand draagt hierdoor werk dat niet van hem is.' : eer.bezwaren.map(b => b.uitleg).join(' '));
  if (eer.stand === 'UNFAIR') return klaar('ALTERNATIVE_AVAILABLE', { alternatieven: alternatieven(team, v, afwezig, dek.gaten), afwezigheid: afw, uren, code: 'NO_UNFAIR_TRANSFER' });
  if (eer.stand === 'UNKNOWN') return klaar('HUMAN_REVIEW_REQUIRED', { afwezigheid: afw, uren });

  /* DECISION */
  if (ALTIJD_MENS.includes(v.categorie)) { stap('DECISION', 'HUMAN', 'Deze verlofsoort wordt altijd door een mens beoordeeld.'); return klaar('HUMAN_REVIEW_REQUIRED', { afwezigheid: afw, uren }); }
  if (ws && ws.stand !== 'WORK_COMPLETE' && ws.stand !== 'HANDOVER_POSSIBLE') { stap('DECISION', 'HUMAN', 'De werkstand is ' + ws.stand + '; een mens kijkt mee.'); return klaar('HUMAN_REVIEW_REQUIRED', { afwezigheid: afw, uren }); }
  if (v.soort === 'EERDER_WEG' || v.soort === 'LATER_BEGINNEN') {
    const grens = beleid.waarde('vroegVertrek.autoTotMinuten');
    if (grens.open) { stap('DECISION', 'HUMAN', grens.reden); return klaar('HUMAN_REVIEW_REQUIRED', { afwezigheid: afw, uren }); }
    if (uren * 60 > grens.waarde) { stap('DECISION', 'HUMAN', 'Meer dan ' + grens.waarde + ' minuten; een mens beoordeelt.'); return klaar('HUMAN_REVIEW_REQUIRED', { afwezigheid: afw, uren }); }
  }
  stap('DECISION', 'OK', 'Er is geen concrete reden waarom dit niet kan.');
  return klaar('AUTO_APPROVED', { afwezigheid: afw, uren, vervanger: vervangers.length ? vervangers[0].persoon : null });
}

module.exports = { UITKOMSTEN, AANVRAAGBAAR, beoordeel, afwezigheidVan, alternatieven };
