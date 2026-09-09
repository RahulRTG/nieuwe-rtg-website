/* De vertaalkast van de browser: vertaalde interface die een NAVIGATIE overleeft.

   WAAROM DIT EEN EIGEN LAAG IS. De automatische vertaallaag hiernaast hield
   zijn vertalingen in een kale Map in zijn eigen scope, en die is bij elke
   paginawissel weg. Elk van de 313 schermen vroeg de server dus opnieuw de hele
   wereld -- ook de balk, het menu en de knoppen die op ieder scherm hetzelfde
   zeggen. Dat is de reden dat een vertaald huis traag aanvoelde: niet het
   vertalen, maar het opnieuw vertalen van wat we al wisten.

   EEN HUIS, EEN KAST. De sleutelweg (RTGi18n.laadWereldDict) bewaarde zijn
   woordenboek in een TWEEDE opslag, per pad en per aantal sleutels. Dezelfde
   knop op twee schermen werd daardoor twee keer vertaald en twee keer bewaard.
   Daarom staat de kast hier los en niet in een van de twee lagen: beide praten
   met dezelfde voorraad.

   BEGRENSD, want localStorage is klein en gedeeld met de rest van de app. Per
   taal een harde regel- en bytegrens; daarboven valt de oudst ingevoegde regel
   eruit (Map bewaart de invoegvolgorde). Loopt de opslag ondanks alles vol, dan
   snoeit de kast een keer en geeft daarna DIE taal op voor de rest van de
   sessie -- het geheugen blijft werken, alleen de volgende pagina begint weer
   koud. Een volle opslag mag nooit een leeg of half scherm opleveren.

   WAT ER NIET IN GAAT. Alleen interface. De aanroepers hier zijn de twee
   UI-lagen; wat een lid TYPT loopt langs /api/vertaal en komt hier nooit langs.
   Dezelfde grens als server/lib/ui-bronnen.js aan de serverkant trekt. */
