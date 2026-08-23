/* Alle echte functies van de vier RTG-werelden, op één vindbare plek. */
(function (w) {
  'use strict';
  function wereld(meta, groepen, rail) {
    var alles = [];
    groepen.forEach(function (groep) { groep[1].forEach(function (functie) { alles.push(functie); }); });
    meta.groups = groepen; meta.all = alles;
    meta.tools = rail.map(function (id) { return alles.find(function (functie) { return functie[0] === id; }); }).filter(Boolean);
    return meta;
  }
  w.RTGEdgeWorlds = {
    work: wereld({ naam: 'WORK OS', kort: 'WORK', home: '/apps/werkruimte.html?gebied=kantoor', workspace: '/apps/werkruimte.html?gebied=kantoor', actie: 'Open werkbank' }, [
      ['Dag & team', [
        ['vandaag', 'Vandaag', 'home', '/apps/kantoor.html'], ['afdelingen', 'Afdelingen', 'grid', '/apps/kantoren.html'],
        ['personeel', 'Personeel', 'people', '/apps/personeel.html?kantoor=1'], ['agenda', 'Agenda', 'calendar', '/apps/agenda.html'],
        ['loon', 'Mijn loon', 'money', '/apps/loonstrook.html']
      ]],
      ['Maken & delen', [
        ['office', 'Presentaties & Office', 'doc', '/apps/office.html?werk=kantoor'], ['mail', 'RTG Mail', 'mail', '/apps/rtmail.html'],
        ['bestanden', 'Bestanden', 'folder', '/apps/bestanden.html'], ['website', 'Website', 'spark', '/apps/sitemaker.html'],
        ['web', 'Web', 'search', '/apps/browser.html']
      ]],
      ['Ondernemen', [
        ['rtgone', 'RTG One', 'shield', '/apps/rtgone.html'], ['onderneming', 'Onderneming', 'brief', '/apps/onderneming.html'],
        ['magnaat', 'Magnaat', 'money', '/apps/magnaat.html'], ['backoffice', 'Backoffice', 'brief', '/apps/backoffice.html']
      ]],
      ['Regie', [
        ['command', 'RTG Command', 'command', '/apps/command.html'], ['school', 'RTG School', 'school', '/apps/rtgschool.html']
      ]]
    ], ['vandaag', 'afdelingen', 'personeel', 'office', 'agenda', 'mail', 'bestanden', 'backoffice', 'command']),

    travel: wereld({ naam: 'TRAVEL OS', kort: 'TRAVEL', home: '/apps/reizen.html', workspace: '/apps/werkruimte.html?gebied=reizen', actie: 'Open reisdetail' }, [
      ['Plannen', [
        ['vandaag', 'Vandaag', 'home', '/apps/reizen.html#vandaag'], ['reisveilig', 'Reizen & Veilig', 'shield', '/apps/reizen-veilig.html'],
        ['vluchten', 'Vluchten', 'plane', '/apps/vluchten.html'], ['hotels', 'Verblijven', 'bed', '/apps/hotels.html'],
        ['reisbureau', 'Reisbureau', 'brief', '/apps/reisbureau.html']
      ]],
      ['Onderweg', [
        ['navigatie', 'Navigatie', 'map', '/apps/navigatie.html'], ['mobiliteit', 'Openbaar vervoer', 'car', '/apps/ov.html'],
        ['verkeer', 'Verkeer', 'target', '/apps/flits.html'], ['rit', 'Ritstatus', 'car', '/apps/rit.html'], ['stad', 'Stad', 'map', '/apps/stad.html']
      ]],
      ['Private travel', [
        ['hangar', 'Private Mobility', 'shield', '/apps/hangar.html'], ['residentie', 'Residentie', 'bed', '/apps/residentie.html'],
        ['reisboek', 'Reisboek', 'book', '/apps/reisboek.html']
      ]]
    ], ['vandaag', 'vluchten', 'hotels', 'reisbureau', 'mobiliteit', 'navigatie', 'rit', 'reisboek', 'hangar']),

    living: wereld({ naam: 'LIVING OS', kort: 'LIVING', home: '/apps/living-os.html', workspace: '/apps/werkruimte.html?gebied=living', actie: 'Vergelijk werelden' }, [
      ['Leefmodel', [
        ['universe', 'Universe', 'spark', '/apps/living-os.html?view=universe'], ['intent', 'Intent', 'target', '/apps/living-os.html?view=intent'],
        ['worlds', 'Worlds', 'grid', '/apps/living-os.html?view=worlds'], ['decisions', 'Decisions', 'branch', '/apps/living-os.html?view=decisions'],
        ['evidence', 'Replay', 'replay', '/apps/living-os.html?view=evidence']
      ]],
      ['Uw leven', [
        ['leven', 'Mijn leven', 'heart', '/apps/leven.html'], ['geld', 'RTG Geld', 'money', '/apps/geld.html'],
        ['wonen', 'Maison', 'home', '/apps/maison.html'], ['tafel', 'Table', 'brief', '/apps/table.html'],
        ['garderobe', 'Garde-robe', 'folder', '/apps/garderobe.html'], ['gezondheid', 'Gezondheid', 'heart', '/apps/vitaal.html'],
        ['veilig', 'RTG Veilig', 'shield', '/apps/veilig.html']
      ]]
    ], ['universe', 'intent', 'worlds', 'decisions', 'evidence', 'leven', 'geld', 'veilig']),

    foundation: wereld({ naam: 'RTFOUNDATION', kort: 'RTF', home: '/apps/foundation/index.html', workspace: '/apps/werkruimte.html?gebied=foundation', actie: 'Ga verder' }, [
      ['Start & leren', [
        ['foundation-home', 'Foundation Home', 'home', '/apps/foundation/index.html'], ['campus', 'Campus', 'school', '/apps/foundation/campus.html'],
        ['leren', 'Leren', 'book', '/apps/foundation/leren.html'], ['office', 'Presenteren & Office', 'doc', '/apps/office.html?werk=rtf'],
        ['bieb', 'Bibliotheek', 'book', '/apps/foundation/bieb.html'], ['geloofbieb', 'Geloofsbibliotheek', 'book', '/apps/foundation/geloofbieb.html'],
        ['schoolbieb', 'Schoolbibliotheek', 'book', '/apps/foundation/schoolbieb.html'], ['beroepen', 'Beroepen', 'brief', '/apps/foundation/beroepen.html'],
        ['school', 'School', 'school', '/apps/foundation/school.html'], ['overhoren', 'Overhoren', 'target', '/apps/foundation/overhoren.html'],
        ['schrijven', 'Schrijven', 'doc', '/apps/foundation/schrijven.html'], ['projecten', 'Projecten', 'folder', '/apps/foundation/projecten.html'],
        ['toetsen', 'Toetsen', 'target', '/apps/foundation/toetsen.html'], ['presenteren', 'Presenteren', 'doc', '/apps/foundation/presenteren.html']
      ]],
      ['Klein beginnen', [
        ['speeltuin', 'De Speeltuin', 'play', '/apps/foundation/speeltuin.html'], ['tellen', 'Tellen tot tien', 'spark', '/apps/foundation/tellen.html'],
        ['kleuren', 'Kleuren en vormen', 'spark', '/apps/foundation/kleuren.html'], ['memorie', 'Memorie', 'grid', '/apps/foundation/memorie.html'],
        ['verhaaltje', 'Voorleesverhaaltjes', 'book', '/apps/foundation/verhaaltje.html'], ['liedjes', 'Liedjes en versjes', 'play', '/apps/foundation/liedjes.html'],
        ['gevoel', 'Hoe voel je je?', 'heart', '/apps/foundation/gevoel.html']
      ]],
      ['Spelen & samen', [
        ['spelen', 'De Speelhal', 'play', '/apps/foundation/speelhal.html'], ['arena', 'De Arena', 'target', '/apps/foundation/arena.html'],
        ['societeit', 'De Sociëteit', 'people', '/apps/foundation/societeit.html'], ['vrienden', 'Vrienden', 'people', '/apps/foundation/vrienden.html'],
        ['games', 'RTG Spelen', 'play', '/apps/spelen.html'], ['club', 'Club', 'people', '/apps/foundation/club.html'],
        ['klas', 'Klas', 'school', '/apps/foundation/klas.html']
      ]],
      ['Gezin & dag', [
        ['babyboek', 'Babyboek', 'book', '/apps/foundation/babyboek.html'], ['agenda', 'Gezinsagenda', 'calendar', '/apps/foundation/agenda.html'],
        ['keuken', 'Keuken', 'home', '/apps/foundation/keuken.html'], ['ochtend', 'Ochtend', 'home', '/apps/foundation/ochtend.html'],
        ['verjaardagen', 'Verjaardagen', 'calendar', '/apps/foundation/verjaardagen.html'], ['gezondheid', 'Gezondheid', 'heart', '/apps/foundation/gezondheid.html'],
        ['mijnbanden', 'Mijn banden', 'people', '/apps/foundation/mijnbanden.html']
      ]],
      ['Zelfstandig leven', [
        ['zakgeld', 'Zakgeld', 'money', '/apps/foundation/zakgeld.html'], ['budget', 'Budget', 'money', '/apps/foundation/budget.html'],
        ['rechten', 'Rechten', 'shield', '/apps/foundation/rechten.html'], ['contact', 'Contact', 'people', '/apps/foundation/contact.html'],
        ['markt', 'Markt', 'brief', '/apps/foundation/markt.html'], ['oppasinfo', 'Oppasinformatie', 'people', '/apps/foundation/oppasinfo.html'],
        ['kompas', 'Kompas', 'map', '/apps/foundation/kompas.html'], ['rust', 'Rust', 'heart', '/apps/foundation/rust.html'],
        ['veilig', 'Veilig thuis', 'shield', '/apps/foundation/veilig.html'], ['mediawijs', 'Mediawijs', 'shield', '/apps/foundation/mediawijs.html'],
        ['dromen', 'Dromen', 'spark', '/apps/foundation/dromen.html'], ['werk', 'Werk', 'brief', '/apps/foundation/werk.html']
      ]],
      ['Vooruit & hulp', [
        ['studie', 'Studie', 'school', '/apps/foundation/studie.html'], ['cv', 'CV', 'doc', '/apps/foundation/cv.html'],
        ['klusjes', 'Klusjes', 'brief', '/apps/foundation/klusjes.html'], ['reis', 'Reis', 'plane', '/apps/foundation/reis.html'],
        ['opvoeden', 'Opvoeden', 'people', '/apps/foundation/opvoeden.html'], ['steun', 'Steun', 'heart', '/apps/foundation/steun.html'],
        ['geld', 'Geld', 'money', '/apps/foundation/geld.html'], ['magazine', 'Magazine', 'book', '/apps/foundation/magazine.html'],
        ['hulp', 'Hulpwijzer', 'spark', '/apps/foundation/hulpwijzer.html'], ['pesten', 'Pesten', 'shield', '/apps/foundation/pesten.html'],
        ['privacy', 'Privacy & veiligheid', 'shield', '/apps/foundation/privacy.html'], ['beheer', 'Gezin & beheer', 'people', '/apps/foundation/beheer.html'],
        ['livinglab', 'Living Lab', 'spark', '/apps/livinglab.html']
      ]]
    ], ['campus', 'leren', 'spelen', 'agenda', 'gezondheid', 'veilig', 'beheer', 'hulp'])
  };
})(window);
