/* DE ONDERDELEN VAN TRAVELOS, op hun eigen huis (WERELDEN.md).

   Stond als inline script in reizen.html. Twee rustige lijsten: de reiswereld
   (wat er in TravelOS bestaat, met een zin uitleg) en de reisdiensten bij het
   register. Alleen verwijzingen: het werk gebeurt in de app zelf. Een eigen
   iconenset op een 24-raster en een lijndikte; geen emoji. */
(function (w, d) {
  'use strict';
  var R = w.RTGReizen; if (!R) return;
  var esc = function (s) { return String(s == null ? '' : s).replace(/[&<>"']/g,
    function (c) { return ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]; }); };
  var ICO = {
    pand: '<rect x="4" y="2" width="16" height="20" rx="1"/><path d="M9 22v-4h6v4M8 6h.01M12 6h.01M16 6h.01M8 10h.01M12 10h.01M16 10h.01"/>',
    bed: '<path d="M2 4v16M2 8h18a2 2 0 0 1 2 2v10M2 17h20"/><circle cx="7" cy="12" r="2"/>',
    vlieg: '<path d="m3 13 18-8-7 7-2 7-2-5-7-1Z"/>',
    kaart: '<path d="M2 9a3 3 0 0 1 0 6v2a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2v-2a3 3 0 0 1 0-6V7a2 2 0 0 0-2-2H4a2 2 0 0 0-2 2Z"/><path d="M13 5v14"/>',
    bus: '<rect x="4.5" y="4.5" width="15" height="12.5" rx="2.2"/><path d="M4.5 12h15"/><circle cx="8" cy="19" r="1.4"/><circle cx="16" cy="19" r="1.4"/>',
    pijl: '<path d="M12 21s7-6.3 7-11a7 7 0 1 0-14 0c0 4.7 7 11 7 11Z"/><circle cx="12" cy="10" r="2.5"/>',
    weg: '<path d="M8.5 20 11 4M15.5 20 13 4M12 6.5v1.6M12 11.2v1.6M12 15.9v1.6"/>',
    stad: '<path d="M4 20h16M7 20V6.2l5-2v15.8M12 20V9l6 2.6V20"/>',
    koffer: '<rect x="5" y="7.5" width="14" height="12" rx="2.2"/><path d="M9 7.5V6a2 2 0 0 1 2-2h2a2 2 0 0 1 2 2v1.5"/>',
    boek: '<path d="M4 5a3 3 0 0 1 3-2h5v18H7a3 3 0 0 0-3 2V5Zm8-2h5a3 3 0 0 1 3 2v18a3 3 0 0 0-3-2h-5V3Z"/>',
    stuur: '<circle cx="12" cy="12" r="8.5"/><circle cx="12" cy="12" r="2"/><path d="M3.5 12H10m4 0h6.5M12 14v6.5"/>'
  };
  var WERELD = [
    ['Reizen & Veilig', 'Planning, vervoer en Live Circle', '/apps/reizen-veilig.html', ICO.pijl],
    ['Vluchten', 'Boeken, beheren, inchecken', '/apps/vluchten.html', ICO.kaart],
    ['Reisbureau', 'Reizen met ledenprijzen', '/apps/reisbureau.html', ICO.vlieg],
    ['Verblijven', 'Hotels, appart. en villa’s', '/apps/hotels.html', ICO.bed],
    ['Residentie', 'Uw eigen adressen onderweg', '/apps/residentie.html', ICO.pand],
    ['OV', 'Openbaar en prive vervoer', '/apps/ov.html', ICO.bus],
    ['Navigatie', 'De route, tot aan de deur', '/apps/navigatie.html', ICO.pijl],
    ['Verkeer', 'Wat er onderweg speelt', '/apps/flits.html', ICO.weg],
    ['Stad', 'Wat er is waar u bent', '/apps/stad.html', ICO.stad],
    ['Reisboek', 'Uw reizen, bij elkaar', '/apps/reisboek.html', ICO.koffer],
    ['Hangar', 'Charter en eigen toestel', '/apps/hangar.html', ICO.vlieg]
  ];
  var DIENSTEN = [
    ['Vluchten', 'Boeken en inchecken', '/apps/vluchten.html', ICO.vlieg],
    ['Verblijven', 'Hotels en villa’s', '/apps/hotels.html', ICO.bed],
    ['Reisbureau', 'Persoonlijke planning', '/apps/reisbureau.html', ICO.koffer],
    ['Mobiliteit', 'OV, pendel en combinaties', '/apps/ov.html', ICO.bus],
    ['Navigatie', 'Route en live kaart', '/apps/navigatie.html', ICO.pijl],
    ['Reisboek', 'Documenten en draaiboek', '/apps/reisboek.html', ICO.kaart],
    ['Private mobility', 'Toestellen en vluchtlogboek', '/apps/hangar.html', ICO.pand],
    ['Boeken', 'Lezen voor onderweg', '/apps/boeken.html', ICO.boek],
    ['Chauffeur-PDA', 'Veilige werkplek voor rijders', '/apps/chauffeur.html', ICO.stuur]
  ];
  function rijen(lijst) {
    return lijst.map(function (x) {
      return '<li><a class="ds-lijst__rij" href="' + esc(x[2]) + '"><svg class="ds-lijst__icoon" viewBox="0 0 24 24" aria-hidden="true" fill="none" ' +
        'stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round">' + x[3] + '</svg><span><span class="ds-lijst__titel">' +
        esc(x[0]) + '</span><span class="ds-lijst__tekst">' + esc(x[1]) + '</span></span><span aria-hidden="true">›</span></a></li>';
    }).join('');
  }
  var poorten = d.getElementById('poorten'), diensten = d.getElementById('reisdiensten');
  if (poorten) poorten.innerHTML = rijen(WERELD);
  if (diensten) diensten.innerHTML = rijen(DIENSTEN);
})(window, document);
