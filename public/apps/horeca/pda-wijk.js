/* RTG Horeca (scherm): DE WIJKEN OP DE PDA -- wie draagt welke tafels.

   WAAROM DIT EEN EIGEN BESTAND IS. ./pda.js liep over de 10 kB-grens van
   keuringsregel 13 toen de wijk erbij kwam. De snede ligt op een naad: pda.js
   gaat over de WERKLIJST (wat moet ik nu doen), dit over de VERDELING (wie
   draagt wat). Dat zijn twee vragen van twee mensen -- de bediening en het
   wijkhoofd -- en ze veranderen om verschillende redenen.

   Met opzet GEEN vierde modusknop naast bediening/runner/alles. "Wie heeft ons
   nu nodig en hoe verdelen we dat" is een andere vraag dan "wat moet ik nu
   doen", en een knop die iets heel anders toont dan de drie ernaast leert
   niemand kennen. Het staat als eigen blok onder de lijst.

   HET GETAL HOORT BIJ DE WIJK EN NIET BIJ DE MENS. Er komt geen ranglijst op
   medewerkers (HORECA.md, grens 5); de naam staat erbij zodat je weet wie je
   moet aanspreken, niet om te vergelijken. */
(function () {
  'use strict';
  var K = window.RTGHoreca;
  var esc = K.esc, api = K.api;

  function $(id) { return document.getElementById(id); }

  /* HET WIJKBEELD -- de vraag van het wijkhoofd, en met opzet geen vierde
     modusknop: "wie heeft ons nu nodig en hoe verdelen we dat" is een andere
     vraag dan "wat moet ik nu doen", en een knop die iets heel anders toont dan
     de drie ernaast leert niemand kennen.

     Het getal hoort bij de WIJK en niet bij de mens: er komt geen ranglijst op
     medewerkers (HORECA.md, grens 5). De naam staat erbij zodat je weet wie je
     moet aanspreken, en niet om te vergelijken. */
  function tekenWijken(beeld, mijne, na) {
    $('pWijken').innerHTML = !beeld.length
      ? '<p class="pda-leeg">Er zijn nog geen wijken. Zolang die er niet ' +
        'zijn is elke tafel van iedereen, en dat is precies wat u hierboven ziet.</p>'
      : beeld.map(function (w) {
        var vanMij = w.naam && mijne.indexOf(w.naam) >= 0;
        return '<article class="pda-taak' + (w.nu ? ' over' : '') + '">' +
          '<div class="pda-kop"><span class="pda-tafel">' + esc(w.naam) + '</span>' +
          '<span class="pda-min">' + w.taken + ' open</span></div>' +
          '<p class="pda-som">' + (w.nu ? w.nu + ' daarvan over een grens. ' : '') +
          (w.id === null ? 'Deze tafels zitten in geen enkele wijk en zijn dus van iedereen.'
            : (w.van ? esc(w.van) + ' draagt deze wijk (' + w.tafels + ' tafels).'
                     : 'Niemand draagt deze wijk (' + w.tafels + ' tafels), dus hij is van iedereen.')) +
          '</p>' +
          (w.id === null ? '' : '<div class="pda-acties">' +
            (vanMij ? K.knop('Loslaten', { wijklaat: w.id })
              : (w.van ? '' : K.knop('Ik neem hem', { wijkneem: w.id }, true))) + '</div>') +
          '</article>';
      }).join('');
    K.bind($('pWijken'), 'wijkneem', function (b) {
      api('/wijk/neem', { wijkId: b.dataset.wijkneem }).then(na);
    });
    K.bind($('pWijken'), 'wijklaat', function (b) {
      api('/wijk/laat', { wijkId: b.dataset.wijklaat }).then(na);
    });

    /* HERVERDELEN GEBEURT NIET HIER. Een wijk overdragen is een aanbod aan een
       collega met een antwoord terug (kern/horeca/wijk-overdracht.js), en dat
       hoort op een scherm dat de hele verdeling toont -- niet als vierde knopje
       onder een takenlijst. Wel de weg ernaartoe, want wie zijn wijk kwijt wil
       staat op dit moment met een PDA in zijn hand en niet achter een bureau. */
    $('pWijken').insertAdjacentHTML('beforeend',
      '<div class="pda-acties"><a class="knop" href="/apps/horeca-vloer.html">Overdragen en herverdelen: Vloer</a></div>');
  }

  window.RTGPdaWijk = { teken: tekenWijken };
})();
