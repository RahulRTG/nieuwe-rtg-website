/* WAT U ZELF OVER UW RIT ZEGT -- onder de chauffeurskaart (rit-momenten.js).

   De chauffeur meldt aankomst; dat is zijn melding en niet uw bevestiging
   (server/kern/mobiliteit/ontvangst.js). Dit blok laat beide naast elkaar zien,
   met elk hun eigen tijd, en geeft u de twee knoppen die er op dit moment toe
   doen: bevestigen dat het klopt, of melden dat het niet klopt. Een melding
   verandert niets aan de rit; een mens van RTG kijkt ernaar. */
(function (w) {
  'use strict';
  var PROBLEMEN = [['niet-aangekomen', 'De chauffeur is er niet'], ['ander-voertuig', 'Ander voertuig'],
    ['andere-chauffeur', 'Andere chauffeur'], ['niet-afgeleverd', 'Ik ben niet op mijn bestemming'],
    ['onveilig', 'Ik voel me niet veilig'], ['anders', 'Iets anders']];
  var tijd = function (iso) { var t = new Date(String(iso || '')); return isNaN(t) ? '' : t.toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' }); };

  function voegToe(c, r) {
    var o = r && r.ontvangst, kaart = c.$('.chauffeur-inhoud');
    if (!o || !kaart) return;
    var regels = [];
    if (o.aankomst.gemeldDoorChauffeur) regels.push('Chauffeur meldde aankomst om ' + tijd(o.aankomst.gemeldDoorChauffeur) +
      (o.aankomst.bevestigdDoorReiziger ? ' · u bevestigde om ' + tijd(o.aankomst.bevestigdDoorReiziger) : ' · nog niet door u bevestigd'));
    if (o.aflevering.gemeldDoorChauffeur) regels.push('Rit voltooid gemeld om ' + tijd(o.aflevering.gemeldDoorChauffeur) +
      (o.aflevering.bevestigdDoorReiziger ? ' · u bevestigde om ' + tijd(o.aflevering.bevestigdDoorReiziger) : ' · nog niet door u bevestigd'));
    o.problemen.forEach(function (p) { regels.push('U meldde: ' + p.wat + ' (' + tijd(p.at) + ')'); });
    var knoppen = '';
    if (o.aankomst.gemeldDoorChauffeur && !o.aankomst.bevestigdDoorReiziger && !o.aflevering.gemeldDoorChauffeur) knoppen += '<button type="button" data-ontvangst="aankomst">De chauffeur is er</button>';
    if (o.aflevering.gemeldDoorChauffeur && !o.aflevering.bevestigdDoorReiziger) knoppen += '<button type="button" data-ontvangst="aflevering">Ik ben aangekomen</button>';
    if (r.status !== 'geannuleerd' && r.status !== 'aangevraagd') knoppen += '<label class="rit-probleem">Er klopt iets niet <select data-probleem><option value="">Kies wat</option>' +
      PROBLEMEN.map(function (p) { return '<option value="' + p[0] + '">' + c.esc(p[1]) + '</option>'; }).join('') + '</select></label>';
    if (!regels.length && !knoppen) return;
    kaart.insertAdjacentHTML('beforeend', '<section class="rit-ontvangst" aria-label="Wat u zelf bevestigt"><span>WAT U BEVESTIGT</span>' +
      regels.map(function (t) { return '<p>' + c.esc(t) + '</p>'; }).join('') + '<div class="rit-ontvangst-knoppen">' + knoppen + '</div>' +
      '<small>Een melding van de chauffeur is geen bevestiging van u. Een probleem melden verandert niets aan de rit; een mens van RTG kijkt ernaar.</small></section>');
    kaart.querySelectorAll('[data-ontvangst]').forEach(function (b) {
      b.addEventListener('click', function () {
        c.api('/api/mob/ontvangst', { ref: r.ref, wat: b.dataset.ontvangst })
          .then(function () { c.meld('Bevestigd. Dank u.'); return c.ververs(); }).catch(function (e) { c.meld(e.message); });
      });
    });
    var keuze = kaart.querySelector('[data-probleem]');
    if (keuze) keuze.addEventListener('change', function () {
      if (!keuze.value) return;
      c.api('/api/mob/ontvangst/probleem', { ref: r.ref, soort: keuze.value })
        .then(function (d) { c.meld(d.ookNu || 'Uw melding is binnen. Een mens van RTG kijkt ernaar.'); return c.ververs(); })
        .catch(function (e) { c.meld(e.message); });
    });
  }
  w.RTGRitOntvangst = { voegToe: voegToe };
})(window);
