/* RTG Festival, de GASTENKANT.

   DRIE DINGEN, EN GEEN VIERDE: uw pas (met de code die u aan de poort laat
   zien), het programma van een dag, en uw groep. Geen bezetting, geen
   uitzonderingen, geen gereedheid -- dat is het scherm van de organisatie en
   het gaat een gast niets aan.

   ER STAAT GEEN AANSPORING OP DEZE PAGINA. Geen "nog 3 dagen!", geen teller,
   geen "5 van uw vrienden hebben al een pas". CLAUDE.md verbiedt verslavende
   patronen, en op de gastenkant van een festival is dat geen theorie: dit is
   precies het scherm waar kunstmatige urgentie geld oplevert.

   WAT ER NIET STAAT, STAAT ER OOK. Een programma dat voor de helft nog niet
   rond is, zegt dat -- anders lijkt een halve line-up op een hele. */
(function () {
  'use strict';
  var token = null;
  try { token = localStorage.getItem('rtg_member_token'); } catch (e) {}

  var $ = function (s) { return document.getElementById(s); };
  var staat = { fid: null, eid: null, dagen: [] };

  function api(pad, body) {
    return fetch(pad, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + token },
      body: JSON.stringify(body || {})
    }).then(function (r) {
      return r.json().catch(function () { return {}; })
        .then(function (b) { return { status: r.status, body: b }; });
    });
  }

  function regel(lijst, kop, rechts) {
    var d = document.createElement('div');
    d.className = 'fg-regel';
    var s = document.createElement('span');
    s.textContent = kop;
    d.appendChild(s);
    if (rechts) {
      var r = document.createElement('span');
      r.className = 'rek';
      r.textContent = rechts;
      d.appendChild(r);
    }
    lijst.appendChild(d);
    return d;
  }

  function keuze(el, waarden, leeg) {
    el.textContent = '';
    if (leeg) {
      var o = document.createElement('option');
      o.value = ''; o.textContent = leeg;
      el.appendChild(o);
    }
    waarden.forEach(function (w) {
      var opt = document.createElement('option');
      opt.value = w.value; opt.textContent = w.tekst;
      el.appendChild(opt);
    });
  }

  /* De rechten van een pas in gewone taal. Een recht zonder dagen geldt elke
     dag en een recht zonder plek geldt overal -- dat staat er dus ook zo, want
     een leeg veld is geen antwoord. */
  function rechtZin(r) {
    var stukjes = [r.soort.replace(/^festival\./, '')];
    stukjes.push(r.dagen.length ? r.dagen.join(', ') : 'elke dag');
    stukjes.push(r.plek || 'het hele terrein');
    if (r.van) stukjes.push(r.van + '-' + r.tot);
    return stukjes.join(' · ');
  }

  function tekenPassen() {
    var vak = $('fgPassen');
    vak.textContent = '';
    return api('/api/festival/gast/passen', { festival: staat.fid, editie: staat.eid })
      .then(function (res) {
        var b = res.body || {};
        if (!b.ok) { vak.textContent = b.error || 'Dat lukte niet.'; return; }
        if (!b.passen.length) {
          var p = document.createElement('p');
          p.className = 'fg-stil';
          p.textContent = 'Er staat nog geen pas op uw naam voor deze editie.';
          vak.appendChild(p);
          return;
        }
        b.passen.forEach(function (pas) {
          var kaart = document.createElement('section');
          kaart.className = 'fg-pas';
          var ey = document.createElement('div');
          ey.className = 'rv-ey';
          ey.textContent = pas.soort.toUpperCase();
          var code = document.createElement('div');
          code.className = 'fg-code';
          code.textContent = pas.code;
          kaart.appendChild(ey);
          kaart.appendChild(code);
          pas.rechten.forEach(function (r) {
            var d = document.createElement('div');
            d.className = 'fg-recht';
            var s = document.createElement('span');
            s.textContent = rechtZin(r);
            d.appendChild(s);
            kaart.appendChild(d);
          });
          vak.appendChild(kaart);
        });
      });
  }

  function tekenProgramma() {
    var lijst = $('fgProgramma');
    lijst.textContent = '';
    $('fgProgStil').textContent = '';
    var dagId = $('fgDag').value;
    if (!dagId) return Promise.resolve();
    return api('/api/festival/gast/programma', { festival: staat.fid, editie: staat.eid, dag: dagId })
      .then(function (res) {
        var b = res.body || {};
        if (!b.ok) { $('fgProgStil').textContent = b.error || ''; return; }
        b.programma.forEach(function (x) {
          regel(lijst, x.artiest + (x.podium ? ' · ' + x.podium : ''), x.van + '-' + x.tot);
        });
        /* HIER STAAT DE EERLIJKHEID. Een gast ziet alleen bevestigde sets; hoe
           veel er nog niet rond zijn, hoort hij er wel bij te weten. */
        $('fgProgStil').textContent = b.programma.length
          ? (b.nogNiet ? (b.nogNiet === 1
            ? 'Er is nog 1 plek in het programma die niet rond is; die staat er pas als hij getekend is.'
            : 'Er zijn nog ' + b.nogNiet + ' plekken in het programma die niet rond zijn; '
              + 'die staan er pas als ze getekend zijn.')
            : 'Dit is het hele programma van deze dag.')
          : 'Voor deze dag staat er nog niets vast.';
      });
  }

  function kiesEditie() {
    var e = ($('fgEditie').value || '').split('|');
    staat.fid = e[0] || null;
    staat.eid = e[1] || null;
    if (!staat.fid) return;
    var ed = (staat.alle || []).find(function (x) { return x.editie === staat.eid; }) || {};
    staat.dagen = ed.dagen || [];
    keuze($('fgDag'), staat.dagen.map(function (d) { return { value: d.id, tekst: d.datum }; }),
      staat.dagen.length ? null : 'nog geen dagen');
    $('fgKop').textContent = ed.naam || 'Uw weekend';
    $('fgIntro').textContent = 'Uw pas, het programma en de mensen met wie u gaat.';
    tekenPassen();
    tekenProgramma();
    if (window.RTGGastGroep) window.RTGGastGroep.teken();
  }

  /* HET GROEPSDEEL STAAT IN EEN EIGEN BESTAND (festival-gast-groep.js), en de
     naad loopt waar hij in de kern ook loopt: wat u HEEFT en wat er OP is,
     tegenover wat er tussen mensen gebeurt. Dat is geen opdeling om de
     bestandsgrens te halen -- het is dezelfde scheiding als kern/festival/
     gast.js tegenover kern/festival/groep.js. */
  function start() {
    if (!token) {
      $('fgIntro').textContent = 'Log eerst in met uw RTG-account.';
      return;
    }
    api('/api/festival/gast/edities', {}).then(function (res) {
      var b = res.body || {};
      staat.alle = b.edities || [];
      if (!staat.alle.length) {
        /* NIETS HEBBEN IS EEN GELDIGE TOESTAND, en er hoort dan precies EEN
           ding te kunnen: een code invullen die u van iemand kreeg. De rest van
           de pagina heeft geen inhoud, dus die gaat weg -- een leeg kopje
           "Uw pas" boven niets is geen informatie. */
        $('fgIntro').textContent = 'Er staat nog geen festival op uw naam. Heeft u een '
          + 'groepscode gekregen? Vul hem hieronder in. Verder verschijnt hier vanzelf '
          + 'wat van u is, zodra u een pas heeft.';
        $('fgEditie').hidden = true;
        /* Een groep MAKEN kan ook niet zonder editie -- een groep hoort bij een
           festival. Dus blijft er precies een ding over dat wel kan: een code
           invullen. Een formulier tonen dat alleen maar kan mislukken, is erger
           dan geen formulier. */
        $('fgVol').hidden = true;
        $('fgMaakVak').hidden = true;
        return;
      }
      $('fgVol').hidden = false;
      $('fgMaakVak').hidden = false;
      keuze($('fgEditie'), staat.alle.map(function (x) {
        return { value: x.festival + '|' + x.editie, tekst: x.naam + ' · ' + x.jaar };
      }));
      kiesEditie();
    }).catch(function () { $('fgIntro').textContent = 'Geen verbinding.'; });
  }

  window.RTGGast = { api: api, staat: staat, regel: regel, $: $, start: start };

  $('fgEditie').addEventListener('change', kiesEditie);
  $('fgDag').addEventListener('change', tekenProgramma);

  start();
})();
