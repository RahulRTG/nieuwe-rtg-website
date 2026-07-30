/* Muisvrij bedienen, deel 5: de geldpoort.

   De regel: wat geld kost of ergens toe verplicht, TYP je. "Boek een taxi",
   "stuur 20 euro", "betaal dit" gaan standaard niet op je woord alleen.

   Waarom deze grens er is, in gewone taal: spraakherkenning verstaat soms iets
   anders dan je zei, en een telefoon in je zak hoort de kamer mee. Een verkeerd
   verstane routebeschrijving is hinderlijk. Een verkeerd verstane betaling is
   geld dat weg is. Bij twijfel hoort de trage weg de standaard te zijn.

   Wie het toch met de mond wil, zet het zelf aan. Dan geldt:

     1. een disclaimer, ELKE keer dat je hem aanzet -- niet een keer weggeklikt
        en daarna nooit meer. Wie dit aanzet neemt het risico zelf, en dat hoort
        hij te lezen op het moment dat hij het aanzet, niet ooit een keer;
     2. daarna nog steeds een extra bevestiging per opdracht, VOORDAT de vraag
        de deur uit gaat;
     3. en daarna doet de server zijn eigen geld-drempel nog: Rahul vraagt zelf
        ook nog "zeg ja". Met de mond zijn dat dus twee poorten meer dan met
        getypte tekst, precies zoals bedoeld.

   Deze laag houdt tegen; hij voert nooit iets uit. De herkenning zelf
   (Handenvrij.geldZin) is los getoetst in test/handenvrij.test.js. */
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

  var css =
    '.hv-regel{display:flex;gap:.5rem;align-items:center;justify-content:space-between;' +
    'padding:.35rem .1rem .1rem;font-size:.72rem;color:#8A8680;border-bottom:1px solid #2a2a28;margin-bottom:.2rem;}' +
    '.hv-regel button{background:transparent;border:1px solid #444;border-radius:999px;color:#ddd;' +
    'font:inherit;font-size:.7rem;padding:.2rem .55rem;cursor:pointer;white-space:nowrap;}' +
    '.hv-regel button[aria-pressed="true"]{background:#7F1634;border-color:#7F1634;color:#fff;font-weight:700;}' +
    /* de disclaimer: een kaart in het gesprek, niet een browservenster, zodat hij
       in dezelfde taal en dezelfde huisstijl staat als de rest */
    '.hv-kaart{border:1px solid #857007;border-radius:14px;padding:.7rem .8rem;background:#151312;color:#e8e6e3;' +
    'font-size:.83rem;line-height:1.55;}' +
    '.hv-kaart h4{margin:0 0 .35rem;font-size:.8rem;letter-spacing:.04em;text-transform:uppercase;color:#857007;}' +
    '.hv-kaart p{margin:0 0 .55rem;}' +
    '.hv-kaart .hv-rij{display:flex;gap:.5rem;flex-wrap:wrap;}' +
    '.hv-kaart button{border-radius:10px;border:1px solid #444;background:transparent;color:#eee;' +
    'font:inherit;font-size:.8rem;padding:.4rem .8rem;cursor:pointer;}' +
    '.hv-kaart button.ja{background:#7F1634;border-color:#7F1634;color:#fff;font-weight:700;}' +
    '.hv-kaart button:focus-visible{outline:2px solid #857007;outline-offset:2px;}';
  var st = document.createElement('style'); st.textContent = css; document.head.appendChild(st);

  /* ---------- de schakelaar, in het gespreksvenster ----------
     Niet in de balk: die is op een telefoon van 390px al vol, en dit is geen
     knop die je vaak nodig hebt. */
  var regel = document.createElement('div');
  regel.className = 'hv-regel';
  var knop = document.createElement('button');
  knop.type = 'button';
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
    kaart.className = 'hv-beurt hij';
    var vak = document.createElement('div');
    vak.className = 'hv-kaart';
    vak.setAttribute('role', 'alertdialog');
    var h = document.createElement('h4'); h.textContent = kop;
    var p = document.createElement('p'); p.textContent = tekst;
    var rij = document.createElement('div'); rij.className = 'hv-rij';
    knoppen.forEach(function (k) {
      var b = document.createElement('button');
      b.type = 'button'; b.textContent = k.tekst;
      if (k.ja) b.className = 'ja';
      b.addEventListener('click', function () { kaartWeg(); k.doen(); });
      rij.appendChild(b);
    });
    vak.appendChild(h); vak.appendChild(p); vak.appendChild(rij);
    kaart.appendChild(vak);
    kamer.vak.hidden = false;
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
