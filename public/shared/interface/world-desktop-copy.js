(function (w, d) {
  'use strict';
  var words = {
    people: ['Uw mensen', 'Your people'], library: ['Uw appbibliotheek', 'Your app library'],
    favorites: ['Uw favoriete apps', 'Your favourite apps'], choose: ['Kies uw widgets', 'Choose your widgets'],
    search: ['Zoek een app in deze wereld', 'Find an app in this world'],
    open: ['Open uw gegevens', 'Open your information'], pin: ['Voeg toe aan uw widgets', 'Add to your widgets'],
    unpin: ['Verwijder uit uw widgets', 'Remove from your widgets'],
    empty: ['Er zijn nog geen gesprekken. U kunt zelf een gesprek beginnen.', 'There are no conversations yet. You can start one.'],
    guest: ['Meld u aan om uw eigen gesprekken te bekijken.', 'Sign in to see your conversations.'],
    error: ['Uw gesprekken konden niet worden opgehaald. Probeer het opnieuw.', 'Your conversations could not be loaded. Please try again.'],
    retry: ['Probeer opnieuw', 'Try again'], loading: ['Uw gesprekken worden opgehaald.', 'Your conversations are loading.'],
    messages: ['Bekijk uw gesprekken', 'View your conversations'], friends: ['Vrienden en collega’s', 'Friends and colleagues'],
    family: ['Uw gezin en contacten', 'Your family and contacts'],
    contacts: ['Bekijk uw contacten', 'View your contacts'],
    familySession: ['Uw widgetkeuze blijft op dit geopende gezinsscherm.', 'Your widget selection stays on this open family screen.'],
    familyEmpty: ['Er zijn nog geen contacten voor dit gezinsprofiel.', 'There are no contacts for this family profile yet.'],
    familyGuest: ['Meld u aan met uw gezinsprofiel om uw contacten te bekijken.', 'Sign in with your family profile to see your contacts.'],
    close: ['Sluit deze app', 'Close this app'], collapse: ['Terug naar uw overzicht', 'Back to your overview'],
    frameLoading: ['Uw app wordt geopend.', 'Your app is opening.'],
    frameError: ['Deze app is nog niet geladen. U kunt opnieuw proberen of de app rechtstreeks openen.', 'This app has not loaded. You can retry or open it directly.'],
    direct: ['Open de app rechtstreeks', 'Open the app directly'],
    limit: ['Er staan vier apps open. Sluit eerst een app die u niet meer nodig heeft.', 'Four apps are open. Close an app you no longer need first.'],
    pinLimit: ['U heeft twaalf favoriete widgets gekozen. Verwijder eerst een widget om een andere toe te voegen.', 'You have chosen twelve favourite widgets. Remove a widget before adding another.'],
    readError: ['Uw bewaarde widgets konden niet worden opgehaald. Probeer het opnieuw voordat u uw keuze wijzigt.', 'Your saved widgets could not be loaded. Please retry before changing your selection.'],
    discard: ['U heeft in deze app gegevens ingevuld. Wilt u de app toch sluiten?', 'You have entered information in this app. Do you still want to close it?'],
    noResults: ['Er zijn geen apps gevonden voor deze zoekopdracht.', 'No apps were found for this search.'],
    next: ['Bekijk de volgende apps', 'View the next apps'], previous: ['Bekijk de vorige apps', 'View the previous apps'],
    overview: ['Uw overzicht', 'Your overview'],
    session: ['Uw keuze blijft in deze sessie. Meld u aan om uw widgets te bewaren.', 'Your choice stays in this session. Sign in to save your widgets.'],
    saved: ['Uw widgets zijn bewaard bij uw account.', 'Your widgets have been saved to your account.'],
    defaults: ['Kies uw favoriete widgets. Uw wijzigingen worden bij uw account bewaard.', 'Choose your favourite widgets. Your changes are saved to your account.'],
    greeting: ['Goedendag', 'Welcome'], tagline: ['Eén omgeving. Uw eigen wereld.', 'One environment. Your own world.'],
    saveError: ['Uw keuze is hier zichtbaar, maar kon niet worden bewaard. Probeer het opnieuw.', 'Your choice is visible here but could not be saved. Please try again.'],
    source: ['Open de app voor uw actuele gegevens en beschikbare handelingen.', 'Open the app for your current information and available actions.'],
    free: ['FoundationOS is en blijft 100% gratis.', 'FoundationOS is and will always be 100% free.']
  };
  w.I18N = w.I18N || {}; w.I18N.en = w.I18N.en || {};
  Object.keys(words).forEach(function (k) { w.I18N.en['desktop.' + k] = words[k][1]; });
  function value(k) { return w.RTGi18n ? w.RTGi18n.t('desktop.' + k, words[k][0]) : words[k][0]; }
  function el(tag, cls, text) { var n = d.createElement(tag); if (cls) n.className = cls; if (text != null) n.textContent = text; return n; }
  function copy(n, k) { n.dataset.i18n = 'desktop.' + k; n.dataset.i18nSource = words[k][0]; n.textContent = value(k); return n; }
  function button(k, run, cls) { var b = copy(el('button', cls), k); b.type = 'button'; b.onclick = run; return b; }
  function label(n, k) { n.setAttribute('aria-label', value(k)); return n; }
  function icon(name) {
    var n = el('span', 'wd-icon'); n.setAttribute('aria-hidden', 'true');
    var icons = w.RTGEdgeIcons || {};
    var aliases = { 'calendar-days': 'calendar', 'notebook-pen': 'doc', 'users-round': 'people', 'message-circle': 'mail',
      'shield-check': 'shield', 'wallet-cards': 'money', 'wallet': 'money', 'banknote': 'money', 'folder-open': 'folder', 'files': 'doc',
      'file-text': 'doc', 'plane-takeoff': 'plane', 'map-pin': 'map', 'utensils': 'book', 'shopping-bag': 'brief', 'briefcase-business': 'brief',
      'users': 'people', 'bed-double': 'bed', 'book-open': 'book', 'car-front': 'car', 'route': 'map', 'puzzle': 'grid',
      'pen-tool': 'doc', 'house': 'home', 'hand-heart': 'heart', 'graduation-cap': 'school', 'wrench': 'command', 'video': 'play' };
    name = aliases[name] || name;
    n.innerHTML = '<svg viewBox="0 0 24 24">' + (icons[name] || icons.grid || '') + '</svg>'; return n;
  }
  w.RTGDesktopUI = { el: el, copy: copy, value: value, button: button, label: label, icon: icon };
})(window, document);
