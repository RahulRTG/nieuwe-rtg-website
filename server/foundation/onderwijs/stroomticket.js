/* Het stroomticket van een RTFoundation-les (RELEASEKANDIDAAT.md B25; deur
   foundation.onderwijs_les_tokens in CODECREDENTIALS.json).

   WAAROM ER EEN TICKET IS. Een leraar- of leerlingsleutel reist sinds B25 in
   de kop `Authorization: Bearer` of in het lijf, nooit meer in het adres: een
   URL belandt in serverlogs, proxylogs en de browsergeschiedenis. Een
   EventSource kan echter geen koppen sturen. Daarom ruilt het scherm zijn
   sleutel (in de kop) eerst voor een ticket, en alleen dat ticket staat in het
   adres van de stroom. Wat er dan in een log belandt is waardeloos:

   - 128 bits uit kern/bearercode.js (LESST.<32 hex>), op schijf alleen als hash;
   - dertig seconden geldig -- genoeg om de stroom te openen, en niet meer;
   - EENMALIG: het openen van de stroom haalt het ticket in dezelfde
     collectietransactie weg (PG: advisory lock + FOR UPDATE), dus twee
     gelijktijdige openingen krijgen er samen precies een;
   - gebonden aan DEZE les en aan de rol (leraar, of leerling plus zijn id).
     Bij het openen wordt de onderliggende sleutel opnieuw getoetst: een
     ingetrokken leerling of een gesloten les opent niets, ook niet met een
     ticket dat hij een seconde eerder kreeg.

   Er is (nog) geen generiek stroomticket in dit huis; dit is een klein eigen
   mechanisme voor de lesstroom. Komt er een gedeeld mechanisme (de
   gezinsstroom heeft dezelfde vraag), dan kunnen de twee samen. */
'use strict';

const GELDIG_MS = 30000;
const MAX_OPEN = 200; // per les: een klas van zestig met een paar herverbindingen
const DOEL = 'foundation-les-stroom';
const SCOPE = ['les.stroom'];
const NEE = Object.freeze({ status: 403, error: 'Deze toegang tot de les is verlopen of ingetrokken.' });
const ONBEKEND = Object.freeze({ status: 404, error: 'Deze les kennen we niet.' });

module.exports = ({ bearer, transactie, dicht, kaal, nu, DOEL: SLEUTELDOEL, SCOPE: SLEUTELSCOPE }) => {
  const levend = t => !!t && Date.parse(t.expires_at) > Date.parse(nu());

  /* Wie draagt deze sleutel binnen de les? Elke sleutel wordt vergeleken,
     zonder vroege uitgang (dezelfde vorm als vanSleutel in ./toegang.js). */
  function wie(les, sleutel) {
    const gezocht = bearer.hash(kaal(sleutel));
    let rol = null, studentId = null;
    if (les.leraar && bearer.zelfdeHash(les.leraar.code_hash, gezocht)) rol = 'leraar';
    for (const [sid, t] of Object.entries(les.leerlingen || {}))
      if (t && bearer.zelfdeHash(t.code_hash, gezocht)) { rol = 'leerling'; studentId = sid; }
    return rol ? { rol, studentId } : null;
  }
  function sleutelGeldig(les, rol, studentId) {
    if (rol !== 'leraar' && rol !== 'leerling') return false;
    const t = rol === 'leraar' ? les.leraar : (les.leerlingen || {})[String(studentId || '')];
    return !!t && !dicht(les) && !!t.onderwerp && t.onderwerp.les === les.id &&
      !bearer.reden(t, { doel: SLEUTELDOEL[rol], scope: SLEUTELSCOPE[rol], negeerGebruik: true });
  }

  /* Uitgifte: de sleutel wordt BINNEN de transactie opnieuw getoetst. */
  function geef(lesId, sleutel) {
    return transactie(lessen => {
      const les = lessen[String(lesId || '')];
      if (!les || !les.leraar) return ONBEKEND;
      const w = kaal(sleutel) ? wie(les, sleutel) : null;
      if (!w || !sleutelGeldig(les, w.rol, w.studentId)) return NEE;
      les.stroomtickets = (les.stroomtickets || []).filter(levend);
      if (les.stroomtickets.length >= MAX_OPEN)
        return { status: 429, error: 'Er staan te veel verbindingen tegelijk open voor deze les; probeer het zo weer.' };
      const onderwerp = { soort: 'foundation-les', les: les.id, rol: w.rol };
      if (w.studentId) onderwerp.leerling = w.studentId;
      const m = bearer.maak({ prefix: 'LESST', issuer: 'rtfoundation-onderwijs', doel: DOEL, scope: SCOPE,
        onderwerp, geldigMs: GELDIG_MS, maxGebruik: 1 });
      les.stroomtickets.push(m.toegang);
      return { ok: true, ticket: m.code, rol: w.rol, verloopt: m.toegang.expires_at };
    });
  }

  /* Openen: DE claim. Het gevonden ticket gaat altijd weg -- ook als het al
     verlopen is of de sleutel eronder niet meer geldt -- zodat geen tweede
     opening het nog kan gebruiken. Een ticket van een andere les staat niet in
     deze les en wordt dus nooit gevonden. */
  function claim(lesId, ticket) {
    return transactie(lessen => {
      const les = lessen[String(lesId || '')];
      if (!les || !les.leraar) return ONBEKEND;
      const lijst = Array.isArray(les.stroomtickets) ? les.stroomtickets : [];
      const t = kaal(ticket) ? bearer.vind(lijst, ticket) : null;
      les.stroomtickets = lijst.filter(x => x !== t && levend(x));
      if (!t || bearer.reden(t, { doel: DOEL, scope: SCOPE })) return NEE;
      const o = t.onderwerp || {};
      if (o.les !== les.id || !sleutelGeldig(les, o.rol, o.leerling)) return NEE;
      return { ok: true, lesId: les.id, rol: o.rol, studentId: o.rol === 'leerling' ? o.leerling : null };
    });
  }

  return { stroomticket: geef, claimStroom: claim };
};

module.exports.GELDIG_MS = GELDIG_MS;
module.exports.MAX_OPEN = MAX_OPEN;
module.exports.DOEL = DOEL;
