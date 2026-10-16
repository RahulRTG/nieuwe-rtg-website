/* Alleen de bestaande TravelOS-dossierprojectie voor de Living Module. */
(function (w, d) {
  'use strict';
  function el(tag, cls, text) { var node = d.createElement(tag); if (cls) node.className = cls; if (text != null) node.textContent = text; return node; }
  function button(text, action) { var node = el('button', 'rtg-module-primary', text); node.type = 'button'; node.dataset.rtgTravelAction = action; return node; }
  function empty(options) { return w.RTGWorkspaceEmpty ? w.RTGWorkspaceEmpty(options) : el('p', 'rtg-ss-quiet', options.titel); }
  w.RTGTravelDossierView = function (root, model) {
    var m = model || {}, dossier = m.dossier;
    if (m.suggestion) {
      var card = el('div', 'rtg-module-suggestion'); card.appendChild(el('strong', '', 'Chauffeurdetails ontvangen'));
      card.appendChild(el('p', 'rtg-ss-quiet', m.suggestion.preview || 'Details uit Berichten zijn klaar om aan deze reis toe te voegen.'));
      card.appendChild(button('Toevoegen aan rit', 'attach-driver')); root.appendChild(card);
    }
    if (!dossier) root.appendChild(el('p', 'rtg-ss-quiet', m.dossierLoading ? 'Reisdossier laden…' : 'Open de werklaag om uw reisdossier te laden.'));
    else if (!dossier.reis) root.appendChild(empty({ ey: 'TravelOS', titel: 'Uw reisboek is nog leeg.',
      wat: 'Vertel Rahul wat u voor ogen heeft; hij brengt de eerste keuzes bij elkaar.',
      tekst: 'Plan een reis met Rahul', pad: '/apps/reizen.html#rahul' }));
    else {
      var trip = dossier.reis, summary = el('div', 'rtg-module-summary');
      summary.appendChild(el('strong', '', trip.bestemming || 'Komende reis'));
      if (trip.datums) summary.appendChild(el('span', '', trip.datums));
      if (m.state !== 'peek') summary.appendChild(el('small', '', (Number(dossier.bevestigd) || 0) + ' bevestigd · ' +
        (Array.isArray(dossier.open) ? dossier.open.length : 0) + ' vraagt aandacht'));
      root.appendChild(summary);
    }
    if (m.state === 'peek') { var open = button('Open Travel', 'open'); open.dataset.ssUrl = '/apps/reizen.html#reizen'; root.appendChild(open); }
  };
})(window, document);
