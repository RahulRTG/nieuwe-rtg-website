/* VASTHOUDEN OM TE BEVESTIGEN: de knop die niet met één tik afgaat.

   WAAROM DIT BESTAAT. Een zware handeling hoort niet dezelfde beweging te hebben
   als vet maken. Niet met een extra "weet u het zeker?" ervoor -- dat leert
   mensen op ja drukken -- maar doordat de handeling zelf een andere beweging
   VRAAGT. Je duim blijft staan, je ziet de vulling lopen, en in die seconde kun
   je je nog bedenken. Dat is wrijving die iets bewijst in plaats van wrijving
   die iets vraagt.

   DRIE MANIEREN, WANT NIET IEDEREEN KAN VASTHOUDEN.

   1. Aanwijzer ingedrukt houden. De gewone weg.
   2. Enter of spatie ingedrukt houden. Een toetsenbord herhaalt tijdens het
      indrukken, dus dit is meetbaar dezelfde beweging.
   3. Twee keer bewust bevestigen. Wie de toets kort indrukt, krijgt geen
      mislukking maar een tweede knop: "Nogmaals om te bevestigen", vier seconden
      geldig. Voor wie niet kan vasthouden -- een schakelbediening, een tremor --
      is dat de gelijkwaardige weg: twee bewuste handelingen in plaats van één
      lange. Wat NIET mag is dat die weg korter is dan de andere; vandaar dat hij
      ook twee handelingen kost.

   Wat hier NIET gebeurt: de handeling uitvoeren. Deze laag levert een knop en
   roept `klaar()` als er is bevestigd. Wat er dan gebeurt staat in
   shared/adaptief/gewicht.js, en dat is de enige plek waar dat staat.

   Levert window.RTGVasthoud(spec) -> het knopelement. */
(function (w, d) {
  'use strict';
  var HERBEVESTIG = 4000;

  w.RTGVasthoud = function (spec) {
    var o = spec || {};
    var duur = Math.max(300, Number(o.duur) || 900);
    var knop = d.createElement('button');
    knop.type = 'button';
    knop.className = 'vh-knop' + (o.klasse ? ' ' + o.klasse : '');
    var vul = d.createElement('span');
    vul.className = 'vh-vulling';
    vul.setAttribute('aria-hidden', 'true');
    var tekst = d.createElement('span');
    tekst.className = 'vh-tekst';
    tekst.textContent = o.tekst || 'Houd vast om te bevestigen';
    knop.appendChild(vul);
    knop.appendChild(tekst);
    /* De beweging staat in het label en niet alleen in de vulling: een
       schermlezer leest geen animatie, en "bevestig" zonder "houd vast" is een
       knop die niet reageert. */
    knop.setAttribute('aria-label', (o.tekst || 'Houd vast om te bevestigen'));

    var klok = 0, start = 0, tweede = 0, bezig = false, negeerKlik = false;

    function toon(deel) {
      vul.style.width = Math.round(Math.max(0, Math.min(1, deel)) * 100) + '%';
    }
    function stop() {
      bezig = false;
      if (klok) { w.cancelAnimationFrame(klok); klok = 0; }
      toon(0);
    }
    function loop() {
      if (!bezig) return;
      var deel = (Date.now() - start) / duur;
      toon(deel);
      if (deel >= 1) { stop(); af(); return; }
      klok = w.requestAnimationFrame(loop);
    }
    function begin() {
      if (bezig || tweede) return;
      bezig = true;
      start = Date.now();
      klok = w.requestAnimationFrame(loop);
    }
    /* Loslaten voordat de vulling rond is: geen mislukking, maar de tweede weg.
       Hier stond eerst niets -- de knop veerde terug en er gebeurde niets, en dat
       leest als kapot in plaats van als afgebroken. */
    function los() {
      if (!bezig) return;
      var ver = (Date.now() - start) / duur;
      stop();
      if (ver <= 0.15) return;
      /* DE KLIK DIE HIERNA KOMT, IS NOG DEZELFDE HANDELING -- en dat was stuk.

         Een korte druk zet de tweede weg klaar ("Nogmaals om te bevestigen").
         Vlak daarna vuurt de browser de gewone `click` van diezelfde druk, en die
         nam dat aanbod meteen aan: één korte tik bevestigde een zware handeling.
         Precies wat vasthouden moest voorkomen.

         Eén klik wordt daarom geslikt. Wat daarna komt is een NIEUWE handeling
         van een mens, en dat is wat de tweede weg bedoelt: twee bewuste
         handelingen in plaats van één lange. */
      negeerKlik = true;
      bijnaAf();
    }
    function bijnaAf() {
      if (tweede) return;
      tekst.textContent = o.tweedeTekst || 'Nogmaals om te bevestigen';
      knop.setAttribute('aria-label', tekst.textContent);
      knop.classList.add('tweede');
      tweede = w.setTimeout(function () {
        tweede = 0;
        knop.classList.remove('tweede');
        tekst.textContent = o.tekst || 'Houd vast om te bevestigen';
        knop.setAttribute('aria-label', tekst.textContent);
      }, HERBEVESTIG);
    }
    function af() {
      if (tweede) { w.clearTimeout(tweede); tweede = 0; }
      knop.disabled = true;
      knop.classList.add('af');
      if (typeof o.klaar === 'function') o.klaar();
    }

    knop.addEventListener('pointerdown', function (e) {
      if (tweede) { af(); return; }
      /* setPointerCapture, anders stopt de meting zodra je duim een pixel
         verschuift en is de knop op een telefoon vrijwel niet te halen. */
      try { knop.setPointerCapture(e.pointerId); } catch (x) {}
      begin();
    });
    ['pointerup', 'pointercancel', 'pointerleave'].forEach(function (n) {
      knop.addEventListener(n, los);
    });
    knop.addEventListener('keydown', function (e) {
      if (e.key !== 'Enter' && e.key !== ' ') return;
      e.preventDefault();
      if (tweede) { af(); return; }
      begin();
    });
    knop.addEventListener('keyup', function (e) {
      if (e.key !== 'Enter' && e.key !== ' ') return;
      los();
    });
    /* Klikken zonder ingedrukt te houden (een schakelbediening stuurt vaak
       alleen click) valt op dezelfde tweede weg: eerste klik zet hem klaar,
       tweede bevestigt. */
    knop.addEventListener('click', function (e) {
      e.preventDefault();
      if (negeerKlik) { negeerKlik = false; return; }
      if (tweede) { af(); return; }
      if (!bezig) bijnaAf();
    });

    toon(0);
    return knop;
  };
})(window, document);
