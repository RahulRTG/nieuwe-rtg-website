/* The approved editorial example is never a post or an account activity.
   Its icon buttons explain the real source-owned actions without writing. */
(function (w, d) {
  'use strict';
  var icons = {
    appreciate: '<path d="M12 21S3 15 3 9a4.8 4.8 0 0 1 9-2.5A4.8 4.8 0 0 1 21 9c0 6-9 12-9 12Z"/>',
    reply: '<path d="M21 11.5a9 9 0 0 1-9 9 11 11 0 0 1-4-.8L3 21l1.2-4.6A9 9 0 1 1 21 11.5Z"/>',
    save: '<path d="M6 3h12v18l-6-4-6 4V3Z"/>'
  };
  var labels = { appreciate: 'Hoe werkt waarderen?', reply: 'Hoe werkt reageren?', save: 'Hoe werkt bewaren?' };
  var explanations = {
    appreciate: 'U kunt echte berichten waarderen in De Salon. Dit voorbeeld voegt geen waardering toe.',
    reply: 'Open een echt bericht in De Salon om te reageren. Dit voorbeeld verstuurt geen bericht.',
    save: 'U kunt echte berichten bewaren in De Salon. Dit voorbeeld wordt niet opgeslagen.'
  };
  w.I18N = w.I18N || {};
  w.I18N.en = Object.assign(w.I18N.en || {}, {
    'living.exampleTitle': 'A moment at the table', 'living.example': 'Example moment',
    'living.dinnerTitle': 'Everything tastes better together.',
    'living.dinnerCopy': 'A long evening, with the people who matter.',
    'living.appreciate': 'How does appreciation work?', 'living.reply': 'How do replies work?', 'living.save': 'How does saving work?',
    'living.explain.appreciate': 'You can appreciate real posts in The Salon. This example does not add an appreciation.',
    'living.explain.reply': 'Open a real post in The Salon to reply. This example does not send a message.',
    'living.explain.save': 'You can save real posts in The Salon. This example is not saved.',
    'living.openSalon': 'Explore The Salon', 'living.unavailable': 'Your moments are temporarily unavailable.'
  });
  w.RTGLivingWelcome = function (kind, text) {
    if (kind === 'error') return '<section class="living-load-error" role="status"><h2>'
      + text('unavailable', 'Uw momenten zijn tijdelijk niet beschikbaar.') + '</h2><p>'
      + text('failed', 'Uw momenten konden niet worden geladen. Probeer het opnieuw; uw gegevens blijven bewaard.')
      + '</p><button type="button" data-living-retry>' + text('retry', 'Probeer het opnieuw') + '</button></section>';
    return '<section class="living-welcome" data-example="true" aria-labelledby="livingWelcomeTitle">'
      + '<div class="living-example-photo"><img src="/images/world-homes/living.webp" alt="" width="1122" height="1402" fetchpriority="high">'
      + '<div class="living-example-head"><img src="/images/world-homes/living.webp" alt="" width="40" height="40">'
      + '<div><p>' + text('exampleTitle', 'Een moment aan tafel') + '</p><span>' + text('example', 'Voorbeeldmoment') + '</span></div></div>'
      + '<div class="living-example-copy"><h2 id="livingWelcomeTitle">' + text('dinnerTitle', 'Samen smaakt alles beter.')
      + '</h2><p>' + text('dinnerCopy', 'Een lange avond, met de mensen die ertoe doen.') + '</p></div></div>'
      + '<div class="living-example-actions">' + Object.keys(icons).map(function (key) {
        return '<button type="button" data-living-example="' + key + '" aria-controls="livingExampleNote" aria-expanded="false">'
          + '<svg viewBox="0 0 24 24" aria-hidden="true">' + icons[key] + '</svg><span class="living-sr">' + text(key, labels[key]) + '</span></button>';
      }).join('') + '</div><div class="living-example-note" id="livingExampleNote" hidden><p role="status"></p><p>'
      + text(kind === 'guest' ? 'guest' : 'empty', kind === 'guest'
        ? 'Open uw LivingOS. Hier komen de momenten van uw mensen, reizen en plekken samen.'
        : 'Hier begint uw verhaal. Zodra er berichten voor u zijn, komen ze hier samen, met de nieuwste bovenaan.')
      + '</p><a href="/apps/salon.html">' + text('openSalon', 'Ontdek De Salon') + '</a></div>'
      + '<p class="living-note living-sr">' + text('editorial', 'Sfeerbeeld van RTG. Uw eigen berichten verschijnen hier.') + '</p></section>';
  };
  d.addEventListener('click', function (e) {
    var button = e.target.closest('[data-living-example]');
    if (!button) return;
    var note = d.getElementById('livingExampleNote'), key = button.dataset.livingExample;
    if (!note || !explanations[key]) return;
    var close = button.getAttribute('aria-expanded') === 'true';
    note.hidden = close;
    d.querySelectorAll('[data-living-example]').forEach(function (b) { b.setAttribute('aria-expanded', String(!close && b === button)); });
    note.querySelector('[role="status"]').innerHTML = w.RTGLivingFeed.text('explain.' + key, explanations[key]);
  });
}(window, document));
