/* Presentation vocabulary only. Actions and account data stay in their apps. */
(function (w) {
  'use strict';
  var copy = {
    atmosphere: ['Sfeerbeeld', 'Atmosphere image'],
    pulseLabel: ['Pulse', 'Pulse'],
    pulseTitle: ['Een klein moment kan iets beginnen.', 'A small moment can start something.'],
    pulseIntro: ['Deel wat u bezighoudt en ontdek wat anderen in beweging brengt.', 'Share what is on your mind and discover what moves others.'],
    pulseAction: ['Plaats uw eerste bericht', 'Share your first post'],
    pulseReady: ['Wat houdt u bezig?', 'What is on your mind?'],
    pulseNote: ['Uw gesprekken beginnen hier.', 'Your conversations begin here.'],
    discover: ['Ontdek mensen', 'Discover people'],
    agendaLabel: ['Uw agenda', 'Your calendar'],
    agendaTitle: ['Maak ruimte voor wat ertoe doet.', 'Make room for what matters.'],
    agendaIntro: ['Geef afspraken een plek en houd overzicht over uw dag.', 'Give your plans a place and keep an overview of your day.'],
    agendaAction: ['Plan een afspraak', 'Plan an appointment'],
    agendaReady: ['Uw dag', 'Your day'],
    agendaNote: ['Er staat nog niets gepland in deze periode.', 'Nothing is planned in this period yet.'],
    allDay: ['Hele dag', 'All day'],
    emptyDay: ['U heeft op deze dag geen afspraken.', 'You have no appointments on this day.'],
    bestandenLabel: ['Uw bestanden', 'Your files'],
    bestandenTitle: ['Wat belangrijk is, krijgt een plek.', 'A place for what matters.'],
    bestandenIntro: ['Bewaar uw documenten overzichtelijk en vind ze terug wanneer u ze nodig heeft.', 'Keep your documents organised and find them when you need them.'],
    bestandenAction: ['Voeg uw eerste bestand toe', 'Add your first file'],
    bestandenReady: ['Alles op zijn plek.', 'Everything in its place.'],
    bestandenNote: ['U kiest zelf wat u deelt.', 'You choose what to share.'],
    archiveLabel: ['Uw archief', 'Your archive'],
    folder: ['Maak een map', 'Create a folder'],
    folders: ['Uw mappen', 'Your folders'],
    files: ['Uw documenten', 'Your documents'],
    addFile: ['Bestand toevoegen', 'Add a file'],
    noFiles: ['Er staan nog geen bestanden in deze map.', 'There are no files in this folder yet.'],
    noResults: ['Er zijn geen resultaten voor uw zoekopdracht.', 'There are no results for your search.'],
    notitiesLabel: ['Uw notities', 'Your notes'],
    notitiesTitle: ['Geef uw gedachten de ruimte.', 'Give your thoughts room.'],
    notitiesIntro: ['Leg een idee vast, schrijf iets uit of bewaar wat u niet wilt vergeten.', 'Capture an idea, write something down or keep what you do not want to forget.'],
    notitiesAction: ['Schrijf uw eerste notitie', 'Write your first note'],
    notitiesReady: ['Om te onthouden.', 'Something to remember.'],
    notitiesNote: ['Een gedachte is een goed begin.', 'A thought is a good beginning.'],
    notebook: ['Uw notitieboek', 'Your notebook'],
    newNote: ['Nieuwe notitie', 'New note'],
    emptyNotes: ['Er staan nog geen notities op uw bord.', 'There are no notes on your board yet.'],
    failed: ['We konden uw gegevens niet laden. Probeer het opnieuw.', 'We could not load your data. Please try again.'],
    retry: ['Probeer het opnieuw', 'Please try again'],
    guest: ['Meld u aan om uw eigen omgeving te openen.', 'Sign in to open your personal space.'],
    login: ['Meld u aan bij RTG', 'Sign in to RTG'],
    loading: ['Uw omgeving wordt geladen.', 'Your space is loading.']
  };
  w.I18N = w.I18N || {}; w.I18N.en = w.I18N.en || {};
  Object.keys(copy).forEach(function (key) { w.I18N.en['daily.' + key] = copy[key][1]; });
  function esc(v) { return String(v == null ? '' : v).replace(/[&<>"']/g, function (c) {
    return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
  }); }
  function value(key) { return w.RTGi18n ? w.RTGi18n.t('daily.' + key, copy[key][0]) : copy[key][0]; }
  function text(key) { return '<span data-i18n="daily.' + key + '" data-i18n-source="' + esc(copy[key][0]) + '">' + esc(value(key)) + '</span>'; }
  function date(iso, options) {
    var d = new Date(iso.length === 10 ? iso + 'T12:00:00Z' : iso);
    if (!Number.isFinite(d.getTime())) return '';
    return new Intl.DateTimeFormat(document.documentElement.lang || 'nl', Object.assign({ timeZone: 'UTC' }, options || { day: 'numeric', month: 'long' })).format(d);
  }
  w.RTGDailyCopy = { text: text, value: value, esc: esc, date: date };
})(window);
