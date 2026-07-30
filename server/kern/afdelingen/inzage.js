/* Afdelingen (deelmodule): de identiteitskluis-inzage. Klantdata draait
   overal op codenamen; de echte naam staat in de gescheiden kluis
   (accounts.js). Kamers die klanten echt moeten kunnen aanspreken (vlag
   naamInzage op de kamer) en de boardroom mogen de naam bij een codenaam
   opvragen. Elke opvraging, ook zonder treffer, komt in het auditlog:
   inzage is een handeling, geen bladerfunctie. */
const inzagelog = require('../../inzagelog');

module.exports = (ctx) => {
  const { AFDELINGEN, accounts, keyVanCodenaam } = ctx;
  const audit = (wie, wat) => ctx.audit(wie, wat);

  async function naamInzage(kamerId, codenaam, wie) {
    const kamer = kamerId === 'boardroom' ? { naam: 'Boardroom', naamInzage: true } : AFDELINGEN[kamerId];
    if (!kamer) return { status: 404, error: 'Deze kamer bestaat niet.' };
    if (!kamer.naamInzage) return { status: 403, error: 'Deze kamer heeft geen inzage in de identiteitskluis. Alleen kamers die klanten bij naam moeten kennen (en de boardroom) mogen dit.' };
    const c = String(codenaam || '').replace(/[<>]/g, '').trim().slice(0, 60);
    if (!c) return { status: 400, error: 'Welke codenaam wilt u opzoeken?' };
    const tref = await keyVanCodenaam(c);
    audit(String(wie || kamer.naam).replace(/[<>]/g, '').slice(0, 30),
      'Identiteitskluis: naam opgevraagd bij codenaam "' + c + '" vanuit ' + kamer.naam + (tref ? '' : ' (geen treffer)'));
    if (!tref) return { status: 404, error: 'Geen lid gevonden met deze codenaam.' };
    const m = /^user-(\d+)$/.exec(String(tref.key || ''));
    const u = m ? accounts.getUserById(Number(m[1])) : null;
    if (!u) return { status: 404, error: 'Bij deze codenaam hoort geen accountdossier (demo-persona of gast zonder account).' };
    /* Ook naar het centrale inzagejournaal. Het kantoor-auditlog hierboven is
       van het kantoor; dit journaal is van de betrokkene -- daar kan een lid
       later opvragen wie in ZIJN dossier heeft gekeken (AVG art. 15). Twee
       lezers, twee doelen, dus twee sporen. */
    try {
      inzagelog.noteer({
        door: { naam: String(wie || kamer.naam) },
        over: { id: u.id, codenaam: tref.codename },
        waarom: 'Naam opgevraagd bij codenaam vanuit ' + kamer.naam,
        bron: 'kantoren/' + kamerId
      });
    } catch (e) {}
    return { ok: true, inzage: { codenaam: tref.codename, pas: tref.tier, naam: accounts.realNameOf(u), email: accounts.emailOf(u) } };
  }

  return { naamInzage };
};
