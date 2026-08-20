/* Gedeelde GPS-hulp voor de RTG-apps: vraagt (eenmalig, met toestemming) de
   locatie van het toestel op, onthoudt die kort, en rekent de afstand tot een
   bedrijf uit. Zo tonen we overal "hoe ver weg" een partner of vacature is.
   De locatie blijft op het toestel; we sturen hem niet naar de server.

   EN HIJ LUISTERT NAAR DE SCHAKELAAR, WANT DAT DEED HIJ NIET.

   Zes andere plekken behandelen `rtg_os_gps` als de waarheid: alleen een
   uitdrukkelijke '1' geeft je positie vrij. Dit bestand las hem helemaal niet
   en vroeg het toestel rechtstreeks -- ongevraagd bij het tekenen van de
   partnerlijst en de vacaturelijst. De tegel in het bedieningspaneel kon dus
   op "uit" staan terwijl dit gewoon om je locatie vroeg, en de opgeslagen
   positie bleef daarna in localStorage staan. Dat is dezelfde fout als
   "de gps doet het niet", alleen in spiegelbeeld: de schakelaar werd genegeerd
   in plaats van gehoord.

   De regel die eruit kwam: STIL OVERSLAAN MAG ALLEEN WAAR JE POSITIE NIET DE
   FUNCTIE IS. Een lijst zonder afstanden is een lijst; een knop "dichtstbij
   eerst" die niets doet is een defect. Vandaar twee ingangen:
     Geo.positie()      ongevraagd -- staat de schakelaar uit, dan null;
     Geo.vraag(waarom)  op een bewuste handeling -- vraagt het dan, via
                        shared/plek.js, met de reden erbij.
   `Geo.mag()` zegt vooraf welke van de twee je nodig hebt. */
(function (w) {
  var KEY = 'rtg_geo';
  var SCHAKELAAR = 'rtg_os_gps';
  // de schakelaar uit het bedieningspaneel (shared/plek.js houdt hem bij)
  function mag() { try { return localStorage.getItem(SCHAKELAAR) === '1'; } catch (e) { return false; } }
  /* Staat de schakelaar uit, dan is er geen bewaarde plek meer -- niet "wel
     bewaard maar even niet gebruiken". Anders staat je laatste positie na het
     uitzetten gewoon nog in localStorage, en dat is precies wat "uit" niet
     hoort te betekenen. */
  function cache() {
    if (!mag()) { try { localStorage.removeItem(KEY); } catch (e) {} return null; }
    try { return JSON.parse(localStorage.getItem(KEY) || 'null'); } catch (e) { return null; }
  }
  function bewaar(lat, lng) {
    var o = { lat: lat, lng: lng, at: Date.now() };
    try { localStorage.setItem(KEY, JSON.stringify(o)); } catch (e) {}
    return { lat: o.lat, lng: o.lng };
  }
  function rad(d) { return d * Math.PI / 180; }
  var Geo = {
    // Laatst bekende positie zonder opnieuw te vragen (of null).
    laatste: function () { var c = cache(); return c ? { lat: c.lat, lng: c.lng } : null; },
    // Vraag de positie op. Gebruikt een verse cache (standaard 10 min) of vraagt
    // het toestel. Geeft altijd een Promise die {lat,lng} of null oplevert.
    positie: function (maxAgeMs) {
      maxAgeMs = maxAgeMs == null ? 600000 : maxAgeMs;
      var c = cache();
      if (c && (Date.now() - c.at) < maxAgeMs) return Promise.resolve({ lat: c.lat, lng: c.lng });
      if (!mag()) return Promise.resolve(null);   // de schakelaar wint, en zwijgt
      if (!w.navigator || !w.navigator.geolocation || !w.isSecureContext) return Promise.resolve(null);
      return new Promise(function (res) {
        var klaar = false;
        var t = setTimeout(function () { if (!klaar) { klaar = true; res(null); } }, 9000);
        w.navigator.geolocation.getCurrentPosition(
          function (p) {
            if (klaar) return; klaar = true; clearTimeout(t);
            res(bewaar(p.coords.latitude, p.coords.longitude));
          },
          function () { if (klaar) return; klaar = true; clearTimeout(t); res(null); },
          { enableHighAccuracy: false, timeout: 8000, maximumAge: 600000 }
        );
      });
    },
    /* Op een BEWUSTE handeling: vraagt het als de schakelaar uit staat, in
       plaats van stil niets te doen. shared/plek.js voert het gesprek (en zet
       de schakelaar pas om als jij ja zegt); wij bewaren de uitkomst hier,
       zodat de rest van dit bestand er verder niets van merkt. Zonder plek.js
       op de pagina blijft het gedrag als voorheen: geen vraag, geen plek. */
    vraag: function (waarom, maxAgeMs) {
      if (mag()) return Geo.positie(maxAgeMs);
      if (!w.RTGPlek) return Promise.resolve(null);
      return w.RTGPlek.vraag({ waarom: waarom }).then(function (p) {
        return p ? bewaar(p.lat, p.lng) : null;
      });
    },
    // Mag dit scherm ongevraagd om een positie vragen? (de schakelaar)
    mag: mag,
    // Is er al eens toestemming gegeven (staat er een positie in de cache)?
    heeft: function () { return !!cache(); },
    vergeet: function () { try { localStorage.removeItem(KEY); } catch (e) {} },
    // Afstand in kilometers tussen twee {lat,lng}-punten (Haversine), of null.
    afstandKm: function (a, b) {
      if (!a || !b || a.lat == null || b.lat == null) return null;
      var R = 6371;
      var dLat = rad(b.lat - a.lat), dLng = rad(b.lng - a.lng);
      var h = Math.sin(dLat / 2) * Math.sin(dLat / 2) +
        Math.cos(rad(a.lat)) * Math.cos(rad(b.lat)) * Math.sin(dLng / 2) * Math.sin(dLng / 2);
      return 2 * R * Math.asin(Math.min(1, Math.sqrt(h)));
    },
    // Nette weergave: "850 m", "1,2 km", "12 km".
    tekst: function (km) {
      if (km == null) return '';
      if (km < 1) return Math.round(km * 1000) + ' m';
      if (km < 10) return (Math.round(km * 10) / 10).toFixed(1).replace('.', ',') + ' km';
      return Math.round(km) + ' km';
    }
  };
  w.Geo = Geo;
})(window);
