/* RTG School Partner: de donderdag van de leerling en de week van de docent.

   TWEE BEELDEN, ALLEBEI PLANNING.

   De week van de klas: wat komt er op deze kinderen af, ook uit andere klassen
   waar ze in zitten. Van elders staat er alleen een AANTAL -- wat een collega
   opgeeft gaat u niet aan, en de server stuurt het ook niet. Een volle dag
   krijgt een merkteken zodat u kunt schuiven.

   De week van uzelf: nakijkwerk, deadlines, toetsdagen. Eenennegentig open
   antwoorden naast een rapportdeadline is een planningsfout en geen
   karakterfout.

   Wat hier NIET staat: hoe snel u uw stapel wegwerkt. Dat wordt nergens
   bijgehouden en kan er ook niet later bij komen -- werkdruk is hulp en geen
   beoordeling. En er gaat niets naar een kind: een drukke dag is een signaal
   aan wie het werk zet.

   Zelfde SPart-patroon; app.js roept SPart.belasting() aan. */
window.SPart = window.SPart || {};
window.SPart.belasting = function () {
  var P = window.SPart, kl = P.kl, sk = P.sk, esc = P.esc;
  var q = function (id) { return document.getElementById(id); };

  function balk(d) {
    var soorten = Object.keys(d.soorten || {}).map(function (s) { return d.soorten[s] + 'x ' + esc(s); }).join(', ');
    return '<div class="item"><span><b>' + esc(d.datum) + '</b>' +
      (d.vol ? ' <span class="tag aan">vol</span>' : '') +
      '<br><span class="stil">' + d.aantal + ' stuk(ken)' +
      (d.elders ? ', waarvan ' + d.elders + ' uit een andere klas' : '') +
      (soorten ? ' &middot; ' + soorten : '') + '</span></span></div>';
  }

  function toon(pad, vakId, roep) {
    var vak = q(vakId);
    if (!vak) return;
    roep(pad).then(function (r) {
      if (r.body.error) { vak.innerHTML = '<p class="stil">' + esc(r.body.error) + '</p>'; return; }
      var dagen = (r.body.dagen || []).filter(function (d) { return d.aantal > 0; });
      vak.innerHTML = (dagen.length ? dagen.map(balk).join('')
        : '<p class="stil">Er staat de komende twee weken niets gepland.</p>') +
        '<p class="stil"><b>' + esc(r.body.advies) + '</b><br>' + esc(r.body.uitleg) + '</p>';
    });
  }

  toon('/school/belasting/klas', 'belastingKlas', kl);
  toon('/school/belasting/mij', 'belastingMij', sk);
};
