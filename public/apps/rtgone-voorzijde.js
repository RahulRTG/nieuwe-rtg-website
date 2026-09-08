(function (w, d) {
  'use strict';
  var root = d.getElementById('oneVoorzijde');
  if (!root) return;
  var stand = null, huis = 'rtg', paneel = 'werkdag';
  var oudKop = d.querySelector('body > .top'), oudWerk = d.querySelector('body > .layout');
  function vind(q, inRoot) { return (inRoot || root).querySelector(q); }
  function alle(q, inRoot) { return Array.prototype.slice.call((inRoot || root).querySelectorAll(q)); }
  function openPaneel(naam) {
    paneel = ['werkdag', 'besluit', 'overdracht'].indexOf(naam) >= 0 ? naam : 'werkdag';
    d.body.setAttribute('data-one-scherm', paneel);
    alle('[data-one-paneel]').forEach(function (el) { el.hidden = el.getAttribute('data-one-paneel') !== paneel; });
    alle('[data-one-open]').forEach(function (knop) {
      if (knop.getAttribute('data-one-open') === paneel) knop.setAttribute('aria-current', 'page');
      else knop.removeAttribute('aria-current');
    });
    w.scrollTo(0, 0);
  }
  function diep(view) {
    root.hidden = true;
    d.body.classList.remove('one-voorzijde-actief');
    [oudKop, oudWerk].forEach(function (el) { if (el) el.setAttribute('aria-hidden', 'false'); });
    var knop = d.querySelector('[data-view="' + view + '"]');
    if (knop) knop.click();
    w.scrollTo(0, 0);
  }
  function voorzijde() {
    root.hidden = false;
    d.body.classList.add('one-voorzijde-actief');
    [oudKop, oudWerk].forEach(function (el) { if (el) el.setAttribute('aria-hidden', 'true'); });
    openPaneel(paneel);
  }
  function render() { if (stand && w.RTGOneWeergave) w.RTGOneWeergave.teken(root, stand, huis); }
  root.addEventListener('click', function (e) {
    var knop = e.target.closest('button'); if (!knop || !root.contains(knop)) return;
    if (knop.dataset.oneOpen) openPaneel(knop.dataset.oneOpen);
    else if (knop.dataset.oneSpring) openPaneel(knop.dataset.oneSpring);
    else if (knop.dataset.oneDiep) diep(knop.dataset.oneDiep);
    else if (knop.dataset.oneHuis) {
      alle('[data-one-huis]').forEach(function (b) { b.setAttribute('aria-pressed', String(b === knop)); });
      var bron = d.querySelector('[data-house="' + knop.dataset.oneHuis + '"]'); if (bron) bron.click();
    } else if (knop.dataset.oneNieuw === 'besluit' && typeof w.decisionForm === 'function') w.decisionForm();
    else if (knop.dataset.oneNieuw === 'overdracht' && typeof w.openForm === 'function') w.openForm('handover');
    else if (knop.dataset.oneRoom) w.location.href = '/apps/decision-room.html?id=' + encodeURIComponent(knop.dataset.oneRoom) + '&huis=' + encodeURIComponent(huis);
    else if (knop.dataset.oneBeslis && typeof w.act === 'function') w.act('goedkeuring/beslis', { id: knop.dataset.id, besluit: knop.dataset.oneBeslis }, knop.dataset.oneBeslis === 'afwijzen' ? 'Aanvraag afgewezen' : 'Uw besluit is vastgelegd');
  });
  if (oudKop && !vind('[data-one-terug]', oudKop)) {
    var terug = d.createElement('button'); terug.type = 'button'; terug.className = 'one-terug'; terug.dataset.oneTerug = '';
    terug.textContent = 'Rustig overzicht'; terug.addEventListener('click', voorzijde); oudKop.appendChild(terug);
  }
  var start = new URLSearchParams(w.location.search).get('view');
  if (start === 'decisions') paneel = 'besluit'; else if (start === 'handover') paneel = 'overdracht';
  openPaneel(paneel);
  w.RTGOneVoorzijde = Object.freeze({
    ontvang: function (nieuw, nieuwHuis) {
      stand = nieuw || {}; huis = ['rtg', 'rtf', 'gedeeld'].indexOf(nieuwHuis) >= 0 ? nieuwHuis : (stand.huis || 'rtg');
      alle('[data-one-huis]').forEach(function (b) { b.setAttribute('aria-pressed', String(b.dataset.oneHuis === huis)); }); render();
    },
    fout: function (melding) { vind('#oneFocus').innerHTML = '<span class="one-label">Verbinding</span><h2>RTG One kon niet laden.</h2><p></p>'; vind('#oneFocus p').textContent = melding || 'Probeer het opnieuw.'; },
    open: openPaneel,
    diep: diep
  });
}(window, document));
