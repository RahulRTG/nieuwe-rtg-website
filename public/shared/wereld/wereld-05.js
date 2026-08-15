
  /* ---------- de levende grond ----------
     Achter alles ligt een canvas dat per wereld een ander motief ademt: golven
     bij Reizen, bouwlijnen bij Kantoor, geometrie bij Geld, stadslichten bij
     Media. Het staat bewust op de rand van zichtbaar. Dat is de bedoeling --
     je hoort het pas na een week te merken, en dan als "die achtergrond klopt
     bij waar ik ben", niet als "kijk, een animatie".

     DRIE REGELS DIE HIER NIET ONDERHANDELBAAR ZIJN:
     1. Het draagt geen betekenis. Alles wat je moet WETEN staat in tekst; deze
        laag is sfeer. Daarom is het canvas voor een schermlezer niet aanwezig
        en vangt het geen tikken.
     2. Het luistert naar de schuif Beweging (window.RTGBeweging) en naar
        prefers-reduced-motion. Op stil wordt er EEN beeld getekend en verder
        niets -- geen lus die stilletjes door blijft draaien.
     3. Het staat stil zodra het tabblad weg is. Een achtergrond die op een
        onzichtbare pagina batterij verstookt, is geen sfeer maar een lek. */
  var grond = { cv: null, ctx: null, motief: null, t: 0, laatst: 0, tik: null, kleur: '#C9A24B' };

  /* DE STERRENHEMEL VAN DE POORT, OP HET BEGINSCHERM.

     Precies dezelfde laag als op de inlogpoort (app-main-04b.js hangt hem daar
     op), met dezelfde sterrenbeelden op dezelfde plek aan de hemel. Dat is de
     hele bedoeling: je logt in onder een firmament en je komt binnen onder
     hetzelfde firmament. Een eigen namaakhemel hiernaast zou twee hemels zijn
     die na de eerste wijziging uit elkaar lopen.

     De module wordt bijgeladen als hij er nog niet is; lukt dat niet, dan is er
     gewoon geen sterrenhemel en verandert er verder niets. */
  /* EN HIJ WORDT PAS OPGEHANGEN ALS HET SCHERM EEN MAAT HEEFT.

     shared/sterren.js meet zijn doel met Math.max(1, breedte). Dat is voor de
     inlogpoort prima -- die staat in beeld op het moment dat hij wordt
     opgehangen -- maar het beginscherm wordt opgebouwd terwijl de poort er nog
     overheen ligt. Dan is de maat nul, wordt het doek 1 bij 1 pixel, en rekt
     het blad die ene pixel uit tot een egaal vlak over het hele scherm. Wat je
     ziet is geen sterrenhemel maar een crèmekleurige lap over je hele
     beginscherm -- en niets in de console zegt er iets over.

     Dezelfde les als bij de gloed hieronder, en daarom hier hetzelfde middel:
     wachten tot het scherm werkelijk een maat heeft, en dan pas ophangen. */
  var hemel = null, hemelMaat = '', hemelWacht = null, hemelLaadt = false;

  /* Nog eens kijken op het volgende beeld, met een bodem eronder: een animatie
     die om wat voor reden ook nooit eindigt, mag geen lus worden die blijft
     draaien zolang de app openstaat. */
  var hemelBeurten = 0;
  function hemelStraks() {
    if (hemelBeurten > 120) return;            // ~2 seconden, dan is het klaar
    hemelBeurten++;
    w.requestAnimationFrame(function () { hangHemel(); });
  }

  function bouwHemel() {
    if (!el.scherm) return;
    hemelBeurten = 0;
    hangHemel();
    if (hemelWacht) return;
    try {
      if (w.ResizeObserver) {
        hemelWacht = new w.ResizeObserver(function () { hangHemel(); });
        hemelWacht.observe(el.scherm);
      }
    } catch (e) { /* geen waarnemer: dan blijft het bij de eerste meting */ }
  }

  /* De hemel hangt op de maat die het scherm NU heeft, en blijft dat volgen.
     Twee keer meten is hier geen luxe:

     1. Bij het opbouwen heeft het scherm vaak nog helemaal geen maat (de poort
        ligt er nog overheen), en dan wordt het doek 1 bij 1 -- zie hierboven.
     2. Ook daarna klopt de eerste meting niet meteen. Gemeten: 368 bij 737
        terwijl het scherm 393 bij 788 werd. Het doek wordt dan door het blad
        uitgerekt, en een uitgerekte sterrenhemel is een WAZIGE sterrenhemel --
        precies het soort verschil dat je niet als fout herkent maar als
        "goedkoop".

     shared/sterren.js meet alleen bij het ophangen en bij een venster-resize,
     dus dat laatste vangt hij niet. Vandaar dat we hem bij een echte
     maatverandering opnieuw ophangen; hij ruimt zichzelf netjes op met stop(). */
  function hangHemel() {
    var b = el.scherm.getBoundingClientRect();
    var lb = el.scherm.clientWidth, lh = el.scherm.clientHeight;
    /* Een ResizeObserver is een extra vangnet, geen voorwaarde. In een drukke
       browser kan de eerste nulmaat precies tussen observerregistratie en de
       eerste melding vallen. Zonder eigen herpoging blijft die sessie dan
       voorgoed zonder hemel. */
    if (lb < 40 || lh < 40) { hemelStraks(); return false; }
    /* NIET OPHANGEN TERWIJL HET SCHERM NOG BINNENKOMT.

       Het beginscherm heeft een openingsanimatie die hem van 0,98 naar 1
       schaalt (osThuis, zie app.html). shared/sterren.js meet met
       getBoundingClientRect(), en die geeft de GESCHAALDE maat -- dus wie
       midden in die animatie ophangt, krijgt een doek van 386 bij 773 dat het
       blad daarna uitrekt naar 393 bij 788. Dat is geen fout die je herkent,
       het is een sterrenhemel die net iets wazig is: het soort verschil dat
       niet als kapot leest maar als goedkoop.

       Een ResizeObserver ziet dit niet -- een transform verandert de
       indelingsmaat niet -- dus wachten we tot de getekende maat en de
       indelingsmaat weer gelijk zijn, en kijken tot die tijd elk beeld opnieuw. */
    if (Math.abs(b.width - lb) > 1 || Math.abs(b.height - lh) > 1) { hemelStraks(); return false; }
    var maat = lb + 'x' + lh;
    if (maat === hemelMaat) return true;
    hemelMaat = maat;
    var doe = function () {
      if (!w.RTGSterren) return;
      if (hemel && hemel.stop) { try { hemel.stop(); } catch (e) {} }
      hemel = w.RTGSterren.hang(el.scherm, { helderheid: 0.62, dichtheid: 0.8 });
    };
    if (w.RTGSterren) { doe(); return true; }
    if (hemelLaadt) return true;               // al onderweg; niet twee keer laden
    hemelLaadt = true;
    var s = d.createElement('script');
    s.src = '/shared/sterren.js'; s.async = true;
    s.onload = function () { hemelLaadt = false; hemelMaat = ''; hangHemel(); };
    /* Een tijdelijk afgebroken statische aanvraag mag de hemel niet voor de
       hele sessie uitschakelen. Geef de begrensde bestaande herprobeerlus de
       kans opnieuw te laden; verwijder eerst het mislukte script-element. */
    s.onerror = function () {
      hemelLaadt = false; hemelMaat = '';
      if (s.parentNode) s.parentNode.removeChild(s);
      hemelStraks();
    };
    (d.head || d.documentElement).appendChild(s);
    return true;
  }

  function bouwGrond() {
    if (grond.cv) return;
    var cv = d.createElement('canvas');
    cv.className = 'os-wereld-grond';
    cv.setAttribute('aria-hidden', 'true');
    el.scherm.insertBefore(cv, el.scherm.firstChild);
    grond.cv = cv;
    grond.ctx = cv.getContext && cv.getContext('2d');
    el.grond = cv;
    /* DE MAAT VOLGT HET ELEMENT, NIET EEN MOMENT.

       Hier stond een eenmalige meting plus een resize-listener, en dat is een
       klassieke halve maatregel: op het moment dat het canvas wordt aangemaakt
       heeft de indeling nog niet gedraaid, dus clientWidth is 0 en het canvas
       werd 2 bij 2 pixels. Daarna kwam er geen resize meer -- het venster
       veranderde immers niet -- en bleef het zo. Gemeten: nul getekende pixels,
       een achtergrond die er wel was en niets deed.

       Een waarnemer op het element zelf heeft dat probleem niet: hij vuurt
       zodra de indeling het canvas een maat geeft, en daarna bij elke wijziging
       (venster, toetsenbord dat opkomt, de wingpanelen die openschuiven). */
    try {
      if (w.ResizeObserver) { new w.ResizeObserver(grondMaat).observe(cv); }
      else w.addEventListener('resize', grondMaat);
    } catch (e) { try { w.addEventListener('resize', grondMaat); } catch (e2) {} }
    grondMaat();
    try { d.addEventListener('visibilitychange', function () { if (!d.hidden) grondStart(); }); } catch (e) {}
  }

  function grondMaat() {
    if (!grond.cv) return;
    var r = Math.min(2, w.devicePixelRatio || 1);
    var b = grond.cv.clientWidth, h = grond.cv.clientHeight;
    if (!b || !h) return;                 // nog geen indeling: dan ook niet meten
    var nb = Math.round(b * r), nh = Math.round(h * r);
    if (nb === grond.cv.width && nh === grond.cv.height) return;
    grond.cv.width = nb; grond.cv.height = nh;
    grondFrame();
  }

  // welk motief hoort bij de wereld waar je staat? Ingezoomd blijft het motief
  // van de wereld staan -- je bent er nog steeds, alleen dieper.
  function grondKies() {
    var sleutel = st.diep
      ? (st.werelden[st.wereldIdx] || {}).sleutel
      : ((huidige() || {}).sleutel);
    grond.motief = MOTIEVEN[sleutel] || MOTIEVEN['map-reizen'];
    grondFrame();
  }

  function beweegFactor() {
    if (RUSTIG) return 0;
    try { if (w.RTGBeweging && w.RTGBeweging.factor) return w.RTGBeweging.factor(); } catch (e) {}
    return 0.6;
  }
