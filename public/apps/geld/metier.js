/* Stand -- Metier, deel 1: staat, vormen en de opbouw van Mijn profiel en
   Mijn naam. Was /apps/metier.html: de beroepskant van RTG, het profiel op
   codenaam, de echte naam in de kluis. Drie bestanden omdat de repo elk
   bestand onder de 10 KB houdt; metierc.js bindt en registreert. */
(function (w, d) {
  'use strict';
  var Deel = w.RTGGeldDeel = w.RTGGeldDeel || {};
  var M = Deel.metier = {
    tab: 'ik', ik: null, bekeken: null, register: null, loon: null,
    loonland: 'NL', oefen: { rol: '', vraag: '' }
  };
  M.TABS = [['ik', 'Mijn profiel'], ['naam', 'Mijn naam'], ['register', 'Beroepsregister'],
    ['loon', 'Loonspiegel'], ['coach', 'Rahul coacht']];

  /* Alleen wat geld.html en de UI-kit NIET al hebben: de onderdelenbalk, het
     gouden zegel op een badge, en het uitvoervak van Rahul. De rijen, chips
     en badges zelf komen uit rtg-ui.css in plaats van overgetikt. Een keer
     injecteren, met id-wacht. */
  M.stijl = function () {
    if (d.getElementById('mtStijl')) return;
    var s = d.createElement('style');
    s.id = 'mtStijl';
    s.textContent =
      '.mt-tabs{display:flex;gap:.15rem;border-bottom:1px solid var(--rtg-line);overflow-x:auto;margin-bottom:.9rem;}' +
      '.mt-tabs button{background:none;border:0;border-bottom:2px solid transparent;margin-bottom:-1px;' +
        'color:var(--rtg-soft);padding:.5rem .7rem .55rem;font:inherit;font-size:.72rem;font-weight:600;' +
        'letter-spacing:.12em;text-transform:uppercase;white-space:nowrap;cursor:pointer;}' +
      '.mt-tabs button[aria-pressed="true"]{color:var(--rtg-txt);border-bottom-color:var(--gold-basis);}' +
      '#paneel .mt-tx{flex:1;min-width:0;}' +
      /* .badge en .chips zijn UI-kit-klassen die zusterstanden ook dragen, en
         dit blad blijft (id-wacht) in de head staan na een standwissel; dus
         op het eigen vak scopen, niet op #paneel, anders kleurt Metier de
         chips van Mecenaat mee */
      '#mtVak .badge{margin-left:.35rem;}' +
      '#paneel .mt-zg{color:var(--gold-tekst);border-color:var(--gold-rand);}' +
      '#mtVak .chips button[aria-pressed="true"]{border-color:var(--gold-rand);color:var(--gold-tekst);}' +
      '#paneel .mt-mini{background:none;border:0;color:var(--gold-tekst);font-size:.75rem;cursor:pointer;' +
        'padding:0;text-decoration:underline;}' +
      '#paneel .mt-uit{border:1px solid var(--rtg-line);border-radius:0;padding:.6rem .8rem;margin-top:.6rem;' +
        'font-size:.85rem;line-height:1.5;white-space:pre-wrap;}' +
      '#paneel .mt-knoppen{display:flex;flex-wrap:wrap;gap:.45rem;margin-top:.7rem;}' +
      '#paneel .mt-vraag{display:flex;gap:.5rem;margin-top:.4rem;}' +
      /* min-width:0 hoort bij flex:1 en is hier geen detail: een input heeft een
         INTRINSIEKE breedte (de size-eigenschap, ~20 tekens) en flex laat een
         kind daar niet vanzelf onder zakken. Op 390px duwde dat de knop Vraag
         zeven pixels buiten beeld -- en omdat de pagina niet zijwaarts scrolt,
         was die knop daar gewoon weg. */
      '#paneel .mt-vraag input{flex:1 1 0;min-width:0;width:auto;}' +
      '#paneel .mt-half{display:flex;gap:.4rem;margin-top:.4rem;}' +
      '#paneel .mt-naam{background:linear-gradient(150deg,rgba(127,22,52,.14),transparent);}';
    d.head.appendChild(s);
  };

  M.tabsKnoppen = function () {
    var esc = w.Geld.esc;
    return M.TABS.map(function (t) {
      return '<button type="button" data-mtt="' + t[0] + '" aria-pressed="' + (M.tab === t[0]) + '">' + esc(t[1]) + '</button>';
    }).join('');
  };

  /* Een werkregel: RTG-bevestigd werk draagt het gouden zegel, werk van
     buiten staat er eerlijk bij als zelf opgegeven en mag daarom ook weg. */
  M.rolRij = function (r) {
    var esc = w.Geld.esc;
    return '<div class="rij"><div class="mt-tx"><b>' + esc(r.wat) + '</b>' +
      (r.bevestigd ? '<span class="badge mt-zg" title="' + esc(r.hoe || '') + '">Bevestigd door RTG</span>'
        : '<span class="badge">Zelf opgegeven</span>') +
      '<div class="sub">' + esc(r.waar) + (r.sinds ? ' · sinds ' + esc(String(r.sinds).slice(0, 10)) : '') +
      (r.van ? ' · ' + esc(r.van) + (r.tot ? '-' + esc(r.tot) : '-nu') : '') + '</div></div>' +
      (r.bevestigd ? '' : '<button class="mt-mini" data-mtrolweg="' + esc(r.id) + '">weg</button>') + '</div>';
  };

  M.ikHtml = function (dd) {
    var esc = w.Geld.esc, p = dd.profiel, alle = (p.bewezen || []).concat(p.rollen || []);
    return '<div class="kaart"><h2>Je kaart</h2>' +
      '<label class="stil lbl" for="mtFkop">Beroepskop</label>' +
      '<input id="mtFkop" maxlength="80" value="' + esc(p.kop) + '" placeholder="Sommelier, tien jaar aan tafel">' +
      '<label class="stil lbl" for="mtFover">Over je werk</label>' +
      '<textarea id="mtFover" rows="3" maxlength="600" placeholder="Wat doe je, en waar ben je goed in?">' + esc(p.over) + '</textarea>' +
      '<label class="stil lbl" for="mtFplaats">Plaats</label><input id="mtFplaats" maxlength="60" value="' + esc(p.plaats) + '">' +
      '<div class="mt-knoppen"><button class="knop hoofd" id="mtBkaart" type="button">Bewaren</button>' +
      '<button class="knop" id="mtBopen" type="button" aria-pressed="' + (p.open ? 'true' : 'false') + '">' +
      (p.open ? 'Je staat open voor werk' : 'Zet "open voor werk" aan') + '</button></div></div>' +
      '<div class="kaart"><h2>Je werk</h2>' +
      '<p class="stil">Rollen die je binnen RTG hebt gewerkt staan hier met de bevestiging van RTG erbij: ' +
      'daarvoor heb je een keer de zaak-code en je eigen PIN gegeven. Werk van buiten RTG mag erbij, en staat ' +
      'er eerlijk bij als zelf opgegeven.</p>' +
      (alle.length ? alle.map(M.rolRij).join('') : '<p class="stil">Nog geen werk op je profiel.</p>') +
      '<label class="stil lbl" for="mtRwat">Rol toevoegen</label><input id="mtRwat" maxlength="80" placeholder="Wat deed je?">' +
      '<input class="h-mt40" id="mtRwaar" maxlength="80" placeholder="Waar?">' +
      '<div class="mt-half"><input id="mtRvan" inputmode="numeric" placeholder="van (jaar)" aria-label="Van welk jaar">' +
      '<input id="mtRtot" inputmode="numeric" placeholder="tot (jaar)" aria-label="Tot welk jaar"></div>' +
      '<div class="mt-knoppen"><button class="knop" id="mtBrol" type="button">Toevoegen</button></div></div>' +
      '<div class="kaart"><h2>Vaardigheden</h2>' +
      '<p class="stil">Geen niveaus van 1 tot 5; die zegt iedereen 5. Wat telt is wie ze onderschrijft.</p>' +
      (p.vaardigheden.length ? '<div class="chips">' + p.vaardigheden.map(function (v) {
        var o = (p.onderschreven || {})[v] || { aantal: 0 };
        return '<button type="button" disabled>' + esc(v) + (o.aantal ? ' · ' + o.aantal : '') + '</button>';
      }).join('') + '</div>' : '<p class="stil">Nog geen vaardigheden.</p>') +
      '<label class="stil lbl" for="mtFvaardig">Vaardigheden (met komma\'s)</label>' +
      '<input id="mtFvaardig" value="' + esc(p.vaardigheden.join(', ')) + '">' +
      '<label class="stil lbl" for="mtFtalen">Talen (met komma\'s)</label>' +
      '<input id="mtFtalen" value="' + esc(p.talen.join(', ')) + '">' +
      '<div class="mt-knoppen"><button class="knop" id="mtBlijst" type="button">Bewaren</button></div></div>' +
      '<div class="kaart"><h2>Aanbevelingen</h2>' +
      ((p.aanbevelingen || []).length ? p.aanbevelingen.map(function (a) {
        return '<div class="rij"><div class="mt-tx"><b>' + esc(a.van) + '</b>' +
          (a.verborgen ? '<span class="badge">Verborgen</span>' : '') +
          '<div class="sub">' + esc(a.tekst) + '</div></div>' +
          '<button class="mt-mini" data-mtverberg="' + esc(a.id) + '">' + (a.verborgen ? 'tonen' : 'verbergen') + '</button></div>';
      }).join('') : '<p class="stil">Nog geen aanbevelingen. Iemand met wie je verbonden bent kan er een schrijven.</p>') +
      '</div>';
  };

  /* Mijn naam: het signatuurstuk. De echte naam is een sleutel in de kluis en
     geen veld op het profiel; vrijgeven is per zaak, intrekbaar, en elke
     inzage (ook de geweigerde) staat in het log. */
  M.naamHtml = function (dd) {
    var esc = w.Geld.esc, t = dd.toestemmingen || [], log = dd.inzage || [];
    return '<div class="kaart mt-naam"><h2>Je naam is een sleutel, geen veld</h2>' +
      '<p class="stil">Op je profiel staat je codenaam. Je echte naam staat in de kluis en gaat pas mee ' +
      'als jij hem aan &eacute;&eacute;n werkgever vrijgeeft, voor &eacute;&eacute;n sollicitatie. Je kunt hem ' +
      'altijd intrekken, en je ziet hieronder precies wie hem heeft bekeken.</p>' +
      '<label class="stil lbl" for="mtNzaak">Zaak-code</label><input id="mtNzaak" maxlength="24" placeholder="Bijvoorbeeld KIKUNOI">' +
      '<label class="stil lbl" for="mtNwaarvoor">Waarvoor (voor jezelf)</label>' +
      '<input id="mtNwaarvoor" maxlength="120" placeholder="Sollicitatie sommelier">' +
      '<div class="mt-knoppen"><button class="knop hoofd" id="mtBvrij" type="button">Naam vrijgeven</button></div></div>' +
      '<div class="kaart"><h2>Wie mag je naam zien</h2>' +
      (t.length ? t.map(function (x) {
        return '<div class="rij"><div class="mt-tx"><b>' + esc(x.zaak) + '</b>' +
          (x.actief ? '<span class="badge mt-zg">Actief</span>' : '<span class="badge">Ingetrokken</span>') +
          '<div class="sub">' + esc(x.waarvoor || 'geen reden opgegeven') + ' · gegeven op ' + esc(String(x.at).slice(0, 10)) +
          (x.ingetrokken ? ' · ingetrokken op ' + esc(String(x.ingetrokken).slice(0, 10)) : '') + '</div></div>' +
          (x.actief ? '<button class="mt-mini" data-mtintrek="' + esc(x.code) + '">intrekken</button>' : '') + '</div>';
      }).join('') : '<p class="stil">Je hebt je naam aan niemand gegeven.</p>') + '</div>' +
      '<div class="kaart"><h2>Wie keek</h2>' +
      '<p class="stil">Ook de pogingen zonder toestemming staan erbij. Inzage is een gebeurtenis, geen stille zoekopdracht.</p>' +
      (log.length ? log.map(function (l) {
        return '<div class="rij"><div class="mt-tx"><b>' + esc(l.zaak) + '</b>' +
          (l.gelukt ? '<span class="badge mt-zg">Naam gezien</span>' : '<span class="badge">Geweigerd</span>') +
          '<div class="sub">' + esc(String(l.at).replace('T', ' ').slice(0, 16)) + '</div></div></div>';
      }).join('') : '<p class="stil">Nog niemand heeft gekeken.</p>') + '</div>';
  };
})(window, document);
