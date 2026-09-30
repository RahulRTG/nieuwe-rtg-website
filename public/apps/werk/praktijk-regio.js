(function () {
  'use strict';
  const e = window.RTGWerk.esc, taal = document.documentElement.lang || navigator.language;
  const landen = [], namen = new Intl.DisplayNames([taal],{type:'region',fallback:'none'});
  for (let a=65;a<=90;a++) for(let b=65;b<=90;b++) {
    const code=String.fromCharCode(a,b),naam=namen.of(code);
    if(naam && !['EU','EZ','UN','XA','XB','ZZ'].includes(code) && new Intl.Locale('und-'+code).region===code) landen.push({id:code,naam});
  }
  landen.sort((a,b)=>a.naam.localeCompare(b.naam,taal));
  const munten=new Intl.DisplayNames([taal],{type:'currency',fallback:'code'});
  const select=(naam,label,rijen,waarde)=>'<label>'+e(label)+'<select aria-label="'+e(label)+'" name="'+naam+'">'+
    rijen.map(x=>'<option value="'+e(x.id)+'"'+(x.id===waarde?' selected':'')+'>'+e(x.naam)+'</option>').join('')+'</select></label>';
  window.RTGPraktijkRegio={velden:p=>select('land','Land of gebied',landen,p.land||'NL')+
    select('valuta','Valuta',Intl.supportedValuesOf('currency').map(id=>({id,naam:munten.of(id)+' ('+id+')'})),p.valuta||'EUR')+
    '<details><summary>Regio-instellingen</summary><p>De tijdzone van uw toestel is voorgeselecteerd. Kies een andere als u ergens anders werkt.</p>'+
    select('tijdzone','Tijdzone', [...new Set([Intl.DateTimeFormat().resolvedOptions().timeZone,'UTC',...Intl.supportedValuesOf('timeZone')])].map(id=>({id,naam:id.replaceAll('_',' ')})),p.tijdzone||Intl.DateTimeFormat().resolvedOptions().timeZone)+'</details>'};
})();
