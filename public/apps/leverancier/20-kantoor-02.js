    if (kantoorSec === 'bo'){
      // de eigen backoffice van de zaak, met dezelfde patronen als het
      // RTG-controlecentrum maar dan uitsluitend over dit bedrijf
      if (!boData){
        laadBackoffice();
        html += '<div class="tkc" style="grid-column:1/-1;"><h3>'+T('kt.bo','Backoffice')+'</h3><div class="tkc-who">'+T('kt.laden','Laden...')+'</div></div>';
      } else if (boData.error){
        html += '<div class="tkc" style="grid-column:1/-1;"><h3>'+T('kt.bo','Backoffice')+'</h3><div class="tkc-who">'+boData.error+'</div></div>';
      } else {
        const b = boData;
        html += '<div class="tkc" style="grid-column:1/-1;">'+
          '<div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(125px,1fr));gap:0.55rem;">'+
          [[T('bz.today','Omzet vandaag'), eur(b.stats.omzetVandaag)],
           [T('bz.trans','Transacties'), b.stats.transactiesVandaag],
           [T('bz.kassa','Waarvan kassa'), eur(b.stats.kassaVandaag)],
           [T('bz.week','Weekomzet'), eur(b.stats.omzetWeek)],
           [T('bz.binnen','Nu ingeklokt'), b.stats.binnenNu],
           [T('bz.acties','Open acties'), b.stats.openActies]]
          .map(x => '<div style="background:rgba(255,255,255,0.04);border:1px solid var(--line);border-radius:12px;padding:0.7rem 0.8rem;">'+
            '<div style="font-size:0.54rem;letter-spacing:0.12em;text-transform:uppercase;color:var(--soft);">'+x[0]+'</div>'+
            '<div style="font-family:\'Bodoni Moda\',serif;font-size:1.2rem;color:var(--gold);margin-top:0.15rem;">'+x[1]+'</div></div>').join('')+'</div>'+
          '<div class="tkc-who" style="margin-top:0.5rem;">'+T('bz.nulcom','RTG rekent 0% commissie: deze omzet is volledig van u.')+'</div>'+
          '<button class="obtn" id="boBrief" style="align-self:flex-start;">'+T('bz.brief','Dagbriefing')+'</button>'+
          '<div id="boBriefTxt" style="display:none;border:1px solid var(--gold);border-radius:12px;padding:0.7rem 0.9rem;font-size:0.82rem;line-height:1.6;"></div></div>';
        html += '<div class="tkc" style="grid-column:1/-1;"><h3>'+T('bz.actie','Actiecentrum van de zaak')+'</h3>'+
          (b.alerts.length ? b.alerts.map(a =>
            '<div class="st-row"><span>'+(a.level==='rood'?'':a.level==='amber'?'':'')+' '+a.text+'</span></div>').join('')
            : '<div class="tkc-who">✓ '+T('bz.niks','Alles loopt. Vastgelopen bestellingen, wachtende gasten en open personeelszaken verschijnen hier vanzelf.')+'</div>')+'</div>';
        // de voorspeller: eerlijk vooruitkijken op basis van het eigen ritme
        if (vwData && vwData.ok){
          const m = vwData.morgen;
          html += '<div class="tkc" style="grid-column:1/-1;"><h3>'+T('vw.h','Verwachting voor morgen')+'</h3>'+
            (m
              ? '<div class="tkc-who">'+T('vw.d','Op basis van uw eigen ritme van de afgelopen weken')+' ('+vwData.weken+' '+T('vw.weken','weken geschiedenis')+'): '+
                  '<b>'+m.verwachtTransacties+'</b> '+T('vw.trans','transacties')+' · <b>'+eur(m.verwachtCenten)+'</b> '+T('vw.omzet','omzet')+' ('+m.dagNaam+').'+
                  (m.drukUren.length ? ' '+T('vw.druk','Drukste uren')+': '+m.drukUren.map(u => u.uur+':00').join(', ')+'.' : '')+
                  ((vwData.vasteGasten||[]).length ? ' '+T('vw.gast','Vaste gasten')+': '+vwData.vasteGasten.map(g => g.codenaam).join(', ')+'.' : '')+
                  (m.advies ? '<br>'+m.advies : '')+
                  (m.bevoorrading ? '<br>'+m.bevoorrading : '')+'</div>'
              : '<div class="tkc-who">'+(vwData.uitleg||'')+'</div>')+'</div>';
        }
        // synergie: samen met andere zaken deals en hele pakketten maken
        const mijnCode = (S && S.code) || '';
        const synDeals = (synData && synData.deals) || [];
        const kansen = (vwData && vwData.dealkansen) || [];
        html += '<div class="tkc" style="grid-column:1/-1;"><h3>'+T('sy.h','Synergie: samen deals maken')+'</h3>'+
          '<div class="tkc-who">'+T('sy.d','Stel met een andere RTG-zaak een pakket samen met een prijs; elke deelnemer tekent voor zijn aandeel en pas dan staat het live voor leden. RTG Pay splitst elke aankoop exact volgens de afspraak.')+'</div>'+
          kansen.map((k,i) =>
            '<div class="st-row"><span>'+esc(k.tekst)+
              '<span class="sub">'+T('sy.kans','Voorstel van de dealvinder')+': <b>'+esc(k.voorstel.naam)+'</b> · '+eur(k.voorstel.prijsCenten)+
              ' ('+k.voorstel.aandelen.map(a => eur(a.centen)).join(' / ')+', 10% '+T('sy.voordeel','pakketvoordeel')+')</span></span>'+
            '<button class="obtn" data-synkans="'+i+'">'+T('sy.stel','Stel voor')+'</button></div>').join('')+
          synDeals.slice(0,6).map(d => {
            const mij = d.aandelen.find(a => a.code === mijnCode) || {};
            return '<div class="st-row"><span><b>'+esc(d.naam)+'</b> · '+eur(d.prijsCenten)+
              '<span class="sub">'+d.aandelen.map(a => esc(a.naam)+' '+eur(a.centen)+(a.akkoord?' ✓':' …')).join(' + ')+
              ' · status: '+esc(d.status)+'</span></span>'+
              (d.status === 'voorstel' && !mij.akkoord
                ? '<span><button class="obtn" data-synja="'+d.id+'">✓ '+T('sy.teken','Teken')+'</button> '+
                  '<button class="obtn ghost" data-synnee="'+d.id+'">✕</button></span>'
                : (d.status !== 'gestopt' ? '<button class="obtn ghost" data-synstop="'+d.id+'">'+T('sy.stop','Stop')+'</button>' : ''))+
              '</div>';
          }).join('')+
          '<div style="display:flex;gap:0.45rem;flex-wrap:wrap;margin-top:0.6rem;align-items:center;">'+
            '<input id="synNaam" placeholder="'+T('sy.naam','Naam van de deal')+'" style="flex:2;min-width:9rem;">'+
            '<input id="synPartner" placeholder="'+T('sy.partner','Partnercode (bijv. SAKURA)')+'" style="flex:1;min-width:7rem;">'+
            '<input id="synPrijs" inputmode="decimal" placeholder="'+T('sy.prijs','Totaal EUR')+'" style="width:6.5rem;">'+
            '<input id="synMijn" inputmode="decimal" placeholder="'+T('sy.mijn','Mijn deel EUR')+'" style="width:6.5rem;">'+
            '<button class="obtn" id="synMaak">'+T('sy.maak','Stel voor')+'</button></div></div>';
