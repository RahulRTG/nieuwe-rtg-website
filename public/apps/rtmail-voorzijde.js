(function (w, d) {
  'use strict';
  var root = d.getElementById('rtmVoorzijde');
  var mail = w.RTGMail;
  if (!root || !mail) return;

  var staat = { berichten: [], huidig: null, adres: '', paneel: 'aandacht' };
  var oudeKop = d.querySelector('body > header');
  var oudeInhoud = d.querySelector('body > #main');

  function vind(q, inRoot) { return (inRoot || root).querySelector(q); }
  function alle(q, inRoot) { return Array.prototype.slice.call((inRoot || root).querySelectorAll(q)); }
  function veilig(v) {
    return String(v == null ? '' : v).replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  }
  function kort(v, lengte) {
    var t = String(v || '').replace(/\s+/g, ' ').trim();
    return t.length > lengte ? t.slice(0, lengte - 1) + '…' : t;
  }
  function initialen(v) {
    var naam = String(v || 'RTG').split('@')[0].replace(/[^a-z0-9]+/gi, ' ').trim();
    var delen = naam.split(/\s+/).filter(Boolean);
    return (delen.length > 1 ? delen[0][0] + delen[delen.length - 1][0] : naam.slice(0, 2)).toUpperCase() || 'RTG';
  }
  function tijd(v) {
    if (!v) return 'Geen tijd';
    var x = new Date(v);
    if (!Number.isFinite(x.getTime())) return String(v);
    var nu = new Date();
    if (x.toDateString() === nu.toDateString()) return x.toLocaleTimeString('nl-NL', { hour: '2-digit', minute: '2-digit' });
    return x.toLocaleDateString('nl-NL', { day: 'numeric', month: 'short' });
  }
  function dagregel() {
    return new Date().toLocaleDateString('nl-NL', { weekday: 'long', day: 'numeric', month: 'long' });
  }
  function score(m) {
    var labels = Array.isArray(m.labels) ? m.labels.length : 0;
    return (m.gelezen ? 0 : 100) + (m.favoriet ? 25 : 0) + labels * 5;
  }
  function betekenis(m) {
    if (!m) return 'Rust';
    if (!m.vertrouwd) return 'Eerst controleren';
    if (!m.gelezen) return 'Nu lezen';
    if (m.favoriet) return 'Door u bewaard';
    return 'Ter informatie';
  }
  function melding(tekst) {
    var el = d.createElement('div');
    el.className = 'rtm-melding';
    el.textContent = tekst;
    d.body.appendChild(el);
    w.setTimeout(function () { el.remove(); }, 2600);
  }

  function openPaneel(naam) {
    staat.paneel = ['aandacht', 'gesprek', 'werk'].indexOf(naam) >= 0 ? naam : 'aandacht';
    alle('[data-rtm-paneel]').forEach(function (el) { el.hidden = el.getAttribute('data-rtm-paneel') !== staat.paneel; });
    alle('[data-rtm-open]').forEach(function (knop) {
      if (knop.getAttribute('data-rtm-open') === staat.paneel) knop.setAttribute('aria-current', 'page');
      else knop.removeAttribute('aria-current');
    });
    w.scrollTo(0, 0);
  }

  function aandachtLeeg(tekst) {
    vind('#rtmFocus').innerHTML = '<div class="rtm-leeg"><h2>Uw aandacht is vrij.</h2><p>' + veilig(tekst || 'Er staat nu niets in uw postvak dat om aandacht vraagt.') + '</p><button class="rtm-secundair" type="button" data-rtm-diep="inbox">Open alle post</button></div>';
    vind('#rtmDaarna').innerHTML = '';
  }

  function renderAandacht(tellingen) {
    var lijst = staat.berichten.slice().sort(function (a, b) {
      var verschil = score(b) - score(a);
      return verschil || String(b.at || '').localeCompare(String(a.at || ''));
    });
    var ongelezen = Number((tellingen || {}).ongelezen || lijst.filter(function (x) { return !x.gelezen; }).length);
    vind('#rtmDag').textContent = dagregel() + ' · ' + (ongelezen ? ongelezen + (ongelezen === 1 ? ' bericht vraagt' : ' berichten vragen') + ' aandacht' : 'geen nieuwe aandacht');
    if (!lijst.length) return aandachtLeeg('Er staat nu niets in uw postvak. Nieuwe post verschijnt hier op betekenisvolle volgorde.');
    staat.huidig = staat.huidig && lijst.find(function (x) { return x.id === staat.huidig.id; }) || lijst[0];
    var m = staat.huidig;
    vind('#rtmFocus').innerHTML =
      '<div class="rtm-focuskop"><span class="rtm-avatar">' + veilig(initialen(m.van)) + '</span>' +
      '<span class="rtm-afzender"><b>' + veilig(m.van || 'RTG') + '</b><span>' + veilig(tijd(m.at)) + (m.vertrouwd ? ' · geverifieerd' : ' · niet geverifieerd') + '</span></span>' +
      '<span class="rtm-label">' + veilig(m.gelezen ? (m.favoriet ? 'Bewaard' : 'Gelezen') : 'Ongelezen') + '</span></div>' +
      '<h2>' + veilig(m.onderwerp || 'Bericht zonder onderwerp') + '</h2>' +
      '<p>' + veilig(kort(m.tekst, 210) || 'Open het gesprek om de volledige inhoud en herkomst te bekijken.') + '</p>' +
      '<div class="rtm-focusvoet"><span class="rtm-betekenis">' + veilig(betekenis(m)) + '</span><button class="rtm-primair" type="button" data-rtm-gesprek="' + veilig(m.id) + '">Open gesprek &rsaquo;</button></div>';
    var daarna = lijst.filter(function (x) { return x.id !== m.id; }).slice(0, 5);
    vind('#rtmDaarna').innerHTML = daarna.length ? daarna.map(function (x) {
      return '<button class="rtm-rij" type="button" data-rtm-gesprek="' + veilig(x.id) + '">' +
        '<span class="rtm-rijtijd">' + veilig(tijd(x.at)) + '</span><span><b>' + veilig(x.onderwerp || 'Bericht zonder onderwerp') +
        '</b><small>' + veilig(x.van || 'Onbekende afzender') + ' · ' + veilig(kort(x.tekst, 92)) + '</small></span>' +
        '<span class="rtm-soort">' + veilig(x.gelezen ? (x.favoriet ? 'Bewaard' : 'Lezen') : 'Nieuw') + '</span></button>';
    }).join('') : '<div class="rtm-leeg">Daarna vraagt niets meer om aandacht.</div>';
  }

  async function laadAandacht() {
    vind('#rtmFocus').innerHTML = '<div class="rtm-leeg">Uw post wordt rustig geordend…</div>';
    try {
      var uit = await mail.api('vak', { map: 'in', limit: 30 });
      staat.berichten = Array.isArray(uit.berichten) ? uit.berichten : [];
      staat.adres = uit.adres || '';
      renderAandacht(uit.tellingen || {});
    } catch (e) {
      staat.berichten = [];
      aandachtLeeg(e && e.message ? e.message : 'RTMail kon uw post niet laden.');
    }
  }

  function huidigOpId(id) {
    return staat.berichten.find(function (m) { return String(m.id) === String(id); }) || staat.huidig;
  }

  async function openGesprek(id) {
    staat.huidig = huidigOpId(id);
    if (!staat.huidig) return melding('Kies eerst een bericht.');
    openPaneel('gesprek');
    if (!w.RTGMailGesprek) return melding('Het gesprek kon niet worden geladen.');
    await w.RTGMailGesprek.open(root, mail, staat.huidig, staat.adres);
  }

  function renderWerk() {
    var m = staat.huidig || staat.berichten[0];
    if (!m) {
      vind('#rtmWerkInhoud').innerHTML = '<div class="rtm-leeg"><h2>Eerst een bron kiezen.</h2><p>Een werkstroom begint altijd bij een echt bericht. Kies er één bij Mijn aandacht.</p><button class="rtm-secundair" type="button" data-rtm-open="aandacht">Naar Mijn aandacht</button></div>';
      return;
    }
    staat.huidig = m;
    if (!w.RTGMailWerkstroom) {
      vind('#rtmWerkInhoud').innerHTML = '<div class="rtm-leeg">De verbinding met RTG One kon niet worden geladen.</div>';
      return;
    }
    w.RTGMailWerkstroom.teken(root, m);
  }

  function diep(soort) {
    root.hidden = true;
    d.body.classList.remove('rtm-voorzijde-actief');
    if (oudeKop) oudeKop.setAttribute('aria-hidden', 'false');
    if (oudeInhoud) oudeInhoud.setAttribute('aria-hidden', 'false');
    if (soort === 'bericht' && staat.huidig && mail.open) mail.open(staat.huidig);
    else mail.laad();
    w.scrollTo(0, 0);
  }
  function voorzijde() {
    root.hidden = false;
    d.body.classList.add('rtm-voorzijde-actief');
    if (oudeKop) oudeKop.setAttribute('aria-hidden', 'true');
    if (oudeInhoud) oudeInhoud.setAttribute('aria-hidden', 'true');
    openPaneel(staat.paneel);
    laadAandacht();
  }

  root.addEventListener('click', function (e) {
    var knop = e.target.closest('button');
    if (!knop || !root.contains(knop)) return;
    if (knop.dataset.rtmGesprek) openGesprek(knop.dataset.rtmGesprek);
    else if (knop.dataset.rtmOpen) {
      if (knop.dataset.rtmOpen === 'gesprek' && !staat.huidig) staat.huidig = staat.berichten[0] || null;
      if (knop.dataset.rtmOpen === 'werk') renderWerk();
      if (knop.dataset.rtmOpen === 'gesprek' && staat.huidig) return openGesprek(staat.huidig.id);
      openPaneel(knop.dataset.rtmOpen);
    } else if (knop.dataset.rtmNaarWerk !== undefined) {
      renderWerk(); openPaneel('werk');
    } else if (knop.dataset.rtmDiep) diep(knop.dataset.rtmDiep);
  });

  if (oudeKop && !vind('.rtm-diep-terug', oudeKop)) {
    var terug = d.createElement('button');
    terug.type = 'button'; terug.className = 'rtm-diep-terug'; terug.textContent = 'Rustig overzicht';
    terug.addEventListener('click', voorzijde); oudeKop.appendChild(terug);
  }

  w.RTGMailVoorzijde = Object.freeze({ open: openPaneel, gesprek: openGesprek, vernieuw: laadAandacht, voorzijde: voorzijde, diep: diep });
  openPaneel('aandacht');
  laadAandacht();
}(window, document));
