/* Stand 1 -- Thuiswacht. Was /apps/thuiswacht.html.

   Onveranderd overgenomen: dezelfde routes (/api/veiligheid/wacht/...),
   dezelfde teksten, dezelfde knoppen. Alleen de kring en de grens zijn eruit
   gehaald, want die staan nu een keer in de schil. */
(function (w, d) {
  'use strict';
  var V = w.RTGVeilig = w.RTGVeilig || { standen: [] };
  var $ = function (s) { return d.querySelector(s); };
  var tik = null;

  function tekenWacht(dat) {
    var Veilig = w.Veilig;
    var x = (dat.lopend || [])[0];
    Veilig.plekBlijvenMelden(!!x);
    if (!x) {
      $('#wacht').innerHTML =
        '<label class="stil lbl" for="hoelang">Hoe lang bent u onderweg?</label>' +
        '<div class="keuzes" role="group" aria-label="Duur">' +
          [15, 30, 45, 60, 90].map(function (m) { return '<button class="knop" data-min="' + m + '">' + m + ' min</button>'; }).join('') +
        '</div>' +
        '<div class="rij"><input id="eigen" type="number" min="1" max="1440" placeholder="of eigen aantal minuten" aria-label="Eigen aantal minuten"></div>' +
        '<label class="stil lbl" for="wat">Waar gaat u heen? (alleen uw kring ziet dit)</label>' +
        '<input id="wat" maxlength="80" placeholder="Bijv. lopend naar huis vanaf het station">' +
        '<label class="mini h-mt70"><input type="checkbox" id="marge" checked> eerst mij nog 10 minuten waarschuwen</label>' +
        '<button class="knop hoofd groot h-mt80" id="start">Start de wacht</button>';
      var gekozen = 30;
      $('#wacht').querySelectorAll('[data-min]').forEach(function (b) {
        b.addEventListener('click', function () {
          gekozen = Number(b.dataset.min);
          $('#wacht').querySelectorAll('[data-min]').forEach(function (x2) { x2.setAttribute('aria-pressed', String(x2 === b)); });
          $('#eigen').value = '';
        });
      });
      $('#start').addEventListener('click', async function () {
        var eigen = Number($('#eigen').value);
        var minuten = eigen > 0 ? eigen : gekozen;
        try {
          await Veilig.plekDoorgeven();     // meteen een eerste levensteken
          var r = await Veilig.api('/api/veiligheid/wacht/start', {
            soort: 'thuis', minuten: minuten, marge: $('#marge').checked ? 10 : 0, label: $('#wat').value.trim()
          });
          tekenWacht({ lopend: [r.wacht] });
          Veilig.melding('De wacht loopt. Meld u op tijd.');
        } catch (e) { Veilig.melding(e.message); }
      });
      return;
    }

    var alarm = x.status === 'alarm';
    $('#wacht').innerHTML =
      '<div class="teller' + (x.status === 'genade' ? ' warm' : (alarm ? ' alarm' : '')) + '" id="klok" aria-live="off">--:--</div>' +
      '<p class="tellerbij" id="bij"></p>' +
      '<button class="knop hoofd groot" id="in">Ik ben thuis</button>' +
      '<div class="rij h-mt60">' +
        '<button class="knop h-flex1" id="plus">15 minuten erbij</button>' +
        '<button class="knop stop h-flex1" id="stop">Stoppen</button>' +
      '</div>' +
      '<p class="stil h-mt70">' + Veilig.esc(x.label || '') + '</p>';

    var klok = $('#klok'), bij = $('#bij');
    var rest = x.restSec;
    function loop() {
      rest = Math.max(0, rest - 1);
      klok.textContent = Veilig.klok(rest);
      bij.textContent = x.status === 'genade'
        ? 'U bent over tijd. Nog ' + Veilig.klok(rest) + ' voordat uw kring bericht krijgt.'
        : (alarm ? 'Uw kring is gewaarschuwd.' : 'tot uw kring bericht krijgt');
      if (alarm) klok.textContent = 'Alarm';
    }
    loop();
    clearInterval(tik);
    tik = setInterval(function () { loop(); if (rest <= 0 && !alarm) laad(); }, 1000);

    $('#in').addEventListener('click', async function () {
      try {
        await Veilig.api('/api/veiligheid/wacht/checkin', { id: x.id });
        Veilig.melding('Fijn. De wacht staat uit.');
        laad();
      } catch (e) { Veilig.melding(e.message); }
    });
    $('#plus').addEventListener('click', async function () {
      try { await Veilig.api('/api/veiligheid/wacht/verleng', { id: x.id, minuten: 15 }); laad(); }
      catch (e) { Veilig.melding(e.message); }
    });
    $('#stop').addEventListener('click', async function () {
      try { await Veilig.api('/api/veiligheid/wacht/stop', { id: x.id }); laad(); }
      catch (e) { Veilig.melding(e.message); }
    });
  }

  async function laad() {
    try { tekenWacht(await w.Veilig.api('/api/veiligheid/wacht')); }
    catch (e) { $('#wacht').innerHTML = '<p class="stil">' + w.Veilig.esc(e.message) + ' Log eerst in via de leden-app.</p>'; }
  }

  V.standen.push({
    id: 'wacht',
    naam: 'Thuiswacht',
    regel: 'ik ben zo thuis',
    kringKop: 'Uw kring',
    uitleg: 'U zegt hoe lang u onderweg bent. Meldt u zich niet op tijd, dan krijgt uw kring ' +
      'bericht met uw laatst bekende plek. <strong style="color:var(--txt);">Dit werkt ook als uw ' +
      'telefoon uitvalt:</strong> de klok loopt niet in deze app maar op de server. Uw telefoon moet ' +
      'zich MELDEN om het alarm tegen te houden. Gaat hij uit, gaat hij stuk, of raakt u hem kwijt, ' +
      'dan blijft de klok gewoon lopen en gaat het alarm alsnog af. Stilte is hier het signaal.',
    html:
      '<h2>Nu</h2>' +
      '<div class="kaart" id="wacht"><p class="stil">Laden...</p></div>' +
      '<h2>Werkt het echt?</h2>' +
      '<div class="kaart">' +
        '<p class="stil">Stuur uw kring een proefalarm. Zij zien duidelijk dat het een test is. ' +
        'Doe dit een keer echt: een keten die u nooit heeft geprobeerd, is geen keten.</p>' +
        '<button class="knop h-mt60" id="proef">Stuur een proefalarm</button>' +
      '</div>',
    start: function () {
      $('#proef').addEventListener('click', async function () {
        try {
          var r = await w.Veilig.api('/api/veiligheid/alarm', { proef: true });
          w.Veilig.melding('Proefalarm naar ' + r.naar + ' contact(en) en ' + r.mails + ' adres(sen).');
        } catch (e) { w.Veilig.melding(e.message); }
      });
      laad();
    },
    stop: function () { clearInterval(tik); tik = null; }
  });
})(window, document);
