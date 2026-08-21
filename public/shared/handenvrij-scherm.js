/* Muisvrij bedienen, deel 5: het scherm van Rahul zelf.

   De chatbox is het ENIGE dat permanent in beeld staat. Alles wat daar eerder
   omheen zweefde (de losse Rahul-knop van de metgezel, de pil met "draaien" en
   "volledig scherm") is daarin opgegaan; die twee melden zich hier af zodra
   dit bestand er is. Een scherm met vier zwevende dingen in de hoeken is geen
   OS maar een bureaublad vol post-its.

   Vier standen, en hij beweegt uit zichzelf tussen de eerste drie:

     min      alleen de balk. De stand waarin je de pagina gebruikt.
     half     hij praat, je leest mee. Hier komt hij vanzelf terecht.
     vol      een echt gesprek; er blijft bewust een strook pagina zichtbaar.
     scherm   volledig scherm, voor als de chat even de hele app is.

   DE BEWEGING: zegt Rahul iets, dan komt hij omhoog (min -> half). Zeg jij
   iets terug, dan zakt hij weer weg zodat je ziet waar je mee bezig was. Dat
   is de hele interactie; je hoeft nergens op te tikken.

   MAAR: zodra jij zelf een stand kiest, houdt hij zich stil. Een scherm dat
   terugveert nadat je het met de hand hebt gezet, voelt kapot. De pin gaat er
   pas weer af als je hem helemaal dichtdoet.

   ALTIJD KUNNEN SCROLLEN: dit bestand zet nooit overflow:hidden op de body en
   vangt geen wielgebeurtenissen buiten zijn eigen paneel. In de stand `vol`
   blijft er met opzet een strook pagina over: die is aan te raken, te scrollen
   en aan te tikken (dat laatste laat hem zakken). Alleen in `scherm` is de
   chat het scherm -- dan scrol je door de chat, en dat is dan ook de bedoeling.

   IETS ANDERS IN VOLLEDIG SCHERM: kijkt iemand een video of een foto op vol
   scherm, dan hoort er geen balk overheen te liggen. Hij verdwijnt vanzelf en
   komt daarna terug in de stand waarin hij stond. Ons EIGEN volledige scherm
   telt daarbij niet mee, anders zou hij zichzelf wegpoetsen. */
