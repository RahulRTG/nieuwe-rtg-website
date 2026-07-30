/* RTG Office, de tekstverwerker: zoeken en vervangen, en de inhoudsopgave.

   ZOEKEN EN VERVANGEN loopt uitsluitend door de TEKSTKNOPEN van het document.
   Dat is geen detail maar de veiligheidsregel van deze functie: wie door de
   HTML zelf zou zoeken, kan met een vervanging een tag doormidden knippen en
   daarmee de opmaak (of erger: de structuur) van een gedeeld document slopen.
   Tekst blijft tekst; aan de tags komt deze laag nooit.

   DE INHOUDSOPGAVE wordt uit de koppen gelezen (Kop 1 tot en met tussenkop) en
   bovenaan het document gezet. Hij is een MOMENTOPNAME: verandert u de koppen,
   dan klikt u opnieuw en wordt hij ververst. Een inhoudsopgave die zichzelf
   live bijhoudt klinkt beter, maar betekent dat het document iets doet wat u
   niet ziet gebeuren -- en dit is precies goed genoeg voor een stuk dat de
   deur uit gaat.

   Het paneel komt uit apps/office/bladpro.js: het is letterlijk hetzelfde
   venster als bij het rekenblad, en twee keer hetzelfde venster bouwen is twee
   keer hetzelfde onderhoud. Levert window.RTGOfficeTekstPro. */
