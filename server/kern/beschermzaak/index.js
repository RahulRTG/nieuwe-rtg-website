/* ============================================================================
   BESCHERMZAAK -- de veiligheidskant van de RTFoundation, als eigen dataklasse.

   HDI.md par. 7 regel 3. Zie ./klasse.js voor waarom dit geen casus is, en
   ./keten.js voor de vier grendels.

   WAAROM DIT EEN EIGEN MAP IS EN GEEN BESTAND IN kern/rtfos/. Een bestand
   naast casus.js wordt vanzelf een variant van casus.js: iemand hergebruikt
   `beeld`, iemand voegt hem toe aan een export "want het is toch ook een
   hulpvraag", en dan is de dataklasse weg. De scheiding staat daarom in de
   mappenstructuur, en er loopt geen enkele require van hier naar
   kern/rtfos/casus*.js of terug. test/beschermzaak.test.js zakt zodra dat
   verandert.

   WAT DIT WEL DEELT MET RTFOS, en met opzet: de POORT. Wie mag wat, waar,
   wordt op EEN plek beantwoord (kern/rtfos/basis.js). Een tweede rechtenmodel
   naast het eerste is precies de dubbeling waar LAT.md regel 4 over gaat, en
   bij bevoegdheden is uiteenlopen het duurst.

   OPSLAG: db.data.rtfos.beschermzaken, aangemaakt door kern/rtfos/basis.js
   zoals alle rtfos-collecties. Deze module is de enige die erin schrijft.

   WAT ER MET OPZET NIET IS:
     - geen lijst voor de gemeente, geen regel in rapport.js, geen tel in het
       jaarverslag. Kleine getallen over geweld in een wijk zijn geen statistiek
       maar een aanwijzing, en de veiligste vorm daarvan is: niet leveren.
       kern/rtfos/gemeente.js raakt deze collectie niet aan, en een toets houdt
       dat vast.
     - geen verwijderfunctie. Zie ./keten.js.
     - geen zoekfunctie over de inhoud. Zie WEIGERT in ./klasse.js.
   ========================================================================== */
'use strict';

const K = require('./klasse');

