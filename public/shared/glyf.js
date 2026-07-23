/* RTG Glyfen: één gedeelde, ingetogen lijn-iconenset in huisstijl - de plek van
   de vroegere emoji op de app-tegels. Geen kleur, geen vulling: dunne lijnen in
   currentColor, zodat elke tegel de tekstkleur van zijn omgeving erft en het
   beeld rustig en premium blijft (AP/Rolex-taal, niet speels).

   Gebruik:  var node = RTGGlyf.svg('bellen');   // <svg> of null
             RTGGlyf.heeft('bellen');            // true/false
   Wie geen glyf heeft, valt in de tegel terug op een Bodoni-monogram (25-os).
   Geen afhankelijkheden, geen extern beeld. */
(function () {
  if (window.RTGGlyf) return;
  var NS = 'http://www.w3.org/2000/svg';

  // elk glyf op een 24x24-raster; alleen paden/vormen, de <svg>-jas komt hieronder
  var P = {
    /* --- de telefoon-basis --- */
    bellen: '<path d="M7 4.2c-1 0-1.9.8-1.9 1.9 0 7.6 6.2 13.8 13.8 13.8 1.1 0 1.9-.9 1.9-1.9v-2.3c0-.9-.6-1.6-1.5-1.8l-2.2-.5c-.7-.2-1.5.1-1.9.8l-.5.9c-2.1-1-3.8-2.7-4.8-4.8l.9-.5c.7-.4 1-1.2.8-1.9l-.5-2.2C9.4 4.8 8.7 4.2 7.8 4.2z"/>',
    videobellen: '<rect x="3" y="7" width="12.5" height="10" rx="2.2"/><path d="M15.5 10.6l4.7-2.7c.4-.2.8.1.8.5v7.2c0 .4-.4.7-.8.5l-4.7-2.7"/>',
    snaps: '<rect x="3" y="7.5" width="18" height="12" rx="2.6"/><path d="M8.4 7.5l1.2-2.3h4.8l1.2 2.3"/><circle cx="12" cy="13.4" r="3.1"/>',
    berichten: '<rect x="3" y="5.5" width="18" height="13" rx="2.2"/><path d="M4 7.2l7.1 5.3c.5.4 1.3.4 1.8 0L20 7.2"/>',
    camera: '<circle cx="12" cy="12" r="8.4"/><circle cx="12" cy="12" r="3.3"/><path d="M18.5 6.2l1.4 1.4"/>',
    navigatie: '<circle cx="12" cy="12" r="8.5"/><path d="M15.6 8.4l-2.1 5.1-5.1 2.1 2.1-5.1z"/>',
    muziek: '<path d="M5 13.5v-1.5a7 7 0 0 1 14 0v1.5"/><rect x="3.4" y="13" width="3.6" height="6.2" rx="1.5"/><rect x="17" y="13" width="3.6" height="6.2" rx="1.5"/>',
    rtf: '<path d="M6 18.5C6 11.3 11.3 6 18.5 6c0 7.2-5.3 12.5-12.5 12.5z"/><path d="M9.2 15.3c2-3.1 4.2-4.4 6.4-5.3"/>',
    store: '<path d="M6.4 8.5h11.2l-.9 10.5a1 1 0 0 1-1 .9H8.3a1 1 0 0 1-1-.9z"/><path d="M9.2 8.5V7a2.8 2.8 0 0 1 5.6 0v1.5"/>',

    /* --- media & vermaak --- */
    podium: '<circle cx="12" cy="12" r="2.1"/><path d="M8 8a5.6 5.6 0 0 0 0 8M16 16a5.6 5.6 0 0 0 0-8M5.2 5.2a9.6 9.6 0 0 0 0 13.6M18.8 18.8a9.6 9.6 0 0 0 0-13.6"/>',
    theater: '<rect x="3.5" y="5.5" width="17" height="13" rx="2"/><path d="M8 5.5v13M16 5.5v13M3.5 9h4.5M16 9h4.5M3.5 15h4.5M16 15h4.5"/>',
    clips: '<rect x="6" y="3.5" width="12" height="17" rx="2.6"/><path d="M10.6 9.4l4 2.6-4 2.6z"/>',
    spelen: '<rect x="4" y="4" width="16" height="16" rx="3.6"/><circle cx="9" cy="9" r="1.1"/><circle cx="12" cy="12" r="1.1"/><circle cx="15" cy="15" r="1.1"/>',
    nieuws: '<rect x="4" y="5" width="14" height="14" rx="1.6"/><path d="M18 8.5h2v8.5a2 2 0 0 1-2 2M7 9.2h5M7 12h8M7 14.8h8"/>',
    sport: '<circle cx="12" cy="12" r="8.5"/><path d="M12 6.6l3.7 2.7-1.4 4.4H9.7L8.3 9.3z"/>',
    vonk: '<path d="M12 20S3.8 14.4 3.8 9C3.8 6.2 6 4.3 8.6 4.3c1.5 0 2.8.7 3.4 1.9.6-1.2 1.9-1.9 3.4-1.9 2.6 0 4.8 1.9 4.8 4.7 0 5.4-8.2 11-8.2 11z"/>',
    cercle: '<path d="M4 8.2a2 2 0 0 1 2-2h12a2 2 0 0 1 2 2 2 2 0 0 0 0 4 2 2 0 0 1-2 2H6a2 2 0 0 1-2-2 2 2 0 0 0 0-4z"/><path d="M14 6.5v11" stroke-dasharray="1.4 2"/>',

    /* --- reizen & onderweg --- */
    vluchten: '<path d="M11.2 3.4c.5 0 .9.5.9 1.3v4.7l7.4 4.4v1.8l-7.4-2.2v3.5l2.1 1.5v1.3l-3-.9-3 .9v-1.3l2.1-1.5v-3.5L3 15.6v-1.8l7.3-4.4V4.7c0-.8.4-1.3.9-1.3z"/>',
    ov: '<rect x="4.5" y="4.5" width="15" height="12.5" rx="2.2"/><path d="M4.5 12h15"/><circle cx="8" cy="19" r="1.4"/><circle cx="16" cy="19" r="1.4"/>',
    flits: '<path d="M8.5 20L11 4M15.5 20L13 4"/><path d="M12 6.5v1.6M12 11.2v1.6M12 15.9v1.6"/>',
    stad: '<path d="M4 20h16M7 20V6.2l5-2v15.8M12 20V9l6 2.6V20"/><path d="M9.4 9.5v.01M9.4 12.5v.01M14.6 14v.01M14.6 16.6v.01"/>',
    reisboek: '<rect x="5" y="7.5" width="14" height="12" rx="2.2"/><path d="M9 7.5V6a2 2 0 0 1 2-2h2a2 2 0 0 1 2 2v1.5M9.6 11v5M14.4 11v5"/>',
    logboek: '<circle cx="12" cy="6" r="2"/><path d="M12 8v11M7.5 12h9M6 15a6 6 0 0 0 12 0"/>',

    /* --- huis, tafel & goede leven --- */
    ontdek: '<path d="M12 6.6C10.4 5.4 7.9 4.9 5 5.1v11.8c2.9-.2 5.4.3 7 1.5 1.6-1.2 4.1-1.7 7-1.5V5.1c-2.9-.2-5.4.3-7 1.5z"/><path d="M12 6.6v11.8"/>',
    vrienden: '<path d="M4 6.6A2 2 0 0 1 6 4.6h9.5a2 2 0 0 1 2 2v4.6a2 2 0 0 1-2 2H8.6L4 16.8z"/>',
    entourage: '<circle cx="9" cy="8.8" r="3"/><path d="M3.6 18.6a5.4 5.4 0 0 1 10.8 0M16 6.4a3 3 0 0 1 0 5.8M15.6 18.6a5.4 5.4 0 0 0-.9-3"/>',
    office: '<rect x="5" y="3.5" width="14" height="17" rx="2"/><path d="M8.6 14.5v3M12 11v6.5M15.4 8.5v9"/>',
    wbw: '<path d="M7 4h10l-1 16H8z"/><path d="M9.4 8h5.2M9.4 11h5.2M9.4 14h3.4"/>',
    passkeys: '<circle cx="8" cy="12" r="4"/><path d="M11.7 12H20l-1.8 1.8M15.5 12v2"/>',
    nalatenschap: '<circle cx="8" cy="12" r="4"/><path d="M11.7 12H20l-1.8 1.8M15.5 12v2"/>',
    juridisch: '<path d="M12 4v16M7.5 20h9M5.5 7.5h13M6.2 7.5l-2.4 4.8a2.6 2.6 0 0 0 5 0zM17.8 7.5l-2.4 4.8a2.6 2.6 0 0 0 5 0z"/>',
    cellier: '<path d="M8.2 4h7.6l-.7 5.2a3.3 3.3 0 0 1-6.2 0zM12 12.4v6.2M9 18.6h6"/>',
    table: '<path d="M8 4v16M6 4v4a2 2 0 0 0 4 0V4M16.5 4c-1.6 0-2.6 2.1-2.6 4.7s1 3.6 2.1 3.6h.5v7.7"/>',
    maison: '<path d="M4 9.2l8-4.2 8 4.2M5.4 9.2v8.8M18.6 9.2v8.8M9.2 9.2v8.8M14.8 9.2v8.8M4 20h16"/>',
    garderobe: '<path d="M12 5.6a2 2 0 1 1 1.5 1.9c-.6.2-1 .6-1 1.2v.4l6.9 4.5a1.5 1.5 0 0 1-.8 2.8H5.4a1.5 1.5 0 0 1-.8-2.8l6.9-4.5"/>',
    attenties: '<rect x="4.5" y="9" width="15" height="10.5" rx="1.4"/><path d="M4.5 13h15M12 9v10.5M8.7 9C7.3 9 6.4 7.9 6.4 6.7 6.4 5.5 7.4 4.7 8.4 5.1L12 9M15.3 9c1.4 0 2.3-1.1 2.3-2.3 0-1.2-1-2-2-1.6L12 9"/>',
    rechterhand: '<path d="M8.5 13.5V7.2a2 2 0 0 1 2-2h3a2 2 0 0 1 2 2v6.3M5.5 13.5h13l1.2 4.5a1 1 0 0 1-1 1.3H5.3a1 1 0 0 1-1-1.3z"/>',
    pulse: '<path d="M13 3.2L5.2 13.2c-.3.4 0 1 .5 1H11l-1.8 6.6c-.2.6.6 1 1 .5l7.6-9.9c.3-.4 0-1-.5-1H13.5l1.4-6.7c.1-.6-.6-1-1-.5z"/>',
    balans: '<path d="M12 21V8"/><path d="M12 13c-3.1 0-5.2-2.1-5.2-5.2C9.9 7.8 12 9.9 12 13z"/><path d="M12 10.6c3.1 0 5.2-2.1 5.2-4.2C14.1 6.4 12 7.5 12 10.6z"/>',

    /* --- RTFoundation-leeftijden --- */
    'rtf-mini': '<circle cx="12" cy="13.4" r="5.4"/><circle cx="7.8" cy="8" r="2.1"/><circle cx="16.2" cy="8" r="2.1"/><circle cx="10.4" cy="13" r=".7"/><circle cx="13.6" cy="13" r=".7"/>',
    'rtf-kind': '<rect x="6" y="7" width="12" height="13" rx="3"/><path d="M9 7V6a3 3 0 0 1 6 0v1M9 12h6"/>',
    'rtf-tiener': '<path d="M4.5 13h15"/><circle cx="8.5" cy="16.5" r="1.6"/><circle cx="15.5" cy="16.5" r="1.6"/><path d="M6.5 13l1-1.2M17.5 13l-1-1.2"/>',
    'rtf-jong': '<path d="M12 3.2c3 2 4.6 5 4.6 9.2l-1.5 3.1H8.9l-1.5-3.1C7.4 8.2 9 5.2 12 3.2z"/><circle cx="12" cy="10.2" r="1.7"/><path d="M9 16.5l-1.6 3.3M15 16.5l1.6 3.3"/>',
    'rtf-volw': '<circle cx="12" cy="8" r="3.2"/><path d="M6 20a6 6 0 0 1 12 0"/>',
    werk: '<rect x="4" y="7.5" width="16" height="11" rx="2"/><path d="M9 7.5V6.2a2 2 0 0 1 2-2h2a2 2 0 0 1 2 2v1.3M4 12.5h16"/>',
    mecenaat: '<path d="M12 20.5c-1.6-2.6-4.4-3.9-6-6a3.6 3.6 0 0 1 5.1-5l.9.9.9-.9a3.6 3.6 0 0 1 5.1 5c-1.6 2.1-4.4 3.4-6 6z"/>',
    hangar: '<path d="M4 20V11l8-5 8 5v9M4 20h16M8 20v-5h8v5"/>',
    rendezvous: '<path d="M9.5 18S4 14 4 10.2A3 3 0 0 1 9.3 8.3 3 3 0 0 1 14.6 10c0 3.8-5.1 8-5.1 8z"/><path d="M15 15c2-1.8 4-3.9 4-6.2A2.7 2.7 0 0 0 14.2 7"/>',

    /* --- bedieningspaneel / acties --- */
    thema: '<circle cx="12" cy="12" r="8"/><path d="M12 4a8 8 0 0 0 0 16z"/>',
    meldingen: '<path d="M7 10a5 5 0 0 1 10 0c0 4 1.4 5.5 2 6H5c.6-.5 2-2 2-6z"/><path d="M10.2 19a2 2 0 0 0 3.6 0"/>',
    paneel: '<path d="M5 8h9M17.5 8H19M5 16h2.5M11 16h8"/><circle cx="15.5" cy="8" r="1.8"/><circle cx="9" cy="16" r="1.8"/>',
    taal: '<circle cx="12" cy="12" r="8.5"/><path d="M3.5 12h17M12 3.5c2.4 2.3 3.6 5.3 3.6 8.5S14.4 18.2 12 20.5c-2.4-2.3-3.6-5.3-3.6-8.5S9.6 5.8 12 3.5z"/>',
    push: '<circle cx="12" cy="12" r="2.1"/><path d="M8 8a5.6 5.6 0 0 0 0 8M16 16a5.6 5.6 0 0 0 0-8"/>',
    uitloggen: '<path d="M12 3.5v8"/><path d="M6.6 7A8 8 0 1 0 17.4 7"/>',
    salon: '<path d="M12 20S3.8 14.4 3.8 9C3.8 6.2 6 4.3 8.6 4.3c1.5 0 2.8.7 3.4 1.9.6-1.2 1.9-1.9 3.4-1.9 2.6 0 4.8 1.9 4.8 4.7 0 5.4-8.2 11-8.2 11z"/>',
    betalen: '<rect x="3" y="6" width="18" height="12" rx="2.4"/><path d="M3 10h18M6.5 14.5h4"/>',
    bank: '<path d="M4 9.5l8-5 8 5M5 9.5v8M9 9.5v8M15 9.5v8M19 9.5v8M3.5 20.5h17"/>',
    slot: '<rect x="5" y="10.5" width="14" height="9" rx="2"/><path d="M8 10.5V8a4 4 0 0 1 8 0v2.5"/><circle cx="12" cy="15" r="1.2"/>',
    pas: '<rect x="3" y="5.5" width="18" height="13" rx="2.2"/><path d="M3 9.5h18M6.5 14h5"/><circle cx="16.5" cy="14" r="1.6"/>'
  };

  function svg(naam) {
    var d = P[naam];
    if (!d) return null;
    var el = document.createElementNS(NS, 'svg');
    el.setAttribute('viewBox', '0 0 24 24');
    el.setAttribute('fill', 'none');
    el.setAttribute('stroke', 'currentColor');
    el.setAttribute('stroke-width', '1.4');
    el.setAttribute('stroke-linecap', 'round');
    el.setAttribute('stroke-linejoin', 'round');
    el.setAttribute('aria-hidden', 'true');
    el.setAttribute('class', 'rtg-glyf');
    el.innerHTML = d;
    return el;
  }

  window.RTGGlyf = { svg: svg, heeft: function (n) { return !!P[n]; } };
})();
