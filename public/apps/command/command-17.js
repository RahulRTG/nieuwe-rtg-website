/* RTG Command, deel 17: de gezondheidskaart -- doen de vermogens het, en hoe
   hard weten we dat.

   DIT SCHERM TOONT TWEE DINGEN NAAST ELKAAR EN NOOIT DOOR ELKAAR: de stand (in
   orde, let op, storing, niet vast te stellen) en de bewijsgraad (onbekend,
   vermoed, gemeten, bewezen). Elk ander bord perst die twee in één bolletje, en
   dan leest "groen omdat we niets weten" hetzelfde als "groen omdat we het net
   nog hebben gedaan".

   "NIET VAST TE STELLEN" KRIJGT GEEN KLEUR. Niet groen, niet amber, niet rood.
   Alles wat een kleur krijgt, wordt binnen een week als een oordeel gelezen --
   en dit is geen oordeel, dit is de afwezigheid van een.

   EN ELKE BRON DRAAGT ZIJN EIGEN GRENS. Onder elke bewering staat wat die bron
   NIET aantoont, uitklapbaar maar niet weggestopt. Dat is de laag die je niet
   kunt verzinnen: de eerste drie regels van een kaart kun je schrijven, de
   vierde verwijst naar een meting die er is of niet is. */
(function () {
  'use strict';
  var C = window.RTGCommand, esc = C.esc, api = C.api;

  /* `geen` en niet `stil`: de UI-kit heeft een eigen .stil die specifieker is
     dan .cniveau.stil en de pil stil op .8rem zou zetten. Zie command.html. */
  var KLEUR = { 'in orde': 'ok', 'let op': 'onbekend', 'storing': 'mis', 'niet vast te stellen': 'geen' };

  C.TEKENAARS.gezondheid = function (el) {
    el.innerHTML = '<h2 class="ckop">Gezondheid</h2>' +
      '<p class="lead">De puls zegt hoe de <i>gegevens</i> ervoor staan. Dit zegt of de <i>vermogens</i> ' +
      'het doen -- en hoe hard dat bewijs is. Deze kaart meet niets zelf: elk getal komt uit een laag ' +
      'die er al was, en elke bron draagt erbij wat hij niet aantoont.</p>' +
      '<div id="gzUit"><div class="leeg">Lezen…</div></div>';
    teken();

    function teken() {
      api('gezondheid').then(function (d) {
        var u = '<div class="rooster">' +
          tegel('Storing', d.tel.storing, d.tel.storing ? 'acc' : '', 'een vermogen doet het niet') +
          tegel('Let op', d.tel.letOp, d.tel.letOp ? 'gold' : '', 'werkt, maar iets vraagt aandacht') +
          tegel('Niet vast te stellen', d.tel.nietVastTeStellen, '', 'geen bron zegt hier iets over') +
          tegel('Bewijs verlopen', d.tel.moetOpnieuw, d.tel.moetOpnieuw ? 'gold' : '', 'moet opnieuw worden vastgesteld') +
          '</div>';

        if (d.alarmenBuitenDeKaart.length) {
          u += '<div class="kaart"><h3>Alarmen die bij geen enkel vermogen horen</h3>' +
            '<p>Deze gaan af terwijl ze nergens op deze kaart terugkomen. Dat is precies het geval ' +
            'waarvoor de kaart bestaat: hang ze aan een vermogen in <code>kern/command/vermogens.js</code>.</p>' +
            d.alarmenBuitenDeKaart.map(function (a) {
              return '<div class="lijn"><b>' + esc(a.naam) + '</b> ' +
                '<span class="cniveau ' + (a.ernst === 'hoog' ? 'mis' : 'onbekend') + '">' + esc(a.ernst) + '</span>' +
                '<div class="meta">' + esc(a.wat) + '</div></div>';
            }).join('') + '</div>';
        }

        for (var i = 0; i < d.vermogens.length; i++) u += vermogenKaart(d.vermogens[i]);

        u += '<div class="kaart"><h3>Wat deze kaart niet dekt</h3>' +
          '<p class="meta">' + esc(d.let) + '</p>' +
          (d.dekking.buitenDeFunctiecatalogus
            ? '<p class="meta">' + d.dekking.buitenDeFunctiecatalogus.verzoeken + ' verzoeken vielen onder ' +
              'geen enkele functie (' + esc(d.dekking.buitenDeFunctiecatalogus.wat) + ') en daarmee onder geen ' +
              'enkel vermogen. Ze staan hier en niet in een van de kaarten hierboven.</p>'
            : '<p class="meta">Al het gemeten verkeer valt onder een functie uit de catalogus.</p>') +
          (d.dekking.venster ? '<p class="meta">Venster: ' + esc(d.dekking.venster.let) + '</p>' : '') +
          '</div>';

        C.$('#gzUit').innerHTML = u;
        C.$('#gzUit').querySelectorAll('[data-ctrl]').forEach(function (b) {
          b.onclick = function () {
            b.disabled = true; b.textContent = 'Bezig…';
            api('gezondheid/controleer', { id: b.dataset.ctrl }).then(function (r) {
              C.meld(r.naam + ': ' + r.uitslag);
              C.ververs(); teken();
            }).catch(function (e) { if (!e.stil) C.meld(e.message); });
          };
        });
        C.$('#gzUit').querySelectorAll('[data-open]').forEach(function (b) {
          b.onclick = function () {
            var k = C.$('#' + b.dataset.open);
            var dicht = k.hasAttribute('hidden');
            if (dicht) k.removeAttribute('hidden'); else k.setAttribute('hidden', '');
            b.setAttribute('aria-expanded', dicht ? 'true' : 'false');
            b.textContent = dicht ? 'Verberg het bewijs' : 'Toon het bewijs';
          };
        });
      }).catch(function (e) {
        if (!e.stil) C.$('#gzUit').innerHTML = '<div class="leeg">' + esc(e.message) + '</div>';
      });
    }
  };

  function vermogenKaart(v) {
    var id = 'gz-' + v.id;
    var u = '<div class="kaart"><h3>' + esc(v.naam) + '</h3>' +
      '<div class="crij"><span class="cniveau ' + (KLEUR[v.oordeel] || 'geen') + '">' + esc(v.oordeel) + '</span>' +
      '<span class="cgraad ' + esc(v.graad) + '">bewijs: ' + esc(v.graad) + '</span>' +
      (v.bewijs.plafond ? '<span class="meta">hoger dan "' + esc(v.bewijs.plafond) + '" kan hier niet</span>' : '') +
      '</div>' +
      /* Laag 1: één zin, geen getal. */
      '<p>' + esc(v.taal.mens) + '</p>' +
      '<p class="meta">' + esc(v.waarvoor) + '</p>';

    /* Laag 2: wat elke bron zegt, in de taal van die bron. */
    if (v.taal.operationeel.length) {
      u += '<div class="lijn">' + v.taal.operationeel.map(esc).join('</div><div class="lijn">') + '</div>';
    } else {
      u += '<div class="lijn"><span class="meta">Geen enkele bron zegt op dit moment iets over dit ' +
        'vermogen. Dat is geen goed nieuws en geen slecht nieuws.</span></div>';
    }

    if (v.vervallen) {
      u += '<p class="meta">De laatste controleronde was ' + v.vervallen.urenOud + ' uur geleden en gold als "' +
        esc(v.vervallen.was) + '"; de houdbaarheid is ' + v.vervallen.houdbaarUren + ' uur. Vervallen bewijs ' +
        'telt hier niet mee.</p>';
    }
    if (v.geraakt.length) {
      u += '<p class="meta">Leunt op een vermogen met een storing: ' + esc(v.geraakt.join(', ')) +
        '. Dit vermogen wordt daarom niet rood gekleurd -- het is niet de oorzaak.</p>';
    }

    u += '<div class="crij"><button class="knop" data-ctrl="' + esc(v.id) + '">Controleer</button>' +
      '<button class="knop" data-open="' + id + '" aria-expanded="false" aria-controls="' + id + '">Toon het bewijs</button></div>';

    /* Laag 3 en 4: de getallen, en per bron wat hij NIET aantoont. */
    u += '<div id="' + id + '" hidden>' +
      '<div class="schuif"><table class="ctab"><thead><tr><th>Bron</th><th>Graad</th><th>Stand</th>' +
      '<th>Wat er staat</th></tr></thead><tbody>' +
      v.taal.technisch.map(function (t) {
        return '<tr><td>' + esc(t.bron) + (t.afgeleid ? '<div class="meta">afgeleid</div>' : '') + '</td>' +
          '<td class="meta">' + esc(t.graad) + '</td>' +
          '<td>' + (t.oordeel ? '<span class="cniveau ' + (KLEUR[t.oordeel] || 'geen') + '">' + esc(t.oordeel) + '</span>'
            : '<span class="meta">geen oordeel</span>') + '</td>' +
          '<td class="meta">' + esc(t.zin) + '</td></tr>';
      }).join('') + '</tbody></table></div>' +
      v.bewijs.bronnen.map(function (b) {
        return '<p class="czegt"><b>' + esc(b.bron) + '</b> · gemeten ' + esc(String(b.at || '').slice(0, 16).replace('T', ' ')) +
          '. Wat dit niet aantoont: ' + esc(b.zegtNiet || '(niet opgeschreven)') + '</p>';
      }).join('') +
      '<p class="meta">Drempels: boven ' + v.bewijs.drempels.foutStoring + '% serverfouten is het een storing, ' +
      'boven ' + v.bewijs.drempels.foutLet + '% vraagt het aandacht. Een controleronde blijft ' +
      v.bewijs.houdbaarUren + ' uur geldig.</p></div>';

    return u + '</div>';
  }

  function tegel(l, v, k, u) {
    return '<div class="tegel"><div class="l">' + esc(l) + '</div><div class="v ' + (k || '') + '">' + v + '</div>' +
      (u ? '<div class="u">' + esc(u) + '</div>' : '') + '</div>';
  }
})();