module.exports = (ctx) => {
  const { nu, rid, schoon, S, audit, wie, poort, save } = ctx;

  const zaken = () => {
    if (!Array.isArray(S().beschermzaken)) S().beschermzaken = [];
    return S().beschermzaken;
  };
  const vind = id => zaken().find(z => z.id === String(id || '')) || null;
  const codenaam = () => 'BZ-' + ctx.code('X').split('-')[1].slice(0, 5);

  const keten = require('./keten')(ctx, { vind, zaken });

  /* De enige plek waar een zaak zonder inlog ontstaat (HDI.md par. 7 regel 4).
     Hij staat hier en niet in routes/, want de weigeringen van ./klasse.js
     moeten er net zo hard voor gelden als aan de kantoorkant -- juist daar. */
  const voordeur = require('./voordeur')(ctx, { zaken });

  /* ---------- openen ----------
     Er wordt hier NIET gevraagd wie het is. Een beschermzaak begint met een
     aanleiding en een korte, feitelijke omschrijving, en verder niets. De
     codenaam maakt het systeem zelf. */
  function open(req, b) {
    b = b || {};
    const stuk = K.keurInvoer(b); if (stuk) return stuk;
    const w = wie(req);
    const g = poort(w, b.stad, 'casus.beheren', 'individual_cases');
    if (!g.ok) return g;
    const aanleiding = String(b.aanleiding || '');
    if (!K.AANLEIDINGEN.includes(aanleiding)) {
      return { status: 400, error: 'Kies een aanleiding (' + K.AANLEIDINGEN.join(', ') + ').' };
    }
    const wat = schoon(b.wat, 300);
    if (wat.length < 5) {
      return { status: 400, error: 'Wat is er aan de hand? Kort en feitelijk -- geen namen, geen adres, geen letsel.' };
    }
    if (zaken().length >= 100000) return { status: 400, error: 'Het register zit vol.' };
    const z = { id: rid(), stad: g.stad.id, codenaam: codenaam(), aanleiding, wat,
      stand: 'veiligheid', veiligheid: null, toestemming: null, ingetrokken: null,
      overdrachten: [], stappen: [], gesloten: null, bewaarTot: null, bewaarWaarom: null,
      door: w.key, at: nu(), bijgewerkt: nu() };
    zaken().push(z);
    audit(w.key, 'beschermzaak.geopend', z.codenaam, aanleiding);
    save();
    return { ok: true, zaak: K.beeld(z),
      melding: 'Zaak geopend als ' + z.codenaam + '. Eerste stap: is deze mens nu veilig, en kan iemand meekijken?' };
  }

  /* ---------- de lijst draagt geen inhoud ---------- */
  function lijst(req, stadId, filter) {
    const f = filter || {};
    const stuk = K.keurInvoer(f); if (stuk) return stuk;
    const w = wie(req);
    const g = poort(w, stadId, 'casus.lezen', 'individual_cases');
    if (!g.ok) return g;
    let rijen = zaken().filter(z => z.stad === g.stad.id);
    if (f.stand) rijen = rijen.filter(z => z.stand === String(f.stand));
    if (f.open === true) rijen = rijen.filter(z => z.stand !== 'gesloten');
    return { ok: true, standen: K.STANDEN, keten: K.KETEN, aanleidingen: K.AANLEIDINGEN,
      aantal: rijen.length, zaken: rijen.slice(-300).reverse().map(K.lijstbeeld),
      let: 'Deze lijst toont geen inhoud. Open een zaak om hem te lezen; dat wordt genoteerd.' };
  }

  /* ---------- een zaak lezen IS een handeling ----------
     Zelfde regel als het openen van contactgegevens in kern/rtfos/casus-dossier.js:
     het verschil tussen "ik werk hieraan" en "ik heb gekeken" is zonder spoor
     onzichtbaar, ook achteraf, ook voor de mens zelf. */
  function lees(req, id) {
    const z = vind(id); if (!z) return { status: 404, error: 'Deze beschermzaak bestaat niet.' };
    const w = wie(req);
    const g = poort(w, z.stad, 'casus.beheren', 'individual_cases');
    if (!g.ok) return g;
    audit(w.key, 'beschermzaak.gelezen', z.codenaam, '');
    save();
    return { ok: true, zaak: K.beeld(z) };
  }

  /* ---------- de weg terug is een NOTITIE en geen koppeling ----------
     Blijkt een zaak tijdens het werk toch huiselijk geweld te zijn, dan hoort er
     een meldcode-traject te lopen (kern/rtfos/meldcode-herkomst.js). Deze zaak
     onthoudt daarvan alleen HET ID -- niet de stappen, niet de weging, niet de
     uitkomst. Wie het meldcode-dossier wil lezen, opent het daar, en dat laat
     zijn eigen spoor na.

     WAAROM DIT HIER STAAT EN NIET IN meldcode.js. Deze module is de enige die in
     de beschermzaken schrijft (zie de kop). Zou de meldcode dat doen, dan zijn er
     twee schrijvers en is die zin niet meer waar. De brug tussen de twee zit
     daarom in de ROUTE, waar allebei bereikbaar zijn en geen van beide de ander
     hoeft te laden. */
  function noteerMeldcode(req, id, meldcodeId) {
    const z = vind(id); if (!z) return { status: 404, error: 'Deze beschermzaak bestaat niet.' };
    const w = wie(req);
    const g = poort(w, z.stad, 'casus.beheren', 'individual_cases');
    if (!g.ok) return g;
    const mid = String(meldcodeId || '');
    if (!mid) return { status: 400, error: 'Welk meldcode-dossier?' };
    if (!Array.isArray(z.meldcodes)) z.meldcodes = [];
    if (!z.meldcodes.includes(mid)) z.meldcodes.push(mid);
    z.bijgewerkt = nu();
    audit(w.key, 'beschermzaak.meldcode', z.codenaam, mid);
    save();
    return { ok: true, zaak: K.beeld(z) };
  }

  return { open, lijst, lees, noteerMeldcode, veiligheid: keten.veiligheid, stand: keten.stand,
    toestemming: keten.toestemming, trekIn: keten.trekIn, draagOver: keten.draagOver,
    sluit: keten.sluit, vind, voordeur,
    STANDEN: K.STANDEN, KETEN: K.KETEN, AANLEIDINGEN: K.AANLEIDINGEN };
};
module.exports.klasse = K;