(function () {
  'use strict';
  var hulp = function () { return window.RTGOfficeBladPro && window.RTGOfficeBladPro.hulp; };

  // Alle tekstknopen van het vel, in leesvolgorde. De inhoudsopgave doet niet
  // mee: anders vindt u elk woord uit een kop dubbel.
  function knopen(vel) {
    var uit = [];
    var w = document.createTreeWalker(vel, NodeFilter.SHOW_TEXT, {
      acceptNode: function (n) {
        var el = n.parentNode;
        while (el && el !== vel) {
          if (el.classList && el.classList.contains('rtg-toc')) return NodeFilter.FILTER_REJECT;
          el = el.parentNode;
        }
        return NodeFilter.FILTER_ACCEPT;
      }
    });
    var n;
    while ((n = w.nextNode())) uit.push(n);
    return uit;
  }

  // Alle vindplaatsen van een term, hoofdletterongevoelig: [{knoop, plek}].
  function vind(vel, term) {
    var uit = [];
    var q = String(term || '').toLowerCase();
    if (!q) return uit;
    knopen(vel).forEach(function (kn) {
      var s = String(kn.nodeValue || '').toLowerCase(), i = 0;
      while ((i = s.indexOf(q, i)) >= 0) { uit.push({ knoop: kn, plek: i }); i += q.length; }
    });
    return uit;
  }

  /* ---- het paneel ---- */
  function zoeken(vel, onWijzig) {
    var h = hulp();
    if (!h) return;
    var p = h.paneel('Zoeken en vervangen');
    var veld = function (naam, tip) {
      var wrap = h.el('label', 'bplabel');
      wrap.appendChild(h.el('span', null, naam));
      var v = document.createElement('input');
      v.className = 'bpveld'; v.maxLength = 120;
      if (tip) v.placeholder = tip;
      wrap.appendChild(v);
      p.appendChild(wrap);
      return v;
    };
    var zoek = veld('Zoek naar', 'Een woord of stuk zin');
    var nieuw = veld('Vervang door', 'Leeg = weghalen');
    var stand = h.el('p', 'bpstil', 'Typ waar u naar zoekt.');
    p.appendChild(stand);
    var beurt = 0;

    function bij() {
      beurt = 0;
      var n = vind(vel, zoek.value).length;
      stand.textContent = !zoek.value ? 'Typ waar u naar zoekt.'
        : n === 0 ? 'Niet gevonden.'
        : n === 1 ? 'Eén keer gevonden.'
        : n + ' keer gevonden.';
    }
    zoek.addEventListener('input', bij);

    var rij = h.el('div', 'bprij');
    rij.appendChild(h.knop('Volgende', function () {
      var raak = vind(vel, zoek.value);
      if (!raak.length) return;
      var r = raak[beurt % raak.length];
      beurt++;
      var bereik = document.createRange();
      bereik.setStart(r.knoop, r.plek);
      bereik.setEnd(r.knoop, r.plek + zoek.value.length);
      var sel = window.getSelection();
      sel.removeAllRanges(); sel.addRange(bereik);
      var el = r.knoop.parentNode;
      if (el && el.scrollIntoView) el.scrollIntoView({ block: 'center' });
      stand.textContent = (((beurt - 1) % raak.length) + 1) + ' van ' + raak.length + '.';
    }, 'Spring naar de volgende vindplaats'));

    if (vel.isContentEditable) {
      rij.appendChild(h.knop('Vervang alles', function () {
        var q = String(zoek.value || '');
        if (!q) return;
        var na = String(nieuw.value || '');
        var n = 0;
        // Per knoop van achteren naar voren, zodat de plekken niet verschuiven
        // terwijl we bezig zijn.
        knopen(vel).forEach(function (kn) {
          var s = String(kn.nodeValue || '');
          var plekken = [];
          var l = s.toLowerCase(), ql = q.toLowerCase(), i = 0;
          while ((i = l.indexOf(ql, i)) >= 0) { plekken.push(i); i += ql.length; }
          for (var j = plekken.length - 1; j >= 0; j--) {
            s = s.slice(0, plekken[j]) + na + s.slice(plekken[j] + q.length);
            n++;
          }
          if (plekken.length) kn.nodeValue = s;
        });
        stand.textContent = n ? n + ' keer vervangen.' : 'Niet gevonden.';
        if (n) onWijzig();
      }, 'Vervang elke vindplaats; de opmaak eromheen blijft staan'));
    }
    p.appendChild(rij);
    p.appendChild(h.el('p', 'bpstil', 'Er wordt alleen in de tekst gezocht, nooit in de opmaak: ' +
      'een vervanging kan het document niet breken.'));
    zoek.focus();
  }

  /* ---- de inhoudsopgave ---- */
  function inhoudsopgave(vel, onWijzig) {
    var oude = vel.querySelector('.rtg-toc');
    if (oude) oude.parentNode.removeChild(oude);
    var koppen = vel.querySelectorAll('h1, h2, h3');
    if (!koppen.length) { alert('Nog geen koppen in het document. Maak eerst een Kop 1, 2 of 3.'); return; }
    var nav = document.createElement('nav');
    nav.className = 'rtg-toc';
    // niet zelf bewerkbaar: één klik ververst hem, en half-bewerkte regels die
    // bij de volgende verversing verdwijnen zouden werk weggooien
    nav.setAttribute('contenteditable', 'false');
    nav.setAttribute('aria-label', 'Inhoudsopgave');
    var kop = document.createElement('p');
    kop.className = 'toc-kop';
    kop.textContent = 'Inhoud';
    nav.appendChild(kop);
    Array.prototype.forEach.call(koppen, function (k) {
      var regel = document.createElement('p');
      regel.className = 'toc-' + k.tagName.toLowerCase();
      regel.textContent = k.textContent.trim() || '(zonder titel)';
      nav.appendChild(regel);
    });
    vel.insertBefore(nav, vel.firstChild);
    onWijzig();
  }

  window.RTGOfficeTekstPro = {
    balk: function (host, vel, onWijzig) {
      var h = hulp();
      if (!h) return;
      var groep = h.el('span', 'groep');
      groep.appendChild(h.knop('Zoeken', function () { zoeken(vel, onWijzig); }, 'Zoeken en vervangen'));
      groep.appendChild(h.knop('Inhoud', function () { inhoudsopgave(vel, onWijzig); },
        'Inhoudsopgave uit de koppen (klik opnieuw om te verversen)'));
      host.appendChild(groep);
    },
    vind: vind
  };
})();
