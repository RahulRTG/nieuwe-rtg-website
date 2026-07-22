  /* Aanmelden als gesprek: Rahul in plaats van het ouderwetse formulier.
     Het gesprek verzamelt de antwoorden menselijk (en legt op "waarom?" uit
     waarvoor iets dient); aan het eind gaan de velden door dezelfde ene
     registratieroute als het formulier (login() hierboven), dus er is geen
     tweede toegangspad. Wie liever zelf invult, klapt het oude formulier
     open. Deelt de IIFE-scope met 00-kern-03.js (toReg, login, API, T). */
  (function aanmeldGesprek(){
    const regForm = document.getElementById('regForm');
    if (!regForm || !API.enabled) return;
    const st = document.createElement('style');
    st.textContent = '#regForm.ag-chat > :not(.ag-doos){display:none !important;}' +
      '.ag-doos{display:flex;flex-direction:column;gap:0.5rem;width:100%;}' +
      '.ag-log{display:flex;flex-direction:column;gap:0.45rem;max-height:46vh;overflow-y:auto;padding:0.2rem 0;}' +
      '.ag-bericht{border:1px solid var(--line);border-radius:12px;padding:0.55rem 0.75rem;font-size:0.82rem;line-height:1.5;max-width:92%;}' +
      '.ag-bericht.van-rahul{align-self:flex-start;background:var(--card2,#1B1817);}' +
      '.ag-bericht.van-mij{align-self:flex-end;background:var(--burgundy);color:#fff;border-color:var(--burgundy);}' +
      '.ag-rij{display:flex;gap:0.4rem;}' +
      '.ag-rij input{flex:1;min-width:0;}' +
      '.ag-wissel{font-size:0.7rem;color:var(--soft);background:none;border:none;cursor:pointer;text-decoration:underline;padding:0.2rem 0;font-family:inherit;}';
    document.head.appendChild(st);

    const doos = document.createElement('div');
    doos.className = 'ag-doos';
    doos.innerHTML = '<div class="ag-log" role="log" aria-live="polite" aria-label="' + T('ag.log','Gesprek met Rahul') + '"></div>' +
      '<div class="ag-rij"><input id="agIn" autocomplete="off" aria-label="' + T('ag.in','Uw antwoord aan Rahul') + '" placeholder="' + T('ag.plho','Typ gewoon wat u denkt...') + '">' +
      '<button type="button" class="abtn" id="agGo">' + T('ag.stuur','Stuur') + '</button></div>' +
      '<button type="button" class="ag-wissel" id="agWissel">' + T('ag.zelf','Liever zelf invullen? Open het formulier.') + '</button>';
    regForm.insertBefore(doos, regForm.firstChild);
    regForm.classList.add('ag-chat');

    const log = doos.querySelector('.ag-log');
    const inp = doos.querySelector('#agIn');
    let gesprek = null, bezig = false, velden = null;

    function zeg(wie, tekst){
      const b = document.createElement('div');
      b.className = 'ag-bericht van-' + wie;
      b.textContent = tekst;
      log.appendChild(b);
      log.scrollTop = log.scrollHeight;
    }
    async function start(){
      if (gesprek || bezig) return;
      bezig = true;
      try { const d = await API.call('/aanmeld/start', {}); gesprek = d.id; zeg('rahul', d.tekst); }
      catch(e){ zeg('rahul', T('ag.mis','Het gesprek wil even niet starten; het formulier hieronder werkt altijd.')); }
      bezig = false;
    }
    async function stuur(){
      const tekst = inp.value.trim();
      if (!tekst || bezig || !gesprek) return;
      zeg('mij', inp.type === 'password' ? '••••••••' : tekst);
      inp.value = '';
      bezig = true;
      try {
        const d = await API.call('/aanmeld/zeg', { id: gesprek, tekst });
        zeg('rahul', d.tekst);
        // bij de wachtwoord-stap kijkt niemand mee, ook op het scherm niet
        inp.type = /wachtwoord/i.test(d.tekst) && !d.klaar ? 'password' : 'text';
        if (d.klaar && d.velden){
          velden = d.velden;
          if (d.werkgever) { try { localStorage.setItem('rtg_ag_werkgever', JSON.stringify(d.werkgever)); } catch(e2){} }
          // dezelfde ene registratieroute als het formulier
          await login('rtg', { register: true, name: velden.name, u: velden.email, phone: velden.phone,
            geboortedatum: velden.geboortedatum, p: velden.password, tier: velden.tier });
        }
      } catch(e){ zeg('rahul', e.message || T('ag.mis2','Dat ging even mis; zeg het nog eens.')); }
      bezig = false;
      inp.focus();
    }
    doos.querySelector('#agGo').addEventListener('click', stuur);
    inp.addEventListener('keydown', e => { if (e.key === 'Enter'){ e.preventDefault(); stuur(); } });
    doos.querySelector('#agWissel').addEventListener('click', () => {
      const chat = regForm.classList.toggle('ag-chat');
      doos.querySelector('#agWissel').textContent = chat
        ? T('ag.zelf','Liever zelf invullen? Open het formulier.')
        : T('ag.terug','Toch liever met Rahul praten? Sluit het formulier.');
      if (chat) start();
    });
    if (toReg) toReg.addEventListener('click', start);
  })();
