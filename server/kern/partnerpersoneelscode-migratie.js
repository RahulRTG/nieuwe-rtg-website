/* B21 (besluit van de eigenaar, 4 oktober 2026; deur
   partnerkanaal.personeels_en_partnercode): de OUDE personeelscodes van het
   partnerkanaal worden bij de uitrol uit de opslag gewist.

   Sinds B14 (kern/partnerpersoneelscode.js) opent een oude, zelfgekozen
   `partner.staff.code` niets meer: geen lezer zoekt erop. Maar hij stond nog
   KAAL in de opslag, en een code die een mens zelf koos en die jaren in
   gebruik was, is een geheim dat ook buiten dit huis iets kan zeggen
   (hergebruik). Daarom gaat hij weg, en niet alleen uit gebruik.

   HET PATROON is dat van de andere opstartmigraties van kale codes (Salon-
   claimcode, Samen, boarding, WerkOS-sleutels in server.js): EEN
   collectietransactie via bewerkCollectie, die op JSON/SQLite/geheugen
   synchroon commit en op PostgreSQL onder advisory lock + FOR UPDATE, en die
   in server.js vóór het verkeer draait (lokaal vóór listen, PostgreSQL in de
   opstart voordat de deur opengaat).

   Drie dingen liggen vast:
   - IDEMPOTENT. Een tweede ronde vindt geen `code` meer en verandert niets;
     bewerkCollectie schrijft dan ook niets (JSON gelijk = geen save).
   - EEN SPOOR ZONDER CODE. De telling gaat naar het log en de partner krijgt
     `staff.oude_code_gewist_at`, zodat het kantoor ziet DAT er een code was en
     dat zijn medewerkers een nieuwe nodig hebben. De code zelf, een hash of
     een lengte ervan komt nergens terecht.
   - ER WORDT NIETS VERVANGEN. Er komt geen nieuwe code voor in de plaats; de
     partner laat het kantoor per medewerker een personeelscode uitgeven via
     de bestaande route (POST /api/office/partnerkanaal/personeelscode).
     Alleen het veld `code` wordt gewist -- het tarief (serviceRate) en de rest
     van de partner blijven staan. */
'use strict';

const COLLECTIE = 'partners';

module.exports = function maakOudeCodeMigratie({ bewerkCollectie, log, nu } = {}) {
  const tijd = nu || Date.now;
  const meld = log || ((m, v) => require('../log').log.info(m, v));

  function werk(partners) {
    if (!Array.isArray(partners)) {
      // nooit aangemaakt: bewerkCollectie geeft dan een lege kaart; niets te doen
      if (partners && typeof partners === 'object' && !Object.keys(partners).length)
        return { ok: true, gewist: 0, partners: 0 };
      throw new Error(COLLECTIE + ' hoort een lijst te zijn');
    }
    const stempel = new Date(tijd()).toISOString();
    let gewist = 0;
    for (const p of partners) {
      const s = p && p.staff;
      if (!s || typeof s !== 'object' || !Object.prototype.hasOwnProperty.call(s, 'code')) continue;
      delete s.code;
      s.oude_code_gewist_at = stempel;
      gewist++;
    }
    return { ok: true, gewist, partners: partners.length };
  }

  const spoor = r => {
    if (r && r.gewist > 0)
      meld('[partnerkanaal] B21: oude personeelscode gewist uit de opslag', { partners: r.gewist });
    return r;
  };

  /* Synchroon op een lokale opslag, een Promise op PostgreSQL -- precies wat
     bewerkCollectie zelf teruggeeft, zodat server.js kan weigeren te starten
     als de lokale tak NIET synchroon committe. */
  function migreerOudeCodes() {
    if (typeof bewerkCollectie !== 'function')
      throw new Error('De B21-migratie van oude personeelscodes mist de collectietransactie.');
    const uit = bewerkCollectie(COLLECTIE, werk);
    return uit && typeof uit.then === 'function' ? uit.then(spoor) : spoor(uit);
  }

  return { migreerOudeCodes };
};
