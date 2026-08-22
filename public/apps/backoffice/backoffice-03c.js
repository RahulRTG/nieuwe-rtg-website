  /* DE REISBALIE EN DE INSTELLINGEN -- twee kantoorschermen voor twee deuren die
     er wel waren maar nergens op uitkwamen.

     De reisbalie: het reisbureau LAS db.data.partnerTrips en niemand schreef
     erin, dus een echte installatie had nul reizen en elke aanvraag gaf 404. En
     de aanvraag-routes bestonden al maar hadden geen enkel scherm -- een
     besluit dat je nergens kunt nemen is er geen.

     De instellingen: gemeente, luchthaven, vervoerder en de andere interne
     genres komen niet via het partnerformulier binnen, en kwamen dus alleen uit
     de demo. Aansluiten is boardroomwerk (het maakt een bedrijfscode en een
     beheer-inlog), de lijst mag het hele kantoor zien.

     Alles op één plek omdat het één soort werk is: kantoor dat iets NEERZET in
     plaats van iets beoordeelt. */

  const euro = (n) => (lang() === 'en' ? 'EUR ' : '€ ') +
    Number(n || 0).toLocaleString(lang() === 'en' ? 'en-US' : 'nl-NL', { minimumFractionDigits: 0, maximumFractionDigits: 2 });

  async function renderReisaanbod(){
    const el = $('#raList'); if (!el) return;
    let d = null; try { d = await call('/office/reisaanbod'); } catch(e){ return; }
    const rij = (d && d.reizen) || [];
    el.innerHTML = rij.length ? rij.map(function(r){
      const open = r.openAanvragen
        ? '<span class="pill bereiding">'+r.openAanvragen+' '+T('ra.open','open')+'</span>' : '';
      return '<div class="row"><div class="r1"><div><div class="nm">'+escHtml(r.titel)+' '+open+'</div>'+
        '<div class="sub">'+escHtml(r.bestemming)+' · '+euro(r.netto)+' '+T('ra.pp','p.p.')+
          (r.dates ? ' · '+escHtml(r.dates) : '')+
          (r.door ? ' · '+T('ra.door','door')+' '+escHtml(r.door) : '')+
          (r.desc ? '<br>'+escHtml(r.desc.slice(0,140)) : '')+'</div></div>'+
        '<div style="display:flex;gap:0.4rem;flex-shrink:0;"><button class="vbtn" data-raweg="'+escHtml(r.id)+'">'+T('ra.weg','Uit het aanbod')+'</button></div>'+
      '</div></div>';
    }).join('') : '<div class="empty">'+T('bo.nora','Nog geen reizen in het aanbod. Zolang hier niets staat, is het reisbureau voor leden leeg en kan er niets worden aangevraagd.')+'</div>';
    document.querySelectorAll('[data-raweg]').forEach(function(b){
      b.addEventListener('click', async function(){
        try { await call('/office/reisaanbod/weg', { id: b.dataset.raweg }); renderReisaanbod(); }
        catch(e){ alert(e.message); }
      });
    });
  }

  /* Neerzetten. `includes` komt als één regel binnen met puntkomma's ertussen:
     dat is sneller typen dan een lijstje bouwen, en de server knipt en snoeit. */
  function reisaanbodKnop(){
    const knop = $('#raZet'); if (!knop) return;
    knop.addEventListener('click', async function(){
      const incl = ($('#raIncl').value || '').split(';').map(function(x){ return x.trim(); }).filter(Boolean);
      try {
        await call('/office/reisaanbod/zet', {
          titel: $('#raTitel').value, bestemming: $('#raBestemming').value,
          netto: ($('#raNetto').value || '').replace(',', '.'),
          dates: $('#raDates').value, desc: $('#raDesc').value, includes: incl
        });
        ['raTitel','raBestemming','raNetto','raDates','raDesc','raIncl'].forEach(function(id){ $('#'+id).value = ''; });
        renderReisaanbod();
      } catch(e){ alert(e.message); }
    });
  }

  /* De aanvragen van leden. Bevestigen zet de reis in hun dossier op bevestigd,
     afwijzen haalt hem eruit -- en dat laatste vraagt een reden, zoals elke
     deur die dichtgaat in dit huis. */
  async function renderReisaanvragen(){
    const el = $('#rbList'); if (!el) return;
    let d = null; try { d = await call('/office/reisbureau'); } catch(e){ return; }
    const rij = (d && d.aanvragen) || [];
    el.innerHTML = rij.length ? rij.map(function(a){
      const af = a.status !== 'aangevraagd';
      const stand = a.status === 'bevestigd' ? T('rb.ok','bevestigd')
        : a.status === 'afgewezen' ? T('rb.no','afgewezen')
        : a.status === 'geannuleerd' ? T('rb.an','ingetrokken') : null;
      return '<div class="row"><div class="r1"><div><div class="nm">'+escHtml(a.titel || a.bestemming)+'</div>'+
        '<div class="sub">'+escHtml(a.codename || '')+' · '+a.personen+' '+T('rb.pers','p.')+
          (a.vertrek ? ' · '+escHtml(a.vertrek) : '')+' · '+escHtml(a.ref)+' · '+timeAgo(a.at)+
          (a.besluit && a.besluit.door ? ' · '+T('rb.door','door')+' '+escHtml(a.besluit.door) : '')+
          (a.besluit && a.besluit.reden ? '<br>"'+escHtml(a.besluit.reden.slice(0,120))+'"' : '')+'</div></div>'+
        (af ? '<span class="pill '+(a.status==='bevestigd'?'klaar':'bereiding')+'">'+escHtml(stand || a.status)+'</span>'
            : '<div style="display:flex;gap:0.4rem;flex-shrink:0;"><button class="vbtn ok" data-rbok="'+escHtml(a.ref)+'">'+T('rb.bev','Bevestigen')+'</button><button class="vbtn no" data-rbno="'+escHtml(a.ref)+'">'+T('rb.wijs','Afwijzen')+'</button></div>')+
      '</div></div>';
    }).join('') : '<div class="empty">'+T('bo.norb','Nog geen reisaanvragen. Leden vragen een reis aan in het reisbureau; hier bevestigt u de datum of wijst u af.')+'</div>';
    document.querySelectorAll('[data-rbok]').forEach(function(b){
      b.addEventListener('click', async function(){
        try { await call('/office/reisbureau/bevestig', { ref: b.dataset.rbok }); renderReisaanvragen(); }
        catch(e){ alert(e.message); }
      });
    });
    document.querySelectorAll('[data-rbno]').forEach(function(b){
      b.addEventListener('click', async function(){
        const reden = prompt(T('rb.reden','Waarom wijst u deze aanvraag af?'));
        if (!reden) return;
        try { await call('/office/reisbureau/afwijzen', { ref: b.dataset.rbno, reden: reden }); renderReisaanvragen(); }
        catch(e){ alert(e.message); }
      });
    });
  }

  /* De instellingen. De keuzelijst komt van de server en dus uit het
     genre-register: wie daar een genre op 'intern' zet, ziet het hier vanzelf
     verschijnen zonder dat dit bestand iets weet. */
  async function renderInstellingen(){
    const el = $('#instList'); if (!el) return;
    let d = null; try { d = await call('/office/instellingen'); } catch(e){ return; }
    const rij = (d && d.instellingen) || [];
    el.innerHTML = rij.length ? rij.map(function(i){
      const stand = i.online
        ? '<span class="pill klaar">'+T('inst.on','online')+'</span>'
        : '<span class="pill bereiding">'+T('inst.off','offline')+'</span>';
      return '<div class="row"><div class="r1"><div><div class="nm">'+escHtml(i.naam)+' '+stand+
          (i.demo ? ' <span class="pill">'+T('inst.demo','demo')+'</span>' : '')+'</div>'+
        '<div class="sub">'+escHtml(i.genre)+' · '+escHtml(i.plaats || '')+' · '+escHtml(i.code)+
          (i.door ? ' · '+T('inst.door','aangesloten door')+' '+escHtml(i.door) : '')+'</div></div>'+
      '</div></div>';
    }).join('') : '<div class="empty">'+T('bo.noinst','Nog geen instellingen aangesloten. Zolang er geen gemeente, luchthaven of vervoerder hangt, staan die werelden voor leden leeg.')+'</div>';

    const keuze = $('#instGenre');
    if (keuze && !keuze.options.length) {
      let g = null; try { g = await call('/office/instelling/genres'); } catch(e){ return; }
      keuze.innerHTML = ((g && g.genres) || []).map(function(x){
        return '<option value="'+escHtml(x.id)+'">'+escHtml(x.label)+'</option>';
      }).join('');
    }
  }

  function instellingKnop(){
    const knop = $('#instZet'); if (!knop) return;
    knop.addEventListener('click', async function(){
      const box = $('#instResult');
      try {
        const d = await call('/office/instelling/aansluiten', {
          genre: $('#instGenre').value, naam: $('#instNaam').value,
          plaats: $('#instPlaats').value, beheerder: $('#instBeheerder').value
        });
        // de code en de PIN gaan hier één keer over het scherm; daarna nergens meer
        box.style.display = 'block';
        box.innerHTML = '✓ '+escHtml(d.vervolg || '')+
          '<br><b>'+T('inst.code','Bedrijfscode')+': '+escHtml(d.code)+'</b> · <b>'+T('inst.pin','Beheer-PIN')+': '+escHtml(d.pin)+'</b>';
        ['instNaam','instPlaats','instBeheerder'].forEach(function(id){ $('#'+id).value = ''; });
        renderInstellingen();
      } catch(e){ alert(e.message); }
    });
  }
