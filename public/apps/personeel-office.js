/* RTG Office vanaf de PDA: een kaart onder Hulp & zaken die de team-drive
   van de zaak opent. Zelfde standalone-patroon als hr-mijn: eigen wortel
   naast #hulpWrap, verschijnt alleen met een geldige PDA-sessie. De
   office-app zelf accepteert het PDA-token als terugvalsleutel. */
(function () {
  'use strict';
  function token() {
    try { return localStorage.getItem('rtg_pda_token'); } catch (e) { return null; }
  }
  function teken() {
    var w = document.getElementById('hulpWrap');
    if (!w || !token() || document.getElementById('pdOffice')) return;
    var el = document.createElement('div');
    el.id = 'pdOffice';
    el.innerHTML = '<div class="s-w9iso1">' +
      '<div class="s-12rpel1">RTG Office</div>' +
      '<div class="s-1udpod6">De team-drive van de zaak: documenten, rekenbladen, presentaties, formulieren, schetsen en borden.</div>' +
      '<button id="pdOfficeOpen" type="button" class="s-1e8w6kq">Office openen &rarr;</button></div>';
    w.parentNode.insertBefore(el, w.nextSibling);
    el.querySelector('#pdOfficeOpen').addEventListener('click', function () {
      location.href = '/apps/office.html?werk=zaak';
    });
  }
  document.addEventListener('DOMContentLoaded', function () {
    setTimeout(teken, 1500); setTimeout(teken, 6000);
  });
})();
