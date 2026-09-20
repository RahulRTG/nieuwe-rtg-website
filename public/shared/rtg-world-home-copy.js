/* Shared editorial vocabulary and locale formatting. */
(function (w,d) {
  'use strict';
  var copy = {
    addBooking: ['Voeg uw eigen boeking toe', 'Add your own booking'],
    travelCatalogue: ['Verken alle reismogelijkheden', 'Explore all travel options'],
    atmosphere: ['Sfeerbeeld', 'Atmosphere image'],
    travelTitle: ['Even helemaal ergens anders.', 'Somewhere else entirely.'],
    travelIntro: ['Uw reis krijgt hier vorm, van vertrek tot thuiskomst.', 'Your journey takes shape here, from departure to your return home.'],
    travelEmpty: ['Er staat nog geen reis in uw dossier. Geef uw volgende reis samen met ons vorm.', 'There is no journey in your travel file yet. Shape your next journey with us.'],
    travelGuest: ['Meld u aan om uw eigen reizen hier te zien.', 'Sign in to see your own journeys here.'],
    travelError: ['We konden uw reisgegevens niet ophalen. Probeer het opnieuw voordat u op deze informatie vertrouwt.', 'We could not load your travel details. Please try again before relying on this information.'],
    travelReady: ['Uw reisgegevens staan bij elkaar. Open uw reis voor de onderdelen en de actuele stand.', 'Your travel details are together. Open your journey for its parts and current status.'],
    nextTrip: ['Uw volgende reis', 'Your next journey'],
    yourJourneys: ['Uw reizen, bij elkaar', 'Your journeys, together'],
    loading: ['Uw gegevens worden opgehaald.', 'Your information is loading.'],
    signIn: ['Meld u aan bij RTG', 'Sign in to RTG'],
    openTrip: ['Bekijk uw reis', 'View your journey'],
    planTrip: ['Bespreek uw reiswens', 'Discuss your travel plans'],
    morning: ['Goedemorgen.', 'Good morning.'],
    afternoon: ['Goedemiddag.', 'Good afternoon.'],
    evening: ['Goedenavond.', 'Good evening.'],
    workIntro: ['Uw werkdag begint met overzicht.', 'Your working day begins with a clear overview.'],
    workEmpty: ['Uw werkdag heeft nog alle ruimte. Afspraken, notities en documenten komen hier samen zodra u ze toevoegt.', 'Your working day has room to grow. Appointments, notes and documents come together here when you add them.'],
    workGuest: ['Meld u aan om uw afspraken en werkzaamheden te zien.', 'Sign in to see your appointments and work.'],
    workError: ['We konden uw werkdag niet ophalen. Uw afspraken en werkzaamheden zijn nu niet bevestigd.', 'We could not load your working day. Your appointments and work are not confirmed right now.'],
    workPartial: ['Een deel van uw werkdag kon niet worden opgehaald. Het overzicht is mogelijk onvolledig.', 'Part of your working day could not be loaded. This overview may be incomplete.'],
    attention: ['Dit verdient uw aandacht.', 'This deserves your attention.'],
    free: ['Altijd 100% gratis', 'Always 100% free'],
    grow: ['Ruimte om te groeien.', 'Room to grow.'],
    foundationIntro: ['Voor uw gezin, uw talent en uw toekomst.', 'For your family, your talents and your future.'],
    discover: ['Wat wilt u vandaag ontdekken?', 'What would you like to discover today?'],
    choose: ['Kies iets dat bij u past.', 'Choose something that suits you.'],
    learn: ['Samen leren', 'Learning together'],
    learnIntro: ['Ontdek iets nieuws, op uw eigen tempo.', 'Discover something new, at your own pace.'],
    talent: ['Uw talent', 'Your talents'],
    talentIntro: ['Geef uw ideeën de ruimte.', 'Give your ideas room to grow.'],
    support: ['U staat er niet alleen voor.', 'You are not alone.'],
    supportIntro: ['Vind hulp voor de vragen van alledag.', 'Find help with everyday questions.'],
    possibilities: ['Ontdek de mogelijkheden', 'Explore the possibilities'],
    agendaLoading: ['Uw gezinsagenda wordt opgehaald.', 'Your family calendar is loading.'],
    agendaError: ['We konden uw gezinsagenda niet ophalen. Open uw agenda om het opnieuw te proberen.', 'We could not load your family calendar. Open your calendar to try again.'],
    inspiration: ['Reisinspiratie', 'Travel inspiration'], stays: ['Verblijven', 'Places to stay'], onTheWay: ['Onderweg', 'On the move'],
    travelBook: ['Uw reisboek', 'Your travel book'], travelHelp: ['Alles voor onderweg.', 'Everything for your journey.'],
    documents: ['Bewaar uw plannen en documenten bij elkaar.', 'Keep your plans and documents together.'],
    nextStep: ['Uw volgende stap', 'Your next step'], prepare: ['Bekijk wat u voor vertrek wilt regelen.', 'See what you want to arrange before you leave.'],
    whereNext: ['Waar wilt u hierna naartoe?', 'Where would you like to go next?'], ideas: ['Ontdek nieuwe mogelijkheden die bij u passen.', 'Discover new possibilities that suit you.'],
    travelDetails: ['Uw reismomenten en reisstatus', 'Your travel moments and status'], workDetails: ['Uw organisatie en alle werkonderdelen', 'Your organisation and all areas of work'],
    projects: ['Waar we aan werken.', 'What we are working on.'], plans: ['Geef uw plannen de ruimte.', 'Give your plans room to grow.'],
    together: ['Houd uw plannen, documenten en mensen bij elkaar.', 'Keep your plans, documents and people together.'],
    workspace: ['Bekijk de werkruimte', 'View your workspace'], team: ['Uw team blijft dichtbij.', 'Your team stays close.'],
    teamIntro: ['Bekijk uw werkdag, uw rooster en de mensen met wie u samenwerkt.', 'See your working day, your schedule and the people you work with.'],
    openTeam: ['Open uw team', 'Open your team'], family: ['Uw gezin krijgt hier een eigen plek.', 'Your family has a place of its own here.'],
    familyIntro: ['Maak een gezinsomgeving aan of open de omgeving die u al heeft. FoundationOS is en blijft 100% gratis.', 'Create a family space or open the one you already have. FoundationOS is and will always be 100% free.']
  };
  w.I18N = w.I18N || {}; w.I18N.en = w.I18N.en || {};
  Object.keys(copy).forEach(function (key) { w.I18N.en['worldHome.' + key] = copy[key][1]; });
  function esc(v) { return String(v == null ? '' : v).replace(/[&<>"']/g, function (c) {
    return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
  }); }
  function value(key) { return w.RTGi18n ? w.RTGi18n.t('worldHome.' + key, copy[key][0]) : copy[key][0]; }
  function text(key) { return '<span data-i18n="worldHome.' + key + '" data-i18n-source="' + esc(copy[key][0]) + '">' + esc(value(key)) + '</span>'; }
  function put(id, key) { var el = d.getElementById(id); if (el) el.innerHTML = text(key); }
  function date(iso) {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(String(iso || ''))) return '';
    var dt = new Date(iso + 'T12:00:00Z'); if (!Number.isFinite(dt.getTime())) return '';
    return new Intl.DateTimeFormat(d.documentElement.lang || 'nl', { day: 'numeric', month: 'long', year: 'numeric', timeZone: 'UTC' }).format(dt);
  }
  w.RTGWorldHomeCopy = {text:text,value:value,put:put,date:date};
})(window,document);
