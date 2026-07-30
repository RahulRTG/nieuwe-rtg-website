/* RTG Klankwerk: de vorm van het stuk (intro, couplet, refrein).

   Een sectie verandert NIETS aan de klank. Dat lijkt een reden om hem weg te
   laten, maar het is juist de reden dat hij er is: hij maakt zichtbaar wat de
   vorm is, en vorm is wat een lus tot een lied maakt. Wie een refrein benoemt,
   gaat er ook anders naar luisteren.

   Bewust NIET gebouwd: delen die je kunt kopiëren en plakken over het raster.
   Dat klinkt handig, maar het maakt van de vorm een bewerkingsgereedschap met
   eigen regels over wat er dan met de noten gebeurt. Hier is een deel een naam
   op een stuk maten -- meer niet, en dat is uit te leggen in één zin. */
(function () {
  'use strict';
  var $ = function (s) { return document.querySelector(s); };
  var B = window.RTGKlankwerk;
  if (!B) return;

  function track() { return B.track(); }

  function teken() {
    var t = track();
    var vlak = $('#secties');
    if (!vlak || !t) return;
    vlak.textContent = '';
    var rij = t.secties || [];
    if (!rij.length) {
      var p = document.createElement('p'); p.className = 'stil';
      p.textContent = 'Nog geen delen benoemd. Dat hoeft ook niet: een figuur is een figuur. ' +
        'Vraagt u Rahul om een heel lied, dan komt de vorm er vanzelf bij te staan.';
      vlak.appendChild(p);
      return;
    }
    rij.forEach(function (s, i) {
      var d = document.createElement('div'); d.className = 'deel';
      var naam = document.createElement('span'); naam.className = 'dn'; naam.textContent = s.naam;
      var maten = document.createElement('span'); maten.className = 'dm';
      maten.textContent = 'maat ' + (s.van + 1) + ' t/m ' + s.tot;
      var weg = document.createElement('button');
      weg.type = 'button'; weg.className = 'knop rood rechts';
      weg.textContent = 'weg';
      weg.setAttribute('aria-label', 'Haal het deel ' + s.naam + ' weg');
      weg.addEventListener('click', function () {
        t.secties.splice(i, 1);
        B.gewijzigd(); teken();
      });
      d.appendChild(naam); d.appendChild(maten); d.appendChild(weg);
      vlak.appendChild(d);
    });
  }

  /* Een deel erbij. De maten gaan op het scherm van 1 af (zo tel je muziek);
     de server telt vanaf 0. Die vertaling gebeurt hier, op één plek. */
  var bij = $('#sBij');
  if (bij) bij.addEventListener('click', function () {
    var t = track();
    if (!t) return;
    var van = Math.max(1, Number($('#sVan').value) || 1);
    var tot = Math.max(van, Number($('#sTot').value) || van);
    if (tot > t.maten) return B.zeg('Uw stuk is ' + t.maten + ' maten lang; maak het eerst langer.');
    t.secties = (t.secties || []).concat([{ naam: $('#sNaam').value, van: van - 1, tot: tot }])
      .sort(function (a, b) { return a.van - b.van; });
    B.gewijzigd();
    teken();
  });

  B.bijOpenen(function () { teken(); });
  window.RTGKlankwerkVorm = { teken: teken };
})();
