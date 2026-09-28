/* WELKE ENTITEIT IS RTG ZELF -- en werkt deze kantoormens daar?

   Besluit B1 van de eigenaar (PERSONEEL.md par. 12, 27 september 2026): RTG
   wordt de eerste klant van zijn eigen WorkOS. Het werkleven van een
   RTG-medewerker woont waar dat van iedere werknemer woont -- een dienstverband
   bij een entiteit (kern/concern/employment.js) -- en de kantoorkamers blijven
   waar de MACHT woont.

   Daarvoor moet het huis weten welke entiteit RTG IS. Dat is geen afleiding en
   geen instelling die de software raadt: de eigenaar wijst hem aan. Tot die tijd
   is de aanwijzing leeg en is elk antwoord hieronder `onbekend` -- nooit "niemand
   is in dienst".

   WAT DIT BESTAND DOET: een aanwijzing bewaren, en voor een kantoorsleutel
   UITREKENEN of er een lopend dienstverband bij die entiteit is. Uitrekenen en
   niet opslaan: een dienstverband eindigt op een DATUM (`tot`), niet met een
   gebeurtenis, dus een opgeslagen "is in dienst" zou de dag na de einddatum
   liegen.

   WAT DIT BESTAND NIET DOET: iemand tegenhouden. Dit is de schaduwhelft
   (KANTOORMACHT.md: SHADOW -> WARN -> ENFORCE). De toegangsreview toont het
   werkverband naast de zetels, zodat de eigenaar ZIET wat afdwingen zou kosten
   voordat hij besluit. En geen gedragsgegeven: alleen of er een dienstverband
   loopt en in welke rol -- nooit wanneer iemand werkte. */
'use strict';

function maakHuis({ db, save, nu }) {
  const tijd = nu || (() => new Date().toISOString());
  const eigen = require('../eigencollectie')({ db, domein: 'kern/kantoor/huis', bezit: { kantoorHuis: 'kaart' } });

  /* Lezen schept niets (kijk), schrijven wel (bak). */
  function aanwijzing() {
    const h = eigen.kijk('kantoorHuis');
    return h && h.entiteit ? { entiteit: h.entiteit, door: h.door || null, sinds: h.sinds || null } : null;
  }

  /* Alleen de eigenaar wijst aan; dat toetst de route (boardroomBaas). Hier
     alleen of de entiteit bestaat -- een aanwijzing naar niets is erger dan
     geen aanwijzing, want die ziet eruit als een antwoord. */
  function wijsAan(entiteitId, door, entiteitBestaat) {
    const id = String(entiteitId || '').trim().slice(0, 80);
    if (!id) return { status: 400, error: 'Welke entiteit is RTG? Geef het id uit RTG Concern.' };
    if (typeof entiteitBestaat !== 'function' || !entiteitBestaat(id))
      return { status: 404, error: 'Deze entiteit bestaat niet in RTG Concern.' };
    if (!door) return { status: 400, error: 'Noteer wie deze aanwijzing doet.' };
    /* Dezelfde aanwijzing nog een keer is een dubbeltik en geen nieuw besluit:
       er verandert niets, ook `sinds` niet (het contract zegt PROTECTED). */
    const nu0 = aanwijzing();
    if (nu0 && nu0.entiteit === id) return { ok: true, huis: nu0, ongewijzigd: true };
    const h = eigen.bak('kantoorHuis');
    h.entiteit = id; h.door = door; h.sinds = tijd();
    save();
    return { ok: true, huis: aanwijzing() };
  }

  /* `loopt`   een lopend dienstverband bij de huisentiteit
     `geen`    geen; `alleenMandaat` zegt of er wel een mandaat loopt (een
               accountant met inzage werkt er niet, CONCERN.md)
     `onbekend` met de reden: geen aanwijzing, geen codenaam, of de concernlaag
               antwoordt niet. Een bron die niet antwoordt wordt geen nee. */
  function werkverband(key, { codenaamVan, employmentVanPersoon } = {}) {
    const h = aanwijzing();
    if (!h) return { stand: 'onbekend', reden: 'De eigenaar heeft nog niet aangewezen welke entiteit RTG is.' };
    let cn = null, lopend = null;
    try { cn = typeof codenaamVan === 'function' ? codenaamVan(key) : null; } catch (e) { cn = null; }
    if (!cn || cn === key) return { stand: 'onbekend', reden: 'Bij deze sleutel is geen codenaam te vinden.' };
    try { lopend = typeof employmentVanPersoon === 'function' ? employmentVanPersoon(cn, false) : null; } catch (e) { lopend = null; }
    if (!Array.isArray(lopend)) return { stand: 'onbekend', reden: 'De concernlaag antwoordde niet.' };
    const hier = lopend.filter(e => e && e.entiteit === h.entiteit);
    const werk = hier.filter(e => e.telt);
    if (werk.length) return { stand: 'loopt', rollen: werk.map(e => e.rol).filter(Boolean) };
    return { stand: 'geen', alleenMandaat: hier.length > 0 };
  }

  return { aanwijzing, wijsAan, werkverband };
}

module.exports = { maakHuis };
