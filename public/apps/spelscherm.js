/* De eenmalige koppeling activeert een aparte schermsessie. Geen van beide
   gaat in een URL; de schermsessie blijft alleen in dit tabblad bewaard. */
(function () {
  'use strict';
  const $ = (s) => document.querySelector(s);
  const OPSLAG = 'rtg_spelprojectie_sessie_v1';
  let token = ''; try { token = sessionStorage.getItem(OPSLAG) || ''; } catch (e) {}
  let timer = null, bezig = false;

  function esc(s){ return String(s == null ? '' : s).replace(/[&<>"]/g, c => ({ '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;' }[c])); }
  function vergeet(){ token = ''; try { sessionStorage.removeItem(OPSLAG); } catch (e) {} }
  function bewaar(waarde){ token = waarde; try { sessionStorage.setItem(OPSLAG, waarde); } catch (e) {} }
  async function post(pad, lijf){
    const r = await fetch(pad, { method:'POST', credentials:'omit', cache:'no-store',
      referrerPolicy:'no-referrer', headers:{ 'Content-Type':'application/json' }, body:JSON.stringify(lijf) });
    const d = await r.json().catch(()=>({}));
    if (!r.ok) { const fout = new Error(d.error || 'Het gedeelde scherm is niet bereikbaar.'); fout.status = r.status; throw fout; }
    return d;
  }

  function bindInvoer(){
    const veld = $('#codeveld'), knop = $('#koppelKnop');
    if (!veld || !knop) return;
    const voerUit = ()=>{ const code = veld.value.trim().toUpperCase(); if (code) koppel(code); };
    knop.addEventListener('click', voerUit);
    veld.addEventListener('keydown', e=>{ if (e.key === 'Enter') voerUit(); });
  }
  function toonInvoer(tekst){
    if (timer) { clearInterval(timer); timer = null; }
    $('#hoofd').innerHTML = '<div class="merk">RTG Game Night</div>' +
      '<h1>Zet dit scherm aan tafel</h1><div class="uitleg">' + esc(tekst ||
        'Vraag een speler om een nieuwe eenmalige schermcode.') + '</div>' +
      '<input class="veld" id="codeveld" maxlength="40" autocomplete="off" spellcheck="false" ' +
        'placeholder="GAME.••••••••••••••••••••••••••••••••" aria-label="Eenmalige schermcode">' +
      '<button class="veld koppel" id="koppelKnop" type="button">Koppel scherm</button>' +
      '<div class="klein" id="melding"></div>';
    bindInvoer(); $('#codeveld').focus();
  }
  function toonFout(tekst, opnieuw){
    if (timer) { clearInterval(timer); timer = null; }
    $('#hoofd').innerHTML = '<div class="merk">RTG Game Night</div>' +
      '<h1 class="fout">' + esc(tekst) + '</h1>' +
      (opnieuw ? '<button class="veld koppel" id="opnieuw" type="button">Opnieuw proberen</button>' :
        '<button class="veld koppel" id="nieuweCode" type="button">Nieuwe code invoeren</button>');
    const knop = opnieuw ? $('#opnieuw') : $('#nieuweCode');
    knop.addEventListener('click', opnieuw ? start : ()=>toonInvoer());
  }

  async function koppel(code){
    if (bezig) return; bezig = true;
    const melding = $('#melding'); if (melding) melding.textContent = 'Veilig koppelen…';
    let gekoppeld = false;
    try {
      const d = await post('/api/projectie/koppel', { code });
      if (!d.token) throw new Error('De server gaf geen schermsessie terug.');
      bewaar(d.token); window.__spelKoppeling = ''; gekoppeld = true;
    } catch (e) { vergeet(); toonInvoer(e.message); }
    finally { bezig = false; }
    if (gekoppeld) start();
  }

  async function haal(){
    if (!token || bezig || document.hidden) return;
    bezig = true;
    try { teken(await post('/api/projectie/kijk', { token })); }
    catch (e) {
      if (e.status === 404 || e.status === 410) { vergeet(); toonFout(e.message, false); }
      else toonFout(e.message, true);
    } finally { bezig = false; }
  }

  /* Wat hier getekend wordt is precies wat de server stuurt. Onbekende velden
     blijven onzichtbaar; een geheime kaart kan daardoor niet via de renderer
     alsnog op het gedeelde scherm belanden. */
  function teken(d){
    const st = d.staat || {};
    const rij = (d.spelers || []).map((naam, i) => {
      const punt = Array.isArray(st.scores) ? st.scores[i]
        : (Array.isArray(st.stand) && st.stand[i] ? (st.stand[i].punten != null ? st.stand[i].punten : st.stand[i].goed) : null);
      const teamAan = d.modus === 'teams' && Array.isArray(d.teams) && d.teams[i] === d.teams[d.beurt];
      const aan = d.klaar ? false : (d.modus === 'teams' ? teamAan : i === d.beurt);
      return '<div class="sp' + (aan ? ' aan' : '') + '"><div class="pt">' +
        (punt == null ? '·' : esc(punt)) + '</div><div class="nm">' + esc(naam) + '</div></div>';
    }).join('');
    let midden = '';
    if (d.klaar) midden = '<div class="groot">' + (d.winnaar ? esc(d.winnaar) + ' wint' : 'Gelijkspel') + '</div>';
    else if (st.bezig && st.rader != null && d.spelers)
      midden = '<div class="groot">' + esc(d.spelers[st.rader] || '') + ' raadt</div>';
    else if (st.tot != null) midden = '<div class="klein">tot ' + esc(st.tot) + ' punten</div>';
    $('#hoofd').innerHTML = '<div class="merk">' + esc(d.naam) + '</div>' +
      midden + '<div class="rij">' + rij + '</div><div class="klein">Veilig gekoppeld</div>';
  }

  function start(){
    if (!token) return toonInvoer();
    if (timer) clearInterval(timer);
    haal(); timer = setInterval(haal, 3000);
  }
  bindInvoer();
  document.addEventListener('visibilitychange', ()=>{ if (!document.hidden && token) haal(); });
  if (window.RTGWauw) window.RTGWauw.wakker(true);
  if (window.__spelKoppeling) koppel(window.__spelKoppeling); else if (token) start();
})();
