(function () {
  const $ = (s) => document.querySelector(s);
  const esc = (s) => String(s == null ? '' : s).replace(/[&<>"']/g, (c) =>
    ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const code = String(window.__RTG_REISUITNODIGING_CODE || '');
  try { delete window.__RTG_REISUITNODIGING_CODE; } catch (e) { window.__RTG_REISUITNODIGING_CODE = null; }
  const token = () => { try { return localStorage.getItem('rtg_member_token') || ''; } catch (e) { return ''; } };
  const api = (pad, body, tok) => fetch('/api/' + pad, {
    method: 'POST', headers: Object.assign({ 'Content-Type': 'application/json' },
      tok ? { Authorization: 'Bearer ' + tok } : {}),
    body: JSON.stringify(body || {})
  }).then(async (r) => { const d = await r.json().catch(() => ({})); if (!r.ok) throw new Error(d.error || 'Er ging iets mis.'); return d; });

  /* Status (fout, verlopen link): een rustige regel, geen alarm. */
  const status = (t) => '<p class="ds-detail__status">' + esc(t) + '</p>';
  const VOL = 'class="ds-knop ds-knop--primair ds-knop--breed"', STIL = 'class="ds-knop ds-knop--stil ds-knop--klein"';
  /* Klaar: het scherm wordt Status. */
  const klaar = (zin) => { document.body.dataset.dsSchermtype = 'status';
    $('#doe').innerHTML = status(zin) + '<a ' + VOL + ' href="/apps/reizen.html">Naar mijn reizen</a>'; };
  const rijVeld = (label, invoer) => '<label class="ds-veld"><span></span><span><span class="ds-veld__label">' + esc(label) +
    '</span>' + invoer + '</span><span></span></label>';
  const dagen = (v) => v.van === v.tot ? v.van : v.van + ' t/m ' + v.tot;
  const soortenZin = (s) => Object.entries(s || {}).map(([k, n]) => n + ' ' + k + (n === 1 ? '' : 'en')).join(', ');

  /* ZONDER CODE is dit de beheerkant: een ingelogd lid ziet hier zijn eigen
     verstuurde uitnodigingen en kan ze intrekken. Zonder sessie én zonder code
     valt er niets te tonen -- dan is de link gewoon niet compleet. */
  if (!code) { token() ? mijnUitnodigingen() : ($('#vak').innerHTML =
    '<p class="ds-meta">Deze link is niet compleet. Vraag om een nieuwe.</p>'); return; }

  api('reis/uitnodiging/open', { code }).then((d) => teken(d.uitnodiging)).catch((e) => {
    $('#vak').innerHTML = status(e.message);
  });

  async function mijnUitnodigingen(verseLink) {
    let d;
    try { d = await api('reis/uitnodiging/mijn', {}, token()); }
    catch (e) { $('#vak').innerHTML = status(e.message); return; }
    const rij = d.uitnodigingen || [];
    $('#vak').innerHTML = '<h1 class="ds-titel ds-titel--scherm">Uw uitnodigingen</h1>' +
      '<p class="ds-meta">Een uitnodigingslink wordt alleen bij uitgifte getoond. ' +
        'Niet ontvangen? Roteer haar; de oude link wordt dan direct onbruikbaar.</p>' +
      '<div id="eenmaligeLink" aria-live="polite"></div>' +
      (rij.length ? '<ul class="ds-lijst">' + rij.map((u) =>
        '<li class="ds-lijst__rij"><span></span><span><span class="ds-lijst__titel">' + esc(u.bestemming || 'reis') +
          ' &middot; ' + esc(dagen(u.venster)) + '</span>' +
          '<span class="ds-lijst__tekst">' + (u.opgeeist ? 'overgenomen' : u.ingetrokken ? 'ingetrokken' :
            'geldig tot ' + esc(u.toegang && u.toegang.expires_at)) + '</span></span>' +
          (u.opgeeist || u.ingetrokken ? '<span></span>' :
            '<span class="ds-veldgroep"><button ' + STIL + ' type="button" data-roteer="' + esc(u.id) + '">Roteer link</button>' +
            '<button ' + STIL + ' type="button" data-weg="' + esc(u.id) + '">Trek in</button></span>') +
        '</li>').join('') + '</ul>'
      : '<p class="ds-meta">U heeft nog geen uitnodigingen verstuurd. Dat doet u bij een reis in <a href="/apps/reizen.html">RTG Reizen</a>.</p>');
    if (verseLink) toonEenmaligeLink(verseLink);
    $('#vak').querySelectorAll('[data-roteer]').forEach((b) => b.addEventListener('click', async () => {
      b.disabled = true;
      try {
        const r = await api('reis/uitnodiging/roteer', {
          id: b.dataset.roteer, idem: RTGIdem('reis-roteer')
        }, token());
        await mijnUitnodigingen(r.link);
      } catch (e) { b.disabled = false; b.textContent = e.message; }
    }));
    $('#vak').querySelectorAll('[data-weg]').forEach((b) => b.addEventListener('click', async () => {
      b.disabled = true;
      try { await api('reis/uitnodiging/weg', { id: b.dataset.weg }, token()); mijnUitnodigingen(); }
      catch (e) { b.disabled = false; b.textContent = e.message; }
    }));
  }

  function toonEenmaligeLink(link) {
    const vak = $('#eenmaligeLink');
    if (!vak || !link) return;
    vak.innerHTML = '<div class="ds-velden">' +
      rijVeld('Nieuwe link: nu eenmalig kopiëren', '<input class="ds-veld__invoer" id="verseLink" readonly autocomplete="off" spellcheck="false">') +
      '<button class="ds-knop ds-knop--primair" id="kopieerVerseLink" type="button" data-ds-actie="Kopieer link">Kopieer link</button></div>';
    const invoer = $('#verseLink');
    invoer.value = new URL(link, location.origin).href;
    $('#kopieerVerseLink').addEventListener('click', async (e) => {
      try { await navigator.clipboard.writeText(invoer.value); e.currentTarget.textContent = 'Gekopieerd'; }
      catch (fout) { invoer.focus(); invoer.select(); }
    });
  }

  let gastTimer=null;
  async function verversGast(){
    try{const d=await api("reis/uitnodiging/open",{code});teken(d.uitnodiging);}
    catch(e){$("#vak").innerHTML=status(e.message+" Open de originele gastlink opnieuw om het nogmaals te proberen.");}
  }
  document.addEventListener("visibilitychange",()=>{if(gastTimer&&!document.hidden)verversGast();});
  function teken(u) {
    if(u.programma){
      RTGReisProgramma.teken($("#vak"),u,false);
      const b=document.createElement("button");b.id="gast-ververs";b.className="ds-knop ds-knop--stil";b.textContent="Controleer op wijzigingen";b.type="button";
      b.onclick=verversGast;$("#vak").append(b);
      if(!gastTimer)gastTimer=setInterval(()=>{if(!document.hidden)verversGast();},60000);
      return;
    }
    const kop = '<p class="ds-label">Uw reis staat klaar</p><h1 class="ds-titel ds-titel--scherm">' +
      (u.bestemming ? esc(u.bestemming) : 'Uw reis') + '</h1>' +
      '<p class="ds-meta">' + esc(dagen(u.venster)) + ' &middot; ' + esc(soortenZin(u.soorten)) + '</p>' +
      '<p class="ds-meta">Klaargezet door ' + esc(u.van) + '.</p>';

    if (!u.open) {
      document.body.dataset.dsSchermtype = 'status';
      $('#vak').innerHTML = kop + status(u.reden || 'Deze uitnodiging kan niet meer gebruikt worden.');
      return;
    }
    /* WAT ER TE ZIEN IS VOORDAT IEMAND HEM OVERNEEMT, staat hierboven: waar,
       wanneer, hoeveel. De onderdelen zelf komen pas in zijn eigen dossier. */
    const uitleg = u.idNodig
      ? 'U reist met iemand mee. Omdat u daarmee in de reisgegevens van een ander komt, controleren wij eerst uw identiteit -- dat gebeurt in uw account.'
      : 'Neem hem over en hij staat in uw eigen RTG-reisoverzicht: alle onderdelen op een tijdlijn, met wat er nog niet rond is.';
    $('#vak').innerHTML = kop +
      '<p class="ds-meta">' + esc(uitleg) + '</p>' +
      '<div class="ds-taak__kop" id="doe"></div>';
    token() ? tekenOvernemen() : tekenAanmelden();
  }

  function tekenOvernemen() {
    $('#doe').innerHTML = '<button ' + VOL + ' id="neem" type="button" data-ds-actie="Neem deze reis over">Neem deze reis over</button>' +
      '<p class="ds-meta" id="uit" aria-live="polite"></p>';
    $('#neem').addEventListener('click', async () => {
      $('#neem').disabled = true;
      try {
        const d = await api('reis/uitnodiging/eisop', { code }, token());
        klaar('Overgenomen: ' + d.overgenomen + ' onderdeel' + (d.overgenomen === 1 ? '' : 'en') + ' staan nu in uw reisoverzicht.');
      } catch (e) { $('#uit').textContent = e.message; $('#neem').disabled = false; }
    });
  }

  /* AANMELDEN. Dit is de gewone registratie van RTG en geen achterdeur: er gaat
     geen pas in mee. Wie een Lifestyle- of Business Pass wil, komt langs een
     mens -- een link kan dat niet regelen (CLAUDE.md). */
  function tekenAanmelden() {
    $('#doe').innerHTML =
      '<section class="ds-taak__kop" aria-labelledby="rKop">' +
        '<h2 class="ds-kaart__titel" id="rKop">Word lid van RTG</h2>' +
        '<p class="ds-meta">Uw reis komt daarna in uw eigen overzicht te staan. U kiest zelf wat u verder met RTG doet.</p>' +
        '<div class="ds-velden">' + veld('rNaam', 'Uw naam', 'text', 'Voor- en achternaam') +
        veld('rMail', 'E-mailadres', 'email', 'u@voorbeeld.nl') +
        veld('rTel', 'Telefoon', 'tel', '06 12 34 56 78') +
        veld('rGeb', 'Geboortedatum', 'date', '') +
        veld('rWw', 'Wachtwoord', 'password', 'minstens 6 tekens') + '</div>' +
        '<button ' + VOL + ' id="rGo" type="button" data-ds-actie="Word lid en neem de reis over">Word lid en neem de reis over</button>' +
        '<p class="ds-meta" id="rUit" aria-live="polite"></p>' +
        '<p class="ds-meta">Heeft u al een RTG-account? ' +
          '<a href="/apps/app.html">Log eerst in</a> en open deze link daarna opnieuw.</p>' +
      '</section>';
    $('#rGo').addEventListener('click', aanmelden);
  }
  function veld(id, label, soort, plaats) {
    return rijVeld(label, '<input class="ds-veld__invoer" id="' + id + '" type="' + soort + '" placeholder="' + esc(plaats) + '">');
  }

  async function aanmelden() {
    const knop = $('#rGo');
    knop.disabled = true;
    $('#rUit').textContent = '';
    try {
      const d = await api('auth/register', {
        name: $('#rNaam').value, email: $('#rMail').value, phone: $('#rTel').value,
        password: $('#rWw').value, geboortedatum: $('#rGeb').value
      });
      if (!d.token) throw new Error('Aanmelden lukte, maar er kwam geen sessie terug. Log in via de app.');
      try { localStorage.setItem('rtg_member_token', d.token); } catch (e) {}
      const over = await api('reis/uitnodiging/eisop', { code }, d.token);
      klaar('Welkom bij RTG. Uw reis staat klaar: ' + over.overgenomen + ' onderdeel' + (over.overgenomen === 1 ? '' : 'en') + '.');
    } catch (e) { $('#rUit').textContent = e.message; knop.disabled = false; }
  }
})();
