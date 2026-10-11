/* ============================================================================
   HOE EEN BERICHT OVER EEN ZAAK BIJ DE MELDER AANKOMT.

   DE FOUT DIE DIT OPHEFT. ./loop.js meldt de melder bij elk antwoord van een
   medewerker, en de bezorging ging tot 11 oktober 2026 alleen als PUSH naar een
   lidaccount (`sendPushToUser`). Drie melders kwamen daardoor nergens aan:

     - een ZAAK (`zaak-<code>`, de leveranciersingang van par. 11): geen
       account-id, dus stil weggegooid -- de leverancier hoorde nooit dat RTG
       antwoordde;
     - een melder die er per MAIL kwam en op CODENAAM stond (kern/service/post.js
       van voor deze datum): idem;
     - en een lid zonder pushabonnement: geen regel in zijn meldingenlijst, dus na
       een herlaadbeurt was er niets meer te zien.

   Zelfde vorm als de fout uit kern/ontvanger.js: een bericht is pas bezorgd als
   er een LEZER bestaat (MAATSTAF.md par. 7f). Dus gaat elk bericht hier naar de
   bak die bij de soort melder gelezen wordt:

     user-<id>   meldLid()          -> /api/notifications (+ live + push)
     zaak-<code> notifySupplier()   -> de meldingen van de leverancier
     anders      een codenaam: eerst terug naar zijn sleutel via de gids, en
                 alleen bij precies EEN treffer (kern/gids.js weigert dubbel).

   EN HIJ GEEFT ALTIJD EEN UITSLAG, zoals kern/ontvanger.js: `{ bezorgd, weg }`
   of `{ bezorgd: false, reden }`. Stil weglopen is de faalvorm die hier hersteld
   wordt. Wat hij met opzet NIET doet: bepalen of iemand iets mag ontvangen. De
   melder IS de ontvanger van zijn eigen zaak; dat besliste de zaak al.
   ========================================================================== */
'use strict';

const ZAAK = /^zaak-(.*)$/;
const LID = /^user-\d+$/;

module.exports = function maakMelderPost({ meldLid, notifySupplier, keyVanCodenaam, log } = {}) {
  const waarschuw = (r, melder) => {
    if (!r.bezorgd && log) log('[service] melding niet bezorgd aan ' + String(melder).slice(0, 40) + ': ' + r.reden);
    return r;
  };

  function naarSleutel(key, note) {
    if (typeof meldLid !== 'function') return { bezorgd: false, reden: 'weg-niet-ingericht' };
    const n = meldLid(key, note);
    /* null is TEGENGEHOUDEN (rust of voorkeur van het lid), en dat is geen
       bezorging -- opzet/meldaan.js zegt dat met zoveel woorden. */
    return n ? { bezorgd: true, weg: 'lid' } : { bezorgd: false, reden: 'tegengehouden-door-lid' };
  }

  /* `bericht` draagt { titel, tekst, zaak } zoals ./loop.js hem maakt; de lezers
     tonen `title` en `body` (public/shared/realtime.js), dus dat wordt hier
     vertaald en niet op twaalf plekken. */
  function bezorgMelder(melder, bericht) {
    const b = bericht || {};
    const note = { icon: 'service', title: String(b.titel || 'RTG Service').slice(0, 120),
      body: String(b.tekst || '').slice(0, 300), zaak: b.zaak || null };
    const m = String(melder == null ? '' : melder).trim();
    if (!m) return waarschuw({ bezorgd: false, reden: 'geen-melder' }, m);

    const z = ZAAK.exec(m);
    if (z) {
      if (!z[1]) return waarschuw({ bezorgd: false, reden: 'zaak-zonder-code' }, m);
      if (typeof notifySupplier !== 'function') return waarschuw({ bezorgd: false, reden: 'weg-niet-ingericht' }, m);
      notifySupplier(z[1], note);
      return { bezorgd: true, weg: 'zaak' };
    }
    if (LID.test(m)) return waarschuw(naarSleutel(m, note), m);

    /* Een codenaam. Async, want de gids zoekt in Postgres; de aanroeper wacht er
       niet op (de levering gaat nooit voor de zaak), maar de uitslag wordt wel
       gelogd als hij niet aankomt. */
    if (typeof keyVanCodenaam !== 'function') return waarschuw({ bezorgd: false, reden: 'weg-niet-ingericht' }, m);
    return Promise.resolve(keyVanCodenaam(m)).then((t) => {
      if (!t || !t.key) return waarschuw({ bezorgd: false, reden: 'codenaam-niet-eenduidig' }, m);
      return waarschuw(naarSleutel(t.key, note), m);
    }, (e) => waarschuw({ bezorgd: false, reden: 'gids-faalde: ' + (e && e.message || e) }, m));
  }

  return { bezorgMelder };
};
