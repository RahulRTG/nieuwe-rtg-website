/* Een specifiek aanbod gebruikt de bestaande onboarding-ontvangstengine.
   Geen gedeelde scope: de naam en ontvangst wonen alleen in het eigen profiel. */
'use strict';
const crypto = require('node:crypto');
const ontvangst = require('../onboarding/ontvangst');
const { fout, kopie, object, canon, aanbodGeldig } = require('./abonnementsaanbod-vorm');

function valideOndertekening(c, onboarding) {
  try {
    if (!aanbodGeldig(c) || !c.ondertekening) return false;
    const a = c.aanbod, scope = 'abonnement:' + c.id, pid = 'user-' + c.accountId;
    const p = onboarding && onboarding.profielen && onboarding.profielen[pid];
    if (!p) return false;
    const r = ontvangst.ontvangstVan(p, scope, a.versie), m = r && r.doorlopendeBetaling;
    const sc = { contract: { versie: a.versie, titel: a.titel, tekst: a.tekst } };
    return !!(r && r.aanbodHash === a.hash && r.hashVersie === 2 &&
      ontvangst.geldig(crypto, sc, r, pid, scope) && m && m.akkoord === true &&
      m.aanbodHash === a.hash && m.tekst === a.voorwaarden.mandaatTekst && m.at === r.at &&
      canon(c.ondertekening) === canon({ scope, profiel: pid, versie: r.versie, hash: r.hash, at: r.at }));
  } catch (_) { return false; }
}

module.exports = (data, c, input, at) => {
  const a = c.aanbod, scope = 'abonnement:' + c.id, pid = 'user-' + c.accountId;
  if (input.akkoord !== true) return fout(400, 'Geef expliciet akkoord op dit individuele aanbod.');
  if (input.doorlopendeBetalingAkkoord !== true)
    return fout(400, 'Geef afzonderlijk toestemming voor de automatische abonnementstermijnen.');
  if (typeof input.naam !== 'string') return fout(400, 'Typ uw volledige naam om te ondertekenen.');
  const naam = input.naam.trim();
  if (naam.length < 2 || naam.length > 80 || /[<>\u0000-\u001f]/.test(naam))
    return fout(400, 'Typ uw volledige naam van 2 tot 80 tekens zonder opmaak.');
  const ob = data.onboarding;
  if (!object(ob) || ob.profielen != null && !object(ob.profielen))
    return fout(503, 'Het ontvangstarchief vereist herstel.');
  if (!ob.profielen) ob.profielen = {};
  if (ob.profielen[pid] != null && !object(ob.profielen[pid])) return fout(503, 'Het ontvangstprofiel vereist herstel.');
  const p = ob.profielen[pid] || (ob.profielen[pid] = { velden: {}, ondertekend: {} });
  const sc = { contract: { versie: a.versie, titel: a.titel, tekst: a.tekst } };
  const eerder = ontvangst.ontvangstVan(p, scope, a.versie);
  const hash = ontvangst.afdruk(crypto, sc.contract, naam, pid, scope, eerder ? eerder.hashVersie || 1 : 2);
  const voorbereid = ontvangst.bereidVoor(sc, p, scope, naam, hash);
  if (voorbereid.error) return voorbereid;
  if (voorbereid.herhaald) {
    if (!ontvangst.geldig(crypto, sc, eerder, pid, scope) || !eerder.doorlopendeBetaling ||
        eerder.doorlopendeBetaling.akkoord !== true || eerder.doorlopendeBetaling.aanbodHash !== a.hash ||
        eerder.doorlopendeBetaling.tekst !== a.voorwaarden.mandaatTekst)
      return fout(503, 'De bestaande ontvangst bewijst niet alle toestemmingen; herstel is nodig.');
    return { ok: true, herhaald: true, bewijs: { scope, profiel: pid, versie: eerder.versie, hash: eerder.hash, at: eerder.at } };
  }
  if (c.status !== 'AANGEBODEN') return fout(409, 'Dit contract kan niet voor het eerst worden ondertekend.');
  const r = { versie: a.versie, naam, at, hash, hashVersie: 2,
    meaningId: 'identity.agreement.accept', meaningVersion: 1, contract: ontvangst.momentopname(sc.contract),
    aanbodHash: a.hash, doorlopendeBetaling: { akkoord: true, aanbodHash: a.hash, tekst: a.voorwaarden.mandaatTekst, at } };
  if (!p.ondertekend) p.ondertekend = {};
  p.ondertekend[scope] = r;
  p.ondertekeningen[scope][a.versie] = kopie(r);
  return { ok: true, herhaald: false, bewijs: { scope, profiel: pid, versie: a.versie, hash, at } };
};
module.exports.valideOndertekening = valideOndertekening;
