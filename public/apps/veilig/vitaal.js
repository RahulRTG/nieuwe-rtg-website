/* Stand 3 -- Vitaal. Was /apps/vitaal.html.

   Deze stand houdt als enige een eigen register bij ("wat er is gebeurd"), en
   meldt dat aan bij shared/uitvoer.js. Die aanmelding staat op moduleniveau en
   niet in start(): een bron die zich bij elke standwissel opnieuw aanmeldt,
   staat na drie keer wisselen drie keer in de uitvoer. Zolang er geen alarmen
   zijn geeft hij null terug, precies zoals in de losse app. */
(function (w, d) {
  'use strict';
  var V = w.RTGVeilig = w.RTGVeilig || { standen: [] };
  var $ = function (s) { return d.querySelector(s); };
  var tik = null;
  var alarmen = [];   // wat er is gebeurd; komt binnen in laad()

  function tekenWacht(dat) {
    var Veilig = w.Veilig;
    var x = (dat.lopend || []).find(function (y) { return y.soort === 'vitaal'; });
    if (!x) {
      $('#wacht').innerHTML =
        '<label class="stil lbl" for="uur">Hoe vaak wilt u zich melden?</label>' +
        '<select id="uur">' +
          '<option value="24">Eén keer per dag</option>' +
          '<option value="12">Twee keer per dag</option>' +
          '<option value="8">Drie keer per dag</option>' +
          '<option value="48">Om de twee dagen</option>' +
        '</select>' +
        '<label class="stil lbl" for="eerste">Wanneer verwacht u de eerste keer? (uren vanaf nu)</label>' +
        '<input id="eerste" type="number" min="1" max="48" value="12">' +
        '<label class="stil lbl" for="wat">Waar gaat het om?</label>' +
        '<input id="wat" maxlength="80" placeholder="Bijv. medicijnen avond">' +
        '<label class="stil lbl" for="marge">Hoeveel speling voordat mijn kring bericht krijgt?</label>' +
        '<select id="marge">' +
          '<option value="60">Een uur</option>' +
          '<option value="120" selected>Twee uur</option>' +
          '<option value="30">Een half uur</option>' +
        '</select>' +
        '<button class="knop hoofd groot" id="start" style="margin-top:1rem;">Zet de check-in aan</button>';
      $('#start').addEventListener('click', async function () {
        try {
          await Veilig.plekDoorgeven();
          await Veilig.api('/api/veiligheid/wacht/start', {
            soort: 'vitaal',
            minuten: Math.max(1, Number($('#eerste').value) || 12) * 60,
            marge: Number($('#marge').value),
            herhaalUur: Number($('#uur').value),
            label: $('#wat').value.trim() || 'Check-in'
          });
          Veilig.melding('De check-in staat aan.');
          laad();
        } catch (e) { Veilig.melding(e.message); }
      });
      return;
    }

    var laat = x.status === 'genade' || x.status === 'alarm';
    $('#wacht').innerHTML =
      '<button class="knop hoofd groot" id="in">Het gaat goed</button>' +
      '<p class="tellerbij" id="bij" style="margin-top:.8rem;"></p>' +
      '<p class="stil">' + Veilig.esc(x.label || '') +
        (x.herhaal ? ' &middot; elke ' + x.herhaal + ' uur' : '') + '</p>' +
      '<div class="rij" style="margin-top:.8rem;">' +
        '<button class="knop" id="plus" style="flex:1;">Een uur later</button>' +
        '<button class="knop stop" id="stop" style="flex:1;">Uitzetten</button></div>';

    var rest = x.restSec;
    function loop() {
      rest = Math.max(0, rest - 1);
      var uur = Math.floor(rest / 3600), min = Math.floor((rest % 3600) / 60);
      $('#bij').textContent = x.status === 'alarm'
        ? 'Uw kring is gewaarschuwd.'
        : (laat ? 'U bent over tijd. Nog ' + (uur ? uur + ' uur ' : '') + min + ' min voordat uw kring bericht krijgt.'
                : 'Volgende keer over ' + (uur ? uur + ' uur ' : '') + min + ' minuten.');
    }
    loop();
    clearInterval(tik);
    tik = setInterval(function () { loop(); if (rest <= 0) laad(); }, 1000);

    $('#in').addEventListener('click', async function () {
      try {
        await Veilig.plekDoorgeven();
        await Veilig.api('/api/veiligheid/wacht/checkin', { id: x.id });
        Veilig.melding('Genoteerd. Tot de volgende keer.');
        laad();
      } catch (e) { Veilig.melding(e.message); }
    });
    $('#plus').addEventListener('click', async function () {
      try { await Veilig.api('/api/veiligheid/wacht/verleng', { id: x.id, minuten: 60 }); laad(); }
      catch (e) { Veilig.melding(e.message); }
    });
    $('#stop').addEventListener('click', async function () {
      try { await Veilig.api('/api/veiligheid/wacht/stop', { id: x.id }); laad(); }
      catch (e) { Veilig.melding(e.message); }
    });
  }

  async function laad() {
    var Veilig = w.Veilig;
    try {
      tekenWacht(await Veilig.api('/api/veiligheid/wacht'));
      var beeld = await Veilig.api('/api/veiligheid');
      alarmen = beeld.alarmen || [];
      $('#log').innerHTML = alarmen.length
        ? alarmen.map(function (a) {
            return '<p class="stil">' + Veilig.tijd(a.at) + ' &middot; ' +
              (a.proef ? 'proef' : Veilig.esc(a.soort)) + ' &middot; naar ' + a.naar + ' contact(en)' +
              (a.afgesloten ? ' &middot; afgesloten' : '') + '</p>';
          }).join('')
        : '<p class="stil">Nog niets. Zo hoort het.</p>';
    } catch (e) {
      $('#wacht').innerHTML = '<p class="stil">' + Veilig.esc(e.message) + ' Log eerst in via de leden-app.</p>';
      $('#log').innerHTML = '';
    }
  }

  /* Meenemen (shared/uitvoer.js): het register dat deze stand echt bijhoudt is
     "wat er is gebeurd" -- per alarm de dag, de soort, naar hoeveel mensen het
     ging en of het is afgesloten. De kring zelf staat er niet in: dat zijn de
     gegevens van uw contacten, niet van dit scherm. */
  if (w.RTGUitvoer) w.RTGUitvoer.bron(function () {
    if (!alarmen.length) return null;
    return {
      naam: 'vitaal-geschiedenis',
      kolommen: ['datum', 'soort', 'contacten', 'afgesloten'],
      rijen: alarmen.map(function (a) {
        return [String(a.at || '').slice(0, 10), a.proef ? 'proef' : (a.soort || ''),
          a.naar, a.afgesloten ? 'ja' : 'nee'];
      })
    };
  });

  V.standen.push({
    id: 'vitaal',
    naam: 'Vitaal',
    regel: 'even laten weten',
    kringKop: 'Wie er gaat kijken',
    uitleg: 'Eén knop per dag: <em>het gaat goed</em>. Drukt u niet, dan krijgt uw kring bericht. ' +
      'Voor medicijnen, of gewoon om iemand gerust te stellen als u alleen woont. ' +
      '<strong style="color:var(--txt);">Ook als uw telefoon uitvalt:</strong> de klok loopt op de ' +
      'server, niet in deze app. U hoeft niets aan te hebben staan en de app hoeft niet open te ' +
      'zijn; als u zich niet meldt, gaat het alarm vanzelf.',
    html:
      '<h2>Uw check-in</h2>' +
      '<div class="kaart" id="wacht"><p class="stil">Laden...</p></div>' +
      '<h2>Wat er is gebeurd</h2>' +
      '<div class="kaart" id="log"><p class="stil">Laden...</p></div>',
    start: laad,
    stop: function () { clearInterval(tik); tik = null; }
  });
})(window, document);
