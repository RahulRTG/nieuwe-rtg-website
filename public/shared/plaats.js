/* DE HEK-MOTOR, EN HIJ DRAAIT HIER -- op het toestel (PLAATS.md par. 1).

   Dit is de plek waar de belofte van dit huis technisch waar wordt in plaats van
   opgeschreven. De server stuurt HEKKEN (plaatsen: een zaak, een halte, een
   zone) en dat is geen persoonsgegeven. Deze motor vergelijkt je positie daar
   lokaal mee en stuurt alleen de UITKOMST terug: welk hek, binnen of buiten,
   wanneer. Je coordinaat verlaat dit toestel niet.

   Waarom dat meer is dan netheid: elke concurrent stuurt bij elke kaartweergave
   de positie van zijn klant naar Google of Mapbox. RTG heeft een eigen wegennet
   en eigen geometrie, dus dat hoeft hier niet. "Onze leverancier ziet uw
   medewerkers niet, en wij zien ze ook niet" is een zin die vrijwel niemand kan
   uitspreken, en het is de zin die bij een aanbesteding wint.

   HET RANDGEVAL DAT DIT SOORT MOTOREN SLOOPT: een toestel dat precies op de rand
   van een hek staat, wisselt zonder maatregel tientallen keren per minuut tussen
   binnen en buiten. Daar gaan een accu, een dienstrooster en het vertrouwen in
   een systeem aan kapot. Vandaar HYSTERESE: naar binnen ga je bij de straal,
   naar buiten pas bij de straal plus een marge. En vandaar dat de motor de
   NAUWKEURIGHEID van de peiling meeweegt: een fix van 500 meter zegt niets over
   een hek van 120 meter, en die peilingen laten we lopen in plaats van er een
   waarneming van te maken die nergens op slaat.

   Gebruik:
     RTGPlaats.start('dienst')   -> begint te letten; geeft een stopfunctie
     RTGPlaats.stand()           -> { doel, hekken, binnen: [id, ...] }
     RTGPlaats.stop()            -> stopt alles en vergeet de hekken

   start() gaat via shared/plek.js, dus de locatieschakelaar en de vraag met de
   reden erbij gelden hier onverkort. Zonder plek.js gebeurt er niets -- geen
   stille terugval op een rauwe watchPosition, want dan zou deze motor de
   schakelaar omzeilen die de rest van het huis wel gehoorzaamt. */
