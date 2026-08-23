/* Tekent alleen wat de bestaande domeinroutes hebben teruggegeven. */
(function (w, d) {
  'use strict';
  var $ = function (s) { return d.querySelector(s); };
  function bron(s, naam) { return (s.data && s.data.bronnen || []).find(function (b) { return b.naam === naam; }); }
  function data(s, naam) { var b = bron(s, naam); return b && b.ok ? b.data : null; }
  function geld(c) { return Number.isFinite(c) ? new Intl.NumberFormat('nl-NL', { style: 'currency', currency: 'EUR', maximumFractionDigits: 0 }).format(c / 100) : 'Niet bekend'; }
  function datum(x) { var v = new Date(x); return isNaN(v) ? String(x || 'Niet bekend') : v.toLocaleString('nl-NL', { dateStyle: 'medium', timeStyle: 'short' }); }
  function zet(id, tekst) { var el = $('#' + id); if (el) el.textContent = tekst; }
  function stand(s) { var bs = s.data && s.data.bronnen || [], goed = bs.filter(function (b) { return b.ok; }).length; return { goed: goed, totaal: bs.length, stuk: bs.filter(function (b) { return !b.ok; }) }; }
  function regel(vak, x) {
    var a = d.createElement('article'), t = d.createElement('time'), i = d.createElement('i'), p = d.createElement('p'), b = d.createElement('b'), sm = d.createElement('small'), e = d.createElement('em');
    t.textContent = x.top || 'Niet bekend'; b.textContent = x.title || 'Onbekend'; sm.textContent = x.sub || ''; e.textContent = x.mark || ''; p.append(b, sm); a.append(t, i, p, e); vak.appendChild(a);
  }
  function context(s) {
    var o = data(s, 'Privékantoor'), st = stand(s), pol = data(s, 'Mandaten');
    zet('loIdentity', o && o.naam ? o.naam : s.data && s.data.ingelogd ? 'RTG-lid' : 'Geen sessie');
    zet('loIntentQuote', o ? o.kop + '. Dit beeld komt rechtstreeks uit uw Privékantoor.' : s.data && s.data.ingelogd ? 'Uw Privékantoor is niet beschikbaar voor deze pas of antwoordt niet.' : s.data && s.data.sessieVerlopen ? 'Uw sessie is verlopen. Log opnieuw in; er worden geen voorbeeldgegevens getoond.' : 'Log in om uw actuele leefcontext veilig samen te stellen.');
    zet('loCompleteness', st.totaal ? st.goed + '/' + st.totaal + ' BRONNEN' : 'NIET VERBONDEN');
    zet('loStatus', o ? o.kop : 'Geen actueel Privékantoorbeeld');
    zet('loWeek', o ? o.tellingen.dezeWeek + ' termijn(en) deze week · ' + o.tellingen.beslissingen + ' besluit(en)' : 'Geen actuele telling');
    zet('loGraph', o ? o.graaf.knopen + ' knopen uit bestaande RTG-dossiers' : 'Geen leefgraaf geladen');
    var vak = $('#loPolicies'); vak.textContent = ''; var dom = pol && pol.domeinen || [];
    if (!dom.length) { var leeg = d.createElement('p'); leeg.textContent = 'Geen mandaten beschikbaar.'; vak.appendChild(leeg); return; }
    dom.slice(0, 5).forEach(function (x) { var p = d.createElement('p'), b = d.createElement('b'), span = d.createElement('span'); p.className = 'lo-policy-row'; b.textContent = x.naam; span.textContent = 'L' + x.niveau + ' / max L' + x.dak + (x.grensCenten ? ' · ' + geld(x.grensCenten) : ''); p.append(b, span); vak.appendChild(p); });
  }
  function horizon(s) {
    var tower = data(s, 'Control Tower'), uit = [];
    if (!tower) return uit;
    (tower.achterstallig || []).forEach(function (x) { uit.push({ top: 'VERLOPEN', title: (x.waarvan ? x.waarvan + ' · ' : '') + x.wat, sub: x.datum + ' · ' + x.bron, mark: '!' }); });
    (tower.vensters || []).forEach(function (v) { (v.items || []).forEach(function (x) { uit.push({ top: x.datum, title: (x.waarvan ? x.waarvan + ' · ' : '') + x.naam, sub: v.label + ' · ' + x.bron, mark: x.dagen + 'd' }); }); });
    return uit;
  }
  function world(s) {
    var o = data(s, 'Privékantoor'), g = data(s, 'Geld'), reizen = data(s, 'Reizen'), agenda = data(s, 'Agenda'), st = stand(s), vak = $('#loTimeline'); vak.textContent = '';
    zet('capMoney', g ? geld(g.cijfers && g.cijfers.vrijCenten) : 'Niet bekend'); zet('capTime', agenda ? String((agenda.items || []).length + (agenda.ecosysteem || []).length) : 'Niet bekend');
    zet('capTravel', reizen ? String((reizen.komend || []).length) : 'Niet bekend'); zet('capPeople', o ? String(o.graaf.knopen) : 'Niet bekend'); zet('capLife', st.totaal ? st.goed + '/' + st.totaal : 'Niet bekend');
    zet('loMissing', st.stuk.length ? st.stuk.map(function (x) { return x.naam; }).join(', ') : st.totaal ? 'geen' : 'niet gecontroleerd'); zet('loChecked', s.data ? datum(s.data.gecontroleerd) : 'Niet bekend'); zet('loSlaState', st.totaal && st.goed === st.totaal ? 'VOLLEDIG' : st.totaal ? 'ONVOLLEDIG' : 'ONBEKEND');
    var lijst = horizon(s);
    if (s.world === 'now') { zet('loWorldLabel', st.totaal ? 'LIVE · ' + st.goed + '/' + st.totaal + ' BRONNEN' : 'GEEN SESSIE'); zet('loWorldTitle', o ? o.kop : 'Geen actueel leefbeeld.'); zet('loWorldScore', o ? String(o.tellingen.beslissingen) : 'Niet bekend'); zet('loWorldUnit', 'besluiten'); lijst = lijst.slice(0, 5); }
    else if (s.world === 'horizon') { zet('loWorldLabel', 'CONTROL TOWER · 90 DAGEN'); zet('loWorldTitle', lijst.length ? lijst.length + ' echte termijn(en) in beeld.' : 'Geen termijnen in de horizon.'); zet('loWorldScore', String(lijst.length)); zet('loWorldUnit', 'termijnen'); lijst = lijst.slice(0, 8); }
    else { zet('loWorldLabel', 'BRONCONTROLE'); zet('loWorldTitle', st.stuk.length ? st.stuk.length + ' bron(nen) ontbreken.' : st.totaal ? 'Alle bronnen antwoordden.' : 'Niet gecontroleerd.'); zet('loWorldScore', st.totaal ? st.goed + '/' + st.totaal : 'Niet bekend'); zet('loWorldUnit', 'bereikbaar'); lijst = (s.data && s.data.bronnen || []).map(function (b) { return { top: b.ok ? 'BEREIKBAAR' : 'NIET BESCHIKBAAR', title: b.naam, sub: b.ok ? 'Actueel opgehaald' : b.error, mark: b.ok ? '✓' : '!' }; }); }
    if (!lijst.length) { var p = d.createElement('p'); p.textContent = s.data && s.data.ingelogd ? 'Er zijn geen actuele regels voor dit vlak.' : 'Log in; er worden geen voorbeeldregels getoond.'; vak.appendChild(p); } else lijst.forEach(function (x) { regel(vak, x); });
  }
  function decisions(s) {
    var c = data(s, 'Besluiten') || {}, zaken = c.zaken || [], wacht = zaken.filter(function (x) { return x.beslissing && x.beslissing.nodig; }), lopend = zaken.filter(function (x) { return x.status === 'in uitvoering'; }), pol = data(s, 'Mandaten'); s.decision = wacht[0] || null;
    zet('loDecisionBadge', String(wacht.length)); zet('loDecisionCount', String(wacht.length)); zet('loRunningCount', String(lopend.length)); zet('loDecisionLine', wacht.length ? wacht.length + ' echte beslissing(en) uit het Privékantoor' : 'Niets wacht op uw akkoord');
    zet('loDecisionPosition', wacht.length ? 'BESLISSING 1 VAN ' + wacht.length : 'ACTUELE WERKVOORRAAD'); zet('loDecisionTitle', s.decision ? s.decision.titel : 'Geen besluit geselecteerd.'); zet('loDecisionText', s.decision ? s.decision.delegatie.reden : s.data && s.data.ingelogd ? 'Er ligt nu niets voor uw akkoord klaar.' : 'Log in om echte beslissingen op te halen.');
    zet('loWhyText', s.decision ? s.decision.domein + ' · ' + s.decision.status + ' · ' + (s.decision.bedragCenten ? geld(s.decision.bedragCenten) : 'geen bedrag') : 'Er is geen actief besluit met een controlespoor.');
    var knop = $('#loApprove'); knop.disabled = !s.decision; knop.textContent = s.decision ? 'Controleer akkoord →' : 'Geen besluit';
    var vak = $('#loMandates'); vak.textContent = ''; var dom = pol && pol.domeinen || []; zet('loMandateCount', dom.length + ' DOMEINEN');
    dom.slice(0, 3).forEach(function (x) { var p = d.createElement('p'), i = d.createElement('i'), span = d.createElement('span'), b = d.createElement('b'), sm = d.createElement('small'), e = d.createElement('em'); i.textContent = 'L' + x.niveau; b.textContent = x.naam; sm.textContent = x.grensCenten ? 'grens ' + geld(x.grensCenten) : 'geen geldgrens'; e.textContent = 'max L' + x.dak; span.append(b, sm); p.append(i, span, e); vak.appendChild(p); });
  }
  function all(s) { context(s); world(s); decisions(s); var st = stand(s); zet('loHealth', st.totaal ? st.goed + '/' + st.totaal + ' bronnen actueel' : 'Log in voor live bronnen'); $('#loHealthDot').style.background = st.totaal && st.goed === st.totaal ? '#72bd94' : '#c0a544'; zet('loSourceLine', st.totaal ? st.goed + ' bereikbaar · ' + st.stuk.length + ' niet opgehaald' : 'Nog niet gecontroleerd'); }
  w.RTGLivingRender = { all: all, world: world };
})(window, document);
