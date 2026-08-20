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
    el.innerHTML = '<div style="border:1px solid var(--line,rgba(255,255,255,0.1));border-radius:0;padding:0.8rem 0.95rem;margin-top:0.8rem;">' +
      '<div style="font-size:0.62rem;letter-spacing:0.14em;text-transform:uppercase;color:var(--gold,#A98F1C);">RTG Office</div>' +
      '<div style="font-size:0.72rem;color:var(--soft,rgba(255,255,255,0.55));margin-top:0.2rem;">De team-drive van de zaak: documenten, rekenbladen, presentaties, formulieren, schetsen en borden.</div>' +
      '<button id="pdOfficeOpen" type="button" style="margin-top:0.55rem;width:100%;padding:0.55rem 0.7rem;border-radius:0;border:1px solid var(--line,rgba(255,255,255,0.1));background:none;color:inherit;font:inherit;font-size:0.8rem;cursor:pointer;">Office openen &rarr;</button></div>';
    w.parentNode.insertBefore(el, w.nextSibling);
    el.querySelector('#pdOfficeOpen').addEventListener('click', function () {
      location.href = '/apps/office.html?werk=zaak';
    });
  }
  document.addEventListener('DOMContentLoaded', function () {
    setTimeout(teken, 1500); setTimeout(teken, 6000);
  });
})();
