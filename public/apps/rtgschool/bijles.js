/* RTG School (leden), deel 3: Rahul Bijles -- je eigen bijlesleraar, die je
   niveau uit het leerpaspoort kent en geduldig en positief uitlegt. De chat
   loopt via /api/bijles; zonder AI-sleutel antwoordt de vaste demo-uitleg,
   dus het scherm werkt altijd. */
(function () {
  'use strict';

  function teken(beurten) {
    var log = document.getElementById('bijlesLog');
    if (!beurten || !beurten.length) return;
    log.innerHTML = beurten.map(function (b) {
      return '<div class="beurt ' + (b.rol === 'user' ? 'ik' : 'rahul') + '">' + esc(b.tekst) + '</div>';
    }).join('');
    log.scrollTop = log.scrollHeight;
  }

  async function stuur() {
    var inEl = document.getElementById('bijlesIn');
    var t = inEl.value.trim();
    if (!t) return;
    inEl.value = '';
    var log = document.getElementById('bijlesLog');
    if (log.querySelector('.leeg')) log.innerHTML = '';
    log.insertAdjacentHTML('beforeend', '<div class="beurt ik">' + esc(t) + '</div>' +
      '<div class="beurt rahul" data-wacht>Rahul denkt met je mee...</div>');
    log.scrollTop = log.scrollHeight;
    try {
      var d = await api('/api/bijles/vraag', { tekst: t });
      var w = log.querySelector('[data-wacht]');
      if (w) { w.removeAttribute('data-wacht'); w.textContent = d.text; }
      log.scrollTop = log.scrollHeight;
    } catch (e) {
      var w2 = log.querySelector('[data-wacht]');
      if (w2) { w2.removeAttribute('data-wacht'); w2.textContent = e.message; }
    }
  }

  async function start() {
    document.getElementById('bijlesStuur').addEventListener('click', stuur);
    document.getElementById('bijlesIn').addEventListener('keydown', function (e) { if (e.key === 'Enter') stuur(); });
    try { teken((await api('/api/bijles/gesprek')).beurten); } catch (e) {}
  }

  window.RTGSchoolBijles = { start: start };
})();
