/* RTG School Partner: No-Lost-Child -- de keten na de hulplijn.

   De melding zelf staat in hulplijn.js; hier staat wat er daarna gebeurt en
   wat er nog niet gebeurd is: toewijzen, gezien, afspraak, afgerond. Per
   melding de fase, hoe lang hij openstaat, en de volgende stap in gewone taal.

   Twee dingen die dit scherm NIET doet:
   - het beoordeelt niets. Er staat nergens hoe erg iets is; de server weegt de
     tekst niet en dit scherm dus ook niet. Wat er staat gaat over de KETEN;
   - het laat niets vanzelf gebeuren. Toewijzen, afspreken en afronden zijn
     handelingen van een mens, en afronden gaat op naam.

   Zelfde SPart-patroon; app.js roept SPart.opvolging() aan. */
window.SPart = window.SPart || {};
window.SPart.opvolging = function () {
  var P = window.SPart, kl = P.kl, esc = P.esc, meld = P.meld;
  var vak = document.getElementById('opvolgVorm');
  if (!vak) return;

  var WENS = { vandaag: 'liefst vandaag', 'deze-week': 'liefst deze week', 'maakt-niet-uit': 'maakt niet uit wanneer' };
  var WIE = { mentor: 'liefst de mentor', 'iemand-anders': 'liefst iemand anders', 'maakt-niet-uit': 'maakt niet uit met wie' };

  function toon() {
    kl('/school/hulplijn/bewaking').then(function (r) {
      if (r.body.error) { vak.innerHTML = '<p class="stil">' + esc(r.body.error) + '</p>'; return; }
      var m = r.body.meldingen || [];
      vak.innerHTML = (!m.length
        ? '<p class="stil">Er staat niets open. De knop staat altijd op het scherm van elk kind.</p>'
        : m.map(function (x) {
            return '<div class="item" style="align-items:flex-start;"><span>' +
              '<b>' + esc(x.naam) + '</b> ' +
              (x.acuut ? '<span class="tag aan">acuut</span> ' : '') +
              (x.vertrouwelijk ? '<span class="tag">vertrouwelijk</span> ' : '') +
              '<span class="tag">' + esc(x.fase) + '</span>' +
              (x.escaleert ? ' <span class="tag aan">wacht te lang</span>' : '') +
              '<br><span class="stil">' + x.urenOpen + ' uur open' +
              (x.wens ? ' &middot; ' + esc(WENS[x.wens.wanneer] || '') + ', ' + esc(WIE[x.wens.vanWie] || '') : '') + '</span>' +
              (x.wacht ? '<br><span class="stil">' + esc(x.wacht) + '</span>' : '') +
              (x.volgende ? '<br><b>' + esc(x.volgende) + '</b>' : '') + '</span>' +
              '<span class="rij">' +
              (x.fase === 'gevraagd' ? '<button class="knop mini" data-toe="' + esc(x.id) + '" type="button">Toewijzen</button>' : '') +
              (x.fase === 'gezien' ? '<button class="knop mini" data-afs="' + esc(x.id) + '" type="button">Afspraak</button>' : '') +
              (x.fase !== 'afgerond' && x.fase !== 'gevraagd' && x.fase !== 'toegewezen'
                ? '<button class="knop mini" data-af="' + esc(x.id) + '" type="button">Afronden</button>' : '') +
              '</span></div>';
          }).join('')) +
        '<p class="stil">' + esc(r.body.uitleg) + '</p>';
      knoppen();
    });
  }

  function knoppen() {
    vak.querySelectorAll('[data-toe]').forEach(function (b) {
      b.addEventListener('click', function () {
        var wie = window.prompt('Wie kijkt hiernaar? (naam)');
        if (!wie) return;
        kl('/school/hulplijn/toewijzen', { id: b.dataset.toe, mentor: wie })
          .then(function (r) { meld(r.body.error || r.body.volgende); toon(); });
      });
    });
    vak.querySelectorAll('[data-afs]').forEach(function (b) {
      b.addEventListener('click', function () {
        var wanneer = window.prompt('Wanneer? (bijv. morgen na de eerste les)');
        if (!wanneer) return;
        var metWie = window.prompt('Met wie?');
        if (!metWie) return;
        kl('/school/hulplijn/afspraak', { id: b.dataset.afs, wanneer: wanneer, metWie: metWie })
          .then(function (r) { meld(r.body.error || r.body.volgende); toon(); });
      });
    });
    vak.querySelectorAll('[data-af]').forEach(function (b) {
      b.addEventListener('click', function () {
        var door = window.prompt('Uw naam (afronden doet een mens)');
        if (!door) return;
        kl('/school/hulplijn/afronden', { id: b.dataset.af, door: door,
          notitie: window.prompt('Kort: wat is er gebeurd? (mag leeg)') || '' })
          .then(function (r) { meld(r.body.error || r.body.uitleg); toon(); });
      });
    });
  }

  toon();
};
