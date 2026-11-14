/* Locatie na expliciete toestemming: alleen rtg_os_gps='1' geeft vrij.
   "Nu niet" geldt deze sessie; de browser houdt daarnaast zijn eigen poort.
   aan() leest de stand; vraag({waarom,gps}) geeft een positie of null;
   volg(cb,{waarom,gps,geenPlek,bijIntrekken}) geeft een stopfunctie.
   bijIntrekken meldt globale intrekking, ook na een fix; lokale stop niet.
   zetAan(bool) bedient dezelfde schakelaar; toestelweigering zet hem uit.
   toestemmingVersie() is een leesbare generatie voor werk vóór een volg(). */
(function () {
  'use strict';
  if (window.RTGPlek) return;

  var SLEUTEL = 'rtg_os_gps';
  var geweigerd = false;   // deze sessie al "nee" gezegd: niet opnieuw vragen
  var generatie = 0, lopend = new Set();

  function laadPlekPresentatie(pad) {
    if (document.documentElement.hasAttribute('data-ds')) return;
    if (document.getElementById('rtgDsRuntimeCss')) return;
    var plekStijlLink = document.createElement('link');
    plekStijlLink.setAttribute('id', 'rtgDsRuntimeCss');
    plekStijlLink.rel = 'stylesheet';
    plekStijlLink.href = pad;
    document.head.appendChild(plekStijlLink);
  }
  laadPlekPresentatie('/ds/rtg-ds.css');

  function aan() {
    try { return localStorage.getItem(SLEUTEL) === '1'; } catch (e) { return false; }
  }
  function zet(waarde) {
    try { localStorage.setItem(SLEUTEL, waarde ? '1' : '0'); } catch (e) {}
  }
  function actief(volger) { return !volger.gestopt && volger.generatie === generatie; }
  function eigenaar() {
    var v = { generatie: generatie, gestopt: false, sluit: null, annuleer: null, id: null };
    v.stop = function () {
      if (v.gestopt) return;
      v.gestopt = true; lopend.delete(v);
      if (v.sluit) v.sluit();
      if (v.annuleer) v.annuleer();
      if (v.id != null && navigator.geolocation) { navigator.geolocation.clearWatch(v.id); v.id = null; }
    };
    lopend.add(v); return v;
  }
  function wissel(waarde) {
    var ronde = ++generatie, oud = Array.from(lopend).reverse();
    if (typeof waarde === 'boolean') zet(waarde);
    oud.forEach(function (v) { v.stop(); });
    // Eerst alle oude owners stoppen; een callback mag daarna nieuw werk maken.
    oud.forEach(function (v) { if (v.bijIntrekken) { try { v.bijIntrekken(); } catch (e) {} } });
    return ronde;
  }
  function ontzeg(volger, reden) {
    if (!actief(volger)) return;
    var meld = volger.weigering;
    var ronde = wissel(false);
    if (ronde === generatie && meld) meld(reden);
  }

  /* De vraag zelf: een rustige kaart onderin, in de stijl van het huis. Geen
     browser-confirm, want dat is niet van ons en leest als een storing. */
  function toonVraag(waarom, volger) {
    return new Promise(function (klaar) {
      if (!actief(volger)) return klaar(false);
      var gesloten = false;
      var doos = document.createElement('div');
      doos.className = 'rtgplek ds-plek';
      doos.setAttribute('role', 'dialog');
      doos.setAttribute('aria-modal', 'false');
      doos.setAttribute('aria-label', 'Locatie gebruiken');
      var p = document.createElement('p');
      p.textContent = waarom || 'Hiervoor heb ik je locatie nodig. Die blijft op je toestel.';
      var rij = document.createElement('div'); rij.className = 'rij';
      var ja = document.createElement('button'); ja.className = 'ja ds-knop ds-knop--primair'; ja.type = 'button'; ja.textContent = 'Aanzetten';
      var nee = document.createElement('button'); nee.className = 'nee ds-knop ds-knop--stil'; nee.type = 'button'; nee.textContent = 'Nu niet';
      nee.setAttribute('data-contextactie', '');
      rij.append(nee, ja);
      doos.append(p, rij);
      document.body.appendChild(doos);
      // De niet-modale vraag krijgt focus en herstelt die bij sluiten.
      var vorigeFocus = document.activeElement;
      volger.sluit = function () { sluit(false); };
      ja.focus();

      function opToets(ev) { if (ev.key === 'Escape' && !gesloten) { ev.preventDefault(); weiger(); } }
      doos.addEventListener('keydown', opToets);

      function sluit(antwoord) {
        if (gesloten) return;
        antwoord = !!antwoord && doos.isConnected && actief(volger);
        gesloten = true;
        volger.sluit = null;
        var herstelFocus = doos.contains(document.activeElement);
        doos.remove();
        /* En de focus terug waar hij vandaan kwam: wie na het antwoord op
           <body> achterblijft, is zijn plek in het scherm kwijt. */
        try { if (herstelFocus && vorigeFocus && vorigeFocus.focus && document.contains(vorigeFocus)) vorigeFocus.focus({ preventScroll: true }); } catch (e) {}
        klaar(antwoord);
      }
      function weiger() {
        if (gesloten) return;
        if (actief(volger)) geweigerd = true;
        sluit(false);
      }
      ja.addEventListener('click', function () { sluit(true); });
      nee.addEventListener('click', weiger);
    });
  }

  /* Een positie ophalen. Het toestel mag altijd nog nee zeggen; dan zetten we
     onze eigen schakelaar terug op uit, want anders belooft het bedieningspaneel
     iets wat het niet waarmaakt. */
  function haal(opties, volger) {
    return new Promise(function (klaar) {
      if (!actief(volger) || !navigator.geolocation) return klaar(null);
      var af = false;
      function eindig(plek) {
        if (af) return;
        af = true; volger.annuleer = null;
        klaar(actief(volger) && aan() ? plek : null);
      }
      volger.annuleer = function () { eindig(null); };
      navigator.geolocation.getCurrentPosition(
        function (p) { eindig({ lat: p.coords.latitude, lng: p.coords.longitude, nauwkeurig: p.coords.accuracy }); },
        function () { if (!af) ontzeg(volger, 'niet-toegestaan'); eindig(null); },
        Object.assign({ enableHighAccuracy: true, timeout: 12000, maximumAge: 60000 }, opties || {})
      );
    });
  }

  async function vraagPlek(opties, volger) {
    opties = opties || {};
    if (!actief(volger)) return null;
    if (aan()) return haal(opties.gps, volger);
    if (geweigerd || !document.body) return null;
    var wil = await toonVraag(opties.waarom, volger);
    if (!wil || !actief(volger)) return null;
    zet(true);
    var plek = await haal(opties.gps, volger);
    return plek;   // haal() zet de schakelaar zelf terug als het toestel weigert
  }
  async function vraag(opties) {
    var volger = eigenaar();
    try {
      var plek = await vraagPlek(opties, volger);
      return actief(volger) && aan() ? plek : null;
    } finally { volger.stop(); }
  }

  /* Meelopen met je positie (navigatie, een rit volgen). Geeft een stopfunctie
     terug; die hoort bij het verlaten van het scherm aangeroepen te worden,
     anders blijft het toestel peilen als niemand kijkt. */
  /* geenPlek gaat hoogstens eenmaal af en nooit na een geslaagde fix:
     geen-gps, niet-toegestaan (vraag/eerste fix), of toestel-weigert (watch). */
  function volg(cb, opties) {
    opties = opties || {};
    var volger = eigenaar(), gehad = false, gemeld = false;
    if (typeof opties.bijIntrekken === 'function') volger.bijIntrekken = opties.bijIntrekken;
    function gezien(plek) { if (!actief(volger) || !aan()) return; gehad = true; cb(plek); }
    function meld(reden) {
      if (gehad || gemeld) return;
      gemeld = true;
      if (typeof opties.geenPlek === 'function') opties.geenPlek(reden);
    }
    function niets(reden) { if (actief(volger)) { volger.stop(); meld(reden); } }
    volger.weigering = meld;
    function start() {
      if (!actief(volger) || !aan()) return;
      if (!navigator.geolocation) return niets('geen-gps');
      var id = navigator.geolocation.watchPosition(function (p) {
        gezien({ lat: p.coords.latitude, lng: p.coords.longitude, nauwkeurig: p.coords.accuracy });
      }, function () { ontzeg(volger, 'toestel-weigert'); }, Object.assign({ enableHighAccuracy: true, maximumAge: 10000 }, opties.gps));
      if (actief(volger)) volger.id = id;
      else navigator.geolocation.clearWatch(id);
    }
    if (aan()) start();
    else vraagPlek(opties, volger).then(function (plek) { if (plek) { gezien(plek); start(); } else niets('niet-toegestaan'); });
    return volger.stop;
  }

  /* Een bewuste tik heft "nu niet" op; het toestel moet nog toestemming geven. */
  async function zetAan(waarde) {
    var ronde = wissel(!!waarde);
    if (!waarde || ronde !== generatie || !aan()) return false;
    geweigerd = false;          // een bewuste tik heft het "nu niet" van deze sessie op
    var volger = eigenaar();
    try { await haal(null, volger); return actief(volger) && aan(); }
    finally { volger.stop(); }
  }

  window.addEventListener('storage', function (ev) {
    if ((ev.key === SLEUTEL || ev.key === null) && (!ev.storageArea || ev.storageArea === localStorage)) wissel();
  });
  window.RTGPlek = { aan: aan, vraag: vraag, volg: volg, zetAan: zetAan,
    toestemmingVersie: function () { return generatie; } };
})();
