(function (w, d) {
  'use strict';
  var root = d.getElementById('rtdVoorzijde');
  var office = w.RTGOffice;
  if (!root || !office || !w.RTGDocsDossier || !w.RTGDocsBesluit) return;
  var staat = { documenten: [], huidig: null, paneel: 'nodig' };
  var oudeKop = d.querySelector('body > .kop');
  var oudeMain = d.querySelector('body > main');
  function vind(q) { return root.querySelector(q); }
  function alle(q) { return Array.prototype.slice.call(root.querySelectorAll(q)); }
  function veilig(v) { return RTGDocsDossier.veilig(v); }
  function datum(v) {
    var x = new Date(v);
    if (!Number.isFinite(x.getTime())) return 'tijd onbekend';
    var nu = new Date();
    if (x.toDateString() === nu.toDateString()) return 'vandaag ' + x.toLocaleTimeString('nl-NL', { hour: '2-digit', minute: '2-digit' });
    return x.toLocaleDateString('nl-NL', { day: 'numeric', month: 'short' });
  }
  function type(v) { return ({ tekst: 'DOC', blad: 'XLS', presentatie: 'PRES', formulier: 'FORM', schets: 'SCH', bord: 'BORD' })[v] || 'DOC'; }
  function fase(v) { return RTGDocsDossier.faseNaam(v || 'concept'); }
  function reden(doc) {
    var vandaag = new Date().toISOString().slice(0, 10);
    if (doc.herzienOp && doc.herzienOp < vandaag) return 'Herziening is verstreken';
    if (doc.fase === 'beoordeling') return 'Wacht op menselijke beoordeling';
    if (Number(doc.openActies) > 0) return doc.openActies + (Number(doc.openActies) === 1 ? ' open actie' : ' open acties');
    if (doc.fase === 'goedgekeurd') return 'Geldige, goedgekeurde versie';
    if (!doc.vanMij) return 'Met u gedeeld';
    return 'Laatste geldige werkversie';
  }
  function gewicht(doc) {
    var vandaag = new Date().toISOString().slice(0, 10), n = 0;
    if (doc.herzienOp && doc.herzienOp < vandaag) n += 500;
    if (doc.fase === 'beoordeling') n += 400;
    n += Number(doc.openActies || 0) * 40;
    if (doc.ster) n += 100;
    if (doc.fase === 'goedgekeurd') n += 20;
    return n;
  }
  function melding(tekst) {
    var el = d.createElement('div'); el.className = 'rtd-melding'; el.textContent = tekst;
    d.body.appendChild(el); w.setTimeout(function () { el.remove(); }, 2800);
  }
  function openPaneel(naam) {
    staat.paneel = ['nodig', 'dossier', 'besluit'].indexOf(naam) >= 0 ? naam : 'nodig';
    alle('[data-rtd-paneel]').forEach(function (el) { el.hidden = el.getAttribute('data-rtd-paneel') !== staat.paneel; });
    alle('.rtd-nav [data-rtd-open]').forEach(function (knop) {
      if (knop.getAttribute('data-rtd-open') === staat.paneel) knop.setAttribute('aria-current', 'page');
      else knop.removeAttribute('aria-current');
    });
    w.scrollTo(0, 0);
  }
  function leeg(tekst) {
    vind('#rtdDag').textContent = 'Uw werkmoment · rustig';
    vind('#rtdFocus').innerHTML = '<div class="rtd-leeg"><h2>Nog geen document nodig.</h2><p>' + veilig(tekst || 'Uw documentruimte is leeg.') + '</p><button class="rtd-secundair" type="button" data-rtd-nieuw>Maak een document</button></div>';
    vind('#rtdDaarna').innerHTML = '';
  }
  function renderNodig() {
    var lijst = staat.documenten.slice().sort(function (a, b) {
      return gewicht(b) - gewicht(a) || String(b.gewijzigd || '').localeCompare(String(a.gewijzigd || ''));
    });
    vind('#rtdDag').textContent = new Date().toLocaleDateString('nl-NL', { weekday: 'long', day: 'numeric', month: 'long' }) + ' · ' + lijst.length + (lijst.length === 1 ? ' document' : ' documenten');
    if (!lijst.length) return leeg('Maak het eerste stuk; RTDocs bewaart daarna de versie, context en beoordeling bij elkaar.');
    staat.huidig = staat.huidig && lijst.find(function (x) { return x.id === staat.huidig.id; }) || lijst[0];
    var doc = staat.huidig;
    vind('#rtdFocus').innerHTML = '<div class="rtd-focuskop"><span class="rtd-docicoon">' + veilig(type(doc.soort)) + '</span>' +
      '<span class="rtd-eigenaar"><b>' + veilig(doc.door || 'Uw documentruimte') + '</b><span>' + veilig((doc.versies || 0) + (doc.versies === 1 ? ' eerdere versie' : ' eerdere versies') + ' · ' + datum(doc.gewijzigd)) + '</span></span>' +
      '<span class="rtd-status">' + veilig(fase(doc.fase)) + '</span></div><h2>' + veilig(doc.titel || 'Document zonder titel') + '</h2>' +
      '<p>' + veilig(reden(doc)) + '. RTDocs opent dit stuk met de actuele inhoud, historie en betrokkenen.</p>' +
      '<div class="rtd-focusvoet"><span class="rtd-moment">' + veilig(doc.omvang || type(doc.soort)) + '</span><button class="rtd-primair" type="button" data-rtd-dossier="' + veilig(doc.id) + '">Open dossier &rsaquo;</button></div>';
    var daarna = lijst.filter(function (x) { return x.id !== doc.id; }).slice(0, 5);
    vind('#rtdDaarna').innerHTML = daarna.length ? daarna.map(function (x) {
      return '<button class="rtd-rij" type="button" data-rtd-dossier="' + veilig(x.id) + '"><span class="rtd-kleinbestand">' + veilig(type(x.soort)) + '</span><span><b>' + veilig(x.titel) + '</b><small>' + veilig(reden(x)) + ' · ' + veilig(datum(x.gewijzigd)) + '</small></span><span class="rtd-type">' + veilig(fase(x.fase)) + '</span></button>';
    }).join('') : '<div class="rtd-leeg">Daarna vraagt geen ander document om aandacht.</div>';
  }
  async function laad() {
    vind('#rtdFocus').innerHTML = '<div class="rtd-leeg">Uw documenten worden geordend…</div>';
    try {
      var uit = await office.api('mijn');
      if (uit.status !== 200) throw new Error(uit.body.error || 'Log eerst in om uw documenten te zien.');
      staat.documenten = (uit.body.docs || []).concat(uit.body.gedeeld || []);
      renderNodig();
    } catch (e) { staat.documenten = []; leeg(e.message || String(e)); }
  }
  function kies(id) { return staat.documenten.find(function (x) { return String(x.id) === String(id); }) || staat.huidig || staat.documenten[0]; }
  async function openDossier(id) {
    var kop = kies(id);
    if (!kop) { openPaneel('nodig'); return melding('Kies eerst een document.'); }
    staat.huidig = kop; openPaneel('dossier');
    await RTGDocsDossier.open(root, office, kop);
  }
  function renderBesluit() {
    var actueel = RTGDocsDossier.actueel();
    if (!actueel && staat.huidig) return openDossier(staat.huidig.id).then(function () { RTGDocsBesluit.teken(root, RTGDocsDossier.actueel()); openPaneel('besluit'); });
    RTGDocsBesluit.teken(root, actueel); openPaneel('besluit');
  }
  function diep(id, versies) {
    root.hidden = true; d.body.classList.remove('rtd-voorzijde-actief');
    if (oudeKop) oudeKop.setAttribute('aria-hidden', 'false');
    if (oudeMain) oudeMain.setAttribute('aria-hidden', 'false');
    w.scrollTo(0, 0);
    if (id) office.openen(id).then(function () {
      if (versies) { var knop = d.getElementById('versiesBtn'); if (knop) knop.click(); }
    });
  }
  function decisionRoom(id) {
    var actueel = RTGDocsDossier.actueel(), doc = actueel && actueel.doc || kies(id), p = new URLSearchParams(location.search);
    var huis = p.get('bedrijf') === 'rtf' ? 'rtf' : 'rtg';
    var q = new URLSearchParams({ huis: huis, document: String(id || doc && doc.id || ''), titel: String(doc && doc.titel || 'RTDocs-document') });
    if (p.get('project')) q.set('project', p.get('project'));
    if (p.get('bron')) q.set('mail', p.get('bron'));
    location.href = '/apps/decision-room.html?' + q.toString();
  }
  function voorzijde() {
    root.hidden = false; d.body.classList.add('rtd-voorzijde-actief');
    if (oudeKop) oudeKop.setAttribute('aria-hidden', 'true');
    if (oudeMain) oudeMain.setAttribute('aria-hidden', 'true');
    openPaneel(staat.paneel); laad();
  }
  root.addEventListener('click', async function (e) {
    var knop = e.target.closest('button'); if (!knop || !root.contains(knop)) return;
    if (knop.dataset.rtdDossier) await openDossier(knop.dataset.rtdDossier);
    else if (knop.dataset.rtdOpen === 'dossier') await openDossier(staat.huidig && staat.huidig.id);
    else if (knop.dataset.rtdOpen === 'besluit') renderBesluit();
    else if (knop.dataset.rtdOpen) openPaneel(knop.dataset.rtdOpen);
    else if (knop.dataset.rtdDiep) diep();
    else if (knop.dataset.rtdNieuw !== undefined) { diep(); office.nieuw('tekst'); }
    else if (knop.dataset.rtdVersies) diep(knop.dataset.rtdVersies, true);
    else if (knop.dataset.rtdRoom) decisionRoom(knop.dataset.rtdRoom);
    else if (knop.dataset.rtdDocument) diep(knop.dataset.rtdDocument, false);
    else if (knop.dataset.rtdVraag) {
      var uit = await RTGDocsBesluit.vraag(root, office, RTGDocsDossier.actueel());
      melding(uit.ok ? 'Beoordeling is aangevraagd. Een mens blijft aan zet.' : uit.fout);
      if (uit.ok) laad();
    }
  });
  if (oudeKop && !oudeKop.querySelector('.rtd-diep-terug')) {
    var terug = d.createElement('button'); terug.type = 'button'; terug.className = 'rtd-diep-terug'; terug.textContent = 'Rustig overzicht';
    terug.addEventListener('click', voorzijde); oudeKop.appendChild(terug);
  }
  w.RTGDocs = Object.freeze({ vernieuw: laad, dossier: openDossier, voorzijde: voorzijde, diep: diep });
  openPaneel('nodig'); laad();
}(window, document));
