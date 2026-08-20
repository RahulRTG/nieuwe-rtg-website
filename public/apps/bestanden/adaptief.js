/* RTG BESTANDEN IN DE GRAMMATICA -- en dit bestand bestaat vooral om íets te
   bewijzen.

   De belofte van GRAMMATICA.md is: "ik wissel van RTG-product en de bediening
   voelt nog steeds bekend." Dat is een zin die je makkelijk opschrijft en die
   pas iets waard is zodra er een tweede product is. Office was de eerste; dit is
   de tweede.

   Wat er hetzelfde is aan Office, zonder dat deze twee bestanden iets van elkaar
   weten: links de bank, rechts Rahul, in het midden wat hier kan. Lang drukken
   legt uit. Omhoog trekken geeft meer. Een handeling die terug kan, gebeurt en
   biedt "Ongedaan maken". Een handeling die niet terug kan, laat eerst zien wat
   er gaat gebeuren.

   HETZELFDE KNOPJE, TWEE GEWICHTEN -- en dat is hier het aardigste geval. "Weg"
   betekent voor een bestand in de kluis: naar de prullenbak, dertig dagen
   herstelbaar. Dat is `terug`: het gebeurt, en de rail biedt de weg terug aan.
   Voor een bestand dat ál in de prullenbak ligt betekent dezelfde knop: voorgoed
   weg, met alle versies. Dat kan niet terug, dus wordt het `bewust`: eerst zien
   wat er verdwijnt.

   Het gewicht hangt dus aan de TOESTAND en niet aan de knop. Zou het aan de knop
   hangen, dan had je één van twee fouten: elke keer bevestigen (en dan drukt
   iedereen op ja) of nooit bevestigen (en dan is een versiegeschiedenis weg).

   EN HET BLIJFT ÉÉN IMPLEMENTATIE. Waar het kan wordt de bestaande knop
   ingedrukt; waar dat niet kan (bij weg en herstel, want daar zit een confirm()
   omheen die op een telefoon geen plek heeft) wordt dezelfde api() aangeroepen
   die het paneel zelf aanroept. Niet een tweede weg naar de server -- dezelfde.

   Levert niets naar buiten; hangt zichzelf op. */
