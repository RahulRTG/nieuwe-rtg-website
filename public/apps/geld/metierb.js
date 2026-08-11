/* Stand -- Metier, deel 2: register, loonspiegel, coach en meeneembron.
   Tekent alleen, net als metier.js; metierc.js doet de rest. */
(function (w, d) {
  'use strict';
  var M = (w.RTGGeldDeel = w.RTGGeldDeel || {}).metier;

  M.registerHtml = function (dd) {
    M.register = dd;
    var esc = w.Geld.esc, l = (dd && dd.leden) || [];
    return '<div class="kaart"><label class="stil lbl" for="mtZveld">Zoek in het beroepsregister</label>' +
      '<input id="mtZveld" type="search" placeholder="Vak, vaardigheid of taal">' +
      '<label class="stil lbl" for="mtZplaats">Plaats</label><input id="mtZplaats" placeholder="Alle plaatsen">' +
      '<div class="mt-knoppen"><button class="knop hoofd" id="mtBzoek" type="button">Zoeken</button>' +
      '<button class="knop" id="mtBopenwerk" type="button">Alleen wie openstaat voor werk</button></div></div>' +
      '<div class="kaart"><h2>' + (dd ? ('Gevonden: ' + l.length + ' van ' + dd.totaal) : 'Leden') + '</h2>' +
      (l.length ? l.map(function (m) {
        return '<div class="rij"><div class="mt-tx"><b>' + esc(m.codenaam) + '</b>' +
          (m.open ? '<span class="badge mt-zg">Open voor werk</span>' : '') +
          (m.bewezen ? '<span class="badge mt-zg">' + m.bewezen + ' bevestigd</span>' : '') +
          '<div class="sub">' + esc(m.kop || 'geen beroepskop') + (m.plaats ? ' · ' + esc(m.plaats) : '') +
          ((m.vaardigheden || []).length ? ' · ' + esc(m.vaardigheden.join(', ')) : '') + '</div></div>' +
          '<button class="mt-mini" data-mtlid="' + esc(m.codenaam) + '">bekijk</button></div>';
      }).join('') : '<p class="stil">Zoek op een vak, een vaardigheid of een plaats.</p>') + '</div>';
  };

  M.lidHtml = function (p) {
    M.bekeken = p;
    var esc = w.Geld.esc, alle = (p.bewezen || []).concat(p.rollen || []);
    return '<div class="kaart"><h2>' + esc(p.codenaam) + '</h2>' +
      '<p class="stil">' + esc(p.kop || 'geen beroepskop') + (p.plaats ? ' · ' + esc(p.plaats) : '') + '</p>' +
      (p.open ? '<div style="margin-top:.4rem;"><span class="badge mt-zg" style="margin-left:0;">Open voor werk</span></div>' : '') +
      (p.over ? '<p style="margin-top:.6rem;font-size:.88rem;line-height:1.55;">' + esc(p.over) + '</p>' : '') +
      '<div class="mt-knoppen"><button class="knop" id="mtBterug" type="button">Terug naar het register</button></div></div>' +
      '<div class="kaart"><h2>Werk</h2>' + (alle.length ? alle.map(M.rolRij).join('') : '<p class="stil">Niets opgegeven.</p>') + '</div>' +
      '<div class="kaart"><h2>Vaardigheden</h2>' +
      ((p.vaardigheden || []).length ? '<div class="chips">' + p.vaardigheden.map(function (v) {
        var o = (p.onderschreven || {})[v] || { aantal: 0, ikDeed: false };
        return '<button type="button" data-mtonder="' + esc(v) + '" aria-pressed="' + (o.ikDeed ? 'true' : 'false') + '">' +
          esc(v) + (o.aantal ? ' · ' + o.aantal : '') + '</button>';
      }).join('') + '</div>' : '<p class="stil">Niets opgegeven.</p>') +
      '<p class="stil" style="margin-top:.5rem;">Onderschrijven kan alleen bij iemand met wie je verbonden bent, en alleen op een vaardigheid die er al staat.</p></div>' +
      '<div class="kaart"><h2>Aanbevelingen</h2>' +
      ((p.aanbevelingen || []).length ? p.aanbevelingen.map(function (a) {
        return '<div class="rij"><div class="mt-tx"><b>' + esc(a.van) + '</b><div class="sub">' + esc(a.tekst) + '</div></div>' +
          (a.vanMij ? '<button class="mt-mini" data-mtatrek="' + esc(a.id) + '">intrekken</button>' : '') + '</div>';
      }).join('') : '<p class="stil">Nog geen aanbevelingen.</p>') +
      '<label class="stil lbl" for="mtAtekst">Schrijf een aanbeveling</label>' +
      '<textarea id="mtAtekst" rows="3" maxlength="500" placeholder="Een paar zinnen over hoe het is om met deze persoon te werken."></textarea>' +
      '<div class="mt-knoppen"><button class="knop hoofd" id="mtBaanbeveel" type="button">Plaatsen</button></div></div>';
  };

  /* De loonspiegel: elders betaald, hier in de pas. Echte uurlonen uit de
     loonrun van RTG-zaken, met de wet ernaast. Vakken met te weinig zaken
     ontbreken bewust: die drempel houdt de server aan. */
  M.loonRij = function (r) {
    var esc = w.Geld.esc;
    return '<div class="rij"><div class="mt-tx"><b>' + esc(r.vakNaam) + '</b>' +
      '<div class="sub">&euro; ' + esc(r.uur.midden) + ' per uur (midden) · band &euro; ' + esc(r.uur.laag) + '-' + esc(r.uur.hoog) +
      ' · &plusmn; &euro; ' + esc(r.maand.midden) + ' bruto per maand · ' + esc(r.zaken) + ' zaken</div></div></div>';
  };

  M.loonHtml = function (dd) {
    M.loon = dd;
    var esc = w.Geld.esc;
    return '<div class="kaart"><h2>Wat betaalt dit vak?</h2>' +
      '<p class="stil">' + esc(dd.uitleg || '') +
      (dd.wet ? ' Wettelijk minimumuurloon in ' + esc(dd.wet.land) + ': &euro; ' + esc(dd.wet.minimum) + '.' : '') + '</p>' +
      '<label class="stil lbl" for="mtLland">Land</label>' +
      '<select id="mtLland"><option value="NL">Nederland</option><option value="BE">Belgie</option>' +
      '<option value="DE">Duitsland</option><option value="ES">Spanje</option></select>' +
      '<p class="stil" style="margin-top:.6rem;">Onder de ' + esc(dd.drempel) + ' zaken tonen we niets: een gemiddelde over een handvol werkgevers is een omweg naar het loon van een herkenbare zaak.</p></div>' +
      '<div class="kaart"><h2>Per vak</h2>' +
      ((dd.vakken || []).length ? dd.vakken.map(M.loonRij).join('')
        : '<p class="stil">Nog te weinig zaken per vak om cijfers te tonen zonder een werkgever aan te wijzen. De toets hieronder werkt wel: die legt je bod naast de wet.</p>') + '</div>' +
      '<div class="kaart"><h2>Houd een bod ertegen</h2>' +
      '<label class="stil lbl" for="mtTvak">Vak</label><select id="mtTvak">' +
      (dd.alleVakken || []).map(function (r) { return '<option value="' + esc(r.vak) + '">' + esc(r.vakNaam) + '</option>'; }).join('') + '</select>' +
      '<label class="stil lbl" for="mtTuur">Geboden uurloon</label>' +
      '<input id="mtTuur" type="number" min="0" step="0.5" placeholder="16">' +
      '<div class="mt-knoppen"><button class="knop hoofd" id="mtBtoets" type="button">Vergelijk</button></div>' +
      '<div class="mt-uit" id="mtUtoets" hidden></div>' +
      '<p class="stil" style="margin-top:.5rem;">Dit is informatie, geen onderhandelingstruc. Er gaat niets naar de werkgever en er wordt niets van bewaard.</p></div>';
  };

  /* Rahul coacht: hij zegt wat er ontbreekt en schrijft concepten, maar vult
     niets in en verstuurt niets. Ondertekenen blijft van het lid. */
  M.coachHtml = function () {
    return '<div class="kaart"><h2>Je profiel door de ogen van een werkgever</h2>' +
      '<p class="stil">Rahul zegt wat er ontbreekt. Hij vult niets voor je in.</p>' +
      '<div class="mt-knoppen"><button class="knop hoofd" id="mtBkritiek" type="button">Kijk mee</button></div>' +
      '<div class="mt-uit" id="mtUkritiek" hidden></div></div>' +
      '<div class="kaart"><h2>Een brief bij een vacature</h2>' +
      '<label class="stil lbl" for="mtCvac">De vacature</label>' +
      '<textarea id="mtCvac" rows="4" maxlength="800" placeholder="Plak de vacaturetekst of beschrijf hem kort."></textarea>' +
      '<div class="mt-knoppen"><button class="knop hoofd" id="mtBbrief" type="button">Schrijf een concept</button></div>' +
      '<p class="stil" style="margin-top:.5rem;">Het concept komt hier te staan. Jij verstuurt hem zelf, en jij ondertekent.</p>' +
      '<div class="mt-uit" id="mtUbrief" hidden></div></div>' +
      '<div class="kaart"><h2>Oefen het gesprek</h2>' +
      '<label class="stil lbl" for="mtCrol">Voor welke functie?</label><input id="mtCrol" maxlength="120" placeholder="Restaurantmanager">' +
      '<div class="mt-knoppen"><button class="knop hoofd" id="mtBoefen" type="button">Begin</button></div>' +
      '<div class="mt-uit" id="mtUoefen" hidden></div>' +
      '<div id="mtOefenveld" hidden><label class="stil lbl" for="mtCantw">Je antwoord</label>' +
      '<textarea id="mtCantw" rows="3" maxlength="1200"></textarea>' +
      '<div class="mt-knoppen"><button class="knop" id="mtBantw" type="button">Antwoord geven</button></div></div>' +
      '<p class="stil" style="margin-top:.5rem;">Er wordt niets van bewaard en niets van gedeeld. Dit is een oefenruimte.</p></div>';
  };

  /* Meenemen (shared/uitvoer.js): wat je meeneemt is het scherm waar je
     staat: je eigen werk, het register of de loonspiegel. De coach levert
     tekst en geen gegevens. */
  M.uitvoer = function () {
    if (M.tab === 'register' && M.register) {
      return { naam: 'beroepsregister', kolommen: ['codenaam', 'beroepskop', 'plaats', 'open voor werk', 'bevestigd', 'vaardigheden'],
        rijen: (M.register.leden || []).map(function (m) {
          return [m.codenaam || '', m.kop || '', m.plaats || '', m.open ? 'ja' : 'nee', m.bewezen || 0,
            (m.vaardigheden || []).join(', ')];
        }) };
    }
    if (M.tab === 'loon' && M.loon) {
      return { naam: 'loonspiegel', kolommen: ['vak', 'uur-laag', 'uur-midden', 'uur-hoog', 'maand-midden', 'zaken'],
        rijen: (M.loon.vakken || []).map(function (r) {
          return [r.vakNaam || '', r.uur.laag, r.uur.midden, r.uur.hoog, r.maand.midden, r.zaken];
        }) };
    }
    if (M.ik && M.ik.profiel) {
      var p = M.ik.profiel, alle = (p.bewezen || []).concat(p.rollen || []);
      return { naam: 'mijn-werk', kolommen: ['wat', 'waar', 'van', 'tot', 'sinds', 'bevestiging'],
        rijen: alle.map(function (r) {
          return [r.wat || '', r.waar || '', r.van || '', r.tot || '', String(r.sinds || '').slice(0, 10),
            r.bevestigd ? 'bevestigd door RTG' : 'zelf opgegeven'];
        }) };
    }
    return null;
  };
})(window, document);
