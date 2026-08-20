/* Je plek, maar alleen als je dat wilt: een vraag in plaats van stilte.

   Waarom dit bestaat. De GPS-schakelaar in het bedieningspaneel (rtg_os_gps) is
   de waarheid: alleen een uitdrukkelijke "1" geeft je locatie vrij. Dat is goed,
   en het is met opzet zo. Maar de zeven plekken die je positie gebruiken deden
   er allemaal hetzelfde mee: schakelaar uit, dan stil overslaan. Voor de
   sterrenhemel of een kaart met een demo-startpunt kan dat. Voor de
   navigatie-app is het dodelijk, want DAAR is je positie de hele functie: je
   opent hem, hij vindt je nooit, en niets legt uit waarom. "De navigatie doet
   het niet", en gelijk heeft wie dat zegt.

   De uitweg is niet de schakelaar negeren maar hem noemen. Een app die je plek
   echt nodig heeft vraagt erom, met de reden erbij, en zet hem pas aan als jij
   dat zegt. Zeg je nee, dan gaat de app door zonder positie en vraagt hij het
   deze sessie niet nog eens: een vraag is een vraag, geen zeurpiet.

   Gebruik:
     RTGPlek.aan()                      staat de schakelaar aan?
     RTGPlek.vraag({ waarom: '...' })   -> Promise van {lat,lng} of null
     RTGPlek.volg(cb, { waarom })       -> stopfunctie; cb krijgt elke nieuwe plek
     RTGPlek.zetAan(true|false)         de schakelaar zelf (bedieningspaneel)

   De browser vraagt daarna zelf nog een keer toestemming, en dat is juist: onze
   schakelaar gaat over wat RTG doet, die van de browser over wat het toestel
   afgeeft. Weigert de browser, dan zetten we onze schakelaar weer uit, anders
   staat er "aan" terwijl er niets komt. */
