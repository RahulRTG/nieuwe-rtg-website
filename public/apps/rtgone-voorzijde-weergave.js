(function (w) {
  'use strict';
  function veilig(v) {
    return String(v == null ? '' : v).replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  }
  function getal(v) { v = Number(v); return Number.isFinite(v) ? v : 0; }
  function geld(v) {
    return new Intl.NumberFormat('nl-NL', { style: 'currency', currency: 'EUR', maximumFractionDigits: 0 }).format(getal(v));
  }
  function datum(v) {
    if (!v) return 'geen einddatum';
    var x = new Date(v), n = x.getTime();
    if (!Number.isFinite(n)) return String(v);
    return x.toLocaleDateString('nl-NL', { day: 'numeric', month: 'short', year: x.getFullYear() === new Date().getFullYear() ? undefined : 'numeric' });
  }
  function tijd(v, terugval) {
    if (!v) return terugval || '-';
    var x = new Date(v), n = x.getTime();
    if (!Number.isFinite(n)) return terugval || '-';
    return x.toLocaleTimeString('nl-NL', { hour: '2-digit', minute: '2-digit' });
  }
  function huisnaam(huis) { return huis === 'gedeeld' ? 'RTG + RTFoundation' : String(huis || 'rtg').toUpperCase(); }
  function soort(item) {
    var namen = { rtmail: 'RTMail', agenda: 'Agenda', goedkeuring: 'Goedkeuring', veiligheid: 'Veiligheid', taak: 'Taak', rtf: 'Foundation' };
    return namen[item && item.soort] || veilig(item && item.soort || 'Werk');
  }
  function focusHtml(stand) {
    var besluiten = (stand.goedkeuringen || []).filter(function (x) { return x.status === 'wacht'; });
    var dag = stand.vandaag || {}, item = (dag.items || [])[0], besluit = besluiten[0];
    if (besluit) return '<span class="one-label">Besluit van u</span><h2>' + veilig(besluit.titel) + '</h2><p>' + veilig(besluit.reden || 'Dit besluit wacht op een bevoegde collega.') + '</p><div class="one-focusvoet"><span>Impact ' + getal(besluit.impact) + '/5 · risico ' + getal(besluit.risico) + '/5</span><button class="one-primair" type="button" data-one-spring="besluit">Open besluit &rsaquo;</button></div>';
    if (item) return '<span class="one-label">Eerstvolgende aandacht</span><h2>' + veilig(item.titel || 'Open werkpunt') + '</h2><p>' + soort(item) + (item.van ? ' · van ' + veilig(item.van) : '') + '</p><div class="one-focusvoet"><span>' + tijd(item.at, 'Vandaag') + ' · bron blijft zichtbaar</span><button class="one-primair" type="button" data-one-diep="today">Open overzicht &rsaquo;</button></div>';
    return '<span class="one-label">Rust in uw werkdag</span><h2>Er vraagt nu niets om directe aandacht.</h2><p>Nieuwe signalen uit RTMail, agenda, besluiten en taken verschijnen hier zodra ze er zijn.</p><div class="one-focusvoet"><span>Geen schijngetal: de bronnen zijn leeg</span><button class="one-secundair" type="button" data-one-diep="promises">Bekijk beloften</button></div>';
  }
  function vandaag(root, stand, huis) {
    var v = stand.vandaag || { items: [], telling: {} }, t = v.telling || {}, vind = function (q) { return root.querySelector(q); };
    vind('#oneDagLabel').textContent = huisnaam(huis) + ' · uw werkdag';
    vind('#oneFocus').innerHTML = focusHtml(stand);
    vind('#oneTelling').innerHTML = [
      [getal(t.rtmail), 'RTMail-prioriteiten'], [getal(t.agenda), 'agenda-items'],
      [getal(t.goedkeuringen), 'goedkeuringen'], [getal(t.taken), 'open taken']
    ].map(function (x) { return '<div class="one-getal"><b>' + x[0] + '</b><span>' + x[1] + '</span></div>'; }).join('');
    var items = (v.items || []).slice(0, 6);
    vind('#oneVandaag').innerHTML = items.length ? items.map(function (x, i) {
      return '<div class="one-rij"><span class="one-tijd">' + tijd(x.at, i === 0 ? 'Nu' : '-') + '</span><span><b>' + veilig(x.titel || 'Werkpunt') + '</b><small>' + soort(x) + (x.van ? ' · ' + veilig(x.van) : '') + '</small></span><i class="one-punt ' + (i === 0 ? 'nu' : '') + '" aria-hidden="true"></i></div>';
    }).join('') : '<div class="one-leeg">Geen urgente live-items in dit gegevenshuis.</div>';
  }
  function besluitHtml(x, huis) {
    var stemmen = Array.isArray(x.stemmen) ? x.stemmen.length : 0;
    var route = x.status === 'wacht' ? stemmen + ' van ' + getal(x.vereist) + ' besluiten' : veilig(x.status || 'onbekend');
    var verandering = getal(x.bedrag) > 0 ? geld(x.bedrag) + ' financiële impact.' : 'Geen financiële impact opgegeven.';
    var knoppen = x.status === 'wacht'
      ? '<div class="one-acties"><button class="one-primair" type="button" data-one-room="' + veilig(x.id) + '">Open volledige afweging</button></div>'
      : '<div class="one-acties"><button class="one-secundair" type="button" data-one-nieuw="besluit">Nieuw besluit</button><button class="one-primair" type="button" data-one-diep="decisions">Open besluitregister</button></div>';
    return '<article class="one-paneelkaart"><div class="one-besluitkop"><span class="one-zegel">B</span><div><h2>' + veilig(x.titel || 'Besluit') + '</h2><p>' + veilig(x.type || 'operations') + ' · ' + huisnaam(huis) + '</p></div></div><div class="one-meters"><div class="one-meter"><small>Impact</small><b>' + getal(x.impact) + '/5</b></div><div class="one-meter"><small>Risico</small><b class="zacht">' + getal(x.risico) + '/5</b></div><div class="one-meter"><small>Route</small><b>' + route + '</b></div></div><div class="one-afweging"><div><strong>Bedoeling</strong><span>' + veilig(x.reden || 'Geen onderbouwing vastgelegd.') + '</span></div><div><strong>Verandert</strong><span>' + verandering + '</span></div><div><strong>Herstel</strong><span>' + (x.omkeerbaar ? 'Als omkeerbaar aangemerkt.' : 'Niet volledig omkeerbaar; extra controle vereist.') + '</span></div></div><aside class="one-rahul"><b>Menselijke beslisgrens</b>RTG One toont de onderbouwing en vereiste route. Alleen een bevoegde collega kan het besluit nemen.</aside>' + knoppen + '</article>';
  }
  function besluit(root, stand, huis) {
    var lijst = stand.goedkeuringen || [], x = lijst.find(function (g) { return g.status === 'wacht'; }) || lijst[0];
    root.querySelector('#oneBesluit').innerHTML = x ? besluitHtml(x, huis) : '<div class="one-leeg">Er ligt geen besluit ter beoordeling.<div class="one-acties"><button class="one-primair" type="button" data-one-nieuw="besluit">Leg een besluit voor</button></div></div>';
  }
  function overdracht(root, stand) {
    var x = (stand.overdrachten || [])[0], doel = root.querySelector('#oneOverdracht');
    if (!x) {
      doel.innerHTML = '<div class="one-leeg">Er is nog geen actieve overdracht in dit gegevenshuis. Maak er een wanneer werk tijdelijk naar een collega moet reizen.<div class="one-acties"><button class="one-primair" type="button" data-one-nieuw="overdracht">Maak overdracht</button></div></div>';
      return;
    }
    var beloften = Array.isArray(x.beloften) ? x.beloften : [];
    var regels = beloften.slice(0, 4).map(function (b) { return '<div class="one-check">' + veilig(b.belofte || 'Gekoppelde belofte') + (b.deadline ? ' · ' + veilig(b.deadline) : '') + '</div>'; }).join('');
    if (!regels) regels = '<div class="one-check">Geen open beloften aan deze overdracht gekoppeld.</div>';
    doel.innerHTML = '<div class="one-mens"><span class="one-avatar">' + veilig(String(x.naar || 'CO').slice(0, 2).toUpperCase()) + '</span><span><b>' + veilig(x.naar || 'Collega') + '</b><small>Neemt tijdelijk over van ' + veilig(x.eigenaar || 'een collega') + '</small></span><span class="one-tot">geldig tot<br>' + veilig(datum(x.geldigTot)) + '</span></div><div class="one-overdracht"><section class="one-blok"><div class="one-blokkop"><span class="one-icoon">1</span>Noodzakelijke context</div><div class="one-check">' + veilig(x.context || 'Geen extra context vastgelegd.') + '</div></section><section class="one-blok"><div class="one-blokkop"><span class="one-icoon">2</span>Open beloften</div>' + regels + '</section><section class="one-blok"><div class="one-blokkop"><span class="one-icoon">3</span>Controle</div><div class="one-check">Status: ' + veilig(x.status || 'onbekend') + '</div><div class="one-check">De overdracht blijft zichtbaar in de auditlijn.</div></section></div><div class="one-waarschuwing"><b>Geen stille rechtenoverdracht.</b> Dit onderdeel bewaart context en open beloften; het geeft zelf geen nieuwe systeemrechten.</div><div class="one-acties"><button class="one-secundair" type="button" data-one-diep="handover">Open register</button><button class="one-primair" type="button" data-one-nieuw="overdracht">Nieuwe overdracht</button></div>';
  }
  w.RTGOneWeergave = Object.freeze({ teken: function (root, stand, huis) {
    vandaag(root, stand || {}, huis); besluit(root, stand || {}, huis); overdracht(root, stand || {});
  } });
}(window));