(function () {
  'use strict';
  if (window.RTGPlaats) return;

  var MARGE_M = 60;          // hysterese: eruit ben je pas bij straal + marge
  var SLECHT_M = 250;        // een peiling die slechter is dan dit laten we lopen
  var R = 6371000;

  var doel = null, hekken = [], binnen = {}, stopVolgen = null, bezig = false;
  /* Wie er meeluistert op een hek-overgang. De motor MELDT alleen; wat er daarna
     gebeurt is aan de laag erboven (shared/plaatsnadering.js zet er bijvoorbeeld
     de aankomstpuls van een Arrival Pass mee). Zo blijft deze motor een motor:
     hij rekent en meldt, hij handelt niet. */
  var luisteraars = [];

  function rad(d) { return d * Math.PI / 180; }
  function meters(a, b) {
    var dLat = rad(b.lat - a.lat), dLng = rad(b.lng - a.lng);
    var s = Math.sin(dLat / 2) * Math.sin(dLat / 2) +
      Math.cos(rad(a.lat)) * Math.cos(rad(b.lat)) * Math.sin(dLng / 2) * Math.sin(dLng / 2);
    return 2 * R * Math.asin(Math.min(1, Math.sqrt(s)));
  }

  /* Punt-in-vlak (even-odd), dezelfde rekenregel als server/kern/stadsweefsel/
     meetkunde.js. Bewust dezelfde: een vlak dat op het toestel anders uitpakt
     dan op de server levert twee waarheden over dezelfde zone op. */
  function inVlak(p, punten) {
    var b = false;
    for (var i = 0, j = punten.length - 1; i < punten.length; j = i++) {
      var a = punten[i], c = punten[j];
      if ((a.lat > p.lat) !== (c.lat > p.lat) &&
        p.lng < (c.lng - a.lng) * (p.lat - a.lat) / (c.lat - a.lat) + a.lng) b = !b;
    }
    return b;
  }

  /* Sta ik in dit hek? `was` is de vorige uitkomst en die telt mee: dat is de
     hysterese. Een vlak kent geen straal, dus daar werkt de marge als een rand
     eromheen die je pas buiten bent als je er echt uit bent. */
  function staatIn(p, hek, was) {
    if (hek.soort === 'vlak') {
      if (inVlak(p, hek.punten)) return true;
      if (!was) return false;
      // nog net binnen de marge langs de rand: dan blijf je "binnen"
      var min = Infinity;
      for (var i = 0; i < hek.punten.length; i++) min = Math.min(min, meters(p, hek.punten[i]));
      return min <= MARGE_M;
    }
    var d = meters(p, hek.punten[0]);
    return was ? d <= (hek.straalM + MARGE_M) : d <= hek.straalM;
  }

  function api(pad, body) {
    var token = null;
    try { token = localStorage.getItem('rtg_member_token'); } catch (e) {}
    return fetch('/api/plaats/' + pad, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + token },
      body: JSON.stringify(body || {})
    }).then(function (r) { return r.json().catch(function () { return {}; }); });
  }

  /* Een peiling verwerken. Let op wat hier NIET gebeurt: er gaat geen lat of lng
     naar api(). Wie deze functie ooit uitbreidt en denkt "handig, stuur de
     positie mee voor de zekerheid" -- de server weigert dat verzoek met een
     fout, en dat is met opzet zo (server/kern/plaats/venster.js). */
  function peiling(plek) {
    if (!doel || !hekken.length) return;
    if (plek.nauwkeurig != null && plek.nauwkeurig > SLECHT_M) return;
    for (var i = 0; i < hekken.length; i++) {
      var h = hekken[i];
      var was = !!binnen[h.id];
      var nu = staatIn(plek, h, was);
      if (nu === was) continue;
      binnen[h.id] = nu;
      api('waarneem', { doel: doel, hek: h.id, wat: nu ? 'binnen' : 'buiten' });
      /* En de meeluisteraars, met het HEK en niet met de plek. Wie hier ooit
         `plek` doorgeeft omdat het handig is, geeft de coordinaat door aan alles
         wat meeluistert -- en dan is de grens van PLAATS.md par. 1 zo lek als
         het aantal luisteraars. */
      for (var j = 0; j < luisteraars.length; j++) {
        try { luisteraars[j]({ doel: doel, hek: h.id, wat: nu ? 'binnen' : 'buiten' }); } catch (e) {}
      }
    }
  }

  /* Beginnen te letten op één doel. `waarom` is de zin die het lid te zien
     krijgt als de locatieschakelaar nog uit staat -- die moet dus over DIT doel
     gaan en niet over locatie in het algemeen. */
  function start(welkDoel, opties) {
    opties = opties || {};
    if (bezig) stop();
    if (!window.RTGPlek) return Promise.resolve({ ok: false, reden: 'geen plek.js' });
    doel = String(welkDoel || '');
    bezig = true;
    return api('hekken', { doel: doel }).then(function (r) {
      if (!r || !Array.isArray(r.hekken) || !r.hekken.length) {
        bezig = false; doel = null;
        return { ok: false, reden: r && r.error ? r.error : 'geen hekken voor dit doel' };
      }
      hekken = r.hekken; binnen = {};
      stopVolgen = window.RTGPlek.volg(peiling, { waarom: opties.waarom ||
        'Om te kunnen merken wanneer je ergens aankomt of weggaat. Je locatie blijft op je toestel; RTG krijgt alleen te horen welk gebied je passeert.' });
      /* Het toestel blijft niet peilen als niemand kijkt -- dezelfde regel als
         in shared/plek.js, en hier extra van belang omdat dit lang kan lopen. */
      window.addEventListener('pagehide', stop);
      return { ok: true, doel: doel, hekken: hekken.length, afgekapt: r.afgekapt || 0 };
    });
  }

  function stop() {
    if (stopVolgen) { try { stopVolgen(); } catch (e) {} stopVolgen = null; }
    hekken = []; binnen = {}; doel = null; bezig = false;
    // de luisteraars blijven staan: een scherm dat opnieuw start, luistert nog
  }

  function stand() {
    var lijst = [];
    for (var id in binnen) if (binnen[id]) lijst.push(id);
    return { doel: doel, hekken: hekken.length, binnen: lijst };
  }

  /* Meeluisteren op een overgang. Geeft een afmeldfunctie terug; zonder die
     blijft een scherm dat weggaat meerekenen aan iets dat niemand meer ziet. */
  function opWissel(cb) {
    if (typeof cb !== 'function') return function () {};
    luisteraars.push(cb);
    return function af() { luisteraars = luisteraars.filter(function (x) { return x !== cb; }); };
  }

  window.RTGPlaats = { start: start, stop: stop, stand: stand, opWissel: opWissel,
    // voor toetsen en voor wie de rekenregel wil narekenen zonder een browser
    _staatIn: staatIn, _inVlak: inVlak, _meters: meters, MARGE_M: MARGE_M, SLECHT_M: SLECHT_M };
})();
