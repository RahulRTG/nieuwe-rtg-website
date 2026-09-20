(function (w, d) {
  'use strict';
  var C = w.RTGExperienceCore, s = C.state(), currentWorld = 'living', allFaq = false;
  var $ = function (id) { return d.getElementById(id); };
  var E = w.RTGAdaptiveEdge;
  function announce(text) { $('experienceStatus').textContent = text; }
  function go(id) {
    var target = $(id); if (!target) return;
    if (E) E.setState('dock');
    target.setAttribute('tabindex', '-1'); target.focus({ preventScroll: true });
    target.scrollIntoView({ behavior: w.matchMedia('(prefers-reduced-motion: reduce)').matches ? 'instant' : 'smooth', block: 'start' });
    w.history.replaceState(null, '', '#' + id);
  }
  function text(tag, value) { var el = d.createElement(tag); el.textContent = value; return el; }
  function renderProposal() {
    var proposal = w.RTGStorylineStage.paint($('voorstel'), s);
    $('proposalSummary').replaceChildren(text('h3', proposal.title));
    var list = d.createElement('ul'); proposal.rows.forEach(function (r) { list.appendChild(text('li', r.text)); });
    $('proposalSummary').appendChild(list);
    $('exampleReceipt').textContent = s.confirmed ? 'Voorbeeld bevestigd. Er is niets geboekt, betaald, verstuurd of gedeeld.' : 'Deze bevestiging heeft uitsluitend effect in de demonstratie.';
    $('confirmExample').disabled = s.confirmed || proposal.conflict;
    $('confirmExample').textContent = s.confirmed ? 'Voorbeeld bevestigd' : proposal.conflict ? 'Los eerst het voorbeeldconflict op' : 'Bevestig dit voorbeeld';
  }
  function renderPersonal() {
    $('personalWorlds').replaceChildren();
    C.ordered(s).forEach(function (key, i) {
      var a = d.createElement('a'); a.href = '#werelden'; a.dataset.selectWorld = key;
      a.append(text('small', '0' + (i + 1)), text('strong', C.WORLDS[key].name));
      a.setAttribute('aria-label', C.WORLDS[key].name + ': ' + C.WORLDS[key].description); $('personalWorlds').appendChild(a);
    });
    var keys = Object.keys(s.interests); $('personalReasons').replaceChildren();
    if (!keys.length) $('personalReasons').appendChild(text('li', 'U heeft nog geen voorkeur aangegeven.'));
    keys.forEach(function (key) { $('personalReasons').appendChild(text('li', 'U koos een situatie of wereld binnen ' + C.WORLDS[key].name + '.')); });
    $('personalSummary').textContent = keys.length ? 'U verkende ' + keys.map(function (k) { return C.WORLDS[k].name; }).join(' en ') + '. Daarom staan die werelden vooraan. Alles blijft bereikbaar.' : 'Ontdek een situatie hierboven. De wereld die daarbij hoort krijgt hier een plek vooraan.';
    $('handoffSummary').textContent = keys.length ? 'Gekozen werelden: ' + keys.map(function (k) { return C.WORLDS[k].name; }).join(', ') + '. Vrije invoer en voorbeeldgegevens gaan nooit mee.' : 'Er zijn nog geen gekozen werelden. Vrije invoer en voorbeeldgegevens gaan nooit mee.';
    $('carryInterests').disabled = !keys.length; updateHandoff(); renderFaq();
  }
  function updateHandoff() { w.RTGExperienceDiscovery.handoff(s); }
  function choose(id, navigate) {
    if (!C.choose(s, id)) return;
    d.querySelectorAll('[name="scenario"]').forEach(function (r) { r.checked = r.value === id; });
    renderProposal(); renderPersonal();
    if (navigate) go('moment');
  }
  function world(key, navigate) {
    if (!Object.hasOwn(C.WORLDS, key)) return;
    currentWorld = key; C.interest(s, key); renderWorld(); renderPersonal();
    if (navigate) go('werelden');
  }
  function renderWorld() {
    d.querySelectorAll('[data-room]').forEach(function (room) { room.hidden = room.dataset.room !== currentWorld; });
    var index = Object.keys(C.WORLDS).indexOf(currentWorld);
    $('worldPosition').textContent = '0' + (index + 1) + ' / 04 ' + C.WORLDS[currentWorld].name;
    if ($('werelden').getBoundingClientRect().top < innerHeight && $('werelden').getBoundingClientRect().bottom > 0) d.body.dataset.rtgWorld = currentWorld;
  }
  function permissions() {
    [['calendar', 'allowCalendar'], ['work', 'allowWork'], ['location', 'allowLocation']].forEach(function (row) { C.permission(s, row[0], $(row[1]).checked); });
    var labels = { calendar: 'agenda', work: 'werktijden', location: 'vertrekplek' };
    var granted = Object.keys(labels).filter(function (key) { return s.permissions[key]; }).map(function (key) { return labels[key]; });
    var denied = Object.keys(labels).filter(function (key) { return !s.permissions[key]; }).map(function (key) { return labels[key]; });
    $('permissionResult').textContent = (granted.length ? 'In het voorbeeld bruikbaar: ' + granted.join(', ') + '. ' : 'Er wordt geen voorbeeldinformatie meegenomen. ') + (denied.length ? 'Niet gecontroleerd of gebruikt: ' + denied.join(', ') + '. U ziet deze open vragen ook terug in het voorstel.' : 'Betalen en boeken blijven uitgeschakeld.');
    renderProposal();
  }
  function renderFaq() { w.RTGExperienceDiscovery.faq(s.interests, allFaq); }
  function reset() {
    s = C.state(); currentWorld = 'living'; allFaq = false;
    $('intent').value = ''; $('faqSearch').value = ''; $('carryInterests').checked = false;
    $('accessGoal').value = 'explore'; $('accessGoal').dispatchEvent(new Event('change'));
    ['allowCalendar', 'allowWork', 'allowLocation'].forEach(function (id) { $(id).checked = true; });
    $('intentFeedback').textContent = 'Uw verkenning is gereset. Probeer een reis, etentje, werkdag of gezinsmoment.';
    d.querySelectorAll('details').forEach(function (el) { el.open = false; });
    d.querySelector('[name="scenario"][value="travel"]').checked = true;
    renderProposal(); renderPersonal(); renderWorld(); permissions();
    if (E) E.setState('dock'); announce('Uw verkenning is volledig gereset.');
  }
  d.addEventListener('click', function (event) {
    var el = event.target.closest('[data-go],[data-select-world],[data-reset],[data-all-questions]'); if (!el) return;
    event.preventDefault();
    if (el.hasAttribute('data-all-questions')) { allFaq = true; renderFaq(); go('vragen'); }
    else if (el.hasAttribute('data-reset')) reset();
    else if (el.dataset.selectWorld) world(el.dataset.selectWorld, true);
    else go(el.dataset.go);
  });
  d.querySelectorAll('[name="scenario"]').forEach(function (r) { r.addEventListener('change', function () { choose(r.value, false); }); });
  $('demoOption').addEventListener('change', function () { C.option(s, this.value); renderProposal(); });
  ['allowCalendar', 'allowWork', 'allowLocation'].forEach(function (id) { $(id).addEventListener('change', permissions); });
  $('carryInterests').addEventListener('change', updateHandoff);
  $('faqSearch').addEventListener('input', renderFaq);
  $('intentForm').addEventListener('submit', function (e) {
    e.preventDefault(); var scenario = C.recognise($('intent').value);
    if (!scenario) { $('intentFeedback').textContent = 'Kies voor deze demonstratie een reis, etentje, werkdag of gezinsmoment. Er is niets verstuurd.'; return; }
    choose(scenario, false);
    $('intentFeedback').textContent = 'Uw wens past bij het voorbeeld "' + C.SCENARIOS[scenario].title + '". In de Playground staat nu dat voorstel. U kunt het via de Edge bekijken en veranderen.';
    announce('Het voorbeeldvoorstel is aangepast.');
  });
  $('confirmExample').addEventListener('click', function () { if (C.proposal(s).conflict) return; s.confirmed = true; renderProposal(); });
  $('accessGoal').addEventListener('change', function () {
    var messages = { explore: 'Begin met de kosteloze Community of FoundationOS. Vergelijk rustig de mogelijkheden.', personal: 'Voor het persoonlijke platform kunt u de RTG Pass bekijken. FoundationOS blijft ook voor uw gezin 100% gratis.', business: 'Bekijk Business Lite voor een compacte zakelijke basis, of Business voor uw organisatie. Vergelijk de inrichting en afspraken.', service: 'Lifestyle voegt persoonlijke uitvoering toe. Bespreek eerst welke dienstverlening en afspraken bij uw situatie passen.' };
    $('passSuggestion').textContent = messages[this.value] || messages.explore;
  });
  var touch = null;
  $('worldStage').addEventListener('pointerdown', function (e) { touch = { x: e.clientX, y: e.clientY }; });
  $('worldStage').addEventListener('pointerup', function (e) { if (!touch) return; var dx = e.clientX - touch.x, dy = e.clientY - touch.y; touch = null; if (Math.abs(dx) > 60 && Math.abs(dx) > Math.abs(dy) * 1.5) nextWorld(dx < 0 ? 1 : -1); });
  $('worldStage').addEventListener('pointercancel', function () { touch = null; });
  function nextWorld(delta) { var keys = Object.keys(C.WORLDS); world(keys[(keys.indexOf(currentWorld) + delta + keys.length) % keys.length], false); }
  renderProposal(); renderPersonal(); renderWorld(); d.body.classList.add('experience-ready');
  w.RTGExperience = { go: go, choose: choose, world: world, nextWorld: nextWorld, reset: reset,
    allQuestions: function () { allFaq = true; renderFaq(); go('vragen'); },
    explain: function () { $('personalWhy').open = true; go('uw-rtg'); },
    proposal: function () { renderProposal(); E.openPanel($('summaryPanel'), { title: 'Uw voorbeeldvoorstel', copy: 'Alles blijft binnen deze demonstratie.' }); },
    currentWorld: function () { return currentWorld; }
  };
}(window, document));
