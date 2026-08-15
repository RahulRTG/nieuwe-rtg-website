/* Uitvoer: uw gegevens meenemen uit elke app. Een kwart van de apps die
   hier "volwaardig" heten kon dat, van de rest vijf procent -- het verschil
   tussen een scherm dat uw gegevens TOONT en een app die ze aan U geeft.

   Hij leest een ECHTE tabel van het scherm (de lijst-schraper is er bewust
   uit, zie verderop), of wat de app zelf aanmeldt -- met kolommen, anders
   neemt verzamel() het niet aan:
     RTGUitvoer.bron(function () { return { kolommen: ['club'], rijen: [] }; });
   CSV en JSON, ter plekke gemaakt; er gaat niets naar een server.

   De knop heet "Meenemen" en staat er alleen als er iets te halen valt. In
   een echte browser geteld over 167 van de 190 paginas die de laag laden
   (die rechtstreeks onder apps/ en apps/foundation/ staan; de diepere
   submappen zijn niet meegemeten): 105x in de <header> van de app, 2x naast
   een losse kop in <main>, 60x bovenaan <main>, 0x nergens. Nooit in de balk van het deelmenu (sneltoets.js
   nummert de knoppen daar als de delen) en nooit diep in main (daar hoort
   hij bij een deel, en verdwijnt hij bij de eerste deelwissel). */
(function () {
  'use strict';
  if (window.RTGUitvoer) return;
  /* De API bestaat ook aan de inlogpoort, zodat een later opgebouwd scherm
     zijn bron alvast kan aanmelden. Alleen de KNOP blijft weg zolang de poort
     werkelijk zichtbaar is; herzie() zet hem na het inloggen vanzelf neer. */
  var poort = document.getElementById('gate');

  var eigenBron = null;

  function tekst(el) { return (el.textContent || '').replace(/\s+/g, ' ').trim(); }

  /* Geen gegevens: onze eigen laag, de menubalk, de deur, en wat de pagina
     verborgen houdt. closest() telt het element zelf mee. */
  function telt(el) {
    if (!el || !el.closest) return false;
    if (el.closest('.rtgdeel-balk,.rtgdeur,.rtguitvoer,nav,header,footer')) return false;
    if (el.hidden || (el.offsetParent === null && el.tagName !== 'TR')) return false;
    return true;
  }

  // een echte tabel is het duidelijkst: koppen uit thead of de eerste rij
  function uitTabel(t) {
    var rijen = [].slice.call(t.querySelectorAll('tr')).filter(telt);
    if (rijen.length < 2) return null;
    var kop = [].slice.call(rijen[0].children).map(tekst);
    var data = rijen.slice(1).map(function (r) { return [].slice.call(r.children).map(tekst); });
    return { naam: 'tabel', kolommen: kop, rijen: data };
  }

  /* Geen lijst-schraper meer, en dat is een besluit: die gaf
     "01PassenElke pas heeft een eigen stem" in EEN kolom, alle tekst van
     een kaart aan elkaar geplakt -- geen uitvoer maar een vinkje dat op een
     functie lijkt. Wat blijft: een echte tabel, of RTGUitvoer.bron(). */
  function wortel() {
    return document.querySelector('main') || document.querySelector('[role="main"]') || document.body;
  }

  function verzamel() {
    if (eigenBron) {
      try {
        var e = eigenBron();
        if (e && e.rijen && e.rijen.length && e.kolommen && e.kolommen.length) return e;
      } catch (x) { /* een app die struikelt, blokkeert de rest niet */ }
    }
    var tabellen = [].slice.call(wortel().querySelectorAll('table')).filter(telt);
    for (var i = 0; i < tabellen.length; i++) {
      var t = uitTabel(tabellen[i]);
      if (t && t.kolommen.length >= 2) return t;   // een kolom is geen tabel
    }
    return null;
  }

  function csv(d) {
    var veld = function (v) {
      v = String(v == null ? '' : v);
      return /[",;\n]/.test(v) ? '"' + v.replace(/"/g, '""') + '"' : v;
    };
    return [d.kolommen.map(veld).join(';')]
      .concat(d.rijen.map(function (r) { return r.map(veld).join(';'); })).join('\r\n');
  }

  function bewaar(naam, inhoud, type) {
    var a = document.createElement('a');
    a.href = URL.createObjectURL(new Blob([inhoud], { type: type + ';charset=utf-8' }));
    a.download = naam;
    document.body.appendChild(a);
    a.click();
    setTimeout(function () { URL.revokeObjectURL(a.href); a.remove(); }, 2000);
  }

  function bestandsnaam(ext) {
    var t = (document.title || '').split(/[-·|]/)[0].trim().toLowerCase().replace(/[^a-z0-9]+/g, '-');
    return (t || 'rtg') + '.' + ext;
  }

  var LEEG = 'Hier staat nog niets om mee te nemen.';

  function neemMee(vorm) {
    var d = verzamel();
    if (!d) return { ok: false, reden: LEEG };
    if (vorm === 'json') {
      var uit = d.rijen.map(function (r) {
        var o = {}; d.kolommen.forEach(function (k, i) { o[k || ('kolom' + (i + 1))] = r[i]; }); return o;
      });
      bewaar(bestandsnaam('json'), JSON.stringify(uit, null, 1), 'application/json');
    } else {
      bewaar(bestandsnaam('csv'), csv(d), 'text/csv');
    }
    return { ok: true, aantal: d.rijen.length };
  }
