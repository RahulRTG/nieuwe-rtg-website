/* Zetten en roteren van het SSO-clientgeheim (zie ./clientgeheim.js voor de
   opslag, de sleutel per tenant en de grenzen). Los bestand omdat rotatie een
   eigen onderwerp is: wat er met het vorige geheim gebeurt, en hoe lang. */
'use strict';
const g = require('./clientgeheim');

function vervalVan(opties, t) {
  const o = opties || {};
  if (o.vervalt != null && o.vervalt !== '') {
    const v = Date.parse(o.vervalt);
    if (!Number.isFinite(v) || v <= t) throw g.fout('VERVAL_ONGELDIG', 'De vervaldatum moet een datum in de toekomst zijn.');
    if (v > t + g.GRENS.maxDagen * g.DAG) throw g.fout('VERVAL_ONGELDIG', 'Een clientgeheim geldt hoogstens ' + g.GRENS.maxDagen + ' dagen.');
    return new Date(v).toISOString();
  }
  const d = o.dagen == null || o.dagen === '' ? g.GRENS.standaardDagen : Number(o.dagen);
  if (!Number.isInteger(d) || d < 1 || d > g.GRENS.maxDagen)
    throw g.fout('VERVAL_ONGELDIG', 'Geef een geldigheid van 1 tot ' + g.GRENS.maxDagen + ' dagen.');
  return new Date(t + d * g.DAG).toISOString();
}

/* Zet of roteer. Het huidige geldige slot blijft `overlapDagen` bruikbaar (0 =
   meteen weg), nooit langer dan zijn eigen verval. Hetzelfde geheim nog eens
   zetten verandert niets: een herhaalde aanvraag maakt geen overlap met zichzelf. */
function roteer(org, geheim, waarde, opties, nu) {
  const probleem = g.sleutelProbleem();
  if (probleem) throw g.fout('SLEUTEL_ONTBREEKT', 'Het clientgeheim is niet bewaard: ' + probleem + '.', 503);
  if (typeof geheim !== 'string' || !geheim.length || geheim.length > g.GRENS.maxLengte)
    throw g.fout('GEHEIM_ONGELDIG', 'Geef het clientgeheim als tekst van 1 tot ' + g.GRENS.maxLengte + ' tekens.');
  const t = nu == null ? Date.now() : nu;
  const o = opties || {};
  const overlap = o.overlapDagen == null || o.overlapDagen === '' ? g.GRENS.standaardOverlap : Number(o.overlapDagen);
  if (!Number.isInteger(overlap) || overlap < 0 || overlap > g.GRENS.maxOverlap)
    throw g.fout('OVERLAP_ONGELDIG', 'De overlap is 0 tot ' + g.GRENS.maxOverlap + ' dagen.');
  const vervalt = vervalVan(o, t);
  const basis = g.migreer(org, waarde, t) || waarde;
  const huidig = g.geldige(org, basis, t);
  const oudSlot = g.lees(basis).sloten.find(s => g.inTijd(s, t));
  if (huidig.geheimen[0] === geheim) return { waarde: basis, ongewijzigd: true };
  const sloten = [g.zegelSlot(org, geheim, { gezet: new Date(t).toISOString(), vervalt })];
  if (overlap > 0 && huidig.geheimen.length && oudSlot) {
    const tot = new Date(Math.min(g.vervaltOp(oudSlot), t + overlap * g.DAG)).toISOString();
    sloten.push(g.zegelSlot(org, huidig.geheimen[0], { gezet: oudSlot.gezet, vervalt: oudSlot.vervalt, tot,
      gemigreerd: oudSlot.gemigreerd }));
  }
  return { waarde: g.schrijf(sloten), ongewijzigd: false };
}

/* De overlap eerder beeindigen: de klant is over, het oude geheim hoeft niet meer. */
function sluitOverlap(org, waarde, nu) {
  const t = nu == null ? Date.now() : nu;
  const l = g.lees(waarde);
  const levend = l.sloten.filter(s => g.inTijd(s, t));
  if (l.soort !== 'v2' || levend.length < 2) throw g.fout('GEEN_OVERLAP', 'Er loopt voor deze koppeling geen overlap.', 409);
  return g.schrijf([levend[0]]);
}

module.exports = { roteer, sluitOverlap, vervalVan };
