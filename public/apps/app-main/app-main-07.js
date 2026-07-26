    if (!conns.length && !reqs.length){
      html += '<div class="big" style="font-size:1.02rem;">Nog geen contacten</div>'+
        '<div class="meta" style="margin:.2rem 0 .7rem;">Voeg iemand toe in De Salon; daarna bericht of (video)bel je elkaar met één tik, zonder telefoonnummer.</div>'+
        '<div style="display:flex;gap:.5rem;flex-wrap:wrap;align-items:center;">'+
        '<button class="go" data-goto="salon">Iemand toevoegen →</button>'+
        '<button class="rahul-leeg-knop" data-rahul-leeg="Zoek in De Salon iemand die bij me past en help me die toe te voegen als connectie">Laat Rahul iemand voorstellen</button>'+
        '</div>';
    } else {
      html += conns.map(c =>
        '<div class="hc-rij" style="display:flex;align-items:center;gap:.6rem;padding:.5rem 0;border-bottom:1px solid var(--line);">'+
        '<span class="sc-av" style="width:2.2rem;height:2.2rem;cursor:pointer;" data-dm="'+escT(c.key)+'" data-cn="'+escT(c.codename)+'">'+initCN(c.codename)+(c.unread?'<span class="sc-badge">'+c.unread+'</span>':'')+'</span>'+
        '<b style="flex:1;min-width:0;cursor:pointer;" data-dm="'+escT(c.key)+'" data-cn="'+escT(c.codename)+'">'+escT(c.codename)+'</b>'+
        '<button class="go" style="padding:.2rem .5rem;" data-dm="'+escT(c.key)+'" data-cn="'+escT(c.codename)+'">Bericht</button>'+
        '<button class="go" style="background:transparent;padding:.2rem .35rem;" data-snap="'+escT(c.key)+'" data-cn="'+escT(c.codename)+'" title="Snap">'+RTGGlyf.svgHTML('camera')+'</button>'+
        '<button class="go" style="background:transparent;padding:.2rem .35rem;" data-bel="'+escT(c.key)+'" data-cn="'+escT(c.codename)+'">'+RTGGlyf.svgHTML('bellen')+'</button>'+
        '<button class="go" style="background:transparent;padding:.2rem .35rem;" data-vid="'+escT(c.key)+'" data-cn="'+escT(c.codename)+'">'+RTGGlyf.svgHTML('videobellen')+'</button></div>'
      ).join('') + '<button class="go" style="margin-top:.7rem;background:transparent;color:var(--muted);" data-goto="salon">+ Iemand toevoegen</button>';
    }
    el.innerHTML = html;
    el.querySelectorAll('[data-dm]').forEach(b => b.addEventListener('click', () => openDm(b.dataset.dm, b.dataset.cn)));
    el.querySelectorAll('[data-snap]').forEach(b => b.addEventListener('click', () => snapKies(b.dataset.snap)));
    el.querySelectorAll('[data-bel]').forEach(b => b.addEventListener('click', () => snelBel(b.dataset.bel, b.dataset.cn, false)));
    el.querySelectorAll('[data-vid]').forEach(b => b.addEventListener('click', () => snelBel(b.dataset.vid, b.dataset.cn, true)));
    renderSnapsStories();
    el.querySelectorAll('[data-cja]').forEach(b => b.addEventListener('click', async () => { try { await API.call('/member/connect/respond', { key: b.dataset.cja, action: 'accept' }); toast(T('sal.verbonden','Verbonden.')); loadSocial(); } catch(e){ toast(e.message); } }));
    el.querySelectorAll('[data-cnee]').forEach(b => b.addEventListener('click', async () => { try { await API.call('/member/connect/respond', { key: b.dataset.cnee, action: 'decline' }); loadSocial(); } catch(e){ toast(e.message); } }));
    el.querySelectorAll('[data-goto]').forEach(b => b.addEventListener('click', () => openTab(b.dataset.goto)));
  }

  /* ---------- snaps en 24-uurs verhalen (Snapchat-achtig) ---------- */
  let snapNaar = null, snapStoryMode = false, snapFileEl = null;
  function snapFile(){ if (!snapFileEl){ snapFileEl = document.createElement('input'); snapFileEl.type='file'; snapFileEl.accept='image/*'; snapFileEl.style.display='none'; document.body.appendChild(snapFileEl); snapFileEl.addEventListener('change', snapGekozen); } return snapFileEl; }
  function snapKies(key){ snapNaar = key; snapStoryMode = false; snapFile().click(); }
  function storyKies(){ snapStoryMode = true; snapNaar = null; snapFile().click(); }
  async function snapGekozen(e){
    const f = e.target.files[0]; e.target.value=''; if(!f) return;
    const foto = await snapVerklein(f); if(!foto){ toast(T('snap.leesfout','Kon de foto niet lezen.')); return; }
    const tekst = prompt(T('snap.tekst','Tekst erbij (mag leeg):'),'') || '';
    try {
      if (snapStoryMode){ await API.call('/member/story/post', { foto, tekst }); toast(''+T('snap.storyok','Je verhaal staat er 24 uur op.')); loadStories(); }
      else { await API.call('/member/snap/send', { toKey: snapNaar, foto, tekst }); toast(''+T('snap.verstuurd','Snap verstuurd. Hij verdwijnt na bekijken.')); }
    } catch(err){ toast(err.message); }
  }
  function snapVerklein(file){
    return new Promise(res => { const img=new Image(), rd=new FileReader();
      rd.onload=()=>{ img.onload=()=>{ const max=1000; let w=img.width,h=img.height; if(w>max||h>max){ const r=Math.min(max/w,max/h); w=Math.round(w*r); h=Math.round(h*r);} const cv=document.createElement('canvas'); cv.width=w; cv.height=h; cv.getContext('2d').drawImage(img,0,0,w,h); res(cv.toDataURL('image/jpeg',0.7)); }; img.onerror=()=>res(null); img.src=rd.result; };
      rd.onerror=()=>res(null); rd.readAsDataURL(file); });
  }
  /* ---------- verplichte onboarding als gesprek met Rahul ----------
     Geen formulier meer: Rahul vraagt de ontbrekende gegevens één voor één,
     laat de overeenkomst lezen en laat je tekenen door je naam te typen. Alles
     loopt over dezelfde routes als voorheen (/onboarding/status|opslaan|teken
     en /verify/upload). De invoerregel + knoppen worden in 10-social-02
     bedraad; de gespreksfuncties staan hier. */
  let onbBezig = false, onbSt = null, onbRij = [], onbStap = null, onbHuidig = null, onbGeopend = false, onbMond = null;
  function onbEl(id){ return document.getElementById(id); }
  // Rahuls signatuurmond boven de onboarding, dezelfde als op de poort; en zijn
  // woorden verschijnen letter voor letter (RTGTyp) terwijl de mond meebeweegt.
  function onbMondMaak(){ const c = onbEl('onbMond'); if (c && !onbMond && window.RTGMond) onbMond = RTGMond.maak(c); }
  function onbZeg(t){
    const z = onbEl('onbTitel'); if (!z) return;
    const praat = onbMond ? function(ms){ onbMond.praat(ms); } : null;
    if (window.RTGTyp) RTGTyp.schrijf(z, t, { praat: praat });
    else { z.textContent = t; if (praat) praat(400); }
  }
  function onbInputType(t){ return t==='date'?'date':t==='email'?'email':t==='tel'?'tel':'text'; }
  function onbOpenVelden(){ return ((onbSt && onbSt.velden) || []).filter(function(v){ return !v.ingevuld; }); }

  async function checkOnboarding(){
    if (!API.live || !API.token || onbBezig) return;
    let st; try { st = await API.call('/onboarding/status'); } catch(e){ return; }
    if (!st || st.klaar){ const g0 = onbEl('onbGate'); if (g0) g0.hidden = true; return; }
    onbStartGesprek(st);
  }
  function onbStartGesprek(st){
    const g = onbEl('onbGate'); if (!g) return;
    if (!g.hidden && onbStap) return; // al bezig, niet opnieuw beginnen
    onbSt = st; onbMondMaak();
    onbRij = onbOpenVelden();
    onbStap = onbRij.length ? 'veld' : 'teken';
    const eerste = !onbGeopend; onbGeopend = true;
    g.hidden = false;
    if (eerste) onbZeg(T('onb.intro','Fijn dat je er bent. Nog een paar dingen en je kunt op reis.'));
    setTimeout(onbVolgende, eerste ? 750 : 0);
  }
  function onbVolgende(){
    if (onbStap === 'veld' && onbRij.length){
      onbHuidig = onbRij[0];
      if (onbHuidig.type === 'kyc') return onbVraagPaspoort();
      return onbVraagVeld(onbHuidig);
    }
    onbStap = 'teken';
    onbTekenVraag();
  }
  function onbVraagTekst(v){
    const M = {
      adres: T('onb.q.adres','Wat is je straat en huisnummer?'),
      postcode: T('onb.q.postcode','En je postcode?'),
      woonplaats: T('onb.q.woonplaats','In welke plaats woon je?'),
      land: T('onb.q.land','En in welk land?'),
      geboortedatum: T('onb.q.geboortedatum','Wat is je geboortedatum?'),
      nationaliteit: T('onb.q.nationaliteit','Wat is je nationaliteit?'),
      naam: T('onb.q.naam','Hoe heet je voluit?'),
      email: T('onb.q.email','Wat is je e-mailadres?'),
      telefoon: T('onb.q.telefoon','En je telefoonnummer?')
    };
    return M[v.id] || (T('onb.q.veld','Wat is je ') + String(v.label || '').toLowerCase() + '?');
  }
  function onbVraagVeld(v){
    const inp = onbEl('onbIn'), rij = onbEl('onbRij');
    if (rij) rij.style.display = '';
    if (inp){ inp.type = onbInputType(v.type); inp.value = ''; inp.placeholder = T('onb.typ','Typ je antwoord'); }
    onbActies([]);
    onbZeg(onbVraagTekst(v));
    if (inp) inp.focus();
  }
  function onbVraagPaspoort(){
    const rij = onbEl('onbRij'); if (rij) rij.style.display = 'none';
    onbZeg(T('onb.q.paspoort','Tot slot je paspoort, zodat ik zeker weet dat jij het bent. Scan het met de RTG-scanner of kies een foto.'));
