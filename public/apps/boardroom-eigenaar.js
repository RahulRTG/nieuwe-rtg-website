/* De eigenaarszetel: de deur naar de eigenaars-API (/api/boardroom/*), die
   volledig bestond maar geen scherm had. Klopt stil aan op /status met de
   leden-sessie; alleen de eigenaar ziet de zetel (server-side afgedwongen). */
(function () {
  'use strict';
  var T = function (k, s) { return (window.RTGi18n && RTGi18n.t) ? RTGi18n.t(k, s) : s; }; // taalkiezer
  function token() { try { return localStorage.getItem('rtg_member_token') || ''; } catch (e) { return ''; } }
  function api(pad, body) {
    return fetch(pad, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + token() },
      body: JSON.stringify(body || {})
    }).then(function (r) {
      return r.json().catch(function () { return {}; }).then(function (d) {
        if (!r.ok) throw new Error(d.error || 'Dat lukte niet.');
        return d;
      });
    });
  }
  function el(tag, attrs) {
    var e = document.createElement(tag);
    for (var k in (attrs || {})) {
      if (k === 'text') e.textContent = attrs[k];
      else if (k === 'html') e.innerHTML = attrs[k];
      else e.setAttribute(k, attrs[k]);
    }
    for (var i = 2; i < arguments.length; i++) if (arguments[i]) e.appendChild(arguments[i]);
    return e;
  }

  var stijl = document.createElement('style');
  stijl.textContent =
    '.ez{margin:0 0 1.6rem;}' +
    '.ez-kop{display:flex;align-items:center;gap:.8rem;justify-content:center;margin:.4rem 0 .2rem;' +
      "font-family:Inter,sans-serif;font-size:.62rem;font-weight:500;letter-spacing:.34em;text-transform:uppercase;color:var(--gold,#857007);}" +
    '.ez-kop::before,.ez-kop::after{content:"";flex:0 0 2.2rem;height:1px;background:color-mix(in srgb, var(--gold,#857007) 45%, transparent);}' +
    ".ez-naam{font-family:'Bodoni Moda',serif;font-size:1.25rem;text-align:center;margin:.35rem 0 1.1rem;}" +
    '.ez details{border:1px solid var(--line,#DEDBD5);border-radius:14px;margin:.6rem 0;background:var(--card,rgba(255,255,255,.03));}' +
    ".ez summary{cursor:pointer;padding:.85rem 1rem;font-family:'Bodoni Moda',serif;font-size:1.02rem;list-style:none;}" +
    '.ez summary::-webkit-details-marker{display:none;}' +
    '.ez summary::after{content:"▾";float:right;color:var(--gold,#857007);opacity:.7;}' +
    '.ez .ez-body{padding:0 1rem .9rem;}' +
    '.ez-fn{display:flex;align-items:center;gap:.7rem;padding:.5rem 0;border-top:1px solid color-mix(in srgb, var(--line,#DEDBD5) 45%, transparent);}' +
    '.ez-fn:first-child{border-top:none;}' +
    '.ez-stip{flex:0 0 8px;width:8px;height:8px;border-radius:50%;}' +
    '.ez-fn small{display:block;color:var(--muted,#8A8680);font-size:.72rem;line-height:1.45;}' +
    '.ez-fn>div{flex:1;min-width:0;font-size:.86rem;}' +
    '.ez-knop{background:none;border:1px solid var(--line,#DEDBD5);border-radius:999px;color:inherit;' +
      'font:inherit;font-size:.72rem;padding:.3rem .8rem;cursor:pointer;white-space:nowrap;}' +
    '.ez-knop.aan{border-color:color-mix(in srgb, var(--gold,#857007) 65%, transparent);color:var(--gold,#857007);}' +
    '.ez-cat{margin:.7rem 0 .2rem;font-size:.66rem;letter-spacing:.14em;text-transform:uppercase;color:var(--gold,#857007);}' +
    '.ez-taal{display:inline-block;margin:.2rem .3rem .2rem 0;}' +
    '.ez-ai textarea{width:100%;box-sizing:border-box;background:none;border:1px solid var(--line,#DEDBD5);border-radius:10px;' +
      'color:inherit;font:inherit;font-size:.86rem;padding:.6rem;min-height:3.2rem;resize:vertical;}' +
    '.ez-ai .ez-antwoord{margin:.7rem 0;font-size:.84rem;line-height:1.55;color:var(--muted,#8A8680);white-space:pre-wrap;}' +
    '.ez-log{font-size:.76rem;color:var(--muted,#8A8680);line-height:1.6;}' +
    '.ez-melding{margin:.5rem 0;font-size:.8rem;color:var(--gold,#857007);min-height:1.1rem;}';
  document.head.appendChild(stijl);

  var wrap = null, meldEl = null;
  function meld(t) { if (meldEl) { meldEl.textContent = t || ''; if (t) setTimeout(function () { if (meldEl.textContent === t) meldEl.textContent = ''; }, 5000); } }

  function stipKleur(f) {
    if (f.storing) return '#B0483B';
    if (f.automaat) return '#C9A24B';
    return f.aan ? '#4C7A4C' : 'color-mix(in srgb, var(--muted,#8A8680) 60%, transparent)';
  }

  function bouwFuncties(d) {
    var body = el('div', { 'class': 'ez-body' });
    (d.functies || []).forEach(function (cat) {
      body.appendChild(el('div', { 'class': 'ez-cat', text: cat.categorie }));
      (cat.functies || []).forEach(function (f) {
        var stip = el('span', { 'class': 'ez-stip' });
        stip.style.background = stipKleur(f);
        var knop = el('button', { 'class': 'ez-knop' + (f.aan ? ' aan' : ''), type: 'button',
          text: f.aan ? T('ez.aan', 'aan') : T('ez.uit', 'uit') });
        knop.addEventListener('click', function () {
          knop.disabled = true;
          api('/api/boardroom/zet', { id: f.id, aan: !f.aan })
            .then(function () { meld(f.naam + (f.aan ? ' ' + T('ez.nuuit', 'staat nu uit.') : ' ' + T('ez.nuaan', 'staat nu aan.'))); laad(); })
            .catch(function (e) { meld(e.message); knop.disabled = false; });
        });
        body.appendChild(el('div', { 'class': 'ez-fn' }, stip,
          el('div', {}, el('span', { text: f.naam }), el('small', { text: f.uitleg || '' })), knop));
      });
    });
    return body;
  }

  function bouwTalen() {
    var body = el('div', { 'class': 'ez-body' });
    api('/api/boardroom/talen').then(function (d) {
      (d.talen || []).forEach(function (t) {
        var vast = t.code === 'nl' || t.code === 'en';
        var b = el('button', { 'class': 'ez-knop ez-taal' + (t.aan ? ' aan' : ''), type: 'button',
          text: (t.naam || t.code) + (vast ? ' ·' : '') });
        if (vast) b.disabled = true;
        b.addEventListener('click', function () {
          b.disabled = true;
          api('/api/boardroom/taal', { code: t.code, aan: !t.aan })
            .then(function () { b.classList.toggle('aan'); b.disabled = false; })
            .catch(function (e) { meld(e.message); b.disabled = false; });
        });
        body.appendChild(b);
      });
    }).catch(function (e) { body.appendChild(el('div', { 'class': 'ez-log', text: e.message })); });
    return body;
  }

  function bouwAi(d) {
    var body = el('div', { 'class': 'ez-body ez-ai' });
    if (!d.aiBeschikbaar) {
      body.appendChild(el('div', { 'class': 'ez-log', text: T('ez.geenai', 'De AI-regie is beschikbaar zodra er een AI-sleutel is ingesteld.') }));
      return body;
    }
    var veld = el('textarea', { placeholder: T('ez.aiph', 'Bijvoorbeeld: zet Clips uit voor tieners, of: geef horeca 10% commissie.') });
    var knop = el('button', { 'class': 'ez-knop aan', type: 'button', text: T('ez.vraag', 'Vraag Rahul om een voorstel') });
    var uit = el('div', { 'class': 'ez-antwoord' });
    var pasToe = el('button', { 'class': 'ez-knop', type: 'button', text: T('ez.pastoe', 'Pas dit voorstel toe') });
    pasToe.hidden = true;
    var voorstel = null;
    knop.addEventListener('click', function () {
      var vraag = veld.value.trim();
      if (!vraag) return;
      knop.disabled = true; uit.textContent = '…'; pasToe.hidden = true; voorstel = null;
      api('/api/boardroom/ai', { vraag: vraag }).then(function (r) {
        uit.textContent = r.antwoord || T('ez.geenvoorstel', 'Geen voorstel.');
        voorstel = (r.voorstel && r.voorstel.length) ? r.voorstel : null;
        pasToe.hidden = !voorstel;
        knop.disabled = false;
      }).catch(function (e) { uit.textContent = e.message; knop.disabled = false; });
    });
    pasToe.addEventListener('click', function () {
      if (!voorstel) return;
      pasToe.disabled = true;
      api('/api/boardroom/toepassen', { voorstel: voorstel }).then(function (r) {
        meld(T('ez.toegepast', 'Toegepast: ') + (r.toegepast != null ? r.toegepast : '') +
          ((r.fouten && r.fouten.length) ? ' · ' + r.fouten.join(' · ') : ''));
        pasToe.hidden = true; pasToe.disabled = false; voorstel = null;
        laad();
      }).catch(function (e) { meld(e.message); pasToe.disabled = false; });
    });
    body.append(veld, el('div', { style: 'margin-top:0.5rem;display:flex;gap:0.5rem;' }, knop, pasToe), uit);
    return body;
  }

  function bouwLog(d) {
    var body = el('div', { 'class': 'ez-body ez-log' });
    var regels = d.wachterLog || [];
    if (!regels.length) body.textContent = T('ez.geenlog', 'De storingswachter heeft nog niets hoeven doen.');
    regels.slice(0, 10).forEach(function (r) {
      body.appendChild(el('div', { text: (r.t ? new Date(r.t).toLocaleString() + ' · ' : '') + (r.tekst || r.bericht || JSON.stringify(r)) }));
    });
    return body;
  }

  function paneel(titel, inhoud, open) {
    var det = el('details', open ? { open: '' } : {});
    det.appendChild(el('summary', { text: titel }));
    det.appendChild(inhoud);
    return det;
  }

  function render(d) {
    if (!wrap) {
      wrap = el('section', { 'class': 'ez', 'aria-label': T('ez.zetel', 'De eigenaarszetel') });
      var bord = document.getElementById('bord');
      if (bord && bord.parentNode) bord.parentNode.insertBefore(wrap, bord);
      else document.getElementById('hoofd').appendChild(wrap);
    }
    wrap.textContent = '';
    wrap.appendChild(el('div', { 'class': 'ez-kop', text: T('ez.zetel', 'De eigenaarszetel') }));
    wrap.appendChild(el('div', { 'class': 'ez-naam', text: T('ez.welkom', 'U zit in de boardroom') + (d.naam ? ', ' + d.naam.split(' ')[0] + '.' : '.') }));
    meldEl = el('div', { 'class': 'ez-melding', role: 'status', 'aria-live': 'polite' });
    wrap.appendChild(meldEl);
    var s = d.samenvatting;
    wrap.appendChild(paneel(T('ez.kast', 'De schakelkast') + (s && s.uit ? ' · ' + s.uit + ' ' + T('ez.dicht', 'dicht') : ''), bouwFuncties(d)));
    wrap.appendChild(paneel(T('ez.talen', 'Wereldtalen'), bouwTalen()));
    wrap.appendChild(paneel(T('ez.regie', 'AI-regie'), bouwAi(d)));
    wrap.appendChild(paneel(T('ez.wachter', 'Storingswachter'), bouwLog(d)));
  }

  function laad() {
    if (!token()) return;
    api('/api/boardroom/status').then(function (d) {
      if (d && d.eigenaar) render(d);
    }).catch(function () { /* geen eigenaar of geen rechten: stil blijven */ });
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', laad);
  else laad();
})();
