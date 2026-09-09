/* Geld & Later is de rustige ingang naar bestaande Foundation-functies.
   Het zakgeldpotje blijft bij Tiener, vacatures blijven bij Werk en het budget
   blijft, net als op de bestaande budgetpagina, alleen op dit toestel. */
(function () {
  'use strict';
  if (!window.Sessie || !Sessie.eisProfiel()) return;
  var sessie = Sessie.huidig(), soort = 'budget', W = window.RTGGeldLaterWeergave;
  var BUDGET_KEY = 'rtf_geld_later_budget_v1';
  var GROEP_VANAF = { mini:0, kind:5, tiener:12, jong:16, volw:22 };
  var staat = { potje:null, vacatures:null, cv:cvStatus() };
  function antwoord(r) { return r.json().catch(function () { return {}; }).then(function (d) { if (!r.ok) throw new Error(d.error || 'Dit is nu niet beschikbaar.'); return d; }); }
  function rtf(pad, body) { return fetch('/api/rtf' + pad, { method:'POST', headers:{ 'Content-Type':'application/json' }, body:JSON.stringify(body || {}) }).then(antwoord); }
  function profielBody(extra) { return Object.assign({ code:sessie.code, token:sessie.token }, extra || {}); }
  function cvLees() { try { return JSON.parse(localStorage.getItem('rtf_cv') || 'null'); } catch (e) { return null; } }
  function cvStatus() {
    var raw = cvLees(), v = raw && raw.velden || {}, werk = raw && raw.werk || [], opleiding = raw && raw.opleiding || [];
    var contact = String(v.email || v.telefoon || v.woonplaats || '').trim();
    var inhoud = werk.some(function (x) { return x.functie || x.bedrijf || x.beschrijving; }) || opleiding.some(function (x) { return x.opleiding || x.school; }) || String(v.skills || v.profiel || '').trim();
    return { bestaat:!!raw, klaar:!!(String(v.naam || '').trim() && contact && inhoud) };
  }
  function budgetLees() { try { return Object.assign({ binnen:'', bewaren:'', uitgeven:'' }, JSON.parse(localStorage.getItem(BUDGET_KEY) || '{}')); } catch (e) { return { binnen:'', bewaren:'', uitgeven:'' }; } }
  function getal(v) { var n = Number(String(v == null ? '' : v).replace(',', '.')); return Number.isFinite(n) && n >= 0 ? n : NaN; }
  function geldEuro(v) { return new Intl.NumberFormat('nl-NL', { style:'currency', currency:'EUR' }).format(v); }
  function openView(naam) {
    document.querySelectorAll('[data-gl-view]').forEach(function (v) { var aan = v.dataset.glView === naam; v.hidden = !aan; v.classList.toggle('is-actief', aan); });
    document.querySelectorAll('[data-gl-tab]').forEach(function (b) { var aan = b.dataset.glTab === naam; b.classList.toggle('is-actief', aan); if (aan) b.setAttribute('aria-current', 'page'); else b.removeAttribute('aria-current'); });
    window.scrollTo({ top:0, behavior:'smooth' });
  }
  function laad() {
    var groep = sessie.profiel && sessie.profiel.groep, leeftijd = GROEP_VANAF[groep];
    return Promise.allSettled([
      rtf('/tiener/potje', profielBody()),
      rtf('/vacatures', Number.isFinite(leeftijd) ? { leeftijd:leeftijd } : {})
    ]).then(function (uit) {
      staat.potje = uit[0].status === 'fulfilled' ? uit[0].value : null;
      staat.vacatures = uit[1].status === 'fulfilled' ? (uit[1].value.vacatures || []) : null;
      staat.cv = cvStatus(); W.alles(staat);
    });
  }
  function keuzeKnoppen() {
    document.querySelectorAll('[data-gl-soort]').forEach(function (b) { var aan = b.dataset.glSoort === soort; b.classList.toggle('is-actief', aan); b.setAttribute('aria-checked', String(aan)); });
  }
  function budgetVorm() {
    var b = budgetLees();
    return '<p class="gl-kicker">Budget maken</p><h2>Maak geld overzichtelijk.</h2><p class="gl-uitleg">Vul alleen de bedragen in die u zelf kent. Dit is een rekenhulp, geen financieel advies.</p>' +
      '<form class="gl-formulier" id="glBudgetVorm"><label for="glBinnen">Wat komt er binnen?</label><input id="glBinnen" inputmode="decimal" value="' + schoonGetal(b.binnen) + '" placeholder="0,00">' +
      '<label for="glBewaren">Wat wilt u bewaren?</label><input id="glBewaren" inputmode="decimal" value="' + schoonGetal(b.bewaren) + '" placeholder="0,00">' +
      '<label for="glUitgeven">Wat mag u uitgeven?</label><input id="glUitgeven" inputmode="decimal" value="' + schoonGetal(b.uitgeven) + '" placeholder="0,00">' +
      '<p class="gl-fout" id="glRegelFout" role="alert"></p><button class="gl-hoofdknop" type="submit">Maak mijn overzicht <i data-glyf="rechterhand"></i></button></form><div id="glRegelUitkomst"></div>';
  }
  function schoonGetal(v) { return /^\d+(?:[.,]\d{0,2})?$/.test(String(v || '')) ? String(v) : ''; }
  function spaarVorm() {
    return '<p class="gl-kicker">Spaardoel starten</p><h2>Bewaar voor iets dat telt.</h2><p class="gl-uitleg">Het bedrag verhuist pas naar het doel wanneer u later zelf een inleg doet in Zakgeld.</p>' +
      '<form class="gl-formulier" id="glSpaarVorm"><label for="glDoelNaam">Waar spaart u voor?</label><input id="glDoelNaam" maxlength="40" placeholder="Bijvoorbeeld een fiets" required>' +
      '<label for="glDoelBedrag">Hoeveel is daarvoor nodig?</label><input id="glDoelBedrag" inputmode="decimal" placeholder="0,00" required>' +
      '<p class="gl-fout" id="glRegelFout" role="alert"></p><button class="gl-hoofdknop" type="submit">Start mijn spaardoel <i data-glyf="rechterhand"></i></button></form><div id="glRegelUitkomst"></div>';
  }
  function routePaneel(type) {
    var cv = cvStatus();
    if (type === 'cv') return '<p class="gl-kicker">CV beginnen</p><h2>Laat zien wat u al kunt.</h2><p class="gl-uitleg">' + (cv.klaar ? 'Uw cv heeft al een bruikbare basis. U kunt het rustig aanvullen.' : cv.bestaat ? 'U bent al begonnen. Ga verder waar u gebleven was.' : 'Begin met uw naam, wat u kunt en wat u al heeft gedaan. Ook school, vrijwilligerswerk en zorgen voor iemand tellen mee.') + '</p><a class="gl-nevenknop" href="cv.html">Open mijn CV <i data-glyf="rechterhand"></i></a>';
    return '<p class="gl-kicker">Mijn rechten</p><h2>Weet wat er voor u geldt.</h2><p class="gl-uitleg">Bekijk de Nederlandse regels over werk, geld, school, zorg en zelf beslissen per leeftijd. Uw gekozen leeftijd wordt niet bewaard.</p><a class="gl-nevenknop" href="rechten.html">Bekijk mijn rechten <i data-glyf="rechterhand"></i></a>';
  }
  function tekenRegelen() {
    keuzeKnoppen();
    var paneel = document.getElementById('glRegelPaneel');
    paneel.innerHTML = soort === 'budget' ? budgetVorm() : soort === 'spaardoel' ? spaarVorm() : routePaneel(soort);
    try { if (window.RTGGlyf) RTGGlyf.vul(paneel); } catch (e) {}
    var budget = document.getElementById('glBudgetVorm'); if (budget) budget.onsubmit = bewaarBudget;
    var spaar = document.getElementById('glSpaarVorm'); if (spaar) spaar.onsubmit = bewaarDoel;
  }
  function bewaarBudget(e) {
    e.preventDefault();
    var binnen = getal(document.getElementById('glBinnen').value), bewaren = getal(document.getElementById('glBewaren').value), uitgeven = getal(document.getElementById('glUitgeven').value);
    var fout = document.getElementById('glRegelFout'), uit = document.getElementById('glRegelUitkomst'); fout.textContent = '';
    if (![binnen, bewaren, uitgeven].every(Number.isFinite)) { fout.textContent = 'Gebruik bedragen van nul of hoger.'; return; }
    var ruimte = binnen - bewaren - uitgeven;
    try { localStorage.setItem(BUDGET_KEY, JSON.stringify({ binnen:binnen, bewaren:bewaren, uitgeven:uitgeven })); } catch (err) {}
    uit.className = 'gl-uitkomst'; uit.textContent = ruimte >= 0 ? 'Na bewaren en uitgeven blijft ' + geldEuro(ruimte) + ' aan ruimte over.' : 'Er is ' + geldEuro(Math.abs(ruimte)) + ' meer verdeeld dan er binnenkomt. Pas een bedrag aan om ruimte te maken.';
  }
  function bewaarDoel(e) {
    e.preventDefault();
    var naam = document.getElementById('glDoelNaam').value.trim(), bedrag = getal(document.getElementById('glDoelBedrag').value), fout = document.getElementById('glRegelFout'), uit = document.getElementById('glRegelUitkomst');
    fout.textContent = ''; if (!naam || !Number.isFinite(bedrag) || bedrag < 1) { fout.textContent = 'Vul een naam en een bedrag vanaf 1 euro in.'; return; }
    var knop = e.currentTarget.querySelector('button[type="submit"]'); knop.disabled = true;
    rtf('/tiener/doel-maak', profielBody({ naam:naam, doelCenten:Math.round(bedrag * 100) })).then(function (p) {
      staat.potje = p; W.vandaag(staat); uit.className = 'gl-uitkomst'; uit.textContent = 'Uw spaardoel staat in Zakgeld. U kiest daar zelf wanneer u iets inlegt.'; e.currentTarget.reset();
    }).catch(function (err) { fout.textContent = err.message; }).finally(function () { knop.disabled = false; });
  }
  document.querySelectorAll('[data-gl-tab],[data-gl-open]').forEach(function (b) { b.onclick = function () { openView(b.dataset.glTab || b.dataset.glOpen); }; });
  document.querySelectorAll('[data-gl-soort]').forEach(function (b) { b.onclick = function () { soort = b.dataset.glSoort; tekenRegelen(); }; });
  document.getElementById('glBekijkGeld').onclick = function () { document.getElementById('glGeldBegin').scrollIntoView({ behavior:'smooth' }); };
  tekenRegelen(); laad();
  if ('serviceWorker' in navigator && location.protocol.startsWith('http')) navigator.serviceWorker.register('sw.js').catch(function () {});
})();
