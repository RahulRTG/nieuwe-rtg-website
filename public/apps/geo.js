/* Gedeelde GPS-hulp voor de RTG-apps: vraagt (eenmalig, met toestemming) de
   locatie van het toestel op, onthoudt die kort, en rekent de afstand tot een
   bedrijf uit. Zo tonen we overal "hoe ver weg" een partner of vacature is.
   De locatie blijft op het toestel; we sturen hem niet naar de server. */
(function (w) {
  var KEY = 'rtg_geo';
  function cache() { try { return JSON.parse(localStorage.getItem(KEY) || 'null'); } catch (e) { return null; } }
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
      if (!w.navigator || !w.navigator.geolocation || !w.isSecureContext) return Promise.resolve(null);
      return new Promise(function (res) {
        var klaar = false;
        var t = setTimeout(function () { if (!klaar) { klaar = true; res(null); } }, 9000);
        w.navigator.geolocation.getCurrentPosition(
          function (p) {
            if (klaar) return; klaar = true; clearTimeout(t);
            var o = { lat: p.coords.latitude, lng: p.coords.longitude, at: Date.now() };
            try { localStorage.setItem(KEY, JSON.stringify(o)); } catch (e) {}
            res({ lat: o.lat, lng: o.lng });
          },
          function () { if (klaar) return; klaar = true; clearTimeout(t); res(null); },
          { enableHighAccuracy: false, timeout: 8000, maximumAge: 600000 }
        );
      });
    },
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
