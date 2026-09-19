/* Editorial first visits. The domain decides whether it is empty and owns every
   action. These pictures are inspiration, never posts, groups or travel stock. */
(function (w) {
  'use strict';
  var esc = function (v) { return String(v).replace(/[&<>"']/g, function (c) {
    return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
  }); };
  var copy = {
    atmosphere: ['Sfeerbeeld', 'Atmosphere image'],
    salon: ['De Salon', 'The Salon'],
    salonTitle: ['Mooie momenten beginnen met u.', 'Beautiful moments begin with you.'],
    salonIntro: ['Dit is uw plek om het leven te delen. Uw eerste foto, verhaal of ontmoeting krijgt hier alle ruimte.', 'This is your place to share life. There is room here for your first photo, story or encounter.'],
    share: ['Deel uw eerste moment', 'Share your first moment'],
    topics: ['Ontdek onderwerpen', 'Explore topics'],
    ownStory: ['Uw eigen verhaal', 'Your own story'],
    yourPosts: ['Wat u deelt, verschijnt hier.', 'What you share will appear here.'],
    groups: ['Genootschappen', 'Communities'],
    groupsTitle: ['Samen krijgt het leven kleur.', 'Together, life becomes more colourful.'],
    groupsIntro: ['U bent nog niet aangesloten bij een genootschap. Vind mensen met wie u iets wilt delen.', 'You have not joined a community yet. Find people you would like to share something with.'],
    together: ['Wat brengt u samen?', 'What brings you together?'],
    dinner: ['Samen eten', 'Dining together'],
    travel: ['Reizen', 'Travel'],
    culture: ['Kunst & cultuur', 'Art & culture'],
    discover: ['Ontdek genootschappen', 'Explore communities'],
    found: ['Richt een genootschap op', 'Start a community'],
    agency: ['Reisbureau', 'Travel agency'],
    travelTitle: ['Waar wilt u naartoe?', 'Where would you like to go?'],
    travelIntro: ['Vertel ons wat u zoekt. Samen geven we uw volgende reis vorm.', 'Tell us what you are looking for. Together, we will shape your next journey.'],
    travelAtmosphere: ['Reisinspiratie · sfeerbeeld', 'Travel inspiration · atmosphere image'],
    rest: ['Tot rust komen', 'Time to unwind'],
    company: ['Samen op pad', 'Travelling together'],
    explore: ['Iets nieuws zien', 'See something new'],
    wish: ['Bespreek uw reiswens', 'Discuss your travel plans'],
    unavailable: ['Er staat op dit moment geen boekbaar aanbod klaar.', 'There are currently no trips available to book.'],
    start: ['Uw reiswens is een goed begin.', 'Your travel plans are a good place to start.'],
    gallery: ['Uw galerij', 'Your gallery'],
    galleryTitle: ['Sommige momenten wilt u bewaren.', 'Some moments are worth keeping.'],
    galleryIntro: ["Uw foto's komen hier samen. Geef herinneringen een plek en maak er uw eigen albums van.", 'Your photos come together here. Give your memories a home and create your own albums.'],
    atmospheres: ['Sfeerbeelden', 'Atmosphere images'],
    photo: ['Voeg uw eerste foto toe', 'Add your first photo'],
    album: ['Maak een album', 'Create an album'],
    privacy: ['U kiest zelf wat u bewaart en deelt.', 'You choose what to keep and share.'],
    login: ['Meld u aan bij RTG', 'Sign in to RTG'],
    guest: ['Meld u aan om uw eigen omgeving te openen.', 'Sign in to open your personal space.'],
    retry: ['Probeer het opnieuw', 'Please try again'],
    uploading: ['Uw foto wordt toegevoegd.', 'Your photo is being added.'],
    uploaded: ['Uw foto is toegevoegd.', 'Your photo has been added.'],
    imageOnly: ['Kies een afbeelding om aan uw galerij toe te voegen.', 'Choose an image to add to your gallery.'],
    failed: ['We konden uw gegevens niet laden. Probeer het opnieuw.', 'We could not load your data. Please try again.']
  };
  w.I18N = w.I18N || {};
  w.I18N.en = w.I18N.en || {};
  Object.keys(copy).forEach(function (key) { w.I18N.en['first.' + key] = copy[key][1]; });
  function text(key) {
    var nl = copy[key][0], value = w.RTGi18n ? w.RTGi18n.t('first.' + key, nl) : nl;
    return '<span data-i18n="first.' + key + '" data-i18n-source="' + esc(nl) + '">' + esc(value) + '</span>';
  }
  function action(key, target, secondary) {
    return '<button type="button" class="first-action' + (secondary ? ' first-secondary' : '')
      + '" data-first-action="' + target + '">' + text(key)
      + (secondary ? '' : '<span class="first-arrow" aria-hidden="true">→</span>') + '</button>';
  }
  function hero(kind, label, title, caption) {
    return '<div class="first-hero"><img class="first-photo" src="/images/first-steps/' + kind
      + '.webp" alt="" width="1024" height="1365" fetchpriority="high">'
      + '<div class="first-heading"><p class="first-eyebrow">' + text(label) + '</p><h1>' + text(title)
      + '</h1></div><p class="first-caption">' + text(caption || 'atmosphere') + '</p></div>';
  }
  function welcome(kind, guest) {
    var content = '', intro = kind === 'genootschappen' ? 'groupsIntro' : kind === 'reisbureau' ? 'travelIntro' : kind === 'galerij' ? 'galleryIntro' : 'salonIntro';
    if (kind === 'salon') content = hero(kind, 'salon', 'salonTitle');
    if (kind === 'genootschappen') content = hero(kind, 'groups', 'groupsTitle');
    if (kind === 'reisbureau') content = hero(kind, 'agency', 'travelTitle', 'travelAtmosphere');
    if (kind === 'galerij') content = '<div class="first-heading"><p class="first-eyebrow">' + text('gallery')
      + '</p><h1>' + text('galleryTitle') + '</h1></div><figure class="first-memories">'
      + '<img src="/images/first-steps/galerij.webp" alt="" width="1365" height="1024" fetchpriority="high">'
      + '<figcaption>' + text('atmospheres') + '</figcaption></figure>';
    content += '<div class="first-copy"><p class="first-intro">' + text(guest ? 'guest' : intro) + '</p>';
    if (guest) content += '<a class="first-action" href="/apps/app.html">' + text('login') + '<span aria-hidden="true">→</span></a>';
    else if (kind === 'salon') content += action('share', 'share') + action('topics', 'topics', true)
      + '<div class="first-note"><p class="first-eyebrow">' + text('ownStory') + '</p><p class="first-closing">' + text('yourPosts') + '</p></div>';
    else if (kind === 'genootschappen') {
      content += '<h2 class="first-subheading">' + text('together') + '</h2><div class="first-interests">';
      [['dinner', '/images/first-steps/salon.webp'], ['travel', '/images/first-steps/reisbureau.webp'], ['culture', '/images/first-steps/cultuur.webp']].forEach(function (item) {
        content += '<button type="button" data-first-interest="' + item[0] + '"><img src="' + item[1]
          + '" alt="" width="160" height="160" loading="lazy">' + text(item[0]) + '</button>';
      });
      content += '</div>' + action('discover', 'discover') + action('found', 'found', true);
    } else if (kind === 'reisbureau') content += '<div class="first-preferences">'
      + ['rest', 'company', 'explore'].map(function (key) { return '<button type="button" aria-pressed="false" data-first-preference="' + key + '">' + text(key) + '</button>'; }).join('')
      + '</div>' + action('wish', 'wish') + '<div class="first-note"><p>' + text('unavailable') + '</p><p>' + text('start') + '</p></div>';
    else content += action('photo', 'photo')
      + action('album', 'album', true) + '<p class="first-privacy">' + text('privacy') + '</p>';
    return '<section class="rtg-first-steps first-' + kind + '">' + content + '</div></section>';
  }
  function sync() {
    w.document.body.classList.toggle('rtg-first-page', !!w.document.querySelector('main .rtg-first-steps'));
  }
  function value(key) { return w.RTGi18n ? w.RTGi18n.t('first.' + key, copy[key][0]) : copy[key][0]; }
  w.RTGFirstSteps = { welcome: welcome, sync: sync, text: text, value: value };
})(window);
