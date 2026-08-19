/* Stand 4 -- Thuisrust. Was /apps/thuisrust.html.

   De veiligheidsbaan staat als eerste in het paneel en niet in de uitleg boven
   de standenbalk: het is de zin die iemand het vertrouwen geeft om dit
   überhaupt aan te zetten, en die hoort naast de knop te staan waar hij over
   gaat, niet erboven in een strook die wegscrollt. */
(function (w, d) {
  'use strict';
  var V = w.RTGVeilig = w.RTGVeilig || { standen: [] };
  var $ = function (s) { return d.querySelector(s); };
  var DUUR = [
    { min: 60, naam: '1 uur' }, { min: 120, naam: '2 uur' },
    { min: 240, naam: '4 uur' }, { min: 480, naam: '8 uur' }, { min: 720, naam: '12 uur' }
  ];

  function teken(r) {
    var Veilig = w.Veilig;
    if (r.aan) {
      $('#rust').innerHTML =
        '<p><strong>' + Veilig.esc(r.naam) + '</strong> staat aan.</p>' +
        '<p class="stil h-mt30">' + Veilig.esc(r.uitleg) + '</p>' +
        '<p class="stil h-mt50">Vanzelf voorbij om ' + Veilig.tijd(r.tot) +
          (r.hangtAanWacht ? ', of zodra u incheckt in de Thuiswacht.' : '.') + '</p>' +
        (r.notitie ? '<p class="stil h-mt50">' + Veilig.esc(r.notitie) + '</p>' : '') +
        '<button class="knop groot h-mt100" id="uit">Zet uit</button>';
      $('#uit').addEventListener('click', async function () {
        try { await Veilig.api('/api/veiligheid/rust/uit'); Veilig.melding('Uit.'); laad(); }
        catch (e) { Veilig.melding(e.message); }
      });
      return;
    }
    var gekozen = (r.standen[0] || {}).id;
    var duur = 240;
    $('#rust').innerHTML =
      r.standen.map(function (s) {
        return '<button class="stand" data-id="' + s.id + '" aria-pressed="' + (s.id === gekozen) + '">' +
          '<b>' + Veilig.esc(s.naam) + '</b><span>' + Veilig.esc(s.uitleg) + '</span></button>';
      }).join('') +
      '<label class="stil lbl" for="duur">Hoe lang hooguit?</label>' +
      '<div class="keuzes" role="group" aria-label="Duur">' +
        DUUR.map(function (x) { return '<button class="knop" data-duur="' + x.min + '" aria-pressed="' + (x.min === duur) + '">' + x.naam + '</button>'; }).join('') +
      '</div>' +
      '<label class="stil lbl" for="notitie">Wilt u er iets bij zetten? (alleen voor uzelf)</label>' +
      '<input id="notitie" maxlength="120" placeholder="Bijv. eten met de kinderen">' +
      '<button class="knop hoofd groot h-mt90" id="aan">Zet aan</button>';

    $('#rust').querySelectorAll('[data-id]').forEach(function (b) {
      b.addEventListener('click', function () {
        gekozen = b.dataset.id;
        $('#rust').querySelectorAll('[data-id]').forEach(function (x) { x.setAttribute('aria-pressed', String(x === b)); });
      });
    });
    $('#rust').querySelectorAll('[data-duur]').forEach(function (b) {
      b.addEventListener('click', function () {
        duur = Number(b.dataset.duur);
        $('#rust').querySelectorAll('[data-duur]').forEach(function (x) { x.setAttribute('aria-pressed', String(x === b)); });
      });
    });
    $('#aan').addEventListener('click', async function () {
      try {
        await Veilig.api('/api/veiligheid/rust/aan', { stand: gekozen, minuten: duur, notitie: $('#notitie').value.trim() });
        Veilig.melding('Rust aan. Uw kring komt er altijd doorheen.');
        laad();
      } catch (e) { Veilig.melding(e.message); }
    });
  }

  async function laad() {
    try { teken((await w.Veilig.api('/api/veiligheid/rust')).rust); }
    catch (e) { $('#rust').innerHTML = '<p class="stil">' + w.Veilig.esc(e.message) + ' Log eerst in via de leden-app.</p>'; }
  }

  V.standen.push({
    id: 'rust',
    naam: 'Thuisrust',
    regel: 'stil, maar bereikbaar',
    kringKop: 'Wie er altijd doorkomt',
    uitleg: 'De wereld gaat stil. De mensen die ertoe doen komen er altijd doorheen.',
    html:
      '<div class="baan" role="note">' +
        '<strong>De veiligheidsbaan.</strong> Wat u ook kiest: uw kring komt er altijd doorheen, en elk ' +
        'veiligheidsbericht ook. Dat is precies waarom u dit durft aan te zetten. Gewone ' +
        'niet-storen-standen zetten alles dicht, en daarom laat iedereen ze uit: stel dat er iets is met ' +
        'een kind, of met uw moeder. Hier hoeft u niet te kiezen tussen rust en bereikbaar zijn.' +
      '</div>' +
      '<h2>Nu</h2>' +
      '<div class="kaart" id="rust"><p class="stil">Laden...</p></div>' +
      '<h2>Hoe het eindigt</h2>' +
      '<div class="kaart">' +
        '<p class="stil">Elke stand heeft een einde. "Tot ik thuis ben" gaat vanzelf uit zodra u ' +
        'incheckt in de Thuiswacht, en anders na de tijd die u kiest. Zo blijft er nooit per ongeluk ' +
        'een stand dagenlang aan staan, en gaat u niets missen zonder het te weten.</p>' +
      '</div>',
    start: laad
  });
})(window, document);