(function () {
  'use strict';
  if (window.RTGPlek) return;

  var SLEUTEL = 'rtg_os_gps';
  var geweigerd = false;   // deze sessie al "nee" gezegd: niet opnieuw vragen

  function aan() {
    try { return localStorage.getItem(SLEUTEL) === '1'; } catch (e) { return false; }
  }
  function zet(waarde) {
    try { localStorage.setItem(SLEUTEL, waarde ? '1' : '0'); } catch (e) {}
  }

  /* De vraag zelf: een rustige kaart onderin, in de stijl van het huis. Geen
     browser-confirm, want dat is niet van ons en leest als een storing. */
  function toonVraag(waarom) {
    return new Promise(function (klaar) {
      var st = document.createElement('style');
      st.textContent =
        '.rtgplek{position:fixed;left:50%;transform:translateX(-50%);z-index:9985;' +
          'bottom:calc(env(safe-area-inset-bottom,0px) + 5.5rem);width:min(24rem,calc(100vw - 2rem));' +
          'background:var(--paneel,#151312);border:1px solid var(--line,var(--lijn,#2A2724));' +
          'border-radius:0;padding:1rem 1.1rem;color:var(--txt,#F7F5F1);' +
          'font-family:Inter,system-ui,sans-serif;box-shadow:0 14px 40px rgba(0,0,0,.45);}' +
        '.rtgplek p{margin:0 0 .8rem;font-size:.85rem;line-height:1.55;color:var(--muted,var(--zacht,#8A8680));}' +
        '.rtgplek .rij{display:flex;gap:.6rem;}' +
        '.rtgplek button{flex:1;border:none;border-radius:0;padding:.6rem;font:inherit;' +
          'font-size:.82rem;font-weight:600;cursor:pointer;}' +
        '.rtgplek .ja{background:var(--gold,#857007);color:#0C0C0B;}' +
        '.rtgplek .nee{background:none;color:var(--muted,#8A8680);font-weight:500;}';
      document.head.appendChild(st);

      var doos = document.createElement('div');
      doos.className = 'rtgplek';
      doos.setAttribute('role', 'dialog');
      doos.setAttribute('aria-label', 'Locatie gebruiken');
      var p = document.createElement('p');
      p.textContent = waarom || 'Hiervoor heb ik je locatie nodig. Die blijft op je toestel.';
      var rij = document.createElement('div'); rij.className = 'rij';
      var ja = document.createElement('button'); ja.className = 'ja'; ja.type = 'button'; ja.textContent = 'Aanzetten';
      var nee = document.createElement('button'); nee.className = 'nee'; nee.type = 'button'; nee.textContent = 'Nu niet';
      rij.append(nee, ja);
      doos.append(p, rij);
      document.body.appendChild(doos);
      /* De focus gaat de kaart in: anders staat er een vraag in beeld waar een
         toetsenbordgebruiker pas na tien tabs bij is, en die hij met een
         schermlezer helemaal niet hoort. */
      var vorigeFocus = document.activeElement;
      ja.focus();

      /* Escape is "nu niet". Een vraag die je niet met het toetsenbord kunt
         wegleggen, houdt iemand vast in een keuze die hij niet wil maken. */
      function opToets(ev) { if (ev.key === 'Escape') { ev.preventDefault(); geweigerd = true; sluit(false); } }
      doos.addEventListener('keydown', opToets);

      function sluit(antwoord) {
        doos.remove(); st.remove();
        /* En de focus terug waar hij vandaan kwam: wie na het antwoord op
           <body> achterblijft, is zijn plek in het scherm kwijt. */
        try { if (vorigeFocus && vorigeFocus.focus && document.contains(vorigeFocus)) vorigeFocus.focus({ preventScroll: true }); } catch (e) {}
        klaar(antwoord);
      }
      ja.addEventListener('click', function () { sluit(true); });
      nee.addEventListener('click', function () { geweigerd = true; sluit(false); });
    });
  }

  /* Een positie ophalen. Het toestel mag altijd nog nee zeggen; dan zetten we
     onze eigen schakelaar terug op uit, want anders belooft het bedieningspaneel
     iets wat het niet waarmaakt. */
  function haal(opties) {
    return new Promise(function (klaar) {
      if (!navigator.geolocation) return klaar(null);
      navigator.geolocation.getCurrentPosition(
        function (p) { klaar({ lat: p.coords.latitude, lng: p.coords.longitude, nauwkeurig: p.coords.accuracy }); },
        function () { zet(false); klaar(null); },
        Object.assign({ enableHighAccuracy: true, timeout: 12000, maximumAge: 60000 }, opties || {})
      );
    });
  }

  async function vraag(opties) {
    opties = opties || {};
    if (aan()) return haal(opties.gps);
    if (geweigerd || !document.body) return null;
    var wil = await toonVraag(opties.waarom);
    if (!wil) return null;
    zet(true);
    var plek = await haal(opties.gps);
    return plek;   // haal() zet de schakelaar zelf terug als het toestel weigert
  }

  /* Meelopen met je positie (navigatie, een rit volgen). Geeft een stopfunctie
     terug; die hoort bij het verlaten van het scherm aangeroepen te worden,
     anders blijft het toestel peilen als niemand kijkt. */
  function volg(cb, opties) {
    opties = opties || {};
    var id = null, gestopt = false;
    function start() {
      if (gestopt || !navigator.geolocation) return;
      id = navigator.geolocation.watchPosition(function (p) {
        cb({ lat: p.coords.latitude, lng: p.coords.longitude, nauwkeurig: p.coords.accuracy });
      }, function () { zet(false); }, Object.assign({ enableHighAccuracy: true, maximumAge: 10000 }, opties.gps));
    }
    if (aan()) start();
    else vraag(opties).then(function (plek) { if (plek) { cb(plek); start(); } });
    return function stop() {
      gestopt = true;
      if (id != null && navigator.geolocation) { navigator.geolocation.clearWatch(id); id = null; }
    };
  }

  /* DE SCHAKELAAR ZELF, VOOR HET BEDIENINGSPANEEL.

     Hierboven staat dat de schakelaar in het bedieningspaneel woont. Dat was
     niet waar: `rtg_os_gps` werd door zeven plekken GELEZEN en door niemand
     GEZET -- de tegel bestond niet, en het bestand waar de commentaren naar
     verwijzen (shared/osmenu.js) evenmin. Wie hem nooit had aangeraakt hield
     dus een sleutel die er niet is, en dat leest als "uit". Gevolg: de
     sterrenhemel, het levensteken van RTG Veilig, de ontmoet-lus en drie
     reis-apps deden stil niets, voor altijd.

     Aanzetten is meer dan een vlaggetje omzetten: we halen meteen een positie
     op. Anders staat de tegel op "aan" terwijl het toestel nog nooit iets heeft
     afgegeven, en dat is precies de belofte die dit huis niet wil doen. Weigert
     de browser, dan zet haal() de schakelaar terug op uit en geeft dit false. */
  async function zetAan(waarde) {
    if (!waarde) { zet(false); return false; }
    zet(true);
    geweigerd = false;          // een bewuste tik heft het "nu niet" van deze sessie op
    await haal();
    return aan();               // haal() kan hem hebben teruggezet
  }

  window.RTGPlek = { aan: aan, vraag: vraag, volg: volg, zetAan: zetAan };
})();
