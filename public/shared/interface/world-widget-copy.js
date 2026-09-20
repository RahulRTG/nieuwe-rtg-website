(function (w) {
  'use strict';
  var words = {
    loading: ['Uw gegevens worden opgehaald.', 'Your information is loading.'],
    guest: ['Meld u aan om uw eigen overzicht te zien.', 'Sign in to see your own overview.'],
    locked: ['Deze gegevens zijn niet beschikbaar met uw huidige toegang. Open de app voor uitleg.', 'This information is not available with your current access. Open the app for details.'],
    error: ['Uw gegevens konden niet worden opgehaald.', 'Your information could not be loaded.'],
    partial: ['Een deel van de bronnen is niet beschikbaar. Dit overzicht is onvolledig.', 'Some sources are unavailable. This overview is incomplete.'],
    empty: ['Hier staat nog niets. Open de app om te beginnen.', 'There is nothing here yet. Open the app to get started.'],
    calendarEmpty: ['Er staan geen afspraken in deze zeven dagen.', 'There are no appointments in these seven days.'],
    'protection.normaal': ['Uw account gebruikt de normale toegangsregels.', 'Your account uses the normal access rules.'],
    'protection.waakzaam': ['Extra toezicht op uw account is actief.', 'Additional monitoring is active for your account.'],
    'protection.beperkt': ['Een deel van uw accountfuncties is beperkt.', 'Some of your account functions are restricted.'],
    'protection.beschermd': ['Geld, bevoegdheden en nieuwe koppelingen zijn vergrendeld.', 'Money, permissions and new connections are locked.'],
    'protection.isolatie': ['Uw account is in isolatie gezet.', 'Your account has been isolated.'],
    notesEmpty: ['Maak ruimte voor uw volgende idee of taak.', 'Make room for your next idea or task.'],
    tripEmpty: ['Uw volgende reis begint met een idee.', 'Your next journey starts with an idea.'],
    filesEmpty: ['Uw documenten krijgen hier een eigen plek.', 'Your documents have a place here.'],
    retry: ['Probeer opnieuw', 'Try again'], open: ['Open de app', 'Open the app'],
    calendar: ['Open uw agenda', 'Open your calendar'], next: ['Een week vooruit', 'Next week'], previous: ['Een week terug', 'Previous week'],
    tasks: ['Bekijk al uw taken', 'View all your tasks'], taskError: ['Deze wijziging is niet bevestigd. Controleer de taak opnieuw.', 'This change is not confirmed. Check the task again.'],
    trip: ['Bekijk uw reis', 'View your journey'], restaurants: ['Bekijk de restaurants', 'View the restaurants'],
    account: ['Bekijk uw account', 'View your account'], verified: ['Uw e-mailadres is bevestigd.', 'Your email address is verified.'],
    unverified: ['Uw e-mailadres is nog niet bevestigd.', 'Your email address is not verified yet.'],
    balance: ['Uw RTG-betaalsaldo', 'Your RTG payment balance'], hide: ['Verberg uw saldo', 'Hide your balance'], show: ['Toon uw saldo', 'Show your balance'],
    documents: ['Bekijk uw documenten', 'View your documents'], health: ['Uw eigen beweegschema', 'Your own activity schedule'],
    noHealth: ['U heeft voor vandaag nog geen beweging gepland.', 'You have not planned any activity for today.'],
    atmosphere: ['Sfeerbeeld', 'Atmosphere image'], newTask: ['Maak een nieuwe taak', 'Create a new task'],
    browse: ['Ontdek de mogelijkheden', 'Explore the possibilities'], route: ['Kies uw bestemming', 'Choose your destination'],
    noRoute: ['Kies in Navigatie een bestemming om uw route te berekenen.', 'Choose a destination in Navigation to calculate your route.'],
    safeEmpty: ['Er is geen actieve wacht. Open Veilig om uw instellingen te bekijken.', 'There is no active watch. Open Safety to review your settings.'],
    current: ['Opgehaald', 'Retrieved'], grid: ['Toon kaarten', 'Show cards'], list: ['Toon een lijst', 'Show a list'],
    all: ['Alle apps', 'All apps'], favorites: ['Mijn widgets', 'My widgets']
  };
  w.I18N = w.I18N || {}; w.I18N.en = w.I18N.en || {};
  Object.keys(words).forEach(function (k) { w.I18N.en['widget.' + k] = words[k][1]; });
  w.RTGWidgetCopy = function (k) { return w.RTGi18n ? w.RTGi18n.t('widget.' + k, words[k][0]) : words[k][0]; };
})(window);