(function (root) {
  'use strict';
  if (root.__handenvrijScherm) return; root.__handenvrijScherm = true;
  var kamer = root.__handenvrijKamer;
  if (!kamer || !kamer.vak) return;
  var chat = kamer.vak;

  var STANDEN = ['min', 'half', 'vol', 'scherm'];
  var BEWAAR = 'rtg_hv_stand';
  var stand = 'min', vast = false, weggeklapt = false, voorWeg = 'min';

  var css =
    /* De hoogtes per stand. Het paneel zelf scrolt; de pagina erachter blijft
       gewoon de pagina. In `vol` staat de bovenkant op 12vh: die strook is
       geen decoratie maar de uitweg. */
    '.hv-chat{transition:max-height .22s ease,top .22s ease;}' +
    '.hv-chat[data-stand="half"]{max-height:46vh;}' +
    '.hv-chat[data-stand="vol"]{max-height:calc(88vh - 3.4rem);}' +
    '.hv-chat[data-stand="scherm"]{top:0;bottom:0;max-height:none;padding-top:0;}' +
    '.hv-chat[data-stand="scherm"] .hv-greep{border-radius:0;}' +
    /* de greep: sticky bovenin het paneel, zodat hij bij het scrollen blijft */
    '.hv-greep{position:sticky;top:-.7rem;margin:-.7rem -.8rem .3rem;padding:.45rem .8rem .5rem;' +
    'background:#0C0C0B;border-bottom:1px solid #201e1c;display:flex;align-items:center;gap:.4rem;' +
    'z-index:2;touch-action:none;cursor:ns-resize;}' +
    '.hv-lijn{width:2.2rem;height:.22rem;border-radius:0;background:#3a3733;margin-right:auto;}' +
    '.hv-sk{background:transparent;border:1px solid #3a3733;border-radius:0;color:#cfccc7;' +
    'font:inherit;font-size:.72rem;line-height:1;padding:.32rem .45rem;cursor:pointer;flex:0 0 auto;}' +
    '.hv-sk:hover{border-color:var(--gold,#857007);color:#fff;}' +
    '.hv-sk:focus-visible{outline:2px solid var(--gold,#857007);outline-offset:2px;}' +
    '.hv-sk[aria-pressed="true"]{background:var(--gold,#857007);color:#0C0C0B;border-color:var(--gold,#857007);}' +
    /* weggeklapt: iets anders staat op vol scherm */
    'body.hv-weg .hv-chat,body.hv-weg .hv-balk{display:none !important;}' +
    'body.hv-weg{padding-bottom:0 !important;}' +
    /* de zwevers die hierin opgaan */
    'body.hv-os .rtg-scherm,body.hv-os .mgz-rahul{display:none !important;}' +
    '@media (prefers-reduced-motion: reduce){.hv-chat{transition:none;}}';
  var st = document.createElement('style'); st.textContent = css; document.head.appendChild(st);
  document.body.classList.add('hv-os');

  /* ---------- de greep ---------- */
  var greep = document.createElement('div');
  greep.className = 'hv-greep';
  greep.innerHTML = '<span class="hv-lijn" aria-hidden="true"></span>' +
    '<button class="hv-sk" type="button" data-stand="half">Half</button>' +
    '<button class="hv-sk" type="button" data-stand="vol">Vol</button>' +
    '<button class="hv-sk" type="button" data-scherm>Volledig</button>' +
    '<button class="hv-sk" type="button" data-draai title="Beeld draaien">Draai</button>' +
    '<button class="hv-sk" type="button" data-min aria-label="Chat wegklappen">v</button>';
  chat.insertBefore(greep, chat.firstChild);

  function tekenKnoppen() {
    greep.querySelectorAll('[data-stand]').forEach(function (b) {
      b.setAttribute('aria-pressed', String(b.dataset.stand === stand));
    });
    var vs = greep.querySelector('[data-scherm]');
    vs.setAttribute('aria-pressed', String(stand === 'scherm'));
    vs.textContent = stand === 'scherm' ? 'Terug' : 'Volledig';
  }

  /* ---------- standen ---------- */
  function echtVolScherm(aan) {
    var d = document, e = chat;
    try {
      if (aan && !d.fullscreenElement) (e.requestFullscreen || e.webkitRequestFullscreen || function () {}).call(e);
      if (!aan && d.fullscreenElement === chat) (d.exitFullscreen || d.webkitExitFullscreen || function () {}).call(d);
    } catch (er) { /* zonder toestemming blijft de CSS-stand staan; dat werkt ook */ }
  }

  function zet(nieuw, doorMij) {
    if (STANDEN.indexOf(nieuw) < 0) return;
    var was = stand;
    stand = nieuw;
    if (doorMij) vast = (nieuw !== 'min');   // dichtdoen haalt de pin er weer af
    chat.dataset.stand = stand;
    chat.hidden = (stand === 'min');
    if (was === 'scherm' && stand !== 'scherm') echtVolScherm(false);
    if (stand === 'scherm') echtVolScherm(true);
    tekenKnoppen();
    try { localStorage.setItem(BEWAAR, stand === 'scherm' ? 'vol' : stand); } catch (e) {}
    if (stand !== 'min') { try { chat.scrollTop = chat.scrollHeight; } catch (e) {} }
  }

  greep.querySelectorAll('[data-stand]').forEach(function (b) {
    b.addEventListener('click', function () { zet(b.dataset.stand, true); });
  });
  greep.querySelector('[data-scherm]').addEventListener('click', function () {
    zet(stand === 'scherm' ? 'half' : 'scherm', true);
  });
  greep.querySelector('[data-min]').addEventListener('click', function () { zet('min', true); });
  greep.querySelector('[data-draai]').addEventListener('click', function () {
    if (root.RTGscherm && root.RTGscherm.draai) root.RTGscherm.draai();
  });

  /* Slepen aan de greep: omhoog = groter, omlaag = kleiner. Een korte tik telt
     niet mee (drempel van 18 pixels), anders zou elke aanraking van de rand het
     paneel laten springen. */
  (function () {
    var neer = null;
    greep.addEventListener('pointerdown', function (e) {
      if (e.target.closest && e.target.closest('button')) return;
      neer = { y: e.clientY, stand: stand };
      try { greep.setPointerCapture(e.pointerId); } catch (er) {}
    });
    greep.addEventListener('pointermove', function (e) {
      if (!neer) return;
      var dy = neer.y - e.clientY;
      if (Math.abs(dy) < 18) return;
      var i = STANDEN.indexOf(neer.stand) + (dy > 0 ? 1 : -1);
      var doel = STANDEN[Math.max(0, Math.min(2, i))];   // slepen gaat tot `vol`
      if (doel && doel !== stand) { zet(doel, true); neer = null; }
    });
    greep.addEventListener('pointerup', function () { neer = null; });
    greep.addEventListener('pointercancel', function () { neer = null; });
  })();

  /* ---------- de beweging ----------
     `naStand` wordt door handenvrij-chat.js aangeroepen bij elke beurt. */
  kamer.naStand = function (van) {
    if (weggeklapt || vast) return;
    /* `geenZak` staat aan als de beurt van de gebruiker geen ANTWOORD is maar
       een aanzet: een foto die net gemaakt is (handenvrij-oog.js). Zonder deze
       uitzondering klapt het paneel dicht op het moment dat je net iets liet
       zien, om een tel later weer open te gaan voor het antwoord. */
    if (van === 'member') { if (stand !== 'min' && !kamer.geenZak) zet('min', false); return; }
    if (stand === 'min') zet(bewaardeStand(), false);
  };
  function bewaardeStand() {
    var v = null; try { v = localStorage.getItem(BEWAAR); } catch (e) {}
    return (v === 'vol') ? 'vol' : 'half';
  }

  /* In de stand `vol` blijft er een strook pagina over. Tikken op die strook
     laat het paneel zakken; dat is sneller dan de knop zoeken en het maakt de
     strook meteen duidelijk als uitweg. Alleen tikken -- scrollen op die
     strook doet gewoon wat het altijd doet. */
  document.addEventListener('pointerdown', function (e) {
    if (stand !== 'vol' && stand !== 'half') return;
    if (chat.contains(e.target) || (root.__handenvrijKamer.knop && root.__handenvrijKamer.knop.contains(e.target))) return;
    var b = document.querySelector('.hv-balk');
    if (b && b.contains(e.target)) return;
    zet('min', true);
  }, true);

  /* ---------- iets anders staat op vol scherm ---------- */
  function iemandAndersVolScherm() {
    var el = document.fullscreenElement || document.webkitFullscreenElement || null;
    return !!el && el !== chat && !chat.contains(el);
  }
  function kijkVolScherm() {
    var anders = iemandAndersVolScherm();
    if (anders && !weggeklapt) {
      weggeklapt = true; voorWeg = stand;
      document.body.classList.add('hv-weg');
    } else if (!anders && weggeklapt) {
      weggeklapt = false;
      document.body.classList.remove('hv-weg');
      zet(voorWeg === 'scherm' ? 'half' : voorWeg, false);
    } else if (!anders && stand === 'scherm' && !document.fullscreenElement) {
      // de gebruiker verliet ons volledige scherm met Escape
      zet('half', true);
    }
  }
  document.addEventListener('fullscreenchange', kijkVolScherm);
  document.addEventListener('webkitfullscreenchange', kijkVolScherm);

  /* BEGINNEN IN DE STAND DIE ER AL IS, en niet in de stand die wij prettig
     vinden. Hier stond kaal `zet('min', false)`, en dat is bijna altijd goed:
     een verse pagina hoort met een dicht paneel te beginnen.

     BIJNA. Deze module is een eigen script en laadt dus op zijn eigen moment.
     Alles wat vóór dat moment het paneel opent -- een beurt uit
     handenvrij-chat.js, of de bevestigingskaart uit handenvrij-geld.js -- werd
     door deze ene regel weer dichtgeslagen, met inhoud en al. Na een
     herlaadactie is dat geen theoretisch venster maar een echt venster van
     tientallen milliseconden, en precies daar zakte de schermtoets in: twee tot
     vier keer op de vier zodra er iets anders naast draaide, en nooit wanneer er
     een diagnoseregel tussen stond die het venster juist ruimer maakte. Dat
     laatste is de reden dat het jarenlang als flakkering las.

     Het ergste geval is de bevestiging van een BETALING: die kaart zet de focus
     op "Ja, doorzetten" en Rahul vraagt hardop of hij het zal doorzetten,
     terwijl het paneel dicht is. Een menselijke poort die je niet kunt zien, is
     geen poort.

     `chat.hidden` is bij het bouwen van de balk op true gezet, dus false
     betekent hier: iemand heeft hem bewust opengedaan. Die neemt deze laag dan
     over in plaats van hem te overrulen. */
  zet(chat.hidden ? 'min' : bewaardeStand(), false);
  root.RTGChatScherm = { zet: function (s) { zet(s, true); }, stand: function () { return stand; }, greep: greep };
})(typeof self !== 'undefined' ? self : this);
