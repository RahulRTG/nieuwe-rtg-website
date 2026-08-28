/* RTF School, gezinskant extra: de excursie (toestemming, plek delen, de
   kijklog die laat zien wie er naar de kaart keek), de vrijwillige
   ouderbijdrage, de telefoonboom en de eigen Rahul Bijles van elk profiel.
   Draait als los deel naast de pagina; gebruikt gezinApi uit school.html
   (zelfde globale scope). */
(function () {
  'use strict';
  var $ = function (s) { return document.querySelector(s); };
  var esc = function (t) {
    return String(t == null ? '' : t).replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  };
  var wortel = null;

  function kaart(titel, binnen) {
    return '<div class="sec">' + titel + '</div><div class="kaart blok">' + binnen + '</div>';
  }

  async function laad() {
    if (typeof gezinApi !== 'function' || !wortel) return;
    var d;
    try { d = await gezinApi('/school/mijn'); } catch (e) { return; }
    var ouder = !!(d && d.ouder);
    var codes = [], gezien = {};
    ((d && d.school) || []).forEach(function (x) { if (!gezien[x.klas.code]) { gezien[x.klas.code] = true; codes.push(x.klas.code); } });
    // bellen binnen de app: de ouder zet het klas-belkanaal een keer open
    if (ouder && codes.length && window.SchoolBel && !laad.belAan && typeof s !== 'undefined' && s) {
      laad.belAan = true;
      SchoolBel.start({ klasCode: codes[0], gezin: { code: s.code, token: s.token } });
    }
    var uit = '';
    for (var i = 0; i < codes.length; i++) {
      var kc = codes[i];
      try { uit += await klasBlok(kc, ouder); } catch (e) {}
    }
    try { uit += await bijlesBlok(codes[0] || ''); } catch (e) {}
    wortel.innerHTML = uit;
    bind();
  }

  /* de eigen Rahul Bijles: geduldig, op het niveau van je klas, en het
     gesprek is van jou (ook binnen een gezin heeft ieder profiel het eigen) */
  async function bijlesBlok(kc) {
    var g = await gezinApi('/school/bijles/gesprek').catch(function () { return null; });
    if (!g || !g.ok) return '';
    var lijn = (g.beurten || []).slice(-8).map(function (b) {
      return '<div class="mini" style="margin:0.25rem 0;"><b>' + (b.rol === 'user' ? 'Jij' : 'Rahul') + ':</b> ' + esc(b.tekst) + '</div>';
    }).join('') || '<div class="mini">Stel je eerste vraag; Rahul denkt geduldig met je mee, op jouw niveau.</div>';
    return kaart('Rahul Bijles', lijn +
      '<div style="display:flex;gap:.4rem;margin-top:0.5rem;">' +
      '<input class="veld h-flex1" id="bijlesIn" placeholder="Wat wil je leren of snap je nog niet?" maxlength="600">' +
      '<button class="knop mini" data-doe="bijles" data-klas="' + esc(kc) + '">Vraag</button></div>');
  }

  async function klasBlok(kc, ouder) {
    var ex = await gezinApi('/school/excursie/mijn', { klasCode: kc }).catch(function () { return null; });
    var bij = await gezinApi('/school/bijdrage/mijn', { klasCode: kc }).catch(function () { return null; });
    var boom = ouder ? await gezinApi('/school/telefoonboom/mijn', { klasCode: kc }).catch(function () { return null; }) : null;
    var uit = '';
    if (ex && ex.excursies && ex.excursies.length) {
      uit += kaart('Excursies · klas ' + esc(kc), ex.excursies.map(function (e) {
        var kop = '<b>' + esc(e.titel) + '</b>' + (e.bestemming ? ' <span class="mini">· ' + esc(e.bestemming) + '</span>' : '') +
          ' <span class="mini">(' + esc(e.status) + ')</span>';
        var kinderen = e.kinderen.map(function (kind) {
          var t = kind.toestemming;
          var r = '<div class="mini" style="margin:0.25rem 0;">' + esc(kind.naam) + ': ' +
            (t && t.akkoord ? 'locatie-delen mag (van ' + esc(t.door) + ')' : 'nog geen toestemming voor locatie-delen');
          if (ouder && e.status !== 'afgerond') {
            r += ' <button class="knop mini" data-doe="toestem" data-klas="' + esc(kc) + '" data-ex="' + esc(e.id) + '" data-kind="' + esc(kind.profielId) + '" data-ja="' + (t && t.akkoord ? '0' : '1') + '">' +
              (t && t.akkoord ? 'Intrekken' : 'Toestemming geven') + '</button>';
          }
          if (!ouder && e.status === 'actief' && t && t.akkoord) {
            r += ' <button class="knop mini" data-doe="plek" data-klas="' + esc(kc) + '" data-ex="' + esc(e.id) + '">Deel mijn plek</button>';
          }
          if (kind.plek) r += ' <span class="mini">· plek gedeeld om ' + esc(String(kind.plek.at).slice(11, 16)) + '</span>';
          return r + '</div>';
        }).join('');
        var log = e.kijklog.length
          ? '<div class="mini">Wie keek er naar de kaart: ' + e.kijklog.slice(0, 8).map(function (l) {
              return esc(l.naam) + ' (' + esc(String(l.at).slice(11, 16)) + ')';
            }).join(', ') + '</div>'
          : '<div class="mini">Nog niemand heeft naar de kaart gekeken.</div>';
        return kop + kinderen + log +
          '<div class="mini">Locaties bestaan alleen tijdens de excursie en worden bij de stop gewist.</div>';
      }).join('<div style="border-top:1px solid var(--lijn);margin:0.75rem 0;"></div>'));
    }
    if (bij && bij.bijdragen && bij.bijdragen.length) {
      uit += kaart('Ouderbijdrage · klas ' + esc(kc), '<div class="mini" style="margin-bottom:0.5rem;">' + esc(bij.vrijwillig) + '</div>' +
        bij.bijdragen.map(function (b) {
          return '<div style="margin:0.25rem 0;"><b>' + esc(b.titel) + '</b> <span class="mini">EUR ' + b.bedrag.toFixed(2) + '</span> ' +
            b.kinderen.map(function (kind) {
              return kind.betaald
                ? '<span class="mini">' + esc(kind.naam) + ': betaald</span>'
                : (ouder ? '<button class="knop mini" data-doe="betaal" data-klas="' + esc(kc) + '" data-bij="' + esc(b.id) + '" data-kind="' + esc(kind.profielId) + '">Betaal voor ' + esc(kind.naam) + '</button>'
                  : '<span class="mini">' + esc(kind.naam) + ': nog open (ouderzaak)</span>');
            }).join(' ') + '</div>';
        }).join(''));
    }
    if (boom && boom.ok) {
      var alarm = boom.alarm
        ? '<div style="margin:0.25rem 0;"><b>Alarm:</b> ' + esc(boom.alarm.bericht) + '</div>' +
          (boom.alarm.doorgegeven ? '<div class="mini">Jullie hebben doorgegeven dat er gebeld is.</div>'
            : '<button class="knop mini" data-doe="doorgegeven" data-klas="' + esc(kc) + '">Wij hebben gebeld</button>')
        : '<div class="mini">Geen alarm; de boom staat klaar.</div>';
      var takken = boom.ikBel.length
        ? '<div class="mini">Bij een alarm bellen jullie: ' + boom.ikBel.map(function (t) {
            return esc(t.kind) + ' <button class="knop mini" data-doe="belapp" data-klas="' + esc(kc) + '" data-gezin="' + esc(t.gezinCode) + '" data-naam="ouders van ' + esc(t.kind) + '">Bel in de app</button>' +
              (t.nummer ? ' <span class="mini">(reserve: ' + esc(t.nummer) + ')</span>' : '');
          }).join(' en ') + '</div>'
        : '<div class="mini">Jullie zijn een blad van de boom: niemand meer te bellen.</div>';
      uit += kaart('Telefoonboom · klas ' + esc(kc),
        '<button class="knop mini" data-doe="belleraar" data-klas="' + esc(kc) + '">Bel de leraar in de app</button>' + alarm + takken +
        '<div class="rij" style="display:flex;gap:.4rem;margin-top:0.5rem;">' +
        '<input class="veld h-flex1" data-nummer="' + esc(kc) + '" placeholder="' + (boom.nummerGezet ? 'Nummer staat erin; hier wijzigen' : 'Jullie telefoonnummer voor de boom') + '">' +
        '<button class="knop mini" data-doe="nummer" data-klas="' + esc(kc) + '">Bewaar</button></div>');
    }
    return uit;
  }

  function bind() {
    wortel.querySelectorAll('[data-doe]').forEach(function (b) {
      b.addEventListener('click', async function () {
        var kc = b.dataset.klas, doe = b.dataset.doe;
        if (doe === 'belapp' || doe === 'belleraar') {
          if (window.SchoolBel) SchoolBel.bel(doe === 'belapp' ? b.dataset.gezin : 'leraar', b.dataset.naam || 'de leraar');
          return;
        }
        try {
          if (doe === 'toestem') await gezinApi('/school/excursie/toestemming', { klasCode: kc, excursieId: b.dataset.ex, profielId: b.dataset.kind, akkoord: b.dataset.ja === '1' });
          if (doe === 'betaal') await gezinApi('/school/bijdrage/betaal', { klasCode: kc, bijdrageId: b.dataset.bij, profielId: b.dataset.kind });
          if (doe === 'doorgegeven') await gezinApi('/school/telefoonboom/doorgegeven', { klasCode: kc });
          if (doe === 'nummer') await gezinApi('/school/telefoonboom/nummer', { klasCode: kc, nummer: (wortel.querySelector('[data-nummer="' + kc + '"]') || {}).value });
          if (doe === 'bijles') await gezinApi('/school/bijles/vraag', { klasCode: kc || undefined, tekst: (wortel.querySelector('#bijlesIn') || {}).value });
          if (doe === 'plek') {
            if (!navigator.geolocation) throw new Error('Geen locatie op dit toestel.');
            await new Promise(function (klaarMee, faal) {
              navigator.geolocation.getCurrentPosition(function (pos) {
                gezinApi('/school/excursie/gps', { klasCode: kc, excursieId: b.dataset.ex, lat: pos.coords.latitude, lng: pos.coords.longitude }).then(klaarMee, faal);
              }, function () { faal(new Error('Locatie delen is geweigerd.')); });
            });
          }
          laad();
        } catch (e) { b.insertAdjacentHTML('afterend', ' <span class="mini">' + esc(e.message) + '</span>'); }
      });
    });
  }

  document.addEventListener('DOMContentLoaded', function () {
    var lijst = $('#schoolLijst');
    if (!lijst) return;
    wortel = document.createElement('div');
    wortel.id = 'schoolExtra';
    lijst.parentNode.insertBefore(wortel, lijst.nextSibling);
    setTimeout(laad, 600); // na de eerste laadGezin
  });
})();
