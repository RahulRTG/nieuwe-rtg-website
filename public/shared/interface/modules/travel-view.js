/* De DOM-projectie van de Travel Living Module. Controller, acties, rechten en
   transport blijven bij de bestaande module en Workspace Runtime. */
(function (w, d) {
  'use strict';
  function el(tag, cls, tekst) { var n = d.createElement(tag); if (cls) n.className = cls; if (tekst != null) n.textContent = tekst; return n; }
  function button(tekst, actie, cls) { var b = el('button', cls || 'rtg-module-primary', tekst); b.type = 'button'; b.dataset.rtgTravelAction = actie; return b; }
  function geld(n) { return new Intl.NumberFormat(d.documentElement.lang || undefined,
    { style: 'currency', currency: 'EUR', maximumFractionDigits: 0 }).format(Number(n) || 0); }
  function status(tekst, toon) {
    var p = el('p', 'rtg-travel-request-status' + (toon ? ' is-' + toon : ''), tekst);
    p.setAttribute('role', 'status'); p.setAttribute('aria-live', 'polite'); return p;
  }
  function kop(tekst) { return el('h4', 'rtg-travel-request-title', tekst); }
  function terug(tekst, actie) { return button(tekst, actie, 'rtg-travel-request-secondary'); }
  function leeg(o) { return w.RTGWorkspaceEmpty ? w.RTGWorkspaceEmpty(o) : el('p', 'rtg-ss-quiet', o.titel); }
  function renderDossier(root, model) {
    var m = model || {}, dossier = m.dossier;
    if (m.suggestion) {
      var card = el('div', 'rtg-module-suggestion'); card.appendChild(el('strong', '', 'Chauffeurdetails ontvangen'));
      card.appendChild(el('p', 'rtg-ss-quiet', m.suggestion.preview || 'Details uit Berichten zijn klaar om aan deze reis toe te voegen.'));
      card.appendChild(button('Toevoegen aan rit', 'attach-driver')); root.appendChild(card);
    }
    if (!dossier) root.appendChild(el('p', 'rtg-ss-quiet', m.dossierLoading ? 'Reisdossier laden…' : 'Open de werklaag om uw reisdossier te laden.'));
    else if (!dossier.reis) root.appendChild(leeg({ ey: 'TravelOS', titel: 'Uw reisboek is nog leeg.',
      wat: 'Vertel Rahul wat u voor ogen heeft; hij brengt de eerste keuzes bij elkaar.',
      tekst: 'Plan een reis met Rahul', pad: '/apps/reizen.html#rahul' }));
    else {
      var r = dossier.reis, kaart = el('div', 'rtg-module-summary'); kaart.appendChild(el('strong', '', r.bestemming || 'Komende reis'));
      if (r.datums) kaart.appendChild(el('span', '', r.datums));
      if (m.state !== 'peek') kaart.appendChild(el('small', '', (Number(dossier.bevestigd) || 0) + ' bevestigd · ' +
        (Array.isArray(dossier.open) ? dossier.open.length : 0) + ' vraagt aandacht'));
      root.appendChild(kaart);
    }
    if (m.state === 'peek') { var open = button('Open Travel', 'open'); open.dataset.ssUrl = '/apps/reizen.html#reizen'; root.appendChild(open); }
  }
  function catalogus(vak, m) {
    vak.appendChild(kop('Nieuwe reisaanvraag'));
    vak.appendChild(el('p', 'rtg-ss-quiet', 'Kies een bestaande TravelOS-reis. Controleren verstuurt nog niets.'));
    if (m.catalogLoading && !m.catalog) { vak.appendChild(status('Het reisaanbod wordt geladen.')); return; }
    if (m.catalogError) {
      vak.appendChild(status(m.catalogError, 'warning'));
      vak.appendChild(button('Open het volledige reisbureau', 'open-flow')); return;
    }
    if (!m.catalog || !m.catalog.length) {
      vak.appendChild(status('Er staat nu geen samengestelde reis klaar. Uw reiswens is niet verstuurd.'));
      vak.appendChild(button('Open TravelOS', 'open')); return;
    }
    var lijst = el('div', 'rtg-travel-catalog');
    m.catalog.forEach(function (reis) {
      var b = button('', 'choose', 'rtg-travel-option'); b.dataset.rtgTravelTrip = reis.id;
      b.appendChild(el('span', 'rtg-travel-option-meta', (reis.bestemming || 'TravelOS') + (reis.dates ? ' · ' + reis.dates : '')));
      b.appendChild(el('strong', '', reis.titel || 'Samengestelde reis'));
      b.appendChild(el('small', '', 'Vanaf ' + geld(reis.prijs) + ' per persoon'));
      lijst.appendChild(b);
    });
    vak.appendChild(lijst);
  }
  function formulier(vak, m) {
    var reis = m.trip, draft = m.draft, result = m.result;
    vak.appendChild(kop(reis.titel || 'Reis aanvragen'));
    vak.appendChild(el('p', 'rtg-travel-request-meta', (reis.bestemming || '') + ' · ' + geld(reis.prijs) + ' per persoon'));
    var velden = el('div', 'rtg-travel-fields');
    var datumLabel = el('label', 'rtg-travel-field'); datumLabel.appendChild(el('span', '', 'Voorkeursdatum'));
    var datum = el('input'); datum.type = 'date'; datum.value = draft.date; datum.min = new Date().toISOString().slice(0, 10);
    datum.dataset.rtgTravelInput = 'date'; datum.disabled = m.busy; datumLabel.appendChild(datum); velden.appendChild(datumLabel);
    var personen = el('div', 'rtg-travel-field'); personen.appendChild(el('span', '', 'Reizigers'));
    var step = el('div', 'rtg-travel-step'); var min = terug('Minder reizigers', 'minus'); min.setAttribute('aria-label', 'Minder reizigers');
    var aantal = el('output', '', String(draft.participants)); aantal.setAttribute('aria-live', 'polite');
    var plus = terug('Meer reizigers', 'plus'); plus.setAttribute('aria-label', 'Meer reizigers');
    min.textContent = '−'; plus.textContent = '+'; min.disabled = plus.disabled = m.busy; step.appendChild(min); step.appendChild(aantal); step.appendChild(plus);
    personen.appendChild(step); velden.appendChild(personen); vak.appendChild(velden);
    var notitieLabel = el('label', 'rtg-travel-field'); notitieLabel.appendChild(el('span', '', 'Wensen (optioneel)'));
    var notitie = el('textarea'); notitie.maxLength = 300; notitie.rows = 3; notitie.value = draft.note;
    notitie.placeholder = 'Bijzondere wensen voor uw reisadviseur'; notitie.dataset.rtgTravelInput = 'note'; notitie.disabled = m.busy;
    notitieLabel.appendChild(notitie); vak.appendChild(notitieLabel);
    vak.appendChild(el('p', 'rtg-travel-total', 'Richtprijs: ' + geld((Number(reis.prijs) || 0) * draft.participants) +
      ' voor ' + draft.participants + ' reiziger' + (draft.participants === 1 ? '' : 's')));
    if (result && result.type === 'rejected') vak.appendChild(status((result.sent ? 'Aanvraag geweigerd. ' : 'Niet verstuurd. ') +
      ((result.error && result.error.message) || 'Controleer uw invoer.'), 'warning'));
    var acties = el('div', 'rtg-travel-request-actions'); acties.appendChild(terug('Andere reis', 'back-catalog'));
    var review = button('Controleer uw aanvraag', 'review'); review.disabled = m.busy; acties.appendChild(review); vak.appendChild(acties);
    vak.appendChild(terug('Ga verder in het volledige reisbureau', 'open-flow'));
  }
  function review(vak, m) {
    var aanvraag = w.RTGTravelRequestController.requestFor(m.trip, m.draft);
    vak.appendChild(kop('Controleer uw aanvraag'));
    vak.appendChild(status(m.trip.titel + ' · ' + (aanvraag.vertrek || 'Datum in overleg') + ' · ' + aanvraag.personen +
      ' reizigers. Het RTG-reisbureau ontvangt uw aanvraag en eventuele wensen. Er wordt nu niets betaald of definitief geboekt.'));
    if (m.result && m.result.type === 'existing') vak.appendChild(status('Voor deze reis staat al een aanvraag open (' +
      m.result.application.ref + '). Uw invoer is niet opnieuw verstuurd.', 'warning'));
    var acties = el('div', 'rtg-travel-request-actions'); acties.appendChild(terug('Terug naar invoer', 'edit'));
    var submit = button(m.busy ? 'Bezig met versturen…' : 'Verstuur deze reisaanvraag', 'submit'); submit.disabled = m.busy;
    acties.appendChild(submit); vak.appendChild(acties); vak.appendChild(terug('Ga verder in het volledige reisbureau', 'open-flow'));
  }
  function onzeker(vak, m) {
    vak.appendChild(kop('Uitkomst nog onbekend'));
    vak.appendChild(status('Controleer eerst bij de bron of uw aanvraag is ontvangen. RTG verstuurt niets automatisch opnieuw.', 'warning'));
    if (m.result && m.result.type === 'unmatched') vak.appendChild(status('Er is geen unieke nieuwe aanvraag teruggevonden. Controleer later opnieuw.'));
    if (m.result && m.result.type === 'check-failed') vak.appendChild(status('Controleren lukt nu niet. Uw invoer blijft in dit actieve paneel staan.', 'warning'));
    var check = button(m.busy ? 'Controleren…' : 'Controleer mijn aanvraag', 'check'); check.disabled = m.busy; vak.appendChild(check);
    vak.appendChild(terug('Bekijk Mijn aanvragen', 'open-flow'));
  }
  function ontvangen(vak, m) {
    var a = m.result && m.result.application || {};
    vak.appendChild(kop('Aanvraag ontvangen'));
    vak.appendChild(status((m.result && m.result.matched ? 'Uw aanvraag is bij de bron teruggevonden. ' : '') +
      'Aangevraagd, nog niet bevestigd.' + (a.ref ? ' Referentie: ' + a.ref + '.' : ''), 'ok'));
    vak.appendChild(button('Bekijk uw reisoverzicht', 'open'));
  }
  function renderRequest(root, model, onInput) {
    var m = model || {}, vak = el('section', 'rtg-travel-request'); vak.setAttribute('aria-label', 'TravelOS reisaanvraag');
    if (!m.controller) {
      vak.appendChild(status('De compacte aanvraag is niet beschikbaar. Gebruik het volledige reisbureau.', 'warning'));
      vak.appendChild(button('Open het volledige reisbureau', 'open-flow')); root.appendChild(vak); return vak;
    }
    if (!m.trip) catalogus(vak, m);
    else if (m.phase === 'review') review(vak, m);
    else if (m.phase === 'uncertain') onzeker(vak, m);
    else if (m.phase === 'received') ontvangen(vak, m);
    else formulier(vak, m);
    root.appendChild(vak);
    var date = vak.querySelector('[data-rtg-travel-input="date"]'); if (date) date.addEventListener('input', function () { onInput('date', date.value); });
    var note = vak.querySelector('[data-rtg-travel-input="note"]'); if (note) note.addEventListener('input', function () { onInput('note', note.value); });
    return vak;
  }
  var api = { renderDossier: renderDossier, renderRequest: renderRequest };
  w.RTGTravelView = Object.freeze ? Object.freeze(api) : api;
})(window, document);
