  /* De post-voorstellen: datums die zichzelf aandienen.

     Afgesplitst van 53b, en de snede loopt langs een echte grens: 53b toont wat
     er AL vaststaat, dit toont wat er nog niet vaststaat en wat u kunt
     bevestigen.

     WAAROM HIER EEN KNOP ZIT EN GEEN AUTOMAAT. Wat hieronder staat komt uit
     gewone taal in een bericht -- "uw afspraak staat op 14 september om 19:30".
     Dat raden gaat vaak goed en soms mis, en een datum die er ongezien in glijdt
     staat op een dag op de verkeerde dag. Vandaar: de ZIN erbij, uw oordeel
     erover, en pas dan de agenda in. Zie de kop van server/kern/postdatum.js.

     Deelt de IIFE-scope met 53/53b: API, T, esc, lang komen daarvandaan. */
  let postData = null;
  async function laadPostDatums(){
    if (!API.live || !API.token) return;
    try { postData = await API.call('/member/vooruit/post', {}); } catch(e){ postData = { fout: true }; }
  }
  function renderPostDatums(){
    const el = document.getElementById('boPostCard'); if (!el) return;
    if (!postData){ el.innerHTML = ''; laadPostDatums().then(renderPostDatums); return; }
    const d = postData;
    if (d.fout || !d.voorstellen || !d.voorstellen.length){
      /* Niets voor te stellen is GEEN reden om te zwijgen als de lezer wel iets
         heeft laten liggen: dan hoort er te staan dat er iets is overgeslagen,
         anders leest een lege kaart als "er stond niets in uw post". */
      el.innerHTML = (!d.fout && d.overgeslagen)
        ? '<div class="zak-kaart"><b class="vo-kop">' + T('po.titel','Uit uw post') + '</b>'
          + '<div class="fineprint vo-mt">' + T('po.niets','Wij vonden geen datum die wij met zekerheid konden lezen.') + ' '
          + d.overgeslagen + ' ' + T('po.over','stonden er te twijfelachtig bij (bijvoorbeeld 03/04: dat is 3 april of 4 maart).') + '</div></div>'
        : '';
      return;
    }
    const dagLbl = x => { try { return new Date(x+'T12:00:00').toLocaleDateString(lang()==='en'?'en-GB':'nl-NL',{day:'numeric',month:'short'}); } catch(e){ return x; } };
    let h = '<div class="zak-kaart"><b class="vo-kop">' + T('po.titel','Uit uw post')
      + ' <span class="vo-let">(' + d.voorstellen.length + ')</span></b>'
      + '<div class="fineprint vo-mt">' + T('po.uitleg','Dit vonden wij in uw eigen post. Er gaat niets vanzelf in uw agenda; u bevestigt.') + '</div>';
    for (const v of d.voorstellen.slice(0,6)){
      h += '<div class="po-blok">'
        + '<div class="po-van">' + esc(v.van) + (v.vertrouwd ? '' : ' · <span class="vo-let">' + T('po.buiten','van buiten') + '</span>') + '</div>'
        + '<div class="po-ond">' + esc(v.onderwerp) + '</div>';
      for (const dt of v.datums.slice(0,3)){
        h += '<div class="vo-rij"><span>' + esc(dt.zin) + '</span>'
          + '<span class="vo-dag">' + esc(dagLbl(dt.datum)) + (dt.tijd ? ' ' + esc(dt.tijd) : '') + '</span></div>'
          + '<div class="po-knoppen"><button class="po-ja" data-poneem="' + esc(v.id) + '" data-podag="' + esc(dt.datum) + '" data-potitel="' + esc(v.onderwerp) + '">'
          + T('po.zet','Zet in mijn agenda') + '</button></div>';
      }
      h += '<div class="po-knoppen"><button class="po-nee" data-poweg="' + esc(v.id) + '">' + T('po.weg','Niet nodig') + '</button></div>'
        + '</div>';
    }
    if (d.overgeslagen) h += '<div class="fineprint vo-dak">' + d.overgeslagen + ' '
      + T('po.over2','datums waren te twijfelachtig om voor te stellen.') + '</div>';
    h += '</div>';
    el.innerHTML = h;

    const opnieuw = async () => { postData = null; vooruitData = null; renderPostDatums(); renderVooruit(); };
    el.querySelectorAll('[data-poneem]').forEach(b => b.addEventListener('click', async () => {
      try {
        await API.call('/member/vooruit/post/neem', { id: b.dataset.poneem, datum: b.dataset.podag, titel: b.dataset.potitel });
        opnieuw();
      } catch(e){ if (typeof toast === 'function') toast(e.message); }
    }));
    el.querySelectorAll('[data-poweg]').forEach(b => b.addEventListener('click', async () => {
      try { await API.call('/member/vooruit/post/negeer', { id: b.dataset.poweg }); opnieuw(); }
      catch(e){ if (typeof toast === 'function') toast(e.message); }
    }));
  }
