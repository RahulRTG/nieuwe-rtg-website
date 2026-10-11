/* RTMAIL: DE INSTELLINGEN VAN JE POSTVAK -- handtekening, afwezigheid, aliassen
   en de regels die bij de bezorging draaien.

   De server had dit allemaal al (server/routes/rtmail-schrijf.js); er was alleen
   geen knop. Een functie zonder knop is voor een mens geen functie, dus hangt
   het hier aan het postvak zelf. Dit scherm bezit niets: elke handeling gaat
   langs dezelfde route als de toetsen, en wat de server weigert staat met zijn
   eigen zin op het scherm. Apart bestand omdat rtmail.html tegen de maat van
   check.js regel 13 aan loopt. */
(function(w,d){
  'use strict';
  /* RTGMail ontstaat pas onderaan rtmail.html; dit bestand laadt ervoor, zodat
     de knop er staat bij de eerste keer dat het postvak getekend wordt. */
  var mail=null;
  var esc=function(t){return String(t==null?'':t).replace(/[&<>"']/g,function(c){return {'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c];});};
  var main=function(){return d.getElementById('main');};
  var VELDNAAM={van:'de afzender',onderwerp:'het onderwerp',tekst:'de tekst',soort:'de soort'};
  var ACTIENAAM={opbergen:'opbergen in het archief',weggooien:'in de prullenbak',etiket:'een etiket erop',ster:'een ster erop',lezen:'als gelezen markeren'};
  /* datetime-local kent geen tijdzone; de server krijgt een ISO-tijd terug. */
  var naarLokaal=function(iso){ if(!iso) return ''; var t=new Date(iso); if(isNaN(t)) return ''; t=new Date(t.getTime()-t.getTimezoneOffset()*60000); return t.toISOString().slice(0,16); };
  var vanLokaal=function(v){ if(!v) return null; var t=new Date(v); return isNaN(t)?v:t.toISOString(); };
  var lang=function(iso){ try{ return new Date(iso).toLocaleString(d.documentElement.lang||undefined,{day:'2-digit',month:'2-digit',year:'numeric',hour:'2-digit',minute:'2-digit'}); }catch(e){ return ''; } };

  function zeg(id,tekst,fout){ var el=d.getElementById(id); if(!el) return; el.textContent=tekst; el.className=fout?'fout':'noot'; el.style.textAlign='left'; el.hidden=!tekst; }

  async function open(melding){
    mail=w.RTGMail; if(!mail) return;
    var inst, regels, adres;
    try{
      var r=await Promise.all([mail.api('instellingen'), mail.api('regels'), mail.api('adres')]);
      inst=r[0].instellingen||{}; regels=r[1]; adres=r[2]||{};
    }catch(e){ main().innerHTML='<button class="terug" id="terug">&larr; alle berichten</button><div class="fout">'+esc(e.message)+'</div>'; d.getElementById('terug').addEventListener('click',mail.laad); return; }
    var eigen=String(adres.adres||''), domein=eigen.split('@')[1]||'';
    var af=inst.afwezig;
    var afStand=af ? 'Staat aan'+(af.van?' vanaf '+lang(af.van):'')+(af.tot?' tot '+lang(af.tot):' tot u hem uitzet')+'.' : 'Staat uit.';
    main().innerHTML=
      '<button class="terug" id="terug">&larr; alle berichten</button>'+
      '<div class="kaart" id="rtmInstellingen"><h2>Instellingen van je postvak</h2>'+
      '<div class="meta">'+esc(eigen)+'</div>'+
      (melding?'<div class="noot" style="text-align:left;margin:0 0 .6rem;" role="status">'+esc(melding)+'</div>':'')+

      '<div class="kop">Handtekening</div>'+
      '<textarea class="vld" id="iHand" rows="3" maxlength="500" placeholder="Bijvoorbeeld je naam en hoe je bereikbaar bent">'+esc(inst.handtekening||'')+'</textarea>'+
      '<div class="noot" style="text-align:left;margin:0;">Gaat onder elk bericht dat je vanuit RTMail verstuurt.</div>'+
      '<div class="knprij"><button class="knp prim" id="iHandBewaar">Handtekening bewaren</button></div><div id="iHandUit" hidden></div>'+

      '<div class="kop">Afwezigheid</div>'+
      '<div class="noot" style="text-align:left;margin:0 0 .5rem;" id="iAfStand">'+esc(afStand)+'</div>'+
      '<textarea class="vld" id="iAfTekst" rows="3" maxlength="1000" placeholder="Wat krijgt iemand terug die je schrijft?">'+esc(af&&af.tekst||'')+'</textarea>'+
      '<label class="noot" style="display:block;text-align:left;margin:0;">Vanaf (leeg is nu)<input class="vld" type="datetime-local" id="iAfVan" value="'+esc(naarLokaal(af&&af.van))+'"></label>'+
      '<label class="noot" style="display:block;text-align:left;margin:0;">Tot (leeg is tot je hem uitzet)<input class="vld" type="datetime-local" id="iAfTot" value="'+esc(naarLokaal(af&&af.tot))+'"></label>'+
      '<div class="noot" style="text-align:left;margin:0;">Iedere afzender krijgt dit antwoord een keer per periode. Berichten van RTG zelf en andere afwezigheidsberichten krijgen geen antwoord, zodat twee postvakken elkaar niet eindeloos terugschrijven.</div>'+
      '<div class="knprij"><button class="knp prim" id="iAfAan">'+(af?'Afwezigheid bijwerken':'Afwezigheid aanzetten')+'</button>'+
        (af?'<button class="knp" id="iAfUit">Afwezigheid uitzetten</button>':'')+'</div><div id="iAfUitslag" hidden></div>'+

      '<div class="kop">Aliassen</div>'+
      '<div class="noot" style="text-align:left;margin:0 0 .5rem;">Een alias is een tweede adres voor dit postvak. Post die er binnen RTG naartoe gaat, komt hier binnen met de alias erbij. Het adres van iemand anders, een zaak of een team kan geen alias worden.</div>'+
      ((inst.aliassen||[]).length ? (inst.aliassen||[]).map(function(a){
        return '<div class="rij" style="cursor:default;"><span class="b"><span class="nm">'+esc(a+(domein?'@'+domein:''))+'</span></span>'+
          '<button class="knp" data-alias-uit="'+esc(a)+'">Alias uitzetten</button></div>'; }).join('')
        : '<div class="noot" style="text-align:left;margin:0 0 .5rem;">Nog geen alias.</div>')+
      '<input class="vld" id="iAlias" maxlength="40" placeholder="Bijvoorbeeld inkoop">'+
      '<div class="knprij"><button class="knp prim" id="iAliasMaak">Alias toevoegen</button></div><div id="iAliasUit" hidden></div>'+

      '<div class="kop">Regels bij binnenkomst</div>'+
      '<div class="noot" style="text-align:left;margin:0 0 .5rem;">Een regel draait op het moment dat post binnenkomt, ook als je de app niet open hebt. De teller zegt hoe vaak hij iets deed.</div>'+
      ((regels.regels||[]).length ? regels.regels.map(function(r){
        var wat=(r.alleenOnvertrouwd?'niet-geverifieerde post':'')+(r.bevat?(r.alleenOnvertrouwd?' waarin ':'')+esc(VELDNAAM[r.veld]||r.veld)+' "'+esc(r.bevat)+'" bevat':'');
        return '<div class="rij" style="cursor:default;"><span class="b"><span class="nm">'+esc(r.naam)+(r.aan?'':' (uit)')+'</span>'+
          '<span class="lt">Als '+wat+': '+esc(ACTIENAAM[r.actie]||r.actie)+(r.actie==='etiket'?' "'+esc(r.waarde)+'"':'')+' · '+r.geraakt+' keer geraakt</span></span>'+
          '<button class="knp" data-regel-zet="'+esc(r.id)+'" data-aan="'+(r.aan?'1':'0')+'" aria-pressed="'+(r.aan?'true':'false')+'">'+(r.aan?'Regel uitzetten':'Regel aanzetten')+'</button>'+
          '<button class="knp" data-regel-weg="'+esc(r.id)+'">Regel verwijderen</button></div>'; }).join('')
        : '<div class="noot" style="text-align:left;margin:0 0 .5rem;">Nog geen regel.</div>')+
      '<input class="vld" id="iRNaam" maxlength="60" placeholder="Naam van de regel (mag leeg)">'+
      '<select class="vld" id="iRVeld" aria-label="Waarop let de regel?">'+(regels.velden||[]).map(function(v){return '<option value="'+esc(v)+'">Let op '+esc(VELDNAAM[v]||v)+'</option>';}).join('')+'</select>'+
      '<input class="vld" id="iRBevat" maxlength="120" placeholder="...als dat dit bevat">'+
      '<label class="noot" style="display:block;text-align:left;margin:0 0 .5rem;"><input type="checkbox" id="iROnv"> Alleen voor niet-geverifieerde post</label>'+
      '<select class="vld" id="iRActie" aria-label="Wat doet de regel?">'+(regels.acties||[]).map(function(a){return '<option value="'+esc(a)+'">Dan: '+esc(ACTIENAAM[a]||a)+'</option>';}).join('')+'</select>'+
      '<input class="vld" id="iRWaarde" maxlength="40" placeholder="Welk etiket? (alleen bij een etiket)">'+
      '<div class="knprij"><button class="knp prim" id="iRMaak">Regel maken</button></div><div id="iRUit" hidden></div>'+
      '</div>';

    d.getElementById('terug').addEventListener('click',mail.laad);
    var doe=async function(uit,pad,body,klaar){
      try{ await mail.api(pad,body); open(klaar); }
      catch(e){ zeg(uit,e.message,true); }
    };
    d.getElementById('iHandBewaar').addEventListener('click',function(){ doe('iHandUit','handtekening',{tekst:d.getElementById('iHand').value},'Je handtekening is bewaard.'); });
    d.getElementById('iAfAan').addEventListener('click',function(){
      doe('iAfUitslag','afwezig',{aan:true,tekst:d.getElementById('iAfTekst').value,van:vanLokaal(d.getElementById('iAfVan').value),tot:vanLokaal(d.getElementById('iAfTot').value)},'Je afwezigheidsbericht staat aan.'); });
    var afUit=d.getElementById('iAfUit');
    if(afUit) afUit.addEventListener('click',function(){ doe('iAfUitslag','afwezig',{aan:false},'Je afwezigheidsbericht staat uit.'); });
    d.getElementById('iAliasMaak').addEventListener('click',function(){ doe('iAliasUit','alias',{naam:d.getElementById('iAlias').value},'De alias staat aan.'); });
    main().querySelectorAll('[data-alias-uit]').forEach(function(b){ b.addEventListener('click',function(){ doe('iAliasUit','alias',{naam:b.dataset.aliasUit,aan:false},'De alias staat uit; er komt niets meer via binnen.'); }); });
    d.getElementById('iRMaak').addEventListener('click',function(){
      doe('iRUit','regel/maak',{naam:d.getElementById('iRNaam').value,veld:d.getElementById('iRVeld').value,bevat:d.getElementById('iRBevat').value,
        alleenOnvertrouwd:d.getElementById('iROnv').checked,actie:d.getElementById('iRActie').value,waarde:d.getElementById('iRWaarde').value},'De regel staat aan.'); });
    main().querySelectorAll('[data-regel-zet]').forEach(function(b){ b.addEventListener('click',function(){ doe('iRUit','regel/zet',{id:b.dataset.regelZet,aan:b.dataset.aan!=='1'},b.dataset.aan==='1'?'De regel staat uit.':'De regel staat aan.'); }); });
    main().querySelectorAll('[data-regel-weg]').forEach(function(b){ b.addEventListener('click',function(){ doe('iRUit','regel/weg',{id:b.dataset.regelWeg},'De regel is verwijderd.'); }); });
  }
  w.RTGMailInstellingen={ open: function(){ return open(); } };
})(window,document);
