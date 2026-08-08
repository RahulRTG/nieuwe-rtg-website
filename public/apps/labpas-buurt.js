/* Mijn Living Lab, deel "buurt": de vragen die bewoners aandragen, en de
   stemmen erop.

   Dit staat OPEN, ook zonder labpas, en dat is het punt. Wie nog nergens aan
   meedoet moet juist kunnen zeggen wat er onderzocht zou moeten worden -- dat is
   de trechter waar een Living Lab uit put. Wie wél een pas heeft, stemt daaronder.

   Afgesplitst uit ./labpas.js toen die de 10 KB passeerde. Hij krijgt zijn
   gereedschap (api, esc, meld) van de hoofdmodule mee in plaats van
   het na te bouwen: twee eigen api()-functies is twee foutafhandelingen die uit
   elkaar gaan lopen, en juist hier moet een 429 een begrijpelijke zin geven. */
(function () {
  'use strict';
  var api, esc, meld, LAB = null;
  var $ = function (s) { return document.querySelector(s); };

  function init(o) {
    api = o.api; esc = o.esc; meld = o.meld;
  }
  function zetLab(id) { LAB = id; }

  /* ---------- de buurt: vragen aandragen en stemmen ----------
     Dit staat OPEN, ook zonder labpas. Wie nog nergens aan meedoet, moet juist
     kunnen zeggen wat er zou moeten worden onderzocht. */
  function laadThemas() {
    if (!LAB) return Promise.resolve();
    return api('bewoner/themas', { labId: LAB }).then(function (d) {
      $('#bLijst').innerHTML = (d.themas || []).slice(0, 15).map(function (t) {
        return '<div class="log" data-t="' + esc(t.id) + '"><b>' + esc(t.vraag) + '</b><br>' +
          t.stemmen + ' stem' + (t.stemmen === 1 ? '' : 'men') +
          (t.studieId ? ' &middot; <span class="pil ok">wordt onderzocht</span>'
            : ' &middot; <button class="knop stil" data-stem type="button" style="font-size:.72rem;padding:.2rem .55rem;">Ik ook</button>') +
          '</div>';
      }).join('') || '<div class="leeg">Nog geen vragen. Dien de eerste in.</div>';
      Array.prototype.forEach.call(document.querySelectorAll('[data-stem]'), function (b) {
        b.addEventListener('click', function () {
          api('bewoner/stem', { id: b.closest('[data-t]').dataset.t, alias: stemNaam() })
            .then(function () { meld('Uw stem is geteld.'); return laadThemas(); })
            .catch(function (e) { meld(e.message); });
        });
      });
    });
  }

  /* Een stem draagt een naam of alias. Wie een labpas heeft, stemt daaronder;
     wie er geen heeft, krijgt een naam die alleen in deze browser bestaat --
     genoeg om dubbel stemmen tegen te gaan, en het is geen identiteit. */
  function stemNaam() {
    var n = '';
    try { n = sessionStorage.getItem('rtg_labstem') || ''; } catch (e) {}
    if (!n) {
      /* Uit de CSPRNG en niet uit Math.random: twee gasten met dezelfde naam
         zijn voor de stemteller ÉÉN gast, en dan slikt hij de tweede stem stil
         in met "u heeft al gestemd". Precies de botsing waar keuringsregel 15
         over gaat. */
      n = window.RTGId ? RTGId('gast') : '';
      try { sessionStorage.setItem('rtg_labstem', n); } catch (e) {}
    }
    return n;
  }

  function stuurVraag(vraag) {
    return api('bewoner/thema', { labId: LAB, vraag: vraag, alias: stemNaam() }).then(laadThemas);
  }

  window.LabpasBuurt = { init: init, zetLab: zetLab, laadThemas: laadThemas, stuurVraag: stuurVraag };
})();
