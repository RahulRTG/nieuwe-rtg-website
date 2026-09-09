(function (w, d) {
  'use strict';
  var root = d.getElementById('teamRoomVoorzijde');
  var beeld = w.RTGTeamRoomBeeld;
  if (!root || !beeld) return;

  var stand = null, paneel = 'vandaag', dag = 0, lid = null;
  var dossier = { inwerk: [], gesprekken: [], certificaten: [], contracten: [] };
  var dossierVoor = null, dossierBezig = false, diep = false;

  function scherm(naam) {
    paneel = ['vandaag', 'team', 'profiel'].indexOf(naam) >= 0 ? naam : 'vandaag';
    Array.prototype.forEach.call(root.querySelectorAll('[data-trm-paneel]'), function (el) {
      el.hidden = el.getAttribute('data-trm-paneel') !== paneel;
    });
    Array.prototype.forEach.call(root.querySelectorAll('.trm-nav [data-trm-open]'), function (knop) {
      if (knop.getAttribute('data-trm-open') === paneel) knop.setAttribute('aria-current', 'page');
      else knop.removeAttribute('aria-current');
    });
    if (paneel === 'vandaag') beeld.vandaag(root, stand);
    if (paneel === 'team') beeld.team(root, stand, dag);
    if (paneel === 'profiel') beeld.profiel(root, stand, lid, dossier);
    w.scrollTo(0, 0);
  }

  function melding(tekst) {
    var oud = d.querySelector('.trm-melding'); if (oud) oud.remove();
    var el = d.createElement('div'); el.className = 'trm-melding'; el.setAttribute('role', 'status'); el.textContent = tekst;
    d.body.appendChild(el); w.setTimeout(function () { el.remove(); }, 2800);
  }

  function brug() { return w.RTGTeamRoomBrug; }
  async function laadDossier(gekozen) {
    if (!stand || !brug() || dossierBezig) return;
    var id = gekozen && gekozen.id || stand.me.staffId;
    if (dossierVoor === id) return;
    dossierBezig = true; dossierVoor = id;
    try {
      var isManager = stand.me.role === 'manager';
      var hrPad = isManager ? '/supplier/hr/overzicht' : '/supplier/hr/mijn';
      var antwoorden = await Promise.all([
        brug().lees(hrPad, {}),
        brug().lees('/supplier/contracten', {})
      ]);
      dossier = {
        inwerk: antwoorden[0].inwerk || [], gesprekken: antwoorden[0].gesprekken || [],
        certificaten: antwoorden[0].certificaten || [], contracten: antwoorden[1].contracten || []
      };
    } catch (e) {
      dossier = { inwerk: [], gesprekken: [], certificaten: [], contracten: [] };
    } finally {
      dossierBezig = false;
      if (paneel === 'profiel') beeld.profiel(root, stand, lid, dossier);
    }
  }

  function openProfiel(id) {
    var leden = stand && stand.state && stand.state.staff || [];
    lid = leden.find(function (m) { return Number(m.id) === Number(id); }) ||
      { id: stand.me.staffId, name: stand.me.name, role: stand.me.role };
    scherm('profiel'); laadDossier(lid);
  }

  async function startTaak(knop) {
    var taak = stand && stand.taken && stand.taken[Number(knop.dataset.trmStart)];
    if (!taak || !brug()) return;
    knop.disabled = true;
    try {
      if (taak.soort === 'missie') {
        await brug().doe('/supplier/horeca/missions/status', { id: taak.id, status: taak.status === 'nieuw' ? 'bezig' : 'klaar' });
      } else if (taak.soort === 'ticket') {
        await brug().doe('/supplier/ticket/status', { id: taak.id, status: taak.status === 'open' ? 'bezig' : 'klaar' });
      }
      melding(taak.status === 'nieuw' || taak.status === 'open' ? 'De taak is gestart.' : 'De taak is afgerond.');
    } catch (e) {
      melding(e && e.message ? e.message : 'De taak kon niet worden bijgewerkt.');
      knop.disabled = false;
    }
  }

  function toonVoorzijde() {
    if (!stand) return;
    diep = false; root.hidden = false;
    d.body.classList.add('trm-voorzijde-actief');
    var shell = d.getElementById('shell'); if (shell) shell.setAttribute('aria-hidden', 'true');
    scherm(paneel);
  }
  function openDiep(tab) {
    if (!brug()) return;
    diep = true; root.hidden = true; d.body.classList.remove('trm-voorzijde-actief');
    brug().open(tab);
  }
  function ontvang(nieuw) {
    stand = nieuw;
    if (!lid) lid = { id: stand.me.staffId, name: stand.me.name, role: stand.me.role };
    if (!diep) toonVoorzijde();
  }

  root.addEventListener('click', function (e) {
    var knop = e.target.closest('button'); if (!knop || !root.contains(knop)) return;
    if (knop.dataset.trmOpen) scherm(knop.dataset.trmOpen);
    else if (knop.dataset.trmDiep) openDiep(knop.dataset.trmDiep);
    else if (knop.dataset.trmDag != null) { dag = Number(knop.dataset.trmDag) || 0; beeld.team(root, stand, dag); }
    else if (knop.dataset.trmLid) openProfiel(knop.dataset.trmLid);
    else if (knop.dataset.trmStart != null) startTaak(knop);
    else if (knop.hasAttribute('data-trm-profiel')) openProfiel(stand.me.staffId);
  });

  w.RTGTeamRoomVoorzijde = Object.freeze({ ontvang: ontvang, voorzijde: toonVoorzijde, open: scherm });
  if (brug() && brug().snapshot()) ontvang(brug().snapshot());
}(window, document));
