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

  const dagen = (v) => v.van === v.tot ? v.van : v.van + ' t/m ' + v.tot;
  const soortenZin = (s) => Object.entries(s || {}).map(([k, n]) => n + ' ' + k + (n === 1 ? '' : 'en')).join(', ');

  /* ZONDER CODE is dit de beheerkant: een ingelogd lid ziet hier zijn eigen
     verstuurde uitnodigingen en kan ze intrekken. Zonder sessie én zonder code
     valt er niets te tonen -- dan is de link gewoon niet compleet. */
  if (!code) { token() ? mijnUitnodigingen() : ($('#vak').innerHTML =
    '<p class="rtg-sub">Deze link is niet compleet. Vraag om een nieuwe.</p>'); return; }

  api('reis/uitnodiging/open', { code }).then((d) => teken(d.uitnodiging)).catch((e) => {
    $('#vak').innerHTML = '<p class="rtg-sub">' + esc(e.message) + '</p>';
  });

  async function mijnUitnodigingen(verseLink) {
    let d;
    try { d = await api('reis/uitnodiging/mijn', {}, token()); }
    catch (e) { $('#vak').innerHTML = '<p class="rtg-sub">' + esc(e.message) + '</p>'; return; }
    const rij = d.uitnodigingen || [];
    $('#vak').innerHTML = '<h2 class="rp-invite-9">Uw uitnodigingen</h2>' +
      '<p class="rtg-sub rp-invite-1">Een uitnodigingslink wordt alleen bij uitgifte getoond. ' +
        'Niet ontvangen? Roteer haar; de oude link wordt dan direct onbruikbaar.</p>' +
      '<div id="eenmaligeLink" aria-live="polite"></div>' +
      (rij.length ? rij.map((u) =>
        '<div class="rtg-rij"><span class="rtg-tekst"><span class="rtg-naam">' + esc(u.bestemming || 'reis') +
          ' &middot; ' + esc(dagen(u.venster)) + '</span>' +
          '<span class="rtg-sub">' + (u.opgeeist ? 'overgenomen' : u.ingetrokken ? 'ingetrokken' :
            'geldig tot ' + esc(u.toegang && u.toegang.expires_at)) + '</span></span>' +
          (u.opgeeist || u.ingetrokken ? '' :
            '<button class="rtg-knop" type="button" data-roteer="' + esc(u.id) + '">Roteer link</button>' +
            '<button class="rtg-knop" type="button" data-weg="' + esc(u.id) + '">Trek in</button>') +
        '</div>').join('')
      : '<p class="rtg-sub">U heeft nog geen uitnodigingen verstuurd. Dat doet u bij een reis in <a href="/apps/reizen.html">RTG Reizen</a>.</p>');
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
    vak.innerHTML = '<div class="rtg-groep rp-invite-2">' +
      '<strong>Nieuwe link: nu eenmalig kopiëren</strong>' +
      '<input class="rtg-veld rp-invite-3" id="verseLink" readonly autocomplete="off" spellcheck="false">' +
      '<button class="rtg-knop" id="kopieerVerseLink" type="button">Kopieer link</button></div>';
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
    catch(e){$("#vak").replaceChildren();const p=document.createElement("p");p.textContent=e.message+" Open de originele gastlink opnieuw om het nogmaals te proberen.";$("#vak").append(p);}
  }
  document.addEventListener("visibilitychange",()=>{if(gastTimer&&!document.hidden)verversGast();});
  function teken(u) {
    if(u.programma){
      document.body.classList.add("rtg-programma-gast");
      RTGReisProgramma.teken($("#vak"),u,false);
      const b=document.createElement("button");b.id="gast-ververs";b.textContent="Controleer op wijzigingen";b.type="button";
      b.onclick=verversGast;$("#vak").append(b);
      if(!gastTimer)gastTimer=setInterval(()=>{if(!document.hidden)verversGast();},60000);
      return;
    }
    const kop = '<h2 class="rp-invite-10">' +
      (u.bestemming ? esc(u.bestemming) : 'Uw reis') + '</h2>' +
      '<p class="rtg-sub">' + esc(dagen(u.venster)) + ' &middot; ' + esc(soortenZin(u.soorten)) + '</p>' +
      '<p class="rtg-sub rp-invite-4">Klaargezet door ' + esc(u.van) + '.</p>';

    if (!u.open) {
      $('#vak').innerHTML = kop + '<p class="rtg-sub rp-invite-5">' + esc(u.reden || 'Deze uitnodiging kan niet meer gebruikt worden.') + '</p>';
      return;
    }
    /* WAT ER TE ZIEN IS VOORDAT IEMAND HEM OVERNEEMT, staat hierboven: waar,
       wanneer, hoeveel. De onderdelen zelf komen pas in zijn eigen dossier. */
    const uitleg = u.idNodig
      ? 'U reist met iemand mee. Omdat u daarmee in de reisgegevens van een ander komt, controleren wij eerst uw identiteit -- dat gebeurt in uw account.'
      : 'Neem hem over en hij staat in uw eigen RTG-reisoverzicht: alle onderdelen op een tijdlijn, met wat er nog niet rond is.';
    $('#vak').innerHTML = kop +
      '<p class="rtg-intro rp-invite-5">' + esc(uitleg) + '</p>' +
      '<div id="doe"></div>';
    token() ? tekenOvernemen() : tekenAanmelden();
  }

  function tekenOvernemen() {
    $('#doe').innerHTML = '<div class="rtg-acties rp-invite-5">' +
      '<button class="rtg-knop vol" id="neem" type="button">Neem deze reis over</button></div>' +
      '<p class="rtg-sub" id="uit" aria-live="polite"></p>';
    $('#neem').addEventListener('click', async () => {
      $('#neem').disabled = true;
      try {
        const d = await api('reis/uitnodiging/eisop', { code }, token());
        $('#doe').innerHTML = '<p class="rtg-intro">Overgenomen: ' + d.overgenomen +
          ' onderdeel' + (d.overgenomen === 1 ? '' : 'en') + ' staan nu in uw reisoverzicht.</p>' +
          '<div class="rtg-acties"><a class="rtg-knop vol" href="/apps/reizen.html">Naar mijn reizen</a></div>';
      } catch (e) { $('#uit').textContent = e.message; $('#neem').disabled = false; }
    });
  }

  /* AANMELDEN. Dit is de gewone registratie van RTG en geen achterdeur: er gaat
     geen pas in mee. Wie een Lifestyle- of Business Pass wil, komt langs een
     mens -- een link kan dat niet regelen (CLAUDE.md). */
  function tekenAanmelden() {
    $('#doe').innerHTML =
      '<div class="rtg-groep rp-invite-5">' +
        '<h2>Word lid van RTG</h2>' +
        '<p class="rtg-uitleg">Uw reis komt daarna in uw eigen overzicht te staan. U kiest zelf wat u verder met RTG doet.</p>' +
        veld('rNaam', 'Uw naam', 'text', 'Voor- en achternaam') +
        veld('rMail', 'E-mailadres', 'email', 'u@voorbeeld.nl') +
        veld('rTel', 'Telefoon', 'tel', '06 12 34 56 78') +
        veld('rGeb', 'Geboortedatum', 'date', '') +
        veld('rWw', 'Wachtwoord', 'password', 'minstens 6 tekens') +
        '<div class="rtg-acties rp-invite-6">' +
          '<button class="rtg-knop vol" id="rGo" type="button">Word lid en neem de reis over</button>' +
        '</div>' +
        '<p class="rtg-sub" id="rUit" aria-live="polite"></p>' +
        '<p class="rtg-sub rp-invite-7">Heeft u al een RTG-account? ' +
          '<a href="/apps/app.html">Log eerst in</a> en open deze link daarna opnieuw.</p>' +
      '</div>';
    $('#rGo').addEventListener('click', aanmelden);
  }
  function veld(id, label, soort, plaats) {
    return '<label class="rtg-label" for="' + id + '">' + esc(label) + '</label>' +
      '<input class="rtg-veld rp-invite-8" id="' + id + '" type="' + soort + '" placeholder="' + esc(plaats) + '">';
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
      $('#doe').innerHTML = '<p class="rtg-intro">Welkom bij RTG. Uw reis staat klaar: ' + over.overgenomen +
        ' onderdeel' + (over.overgenomen === 1 ? '' : 'en') + '.</p>' +
        '<div class="rtg-acties"><a class="rtg-knop vol" href="/apps/reizen.html">Naar mijn reizen</a></div>';
    } catch (e) { $('#rUit').textContent = e.message; knop.disabled = false; }
  }
})();
