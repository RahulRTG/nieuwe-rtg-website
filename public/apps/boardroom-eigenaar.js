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
      else e.setAttribute(k, attrs[k]);
    }
    for (var i = 2; i < arguments.length; i++) if (arguments[i]) e.appendChild(arguments[i]);
    return e;
  }

  var wrap = null, meldEl = null;
  function meld(t) { if (meldEl) { meldEl.textContent = t || ''; if (t) setTimeout(function () { if (meldEl.textContent === t) meldEl.textContent = ''; }, 5000); } }

  function stipStand(f) {
    if (f.storing) return 'storing';
    if (f.automaat) return 'automaat';
    return f.aan ? 'aan' : 'uit';
  }

  function bouwFuncties(d) {
    var body = el('div', { 'class': 'ez-body' });
    (d.functies || []).forEach(function (cat) {
      body.appendChild(el('div', { 'class': 'ez-cat', text: cat.categorie }));
      (cat.functies || []).forEach(function (f) {
        var stip = el('span', { 'class': 'ez-stip ez-stip--' + stipStand(f), 'aria-hidden': 'true' });
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
    body.append(veld, el('div', { 'class': 'ez-ai-acties' }, knop, pasToe), uit);
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

  function bouwBetalingen() {
    var body = el('div', { 'class': 'ez-body' });
    body.appendChild(el('div', { 'class': 'ez-log', text: 'Laden…' }));
    function laadBetalen() {
      api('/api/boardroom/betalingen/status').then(function (d) {
        body.textContent = '';
        if ((d.problemen || []).length) body.appendChild(el('div', { 'class': 'ez-melding',
          text: d.problemen.length + ' aandachtspunt(en) · ' + d.problemen[0].tekst }));
        (d.providers || []).forEach(function (p) {
          var select = el('select');
          ['aanvraag','controle','goedgekeurd','techniek','proef','gepauzeerd','probleem','live'].forEach(function (f) {
            var o = el('option', { value: f, text: f }); if (p.fase === f) o.selected = true; select.appendChild(o);
          });
          var open = el('a', { 'class': 'ez-knop', href: p.aanmeldUrl, target: '_blank', rel: 'noopener noreferrer',
            text: p.fase === 'niet-gestart' ? 'Open aanvraag' : 'Open provider' });
          open.addEventListener('click', function () {
            if (p.fase === 'niet-gestart') api('/api/boardroom/betalingen/stap', { provider: p.id, fase: 'aanvraag' }).then(laadBetalen);
          });
          var bewaar = el('button', { 'class': 'ez-knop', type: 'button', text: 'Sla stap op' });
          bewaar.addEventListener('click', function () { api('/api/boardroom/betalingen/stap', { provider:p.id, fase:select.value })
            .then(function(){ meld('Stap opgeslagen.'); laadBetalen(); }).catch(function(e){ meld(e.message); }); });
          var proef = el('button', { 'class': 'ez-knop aan', type: 'button', text: 'Controleer' });
          proef.addEventListener('click', function () { api('/api/boardroom/betalingen/proef', { provider:p.id })
            .then(function(r){ meld(r.uitleg); laadBetalen(); }).catch(function(e){ meld(e.message); }); });
          var voorkeur = el('button', { 'class': 'ez-knop', type: 'button', text: d.voorkeur === p.id ? 'Voorkeur' : 'Maak voorkeur' });
          voorkeur.disabled = d.voorkeur === p.id;
          voorkeur.addEventListener('click', function () { api('/api/boardroom/betalingen/keuze', { provider:p.id }).then(laadBetalen).catch(function(e){ meld(e.message); }); });
          var gereed = (p.checklist || []).filter(function(x){return x.ingesteld;}).length + '/' + (p.checklist || []).length + ' veilig ingesteld';
          body.appendChild(el('div', { 'class':'ez-betaal' },
            el('div', { 'class':'ez-betaal-kop' }, el('strong', { text:p.naam }), el('span', { 'class':'ez-log', text:p.faseLabel })),
            el('div', { 'class':'ez-log', text:gereed + ' · ' + (p.werkt === 'bewezen-met-betaling' ? 'bewezen werkend' : p.werkt.replaceAll('-', ' ')) }),
            el('div', { 'class':'ez-betaal-acties' }, open, select, bewaar, proef, voorkeur)));
        });
      }).catch(function (e) { body.textContent = e.message; });
    }
    laadBetalen();
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
      wrap = el('section', { 'class': 'ez ds-eigenaarszetel', 'aria-label': T('ez.zetel', 'De eigenaarszetel') });
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
    wrap.appendChild(paneel('Betaalproviders · Stripe, Mollie & Adyen', bouwBetalingen(), true));
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
