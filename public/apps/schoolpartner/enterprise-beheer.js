/* RTG School Partner (los deel): rollen, koppelingen en het inzagejournaal.
   Hoort bij enterprise.js, dat de sleutels en de twee opbouw-hulpjes meegeeft
   -- zo staat de vormtaal op een plek en heeft dit deel geen eigen kaartstijl.

   Waarom deze drie bij elkaar staan: het zijn de vragen die een ouder stelt en
   die een schoolsysteem meestal niet kan beantwoorden. Wie mag er bij het
   dossier van mijn kind? Wat gaat er naar buiten, en naar wie? En heeft er
   iemand gekeken? */
(function () {
  'use strict';
  var A = null, sleutels = null, esc = null, meld = null, kaart = null, rij = null, wortel = null;

  function bind(api, sessie, escape, melder, sleutelmaker, opbouw) {
    A = api; esc = escape; meld = melder; sleutels = sleutelmaker;
    kaart = opbouw.kaart; rij = opbouw.rij;
    wortel = document.getElementById('dBeheer');
    if (!wortel) return;
    teken();
  }

  function teken() {
    Promise.all([
      A('/school/rollen', sleutels()), A('/school/koppelingen', sleutels()), A('/school/journaal', sleutels({ limiet: 8 }))
    ]).then(function (r) {
      var rollen = r[0].body, kop = r[1].body, journaal = r[2].body;
      if (rollen.error) { wortel.innerHTML = ''; return; }
      var rolIds = (rollen.rollen || []).map(function (x) { return x.id; }).filter(function (x) { return x !== 'directie'; });
      var h = '<div class="deel">Rollen en rechten</div>';

      h += kaart('Wie mag wat', (rollen.personeel || []).map(function (p) {
        return '<div class="item" style="align-items:flex-start;"><span>' + esc(p.naam) +
          ' <span class="stil">· ' + esc(p.status) + '</span></span>' +
          '<span class="doelkies" data-rolrij="' + esc(p.id) + '">' + rolIds.map(function (id) {
            return '<label><input type="checkbox" value="' + esc(id) + '"' +
              ((p.rollen || []).indexOf(id) >= 0 ? ' checked' : '') + '>' + esc(id) + '</label>';
          }).join('') + '<button class="knop" data-rol="' + esc(p.id) + '" type="button">Bewaar</button></span></div>';
      }).join('') || '<p class="stil">Nog geen personeel.</p>',
      'Zorg, incidenten, geld en personeelszaken hebben elk hun eigen recht. De systeembeheerder beheert de omgeving en komt niet in een dossier.');

      h += '<div class="deel">Koppelingen en journaal</div>';
      h += kaart('Wat gaat er naar buiten', (kop.koppelingen || []).map(function (k) {
        return rij(esc(k.naam), 'deelt: ' + (k.deelt || []).map(esc).join(', '));
      }).join('') || '<p class="stil">Geen koppelingen aan.</p>',
      'Nooit mee, in geen enkele koppeling: ' + (kop.nooit || []).map(esc).join(', ') + '.');

      h += kaart('Laatste inzage', (journaal.rijen || []).map(function (j) {
        return rij(esc(j.wat) + ' <span class="stil">· ' + esc(j.rol) + '</span>',
          esc(j.reden || '') + ' · ' + esc(String(j.at).slice(0, 16).replace('T', ' ')));
      }).join('') || '<p class="stil">Nog niets gelogd.</p>',
      'Het journaal legt vast dát er is gekeken, door wie en waarom -- nooit wat er stond.');

      wortel.innerHTML = h;
      Array.prototype.forEach.call(wortel.querySelectorAll('[data-rol]'), function (b) {
        b.addEventListener('click', function () {
          var vak = wortel.querySelector('[data-rolrij="' + b.dataset.rol + '"]');
          var gekozen = Array.prototype.slice.call(vak.querySelectorAll('input:checked')).map(function (i) { return i.value; });
          A('/school/personeel/rollen', sleutels({ personeelId: b.dataset.rol, rollen: gekozen }))
            .then(function (r2) { meld(r2.body.error || 'Rollen bewaard.'); });
        });
      });
    });
  }

  window.RTGSchoolBeheer = { bind: bind };
})();
