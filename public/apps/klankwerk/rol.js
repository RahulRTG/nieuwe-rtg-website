/* RTG Studio: de notenrol en de tekstregel.

   Het rek hiernaast (raster.js) laat een heel stuk in één blik zien. Deze
   rol doet het omgekeerde: één kanaal, maar dan met toonhoogte erbij. Dat
   zijn twee verschillende manieren van kijken naar dezelfde noten, en
   daarom staan ze ook in twee bestanden.

   Onder een stemkanaal komt er nog een regel bij: de woorden. Een gezongen
   noot zonder lettergreep is een "aah" -- dat kan, maar meestal wil je er
   iets bij zeggen. Eén veld per noot, op volgorde, precies zoals je een zin
   uitspreekt.

   De rol is bewust twee octaven hoog, gecentreerd rond de eigen ligging van
   het instrument. Een volledige piano zou betekenen dat je eerst moet
   scrollen voor je iets kunt aanwijzen, en een bas hoort daar toch niet. */
(function () {
  'use strict';
  if (window.RTGStudioRol) return;

  var TOON_NAMEN = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];
  function nootNaam(n) { return TOON_NAMEN[((n % 12) + 12) % 12] + (Math.floor(n / 12) - 1); }
  function isKruis(n) { return TOON_NAMEN[((n % 12) + 12) % 12].length > 1; }

  /* `hulp` is de smalle brug naar het raster: welk kanaal gekozen is, hoeveel
     stappen er zijn, en wat er moet gebeuren na een wijziging. Meer heeft de
     rol niet nodig, en meer krijgt hij ook niet. */
  function maak(rolEl, hulp) {
    function teken() {
      rolEl.textContent = '';
      var k = hulp.kanaal();
      if (!k || !hulp.speeltNoten(k.instrument)) {
        var p = document.createElement('p'); p.className = 'stil';
        p.textContent = k ? 'Slagwerk zet u aan en uit in het raster hierboven.'
          : 'Kies een kanaal om de noten te zien.';
        rolEl.appendChild(p);
        return;
      }
      var basis = (hulp.instrument(k.instrument) || {}).basToon || 60;
      var laag = basis - 12, hoog = basis + 12;          // twee octaven rond het instrument
      var stappen = hulp.stappen();
      var tabel = document.createElement('div'); tabel.className = 'rol';
      for (var toon = hoog; toon >= laag; toon--) {
        var rij = document.createElement('div'); rij.className = 'rrij';
        var label = document.createElement('span');
        label.className = 'rlabel' + (isKruis(toon) ? ' kruis' : '');
        label.textContent = nootNaam(toon);
        rij.appendChild(label);
        var baan = document.createElement('div'); baan.className = 'rbaan';
        baan.style.gridTemplateColumns = 'repeat(' + stappen + ', 1fr)';
        for (var s = 0; s < stappen; s++) baan.appendChild(rolCel(k, toon, s));
        rij.appendChild(baan);
        tabel.appendChild(rij);
      }
      rolEl.appendChild(tabel);
      if (hulp.soortVan(k.instrument) === 'stem') tekenTekst(k);
    }

    function rolCel(k, toon, s) {
      var noot = (k.noten || []).find(function (n) { return n.toon === toon && n.stap === s; });
      var b = document.createElement('button');
      b.type = 'button';
      b.className = 'cel' + (noot ? ' aan' : '') + (isKruis(toon) ? ' zwart' : '') +
        (s % 16 === 0 ? ' maat' : '') + (s % 4 === 0 ? ' tel' : '');
      b.dataset.stap = s;
      b.setAttribute('aria-pressed', noot ? 'true' : 'false');
      b.setAttribute('aria-label', nootNaam(toon) + ', stap ' + (s + 1));
      b.addEventListener('click', function () {
        k.noten = k.noten || [];
        var i = k.noten.findIndex(function (n) { return n.toon === toon && n.stap === s; });
        if (i >= 0) k.noten.splice(i, 1);
        else k.noten.push({ stap: s, toon: toon, lengte: hulp.lengte() });
        k.noten.sort(function (a, b2) { return a.stap - b2.stap || a.toon - b2.toon; });
        hulp.opWijziging(); hulp.teken();
      });
      return b;
    }

    /* De tekstregel. Zonder deze regel zou je moeten raden welk woord waar
       valt. En er staat bij wat het is: een opgewekte stem, geen opname van
       een zanger. Dat hoort er gewoon te staan. */
    function tekenTekst(k) {
      var doos = document.createElement('div'); doos.className = 'tekstrij';
      var kop = document.createElement('p'); kop.className = 'stil';
      kop.textContent = 'De woorden, lettergreep voor lettergreep. Klinkers bepalen de klank: ' +
        '"zon", "lie", "aah". Deze stem wordt opgewekt, het is geen opname van een zanger.';
      doos.appendChild(kop);
      var rij = document.createElement('div'); rij.className = 'lettergrepen';
      (k.noten || []).forEach(function (n, i) {
        var wrap = document.createElement('label');
        wrap.className = 'lg';
        var tijd = document.createElement('span');
        tijd.className = 'lgtijd';
        tijd.textContent = (Math.floor(n.stap / 16) + 1) + '.' + ((n.stap % 16) + 1);
        var veld = document.createElement('input');
        veld.type = 'text'; veld.maxLength = 16; veld.value = n.tekst || '';
        veld.setAttribute('aria-label', 'Lettergreep ' + (i + 1) + ', maat ' + tijd.textContent);
        veld.addEventListener('input', function () { n.tekst = veld.value; hulp.opWijziging(); });
        wrap.appendChild(tijd); wrap.appendChild(veld);
        rij.appendChild(wrap);
      });
      if (!(k.noten || []).length) {
        var leeg = document.createElement('p'); leeg.className = 'stil';
        leeg.textContent = 'Zet eerst noten in de rol hierboven; daarna typt u er de woorden bij.';
        rij.appendChild(leeg);
      }
      doos.appendChild(rij);
      rolEl.appendChild(doos);
    }

    return { teken: teken };
  }

  window.RTGStudioRol = { maak: maak, nootNaam: nootNaam, isKruis: isKruis };
})();
