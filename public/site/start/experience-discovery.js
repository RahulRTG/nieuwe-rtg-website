(function (w, d) {
  'use strict';
  var C = w.RTGExperienceCore;
  var $ = function (id) { return d.getElementById(id); };
  function handoff(s) {
    var base = new URL(d.querySelector('meta[name="rtg-app-base"]').content, d.baseURI);
    var url = new URL('/apps/app.html', base);
    if ($('carryInterests').checked && C.handoff(s)) url.hash = 'rtg-experience=' + C.handoff(s);
    $('createAccount').href = url.href;
  }
  function faq(interests, allFaq) {
    var query = $('faqSearch').value.trim().toLowerCase(), relevant = interests.work ? 'work' : interests.foundation ? 'foundation' : 'algemeen';
    var rows = Array.from(d.querySelectorAll('[data-faq]')), visible = 0;
    rows.forEach(function (row, i) {
      var matches = !query || row.textContent.toLowerCase().includes(query);
      var selected = i < 4 || row.dataset.faq === relevant;
      row.dataset.secondary = String(!selected);
      row.hidden = !matches || (!query && !allFaq && !selected);
      if (!row.hidden) visible++;
    });
    d.body.classList.toggle('faq-all', allFaq || !!query);
    $('faqCount').textContent = visible + ' van ' + rows.length + ' vragen' + (!allFaq && !query ? ' · Via Acties in de Edge kunt u alle vragen tonen.' : '');
    $('faqEmpty').hidden = visible > 0;
  }
  w.RTGExperienceDiscovery = Object.freeze({ faq: faq, handoff: handoff });
}(window, document));
