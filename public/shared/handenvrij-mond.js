/* Muisvrij bedienen, deel 3: de mond.

   Luisteren zonder klik, en terugpraten. Twee keuzes die hier bewust zo staan:

   1. de microfoon staat UIT tot de gebruiker hem zelf aanzet. Een meeluisterende
      microfoon is geen instelling die wij voor iemand kiezen; dat is aan de
      persoon in de kamer.
   2. er is een wekwoord ("Rahul, ..."). Met een open microfoon zou anders elk
      woord in de kamer een opdracht kunnen worden. Na een uitwisseling blijft hij
      twaalf seconden wakker, zodat een vervolgzin zonder wekwoord mag -- dat is
      hoe een gesprek loopt.

   De browser kapt een lopende herkenning geregeld zelf af (na stilte, na een
   time-out). Daarom starten we bij elk einde opnieuw zolang de gebruiker de mond
   aan heeft; zonder dat valt hands-free na een halve minuut stil.

   De verbinding met de balk loopt via de gedeelde kamer (__handenvrijKamer):
   die geeft ons doe() en zeg() en de knop, en wij vullen spreek() en zwijg() in. */
(function (root) {
  'use strict';
  if (root.__handenvrijMond) return; root.__handenvrijMond = true;
  var kamer = root.__handenvrijKamer;
  if (!kamer || !kamer.doe) return;
  var api = root.Handenvrij;
  if (!api || !api.gericht) return;

  /* ---------- terugpraten ---------- */
  function spreek(tekst) {
    try {
      if (!root.speechSynthesis) return;
      speechSynthesis.cancel();
      var u = new SpeechSynthesisUtterance(String(tekst).slice(0, 600));
      u.lang = document.documentElement.lang === 'en' ? 'en-US' : 'nl-NL';
      u.rate = 1.02;
      speechSynthesis.speak(u);
    } catch (e) {}
  }
  function zwijg() { try { speechSynthesis.cancel(); } catch (e) {} }
  kamer.spreek = spreek;
  kamer.zwijg = zwijg;

  /* ---------- luisteren ---------- */
  var SR = root.SpeechRecognition || root.webkitSpeechRecognition;
  var knop = kamer.knop;
  if (!SR) return;                                 // knop blijft verborgen
  if (knop) knop.hidden = false;

  var AAN = 'rtg_handenvrij_mond';
  var mondAan = false;
  try { mondAan = localStorage.getItem(AAN) === '1'; } catch (e) {}
  var rec = null, wakkerTot = 0;

  function start() {
    if (!mondAan || rec) return;
    try {
      rec = new SR();
      rec.lang = document.documentElement.lang === 'en' ? 'en-US' : 'nl-NL';
      rec.continuous = true; rec.interimResults = false; rec.maxAlternatives = 1;
      rec.addEventListener('result', function (ev) {
        for (var i = ev.resultIndex; i < ev.results.length; i++) {
          if (!ev.results[i].isFinal) continue;
          var zin = ((ev.results[i][0] || {}).transcript || '').trim();
          if (!zin) continue;
          var aanMij = api.gericht(zin, Date.now() < wakkerTot);
          if (aanMij === null) continue;            // in de kamer gezegd, niet tegen Rahul
          wakkerTot = Date.now() + 12000;
          if (knop) {
            knop.classList.add('hv-hoort');
            setTimeout(function () { knop.classList.remove('hv-hoort'); }, 900);
          }
          if (!aanMij) { kamer.zeg('Ik luister.', true); continue; }  // alleen zijn naam
          kamer.doe(aanMij, true);
        }
      });
      rec.addEventListener('end', function () { rec = null; if (mondAan) setTimeout(start, 300); });
      rec.addEventListener('error', function (e) {
        rec = null;
        if (e && (e.error === 'not-allowed' || e.error === 'service-not-allowed')) {
          zetAan(false);
          kamer.zeg('De microfoon mag niet van de browser. Zet hem daar aan; typen werkt intussen gewoon.', false);
        }
      });
      rec.start();
    } catch (e) { rec = null; }
  }
  function stop() { if (rec) { try { rec.stop(); } catch (e) {} rec = null; } }

  function zetAan(aan) {
    mondAan = !!aan;
    try { localStorage.setItem(AAN, mondAan ? '1' : '0'); } catch (e) {}
    if (knop) knop.setAttribute('aria-pressed', String(mondAan));
    if (mondAan) start(); else stop();
  }

  if (knop) {
    knop.setAttribute('aria-pressed', String(mondAan));
    knop.addEventListener('click', function () {
      zetAan(!mondAan);
      if (mondAan) kamer.zeg('Ik luister. Begin met "Rahul" en zeg wat er moet gebeuren.', true);
      else { zwijg(); kamer.zeg('Microfoon uit.', false); }
    });
  }
  // stond hij vorige keer aan, dan blijft hij aan; anders wacht hij op de knop
  if (mondAan) start();

  /* Een tabblad op de achtergrond hoeft niet mee te luisteren: dat kost accu en
     het is ook wat je verwacht als je iets anders doet. */
  document.addEventListener('visibilitychange', function () {
    if (!mondAan) return;
    if (document.hidden) stop(); else start();
  });
})(typeof self !== 'undefined' ? self : this);
