(function (w) {
  'use strict';
  function veilig(v) {
    return String(v == null ? '' : v).replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  }
  function initialen(v) {
    var naam = String(v || 'RTG').split('@')[0].replace(/[^a-z0-9]+/gi, ' ').trim();
    var delen = naam.split(/\s+/).filter(Boolean);
    return (delen.length > 1 ? delen[0][0] + delen[delen.length - 1][0] : naam.slice(0, 2)).toUpperCase() || 'RTG';
  }
  function morgen() {
    var x = new Date(Date.now() + 86400000);
    return x.toISOString().slice(0, 10);
  }
  async function nieuwKantoorToken(forceer) {
    var token = null;
    try { token = !forceer && w.localStorage.getItem('rtg_office_token'); } catch (e) {}
    if (token) return token;
    var lid = null;
    try { lid = w.localStorage.getItem('rtg_member_token'); } catch (e) {}
    if (!lid) throw new Error('Log eerst in met uw persoonlijke RTG-account.');
    var antwoord = await w.fetch('/api/account/start', {
      method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + lid }, body: JSON.stringify({ rol: 'kantoor' })
    });
    var data = await antwoord.json().catch(function () { return {}; });
    if (!antwoord.ok || !data.token) throw new Error(data.error || 'Uw personeelsaccount kon niet worden geopend.');
    try { w.localStorage.setItem('rtg_office_token', data.token); } catch (e) {}
    return data.token;
  }
  async function maakWerkstroom(body, forceer) {
    var token = await nieuwKantoorToken(forceer);
    var antwoord = await w.fetch('/api/rtgone/project/van-mail', {
      method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + token }, body: JSON.stringify(body)
    });
    if (antwoord.status === 401 && !forceer) return maakWerkstroom(body, true);
    var data = await antwoord.json().catch(function () { return {}; });
    if (!antwoord.ok) throw new Error(data.error || 'De werkstroom kon niet worden gestart.');
    return data;
  }
  function formulier(root, bericht) {
    var doel = root.querySelector('#rtmWerkInhoud');
    doel.innerHTML =
      '<article class="rtm-bron"><span class="rtm-avatar">' + veilig(initialen(bericht.van)) + '</span><span><b>' + veilig(bericht.onderwerp || 'Bericht zonder onderwerp') + '</b><small>' + veilig(bericht.van || 'RTMail') + ' · bronbericht</small></span><span class="rtm-gekoppeld">Gekoppeld</span></article>' +
      '<form id="rtmWerkForm" class="rtm-werkvorm"><div class="rtm-werkveld"><label for="rtmDoel">Bedoeling</label><textarea id="rtmDoel" name="bedoeling" maxlength="600" required>De vraag uit RTMail zorgvuldig en aantoonbaar afhandelen.</textarea></div>' +
      '<div class="rtm-werkmeta"><div class="rtm-werkveld"><label for="rtmTitel">Werkstroom</label><input id="rtmTitel" name="titel" maxlength="160" value="' + veilig(bericht.onderwerp || 'Werk uit RTMail') + '" required></div>' +
      '<div class="rtm-werkveld"><label for="rtmEigenaar">Eigenaar</label><input id="rtmEigenaar" name="eigenaar" maxlength="100" placeholder="Uit uw personeelsaccount"></div>' +
      '<div class="rtm-werkveld"><label for="rtmDeadline">Uiterlijk</label><input id="rtmDeadline" name="deadline" type="date" min="' + morgen() + '"></div>' +
      '<div class="rtm-werkveld"><label for="rtmRoute">Beoordeling</label><select id="rtmRoute" name="goedkeuringType"><option value="">Geen aparte route</option><option value="operations">Operations</option><option value="finance">Finance</option><option value="legal">Juridisch</option><option value="privacy">Privacy</option><option value="security">Security</option><option value="people">People &amp; Culture</option></select></div></div>' +
      '<div class="rtm-werkveld"><label for="rtmBewijs">Wanneer is het klaar?</label><input id="rtmBewijs" name="bewijs" maxlength="240" placeholder="Beschrijf het aantoonbare resultaat"></div>' +
      '<div class="rtm-werkveld"><label for="rtmVoorWie">Voor wie?</label><input id="rtmVoorWie" name="voorWie" maxlength="160" placeholder="Team, klant of organisatie"></div></form>' +
      '<div class="rtm-pad" aria-label="Van bron naar resultaat"><span class="rtm-stap"><b>1</b><span>Bron</span></span><span class="rtm-stap"><b>2</b><span>Doel</span></span><span class="rtm-stap"><b>3</b><span>Eigenaar</span></span><span class="rtm-stap"><b>4</b><span>Besluit</span></span><span class="rtm-stap"><b>5</b><span>Resultaat</span></span></div>' +
      '<div class="rtm-borging"><b>Context blijft intact.</b> Het oorspronkelijke bericht blijft als bron gekoppeld. RTG One maakt daarna de taken, documentenruimte en eventuele beoordelingsroute.</div>' +
      '<div class="rtm-formfout" id="rtmWerkFout" role="alert"></div><button class="rtm-start" type="submit" form="rtmWerkForm">Start werkstroom in RTG One &rsaquo;</button>';
    doel.querySelector('#rtmWerkForm').addEventListener('submit', function (e) { start(root, bericht, e); });
  }
  async function start(root, bericht, e) {
    e.preventDefault();
    var fout = root.querySelector('#rtmWerkFout');
    var knop = root.querySelector('.rtm-start');
    fout.textContent = '';
    knop.disabled = true;
    knop.textContent = 'Werkstroom voorbereiden…';
    var velden = Object.fromEntries(new w.FormData(e.currentTarget));
    velden.mailId = bericht.id;
    velden.huis = 'rtg';
    velden.impact = 3;
    velden.risico = 3;
    velden.omkeerbaar = true;
    try {
      var uit = await maakWerkstroom(velden, false);
      root.querySelector('#rtmWerkInhoud').innerHTML = '<div class="rtm-klaar"><span class="rtm-klaarzegel">✓</span><h2>De werkstroom staat klaar.</h2><p>Het bronbericht, de bedoeling en het eigenaarschap zijn verbonden aan ' + veilig((uit.project || {}).titel || velden.titel) + '. Vanaf hier houdt RTG One het resultaat en de beslislijn bij elkaar.</p><a class="rtm-primair" href="/apps/rtgone.html?view=workstreams">Open in RTG One &rsaquo;</a></div>';
    } catch (err) {
      fout.textContent = err && err.message ? err.message : 'De werkstroom kon niet worden gestart.';
      knop.disabled = false;
      knop.textContent = 'Start werkstroom in RTG One ›';
    }
  }
  w.RTGMailWerkstroom = Object.freeze({ teken: formulier });
}(window));
