/* Publieke adressen boven op de interne RTG-naamruimte.

   Werk       voor.achternaam@bedrijf.rtg
           -> voor.achternaam@bedrijf.rahultravelgroup.com
   Lid         codenaam@<pas>.rtg
           -> voor.achternaam@<pas>.rahultravelgroup.com
   Foundation  codenaam@rahultravelfoundation.rtg
           -> codenaam@rahultravelfoundation.com

   Domeinen staan alleen aan na expliciete configuratie. Een ledenalias wordt
   server-side uit de kluisnaam en de bewezen pas afgeleid; de browser kan
   lokaal deel noch domein kiezen. */
'use strict';

const PAS = { rtg:'rtgpass', lifestyle:'lifestyle', business:'business' };
const GERESERVEERD = new Set(['rtgpass', 'lifestyle', 'business', 'rahultravelgroup',
  'rahultravelfoundation', 'partner', 'gouvernement']);
const schoon = s => String(s || '').trim().toLowerCase().replace(/^\.+|\.+$/g, '');
const geldigDomein = s => /^(?=.{4,253}$)(?:[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\.)+[a-z]{2,63}$/.test(s)
  && !s.endsWith('.rtg') && !s.endsWith('.example');
const naamLokaal = naam => {
  const delen=String(naam || '').trim().toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '')
    .split(/[^a-z0-9]+/).filter(Boolean);
  if (!delen.length) return '';
  return (delen.length === 1 ? delen[0] : delen[0] + '.' + delen[delen.length - 1]).slice(0, 48);
};

module.exports = ({ basis, groepDomein, foundationDomein, accounts } = {}) => {
  const groep=schoon(groepDomein == null
    ? (basis == null ? process.env.RTG_MAIL_PUBLIEK_BASIS : basis) : groepDomein);
  const foundation=schoon(foundationDomein == null ? process.env.RTF_MAIL_PUBLIEK_DOMEIN : foundationDomein);
  const groepActief=geldigDomein(groep), foundationActief=geldigDomein(foundation);
  const normAdres = a => String(a || '').trim().toLowerCase();
  const internDelen = a => /^([a-z0-9._-]{1,64})@([a-z0-9-]{1,63})\.rtg$/.exec(normAdres(a));

  function bedrijf(internAdres) {
    if (!groepActief) return null;
    const m=internDelen(internAdres);
    return m && !GERESERVEERD.has(m[2]) ? m[1] + '@' + m[2] + '.' + groep : null;
  }
  function foundationAdres(internAdres) {
    if (!foundationActief) return null;
    const m=internDelen(internAdres);
    return m && m[2] === 'rahultravelfoundation' ? m[1] + '@' + foundation : null;
  }
  function geefLid({ user, naam, tier } = {}) {
    const sub=PAS[String(tier || (user && user.tier) || '').toLowerCase()];
    const lokaal=naamLokaal(naam);
    if (!groepActief || !sub || !lokaal || !accounts || !user || !accounts.reservePublicMail) return null;
    return accounts.reservePublicMail(user.id, lokaal, sub + '.' + groep);
  }
  function publiek(internAdres) {
    return foundationAdres(internAdres) || bedrijf(internAdres);
  }
  function vind(publiekAdres) {
    const a=normAdres(publiekAdres);
    if (foundationActief && a.endsWith('@' + foundation)) {
      const lokaal=a.slice(0, -foundation.length - 1);
      return lokaal ? { soort:'foundation', publiek:a,
        intern:lokaal + '@rahultravelfoundation.rtg' } : null;
    }
    if (groepActief && accounts && accounts.findByPublicMail) {
      const user=accounts.findByPublicMail(a);
      if (user && user.actief !== 0 && PAS[user.tier] && a.endsWith('@' + PAS[user.tier] + '.' + groep)) {
        return { soort:'lid', publiek:a, userId:Number(user.id),
          intern:String(user.codename || '').toLowerCase().replace(/[^a-z0-9._-]/g, '') + '@' + PAS[user.tier] + '.rtg' };
      }
    }
    if (!groepActief) return null;
    const suffix='.' + groep;
    const at=a.lastIndexOf('@');
    if (at < 1 || !a.slice(at + 1).endsWith(suffix)) return null;
    const sub=a.slice(at + 1, -suffix.length);
    if (!sub || GERESERVEERD.has(sub) || !/^[a-z0-9-]{1,63}$/.test(sub)) return null;
    return { soort:'bedrijf', publiek:a, intern:a.slice(0, at) + '@' + sub + '.rtg' };
  }
  const intern = a => { const r=vind(a); return r && r.intern; };
  const hoortBij = (internAdres, publiekAdres) => publiek(internAdres) === normAdres(publiekAdres);
  return { actief:groepActief || foundationActief, basis:groepActief ? groep : null,
    groepActief, groepDomein:groepActief ? groep : null,
    foundationActief, foundationDomein:foundationActief ? foundation : null,
    publiek, bedrijf, foundationAdres, geefLid, vind, intern, hoortBij,
    naamLokaal, pasSubdomein:t => PAS[String(t || '').toLowerCase()] || null,
    isGereserveerdWerkDomein:d => { const m=/^([a-z0-9-]+)\.rtg$/.exec(schoon(d)); return !!(m && GERESERVEERD.has(m[1])); } };
};
