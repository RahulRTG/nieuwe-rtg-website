/* Saloon heeft eigen inhoud; navigatie blijft eigendom van de gedeelde Edge. */
(function (w) {
  'use strict';
  w.RTGSaloonOpbouw = function () {
    return '<div class="saloon-kop"><div><p class="saloon-naam">Saloon</p><p class="eyebrow" id="saloonGroet"></p>'
      + '<h2>Uw wereld<br>komt samen.</h2><p id="saloonOmgeving"></p></div>'
      + '<button type="button" data-saloon-maken>Maken <span aria-hidden="true">＋</span></button></div>'
      + '<form id="saloonZoek" role="search" class="saloon-zoek"><label class="living-sr" for="saloonZoekveld">Zoeken in Saloon</label>'
      + '<button type="submit" aria-label="Zoek in Saloon"><span aria-hidden="true">⌕</span></button>'
      + '<input id="saloonZoekveld" name="zoek" type="search" maxlength="100" placeholder="Wat wilt u ontdekken?">'
      + '<button type="button" data-keuzes aria-label="Uw bronnen en voorkeuren" aria-controls="saloonKeuzes" aria-expanded="false">☷</button></form>'
      + '<nav class="saloon-vormen" aria-label="Weergave"><a href="/apps/living-world.html">Living World</a><button type="button" data-vorm="overzicht">Voor u</button>'
      + '<button type="button" data-dichtbij aria-pressed="false">Dichtbij</button><button type="button" data-vorm="bewaard">Bewaard</button></nav>'
      + '<details class="saloon-keuzes" id="saloonKeuzes"><summary>Mijn bronnen en omgeving</summary>'
      + '<form id="saloonFilters"><label>Plaats<input name="plaats" type="search" maxlength="60" placeholder="Welke plaats wilt u volgen?"></label>'
      + '<p class="saloon-uitleg">Dichtbij zoekt op de plaats die u hier kiest.</p>'
      + '<fieldset><legend>Wat komt samen in uw Saloon?</legend><div id="saloonBronnen"></div></fieldset>'
      + '<p class="saloon-uitleg">Mijn reizen is alleen voor u. U bepaalt uw bronnen en kunt deze keuzes altijd wijzigen.</p>'
      + '<button type="submit">Keuzes toepassen</button></form>'
      + '<div class="saloon-extra"><button type="button" data-vorm="agenda">Agenda</button></div></details>'
      + '<div class="saloon-resultaat"><p id="saloonStatus" role="status" aria-live="polite"></p><button type="button" data-ververs aria-label="Vernieuwen">↻</button></div><div id="saloonBronstatus"></div>';
  };
  w.RTGSaloonEdge = function (acties) {
    var nav = document.querySelector('body > nav.balk');
    var knoppen = Object.keys(acties).map(function (id) {
      var b = document.createElement('button'); b.type = 'button'; b.id = 'saloonEdge' + id;
      b.textContent = acties[id].naam; b.onclick = acties[id].doe; b.hidden = true; nav.appendChild(b);
      return { id: id, knop: b };
    });
    return function (zichtbaar, leest) {
      knoppen.forEach(function (x) { x.knop.hidden = !zichtbaar || (acties[x.id].lezer === true && !leest); });
    };
  };
}(window));
