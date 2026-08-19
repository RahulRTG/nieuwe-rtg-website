/* RTF Living Lab, scherm deel 8: de deelnemers van een onderzoek.

   Afgesplitst uit ./livinglab-ethiek.js toen die samen over de 10 KB ging; de
   naad zit tussen "mag dit onderzoek mensen benaderen" en "wie doet er mee".

   DE LABPAS WORDT ÉÉN KEER GETOOND, groot, met de waarschuwing erbij. Hij komt
   maar één keer over de lijn (zie kern/livinglab/mensen.js) en is daarna niet
   meer op te vragen. Daarom sluit deze ene handeling het blad NIET: alle andere
   knoppen in het dossier gebruiken doe(), die het blad sluit en herlaadt, en dat
   zou de pas weggooien op het moment dat hij in beeld komt. */
(function () {
  'use strict';
  var api, KADER, esc, meld;

  function init(o) { api = o.api; KADER = o.kader; esc = o.esc; meld = o.meld; }

  var opt = function (lijst, waarde, naam) {
    return lijst.map(function (x) {
      return '<option value="' + esc(x[waarde]) + '">' + esc(x[naam]) + '</option>';
    }).join('');
  };

  function rolNaam(r) {
    var x = KADER.rollen.filter(function (y) { return y.rol === r; })[0];
    return x ? x.naam : r;
  }

  /* ---------- de deelnemers ---------- */
  function mensenBlok(s) {
    var d = s.deelnemers || [];
    var e = s.ethiek || {};
    return '<div class="kaart"><div class="sec">Deelnemers (' + d.length + ')</div>' +
      (d.length
        ? d.slice(0, 40).map(function (p) {
            return '<div class="log" data-alias="' + esc(p.alias) + '"><b>' + esc(p.alias) + '</b> &middot; ' +
              esc(rolNaam(p.rol)) + ' &middot; toestemming: ' + esc(p.toestemming) +
              '<div class="rij h-mt25">' +
                '<select class="veld" data-mrolzet aria-label="Rol wijzigen" style="font-size:.75rem;max-width:12rem;">' +
                  KADER.rollen.map(function (r) {
                    return '<option value="' + esc(r.rol) + '"' + (r.rol === p.rol ? ' selected' : '') + '>' +
                      esc(r.naam) + '</option>';
                  }).join('') + '</select>' +
                '<button class="knop stil" data-mrolknop type="button" style="font-size:.7rem;padding:.15rem .5rem;">Wijzig rol</button>' +
                '<button class="knop stil" data-mweg type="button" style="font-size:.7rem;padding:.15rem .5rem;">terugtrekken</button>' +
              '</div></div>';
          }).join('')
        : '<div class="leeg">Nog niemand. Een deelnemer krijgt een pseudoniem en een eigen labpas; met die pas opent hij zijn onderzoek op /apps/labpas.html.</div>') +
      '<div class="rij h-mt50">' +
        '<select class="veld" data-mrol aria-label="Rol">' + opt(KADER.rollen, 'rol', 'naam') + '</select>' +
        (e.toestemming && e.toestemming.regime !== 'geen'
          ? '<label class="chip"><input type="checkbox" data-mtoe checked> toestemming gegeven</label>' : '') +
        '<label class="chip"><input type="checkbox" data-mminder> minderjarig</label>' +
        (e.toestemming && e.toestemming.ouderlijk ? '<label class="chip"><input type="checkbox" data-mouder> ouderlijk akkoord</label>' : '') +
      '</div>' +
      '<input class="veld h-mt35" data-mpas placeholder="Labpaspoort-code (optioneel; niet bij een gescheiden studie)" maxlength="40">' +
      '<button class="knop h-mt35" data-mbij type="button">Voeg deelnemer toe</button>' +
      '<div data-mnieuw></div></div>';
  }

  function bind(el, s, doe) {
    var q = function (sel) { return el.querySelector(sel); };
    var w = function (sel) { return q(sel) ? q(sel).value : ''; };
    var aan = function (sel) { return !!(q(sel) && q(sel).checked); };

    if (q('[data-mbij]')) q('[data-mbij]').addEventListener('click', function () {
      api('mens/bij', { id: s.id, rol: w('[data-mrol]'), toestemming: aan('[data-mtoe]'),
        minderjarig: aan('[data-mminder]'), ouderlijk: aan('[data-mouder]'), paspoort: w('[data-mpas]') })
        .then(function (r) {
          q('[data-mnieuw]').innerHTML = '<div class="uitdaging h-mt60">' +
            '<div class="sec">Labpas voor ' + esc(r.deelnemer.alias) + '</div>' +
            '<h2 style="font-family:monospace;font-size:1.15rem;">' + esc(r.deelnemer.pas) + '</h2>' +
            '<div class="leeg">Geef deze code aan de deelnemer. Hij komt maar één keer in beeld en is daarna ' +
            'niet meer op te vragen -- noteer hem nu.</div></div>';
          meld('Deelnemer toegevoegd als ' + r.deelnemer.alias + '.');
        }).catch(function (e) { meld(e.message); });
    });
    /* De rol komt uit dezelfde lijst als het kader, en tekenbevoegdheid volgt er
       NIET uit: wie hier "toezichthouder" wordt zonder in het labregister te
       staan, kan nog steeds niets tekenen (kern/livinglab/mensen.js zegt het ook). */
    Array.prototype.forEach.call(el.querySelectorAll('[data-mrolknop]'), function (b) {
      b.addEventListener('click', function () {
        var rij = b.closest('[data-alias]');
        doe(api('mens/rol', { id: s.id, alias: rij.dataset.alias, rol: rij.querySelector('[data-mrolzet]').value }));
      });
    });
    Array.prototype.forEach.call(el.querySelectorAll('[data-mweg]'), function (b) {
      b.addEventListener('click', function () {
        var alias = b.closest('[data-alias]').dataset.alias;
        if (!confirm('Deelnemer ' + alias + ' terugtrekken? Zijn observaties worden gewist.')) return;
        doe(api('mens/weg', { id: s.id, alias: alias }));
      });
    });
  }

  window.LivingLabMensen = { init: init, mensenBlok: mensenBlok, bind: bind };
})();
