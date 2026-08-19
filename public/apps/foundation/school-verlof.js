/* RTF School, gezinskant: verlof aanvragen en het oudergesprek boeken.

   Twee dingen die dit scherm van de server overneemt:

   1. VERLOF BESLIST EEN MENS, MET EEN REDEN. De aanvraag gaat naar de school
      en komt terug met een besluit EN de reden erbij -- ook als het antwoord
      nee is. Er is geen automatische toekenning voor "korte" aanvragen, want
      dan wordt de drempel de regel.
   2. WIE HET EERST KOMT. De vrije momenten voor het oudergesprek staan er
      gewoon; er is geen voorrang te koop en geen ranglijst van ouders. Is er
      net een moment weg, dan zegt het scherm dat en toont het de rest.

   Draait als los deel naast de pagina; gebruikt gezinApi uit school.html. */
(function () {
  'use strict';
  var esc = function (t) {
    return String(t == null ? '' : t).replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  };
  var wortel = null;

  function kaart(titel, binnen) {
    return '<div class="sec">' + titel + '</div><div class="kaart blok">' + binnen + '</div>';
  }

  async function laad() {
    if (typeof gezinApi !== 'function' || !wortel) return;
    var mijn, portaal;
    try { mijn = await gezinApi('/school/mijn'); } catch (e) { return; }
    var kinderen = (mijn && mijn.school) || [];
    if (!kinderen.length) { wortel.innerHTML = ''; return; }
    var ouder = !!(mijn && mijn.ouder);
    var aanvragen = await gezinApi('/school/verlof/mijn').catch(function () { return null; });
    try { portaal = await gezinApi('/school/portaal'); } catch (e) { portaal = null; }

    var lijst = ((aanvragen && aanvragen.aanvragen) || []).slice(0, 10).map(function (v) {
      return '<div class="mini" style="margin:.3rem 0;"><b>' + esc(v.naam || '') + '</b> · ' + esc(v.van) +
        (v.tot && v.tot !== v.van ? ' t/m ' + esc(v.tot) : '') + ' · ' + esc(v.status) +
        (v.besluitReden ? '<br>reden van de school: ' + esc(v.besluitReden) : '') + '</div>';
    }).join('') || '<div class="mini">Nog geen verlofaanvragen.</div>';

    var kies = kinderen.map(function (x) {
      return '<option value="' + esc(x.klas.code) + '|' + esc(x.kind.profielId) + '">' +
        esc(x.kind.naam) + ' · ' + esc(x.klas.naam) + '</option>';
    }).join('');

    var uit = kaart('Verlof aanvragen', lijst +
      (ouder ? '<div style="display:flex;flex-wrap:wrap;gap:.4rem;margin-top:.5rem;">' +
        '<select class="veld" id="vlKind" aria-label="Voor welk kind">' + kies + '</select>' +
        '<input class="veld" id="vlVan" type="date" aria-label="Van" style="flex:0 1 9rem;">' +
        '<input class="veld" id="vlTot" type="date" aria-label="Tot en met" style="flex:0 1 9rem;">' +
        '<input class="veld" id="vlReden" maxlength="300" placeholder="Reden" aria-label="Reden van het verlof" style="flex:1;">' +
        '<button class="knop mini" data-doe="verlof">Vraag aan</button></div>' +
        '<div class="mini" style="margin-top:.4rem;">Een mens van de school beslist; u krijgt het besluit met de reden erbij.</div>'
        : '<div class="mini" style="margin-top:.4rem;">Verlof vraagt een ouder of verzorger aan.</div>'));

    var vrij = (portaal && portaal.vrijeMomenten) || [];
    var geboekt = ((portaal && portaal.afspraken) || []).map(function (a) {
      return '<div class="mini" style="margin:.3rem 0;">Geboekt: ' + esc(a.datum) + ' om ' + esc(a.tijd) +
        ' met ' + esc(a.leraar) + (a.plek ? ' · ' + esc(a.plek) : '') + ' (' + esc(a.kind) + ')</div>';
    }).join('');
    if (ouder && (vrij.length || geboekt)) {
      uit += kaart('Oudergesprek', geboekt +
        (vrij.length ? vrij.slice(0, 12).map(function (m) {
          return '<div class="mini" style="margin:.3rem 0;">' + esc(m.datum) + ' om ' + esc(m.tijd) + ' · ' +
            m.minuten + ' min · ' + esc(m.leraar) + (m.plek ? ' · ' + esc(m.plek) : '') +
            ' <button class="knop mini" data-doe="boek" data-moment="' + esc(m.id) + '">Boek</button></div>';
        }).join('') + '<div class="mini" style="margin-top:.4rem;">Wie het eerst komt; er is geen voorrang te koop.</div>'
          : '<div class="mini">Er staan nu geen vrije momenten klaar.</div>'));
    }

    wortel.innerHTML = uit;
    bind();
  }

  function bind() {
    wortel.querySelectorAll('[data-doe]').forEach(function (b) {
      b.addEventListener('click', async function () {
        try {
          if (b.dataset.doe === 'verlof') {
            var kind = (wortel.querySelector('#vlKind') || {}).value || '';
            var deel = kind.split('|');
            await gezinApi('/school/verlof/aanvraag', { klasCode: deel[0], profielId: deel[1],
              van: (wortel.querySelector('#vlVan') || {}).value, tot: (wortel.querySelector('#vlTot') || {}).value,
              reden: (wortel.querySelector('#vlReden') || {}).value });
          }
          if (b.dataset.doe === 'boek') await gezinApi('/school/afspraak/boek', { momentId: b.dataset.moment });
          laad();
        } catch (e) { b.insertAdjacentHTML('afterend', ' <span class="mini">' + esc(e.message) + '</span>'); }
      });
    });
  }

  document.addEventListener('DOMContentLoaded', function () {
    var lijst = document.querySelector('#schoolLijst');
    if (!lijst) return;
    wortel = document.createElement('div');
    wortel.id = 'schoolVerlof';
    lijst.parentNode.insertBefore(wortel, lijst.nextSibling);
    setTimeout(laad, 1100); // na laadGezin, school-extra en school-toets
  });
})();
