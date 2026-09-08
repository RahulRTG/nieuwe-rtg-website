/* De voordeur: een leesbeeld van dezelfde veiligheidskern, geen vijfde opslag. */
(function (w, d) {
  'use strict';
  var V = w.RTGVeilig = w.RTGVeilig || { standen: [] };
  var tik = null;
  var $ = function (s) { return d.querySelector(s); };

  function klok(sec) {
    sec = Math.max(0, Math.round(sec));
    var u = Math.floor(sec / 3600), m = Math.floor((sec % 3600) / 60), s = sec % 60;
    return (u ? u + ':' + String(m).padStart(2, '0') : m) + ':' + String(s).padStart(2, '0');
  }

  function open(id) { if (w.RTGVeilig && w.RTGVeilig.toon) w.RTGVeilig.toon(id); }

  function teken(x) {
    var Veilig = w.Veilig;
    var lopen = (x.wachten && x.wachten.lopend) || [];
    var thuis = lopen.find(function (a) { return a.soort === 'thuis'; });
    var vitaal = lopen.find(function (a) { return a.soort === 'vitaal'; });
    var kring = x.kring || { contacten: [], mails: [] };
    var aantal = kring.contacten.length + kring.mails.length;
    var status = thuis ?
      '<div class="veilig-actief"><span>Thuiswacht actief</span><b>' + Veilig.esc(thuis.label || 'Onderweg naar huis') + '</b>' +
      '<strong class="veilig-tijd" data-rest="' + thuis.restSec + '">' + klok(thuis.restSec) + '</strong>' +
      '<small>tot uw kring bericht krijgt</small><button class="knop hoofd groot" id="vandaagThuis">Ik ben thuis</button>' +
      '<button class="knop" data-open="wacht">Bekijk of verleng</button></div>' :
      '<div class="veilig-actief veilig-rustig"><span>Alles rustig</span><b>Ga met een gerust gevoel op pad.</b>' +
      '<small>U kiest hoe lang u onderweg bent. Daarna neemt uw eigen kring het over.</small>' +
      '<button class="knop hoofd groot" data-open="wacht">Start een thuiswacht</button></div>';

    $('#veiligVandaag').innerHTML = status +
      '<div class="veilig-statussen">' +
        '<button type="button" data-kring><span>Mijn kring</span><b>' + aantal + (aantal === 1 ? ' ontvanger' : ' ontvangers') + ' ingesteld</b></button>' +
        '<button type="button" data-open="codewoord"><span>Codewoord</span><b>' +
          (x.codewoord && x.codewoord.aan ? 'Aan' : (x.codewoord && x.codewoord.ingesteld ? 'Uit' : 'Nog instellen')) + '</b></button>' +
        '<button type="button" data-open="rust"><span>Thuisrust</span><b>' + (x.rust && x.rust.aan ? x.rust.naam : 'Uit') + '</b></button>' +
      '</div>' +
      '<button class="veilig-check" type="button" data-open="vitaal"><span>Mijn check-in</span><b>' +
        (vitaal ? 'Volgende melding over ' + klok(vitaal.restSec) : 'Nog niet ingesteld') + '</b><small>De serverklok blijft lopen als uw telefoon uitvalt.</small></button>';

    $('#veiligVandaag').querySelectorAll('[data-open]').forEach(function (b) {
      b.addEventListener('click', function () { open(b.dataset.open); });
    });
    var kb = $('#veiligVandaag').querySelector('[data-kring]');
    if (kb) kb.addEventListener('click', function () { d.dispatchEvent(new CustomEvent('rtgveiligkring')); });
    var incheck = $('#vandaagThuis');
    if (incheck) incheck.addEventListener('click', async function () {
      try {
        await Veilig.plekDoorgeven();
        await Veilig.api('/api/veiligheid/wacht/checkin', { id: thuis.id });
        Veilig.melding('Fijn. De thuiswacht staat uit.'); laad();
      } catch (e) { Veilig.melding(e.message); }
    });
    var tijd = $('#veiligVandaag .veilig-tijd');
    clearInterval(tik);
    if (tijd) {
      var rest = Number(tijd.dataset.rest || 0);
      tik = setInterval(function () { rest = Math.max(0, rest - 1); tijd.textContent = klok(rest); if (!rest) laad(); }, 1000);
    }
  }

  async function laad() {
    try { teken(await w.Veilig.api('/api/veiligheid')); }
    catch (e) { $('#veiligVandaag').innerHTML = RTGLeeg.html(RTGLeeg.vanFout({ status: 401, message: w.Veilig.esc(e.message) })); }
  }

  V.standen.push({
    id: 'vandaag', naam: 'Vandaag', regel: 'rust in een oogopslag', kringKop: 'Uw kring',
    uitleg: 'Uw thuiswacht, check-in, codewoord en rust delen één kring. U ziet hier wat er nu werkelijk aan staat.',
    html: '<div class="veilig-vandaag" id="veiligVandaag"><p class="stil">Laden...</p></div>',
    start: laad, stop: function () { clearInterval(tik); tik = null; }
  });
})(window, document);
