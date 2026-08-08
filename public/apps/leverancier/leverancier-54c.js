  /* De post-voorstellen van de zaak: datums die zichzelf aandienen.

     Dezelfde kaart als in de ledenapp (app-main/app-main-53c.js), op het postvak
     van de zaak. Voor een kantoor is dit eerder regel dan uitzondering: een
     leveringsbevestiging, een keuringsafspraak, een inspectie -- die komen bijna
     allemaal per post binnen en staan daarna nergens meer.

     ER GAAT NIETS VANZELF. Wat hier staat komt uit gewone taal in een bericht,
     en dat raden gaat vaak goed en soms mis. Vandaar de ZIN erbij en een knop
     ervoor. Zie de kop van server/kern/postdatum.js.

     Deelt de IIFE-scope met 54: API, T, esc, lang, $, actor komen daarvandaan. */
  let postSupData = null;
  async function laadPostSup(){
    if (!API.live) return;
    try { postSupData = await API.call('/supplier/vooruit/post', {}); } catch(e){ postSupData = { fout: true }; }
  }
  function renderPostSup(){
    const el = $('#postSupCard'); if (!el) return;
    // alleen de manager; de route weigert de rest ook, dit voorkomt een lege kaart
    if (!actor().manager){ el.innerHTML = ''; return; }
    if (!postSupData){ el.innerHTML = ''; laadPostSup().then(renderPostSup); return; }
    const d = postSupData;
    if (d.fout){ el.innerHTML = ''; return; }
    if (!d.voorstellen || !d.voorstellen.length){
      /* Een lege kaart mag niet lezen als "er stond niets in de post" terwijl de
         lezer wel iets heeft laten liggen. */
      el.innerHTML = d.overgeslagen
        ? '<div class="card"><div class="tt-h">' + T('po.titel','Uit uw post') + '</div>'
          + '<div class="vo-fijn vo-mt">' + T('po.niets','Wij vonden geen datum die wij met zekerheid konden lezen.') + ' '
          + d.overgeslagen + ' ' + T('po.over','stonden er te twijfelachtig bij (bijvoorbeeld 03/04: dat is 3 april of 4 maart).') + '</div></div>'
        : '';
      return;
    }
    const dagLbl = x => { try { return new Date(x+'T12:00:00').toLocaleDateString(lang()==='en'?'en-GB':'nl-NL',{day:'numeric',month:'short'}); } catch(e){ return x; } };
    let h = '<div class="card"><div class="tt-h">' + T('po.titel','Uit uw post')
      + ' <span class="vo-let">(' + d.voorstellen.length + ')</span></div>'
      + '<div class="vo-fijn vo-mt">' + T('po.uitleg2','Dit vonden wij in de post van deze zaak. Er gaat niets vanzelf in de agenda; u bevestigt.') + '</div>';
    for (const v of d.voorstellen.slice(0,6)){
      h += '<div class="po-blok"><div class="po-van">' + esc(v.van)
        + (v.vertrouwd ? '' : ' · <span class="vo-let">' + T('po.buiten','van buiten') + '</span>') + '</div>'
        + '<div class="po-ond">' + esc(v.onderwerp) + '</div>';
      for (const dt of v.datums.slice(0,3)){
        h += '<div class="vo-rij"><span>' + esc(dt.zin) + '</span><span class="vo-dag">'
          + esc(dagLbl(dt.datum)) + (dt.tijd ? ' ' + esc(dt.tijd) : '') + '</span></div>'
          + '<div class="po-knoppen"><button class="obtn primary" data-poneem="' + esc(v.id)
          + '" data-podag="' + esc(dt.datum) + '" data-potitel="' + esc(v.onderwerp) + '">'
          + T('po.zet2','Zet in de agenda') + '</button></div>';
      }
      h += '<div class="po-knoppen"><button class="obtn" data-poweg="' + esc(v.id) + '">'
        + T('po.weg','Niet nodig') + '</button></div></div>';
    }
    if (d.overgeslagen) h += '<div class="vo-fijn vo-dak">' + d.overgeslagen + ' '
      + T('po.over2','datums waren te twijfelachtig om voor te stellen.') + '</div>';
    h += '</div>';
    el.innerHTML = h;

    // na een besluit opnieuw ophalen: de tower ernaast is er ook door veranderd
    const opnieuw = () => { postSupData = null; vooruitSupData = null; agendaSupData = null;
      renderPostSup(); renderVooruitSup(); laadAgendaSup(); };
    el.querySelectorAll('[data-poneem]').forEach(b => b.addEventListener('click', async () => {
      try { await API.call('/supplier/vooruit/post/neem',
        { id: b.dataset.poneem, datum: b.dataset.podag, titel: b.dataset.potitel }); opnieuw(); }
      catch(e){ toast(e.message); }
    }));
    el.querySelectorAll('[data-poweg]').forEach(b => b.addEventListener('click', async () => {
      try { await API.call('/supplier/vooruit/post/negeer', { id: b.dataset.poweg }); opnieuw(); }
      catch(e){ toast(e.message); }
    }));
  }
