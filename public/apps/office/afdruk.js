/* RTG Office: afdrukken, voor alle drie de soorten.

   Er is hier geen eigen PDF-schrijver, en dat is een keuze en geen gemis: de
   browser heeft een uitstekende -- de afdrukdialoog met "opslaan als PDF" --
   en die respecteert marges, papierformaat en de printer van de gebruiker.
   Wat wij doen is het enige wat een kantoorpakket daaraan hoort toe te
   voegen: zorgen dat er iets FATSOENLIJKS uitkomt. Zwart op wit, een serif
   voor tekst, geen appbalken en geen donker thema dat een toner leegtrekt.

   Per soort:
   - een TEKSTDOCUMENT drukt af als het stuk dat het is;
   - een REKENBLAD drukt de tabel af, met de uitkomsten zoals ze op het
     scherm staan;
   - een PRESENTATIE drukt een HAND-OUT af: elke dia een blok. De
     sprekersnotities gaan NIET mee -- een hand-out is voor de zaal, en een
     notitie die per ongeluk meeprint is precies het soort ongeluk dat je
     maar één keer overkomt.

   De bestandsnaam van de PDF is de titel van het document; daarvoor wordt de
   paginatitel even omgezet en daarna teruggezet. */
(function () {
  'use strict';
  var knop = document.getElementById('printBtn');
  if (!knop) return;
  var q = function (s) { return document.querySelector(s); };
  var zichtbaar = function (s) { var e = q(s); return !!e && e.style.display !== 'none'; };

  function soortNu() {
    if (zichtbaar('#bladWrap')) return 'blad';
    if (zichtbaar('#presWrap')) return 'pres';
    return 'tekst';
  }

  /* De hand-out: elke dia als blok, genummerd, zonder notities. */
  function bouwHandout() {
    var P = window.RTGOfficePres;
    var bron = P && P.huidige;
    if (!bron) return null;
    var doos = document.createElement('div');
    doos.id = 'handout';
    bron.dias().forEach(function (d, i) {
      var blok = document.createElement('div');
      blok.className = 'hdia';
      var nr = document.createElement('p');
      nr.className = 'hnr';
      nr.textContent = 'Dia ' + (i + 1);
      var kop = document.createElement('h3');
      kop.textContent = d.titel || '(zonder titel)';
      var tekst = document.createElement('p');
      tekst.textContent = d.tekst || '';
      blok.appendChild(nr); blok.appendChild(kop); blok.appendChild(tekst);
      doos.appendChild(blok);
    });
    document.body.appendChild(doos);
    return doos;
  }

  knop.addEventListener('click', function () {
    var editor = document.getElementById('editor');
    if (!editor || !editor.classList.contains('aan')) return;
    var soort = soortNu();
    var doel = soort === 'pres' ? bouwHandout()
      : q(soort === 'blad' ? '#bladWrap' : '#tekst');
    if (!doel) return;

    var oudeTitel = document.title;
    document.title = (q('#titel') && q('#titel').value) || 'document';
    doel.classList.add('afdrukdoel');
    document.body.classList.add('afdruk-aan');

    var klaar = function () {
      doel.classList.remove('afdrukdoel');
      document.body.classList.remove('afdruk-aan');
      document.title = oudeTitel;
      var ho = document.getElementById('handout');
      if (ho && ho.parentNode) ho.parentNode.removeChild(ho);
      window.removeEventListener('afterprint', klaar);
    };
    window.addEventListener('afterprint', klaar);
    try { window.print(); } catch (e) { /* geen dialoog beschikbaar */ }
    // afterprint komt vrijwel overal; dit is de bezem voor waar hij uitblijft.
    // klaar() is herhaalbaar, dus dubbel opruimen kan geen kwaad.
    setTimeout(klaar, 1500);
  });
})();
