/* De tekst bij een versienummer blijft vast. Oude ontvangsten zonder bewaarde
   tekst blijven oud bewijs; een latere tekst mag dat gat niet opvullen. */
'use strict';
const { veiligGelijk } = require('../util');
const momentopname = c => ({ versie: c.versie, titel: c.titel, tekst: c.tekst });
const zelfdeContract = (a, b) => !!a && !!b && a.versie === b.versie && a.titel === b.titel && a.tekst === b.tekst;
const versieConflict = () => ({ status: 409, code: 'version_conflict',
  error: 'De overeenkomst is gewijzigd. Lees de actuele versie en geef opnieuw akkoord.' });
function ontvangstVan(p, scope, versie) {
  const huidig = (p.ondertekend || {})[scope];
  return ((p.ondertekeningen || {})[scope] || {})[versie] || (huidig && huidig.versie === versie ? huidig : null);
}
function afdruk(crypto, c, naam, pid, scope, hashVersie) {
  const inhoud = hashVersie === 1 ? c.versie + '|' + c.tekst + '|' + naam + '|' + pid
    : hashVersie === 2 ? JSON.stringify(['rtg-onboarding-ontvangst', 2, scope, pid, c.versie, c.titel, c.tekst, naam]) : null;
  if (inhoud === null) return null;
  return crypto.createHash('sha256').update(inhoud).digest('hex');
}
function geldig(crypto, sc, o, pid, scope) {
  const vast = (sc.contractVersies || {})[sc.contract.versie];
  return !!(o && typeof o.hash === 'string' && o.versie === sc.contract.versie &&
    veiligGelijk(o.hash, afdruk(crypto, sc.contract, o.naam, pid, scope, o.hashVersie || 1)) &&
    (!o.contract || zelfdeContract(o.contract, sc.contract)) && (!vast || zelfdeContract(vast, sc.contract)));
}
function bewaarContract(sc) {
  const eerder = sc.contractVersies && sc.contractVersies[sc.contract.versie];
  if (eerder) return zelfdeContract(eerder, sc.contract);
  if (!sc.contractVersies) sc.contractVersies = {};
  sc.contractVersies[sc.contract.versie] = momentopname(sc.contract);
  return true;
}
function ondertekeningVoorbereiden(sc, p, scope, naam, hash) {
  const huidig = (p.ondertekend || {})[scope];
  const geschiedenis = (p.ondertekeningen || {})[scope] || {};
  const bestaand = ontvangstVan(p, scope, sc.contract.versie);
  if (bestaand && bestaand.naam !== naam) return { status: 409, code: 'name_conflict',
    error: 'Deze versie is al met een andere naam ondertekend. De bestaande ontvangst blijft behouden.' };
  if (bestaand && (!hash || !veiligGelijk(bestaand.hash, hash) || (bestaand.contract && !zelfdeContract(bestaand.contract, sc.contract))))
    return versieConflict();
  const bewaardeVersie = (sc.contractVersies || {})[sc.contract.versie];
  if (bewaardeVersie && !zelfdeContract(bewaardeVersie, sc.contract)) return versieConflict();
  if (bestaand && geschiedenis[sc.contract.versie]) return { herhaald: true, gewijzigd: false };
  bewaarContract(sc);
  if (!p.ondertekeningen) p.ondertekeningen = {};
  if (!p.ondertekeningen[scope]) p.ondertekeningen[scope] = {};
  if (huidig && !p.ondertekeningen[scope][huidig.versie]) {
    // Een onbekende oude tekst blijft onbekend; niet de nieuwe tekst eraan hangen.
    p.ondertekeningen[scope][huidig.versie] = JSON.parse(JSON.stringify(huidig));
  }
  if (bestaand) {
    // De legacy-hash bewijst geen titel. Geef de oude rij dus geen nieuwe
    // momentopname onder haar historische tijdstip, ook niet bij een retry.
    p.ondertekeningen[scope][sc.contract.versie] = JSON.parse(JSON.stringify(bestaand));
    return { herhaald: true, gewijzigd: true };
  }
  return { herhaald: false };
}
module.exports = { momentopname, zelfdeContract, bewaarContract, versieConflict,
  bereidVoor: ondertekeningVoorbereiden, ontvangstVan, afdruk, geldig };
