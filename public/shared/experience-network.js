/* Eén samensteller voor alle werelden. De server bepaalt aanbod en beleid;
   deze schil bewaart een zoekbedoeling alleen zolang het paneel open is. */
(function (w, d) {
  'use strict';
  function el(tag, cls, text) {
    var n = d.createElement(tag); if (cls) n.className = cls;
    if (text != null) n.textContent = text; return n;
  }
  function render(root, ctx) {
    var b = ctx.bootstrap, contract = b.network; if (!contract) return;
    var section = el('section', 'xp-quick xp-network'), head = el('div', 'xp-section-head');
    var copy = el('div'); copy.appendChild(el('small', '', 'UW MOGELIJKHEDEN'));
    copy.appendChild(el('h3', '', 'Breng uw plan bij elkaar')); head.appendChild(copy);
    var open = el('button', 'xp-action', 'Stel samen'); open.type = 'button';
    open.setAttribute('aria-expanded', 'false'); head.appendChild(open); section.appendChild(head);
    var form = el('form', 'xp-plan'); form.hidden = true;
    function field(label, name, max) {
      var l = el('label', '', label), i = el('input'); i.name = name; i.maxLength = max;
      l.appendChild(i); form.appendChild(l); return i;
    }
    var title = field('Naam van uw plan', 'network-title', 60); title.required = true;
    var city = field('Plaats (optioneel)', 'network-city', 60);
    var country = field('Landcode (optioneel, bijvoorbeeld IT)', 'network-country', 2);
    country.pattern = '[a-zA-Z]{2}';
    var group = el('fieldset', 'xp-network-needs'); group.appendChild(el('legend', '', 'Welke onderdelen zoekt u? Kies maximaal acht.'));
    var checks = [];
    contract.offerTypes.forEach(function (t) {
      var l = el('label'), input = el('input'); input.type = 'checkbox'; input.value = t.id;
      input.name = 'network-needs'; checks.push(input); l.appendChild(input);
      l.appendChild(d.createTextNode(' ' + t.label)); group.appendChild(l);
    });
    form.appendChild(group);
    var search = el('button', 'xp-action xp-primary', 'Zoek mogelijkheden'); search.type = 'submit'; form.appendChild(search);
    var feedback = el('p', 'xp-feedback'); feedback.setAttribute('role', 'status');
    var results = el('div', 'xp-network-results'), save = el('button', 'xp-action xp-primary', 'Controleer en bewaar');
    save.type = 'button'; save.hidden = true;
    form.appendChild(results); form.appendChild(feedback); form.appendChild(save); section.appendChild(form); root.appendChild(section);
    var choices = new Map(), pending = null, generation = 0, busy = false;
    function clear() { generation++; pending = null; choices.clear(); results.replaceChildren();
      save.hidden = true; save.textContent = 'Controleer en bewaar'; feedback.textContent = ''; }
    form.addEventListener('input', function (e) { if (!results.contains(e.target)) clear(); });
    open.addEventListener('click', function () { form.hidden = !form.hidden;
      open.setAttribute('aria-expanded', String(!form.hidden)); if (!form.hidden) title.focus(); });
    function selected() { return Array.from(choices.values()).map(function (o) { return { id: o.id, revision: o.revision }; }); }
    function show(response) {
      response.proposal.needs.forEach(function (need) {
        var box = el('fieldset'), type = contract.offerTypes.find(function (t) { return t.id === need.type; });
        box.appendChild(el('legend', '', type.label));
        if (!need.options.length) box.appendChild(el('p', '', need.status === 'SOURCE_UNAVAILABLE'
          ? 'De bron is tijdelijk onvolledig. Probeer opnieuw.' : 'Nog geen passend aanbod op deze plaats.'));
        need.options.forEach(function (o) {
          var card = el('article', 'xp-network-card'), label = el('label'), pick = el('input');
          pick.type = 'radio'; pick.name = 'network-choice-' + need.type; pick.value = o.id;
          label.appendChild(pick); label.appendChild(d.createTextNode(' ' + o.title + ' · ' + o.provider.name));
          card.appendChild(label);
          card.appendChild(el('p', '', (o.availability === 'UNKNOWN' ? 'Beschikbaarheid nog te controleren.' :
            'Beschikbaarheid gemeld door de bron.')));
          if (o.price) card.appendChild(el('small', '', (o.price.from ? 'Vanaf ' : '') + o.price.amount + ' ' +
            o.price.currency + ' · ' + o.price.unit));
          else card.appendChild(el('small', '', 'Prijs op aanvraag'));
          pick.addEventListener('change', function () { generation++; choices.set(need.type, o); pending = null;
            save.hidden = false; save.textContent = 'Controleer en bewaar'; });
          var visit = el('button', 'xp-action', 'Bekijk bij aanbieder'); visit.type = 'button';
          visit.addEventListener('click', function () {
            visit.disabled = true;
            ctx.api('network', { world: b.currentWorld, contextId: b.currentContext.id,
              mode: 'handoff', offerId: o.id, revision: o.revision }).then(function (r) {
              w.location.href = r.destination;
            }).catch(function (e) { feedback.textContent = e.message; visit.disabled = false; });
          });
          card.appendChild(visit); box.appendChild(card);
        });
        results.appendChild(box);
      });
      feedback.textContent = (response.completeness.status === 'PARTIAL' ? 'Een deel van het aanbod kon niet worden gecontroleerd. ' : '') +
        'Kies wat u wilt bewaren. U bevestigt gegevens, beschikbaarheid en betaling daarna bij de aanbieder.';
    }
    form.addEventListener('submit', function (e) {
      e.preventDefault(); if (busy) return;
      clear(); var run = generation; busy = true; search.disabled = true; feedback.textContent = 'Mogelijkheden zoeken…';
      ctx.api('network', { world: b.currentWorld, contextId: b.currentContext.id, intent: {
        goal: title.value, city: city.value, country: country.value.toUpperCase(),
        needs: checks.filter(function (i) { return i.checked; }).map(function (i) { return i.value; })
      } }).then(function (r) { if (run === generation) show(r); })
        .catch(function (e) { if (run === generation) feedback.textContent = e.message; })
        .finally(function () { busy = false; search.disabled = false; });
    });
    save.addEventListener('click', function () {
      if (busy) return; busy = true; save.disabled = true; var run = generation;
      var controls = Array.from(form.querySelectorAll('input, button'));
      controls.forEach(function (control) { control.disabled = true; });
      var call = pending ? ctx.api('intent/execute', { previewId: pending.previewId,
        idempotencyKey: pending.key, confirmed: true }) : ctx.api('intent/preview', {
        intent: 'network.plan.save', version: 1, world: b.currentWorld, contextId: b.currentContext.id,
        parameters: { title: title.value, choices: selected() } });
      call.then(function (r) {
        if (run !== generation) return;
        if (r.preview) { pending = { previewId: r.preview.id, key: ctx.idem() };
          feedback.textContent = r.preview.confirmation.text; save.textContent = 'Bevestig en bewaar';
        } else { pending = null; save.hidden = true; feedback.textContent = 'Uw selectie is bewaard in Mijn lijsten.';
          var link = el('a', 'xp-action', 'Open Mijn lijsten'); link.href = r.destination; results.appendChild(link); }
      }).catch(function (e) { feedback.textContent = e.message; })
        .finally(function () { busy = false; controls.forEach(function (control) { control.disabled = false; }); });
    });
  }
  w.RTGExperienceNetwork = { render: render };
})(window, document);
