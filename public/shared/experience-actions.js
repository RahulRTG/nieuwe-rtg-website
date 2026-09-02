/* De herbruikbare Action- en Evidence-surfaces van het Experience Kernel.
   Dit bestand kent alleen publieke intentmetadata en projections; alle
   beslissingen en mutaties blijven op de server. */
(function (w, d) {
  'use strict';
  if (w.RTGExperienceActions) return;
  function el(tag, cls, text) {
    var node = d.createElement(tag); if (cls) node.className = cls;
    if (text != null) node.textContent = text; return node;
  }
  function lokaleDatum() {
    var x = new Date(); return [x.getFullYear(), String(x.getMonth() + 1).padStart(2, '0'),
      String(x.getDate()).padStart(2, '0')].join('-');
  }
  function geld(value) {
    try { return new Intl.NumberFormat('nl-NL', { style: 'currency',
      currency: value.currency }).format(value.amountMinor / 100); }
    catch (e) { return (value.amountMinor / 100).toFixed(2) + ' ' + value.currency; }
  }
  function statusNaam(status) {
    return ({ PROVEN: 'Bewezen', NOT_RECONCILED: 'Wordt gereconcilieerd',
      PARTIALLY_PROVEN: 'Gedeeltelijk bewezen', DISPUTED: 'Afwijking gevonden',
      FAILED: 'Integriteitscontrole mislukt' })[status] || status;
  }
  function actieNaam(intent) {
    return ({ 'schedule.item.create': 'Afspraak gepland',
      'attention.acknowledge': 'Aandacht bevestigd' })[intent] || 'Actie uitgevoerd';
  }
  function moment(iso) {
    try { return new Intl.DateTimeFormat('nl-NL', { dateStyle: 'medium',
      timeStyle: 'short' }).format(new Date(iso)); } catch (e) { return iso || ''; }
  }

  function planner(root, ctx) {
    if (!(ctx.bootstrap.intents || []).some(function (x) { return x.id === 'schedule.item.create'; })) return;
    var section = el('section', 'xp-quick'), head = el('div', 'xp-section-head');
    var copy = el('div'); copy.appendChild(el('small', '', 'SNELLE ACTIE'));
    copy.appendChild(el('h3', '', 'Plan iets zonder van wereld te wisselen'));
    head.appendChild(copy);
    var open = el('button', 'xp-action', 'Plan afspraak'); open.type = 'button'; head.appendChild(open);
    section.appendChild(head);
    var form = el('form', 'xp-plan'); form.hidden = true;
    var titleLabel = el('label', '', 'Titel'), title = el('input'); title.name = 'title'; title.maxLength = 120;
    title.required = true; titleLabel.appendChild(title); form.appendChild(titleLabel);
    var row = el('div', 'xp-plan-row'), dateLabel = el('label', '', 'Datum'), date = el('input');
    date.type = 'date'; date.name = 'date'; date.required = true; date.value = lokaleDatum(); dateLabel.appendChild(date);
    var timeLabel = el('label', '', 'Tijd'), time = el('input'); time.type = 'time'; time.name = 'time';
    timeLabel.appendChild(time); row.appendChild(dateLabel); row.appendChild(timeLabel); form.appendChild(row);
    var noteLabel = el('label', '', 'Notitie'), note = el('textarea'); note.name = 'note'; note.maxLength = 300;
    note.rows = 2; noteLabel.appendChild(note); form.appendChild(noteLabel);
    var feedback = el('p', 'xp-feedback'); feedback.setAttribute('aria-live', 'polite'); form.appendChild(feedback);
    var actions = el('div', 'xp-plan-actions'), cancel = el('button', 'xp-action', 'Annuleer');
    cancel.type = 'button'; var submit = el('button', 'xp-action xp-primary', 'Controleer planning');
    submit.type = 'submit'; actions.appendChild(cancel); actions.appendChild(submit); form.appendChild(actions);
    section.appendChild(form); root.appendChild(section);
    var pending = null;
    function reset() { pending = null; form.reset(); date.value = lokaleDatum(); feedback.textContent = '';
      submit.textContent = 'Controleer planning'; submit.disabled = false; }
    open.addEventListener('click', function () { form.hidden = !form.hidden; if (!form.hidden) title.focus(); });
    cancel.addEventListener('click', function () { reset(); form.hidden = true; open.focus(); });
    form.addEventListener('submit', function (event) {
      event.preventDefault(); submit.disabled = true;
      if (!pending) {
        ctx.api('intent/preview', { intent: 'schedule.item.create', version: 1,
          world: ctx.bootstrap.currentWorld, contextId: ctx.bootstrap.currentContext.id,
          parameters: { title: title.value, date: date.value, time: time.value, note: note.value }
        }).then(function (response) {
          pending = { previewId: response.preview.id, idempotencyKey: ctx.idem() };
          feedback.textContent = response.preview.confirmation.text + ' Geen betaling of extern bericht.';
          submit.textContent = 'Bevestig en plan'; submit.disabled = false;
        }).catch(function (error) { feedback.textContent = error.message; submit.disabled = false; });
        return;
      }
      feedback.textContent = 'Veilig vastleggen…';
      ctx.api('intent/execute', { previewId: pending.previewId,
        idempotencyKey: pending.idempotencyKey, confirmed: true }).then(function (response) {
        ctx.done('Gepland: ' + response.item.titel + '.');
      }).catch(function (error) { feedback.textContent = error.message; submit.disabled = false; });
    });
  }

  function proofs(root, ctx) {
    var lijst = ctx.bootstrap.projection.view.valueProofs || [];
    if (!lijst.length) return;
    var section = el('section', 'xp-proofs'), head = el('div', 'xp-section-head');
    var copy = el('div'); copy.appendChild(el('small', '', 'WAARDE EN BEWIJS'));
    copy.appendChild(el('h3', '', 'Waar uw waarde werkelijk staat'));
    head.appendChild(copy); section.appendChild(head);
    lijst.forEach(function (proof) {
      var item = el('article', 'xp-proof'); item.dataset.status = proof.status;
      var top = el('div', 'xp-proof-top'), bedrag = el('b', '', geld(proof.requestedValue));
      top.appendChild(bedrag); top.appendChild(el('span', '', statusNaam(proof.status))); item.appendChild(top);
      var parts = el('div', 'xp-proof-parts');
      (proof.components || []).forEach(function (part) {
        parts.appendChild(el('span', '', part.component + ' · ' +
          geld({ amountMinor: part.amountMinor, currency: part.currency }) + ' · ' + part.status));
      });
      item.appendChild(parts);
      var p = proof.proof || {};
      item.appendChild(el('small', 'xp-source', (p.integrity ? 'Integriteit bevestigd' : 'Integriteit niet bevestigd') +
        ' · ' + (p.facts || 0) + ' feiten · ' + (p.ledgerTransactions || 0) + ' ledgertransacties · ' +
        (p.evidenceItems || 0) + ' bewijsstukken'));
      section.appendChild(item);
    });
    root.appendChild(section);
  }

  function actionProofs(root, ctx) {
    var envelope = ctx.actionEvidence || {}, lijst = envelope.evidence || [];
    if (!lijst.length) return;
    var integrity = envelope.integrity || {};
    var section = el('section', 'xp-action-proofs'), head = el('div', 'xp-section-head');
    var copy = el('div'); copy.appendChild(el('small', '', 'ACTIES EN BEWIJS'));
    copy.appendChild(el('h3', '', 'Door RTG vastgelegd'));
    head.appendChild(copy);
    var badge = el('span', 'xp-proof-badge', integrity.valid ? 'Keten geverifieerd' : 'Controle nodig');
    badge.dataset.valid = integrity.valid ? '1' : '0'; head.appendChild(badge); section.appendChild(head);
    lijst.slice().reverse().slice(0, 5).forEach(function (proof) {
      var item = el('article', 'xp-action-proof'), tekst = el('div');
      tekst.appendChild(el('b', '', actieNaam(proof.intent && proof.intent.id)));
      var object = proof.result && proof.result.item;
      tekst.appendChild(el('small', '', (object && object.titel ? object.titel + ' · ' : '') + moment(proof.recordedAt)));
      item.appendChild(tekst);
      item.appendChild(el('code', '', String(proof.hash || '').slice(0, 12)));
      section.appendChild(item);
    });
    root.appendChild(section);
  }

  function render(root, ctx) { planner(root, ctx); proofs(root, ctx); actionProofs(root, ctx); }
  w.RTGExperienceActions = { render: render };
})(window, document);
