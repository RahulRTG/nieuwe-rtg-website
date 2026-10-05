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

   De mechaniek is sinds 4 oktober 2026 gedeeld met de gezinsstroom
   (kern/stroomticket.js); hier blijven het voorvoegsel, de dertig seconden,
   het plafond per les, de opslag in de les en de antwoorden van de route. */
'use strict';

const GELDIG_MS = 30000;
const MAX_OPEN = 200; // per les: een klas van zestig met een paar herverbindingen
const DOEL = 'foundation-les-stroom';
const SCOPE = ['les.stroom'];
const NEE = Object.freeze({ status: 403, error: 'Deze toegang tot de les is verlopen of ingetrokken.' });
const ONBEKEND = Object.freeze({ status: 404, error: 'Deze les kennen we niet.' });

module.exports = ({ bearer, transactie, dicht, kaal, nu, DOEL: SLEUTELDOEL, SCOPE: SLEUTELSCOPE }) => {
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

  /* De gedeelde mechaniek: de tickets staan als hash in de les zelf. */
  const st = require('../../kern/stroomticket')({ bearer, nu, transactie,
    lees: (lessen, lesId) => lessen[lesId].stroomtickets,
    schrijf: (lessen, lesId, rij) => { lessen[lesId].stroomtickets = rij; },
    prefix: 'LESST', issuer: 'rtfoundation-onderwijs', doel: DOEL, scope: SCOPE, geldigMs: GELDIG_MS,
    maxOpen: MAX_OPEN, bijVol: 'weiger' });
  const lesIn = (lessen, lesId) => { const les = lessen[lesId]; return les && les.leraar ? les : null; };

  /* Uitgifte: de sleutel wordt BINNEN de transactie opnieuw getoetst. */
  async function geef(lesId, sleutel) {
    const id = String(lesId || '');
    const uit = await st.geef(id, lessen => {
      const les = lesIn(lessen, id);
      if (!les) return { weiger: ONBEKEND };
      const w = kaal(sleutel) ? wie(les, sleutel) : null;
      if (!w || !sleutelGeldig(les, w.rol, w.studentId)) return { weiger: NEE };
      const onderwerp = { soort: 'foundation-les', les: les.id, rol: w.rol };
      if (w.studentId) onderwerp.leerling = w.studentId;
      return { onderwerp };
    });
    if (uit.weiger) return uit.weiger;
    if (uit.vol) return { status: 429, error: 'Er staan te veel verbindingen tegelijk open voor deze les; probeer het zo weer.' };
    return { ok: true, ticket: uit.code, rol: uit.toegang.onderwerp.rol, verloopt: uit.toegang.expires_at };
  }

  /* Openen: DE claim. Het gevonden ticket gaat altijd weg -- ook als het al
     verlopen is of de sleutel eronder niet meer geldt -- zodat geen tweede
     opening het nog kan gebruiken. Een ticket van een andere les staat niet in
     deze les en wordt dus nooit gevonden; de binding op het les-id houdt dat
     ook vast als hij er toch zou staan. */
  async function claim(lesId, ticket) {
    const id = String(lesId || '');
    const uit = await st.claim(id, kaal(ticket), {
      voor: lessen => { const les = lesIn(lessen, id); return les ? { binding: { les: les.id } } : { weiger: ONBEKEND }; },
      hercontrole: (o, lessen) => sleutelGeldig(lessen[id], o.rol, o.leerling) });
    if (uit.weiger) return uit.weiger;
    if (!uit.ok) return NEE;
    const o = uit.onderwerp;
    return { ok: true, lesId: o.les, rol: o.rol, studentId: o.rol === 'leerling' ? o.leerling : null };
  }

  return { stroomticket: geef, claimStroom: claim };
};

module.exports.GELDIG_MS = GELDIG_MS;
module.exports.MAX_OPEN = MAX_OPEN;
module.exports.DOEL = DOEL;
