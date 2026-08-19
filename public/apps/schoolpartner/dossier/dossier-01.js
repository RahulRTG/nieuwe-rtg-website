/* RTG School Partner: het leerlingdossier. De server kende dossier, contact en
   documenten al; er was alleen geen scherm, en daarmee bestond de gelaagdheid
   van het dossier alleen op papier.

   Het scherm is met opzet gelaagd zoals de server dat is: eerst een lijst met
   namen, dan de basis (wie is dit, waar zit hij), dan contact en documenten --
   en het zorgdeel apart, achter een reden, in dossier-zorg.js. Dat is dezelfde
   knip als op de server (dossier.js/zorg.js): er is EEN plek waar het
   gevoeligste deel woont, en die is ook in de code te zien.

   De zoekregel filtert HIER, in de browser, over de lijst die de server toch
   al stuurt. Dat is eerlijk over wat het is: geen serverzoekopdracht, maar een
   filter op wat u al mag zien.
   Gebonden vanuit app.js aan het einde van directie(). */
window.RTGSchoolDossier = (function () {
  'use strict';
  var A = null, S = null, esc = null, meld = null, wortel = null, LIJST = [], GEKOZEN = null, SLEUTEL = null;

  var sleutels = function (extra) {
    var o = { schoolCode: S.code, beheerToken: S.token }, k;
    for (k in (extra || {})) if (Object.prototype.hasOwnProperty.call(extra, k)) o[k] = extra[k];
    return o;
  };

  function bind(api, sessie, escape, melder) {
    A = api; S = sessie; esc = escape; meld = melder;
    wortel = document.getElementById('dDossier');
    if (!wortel) return;
    laadLijst();
  }

  function laadLijst() {
    A('/school/leerling/lijst', sleutels()).then(function (r) {
      if (r.body.error) { wortel.innerHTML = ''; return; }
      LIJST = r.body.leerlingen || [];
      wortel.innerHTML = '<div class="deel">Leerlingdossier</div>' +
        '<div class="kaart enterprise-breed" id="doSignalen"><div class="kop">Signalen</div>' +
        '<p class="stil">Laden...</p></div>' +
        '<div class="kaart"><div class="kop">Leerlingen</div>' +
        '<div class="rij"><input class="veld" id="doZoek" type="search" placeholder="Zoek op naam" ' +
        'maxlength="60" aria-label="Zoek een leerling op naam"></div>' +
        '<div id="doLijst" style="margin-top:.5rem;"></div>' +
        '<p class="stil" style="margin-top:.5rem;">Filtert in dit scherm, over de lijst die u al mag zien.</p></div>' +
        '<div class="kaart enterprise-breed" id="doDetail" hidden></div>';
      lijstTekenen('');
      signalen();
      document.getElementById('doZoek').addEventListener('input', function () { lijstTekenen(this.value); });
      if (GEKOZEN) toon(GEKOZEN);
    });
  }

  /* De signalen rond leerlingen: FACTOREN, geen score en geen volgorde op
     zwaarte. Het scherm herhaalt dat, want een lijst van kinderen met
     aandachtspunten wordt anders vanzelf gelezen als een ranglijst -- en dan is
     "wie heeft aandacht nodig" veranderd in "wie presteert het slechtst". */
  function signalen() {
    A('/school/signalen', sleutels({ reden: 'signalenoverzicht in de werkbank' })).then(function (r) {
      var vak = document.getElementById('doSignalen');
      if (!vak) return;
      if (r.body.error) { vak.innerHTML = '<div class="kop">Signalen</div><p class="stil">' + esc(r.body.error) + '</p>'; return; }
      vak.innerHTML = '<div class="kop">Signalen (' + (r.body.aantal || 0) + ')</div>' +
        ((r.body.leerlingen || []).slice(0, 25).map(function (l) {
          return '<div class="item" style="align-items:flex-start;"><span><b>' + esc(l.naam) + '</b> <span class="stil">· ' +
            esc(l.klas) + '</span><br><span class="stil">' +
            l.factoren.map(function (f) { return esc(f.wat) + ': ' + esc(f.uitleg); }).join('<br>') + '</span></span>' +
            '<button class="knop" data-signaal="' + esc(l.sleutel) + '">Dossier</button></div>';
        }).join('') || '<p class="stil">Geen signalen.</p>') +
        '<p class="stil">' + esc(r.body.uitleg || '') + '</p>';
      Array.prototype.forEach.call(document.querySelectorAll('[data-signaal]'), function (b) {
        b.addEventListener('click', function () {
          /* Van een signaal naar het dossier: zoek de leerling op de sleutel.
             Staat hij niet in de administratie (een gezinskoppeling zonder
             inschrijving), dan zegt het scherm dat in plaats van niets te doen. */
          var rij = LIJST.filter(function (x) { return x.naam === b.parentNode.querySelector('b').textContent; })[0];
          if (!rij) return meld('Deze leerling staat wel in een klas, maar niet in de leerlingadministratie.');
          toon(rij.id);
        });
      });
    });
  }

  function lijstTekenen(zoek) {
    var q = String(zoek || '').toLowerCase().trim();
    var rijen = LIJST.filter(function (l) { return !q || String(l.naam).toLowerCase().indexOf(q) >= 0; });
    var lijst = rijen.slice(0, 50).map(function (l) {
      return '<div class="item"><span>' + esc(l.naam) + ' <span class="stil">· ' + esc(l.status) +
        (l.klasCode ? ' · klas ' + esc(l.klasCode) : '') + '</span></span>' +
        '<button class="knop" data-dossier="' + esc(l.id) + '">Dossier</button></div>';
    }).join('');
    /* De regel over afgekapte treffers hoort BIJ de lijst, niet bij de lege
       staat: met `.join('') || leeg + meer` hing hij aan het lege geval en zag
       niemand hem juist wanneer hij nodig was. */
    var meer = rijen.length > 50
      ? '<p class="stil">' + rijen.length + ' treffers; de eerste 50 staan hier. Zoek verder om te verfijnen.</p>' : '';
    document.getElementById('doLijst').innerHTML = lijst
      ? lijst + meer
      : '<p class="stil">' + (q ? 'Geen leerling met die naam.' : 'Nog geen leerlingen in de administratie.') + '</p>';
    Array.prototype.forEach.call(document.querySelectorAll('[data-dossier]'), function (b) {
      b.addEventListener('click', function () { toon(b.dataset.dossier); });
    });
  }

