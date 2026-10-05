/* HET STROOMTICKET: een kortlevend, eenmalig ticket waarmee een live-stroom
   (EventSource) opent zonder dat de sessie of sleutel in het adres staat.

   EventSource kan geen koppen sturen. Daarom ruilt een scherm zijn sessie (in
   de kop) eerst voor een ticket, en alleen dat ticket staat in de URL. Wat er
   in een log belandt is na het eerste gebruik of na de korte geldigheid
   waardeloos. Dit bestand is de GEDEELDE mechaniek van twee domeinen (besluit
   van de eigenaar, 4 oktober 2026): de gezinsstroom (foundation/gezinsstroom.js,
   GS., B18) en de lesstroom (foundation/onderwijs/stroomticket.js, LESST., B25).

   Wat hier vastligt, voor elke soort:
   - uitgifte via kern/bearercode.js (128 bits), op schijf alleen de hash;
   - een KORTE geldigheid per soort (hoogstens MAX_GELDIG_MS) en max_gebruik 1;
   - EENMALIG: de claim haalt het gevonden ticket in DEZELFDE
     collectietransactie weg (PG: advisory lock + FOR UPDATE), ook als het
     daarna om een andere reden niet opent -- twee gelijktijdige openingen
     krijgen er samen precies een;
   - BINDING: het onderwerp van het ticket moet veld voor veld gelijk zijn aan
     wat de opener verwacht (kanaal en gezin, of de les);
   - een PLAFOND per onderwerp: weigeren (de les) of de oudste verdringen (het
     gezin, per profiel);
   - HERCONTROLE bij openen: de aanroeper zegt of de sessie of sleutel onder
     het ticket nog leeft; zo niet, dan opent een een seconde oud ticket niets.

   Wat hier NIET ligt: de opslagvorm (de aanroeper geeft `lees`/`schrijf` op
   zijn eigen collectie), de transactie zelf (de aanroeper weet of hij in
   productie mag terugvallen), het voorvoegsel, de geldigheid, de antwoorden
   en statuscodes van de route. Die blijven bij het domein. */
'use strict';

const MAX_GELDIG_MS = 5 * 60000;

module.exports = ({ bearer, nu, transactie, lees, schrijf, prefix, issuer, doel, scope, geldigMs,
  maxOpen, bijVol = 'weiger', groep = null }) => {
  if (!bearer || typeof bearer.maak !== 'function' || typeof bearer.vind !== 'function' ||
      typeof bearer.reden !== 'function') throw new Error('stroomticket vereist kern/bearercode.js');
  if (typeof transactie !== 'function' || typeof lees !== 'function' || typeof schrijf !== 'function')
    throw new Error('stroomticket vereist een collectietransactie met lees en schrijf');
  if (!(geldigMs > 0 && geldigMs <= MAX_GELDIG_MS)) throw new Error('stroomticket: geldigheid hoort kort te zijn');
  if (!(Number.isSafeInteger(maxOpen) && maxOpen > 0)) throw new Error('stroomticket vereist een plafond');
  if (bijVol !== 'weiger' && bijVol !== 'oudste') throw new Error('stroomticket: bijVol is weiger of oudste');
  const SCOPE = [].concat(scope || []);
  const levend = t => !!t && !t.ingetrokken_at && Date.parse(t.expires_at) > Date.parse(nu());
  const vorm = new RegExp('^' + String(prefix).replace(/[^A-Z0-9_-]/gi, '') + '\\.[0-9A-F]{32}$');
  const zelfdeGroep = o => {
    if (typeof groep !== 'function') return () => true;
    const g = groep(o || {});
    return t => !!t && groep(t.onderwerp || {}) === g;
  };

  /* Uitgifte. `voor(staat)` draait BINNEN de transactie en geeft
     { onderwerp } of { weiger } (het domein toetst daar zijn sleutel opnieuw).
     Uitslag: { ok, code, toegang } | { weiger } | { vol: true }. */
  function geef(sleutel, voor) {
    return transactie(staat => {
      const v = voor(staat) || {};
      if (v.weiger) return { weiger: v.weiger };
      const huidig = lees(staat, sleutel);
      const rij = (Array.isArray(huidig) ? huidig : []).filter(levend);
      const hoort = zelfdeGroep(v.onderwerp);
      if (bijVol === 'weiger' && rij.filter(hoort).length >= maxOpen) {
        schrijf(staat, sleutel, rij);
        return { vol: true };
      }
      const m = bearer.maak({ prefix, issuer, doel, scope: SCOPE, onderwerp: v.onderwerp, geldigMs, maxGebruik: 1 });
      rij.push(m.toegang);
      if (bijVol === 'oudste') while (rij.filter(hoort).length > maxOpen) rij.splice(rij.findIndex(hoort), 1);
      schrijf(staat, sleutel, rij);
      return { ok: true, code: m.code, toegang: m.toegang };
    });
  }

  /* De EENMALIGE claim. Elk ticket onder deze sleutel wordt vergeleken
     (timingSafeEqual, geen vroege uitgang); het gevonden ticket verdwijnt
     altijd, samen met wat verlopen is. `voor(staat)` geeft { binding } of
     { weiger }; `hercontrole(onderwerp, staat)` zegt of wat eronder ligt nog
     leeft. Uitslag: { ok, onderwerp } | { weiger } | { ok: false, reden }. */
  function claim(sleutel, raw, { voor = () => ({}), hercontrole } = {}) {
    if (typeof hercontrole !== 'function') return Promise.reject(new Error('stroomticket: claim zonder hercontrole'));
    return transactie(staat => {
      const v = voor(staat) || {};
      if (v.weiger) return { weiger: v.weiger };
      const huidig = lees(staat, sleutel);
      const rij = Array.isArray(huidig) ? huidig : [];
      const kaal = String(raw == null ? '' : raw).trim();
      const t = kaal ? bearer.vind(rij, kaal) : null;
      schrijf(staat, sleutel, rij.filter(x => x !== t && levend(x)));
      if (!t) return { ok: false, reden: 'onbekend' };
      const r = bearer.reden(t, { doel, scope: SCOPE });
      if (r) return { ok: false, reden: r };
      const o = t.onderwerp || {};
      for (const [k, w] of Object.entries(v.binding || {}))
        if (o[k] !== w) return { ok: false, reden: 'binding' };
      if (!hercontrole(o, staat)) return { ok: false, reden: 'hercontrole' };
      return { ok: true, onderwerp: o };
    });
  }

  return { geef, claim, levend, vorm: raw => vorm.test(String(raw == null ? '' : raw).trim().toUpperCase()),
    GELDIG_MS: geldigMs, MAX_OPEN: maxOpen };
};

module.exports.MAX_GELDIG_MS = MAX_GELDIG_MS;
