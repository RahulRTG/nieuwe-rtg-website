/* aanmelden met de kassacode */
    const go = async () => {
      $('#kaFout').textContent = '';
      try {
        const r = await fetch('/api/office/login', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ code: $('#kaCode').value.trim(), totp: $('#kaTotp').value.trim() }) });
        const d = await r.json().catch(() => ({}));
        if (!r.ok) throw new Error(d.error || T('pd.ka.fout','Die code klopt niet.'));
        kaToken = d.token; try { localStorage.setItem('rtg_office_token', kaToken); } catch(e){}
        // een account voor alles: net bewezen code stil aan het RTG-account koppelen
        try {
          const lt = localStorage.getItem('rtg_member_token');
          if (lt) fetch('/api/account/koppel', { method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + lt },
            body: JSON.stringify({ soort: 'kantoor', code: $('#kaCode').value.trim(), totp: $('#kaTotp').value.trim() }) });
        } catch(e){}
        enterKantoor();
      } catch(e){ $('#kaFout').textContent = e.message; }
    };
    $('#kaGo').addEventListener('click', go);
    $('#kaCode').addEventListener('keydown', e => { if (e.key === 'Enter') go(); });
    $('#kaCode').focus();
    // Een gekoppelde kantoorrol start met een tik via hetzelfde RTG-account.
    (async () => {
      let lt = null; try { lt = localStorage.getItem('rtg_member_token'); } catch(e){}
      if (!lt) return;
      try {
        const r = await fetch('/api/account/rollen', { method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + lt }, body: '{}' });
        const d = await r.json().catch(() => ({}));
        if (!r.ok || !(d.rollen || []).some(x => x.rol === 'kantoor')) return;
        // toonKantoorLogin kan opnieuw tekenen terwijl de rollencontrole nog
        // onderweg is. Beide antwoorden mogen samen maar één ingang maken.
        if ($('#kaAccountVerder')) return;
        const b = document.createElement('button');
        b.id = 'kaAccountVerder';
        b.className = 'abtn'; b.style.cssText = 'margin-top:0.7rem;width:100%;padding:0.8rem;';
        b.textContent = '' + T('pd.ka.een', 'Verder met uw RTG-account');
        b.addEventListener('click', async () => {
          const s = await fetch('/api/account/start', { method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + lt }, body: JSON.stringify({ rol: 'kantoor' }) });
          const sd = await s.json().catch(() => ({}));
          if (!s.ok) { $('#kaFout').textContent = sd.error || T('pd.mis', 'Er ging iets mis.'); return; }
          kaToken = sd.token; try { localStorage.setItem('rtg_office_token', kaToken); } catch(e){}
          enterKantoor();
        });
        const kaart = $('#gateStep').querySelector('.card');
        if (kaart) kaart.appendChild(b);
      } catch(e){}
    })();
  }
  async function enterKantoor(){
    const k = await kaApi('kamers');
    // een kantoren-deeplink bracht ons hier alleen voor het inloggen: meteen door
    const terug = kaTerugPad();
    if (terug){ location.replace(terug); return; }
    let naam = ''; try { naam = localStorage.getItem('rtg_kantoor_naam') || ''; } catch(e){}
    $('#gateStep').innerHTML = '<button class="gback" id="kaTerug">← '+T('pd.ka.staf','Personeel van een zaak')+'</button>'+
      '<div class="card" id="kaMeld">'+
        '<div class="k">'+T('pd.ka.naam','Jouw naam')+'</div>'+
        '<input class="hin h-mt40" id="kaNaam" maxlength="30" value="'+esc(naam)+'">'+
        '<div class="row"><select class="hin" id="kaKamer">'+k.kamers.map(x => '<option value="'+x.id+'">'+esc(x.naam)+'</option>').join('')+'</select>'+
        '<select class="hin" id="kaWaar" style="max-width:9.5rem;"><option value="thuis">'+T('pd.ka.thuis','Thuis')+'</option><option value="kantoor">'+T('pd.ka.hier','Kantoor')+'</option></select></div>'+
        '<button class="abtn" id="kaMeldGo" style="margin-top:0.7rem;width:100%;padding:0.8rem;">'+T('pd.ka.meld','Meld je aan voor je dienst')+'</button>'+
        '<div id="kaMFout" style="margin-top:0.4rem;font-size:0.76rem;color:var(--burgundy);min-height:1rem;"></div></div>'+
      '<div class="card" id="kaDienstBlok" hidden><div id="kaDienstTekst" style="font-size:0.9rem;"></div>'+
        '<button class="abtn ghost h-mt60" id="kaAfmeld">'+T('pd.ka.afmeld','Meld je af')+'</button></div>'+
      '<div class="card"><div class="k">'+T('pd.ka.wie','Nu aan het werk')+'</div><div class="h-mt40" id="kaWie"></div></div>'+
      '<div class="card"><div class="k">'+T('pd.ka.chat','De chat van jouw kamer')+'</div>'+
        '<div id="kaChat" style="max-height:15rem;overflow-y:auto;font-size:0.85rem;margin-top:0.4rem;"></div>'+
        '<div class="row"><input class="hin" id="kaTekst" maxlength="500" placeholder="'+T('pd.ka.bericht','Bericht...')+'">'+
        '<button class="abtn" id="kaStuur">'+T('pd.ka.stuur','Stuur')+'</button></div></div>'+
      '<div class="card"><div class="k">Integratiekamer</div>'+
        '<div class="pd-card-copy">SMTP, SMS, Stripe Connect en SEPA lokaal testen, gecontroleerd schakelen en samen als keten beproeven. Bediening vraagt boardroomtoegang.</div>'+
        '<a class="abtn pd-block" href="/apps/kantoren.html?kamer=integraties">Open het beveiligde schakelbord</a></div>'+
      '<div class="card"><div class="k">RTG Controleregister</div>'+
        '<div class="pd-card-copy">Bekijk welke code al een kantoor, rol, proef, audit, gameplay en economisch gevolg heeft. Ontbrekende koppelingen worden werk voor het juiste team.</div>'+
        '<a class="abtn pd-block" href="/apps/magnaat-kantoor.html">Open de dekkingsmatrix</a></div>'+
      '<div style="margin-top:0.6rem;font-size:0.7rem;line-height:1.5;color:var(--soft);">'+T('pd.ka.uitleg','Het volledige kantoor (statistieken, taken, boardroom) staat in de kantoren-app; dit is je zak-versie voor aanmelden en contact.')+'</div>';
