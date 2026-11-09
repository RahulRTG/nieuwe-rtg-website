/* Muisvrij bedienen, deel 5: de geldpoort.

   De regel: wat geld kost of ergens toe verplicht, TYP je. "Boek een taxi",
   "stuur 20 euro", "betaal dit" gaan standaard niet op je woord alleen.

   Spraak kan verkeerd worden verstaan of omstanders oppikken. Daarom is
   typen de standaard voor opdrachten die geld kosten.

   Wie het toch met de mond wil, zet het zelf aan. Dan geldt:

     1. een disclaimer, ELKE keer dat je hem aanzet -- niet een keer weggeklikt
        en daarna nooit meer. Wie dit aanzet neemt het risico zelf, en dat hoort
        hij te lezen op het moment dat hij het aanzet, niet ooit een keer;
     2. daarna nog steeds een extra bevestiging per opdracht, VOORDAT de vraag
        de deur uit gaat;
     3. en daarna doet de server zijn eigen geld-drempel nog: Rahul vraagt zelf
        ook nog "zeg ja". Met de mond zijn dat dus twee poorten meer dan met
        getypte tekst, precies zoals bedoeld.

   Deze laag voert niets uit. test/handenvrij.test.js toetst geldZin. */
(function (root) {
  'use strict';
  if (root.__handenvrijGeld) return; root.__handenvrijGeld = true;
  var kamer = root.__handenvrijKamer;
  var api = root.Handenvrij;
  if (!kamer || !kamer.vak || !api || !api.geldZin) return;

  var AAN = 'rtg_handenvrij_geldmond';
  var mondMagGeld = false;
  // BEWUST niet uit localStorage gelezen: de stand geldt per sessie, zodat de
  // disclaimer echt terugkomt en je hem niet een half jaar geleden hebt weggeklikt
  try { mondMagGeld = sessionStorage.getItem(AAN) === '1'; } catch (e) {}
  function zetAan(aan) {
    mondMagGeld = !!aan;
    try { sessionStorage.setItem(AAN, mondMagGeld ? '1' : '0'); } catch (e) {}
    tekenRegel();
  }

  // Presentatie komt op iedere host uit de centrale DS-component.
  /* Presentatie: public/ds/componenten/handenvrij.css. */



  /* ---------- de schakelaar, in het gespreksvenster ----------
     Niet in de balk: die is op een telefoon van 390px al vol, en dit is geen
     knop die je vaak nodig hebt. */
  var regel = document.createElement('div');
  regel.className = 'ds-handenvrij__geldregel hv-regel';
  var knop = document.createElement('button');
  knop.className = 'ds-handenvrij__geldknop'; knop.type = 'button';
  var label = document.createElement('span');
  regel.appendChild(label); regel.appendChild(knop);
  function tekenRegel() {
    label.textContent = mondMagGeld
      ? 'Geld met de mond staat AAN, op eigen risico'
      : 'Geld en boekingen: typen';
    knop.textContent = mondMagGeld ? 'Zet uit' : 'Met de mond';
    knop.setAttribute('aria-pressed', String(mondMagGeld));
  }
  knop.addEventListener('click', function () {
    if (mondMagGeld) { zetAan(false); kaartWeg(); return; }
    toonDisclaimer();
  });
  tekenRegel();
  if (kamer.vak.firstChild) kamer.vak.insertBefore(regel, kamer.vak.firstChild);
  else kamer.vak.appendChild(regel);

  /* ---------- kaarten in het gesprek (disclaimer, bevestiging) ---------- */
  var kaart = null;
  function kaartWeg() { if (kaart) { kaart.remove(); kaart = null; } }
  function toonKaart(kop, tekst, knoppen) {
    kaartWeg();
    kaart = document.createElement('div');
    kaart.className = 'ds-handenvrij__beurt hv-beurt hij';
    var vak = document.createElement('div');
    vak.className = 'ds-handenvrij__geldkaart hv-kaart';
    vak.setAttribute('role', 'alertdialog');
    var h = document.createElement('h4'); h.textContent = kop;
    var p = document.createElement('p'); p.textContent = tekst;
    var rij = document.createElement('div'); rij.className = 'ds-handenvrij__geldacties hv-rij';
    knoppen.forEach(function (k) {
      var b = document.createElement('button');
      b.type = 'button'; b.textContent = k.tekst;
      b.className = 'ds-handenvrij__geldknop' + (k.ja ? ' ja' : '');
      b.addEventListener('click', function () { kaartWeg(); k.doen(); });
      rij.appendChild(b);
    });
    vak.appendChild(h); vak.appendChild(p); vak.appendChild(rij);
    kaart.appendChild(vak);
    /* HET PANEEL OPENEN LANGS DE ENIGE EIGENAAR ERVAN, en niet met de hand.
       Hier stond `kamer.vak.hidden = false`, en handenvrij-chat.js waarschuwt
       daar letterlijk voor: dat omzeilt de standen, en de eerstvolgende zet()
       rekent de zichtbaarheid weer terug uit `min`. Zo kwam de bevestiging van
       een BETALING in een dicht paneel te hangen -- aanwezig, met de focus al op
       "Ja, doorzetten". En bewust zet() en niet naStand(): die laatste
       respecteert een paneel dat de gebruiker heeft vastgezet, wat voor een
       gewone beurt juist is en voor deze kaart niet. */
    if (root.RTGChatScherm) root.RTGChatScherm.zet('half');
    else kamer.vak.hidden = false;
    kamer.vak.appendChild(kaart);
    try { kamer.vak.scrollTop = kamer.vak.scrollHeight; } catch (e) {}
    var eerste = rij.querySelector('button');
    if (eerste) try { eerste.focus(); } catch (e) {}
  }

  var DISCLAIMER =
    'Zet u dit aan, dan kan Rahul op uw gesproken woord boekingen doen en betalingen ' +
    'in gang zetten. Spraak wordt niet altijd goed verstaan en een open microfoon hoort ' +
    'ook anderen in de kamer. Wat er op die manier wordt geboekt of betaald is uw eigen ' +
    'risico en uw eigen verantwoordelijkheid: RTG vergoedt niets dat u zo in gang zet. ' +
    'U kunt dit op elk moment weer uitzetten, en per opdracht vragen we het altijd nog ' +
    'een keer.';

  function toonDisclaimer() {
    toonKaart('Geld met de mond aanzetten', DISCLAIMER, [
      { tekst: 'Ik begrijp het, zet aan', ja: true, doen: function () {
        zetAan(true);
        if (kamer.beurt) kamer.beurt('rahul', 'Goed. Ik vraag het per opdracht altijd nog een keer, en u kunt het altijd weer uitzetten.');
      } },
      { tekst: 'Nee, laat maar', doen: function () { zetAan(false); } }
    ]);
  }

  /* ---------- de poort ----------
     Geeft true als de zin hier is afgehandeld (tegengehouden of in een
     bevestiging gezet). Geeft false als de balk gewoon door mag. */
  var wacht = null;   // { zin, tot } zolang er een bevestiging openstaat
  function poort(zin, viaMond, doorgaan) {
    if (!api.geldZin(zin)) return false;         // geen geld: niets aan de hand
    if (!viaMond) return false;                  // getypt: dit is de bedoelde weg

    if (!mondMagGeld) {
      // Standaard: niet met de mond. De zin komt in het veld te staan zodat de
      // gebruiker hem alleen nog hoeft te lezen en zelf te versturen -- we vullen
      // hem in, maar sturen NOOIT zelf; de laatste tik hoort van een mens.
      if (kamer.zetVeld) kamer.zetVeld(zin);
      if (kamer.beurt) kamer.beurt('rahul',
        'Dit gaat over geld of een boeking. Dat doe ik niet op uw woord alleen. ' +
        'Ik heb het klaargezet: leest u het na en stuurt u het zelf. ' +
        'Wilt u dit toch met de mond kunnen, zet het dan hierboven aan.');
      if (kamer.spreek) kamer.spreek('Dit gaat over geld. Ik heb het klaargezet; stuurt u het zelf.');
      return true;
    }

    // Aan gezet: de extra bevestiging, per opdracht, voordat er iets uitgaat.
    wacht = { zin: zin, tot: Date.now() + 45000 };
    toonKaart('Bevestigen voordat er betaald wordt', 'U zei: "' + zin + '". Zal ik dit doorzetten?', [
      { tekst: 'Ja, doorzetten', ja: true, doen: function () {
        var w = wacht; wacht = null;
        if (w) doorgaan(w.zin);
      } },
      { tekst: 'Nee', doen: function () {
        wacht = null;
        if (kamer.beurt) kamer.beurt('rahul', 'Goed, ik doe niets.');
      } }
    ]);
    if (kamer.spreek) kamer.spreek('Zal ik dat doorzetten? Zeg ja of nee.');
    return true;
  }

  /* Een gesproken "ja" telt ook als bevestiging, maar alleen zolang de vraag
     openstaat en alleen als het echt een kaal ja is. Anders zou "ja, maar eerst
     iets anders" per ongeluk een betaling doorzetten. */
  function antwoord(zin) {
    if (!wacht) return false;
    if (Date.now() > wacht.tot) { wacht = null; kaartWeg(); return false; }
    var k = api.kaal(zin);
    if (/^(ja|ja doorzetten|doorzetten|bevestig|bevestigd|akkoord|doe maar)$/.test(k)) {
      var w = wacht; wacht = null; kaartWeg();
      if (kamer.geldDoorgaan) kamer.geldDoorgaan(w.zin);
      return true;
    }
    if (/^(nee|niet doen|stop|laat maar|annuleer)$/.test(k)) {
      wacht = null; kaartWeg();
      if (kamer.beurt) kamer.beurt('rahul', 'Goed, ik doe niets.');
      return true;
    }
    return false;   // iets anders: de vraag blijft staan, de zin gaat gewoon door
  }

  kamer.geldPoort = poort;
  kamer.geldAntwoord = antwoord;
  kamer.geldAan = function () { return mondMagGeld; };
})(typeof self !== 'undefined' ? self : this);
