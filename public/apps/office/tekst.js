/* RTG Office, de tekstverwerker: de werkbalk en wat er onderaan meeloopt.

   Een kantoorstuk heeft meer nodig dan vet en cursief: koppen die een document
   structuur geven, opsommingen met en zonder nummers, uitlijning, een citaat,
   een verwijzing en een tabel. Dat staat hier, gegroepeerd zoals iemand het
   zoekt, en niet als een rij losse pillen.

   De knoppen lichten op wanneer de cursor in dat soort tekst staat, zodat u
   ziet waar u bent. Onderaan loopt de telling mee -- woorden, tekens en
   leestijd -- want dat is wat een schrijver van een memo wil weten.

   Levert window.RTGOfficeTekst; app.js hangt hem aan het scherm. */
(function () {
  'use strict';

  /* De werkbalk, per groep. cmd is een execCommand; waarde het argument. */
  var GROEPEN = [
    [ { cmd: 'formatBlock', waarde: '<h1>', lab: 'T1', titel: 'Kop 1' },
      { cmd: 'formatBlock', waarde: '<h2>', lab: 'T2', titel: 'Kop 2' },
      { cmd: 'formatBlock', waarde: '<h3>', lab: 'T3', titel: 'Tussenkop' },
      { cmd: 'formatBlock', waarde: '<p>', lab: '¶', titel: 'Gewone tekst' } ],
    [ { cmd: 'bold', lab: 'B', titel: 'Vet', klasse: 'vet' },
      { cmd: 'italic', lab: 'I', titel: 'Cursief', klasse: 'ital' },
      { cmd: 'underline', lab: 'U', titel: 'Onderstreept', klasse: 'und' },
      { cmd: 'strikeThrough', lab: 'S', titel: 'Doorhalen', klasse: 'door' },
      // de markeerstift: goud uit het eigen palet, doorzichtig zodat de tekst
      // leesbaar blijft; weghalen gaat met de ✕ ernaast
      { cmd: 'hiliteColor', waarde: 'rgba(201,162,75,0.35)', lab: 'M', titel: 'Markeren (weghalen met ✕)', klasse: 'mark' },
      { cmd: 'removeFormat', lab: '✕', titel: 'Opmaak weghalen' } ],
    [ { cmd: 'insertUnorderedList', lab: '•', titel: 'Opsomming' },
      { cmd: 'insertOrderedList', lab: '1.', titel: 'Genummerd' },
      { cmd: 'formatBlock', waarde: '<blockquote>', lab: '❝', titel: 'Citaat' } ],
    [ { cmd: 'justifyLeft', lab: '≡', titel: 'Links uitlijnen' },
      { cmd: 'justifyCenter', lab: '≣', titel: 'Centreren' },
      { cmd: 'justifyFull', lab: '☰', titel: 'Uitvullen' } ],
    [ { doe: 'link', lab: '↗', titel: 'Verwijzing' },
      { doe: 'tabel', lab: '⊞', titel: 'Tabel invoegen' },
      { cmd: 'undo', lab: '↺', titel: 'Ongedaan maken' },
      { cmd: 'redo', lab: '↻', titel: 'Opnieuw' } ]
  ];

  /* Welke knop moet oplichten? Alleen de standen die de browser betrouwbaar
     meldt; een blok-kop lezen we uit de cursorpositie zelf. */
  var STAND = { bold: 1, italic: 1, underline: 1, insertUnorderedList: 1, insertOrderedList: 1,
    justifyCenter: 1, justifyFull: 1, justifyLeft: 1 };

  function bouwBalk(host, vel, onWijzig) {
    host.innerHTML = GROEPEN.map(function (groep) {
      return '<span class="groep">' + groep.map(function (k) {
        return '<button class="tb' + (k.klasse ? ' ' + k.klasse : '') + '" type="button"' +
          ' data-cmd="' + (k.cmd || '') + '" data-waarde="' + (k.waarde || '') + '"' +
          ' data-doe="' + (k.doe || '') + '" title="' + k.titel + '" aria-label="' + k.titel + '">' +
          (k.cmd === 'bold' ? '<b>' + k.lab + '</b>' : k.lab) + '</button>';
      }).join('') + '</span>';
    }).join('');

    Array.prototype.forEach.call(host.querySelectorAll('.tb'), function (b) {
      // mousedown, niet click: anders is de selectie in het vel al weg
      b.addEventListener('mousedown', function (e) {
        e.preventDefault();
        if (b.dataset.doe === 'link') return zetLink(vel, onWijzig);
        // de pro-tabellaag (teksttabel.js) kan meer: rijen en kolommen
        // beheren op de plek waar u staat; zonder die laag blijft de vraag
        if (b.dataset.doe === 'tabel') {
          if (window.RTGOfficeTekstTabel) return window.RTGOfficeTekstTabel.open(vel, onWijzig);
          return zetTabel(vel, onWijzig);
        }
        document.execCommand(b.dataset.cmd, false, b.dataset.waarde || null);
        vel.focus(); onWijzig(); standBij(host);
      });
    });
    document.addEventListener('selectionchange', function () { standBij(host); });
    /* De pro-laag hangt zichzelf hierachter: zoeken en vervangen, en de
       inhoudsopgave (apps/office/tekstpro.js). Is hij er niet, dan werkt de
       tekstverwerker gewoon zonder. */
    if (window.RTGOfficeTekstPro) window.RTGOfficeTekstPro.balk(host, vel, onWijzig);
    return host;
  }

  function standBij(host) {
    if (!host || host.style.display === 'none') return;
    var blok = '';
    try { blok = String(document.queryCommandValue('formatBlock') || '').toLowerCase(); } catch (e) {}
    Array.prototype.forEach.call(host.querySelectorAll('.tb'), function (b) {
      var cmd = b.dataset.cmd, waarde = b.dataset.waarde;
      var aan = false;
      if (cmd === 'formatBlock' && waarde) aan = ('<' + blok + '>') === waarde;
      else if (STAND[cmd]) { try { aan = document.queryCommandState(cmd); } catch (e) {} }
      b.classList.toggle('aan', !!aan);
    });
  }

  /* Een verwijzing: alleen http(s) of mailto, zodat er geen javascript:-adres
     in een gedeeld document kan belanden. */
  function zetLink(vel, onWijzig) {
    var adres = window.prompt('Naar welk adres verwijst deze tekst?', 'https://');
    if (!adres) return;
    if (!/^(https?:|mailto:)/i.test(adres)) { alert('Alleen een https- of mailto-adres.'); return; }
    vel.focus();
    document.execCommand('createLink', false, adres);
    onWijzig();
  }

  function zetTabel(vel, onWijzig) {
    var maat = window.prompt('Hoeveel rijen en kolommen? Bijvoorbeeld 3x4', '3x4');
    if (!maat) return;
    var m = /^\s*(\d{1,2})\s*[x×]\s*(\d{1,2})\s*$/.exec(maat);
    if (!m) { alert('Schrijf het als 3x4.'); return; }
    var r = Math.min(20, Math.max(1, +m[1])), k = Math.min(10, Math.max(1, +m[2]));
    var h = '<table><tbody>';
    for (var i = 0; i < r; i++) {
      h += '<tr>';
      for (var j = 0; j < k; j++) h += (i === 0 ? '<th><br></th>' : '<td><br></td>');
      h += '</tr>';
    }
    h += '</tbody></table><p><br></p>';
    vel.focus();
    document.execCommand('insertHTML', false, h);
    onWijzig();
  }

  /* De telling onderaan: woorden, tekens en een eerlijke leestijd
     (ongeveer 200 woorden per minuut). */
  function tel(vel) {
    var kaal = String(vel.textContent || '').replace(/\s+/g, ' ').trim();
    var woorden = kaal ? kaal.split(' ').length : 0;
    var min = Math.max(1, Math.round(woorden / 200));
    return { woorden: woorden, tekens: kaal.length,
      regel: woorden + (woorden === 1 ? ' woord' : ' woorden') + ' · ' + kaal.length + ' tekens' +
        (woorden ? ' · ongeveer ' + min + ' minuut' + (min === 1 ? '' : 'en') + ' lezen' : '') };
  }

  window.RTGOfficeTekst = { bouwBalk: bouwBalk, standBij: standBij, tel: tel };
})();
