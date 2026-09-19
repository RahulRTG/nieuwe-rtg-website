/* Eerste acties gebruiken dezelfde galerij en opslag als bestaande beelden. */
(function () {
  'use strict';
  var G = window.RTGGalerij;
  var $ = function (s) { return document.querySelector(s); };
  document.querySelector('main').addEventListener('click', function (e) {
    if (e.target.closest('[data-first-action="photo"]')) $('#eersteFoto').click();
    if (e.target.closest('[data-first-action="album"]')) $('#nieuwAlbum').click();
    if (e.target.closest('[data-first-retry]')) G.laad();
  });
  $('#eersteFoto').addEventListener('change', async function () {
    var file = this.files[0];
    if (!file) return;
    if (!/^image\//.test(file.type)) { G.meld(RTGFirstSteps.value('imageOnly')); this.value = ''; return; }
    var button = document.querySelector('[data-first-action="photo"]');
    if (button) { button.disabled = true; button.setAttribute('aria-busy', 'true'); }
    G.meld(RTGFirstSteps.value('uploading'));
    try {
      var result = await RTGBestandUpload(file, function (pad, body) { return G.api('bestanden/' + pad, body); });
      if (result.status >= 400 || result.body.error) throw new Error(result.body.error || RTGFirstSteps.value('failed'));
      await G.laad(); G.meld(RTGFirstSteps.value('uploaded'));
    } catch (e) { G.meld(e.message); }
    finally {
      this.value = '';
      if (button && button.isConnected) { button.disabled = false; button.removeAttribute('aria-busy'); }
    }
  });
})();
