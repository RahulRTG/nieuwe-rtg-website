/* RTF School, gezinskant: wat staat er vandaag klaar.

   De Daily Learning Guarantee voor een kind dat in een klas zit. Wat de school
   vroeg staat vooraan, daarna wat terugkomt en waar het gebleven was in de
   leerlijn. De server stelt dat samen (server/school/dag.js); dit scherm toont
   het en verzint er niets bij.

   Drie dingen die hier met opzet ONTBREKEN:
   - een teller over dagen heen. Die bestaat niet: het plan wordt telkens
     uitgerekend en nooit bewaard, dus er valt geen reeks van te maken;
   - tijdsdruk. Een deadline van de leraar staat er zoals hij is, zonder
     aftelklok en zonder kleur die haast maakt;
   - een oordeel over wat er niet is gedaan. Er wordt niet bijgehouden wat een
     kind heeft overgeslagen, dus er valt ook niets over te zeggen.

   Draait als los deel naast de pagina; gebruikt gezinApi uit school.html. */
(function () {
  'use strict';
  var esc = function (t) {
    return String(t == null ? '' : t).replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  };
  var wortel = null;

  var WAT = { huiswerk: 'Van school', herhalen: 'Terug van eerder', verder: 'Volgende stap' };

  async function laad() {
    if (typeof gezinApi !== 'function' || !wortel) return;
    var d;
    try { d = await gezinApi('/school/mijn'); } catch (e) { return; }
    if (d && d.ouder) { wortel.innerHTML = ''; return; } // het dagplan is van het kind zelf
    var blokken = '';
    for (var i = 0; i < ((d && d.school) || []).length; i++) {
      var x = d.school[i];
      var plan;
      try { plan = await gezinApi('/school/dag', { klasCode: x.klas.code }); } catch (e) { continue; }
      blokken += '<div class="sec">Vandaag · ' + esc(x.klas.naam) + '</div><div class="kaart blok">' +
        (plan.stukken.length
          ? plan.stukken.map(function (s) {
              return '<div class="mini h-my40"><b>' + esc(s.naam) + '</b> ' +
                '<span class="h-zachter">' + esc(WAT[s.soort] || s.soort) + ' · ' + esc(s.vak) + '</span>' +
                (s.deadline ? ' <span class="h-zachter">voor ' + esc(s.deadline) + '</span>' : '') +
                '<br><span class="h-zacht">' + esc(s.waarom) + '</span></div>';
            }).join('')
          : '<div class="mini">' + esc(plan.let || '') + '</div>') +
        '<div class="mini h-zacht">' + esc(plan.uitleg) + '</div></div>';
    }
    wortel.innerHTML = blokken;
  }

  document.addEventListener('DOMContentLoaded', function () {
    var lijst = document.querySelector('#schoolLijst');
    if (!lijst) return;
    wortel = document.createElement('div');
    wortel.id = 'schoolDag';
    lijst.parentNode.insertBefore(wortel, lijst);
    setTimeout(laad, 1000);
  });
})();
