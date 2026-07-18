/* ==================== RTG Accountbrug ====================
   De schakel tussen een app en de accountkluis (accounts-os.js). Insluiten
   NA accounts-os.js en VOOR het hoofdscript van de app, met de wereld erbij:

     <script src="/shared/accounts-os.js"></script>
     <script src="/shared/accounts-brug.js" data-wereld="lid"></script>
     <script src="/apps/app-main.js"></script>

   Twee taken:

   1. ONTHOUDEN. Het token dat de app nu gebruikt, wordt in de kluis gezet,
      zodat het op het bureaublad in de accountwisselaar verschijnt. Ook als de
      app later inlogt (het token verandert), pakken we dat op.

   2. ECHT TEGELIJK. Is dit venster geopend onder een gekozen account
      (#rtgacc=wereld~id), dan mag dat de andere vensters NIET overschrijven.
      We isoleren daarom alleen de token-sleutel van deze app naar
      sessionStorage (per venster), door localStorage voor precies die ene
      sleutel om te leiden. Alle andere opslag blijft ongemoeid, en zonder
      venster-account gebeurt er niets: een gewone lading is identiek aan
      vroeger. Zo draait venster A op account 1 en venster B tegelijk op
      account 2, zonder elkaar te storen. */
(function () {
  'use strict';
  if (!window.RTGAccounts) return;
  var eigen = document.currentScript;
  var wereld = eigen && eigen.getAttribute('data-wereld');
  if (!wereld) return;

  var kluis = window.RTGAccounts.maak();
  var info = kluis.WERELDEN[wereld];
  if (!info) return;

  // --- 2. echt tegelijk: isoleer de token-sleutel voor dit venster ----------
  // Eerst kijken of dit venster onder een gekozen account is geopend. Zo ja,
  // dan leidt leesVensterHash het venster-account af; daarna leiden we de
  // token-sleutel om naar sessionStorage voordat de app iets leest.
  var gekozen = null;
  try { gekozen = kluis.leesVensterHash(location.hash); } catch (e) {}
  var venster = kluis.vensterAccount();
  if (venster && venster.wereld === wereld) {
    var rec = kluis.vind(wereld, venster.id);
    var startToken = rec ? rec.token : null;
    var sSleutel = 'rtgv_' + info.sleutel; // per-venster sessie-opslag
    try {
      if (startToken && !sessionStorage.getItem(sSleutel)) sessionStorage.setItem(sSleutel, startToken);
    } catch (e) {}
    var echteGet = Storage.prototype.getItem;
    var echteSet = Storage.prototype.setItem;
    var echteDel = Storage.prototype.removeItem;
    // Alleen op localStorage, alleen voor deze ene sleutel: bedien vanuit
    // sessionStorage. Elke andere sleutel en sessionStorage zelf: ongewijzigd.
    localStorage.getItem = function (k) {
      if (k === info.sleutel) { try { return echteGet.call(sessionStorage, sSleutel); } catch (e) { return null; } }
      return echteGet.call(localStorage, k);
    };
    localStorage.setItem = function (k, v) {
      if (k === info.sleutel) { try { echteSet.call(sessionStorage, sSleutel, v); } catch (e) {} return; }
      return echteSet.call(localStorage, k, v);
    };
    localStorage.removeItem = function (k) {
      if (k === info.sleutel) { try { echteDel.call(sessionStorage, sSleutel); } catch (e) {} return; }
      return echteDel.call(localStorage, k);
    };
    // de hash weghalen zodat het account niet in de adresbalk blijft staan
    if (gekozen && location.hash) { try { history.replaceState(null, '', location.pathname + location.search); } catch (e) {} }
  }

  // --- 1. onthouden: het huidige token in de kluis zetten -------------------
  function onthoud() {
    var t = null;
    try { t = localStorage.getItem(info.sleutel); } catch (e) {}
    if (!t) return;
    var id = t, label = info.naam, extra = null;
    if (info.vorm === 'sessie') {
      try { var o = JSON.parse(t); extra = o; id = (o && (o.code || o.id)) || t; label = (o && o.profiel && o.profiel.naam) || (o && o.code) || info.naam; }
      catch (e) {}
    }
    kluis.voegToe(wereld, { id: String(id).slice(0, 80), label: String(label).slice(0, 60), token: t, extra: extra });
  }
  onthoud();
  // ook onthouden zodra de app inlogt of het token verandert
  window.addEventListener('storage', function (e) { if (e.key === info.sleutel) onthoud(); });

  window.RTGaccountBrug = { kluis: kluis, wereld: wereld, onthoud: onthoud, venster: venster };
})();