(function (w, d) {
  'use strict';
  var A = w.RTGAdaptief;
  if (!A) return;

  function $(s) { return d.querySelector(s); }
  function B() { return w.RTGBestanden || null; }
  function P() { return w.RTGBestandenPaneel || null; }
  function nu() { var p = P(); return (p && p.open && p.open()) || null; }
  function aan() { var s = $('#bkScrim'); return !!(s && s.classList.contains('open')); }

  function tik(el) {
    if (!el) return;
    ['mousedown', 'mouseup', 'click'].forEach(function (n) {
      el.dispatchEvent(new w.MouseEvent(n, { bubbles: true, cancelable: true, view: w }));
    });
  }

  /* ------------------------------------------------------------ de rail --
     Twee dingen, allebei gemeten: hoeveel ruimte er over is, en of dit bestand
     in de prullenbak ligt. Het eerste staat er alleen als het KRAP wordt --
     "2,1 GB van 10 GB" bij elke handeling is ruis; boven de tachtig procent is
     het een antwoord op een vraag die je gaat krijgen. */
  function rail() {
    var b = B(), uit = [];
    var s = b && b.stand();
    if (s && s.quotum) {
      var deel = s.gebruik / s.quotum;
      if (deel >= 0.8) {
        uit.push({ sleutel: 'ruimte', tekst: b.maat(s.quotum - s.gebruik) + ' vrij',
          staat: deel >= 0.95 ? 'aandacht' : 'rustig',
          uitleg: [b.maat(s.gebruik) + ' van ' + b.maat(s.quotum) + ' in gebruik.',
            'Wat in de prullenbak ligt telt mee tot het voorgoed weg is.'] });
      }
    }
    var f = nu();
    if (f && f.weg) {
      uit.push({ sleutel: 'bak', tekst: 'In de prullenbak', staat: 'aandacht',
        uitleg: ['Dit bestand is weggegooid en dertig dagen te herstellen.',
          'Daarna verdwijnt het met al zijn versies.'] });
    }
    if (f && (f.gedeeldMet || []).length) {
      uit.push({ sleutel: 'gedeeld', tekst: 'Gedeeld met ' + f.gedeeldMet.length,
        staat: 'rustig',
        uitleg: ['Gedeeld met: ' + f.gedeeldMet.join(', ') + '.',
          'Delen loopt op codenaam; echte namen staan in de identiteitskluis.'] });
    }
    return uit;
  }

  /* ------------------------------------------------------- de handelingen -- */
  function caps() {
    var f = nu(), b = B();
    if (!f || !b) return [];
    var uit = [];

    function zet(id, naam, label, gewicht, doe, extra) {
      var spec = { id: id, naam: naam, label: label, groep: 'Bestand', gewicht: gewicht,
        telefoon: ['balk', 'lade'], tablet: ['werkbalk', 'lade'], bureau: ['werkbalk'],
        doe: doe };
      if (extra && extra.verhinderd) spec.verhinderd = extra.verhinderd;
      A.declareer(spec);
      uit.push({ id: id, staat: (extra && extra.staat) || {} });
    }

    if (f.vanMij) {
      zet('bestanden.ster', f.ster ? 'Ster eraf' : 'Ster', '★', 'licht',
        function () { tik($('#bkSter')); });
    }
    zet('bestanden.download', 'Download', '↓', 'licht', function () { tik($('#bkHaal')); });

    if (f.vanMij) {
      var code = $('#bkCode'), ontvanger = (code && code.value.trim()) || '';
      zet('bestanden.deel', 'Deel', '↗', 'bewust', function () { tik($('#bkDeel')); }, {
        verhinderd: ontvanger ? null : {
          reden: 'Er staat nog geen codenaam om mee te delen.',
          bron: 'toestand',
          stap: 'Vul in het paneel de codenaam van de ontvanger in.' },
        staat: { bevestiging: {
          watGebeurt: 'Dit bestand wordt gedeeld op codenaam. De ander kan kijken en nieuwe versies plaatsen.',
          ontvanger: ontvanger || 'onbekend', knop: 'Deel' } }
      });
    }

    /* WEG: het gewicht komt uit de toestand. Zie de kop van dit bestand. */
    if (f.weg) {
      zet('bestanden.voorgoed', 'Voorgoed weg', '✕', 'bewust',
        function () { b.api('weg', { id: f.id }).then(function () { b.meld('Voorgoed weg.'); b.laad(); }); },
        { staat: { bevestiging: {
          watGebeurt: 'Dit bestand verdwijnt met al zijn versies. Herstellen kan hierna niet meer.',
          omvang: b.maat(f.bytes), knop: 'Voorgoed weggooien' } } });
      zet('bestanden.herstel', 'Terugzetten', '↺', 'licht',
        function () { b.api('herstel', { id: f.id }).then(function () { b.meld('Terug in de kluis.'); b.laad(); }); });
    } else if (f.vanMij) {
      zet('bestanden.weg', 'Verwijder', '✕', 'terug',
        function () { b.api('weg', { id: f.id }).then(function () { b.laad(); }); },
        { staat: {
          /* De weg terug is dezelfde api() die het paneel gebruikt. Zonder deze
             functie zou `terug` een lege belofte zijn, en dan zet gewicht.js hem
             van rechtswege een trap hoger (GRAMMATICA.md). */
          ongedaan: function () { b.api('herstel', { id: f.id }).then(function () { b.laad(); }); } } });
    }
    return uit;
  }

  /* Melden zodra het paneel opengaat of dichtgaat, en zodra er in het paneel iets
     verandert. Het register slikt een gelijke melding stil, dus dit mag zo vaak
     als er iets kán zijn veranderd. */
  function meld() {
    if (!aan()) { A.wisContext(); return; }
    var f = nu();
    if (!f) { A.wisContext(); return; }
    var lijst = caps();
    if (!lijst.length) { A.wisContext(); return; }
    var staat = {};
    lijst.forEach(function (x) { staat[x.id] = x.staat; });
    A.context({ bron: 'bestanden', titel: f.naam || 'Bestand',
      acties: lijst.map(function (x) { return x.id; }), staat: staat, rail: rail() });
  }

  function start() {
    var scrim = $('#bkScrim');
    if (scrim && w.MutationObserver) {
      new w.MutationObserver(meld).observe(scrim, { attributes: true, attributeFilter: ['class'], subtree: true, childList: true });
    }
    d.addEventListener('input', meld, true);
    d.addEventListener('click', function () { w.setTimeout(meld, 60); }, true);
    meld();
  }
  if (d.readyState === 'loading') d.addEventListener('DOMContentLoaded', start);
  else start();
})(window, document);
