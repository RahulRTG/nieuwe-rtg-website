/* aanmelden met de kassacode */
    const go = async () => {
      $('#kaFout').textContent = '';
      try {
        const r = await fetch('/api/office/login', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ code: $('#kaCode').value.trim(), totp: $('#kaTotp').value.trim() }) });
        const d = await r.json().catch(() => ({}));
        if (!r.ok) throw new Error(d.error || T('pd.ka.fout','Die code klopt niet.'));
        kaToken = d.token; try { localStorage.setItem('rtg_office_token', kaToken); } catch(e){}
        // een kantoorrol koppelen gaat alleen met een uitnodiging op naam (23-09-2026)
        enterKantoor();
      } catch(e){ $('#kaFout').textContent = e.message; }
    };
    $('#kaGo').addEventListener('click', go);
    $('#kaCode').addEventListener('keydown', e => { if (e.key === 'Enter') go(); });
    const deur = window.RTGKantoorDeur;
    let lt = null; try { lt = localStorage.getItem('rtg_member_token'); } catch(e){}
    (deur ? deur.stand() : Promise.resolve({ codeDicht: false })).then(st => {
      kaStand = st;
      if (!st.codeDicht && $('#kaCodeVak')) { $('#kaCodeVak').hidden = false; $('#kaCode').focus(); }
      else if (!lt && $('#kaDeurVak')) $('#kaDeurVak').innerHTML = '<p class="k">'+T('pd.ka.alleenAccount','Het kantoor opent met uw eigen RTG-account en een passkey. Log eerst in met uw account.')+'</p>';
      if (lt) accountDeur(lt, st);
    });
  }
  let kaStand = null;
  /* EEN INGANG VOOR WIE DE KANTOORROL HEEFT. Waar de code dicht is (productie)
     is dit de passkeyknop, en ligt de ceremonie al klaar voor er getikt wordt:
     de tik start navigator.credentials.get zelf (shared/kantoordeur.js, Safari). */
  async function accountDeur(lt, st){
    try {
      const r = await fetch('/api/account/rollen', { method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + lt }, body: '{}' });
      const d = await r.json().catch(() => ({}));
      if (!r.ok) return;
      if (!(d.rollen || []).some(x => x.rol === 'kantoor')) { kantoorUitnodigingVeld(lt); return; }
      // toonKantoorLogin kan opnieuw tekenen terwijl de rollencontrole nog
      // onderweg is. Beide antwoorden mogen samen maar één ingang maken.
      if ($('#kaAccountVerder')) return;
      const b = document.createElement('button');
      b.id = 'kaAccountVerder';
      b.className = st.codeDicht ? 'hoofd' : 'abtn'; b.style.cssText = 'margin-top:0.7rem;width:100%;padding:0.8rem;';
      if (st.codeDicht) b.setAttribute('data-hoofdactie', '');
      b.textContent = st.codeDicht ? T('pd.ka.passkey', 'Kantoor openen met passkey') : T('pd.ka.een', 'Verder met uw RTG-account');
      b.onclick = () => kantoorMetAccount(lt);
      const vak = $('#kaDeurVak') || $('#gateStep').querySelector('.card');
      if (!vak) return;
      vak.appendChild(b);
      if (st.codeDicht && window.RTGKantoorDeur) kaUitkomst(lt, null, await RTGKantoorDeur.bereid(lt), true);
    } catch(e){}
  }
  /* DE KANTOORUITNODIGING VERZILVEREN (op naam, eenmalig). Het scherm volgt de
     server: vraagt die een passkey (productie, B24), dan de ceremonie via
     RTGZwaar; anders telt de TOTP uit het veld erboven. */
  const laad = (g, f) => window[g] || new Promise(ok => { const t = document.createElement('script'); t.src = '/shared/'+f+'.js'; t.onload = t.onerror = ok; document.head.appendChild(t); });
  function kantoorUitnodigingVeld(lt){
    const kaart = $('#gateStep').querySelector('.card');
    if (!kaart || $('#kaUitn')) return;
    kaart.insertAdjacentHTML('beforeend', '<div class="k h-mt70">'+T('pd.ka.uitn','Uitnodiging van de eigenaar')+'</div>'+
      '<div class="pinrow h-mt40"><input id="kaUitn" aria-label="'+T('pd.ka.uitn','Uitnodiging van de eigenaar')+'" autocomplete="off" autocapitalize="characters" maxlength="40" placeholder="KU.">'+
      '<button id="kaUitnGo" class="abtn">'+T('pd.ka.uitnGo','Koppel aan mijn account')+'</button></div>');
    const ga = async () => {
      $('#kaFout').textContent = '';
      try {
        await laad('RTGPasskey', 'passkey'); await laad('RTGZwaar', 'zwaarbevestig');
        await RTGZwaar.doe('/api/account/koppel', { soort: 'kantoor', uitnodiging: $('#kaUitn').value.trim(), totp: $('#kaTotp').value.trim() }, { token: lt });
        kantoorMetAccount(lt);
      } catch(e){ $('#kaFout').textContent = e.message || T('pd.mis', 'Er ging iets mis.'); }
    };
    $('#kaUitnGo').addEventListener('click', ga);
    $('#kaUitn').addEventListener('keydown', e => { if (e.key === 'Enter') ga(); });
  }
