(function (R) {
  'use strict';
  var $ = R.$, $$ = R.$$, maak = R.maak, S = R.staat;
  R.plekSpec = function (plek) {
    if (!plek) return null;
    if (plek.soort === 'zaak') return { zaak: plek.code };
    if (plek.soort === 'halte') return { halte: plek.code };
    if (plek.soort === 'favoriet') return { favoriet: plek.code };
    if (Number.isFinite(plek.lat) && Number.isFinite(plek.lng)) return { lat: plek.lat, lng: plek.lng, label: plek.naam || plek.label };
    return null;
  };
  R.gekozenVertrek = function () {
    if (S.vertrek && Number.isFinite(S.vertrek.lat)) return { lat: S.vertrek.lat, lng: S.vertrek.lng, label: S.vertrek.label || 'Huidige locatie' };
    var tekst = $('#vanVeld').value.trim(), bekend = R.plekken.find(function (p) { return p.naam.toLowerCase() === tekst.toLowerCase(); });
    if (bekend) return R.plekSpec(bekend);
    if (tekst.toLowerCase() === 'huidige locatie') return R.token ? { hier: true } : { lat: 52.3676, lng: 4.9041, label: 'Huidige locatie' };
    return null;
  };
  R.gekozenBestemming = function () {
    var tekst = $('#naarVeld').value.trim();
    if (S.bestemming && String(S.bestemming.naam || '').toLowerCase() === tekst.toLowerCase()) return R.plekSpec(S.bestemming);
    var bekend = R.plekken.find(function (p) { return p.naam.toLowerCase() === tekst.toLowerCase(); });
    if (bekend) { S.bestemming = bekend; return R.plekSpec(bekend); }
    return null;
  };
  function toonSuggesties(lijst) {
    var doel = $('#bestemmingSuggesties'); doel.textContent = '';
    if (!lijst.length) { doel.hidden = true; $('#naarVeld').setAttribute('aria-expanded', 'false'); return; }
    lijst.slice(0, 7).forEach(function (plek) {
      var b = maak('button'); b.type = 'button'; b.setAttribute('role', 'option');
      b.appendChild(maak('span', '', plek.naam || plek.label || 'Bestemming'));
      b.appendChild(maak('small', '', plek.sub || [plek.genre, plek.stad].filter(Boolean).join(' · ')));
      b.addEventListener('click', function () { S.bestemming = plek; $('#naarVeld').value = plek.naam || plek.label;
        doel.hidden = true; $('#naarVeld').setAttribute('aria-expanded', 'false'); updateRouteIndicatie(); });
      doel.appendChild(b);
    });
    doel.hidden = false; $('#naarVeld').setAttribute('aria-expanded', 'true');
  }
  function zoekBestemming() {
    var q = $('#naarVeld').value.trim(); S.bestemming = null; clearTimeout(S.zoekTimer);
    S.zoekTimer = setTimeout(function () {
      var lokaal = R.plekken.filter(function (p) { return p.naam.toLowerCase().includes(q.toLowerCase()); });
      if (!R.token || q.length < 2) { toonSuggesties(lokaal); return; }
      R.api('/api/mob/plekken', { zoek: q, limiet: 10 }).then(function (d) {
        toonSuggesties(lokaal.concat((d.plekken || []).filter(function (p) {
          return !lokaal.some(function (l) { return l.naam.toLowerCase() === String(p.naam || '').toLowerCase(); });
        })));
      }).catch(function () { toonSuggesties(lokaal); });
    }, 180);
  }
  function updateRouteIndicatie() {
    var ibiza = $('#naarVeld').value.toLowerCase().includes('ibiza');
    $('#ritDuur').firstChild.nodeValue = ibiza ? '18 ' : '34 ';
    $('#ritAfstand').firstChild.nodeValue = ibiza ? '14 ' : '42 ';
  }
  R.kiesVoertuig = function (knop) {
    if (!knop || knop.disabled) return;
    $$('.voertuig').forEach(function (b) { var aan = b === knop; b.classList.toggle('actief', aan); b.setAttribute('aria-pressed', String(aan)); });
    S.voertuig = knop.dataset.voertuig; S.voertuigLabel = knop.dataset.label; S.indicatie = Number(knop.dataset.prijs);
    $('#boekRit span').textContent = 'VRAAG ' + S.voertuigLabel + ' AAN · ± €' + S.indicatie;
  };
  function laadAanbod() {
    if (!R.token) return Promise.resolve();
    return R.api('/api/mob/aanbod', { stad: S.bestemming && S.bestemming.stad }).then(function (d) {
      var beschikbaar = new Set((d.direct || []).map(function (x) { return x.categorie; }));
      $$('.voertuig').forEach(function (b) { b.disabled = !beschikbaar.has(b.dataset.voertuig);
        if (b.disabled) b.title = 'Dit voertuig is hier momenteel niet beschikbaar.'; });
      var huidig = $('.voertuig.actief');
      if (huidig && huidig.disabled) { var eerste = $$('.voertuig').find(function (b) { return !b.disabled; }); if (eerste) R.kiesVoertuig(eerste); }
    }).catch(function () {});
  }
  R.toonLopendeRit = function (opdracht, demo) {
    if (!opdracht) return;
    var vak = $('#lopendeRit'); vak.textContent = ''; vak.hidden = false;
    vak.appendChild(maak('p', 'micro', demo ? 'DEMO · LOPENDE RIT' : 'LOPENDE RIT'));
    vak.appendChild(maak('h3', '', (opdracht.van && opdracht.van.label ? opdracht.van.label : 'Vertrek') + ' → ' + (opdracht.naar && opdracht.naar.label ? opdracht.naar.label : 'Bestemming')));
    vak.appendChild(maak('p', '', [opdracht.status, opdracht.ref, Number.isFinite(opdracht.prijs) ? R.eur(opdracht.prijs) : ''].filter(Boolean).join(' · ')));
    if (!demo && opdracht.ref) { var a = maak('a', '', 'VOLG DEZE RIT →'); a.href = '/apps/rit.html?rit=' + encodeURIComponent(opdracht.ref); vak.appendChild(a); }
  };
  R.laadLopendeRit = function () {
    if (!R.token) { try { var demo = JSON.parse(localStorage.getItem('rtg_reizen_demo_rit') || 'null'); if (demo) R.toonLopendeRit(demo, true); } catch (e) {} return Promise.resolve(); }
    return R.api('/api/mob/mijn', {}).then(function (d) { if (d.lopend) R.toonLopendeRit(d.lopend, false); }).catch(function () {});
  };
  R.laadMobiliteit = function () { laadAanbod(); R.laadLopendeRit(); };
  function gebruikLocatie() {
    var knop = $('[data-locatie]'); if (!navigator.geolocation) { R.toast('Locatie is op dit toestel niet beschikbaar.'); return; }
    knop.disabled = true; $('#vanVeld').value = 'Locatie bepalen…';
    navigator.geolocation.getCurrentPosition(function (p) { S.vertrek = { lat: p.coords.latitude, lng: p.coords.longitude, label: 'Huidige locatie' };
      $('#vanVeld').value = 'Huidige locatie'; knop.disabled = false; R.toast('Uw vertrekpunt is bijgewerkt.'); }, function () {
      S.vertrek = null; $('#vanVeld').value = 'Huidige locatie'; knop.disabled = false; R.toast('Geef locatietoegang of vul een bekend vertrekpunt in.');
    }, { enableHighAccuracy: true, timeout: 8000, maximumAge: 60000 });
  }

  $$('[data-moment]').forEach(function (b) { b.addEventListener('click', function () { S.moment = b.dataset.moment;
    $$('[data-moment]').forEach(function (x) { var aan = x === b; x.classList.toggle('actief', aan); x.setAttribute('aria-pressed', String(aan)); });
    $('.laterinvoer').hidden = S.moment !== 'later'; }); });
  $$('.voertuig').forEach(function (b) { b.addEventListener('click', function () { R.kiesVoertuig(b); }); });
  $('#naarVeld').addEventListener('input', zoekBestemming); $('#naarVeld').addEventListener('focus', zoekBestemming);
  $('#naarVeld').addEventListener('keydown', function (e) { if (e.key === 'Escape') toonSuggesties([]); });
  document.addEventListener('click', function (e) { if (!e.target.closest('.taxilinks')) toonSuggesties([]); });
  $('[data-locatie]').addEventListener('click', gebruikLocatie);
  $('[data-wissel]').addEventListener('click', function () { var van = $('#vanVeld').value, naar = $('#naarVeld').value;
    $('#vanVeld').value = naar; $('#naarVeld').value = van; S.vertrek = S.bestemming; S.bestemming = null; updateRouteIndicatie(); });
  $('[data-open-reizigers]').addEventListener('click', function () { R.dialogOpen($('#reizigersDialoog')); });
  $('#reizigersDialoog').addEventListener('close', function () { S.personen = Number($('#personen').value); S.koffers = Number($('#koffers').value);
    $('#reizigersSamenvatting').textContent = S.personen + ' PERS. · ' + S.koffers + ' KOFFERS';
    if (S.personen > 4 && S.voertuig !== 'taxibus') R.kiesVoertuig($('.voertuig[data-voertuig="taxibus"]')); });
})(window.RTGReizen);
