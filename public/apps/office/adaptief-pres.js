/* RTG OFFICE, DE PRESENTATIE OP EEN TELEFOON.

   Een eigen bestand omdat het een ander soort handeling is. De tekstverwerker en
   het rekenblad hebben een werkbalk, en office/adaptief.js leest die gewoon uit:
   elke knop wordt een capability, zonder dat hier iets over die knoppen bekend
   hoeft te zijn.

   Een presentatie heeft dat niet. Zijn bediening staat in de dia-kolom en bestaat
   uit losse knoppen en een keuzelijst, en twee ervan zijn geen werkbalkknop maar
   iets anders van vorm:

     PRESENTEREN is een TAAKMODUS. Het scherm wordt de presentatie en alles
     eromheen wijkt -- op bureau is dat een knop in de balk, op een telefoon is de
     handeling het scherm. Dezelfde capability, een andere presentatie.

     DE INDELING is een <select>. Dat is op een bureau een keuzelijst en op een
     telefoon een lade met rijen: dezelfde opties, dezelfde waarde terug naar
     hetzelfde element. De logica erachter verandert niet -- dat is de hele
     afspraak van deze laag.

   Levert window.RTGOfficeAdaptiefPres(o); office/adaptief.js roept hem aan. */
(function (w, d) {
  'use strict';
  w.RTGOfficeAdaptiefPres = function (o) {
    var A = w.RTGAdaptief, tik = o.tik;
    function $(s) { return d.querySelector(s); }

/* ---------------------------------------------------------- presenteren --
   Een eigen declaratie, want dit is geen werkbalkknop maar een TAAKMODUS: het
   scherm wordt de presentatie en alles eromheen wijkt. Op bureau is het een
   knop in de balk; dat is dezelfde capability in een andere vorm. */
function caps() {
  var uit = [];
  [['presenteren', '#presBtn', 'Presenteren', '▶', ['taakmodus'], ['knop']],
   ['dia.erbij', '#diaErbij', 'Dia erbij', '+', ['balk'], ['knop']],
   ['dia.dupliceren', '#diaDup', 'Dia dupliceren', '⧉', ['lade'], ['knop']],
   ['dia.weg', '#diaWeg', 'Dia verwijderen', '✕', ['lade'], ['knop']]
  ].forEach(function (r) {
    var knop = $(r[1]);
    if (!knop || knop.style.display === 'none') return;
    var id = 'office.pres.' + r[0];
    A.declareer({ id: id, naam: r[2], label: r[3], groep: 'Dia',
      telefoon: r[4], tablet: r[4], bureau: ['werkbalk'],
      doe: function () { tik(knop); } });
    uit.push({ id: id, knop: knop, sleutel: r[0] });
  });
  var kies = $('#diaIndeling');
  if (kies) {
    A.declareer({ id: 'office.pres.indeling', naam: 'Indeling', label: '▤', groep: 'Dia',
      telefoon: ['lade'], tablet: ['lade'], bureau: ['werkbalk'],
      doe: function () { keuzelade(kies, 'Indeling'); } });
    uit.push({ id: 'office.pres.indeling', knop: kies, sleutel: 'indeling' });
  }
  return uit;
}

/* Een <select> is op een telefoon geen keuzelijst maar een lade met rijen:
   dezelfde opties, in de vorm die hier past. De waarde gaat terug naar
   hetzelfde element, dus de logica erachter verandert niet. */
function keuzelade(kies, naam) {
  if (!w.RTGLagen) { kies.focus(); return; }
  w.RTGLagen.lade({ titel: naam, inhoud: function (lijf) {
    Array.prototype.forEach.call(kies.options, function (opt) {
      var r = d.createElement('button');
      r.type = 'button'; r.className = 'lg-rij';
      r.setAttribute('aria-pressed', opt.selected ? 'true' : 'false');
      r.textContent = opt.textContent;
      r.onclick = function () {
        w.RTGLagen.sluit();
        kies.value = opt.value;
        kies.dispatchEvent(new w.Event('change', { bubbles: true }));
      };
      lijf.appendChild(r);
    });
  } });
}

    return { caps: caps };
  };
})(window, document);
