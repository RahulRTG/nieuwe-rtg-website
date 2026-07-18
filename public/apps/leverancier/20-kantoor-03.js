    if (kantoorSec === 'fin'){
      // de boekhouding van de zaak: btw per genre, personeelskosten uit de
      // klokuren en een boekhoudkundig correcte cadeaukaartenadministratie
      if (!finData){
        laadFinance();
        html += '<div class="tkc" style="grid-column:1/-1;"><h3>📚 '+T('kt.fin','Boekhouding')+'</h3><div class="tkc-who">'+T('kt.laden','Laden...')+'</div></div>';
      } else if (finData.error){
        html += '<div class="tkc" style="grid-column:1/-1;"><h3>📚 '+T('kt.fin','Boekhouding')+'</h3><div class="tkc-who">'+finData.error+'</div></div>';
      } else {
        const f = finData;
        if (finMsg){ html += '<div class="tkc" style="grid-column:1/-1;border-color:var(--gold);">'+finMsg+'</div>'; }
        // De onderste streep bovenaan: wat blijft er deze maand over? Omzet min de
        // af te dragen btw en de loonkosten. RTG houdt niets in (0% commissie).
        const omzetMaand = (f.btw || []).reduce((s2, r) => s2 + (r.omzet || 0), 0);
        const loonTot = (f.personeel && f.personeel.totaal) || 0;
        const nettoOver = Math.round((omzetMaand - (f.btwTotaal || 0) - loonTot) * 100) / 100;
        html += '<div class="tkc" style="grid-column:1/-1;border-color:var(--gold);"><h3>💶 '+T('fn.netto','Wat u overhoudt')+' ('+f.maand+')</h3>'+
          '<div class="st-row"><span>'+T('fn.omzetmaand','Omzet deze maand')+'<span class="sub">'+T('fn.nulcom','RTG rekent 0% commissie')+'</span></span><b>'+eur(omzetMaand)+'</b></div>'+
          '<div class="st-row"><span>'+T('fn.minbtw','Af te dragen btw')+'</span><b style="color:var(--burgundy);">- '+eur(f.btwTotaal || 0)+'</b></div>'+
          '<div class="st-row"><span>'+T('fn.minloon','Loonkosten')+'</span><b style="color:var(--burgundy);">- '+eur(loonTot)+'</b></div>'+
          '<div class="st-row" style="border-top:1px solid var(--line);"><span><b>'+T('fn.overhoudt','Blijft over (indicatie)')+'</b></span><b style="color:var(--gold);font-size:1.05rem;">'+eur(nettoOver)+'</b></div>'+
          '<div class="tkc-who">'+T('fn.netto.s','Indicatie vóór inkoop, huur en overige kosten. Uw omzet is volledig van u; RTG houdt niets in.')+'</div>'+
          '<div style="display:flex;gap:0.5rem;flex-wrap:wrap;margin-top:0.6rem;">'+
          '<button class="obtn" id="fnPdf">⤓ '+T('fn.exportpdf','Overzicht (PDF)')+'</button>'+
          '<button class="obtn" id="fnCsv">⤓ '+T('fn.exportcsv','Boekhouding (CSV)')+'</button></div></div>';
        html += '<div class="tkc" style="grid-column:1/-1;"><h3>🌍 '+T('fn.land','Land & uurloon')+'</h3>'+
          '<div class="tkc-who">'+T('fn.land.s','Het land bepaalt de btw-tarieven, werkgeverslasten en aangifteregels; het uurloon voedt de personeelskosten.')+'</div>'+
          '<div style="display:flex;gap:0.5rem;flex-wrap:wrap;align-items:center;">'+
          '<select class="st-in" id="fnLand" style="flex:2;min-width:130px;">'+f.landen.map(l=>'<option value="'+l.code+'"'+(l.code===f.land?' selected':'')+'>'+l.naam+'</option>').join('')+'</select>'+
          '<input class="st-in" id="fnUur" type="number" step="0.5" value="'+f.personeel.uurloon+'" style="flex:1;min-width:80px;" placeholder="€/uur">'+
          '<button class="obtn primary" id="fnSave">'+T('fn.save','Opslaan')+'</button></div></div>';
        html += '<div class="tkc"><h3>🧾 '+T('fn.btw','Btw deze maand')+' ('+f.maand+')</h3>'+
          (f.btw.length ? f.btw.map(r =>
            '<div class="st-row"><span>'+r.label+'<span class="sub">'+T('fn.omzet','omzet')+' '+eur(r.omzet)+' · '+T('fn.grondslag','grondslag')+' '+eur(r.grondslag)+' · '+r.tarief+'%</span></span>'+
            '<b style="color:var(--gold);">'+eur(r.btw)+'</b></div>').join('')
            : '<div class="tkc-who">'+T('fn.geenomzet','Nog geen omzet deze maand.')+'</div>')+
          '<div class="st-row" style="border-top:1px solid var(--line);"><span><b>'+T('fn.afdragen','Af te dragen btw')+'</b></span><b style="color:var(--gold);">'+eur(f.btwTotaal)+'</b></div></div>';
        html += '<div class="tkc"><h3>👥 '+T('fn.personeel','Personeelskosten')+' ('+f.maand+')</h3>'+
          '<div class="st-row"><span>'+T('fn.uren','Geklokte uren')+' × € '+f.personeel.uurloon+'<span class="sub">'+f.personeel.uren+' '+T('fn.uur','uur')+'</span></span><b>'+eur(f.personeel.bruto)+'</b></div>'+
          '<div class="st-row"><span>'+T('fn.lasten','Werkgeverslasten')+'<span class="sub">~'+f.personeel.lastenPct+'% ('+f.landNaam+')</span></span><b>'+eur(f.personeel.lasten)+'</b></div>'+
          (f.personeel.vakantiegeld ? '<div class="st-row"><span>'+T('fn.vak','Vakantiegeldreserve')+'<span class="sub">'+f.personeel.vakantiegeldPct+'%</span></span><b>'+eur(f.personeel.vakantiegeld)+'</b></div>' : '')+
          '<div class="st-row" style="border-top:1px solid var(--line);"><span><b>'+T('fn.totaal','Totale loonkosten')+'</b></span><b style="color:var(--gold);">'+eur(f.personeel.totaal)+'</b></div>'+
          '<div class="tkc-who">'+T('fn.minuur','Indicatie minimumuurloon')+': € '+f.personeel.uurloonMin+'</div></div>';
        html += '<div class="tkc" style="grid-column:1/-1;"><h3>🎁 '+T('fn.gc','Cadeaukaarten')+'</h3>'+
          '<div class="st-row"><span>'+T('fn.gcverkocht','Verkocht deze maand')+'<span class="sub">'+T('fn.gcv.s','nog geen omzet, geen btw')+'</span></span><b>'+eur(f.giftcards.verkocht)+'</b></div>'+
          '<div class="st-row"><span>'+T('fn.gcin','Ingewisseld deze maand')+'<span class="sub">'+T('fn.gci.s','omzet + btw-moment')+'</span></span><b>'+eur(f.giftcards.ingewisseld)+'</b></div>'+
          '<div class="st-row"><span>'+T('fn.gcopen','Openstaand saldo')+'<span class="sub">'+T('fn.gco.s','verplichting op de balans')+' · '+f.giftcards.aantal+' '+T('fn.kaarten','kaart(en)')+'</span></span><b style="color:var(--gold);">'+eur(f.giftcards.open)+'</b></div>'+
          '<div style="display:flex;gap:0.5rem;flex-wrap:wrap;margin-top:0.4rem;">'+
          '<input class="st-in" id="gcBedrag" type="number" placeholder="€ 50" style="flex:1;min-width:80px;">'+
          '<button class="obtn primary" id="gcSell">🎁 '+T('fn.gcsell','Verkoop kaart')+'</button></div>'+
          '<div style="display:flex;gap:0.5rem;flex-wrap:wrap;margin-top:0.3rem;">'+
          '<input class="st-in" id="gcCode" placeholder="RTG-GC-XXXXXX" style="flex:2;min-width:130px;">'+
          '<input class="st-in" id="gcInBedrag" type="number" placeholder="€" style="flex:1;min-width:70px;">'+
          '<button class="obtn" id="gcRedeem">'+T('fn.gcredeem','In te wisselen')+'</button></div></div>';
        html += '<div class="tkc"><h3>📜 '+T('fn.regels','Regels in ')+f.landNaam+'</h3>'+
          f.regels.map(r => '<div class="tkc-who" style="line-height:1.5;">• '+r+'</div>').join('')+'</div>';
        html += '<div class="tkc" style="grid-column:1/-1;"><h3>🤖 '+T('fn.ai','AI-boekhouder')+'</h3>'+
          '<div class="tkc-who">'+T('fn.ai.s2','Kent uw branche, uw cijfers en de regels. Stel een vraag, of laat hem u proactief bijsturen met adviezen op uw eigen cijfers.')+'</div>'+
          '<div id="accVragen" style="display:flex;gap:0.4rem;flex-wrap:wrap;margin:0.5rem 0;"></div>'+
          '<div class="row-gap"><input class="st-in" id="accQ" placeholder="'+T('fn.ai.ph','Bijv. hoeveel btw draag ik deze maand af?')+'" style="flex:1;">'+
          '<button class="obtn primary" id="accGo">'+T('fn.vraag','Vraag')+'</button></div>'+
          '<div id="accA" style="display:'+(accAntwoord?'block':'none')+';border:1px solid var(--gold);border-radius:12px;padding:0.7rem 0.9rem;font-size:0.82rem;line-height:1.6;margin-top:0.5rem;">'+accAntwoord+'</div>'+
          '<button class="obtn" id="accAdvies" style="margin-top:0.6rem;">✨ '+T('fn.adviezen','Stuur mij bij, geef adviezen')+'</button>'+
          '<div id="accAdv"></div></div>';
      }
    }
