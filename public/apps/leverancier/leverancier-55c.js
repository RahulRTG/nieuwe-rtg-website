  /* ---------- "Vooruit": wat er op de zaak afkomt ----------

     De tegenhanger van de Vooruit-kaart in de ledenapp (app-main/app-main-53b.js),
     op dezelfde motor: kern/levensgraaf, met de code van de zaak als eigenaar.
     Boven de agenda, en dat is met opzet -- de agenda is wat u ZELF plant, dit is
     wat er vanzelf op u afkomt.

     NIEMAND TYPT HIER IETS IN. Elke regel komt uit iets wat de zaak al deed: een
     boeking die is binnengekomen, een afspraak die in de agenda staat. Daarom
     staat er ook bij WAAR het vandaan komt; een lijst die zichzelf vult verdient
     die verantwoording, anders is het een lijst waarvan niemand weet wie hem bijhoudt.

     Deelt de IIFE-scope met 54/55: API, T, esc, lang, $, actor komen daarvandaan. */
  let vooruitSupData = null;
  async function laadVooruitSup(){
    if (!API.live) return;
    try { vooruitSupData = await API.call('/supplier/vooruit', {}); } catch(e){ vooruitSupData = { fout: true }; }
  }
  function renderVooruitSup(){
    const el = $('#vooruitSupCard'); if (!el) return;
    /* Alleen de manager, net als de agenda ernaast: hier staan klanten (op
       codenaam) en verplichtingen van de zaak, en dat is geen dienstrooster. */
    if (!actor().manager){ el.innerHTML = ''; return; }
    if (!vooruitSupData){ el.innerHTML = ''; laadVooruitSup().then(renderVooruitSup); return; }
    const d = vooruitSupData;
    if (d.fout){ el.innerHTML = ''; return; }
    const dagLbl = x => { try { return new Date(x+'T12:00:00').toLocaleDateString(lang()==='en'?'en-GB':'nl-NL',{day:'numeric',month:'short'}); } catch(e){ return x; } };
    const regel = r => '<div class="vo-rij"><span>'+esc((r.waarvan ? r.waarvan+' · ' : '')+r.naam)+'</span>'+
      '<span class="vo-dag">'+esc(dagLbl(r.datum))+'</span></div>';
    let h = '<div class="card"><div class="tt-h">'+T('vo.titel','Vooruit')+
      (d.achterstallig.length ? ' <span class="vo-let">('+d.achterstallig.length+')</span>' : '')+'</div>';
    if (!d.totaal){
      h += '<div class="vo-fijn vo-mt">'+T('sup.vo.leeg','Er staat nog niets met een datum op deze zaak. Zodra er een boeking binnenkomt of u iets in de agenda zet, verschijnt het hier vanzelf.')+'</div>';
    } else {
      if (d.achterstallig.length){
        h += '<div class="vo-groep laat">'+T('vo.laat','Al voorbij')+'</div>';
        h += d.achterstallig.slice(0,4).map(regel).join('');
      }
      for (const v of d.vensters){
        if (!v.aantal) continue;
        h += '<div class="vo-groep">'+esc(v.label)+'</div>';
        h += v.items.slice(0,5).map(regel).join('');
        break;   // alleen het eerstvolgende gevulde venster; dit is een kaart, geen lijst
      }
      h += '<div class="vo-fijn vo-mt2">'+T('vo.bron','Automatisch verzameld uit')+': '+esc(d.bronnen.join(', '))+'.</div>';
    }
    for (const a of (d.afgekapt || [])) h += '<div class="vo-fijn vo-dak">'+T('vo.dak','Wij tonen de eerste')+' '+a.dak+' '+T('vo.uit','uit')+' '+esc(a.bron)+'.</div>';
    for (const s2 of (d.stuk || [])) h += '<div class="vo-fijn vo-let">'+T('vo.stuk','Wij kunnen dit deel nu niet uitlezen')+': '+esc(s2)+'.</div>';
    h += '</div>';
    el.innerHTML = h;
  }