(function (w) {
  'use strict';
  if (w.RTGVertaalKast) return;

  var SLEUTEL = 'rtg_tr_';
  var MAX_REGELS = 4000, MAX_BYTES = 300000;
  var kast = new Map();                 // taal -> Map(bron -> vertaling)
  var vuil = new Set(), opgegeven = new Set(), timer = null;

  function opslag() {
    try { return w.localStorage; } catch (e) { return null; }  // prive-modus gooit al bij het LEZEN
  }
  function van(taal) {
    var m = kast.get(taal);
    if (m) return m;
    m = new Map();
    kast.set(taal, m);
    var s = opslag();
    if (s && taal && taal !== 'nl') {
      try {
        var rauw = JSON.parse(s.getItem(SLEUTEL + taal) || 'null');
        if (rauw) for (var k in rauw) if (typeof rauw[k] === 'string' && rauw[k]) m.set(k, rauw[k]);
      } catch (e) { /* stukke of afgekapte JSON: een lege kast is geen fout */ }
      while (m.size > MAX_REGELS) m.delete(m.keys().next().value);
    }
    return m;
  }
  function zet(taal, bron, vertaling) {
    /* Een regel die gelijk is aan zijn bron is geen vertaling maar een
       mislukking die zich als antwoord voordoet. Hem bewaren zet een storing
       van vandaag vast als het antwoord van morgen -- dezelfde regel als in
       server/lib/vertaalkast.js, aan de andere kant van dezelfde weg. */
    if (!taal || taal === 'nl' || !bron || !vertaling || vertaling === bron) return false;
    var m = van(taal);
    m.delete(bron); m.set(bron, vertaling);
    while (m.size > MAX_REGELS) m.delete(m.keys().next().value);
    if (opgegeven.has(taal)) return true;
    vuil.add(taal);
    if (!timer) timer = setTimeout(bewaarNu, 400);
    return true;
  }
  /* De kasten van alle ANDERE talen van het toestel halen. Alleen aangeroepen
     wanneer de opslag vol zit; het geheugen blijft ongemoeid, dus de pagina die
     nu open staat verliest niets. */
  function andereTalenWeg(s, houd) {
    try {
      var weg = [];
      for (var i = 0; i < s.length; i++) {
        var k = s.key(i);
        if (k && k.indexOf(SLEUTEL) === 0 && k !== SLEUTEL + houd && k !== SLEUTEL + 'opgeruimd') weg.push(k);
      }
      weg.forEach(function (k) { s.removeItem(k); });
      return weg.length > 0;
    } catch (e) { return false; }
  }

  function bewaarNu() {
    timer = null;
    var s = opslag();
    if (!s) return;
    /* Een KOPIE, want de lus verwijdert eruit. En met Array.from en niet met
       slice.call: een Set heeft geen `length`, dus slice geeft daar een lege
       lijst -- de kast schreef dan nooit iets weg zonder een spoor achter te
       laten. Gevonden door test/i18n-auto.test.js, niet door lezen. */
    Array.from(vuil).forEach(function (taal) {
      vuil.delete(taal);
      if (opgegeven.has(taal)) return;
      var m = kast.get(taal);
      if (!m) return;
      /* Drie pogingen bij een volle opslag, in deze volgorde omdat dat de
         goedkoopste ruimte eerst opgeeft. Een mens leest in EEN taal, dus de
         kasten van talen waar hij doorheen klikte zijn dode ruimte -- die gaan
         voor. Pas daarna snijden we in de taal die hij NU leest. Lukt het dan
         nog niet, dan is de ruimte van iemand anders en niet van ons om op te
         eisen: deze taal wordt opgegeven, het geheugen blijft werken en de
         volgende pagina begint weer koud. */
      for (var poging = 0; poging < 3; poging++) {
        if (poging === 1) andereTalenWeg(s, taal);
        if (poging === 2) {
          var helft = Math.floor(m.size / 2);
          while (m.size > helft && m.size) m.delete(m.keys().next().value);
        }
        var uit = {}, bytes = 0, sleutels = [];
        m.forEach(function (v, k) { sleutels.push(k); });
        // van achteren naar voren, zodat het NIEUWSTE de bytegrens overleeft
        for (var i = sleutels.length - 1; i >= 0; i--) {
          var k = sleutels[i], v = m.get(k);
          bytes += k.length + v.length + 6;
          if (bytes > MAX_BYTES) break;
          uit[k] = v;
        }
        try { s.setItem(SLEUTEL + taal, JSON.stringify(uit)); return; }
        catch (e) { if (poging === 2) opgegeven.add(taal); }
      }
    });
  }

  /* De vorige opzet bewaarde per PAD (`rtg_ui_<taal>_<pad>_<n>`), dus stond
     dezelfde knop tientallen keren in de opslag van het toestel. Die ruimte is
     nu van de kast; hem laten staan zou de quota opeten van precies de laag die
     hem vervangt. Een keer opruimen, stil, en nooit meer. */
  (function () {
    var s = opslag();
    if (!s) return;
    try {
      if (s.getItem('rtg_tr_opgeruimd')) return;
      var oud = [];
      for (var i = 0; i < s.length; i++) {
        var k = s.key(i);
        if (k && k.indexOf('rtg_ui_') === 0) oud.push(k);
      }
      oud.forEach(function (k) { s.removeItem(k); });
      s.setItem('rtg_tr_opgeruimd', '1');
    } catch (e) {}
  })();

  /* Een navigatie mag de laatst binnengekomen vertalingen niet opeten: de
     wachtende schrijfronde gaat er bij het verlaten van de pagina alsnog uit.
     `pagehide` is de enige gebeurtenis die op iOS betrouwbaar valt. */
  try {
    w.addEventListener('pagehide', bewaarNu);
    w.addEventListener('visibilitychange', function () {
      if (w.document && w.document.visibilityState === 'hidden') bewaarNu();
    });
  } catch (e) {}

  w.RTGVertaalKast = {
    van: van, zet: zet, bewaarNu: bewaarNu,
    lees: function (taal, bron) { var v = van(taal).get(bron); return v == null ? null : v; },
    stand: function () {
      var perTaal = {};
      kast.forEach(function (m, taal) { perTaal[taal] = m.size; });
      return { opslag: !!opslag(), perTaal: perTaal, opgegeven: Array.from(opgegeven),
        maxRegels: MAX_REGELS, maxBytes: MAX_BYTES };
    }
  };
})(window);
