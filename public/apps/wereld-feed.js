/* Projection only: identity, permissions and posts still come from /api/wereld. */
(function (w) {
  'use strict';
  var esc = function (v) { return String(v == null ? '' : v).replace(/[&<>"']/g, function (c) {
    return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
  }); };
  function T(key, nl) { return w.RTGi18n ? w.RTGi18n.t('living.' + key, nl) : nl; }
  function text(key, nl) { return '<span data-i18n="living.' + key + '" data-i18n-source="' + esc(nl) + '">' + esc(w.RTGi18n ? w.RTGi18n.t('living.' + key, nl) : nl) + '</span>'; }
  function photo(src) {
    try {
      var u = new URL(src, w.location.origin);
      return u.protocol === 'https:' || (u.protocol === 'http:' && u.origin === w.location.origin) ? u.href : '';
    } catch (e) { return ''; }
  }
  function welcome(kind) {
    var guest = kind === 'guest', failed = kind === 'error';
    return '<section class="living-welcome" aria-labelledby="livingWelcomeTitle">'
      + '<img src="/images/start/dagdelen/hero-avond.jpg" alt="" width="1536" height="1024" fetchpriority="high">'
      + '<div><p class="living-kicker">LivingOS · ' + text('moments', 'Mensen, plekken en momenten') + '</p>'
      + '<h2 id="livingWelcomeTitle">' + text('welcome', 'Het leven is mooier wanneer u het deelt.') + '</h2></div>'
      + '<div class="living-welcome-copy"><p>'
      + (failed ? text('failed', 'Uw momenten konden niet worden geladen. Probeer het opnieuw; uw gegevens blijven bewaard.')
        : guest ? text('guest', 'Open uw LivingOS. Hier komen de momenten van uw mensen, reizen en plekken samen.')
          : text('empty', 'Hier begint uw verhaal. Zodra er berichten voor u zijn, komen ze hier samen, met de nieuwste bovenaan.'))
      + '</p>' + (failed ? '<button type="button" data-living-retry>' + text('retry', 'Probeer het opnieuw') + '</button>'
        : '<a href="' + (guest ? '/apps/app.html' : '/apps/camera.html') + '">'
          + (guest ? text('login', 'Open uw LivingOS') : text('create', 'Leg uw eerste moment vast')) + '</a>')
      + '<p class="living-note">' + text('editorial', 'Sfeerbeeld van RTG. Uw eigen berichten verschijnen hier.') + '</p></div></section>';
  }
  function item(i, source, time, starts) {
    var image = i.beeld && i.beeld[0], src = image && photo(image.src);
    var details = [i.plaats, starts].filter(Boolean);
    var offer = i.offer;
    var initials = Array.from(String(i.auteur || 'RTG')).slice(0, 2).join('').toUpperCase();
    return '<div class="living-post-head"><span class="living-avatar" aria-hidden="true" translate="no">' + esc(initials) + '</span>'
      + '<div class="living-author"><span class="auteur" data-user-content>' + esc(i.auteur) + '</span>'
      + '<span class="bron">' + esc(source) + '</span></div><time class="tijd" datetime="' + esc(i.at) + '">' + esc(time) + '</time></div>'
      + (src ? '<figure class="living-post-media"><img src="' + esc(src) + '" alt="' + esc(image.alt || '')
        + '" data-user-content loading="lazy" decoding="async">'
        + (i.beeld.length > 1 ? '<figcaption>' + text('morePhotos', 'Open het bericht om alle beelden te bekijken.') + '</figcaption>' : '') + '</figure>' : '')
      + '<div class="living-post-copy">'
      + (details.length ? '<div class="objectregel" data-user-content>' + details.map(function (d) {
        return '<span>' + esc(d) + '</span>'; }).join('') + '</div>' : '')
      + '<p data-user-content>' + esc(i.tekst) + '</p>'
      + (offer ? '<div class="offer"><b data-user-content>' + esc(offer.titel || '') + '</b><span>'
        + (offer.capaciteit != null ? esc(offer.capaciteit) + ' ' + text('available', 'beschikbaar') + ' · ' : '')
        + (offer.geldigTot ? text('until', 'Geldig tot') + ' <span data-user-content>' + esc(offer.geldigTot) + '</span> · ' : '')
        + '<span data-user-content>' + esc(offer.actie || '') + '</span></span></div>' : '') + '</div>'
      + '<div class="acties"><button type="button" data-open="' + esc(i.open) + '">' + text('open', 'Bekijk het bericht') + '</button>'
      + (!i.partner && i.bron !== 'zakelijk' && i.bron !== 'genootschap'
        ? '<button type="button" data-chat="' + esc(i.auteur) + '" data-over="' + esc(i.open) + '">' + text('message', 'Stuur een bericht') + '</button>' : '')
      + '<span class="tel"><span>' + esc(i.likes || 0) + ' ' + text('likes', 'waarderingen') + '</span><span>'
      + esc(i.reacties || 0) + ' ' + text('comments', 'reacties') + '</span></span></div>';
  }
  w.I18N = w.I18N || {};
  w.I18N.en = Object.assign(w.I18N.en || {}, {
    'living.moments': 'People, places and moments', 'living.promise': 'A more meaningful life',
    'living.story': 'Your story', 'living.travel': 'Travel', 'living.table': 'At the table', 'living.friends': 'Friends',
    'living.feed': 'Your moments', 'living.order': 'The newest moments appear first within each group.',
    'living.welcome': 'Life is better when you share it.',
    'living.empty': 'Your story starts here. When there are posts for you, they appear here, with the newest first.',
    'living.guest': 'Open your LivingOS. The moments from your people, journeys and places come together here.',
    'living.failed': 'Your moments could not be loaded. Please try again; your data is safe.',
    'living.retry': 'Please try again', 'living.login': 'Open your LivingOS', 'living.create': 'Capture your first moment',
    'living.editorial': 'An RTG atmosphere image. Your own posts will appear here.',
    'living.morePhotos': 'Open the post to see all the images.', 'living.open': 'View the post',
    'living.available': 'available', 'living.until': 'Valid until', 'living.message': 'Send a message', 'living.likes': 'appreciations', 'living.comments': 'comments'
  });
  Object.assign(w.I18N.en, {
    'living.brand': 'RTG LivingOS', 'living.LivingOS': 'LivingOS', 'living.WorkOS': 'WorkOS',
    'living.TravelOS': 'TravelOS', 'living.FoundationOS': 'FoundationOS',
    'living.worldsLine': 'Four worlds, one foundation', 'living.connected': 'Connected',
    'living.loading': 'Your moments are loading.', 'living.search': 'Search', 'living.passport': 'Member passport',
    'living.home': 'Home', 'living.make': 'Create', 'living.messages': 'Messages', 'living.world': 'World',
    'living.more': 'View more moments', 'living.signedOut': 'You are not signed in.',
    'living.worldNav': 'The four RTG worlds', 'living.storyNav': 'Stories and places to explore',
    'living.worldFilter': 'Choose your world', 'living.intentNav': 'Choose your intention',
    'living.mainNav': 'Main navigation', 'living.searchPlaceholder': 'Search by name, role, sector or skill',
    'living.title': 'RTG LivingOS · Your moments'
  });
  function labels() {
    var values = { worldNav: T('worldNav', 'De vier RTG-werelden'),
      storyNav: T('storyNav', 'Verhalen en snelle ingangen'), worldFilter: T('worldFilter', 'Kies uw wereld'),
      intentNav: T('intentNav', 'Kies uw intentie'), passport: T('passport', 'Member passport'),
      mainNav: T('mainNav', 'Hoofdnavigatie') };
    w.document.querySelectorAll('[data-living-label]').forEach(function (el) {
      el.setAttribute('aria-label', values[el.dataset.livingLabel]);
    });
    var field = w.document.querySelector('[data-living-search]');
    if (field) {
      field.setAttribute('placeholder', T('searchPlaceholder', 'Zoek op naam, functie, sector of vaardigheid'));
      field.setAttribute('aria-label', T('search', 'Zoeken'));
    }
    w.document.title = T('title', 'RTG LivingOS · Uw momenten');
  }
  w.addEventListener('rtglang', labels);
  labels();
  function photoCard(i) { return !i.offer && !i.plaats && !i.begint && i.beeld && i.beeld.length === 1 && photo(i.beeld[0].src) && String(i.tekst || '').length < 220; }
  w.RTGLivingFeed = { welcome: welcome, item: item, text: text, T: T, photoCard: photoCard };
}(window));
