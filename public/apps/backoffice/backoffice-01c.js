  /* ---- backoffice, vervolg van deel 01b: DE OFFICIELE BRONWACHT ----

     APART GEZET omdat 01b met de samenvoeging van 22 augustus 2026 over de
     10 KB kwam, maar de naad ligt hier echt: dit is een eigen onderwerp. De
     bronwacht haalt officiele registers automatisch op en laat het JURIDISCHE
     oordeel bij een mens -- dezelfde grens die ONDERHOUD.md aan de wetwacht
     stelt. De rest van 01b gaat over kantoorlijsten en Foundation-inzage.

     Deel van dezelfde genaaide bundel (scripts/bundel.js): dit bestand is geen
     module en draait binnen dezelfde IIFE als 01, 01b en 02. */
  /* De officiele bronwacht: automatisch ophalen, maar nooit stil juridisch
     versoepelen. Een echte bronwijziging wordt hier een beoordeelbare taak en
     zet geraakte partnerbewijzen op hercontrole. */
  async function loadHandelsRegels(){
    const el = document.getElementById('handelsRegels'); if (!el) return;
    let d; try { d = await call('/office/partner/regels'); }
    catch(e){ el.innerHTML = '<div class="empty">Handelsregelwacht niet beschikbaar.</div>'; return; }
    const open = (d.gebeurtenissen || []).filter(g => g.status === 'open');
    const fouten = (d.bronnen || []).filter(b => String(b.uitslag || '').startsWith('fout'));
    const bronnen = (d.bronnen || []).map(b =>
      '<div class="sub"><a href="'+escHtml(b.url)+'" target="_blank" rel="noopener">'+escHtml(b.naam)+'</a> · '+
      escHtml(b.uitslag || 'nog geen basis')+(b.laatsteCheck?' · '+timeAgo(b.laatsteCheck):'')+'</div>').join('');
    const gebeurtenissen = open.map(g =>
      '<div class="row"><div class="r1"><div><div class="nm">Regelwijziging · '+escHtml(g.naam)+'</div>'+
      '<div class="sub">'+timeAgo(g.at)+' · '+g.aanvragen+' bedrijfs-, '+(g.foundationAanvragen||0)+' FOUNDATION- en '+g.leveranciers+' partnercontrole(s) heropend</div></div>'+
      '<button class="vbtn ok" data-regelbevestig="'+g.id+'">Beoordeling vastleggen</button></div></div>').join('');
    const getroffen = (d.getroffenLeveranciers || []).map(s =>
      '<div class="row"><div><div class="nm">Hercontrole · '+escHtml(s.naam)+' <span class="zacht">· '+escHtml(s.land)+'</span></div>'+
      '<div class="eisknoppen">'+s.eisen.map(e =>
        '<button class="vbtn" data-regelcode="'+escHtml(s.code)+'" data-regeleis="'+escHtml(e.id)+'">'+escHtml(e.label)+'</button>').join('')+'</div></div></div>').join('');
    el.innerHTML = '<div class="row"><div class="r1"><div><div class="nm">Automatische officiële regelwacht</div><div class="sub">'+
      (d.automatisch?'Actief, iedere '+Math.round(d.intervalMs/3600000)+' uur':'Uitgeschakeld')+' · '+open.length+' open wijziging(en) · '+fouten.length+' bronfout(en)</div></div>'+
      '<button class="vbtn" id="regelCheckNu">Nu controleren</button></div><details class="bronlijst"><summary class="sub">'+(d.bronnen||[]).length+' officiële bronnen</summary>'+bronnen+'</details></div>'+
      gebeurtenissen+getroffen;
    document.getElementById('regelCheckNu').addEventListener('click', async () => {
      try { await call('/office/partner/regels/check', {}); await loadHandelsRegels(); }
      catch(e){ alert(e.message); }
    });
    el.querySelectorAll('[data-regelbevestig]').forEach(b => b.addEventListener('click', async () => {
      const toelichting = prompt('Wat is gewijzigd en wat betekent dit voor RTG en de betrokken bedrijven?');
      if (!toelichting || toelichting.trim().length < 3) return;
      try { await call('/office/partner/regels/bevestig', { id:b.dataset.regelbevestig, toelichting }); await loadHandelsRegels(); }
      catch(e){ alert(e.message); }
    }));
    el.querySelectorAll('[data-regelcode]').forEach(b => b.addEventListener('click', async () => {
      const referentie = prompt('Welke actuele officiële bron en uitkomst zijn gecontroleerd?');
      if (!referentie || referentie.trim().length < 3) return;
      const geldigTot = prompt('Geldig tot (JJJJ-MM-DD), of leeg als er geen einddatum is:') || '';
      try { await call('/office/partner/regels/hercontrole', { code:b.dataset.regelcode,
        onderdeel:b.dataset.regeleis, referentie, geldigTot }); await loadHandelsRegels(); }
      catch(e){ alert(e.message); }
    }));
  }
