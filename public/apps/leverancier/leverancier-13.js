    if (type === 'taxi' || type === 'jet') secs.push(
      ['ritten','\uD83D\uDDFA',T('kt.ritten','Ritten')],
      ['historie','\uD83D\uDCD2',T('kt.historie','Historie')],
      ['vloot', type==='jet' ? '\u2708\uFE0F' : '\uD83D\uDE98', T('kt.vloot','Vloot')],
      ['tarief','\uD83E\uDDEE',T('kt.tarief','Tarief')],
      ['prijzen','\uD83D\uDCB6',T('kt.prijzen','Prijzen')]
    );
    // de dienstverlenende genres (zelfstandige, privechef, wellness en de
    // vakmannen-golf) krijgen hun eigen vandaag-bord en aanbodbeheer
    if (['zzp','chef','wellness','bouw','autogarage','schoonmaak','hovenier','wasserij',
      'rijschool','dierenarts','tandarts','fotograaf','verhuizer','ithulp'].includes(type)) secs.push(
      ['vandaag','\u2600\uFE0F',T('kt.vandaag','Vandaag')],
      ['diensten','\uD83D\uDDC2\uFE0F',T('kt.diensten','Aanbod')]
    );
    secs.push(['marketing','\uD83D\uDCE3','Marketing']);
    if (!secs.some(s2 => s2[0] === kantoorSec)) kantoorSec = 'bo';
    let html = '<div class="st-chips">'+secs.map(s2 =>
      '<button data-ksec="'+s2[0]+'"'+(kantoorSec===s2[0]?' class="on"':'')+'>'+s2[1]+' '+s2[2]+'</button>').join('')+'</div>';
    if (kantoorMsg){ html += '<div class="tkc" style="grid-column:1/-1;border-color:var(--gold);">'+kantoorMsg+'</div>'; }

