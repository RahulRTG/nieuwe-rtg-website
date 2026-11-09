/* DE REGIE VAN DE ZAAK -- één weergave, twee huizen.

   Dit scherm hangt in de zaak-app (leverancier.html) én in de personeels-app
   (personeel.html, de PDA). Dat is met opzet één module en geen twee: de
   uitzonderingenrij die een medewerker op de vloer ziet, MOET dezelfde lijst
   zijn die de manager op kantoor ziet. Twee implementaties van hetzelfde
   scherm lopen uiteen -- niet misschien, maar zeker, en dan wijst de een naar
   de ander.

   WAT WEL VERSCHILT IS DE WEERGAVE, niet de inhoud. Met `compact: true` wordt
   het een telefoonscherm: één kolom, grote raakvlakken, en alleen de drie
   dingen die je met een duim doet -- kijken wat er speelt, iets op de lijst
   zetten, en een uitzondering oppakken. Instellingen en het spoor staan daar
   niet; die horen op een scherm waar je bij zit.

   EN HET SCHERM VERZINT NIETS OVER RECHTEN. Wat een medewerker mag, bepaalt de
   server (managerOnly). Dit scherm vraagt het één keer op en verbergt wat niet
   mag -- maar als het zich zou vergissen, weigert de server alsnog. Een knop
   verbergen is netheid; de grendel zit aan de andere kant. */
(function (w, d) {
  'use strict';
  if (w.RTGZaakCommand) return;
  if (d && d.documentElement && !d.documentElement.hasAttribute('data-ds') && !d.getElementById('rtgDsRuntimeCss')) {
    var link = d.createElement('link');
    link.id = 'rtgDsRuntimeCss'; link.rel = 'stylesheet'; link.href = '/ds/rtg-ds.css';
    d.head.appendChild(link);
  }

  var esc = function (t) {
    return String(t == null ? '' : t).replace(/[&<>"']/g, function (c) {
      return ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c];
    });
  };
  var MND = ['', 'jan', 'feb', 'mrt', 'apr', 'mei', 'jun', 'jul', 'aug', 'sep', 'okt', 'nov', 'dec'];
  function tijd(s) {
    if (!s) return '';
    var x = new Date(s);
    if (isNaN(x)) return String(s).slice(0, 16);
    return x.getDate() + ' ' + MND[x.getMonth() + 1] + ' ' + x.getHours() + ':' + String(x.getMinutes()).padStart(2, '0');
  }
  var NIVEAU = { auto: 'vanzelf', assist: 'met hulp', hand: 'zelf doen' };
  function nv(n) { return '<span class="zc-nv zc-' + esc(n) + '">' + esc(NIVEAU[n] || n) + '</span>'; }

  w.RTGZaakCommand = { esc: esc, tijd: tijd, nv: nv, delen: {} };
})(window, document);
