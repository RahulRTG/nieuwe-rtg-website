/* De stand VANDAAG van het huis van LivingOS.

   Deze laag verzint niets. De schets waar dit scherm uit komt stond vol met
   namen, tijden en bedragen; die stonden er als PLAATJE. Wat hier op het
   scherm komt, komt uit een bron die er al is:

     - de momentenrij en de feed uit /api/sociaal/lijn en /api/sociaal/wereld
       (kern/socialewereld.js: `regels` is wat op u wacht, `stil` is een bron
       die NIETS te melden had of niet gelezen kon worden),
     - het kompas uit /api/agenda/mijn-lijst.

   De regel die alles hier stuurt staat in BESTUUR.md: een bron die niet kijkt,
   zegt dat hij niet kijkt. Een blok zonder gegevens toont daarom een zin en
   nooit een nul, een streepje of een leeg vlak -- en al helemaal geen
   voorbeeldnaam die voor echt kan worden aangezien.

   RAHUL STELT VOOR, U BEVESTIGT (FABRIC.md par. 5). Elke kaart met een
   handeling brengt u NAAR het scherm dat de handeling draagt; er wordt hier
   niets uitgevoerd, geboekt of bevestigd. */
(function () {
  'use strict';
  var rij = document.getElementById('momentenrij');
  if (!rij) return;

  var feed = document.getElementById('dagfeed');
  var stilregel = document.getElementById('dagstil');
  var agenda = document.getElementById('kompasAgenda');
  var volgend = document.getElementById('volgendMoment');

  var token = null;
  try { token = localStorage.getItem('rtg_member_token'); } catch (e) { token = null; }

  function esc(s) {
    return String(s == null ? '' : s).replace(/[&<>"]/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c];
    });
  }
  function api(pad, body) {
    return fetch(pad, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + token },
      body: JSON.stringify(body || {})
    }).then(function (r) { return r.json(); });
  }
  /* Een blok dat niets kan tonen zegt WAAROM. Drie redenen en niet een:
     niet ingelogd, niets te melden, of niet op te halen -- die drie betekenen
     voor de lezer iets heel verschillends. */
  function melding(doel, tekst) {
    if (doel) doel.innerHTML = '<p class="dagleeg">' + esc(tekst) + '</p>';
  }

  if (!token) {
    melding(rij, 'Meld u aan; daarna staan uw momenten van vandaag hier.');
    melding(feed, 'Meld u aan om te zien wat er vandaag op u wacht.');
    melding(agenda, 'Meld u aan voor uw agenda.');
    if (volgend) volgend.hidden = true;
    return;
  }

  /* ---------------------------------------------------------- momentenrij */
  /* De eerste tegel is altijd MAAK MOMENT en staat er ook als er niets is:
     een lege rij zonder ingang is een dood vlak. De ring om een moment is een
     cirkel en geen afgeronde rechthoek -- de enige vorm die in dit huis nog
     een radius mag dragen (CLAUDE.md par. 3).

     Er staat een TIJDSTIP onder een moment en geen aftelling. Een "nog 5u"
     onder het gezicht van een vriend maakt van een herinnering een deadline,
     en dat is precies het urgentiepatroon dat hier niet mag. */
  function tekenRij(vak) {
    var maak = '<a class="moment moment-nieuw" href="/apps/camera.html">' +
      '<span class="momentring"><span class="momentplus" aria-hidden="true">+</span></span>' +
      '<span class="momentnaam">Maak moment</span></a>';
    var regels = (vak && vak.regels) || [];
    if (!regels.length) {
      rij.innerHTML = maak + '<p class="dagleeg dagleeg-rij">Vandaag staat er nog niets op uw lijn.</p>';
      return;
    }
    rij.innerHTML = maak + regels.slice(0, 8).map(function (r) {
      var naam = r.titel || r.door || r.app || 'Moment';
      return '<a class="moment" href="' + esc(r.link || '/apps/sociaal.html') + '">' +
        '<span class="momentring"><span class="momentvlak" aria-hidden="true"></span></span>' +
        '<span class="momentnaam">' + esc(naam) + '</span>' +
        '<span class="momentuur">' + esc(r.tijd || vak.label || '') + '</span></a>';
    }).join('');
  }

  api('/api/sociaal/lijn').then(function (d) {
    if (!d || !d.ok) throw new Error('geen lijn');
    var vakken = d.vakken || [];
    tekenRij(vakken[0] || null);
  }).catch(function () {
    melding(rij, 'Uw momentenlijn is nu niet op te halen.');
  });

  /* ----------------------------------------------------------------- feed */
  /* `regels` uit kern/socialewereld.js draagt per rij een STATUS als woord en
     een `wacht` als er iets op het lid ligt. Beide komen op het scherm; een
     kleur alleen is geen mededeling. */
  function kaart(r) {
    var wacht = r.wacht ? '<span class="dagwacht">' + esc(r.wacht) + '</span>' : '';
    return '<a class="dagkaart" href="' + esc(r.link || '#') + '">' +
      '<span class="dagbron">' + esc(r.app || r.soort) + '</span>' +
      '<b>' + esc(r.titel || 'Zonder titel') + '</b>' +
      '<span class="dagmeta">' + esc([r.wanneer, r.tijd, r.door].filter(Boolean).join(' · ')) + '</span>' +
      (r.status ? '<span class="dagstand">' + esc(r.status) + '</span>' : '') + wacht +
      '</a>';
  }

  api('/api/sociaal/wereld').then(function (d) {
    if (!d || !d.ok) throw new Error('geen kring');
    var regels = d.regels || [];
    if (!regels.length) melding(feed, 'Er wacht vandaag niets op u.');
    else feed.innerHTML = regels.slice(0, 6).map(kaart).join('');

    /* De stille bronnen staan er ALTIJD bij als er een is. Een beeld dat na een
       storing twee van de drie bronnen toont, lijkt compleet -- en dan blijft
       iemand onbeantwoord (kern/socialewereld.js). */
    var stil = d.stil || [];
    if (stilregel) {
      if (!stil.length) stilregel.hidden = true;
      else {
        stilregel.hidden = false;
        stilregel.innerHTML = 'Zonder signaal: ' + stil.map(function (s) {
          return esc(s.bron || s) + (s.reden ? ' (' + esc(s.reden) + ')' : '');
        }).join(', ') + '.';
      }
    }
  }).catch(function () {
    melding(feed, 'Wat er op u wacht is nu niet op te halen.');
    if (stilregel) stilregel.hidden = true;
  });

  /* --------------------------------------------------------------- kompas */
  api('/api/agenda/mijn-lijst').then(function (d) {
    var items = (d && d.items) || [];
    var vandaag = new Date().toISOString().slice(0, 10);
    var vanVandaag = items.filter(function (i) { return String(i.datum || '').slice(0, 10) === vandaag; })
      .sort(function (a, b) { return String(a.tijd || '').localeCompare(String(b.tijd || '')); });

    if (!vanVandaag.length) melding(agenda, 'Vandaag staat er niets in uw agenda.');
    else agenda.innerHTML = vanVandaag.map(function (i) {
      return '<span class="kompasregel"><span class="kompasuur">' + esc(i.tijd || '') + '</span>' +
        '<span class="kompasstip" aria-hidden="true"></span>' +
        '<span class="kompaswat">' + esc(i.titel || '') + '</span></span>';
    }).join('');

    /* HET VOLGENDE MOMENT is de eerstvolgende afspraak van vandaag en niets
       anders. Staat die er niet, dan verdwijnt de kaart -- er komt geen kaart
       die zegt dat er geen kaart is. */
    if (volgend) {
      var eerst = vanVandaag[0];
      if (!eerst) volgend.hidden = true;
      else {
        volgend.hidden = false;
        volgend.querySelector('[data-veld="titel"]').textContent = eerst.titel || '';
        volgend.querySelector('[data-veld="tijd"]').textContent =
          [eerst.tijd, eerst.notitie].filter(Boolean).join(' · ');
      }
    }
  }).catch(function () {
    melding(agenda, 'Uw agenda is nu niet op te halen.');
    if (volgend) volgend.hidden = true;
  });
})();
