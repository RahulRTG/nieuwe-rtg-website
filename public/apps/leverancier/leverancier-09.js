/* de looplijst per station, op tijd gesorteerd */
    out.sort((a, b) => a.due.localeCompare(b.due) || (a.it.time.localeCompare(b.it.time)));
    return out;
  }
  const RUN_ICON = { keuken:'\uD83D\uDD25', bar:'\uD83C\uDF78', bediening:'\uD83E\uDDFE', party:'\uD83C\uDF9F', alle:'\uD83D\uDCE2' };
  function runsheetStrip(station){
    const rows = runsheetFor(station);
    if (!rows.length) return '';
    const today = new Date().toISOString().slice(0, 10);
    return '<div class="st-sec">\uD83D\uDCCB '+T('rs.h','Draaiboek')+' & '+T('rs.mep','mise en place')+'</div>'+
      '<div class="tkc h-volbreed">'+rows.map(r =>
        '<div class="st-row'+(r.it.done?'" style="opacity:0.5;':'"')+'">'+
        '<span>'+
        '<span style="display:inline-block;min-width:5.4rem;margin-right:0.5rem;font-size:0.62rem;letter-spacing:0.06em;text-transform:uppercase;color:'+(r.due===today?'var(--burgundy)':'var(--soft)')+';">'+dueLabel(r.due, r.it.daysBefore)+'</span>'+
        '<b style="color:var(--gold);font-variant-numeric:tabular-nums;margin-right:0.6rem;">'+r.it.time+'</b>'+
        (station==='party'?'<span style="margin-right:0.4rem;">'+(RUN_ICON[r.it.station]||'')+'</span>':'')+
        (r.it.done?'<s>'+r.it.text+'</s>':r.it.text)+
        '<span class="sub">'+r.e.name+' \u00b7 '+r.e.date+(r.it.done&&r.it.doneBy?' \u00b7 \u2713 '+r.it.doneBy:'')+'</span></span>'+
        '<button class="obtn'+(r.it.done?' primary':'')+'" data-rundone="'+r.e.id+'" data-item="'+r.it.id+'">'+(r.it.done?'\u2713':T('rs.doit','Gedaan'))+'</button></div>'
      ).join('')+'</div>';
  }

  /* De voorraadbalk op de werkvloer: wat is laag, wat is op, en welke
     gerechten verdienen een 86 omdat een ingredient uit het recept op is.
     Gevoed door het keukenbrein (kern/keuken.js), zuinig ververst. */
  let wvInfo = null, wvAt = 0, wvBezig = false;
  function laadWerkvloer(){
    if (wvBezig || Date.now() - wvAt < 15000) return;
    wvBezig = true;
    API.call('/supplier/keuken/werkvloer').then(d => { wvInfo = d; wvAt = Date.now(); wvBezig = false; renderStation(); }).catch(() => { wvBezig = false; wvAt = Date.now(); });
  }
  function werkvloerBalk(){
    if (!wvInfo) return '';
    const chips = [];
    (wvInfo.adviezen||[]).forEach(a => chips.push('<button class="obtn warn" data-st86adv="'+a.menuItemId+'">\u26d4 86: '+esc(a.gerecht)+' ('+esc(a.ingredient)+' '+T('st.isop','is op')+')</button>'));
    (wvInfo.op||[]).forEach(a => chips.push('<span class="ad" style="color:#FF8589;font-weight:600;">'+esc(a.naam)+' '+T('st.op','OP')+'</span>'));
    (wvInfo.laag||[]).forEach(a => chips.push('<span class="ad">'+esc(a.naam)+' '+T('st.laag','laag')+' ('+a.aantal+' '+esc(a.eenheid)+')</span>'));
    chips.push('<button class="obtn ghost" data-stderf>\u267b '+T('st.derf','Derving melden')+'</button>');
    return '<div class="allday"><span class="ad-h">\ud83d\udce6 '+T('st.voorraad','Voorraad')+'</span>'+chips.join('')+'</div>';
  }
  function renderStation(){
    const el = $('#stBody'); if (!el || !state) return;
    $('#stBiz').textContent = S ? S.name : '';
    $('#stLabel').textContent = stationLabel(stationMode) + (stationMode === 'keuken' ? ' \u00b7 ' + T('ks.'+keukenSectie, (KSECTIES[keukenSectie]||['',''])[1]) : '');
    const live = (state.orders||[]).filter(o => !['geserveerd','geweigerd','terugbetaald'].includes(o.status));
    let html = '';
    if (stationMode === 'keuken' || stationMode === 'bar'){ laadWerkvloer(); html += werkvloerBalk(); }
