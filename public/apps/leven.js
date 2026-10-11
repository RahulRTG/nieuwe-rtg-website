(function(){
  'use strict';
  var $=s=>document.querySelector(s),panes=[],actief=-1;
  /* [titel, adres, sjabloon, vuller]. Een paneel met een vuller leest zijn
     inhoud van de server; er staat hier geen enkel verzonnen adres, tijdstip of
     beschikbaarheid meer (die stonden in het oude sjabloon "Ontdekken"). */
  var apps={lijn:['Mijn lijn',null,'#lvLijn',el=>vulLijn(el)],ontdek:['Ontdekken',null,'#lvOntdek',el=>vulOntdek(el)],moment:['Uw avond','/apps/avond.html'],bestellen:['Bestellen','/apps/bestellen.html'],uitgaan:['Uitgaan','/apps/uitgaan.html'],verblijf:['Verblijf','/apps/hotels.html'],plannen:['Mijn plannen','/apps/avond.html#mijn'],avond:['Avond plannen','/apps/avond.html'],food:['Restaurants','/apps/foodcourt.html'],kantoor:['Privékantoor','/apps/lifestyle.html']};
  function token(){try{return localStorage.getItem('rtg_member_token')}catch(e){return null}}
  async function api(p,b){var r=await fetch(p,{method:'POST',headers:{'Content-Type':'application/json',Authorization:'Bearer '+(token()||'')},body:JSON.stringify(b||{})}),d=await r.json().catch(()=>({}));if(!r.ok)throw new Error(d.error||'Dit lukte niet.');return d}
  function esc(s){return String(s==null?'':s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]))}
  function datum(d){var m=/^(\d{4})-(\d{2})-(\d{2})/.exec(String(d||''));if(!m)return '';try{return new Date(+m[1],+m[2]-1,+m[3]).toLocaleDateString(document.documentElement.lang||undefined,{weekday:'short',day:'numeric',month:'long'})}catch(e){return m[0]}}
  function vandaag(){var n=new Date();return n.getFullYear()+'-'+String(n.getMonth()+1).padStart(2,'0')+'-'+String(n.getDate()).padStart(2,'0')}
  function open(id,naast){var a=apps[id]||apps.moment,n=panes.findIndex(p=>p.id===id);if(n>=0)return kies(n);if(!naast||innerWidth<761){panes.forEach(p=>p.el.remove());panes=[]}if(panes.length>=2)panes.shift().el.remove();var el=document.createElement('section');el.className='rv-pane';if(a[1]){el.classList.add('lv-pane-iframe');var f=document.createElement('iframe');f.src=a[1];f.title=a[0];RTGMedia.kader(f);el.appendChild(f)}else el.appendChild($(a[2]).content.cloneNode(true));$('#lvPanes').appendChild(el);panes.push({id,titel:a[0],el});haak(el);if(a[3])a[3](el);kies(panes.length-1)}
  function haak(el){el.querySelectorAll('[data-app]').forEach(b=>b.onclick=()=>open(b.dataset.app,innerWidth>760));}

  var P=window.RTGLevenPanelen({api,esc,datum,haak:el=>haak(el),vandaag}),vulLijn=P.lijn,vulOntdek=P.ontdek;

  /* Een avond samenstellen en aanvragen gebeurt in avond.html (SCHERMEIGENAAR.json).
     Hier stond een tweede samensteller op dezelfde routes, met een eigen
     "Moment Contract"; het paneel opent nu de eigenaar zelf. */
  function kies(i){actief=i;panes.forEach((p,n)=>p.el.classList.toggle('actief',n===i));var t=$('#lvTabs');t.innerHTML='';panes.forEach((p,n)=>{var b=document.createElement('button');b.className='rv-tab'+(n===i?' actief':'');b.textContent=p.titel;b.onclick=()=>kies(n);t.appendChild(b)});document.querySelectorAll('[data-open]').forEach(b=>b.classList.toggle('actief',b.dataset.open===panes[i].id));context()}
  function context(){var z={lijn:'Uw lijn toont wat u zelf ergens deed. Ik voer hier niets uit.',moment:'Kies in de planner sfeer, tijd, gezelschap en budget; aanvragen doet u zelf.',ontdek:'Dit zijn de zaken die nu in RTG staan. Een avond samenstellen doet u in Uw avond.',bestellen:'Zal ik bezorgen laten aansluiten op wanneer iedereen er is?',uitgaan:'Ik combineer gastenlijst, tafel en veilige terugreis.',verblijf:'Ik verbind verblijf, aankomst en ontbijt.'};$('#lvContext').textContent=z[panes[actief]?.id]||'Ik houd de samenhang voor u vast.'}
  function vraag(){var q=$('#lvIn').value.trim().toLowerCase();if(!q)return;$('#lvIn').value='';if(/eten|restaurant|tafel/.test(q))open('food',true);else if(/bezorg|bestel/.test(q))open('bestellen',true);else if(/club|uit|avond/.test(q))open('avond',true);else if(/hotel|slaap|verblijf/.test(q))open('verblijf',true);else open('moment',false)}
  document.querySelectorAll('[data-open]').forEach(b=>b.onclick=()=>open(b.dataset.open,false));$('#lvPlus').onclick=()=>open(panes[0]?.id==='moment'?'ontdek':'moment',true);$('#lvStuur').onclick=vraag;$('#lvIn').onkeydown=e=>{if(e.key==='Enter')vraag()};$('#lvMond').onclick=()=>$('#lvIn').focus();if(window.RTGMond)RTGMond.fab($('#lvMond'),20);
  /* Het werkblad opent op de lijn: dat is het command center dat LEVEN.md
     par. 4 op dit adres belooft. Op een breed scherm staat de avondplanner
     ernaast. */
  var adres=/^#([a-z]+)$/.exec(location.hash),eerst=adres&&apps[adres[1]]?adres[1]:'lijn';
  /* Een ingang kan een paneel bij naam openen (life.html linkt naar #moment). */
  if(innerWidth>980){open('lijn',false);if(eerst!=='lijn')open(eerst,true);else open('moment',true)}else open(eerst,false)
})();
