(function (w) {
  'use strict';
  function datum(v) {
    if (!v) return 'Geen deadline'; var d = new Date(v), t = d.getTime();
    return Number.isFinite(t) ? d.toLocaleDateString('nl-NL', { day: 'numeric', month: 'short' }) : String(v);
  }
  function voortgang(p) {
    var taken = p.taken || [], klaar = taken.filter(function (t) { return t.af; }).length;
    return { klaar: klaar, totaal: taken.length, pct: p.status === 'afgerond' ? 100 : Number(p.voortgang || 0) };
  }
  function bedoeling(staat, p) {
    var x = (staat.intenties || []).find(function (i) { return i.id === p.intentieId; });
    return x && x.waarom || 'De oorspronkelijke bedoeling staat nog niet afzonderlijk beschreven.';
  }
  function teken(root, staat, gekozenId) {
    var U = w.ProjectRoomUtil, projecten = staat.projecten || [], actief = projecten.filter(function (p) { return p.status !== 'afgerond'; });
    root.querySelector('#prDag').textContent = (staat.huis || 'rtg').toUpperCase() + ' · ' + actief.length + (actief.length === 1 ? ' actief project' : ' actieve projecten');
    var vak = root.querySelector('#prUitvoering');
    if (!projecten.length) {
      vak.innerHTML = '<div class="pr-leeg"><h2>Nog geen project om uit te voeren.</h2><p>Een project ontstaat uit een echte vraag in RTMail en bewaart die bron vanaf het eerste moment.</p><a class="pr-primair" href="/apps/rtmail.html">Open RTMail</a></div>'; return null;
    }
    var p = projecten.find(function (x) { return String(x.id) === String(gekozenId || ''); }) || actief[0] || projecten[0];
    var v = voortgang(p), taken = p.taken || [], eerste = taken.find(function (t) { return !t.af; });
    var focus = eerste ? '<span class="pr-label">Volgende stap</span><h2>' + U.veilig(eerste.tekst) + '</h2><p>' + U.veilig(bedoeling(staat, p)) + '</p>' : '<span class="pr-label klaar">Uitvoering gereed</span><h2>Alle uitvoeringstaken zijn afgerond.</h2><p>Controleer nu of het resultaat met echt bewijs kan worden opgeleverd.</p>';
    var actie = eerste ? '<button class="pr-primair" type="button" data-pr-taak="' + U.veilig(eerste.id) + '">Markeer deze stap als gereed →</button>' : '<button class="pr-primair" type="button" data-pr-open="oplevering">Naar menselijke oplevering →</button>';
    var html = '<article class="pr-focus"><div class="pr-focusbody"><div class="pr-focusmeta"><span class="pr-label">' + U.veilig(p.status || 'project') + '</span><span>' + U.veilig(p.titel) + '</span></div>' + focus + '<div class="pr-eigenaar"><span class="pr-avatar">' + U.initialen(p.eigenaar) + '</span><span><b>' + U.veilig(p.eigenaar || 'Eigenaar onbekend') + '</b><small>Projecteigenaar · één aanspreekpunt</small></span></div><div class="pr-voortgang" role="progressbar" aria-label="Projectvoortgang" aria-valuemin="0" aria-valuemax="100" aria-valuenow="' + v.pct + '"><i data-pr-voortgang="' + Math.max(0, Math.min(100, v.pct)) + '"></i></div><div class="pr-metertekst"><span>' + v.pct + '% uitgevoerd</span><span>' + v.klaar + ' van ' + v.totaal + ' taken</span></div><div class="pr-focusvoet"><small>' + U.veilig(datum(p.deadline)) + '<br>Bron en besluit blijven gekoppeld</small>' + actie + '</div></div><div class="pr-focusstats"><div class="pr-focusstat"><small>Taken</small><b>' + v.klaar + ' / ' + v.totaal + '</b></div><div class="pr-focusstat"><small>Bewijs</small><b>' + (p.bewijs || []).length + '</b></div><div class="pr-focusstat"><small>Besluit</small><b>' + U.veilig(p.goedkeuringId ? 'Gekoppeld' : 'Niet nodig') + '</b></div></div></article>';
    html += '<div class="pr-sectiekop"><h2>Uitvoeringsroute</h2><span>Op volgorde van afhankelijkheid</span></div><div class="pr-lijst">';
    var eersteOpenGezien = false;
    html += taken.length ? taken.map(function (t, i) {
      var status, bediening = '';
      if (t.af) { status = 'Gereed'; bediening = '<button class="pr-taakactie af" type="button" data-pr-taak="' + U.veilig(t.id) + '" data-pr-af="false">Heropen</button>'; }
      else if (!eersteOpenGezien) { eersteOpenGezien = true; status = 'Nu'; bediening = '<button class="pr-taakactie" type="button" data-pr-taak="' + U.veilig(t.id) + '">Afronden</button>'; }
      else status = 'Wacht';
      return '<div class="pr-rij"><span class="pr-nummer">' + String(i + 1).padStart(2, '0') + '</span><span><b>' + U.veilig(t.tekst) + '</b><small>' + (t.besluitId ? 'Ontstaan uit goedgekeurd besluit' : 'Onderdeel van de projectroute') + '</small></span><span class="pr-rijstatus">' + bediening + (bediening ? '' : U.veilig(status)) + '</span></div>';
    }).join('') : '<div class="pr-leeg">Voor dit project zijn nog geen uitvoeringstaken vastgelegd.</div>';
    var andere = projecten.filter(function (x) { return x.id !== p.id; }).slice(0, 6);
    if (andere.length) html += '</div><div class="pr-sectiekop"><h2>Andere projecten</h2><span>Kies een dossier</span></div><div class="pr-lijst">' + andere.map(function (x, i) { return '<button class="pr-rij" type="button" data-pr-kies="' + U.veilig(x.id) + '"><span class="pr-nummer">' + String(i + 1).padStart(2, '0') + '</span><span><b>' + U.veilig(x.titel) + '</b><small>' + U.veilig(x.eigenaar || 'eigenaar onbekend') + ' · ' + U.veilig(x.status || 'onbekend') + '</small></span><span class="pr-rijstatus">Open →</span></button>'; }).join('');
    vak.innerHTML = html + '</div>';
    var meter = vak.querySelector('[data-pr-voortgang]'); if (meter) meter.style.width = meter.dataset.prVoortgang + '%';
    return p.id;
  }
  w.ProjectRoomUitvoering = Object.freeze({ teken: teken, voortgang: voortgang, bedoeling: bedoeling });
}(window));
