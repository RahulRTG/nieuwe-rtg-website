/* RTG Klankwerk: samen produceren, en uitgeven.

   Twee panelen die dicht bij elkaar horen, want het is dezelfde vraag van twee
   kanten: van wie is dit stuk, en wiens naam komt eronder?

   - SAMEN: de eigenaar nodigt uit op CODENAAM (nooit op een echte naam, nooit
     op een sleutel). Wie meewerkt, bewerkt volledig mee -- anders is het geen
     samenwerking maar een postbus. En het scherm zegt wie er als laatste
     bewaarde: we bouwen geen gelijktijdig bewerken, dus dan moet je het kunnen
     ZIEN in plaats van raden.
   - UITGEVEN: onder uw codenaam kan meteen, dat is uw eigen werk. De RTG-naam
     eronder is een AANVRAAG die alleen een mens bij het kantoor kan toekennen.
     Dit scherm mag die knop dus ook niet nabootsen: hier staat "aanvragen", en
     de uitkomst komt terug als bericht. */
(function () {
  'use strict';
  var $ = function (s) { return document.querySelector(s); };
  var B = window.RTGKlankwerk;
  if (!B) return;
  var samen = null, uitgave = null;

  function leeg(el) { while (el.firstChild) el.removeChild(el.firstChild); }
  function tekst(soort, klasse, wat) {
    var e = document.createElement(soort);
    if (klasse) e.className = klasse;
    e.textContent = wat;
    return e;
  }
  function knop(naam, klasse, doe) {
    var b = document.createElement('button');
    b.type = 'button'; b.className = 'knop' + (klasse ? ' ' + klasse : '');
    b.textContent = naam;
    b.addEventListener('click', doe);
    return b;
  }

  /* ---- de makers ---- */
  function haalSamen() {
    var t = B.track();
    if (!t) return;
    B.api('samen', { id: t.id }).then(function (d) {
      if (d.error) return;
      samen = d.samen;
      vulRollen();
      tekenMakers();
    });
  }
  function vulRollen() {
    var sel = $('#mRol');
    if (!sel || sel.options.length || !samen) return;
    samen.rollen.forEach(function (r) {
      var o = document.createElement('option');
      o.value = r; o.textContent = r;
      sel.appendChild(o);
    });
  }
  function tekenMakers() {
    var vlak = $('#makers');
    if (!vlak || !samen) return;
    leeg(vlak);
    samen.makers.forEach(function (m) {
      var d = document.createElement('div'); d.className = 'maker';
      d.appendChild(tekst('span', null, m.codenaam + (m.ikZelf ? ' (u)' : '')));
      d.appendChild(tekst('span', 'rol', m.rol));
      if (m.eigenaar) d.appendChild(tekst('span', 'merk', 'eigenaar'));
      if (samen.ikBenEigenaar && !m.eigenaar) {
        d.appendChild(knop('eruit', 'rood rechts', function () {
          B.api('samen/eruit', { id: B.track().id, codenaam: m.codenaam }).then(na);
        }));
      } else if (m.ikZelf && !m.eigenaar) {
        d.appendChild(knop('ik stap eruit', 'rood rechts', function () {
          if (!confirm('U werkt daarna niet meer mee aan dit stuk. Doorgaan?')) return;
          B.api('samen/verlaat', { id: B.track().id }).then(function () { B.naarLijst(); });
        }));
      }
      vlak.appendChild(d);
    });
    /* Wie er als laatste bewaarde. Dit is geen bewaking maar de eerlijke
       vervanging van het gelijktijdig bewerken dat we niet bouwen. */
    if (samen.laatste) {
      vlak.appendChild(tekst('p', 'stil', 'Laatst bewaard door ' + samen.laatste.codenaam +
        (samen.laatste.at ? ' op ' + new Date(samen.laatste.at).toLocaleString('nl-NL') : '') + '.'));
    }
    var rij = $('#nodigRij');
    if (rij) rij.hidden = !samen.ikBenEigenaar;
  }
  function na(d) {
    if (d && d.error) return B.zeg(d.error);
    if (d && d.makers) { samen = d.makers; tekenMakers(); }
    else haalSamen();
  }
  var nodig = $('#mNodig');
  if (nodig) nodig.addEventListener('click', function () {
    var t = B.track();
    if (!t) return;
    var code = $('#mCode').value.trim();
    if (!code) return B.zeg('Wie wilt u erbij?');
    B.api('samen/nodig', { id: t.id, codenaam: code, rol: $('#mRol').value }).then(function (d) {
      if (d.error) return B.zeg(d.error);
      $('#mCode').value = '';
      B.zeg(code + ' werkt nu mee.');
      na(d);
    });
  });

  /* ---- uitgeven ---- */
  function haalUitgave() {
    var t = B.track();
    if (!t) return;
    B.api('uitgave/van', { id: t.id }).then(function (d) {
      uitgave = (d && d.uitgave) || null;
      tekenUitgave();
    });
  }
  function tekenUitgave() {
    var vlak = $('#uitgaveVlak');
    var t = B.track();
    if (!vlak || !t) return;
    leeg(vlak);
    if (!uitgave) {
      if (!t.klaar) {
        vlak.appendChild(tekst('p', 'stil', 'Noem het stuk eerst klaar (bovenaan). Klaar is uw eigen ' +
          'oordeel: pas dan kan het de zaal in.'));
        return;
      }
      var doos = document.createElement('div'); doos.className = 'rij';
      var toel = document.createElement('input');
      toel.className = 'veld'; toel.maxLength = 300; toel.id = 'uToelichting';
      toel.style.flex = '1'; toel.style.minWidth = '10rem';
      toel.placeholder = 'Een zin erbij, als u wilt';
      var label = document.createElement('label');
      label.className = 'stil'; label.setAttribute('for', 'uToelichting');
      label.textContent = 'Toelichting';
      doos.appendChild(label); doos.appendChild(toel);
      doos.appendChild(knop('Uitgeven onder mijn codenaam', 'vol', function () { geefUit('codenaam'); }));
      doos.appendChild(knop('Uitgeven en de RTG-naam aanvragen', null, function () { geefUit('rtg'); }));
      vlak.appendChild(doos);
      return;
    }
    vlak.appendChild(tekst('p', null, 'Uitgegeven onder: ' + uitgave.naamOnder));
    if (uitgave.rtgAanvraag === 'gevraagd') {
      vlak.appendChild(tekst('p', 'stil', 'Uw aanvraag voor de RTG-naam ligt bij het kantoor. ' +
        'Daar beslist een mens over; u krijgt bericht.'));
    } else if (uitgave.rtgAanvraag === 'nee') {
      vlak.appendChild(tekst('p', 'stil', 'Het kantoor zet zijn naam er niet onder. ' +
        (uitgave.rtgReden || '') + ' Uw uitgave blijft gewoon staan onder uw codenaam.'));
    }
    var rij2 = document.createElement('div'); rij2.className = 'rij';
    rij2.style.marginTop = '.6rem';
    if (uitgave.onder !== 'rtg' && uitgave.rtgAanvraag !== 'gevraagd') {
      rij2.appendChild(knop('De RTG-naam aanvragen', null, function () {
        B.api('uitgave/rtg', { id: uitgave.id }).then(function (d) {
          if (d.error) return B.zeg(d.error);
          uitgave = d.uitgave; tekenUitgave();
          B.zeg('De aanvraag ligt bij het kantoor.');
        });
      }));
    }
    rij2.appendChild(knop('Terugtrekken', 'rood', function () {
      if (!confirm('De uitgave verdwijnt uit de zaal. Uw stuk blijft in de studio staan. Doorgaan?')) return;
      B.api('uitgave/in', { id: uitgave.id }).then(function (d) {
        if (d.error) return B.zeg(d.error);
        uitgave = null; tekenUitgave();
      });
    }));
    var link = document.createElement('a');
    link.className = 'knop'; link.href = '/apps/zaal.html'; link.textContent = 'Naar de zaal';
    rij2.appendChild(link);
    vlak.appendChild(rij2);
  }
  function geefUit(onder) {
    var t = B.track();
    // eerst bewaren: wat uitgegeven wordt is wat er OP DE SERVER staat, en de
    // uitgave bevriest dat. Zonder deze regel geeft iemand een oudere versie uit.
    B.bewaar().then(function () {
      var toel = $('#uToelichting');
      return B.api('uitgeven', { id: t.id, onder: onder, toelichting: toel ? toel.value : '' });
    }).then(function (d) {
      if (d.error) return B.zeg(d.error);
      uitgave = d.uitgave;
      tekenUitgave();
      B.zeg(onder === 'rtg' ? 'Uitgegeven onder uw codenaam. De aanvraag voor de RTG-naam ligt bij het kantoor.'
        : 'Uitgegeven. Hij staat nu in de zaal.');
    });
  }

  B.bijOpenen(function () { uitgave = null; haalSamen(); haalUitgave(); });
})();
