/* RTG Social OS: een gedeelde productschil rond bestaande sociale kernen.
   Dit bestand verplaatst of kopieert geen gegevens. Het voegt alleen de vaste
   wereldnavigatie toe en geeft elke zelfstandige capability een herkenbare
   plek binnen dezelfde sociale ervaring. */
(function () {
  'use strict';

  var pad = location.pathname;
  var routes = [
    { sleutel: 'today', label: 'Vandaag', toelichting: 'briefing', href: '/apps/sociaal.html' },
    { sleutel: 'messages', label: 'Berichten', toelichting: 'gesprekken', href: '/apps/comm.html' },
    { sleutel: 'salon', label: 'Salon', toelichting: 'momenten', href: '/apps/salon.html' },
    { sleutel: 'circles', label: 'Kringen', toelichting: 'genootschappen', href: '/apps/genootschap.html' },
    { sleutel: 'private', label: 'Privé', toelichting: 'besloten ruimtes', href: '/apps/sociaal-prive.html' }
  ];
  var privéPaden = ['/apps/sociaal-prive.html', '/apps/meet.html', '/apps/vonk.html',
    '/apps/rendezvous.html', '/apps/cercle.html', '/apps/entourage.html', '/apps/attenties.html'];
  var actief = pad === '/apps/comm.html' ? 'messages' :
    pad === '/apps/salon.html' ? 'salon' :
    pad === '/apps/genootschap.html' ? 'circles' :
    privéPaden.indexOf(pad) !== -1 ? 'private' : 'today';

  document.body.classList.add('rtg-suite-page', 'rtg-social-' + actief);
  if (pad === '/apps/pulse.html') document.body.classList.add('rtg-social-pulse');
  if (actief === 'private' && pad !== '/apps/sociaal-prive.html') {
    document.body.classList.add('rtg-social-private-tool');
  }

  function maak(tag, klasse, tekst) {
    var el = document.createElement(tag);
    if (klasse) el.className = klasse;
    if (tekst) el.textContent = tekst;
    return el;
  }

  var balk = maak('div', 'rtg-suitebar');
  balk.setAttribute('aria-label', 'Sociale commandobalk');
  var merk = maak('a', 'rtg-suitebrand');
  merk.href = '/apps/sociaal.html';
  merk.appendChild(maak('span', 'rtg-suitebrand-mark', 'RTG'));
  merk.appendChild(maak('span', 'rtg-suitebrand-world', 'LivingOS · Social'));
  balk.appendChild(merk);
  var staat = maak('span', 'rtg-suitestate', actief === 'private' ? 'Privé · toegang bewaakt' : 'Besloten ledennetwerk');
  balk.appendChild(staat);
  var persoon = maak('a', 'rtg-suiteperson');
  persoon.href = '/apps/profiel.html';
  persoon.setAttribute('aria-label', 'Open uw profiel');
  persoon.appendChild(maak('span', 'rtg-suiteperson-copy', 'Rahul'));
  persoon.appendChild(maak('span', 'rtg-suiteperson-seal', 'R'));
  balk.appendChild(persoon);

  var nav = maak('nav', 'rtg-suitenav');
  nav.setAttribute('aria-label', 'Sociale ruimtes');
  routes.forEach(function (route) {
    var link = maak('a', 'rtg-suitenav-link');
    link.href = route.href;
    link.dataset.sleutel = route.sleutel;
    link.appendChild(maak('span', 'rtg-suitenav-label', route.label));
    link.appendChild(maak('small', 'rtg-suitenav-note', route.toelichting));
    if (route.sleutel === actief) link.setAttribute('aria-current', 'page');
    nav.appendChild(link);
  });

  document.body.insertBefore(nav, document.body.firstChild);
  document.body.insertBefore(balk, document.body.firstChild);

  var helden = {
    '/apps/genootschap.html': ['Private circles', 'Uw kringen', 'Genootschappen, bijeenkomsten en gezamenlijke besluiten, geordend rond de mensen die er werkelijk bij horen.'],
    '/apps/pulse.html': ['The professional pulse', 'Pulse', 'Korte signalen uit uw professionele kring, eindig en rustig gebundeld.'],
    '/apps/meet.html': ['Private live room', 'Meet', 'Beeld en geluid voor genodigden. De uitnodiging of kamercode is de sleutel.'],
    '/apps/vonk.html': ['Verified introductions', 'Vonk', 'Een kleine dagelijkse selectie op codenaam, zonder eindeloos vegen.'],
    '/apps/rendezvous.html': ['Lifestyle Pass · besloten', 'Rendez-vous', 'Profiel, ontdekking en wederzijdse matches met uw beslissing als laatste stap.'],
    '/apps/cercle.html': ['Clubs and reciprocity', 'Cercle', 'Dresscodes, toegang en gastpassen in één discreet ledenregister.'],
    '/apps/entourage.html': ['Your travelling party', 'Entourage', 'Mensen, voorkeuren en reisgereedheid rond uw gezelschap.'],
    '/apps/attenties.html': ['Remembered with care', 'Attenties', 'Belangrijke momenten en voorkeuren, zonder sociale druk of publieke score.']
  };
  if (helden[pad]) {
    var hero = maak('section', 'rtg-suitehero');
    hero.setAttribute('aria-labelledby', 'rtgSuiteTitle');
    var heroCopy = maak('div', 'rtg-suitehero-copy');
    heroCopy.appendChild(maak('span', 'rtg-suitehero-kicker', helden[pad][0]));
    var heroTitle = maak('h1', '', helden[pad][1]);
    heroTitle.id = 'rtgSuiteTitle';
    heroCopy.appendChild(heroTitle);
    heroCopy.appendChild(maak('p', '', helden[pad][2]));
    hero.appendChild(heroCopy);
    var heroMark = maak('span', 'rtg-suitehero-mark', actief === 'private' ? 'PRIVATE / 01' : 'SOCIAL / 01');
    hero.appendChild(heroMark);
    nav.insertAdjacentElement('afterend', hero);
  }

  if (pad === '/apps/comm.html') {
    var comm = document.querySelector('.comm');
    if (comm) {
      var context = maak('aside', 'rtg-message-context');
      context.setAttribute('aria-label', 'Gesprekscontext');
      context.appendChild(maak('span', 'rtg-context-eyebrow', 'Private correspondence'));
      context.appendChild(maak('h2', '', 'Dichtbij, zonder ruis.'));
      context.appendChild(maak('p', '', 'Uw gesprekken blijven op codenaam. Bellen, video en afspraken beginnen vanuit de persoon met wie u al spreekt.'));
      var register = maak('dl', 'rtg-context-register');
      [['Identiteit', 'Codenaam'], ['Bereik', 'Uw eigen kring'], ['Regie', 'U verzendt']].forEach(function (regel) {
        var rij = maak('div', '');
        rij.appendChild(maak('dt', '', regel[0]));
        rij.appendChild(maak('dd', '', regel[1]));
        register.appendChild(rij);
      });
      context.appendChild(register);
      var hulp = maak('div', 'rtg-context-help');
      hulp.appendChild(maak('b', '', 'Rahul bereidt voor'));
      hulp.appendChild(maak('span', '', 'Samenvatten, concepten en afspraken staan in het gesprek. Niets gaat weg zonder uw bevestiging.'));
      context.appendChild(hulp);
      comm.appendChild(context);
    }
  }
})();
