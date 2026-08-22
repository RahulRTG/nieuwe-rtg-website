/* HET VOORUITZICHT -- de cockpit van LivingOS.

   Hier zijn twee schermen samengevoegd (WERELDEN.md, "de twee dubbele paren"):
   dit scherm hield drie werelden vast maar praatte met niets, en Instant Reality
   had de motor (/api/instant-reality: versies, idempotente sleutels, een
   statusladder die pas 'gereed' zegt als een provider dat bevestigt) achter een
   tweede scherm met bijna dezelfde belofte. De motor is hierheen gehaald; het
   tweede scherm is weg.

   Twee dingen die uit ADAPTIEF.md volgen en die hier eerder ontbraken:
   - de beslissende actie staat IN het wereldpaneel, want dat is het enige paneel
     dat een telefoon standaard toont;
   - de balk links schakelt op een telefoon werkelijk tussen panelen. Hij stond er
     al, maar was nergens aan gebonden: vier van de vijf knoppen deden niets en
     twee panelen waren op telefoonmaat onbereikbaar. Verbergen bestaat niet. */
(function(){'use strict';var $=s=>document.querySelector(s);
var worlds={likely:{label:'WAARSCHIJNLIJK · 91%',title:'Alles ligt al klaar.',score:92,caps:[88,86,84,94,97],accent:'#72bd94'},ideal:{label:'IDEAAL · 74%',title:'Alles valt samen.',score:98,caps:[91,94,92,98,100],accent:'#c0a544'},disruption:{label:'VERSTORING · VLUCHT +6 UUR',title:'Rust, ook wanneer het schuift.',score:87,caps:[84,72,77,91,89],accent:'#a64b67'}};
var u={version:1,providers:{hotel:'prepared',transport:'prepared',finance:'local'}};

function token(){try{return localStorage.getItem('rtg_member_token')}catch(e){return''}}
async function api(pad,body){var r=await fetch(pad,{method:'POST',headers:{'Content-Type':'application/json',Authorization:'Bearer '+(token()||'')},body:JSON.stringify(body||{})});if(!r.ok)throw new Error('offline');return r.json()}
function render(x){u=x||u;$('#loId').textContent=u.id||'LOKAAL UNIVERSUM';$('#loVersion').textContent='V'+(u.version||1);var p=u.providers||{};$('#hotelState').textContent=p.hotel||'prepared';$('#transportState').textContent=p.transport||'prepared';$('#financeState').textContent=p.finance||'local'}
/* De sleutel maakt een herhaalde gebeurtenis onschadelijk; de versie laat de
   server een verlopen beeld weigeren. Valt de server weg, dan blijft het scherm
   werken maar zegt het eerlijk dat de provider nog niets bevestigd heeft. */
async function stuur(type,extra){$('#loSync').textContent='Synchroniseren…';
  try{var r=await api('/api/instant-reality/event',Object.assign({type:type,version:u.version,key:type+'-'+Date.now()},extra||{}));render(r.universe);$('#loSync').textContent='Universum bevestigd';return r.universe}
  catch(e){u.version++;$('#loVersion').textContent='V'+u.version;$('#loSync').textContent='Lokaal veilig · provider wacht'}}
api('/api/instant-reality').then(render).catch(()=>render(u));

function setWorld(id){var w=worlds[id];document.querySelectorAll('[data-world]').forEach(b=>b.classList.toggle('actief',b.dataset.world===id));$('#loWorldLabel').textContent=w.label;$('#loWorldTitle').textContent=w.title;$('#loWorldScore').innerHTML=w.score+'<small>rust</small>';['capMoney','capTime','capEnergy','capPeople','capLife'].forEach((x,i)=>$('#'+x).textContent=w.caps[i]);$('#loWorld').style.setProperty('--world-accent',w.accent);$('#loContext').textContent=id==='disruption'?'De vlucht schuift zes uur. Ik bescherm hotel, vervoer en herstel zonder opnieuw te boeken.':'Ik houd drie werelden tegelijk vast. Vraag om een verstoring of spoel terug.'}
function action(a){if(a==='why')$('#loWhy').hidden=!$('#loWhy').hidden;else if(a==='approve')$('#loDialog').showModal();else if(a==='focus')document.body.classList.toggle('lo-focus');else if(a==='compare')document.body.classList.toggle('lo-compare');else if(a==='edit')$('#loIntent').focus()}
document.querySelectorAll('[data-world]').forEach(b=>b.onclick=()=>{setWorld(b.dataset.world);stuur('world.selected',{value:b.dataset.world})});
document.querySelectorAll('[data-act]').forEach(b=>b.onclick=()=>action(b.dataset.act));
document.querySelectorAll('[data-link]').forEach(b=>b.onclick=()=>location.href=b.dataset.link);
document.querySelectorAll('.lo-policies button').forEach(b=>b.onclick=()=>b.classList.toggle('aan'));

/* De balk links: op telefoonmaat kiest hij het paneel (de opmaak leest
   body[data-view]), op bureaumaat staan de panelen naast elkaar en schuift hij
   het gekozen paneel in beeld. Zelfde handeling, andere vorm. */
document.querySelectorAll('.lo-rail nav button').forEach(b=>b.onclick=()=>{
  var v=b.dataset.view;document.querySelectorAll('.lo-rail nav button').forEach(x=>x.classList.toggle('actief',x===b));
  document.body.setAttribute('data-view',v);document.body.classList.toggle('lo-replay',v==='evidence');
  var paneel=v==='intent'?'.lo-intent':v==='decisions'||v==='evidence'?'.lo-decisions':'.lo-worlds';
  if(innerWidth>760){var el=$(paneel);if(el)el.scrollIntoView({behavior:'smooth',block:'nearest',inline:'nearest'})}});

var timer;$('#loIntent').oninput=e=>{clearTimeout(timer);
  document.querySelectorAll('.lo-tokens span').forEach((x,i)=>x.classList.toggle('on',i<Math.min(5,Math.ceil(e.target.value.length/22))));
  timer=setTimeout(()=>stuur('intent.delta',{value:e.target.value}),350)};

async function vrijgeven(){await stuur('preparation.authorized');
  var p=$('#loProvider');p.classList.add('active');p.querySelector('em').textContent='VERIFIËREN';
  $('#loApprove').disabled=true;$('#loApprove').textContent='Voorbereiding vrijgegeven';
  $('#loContext').textContent='Voorbereiding vrijgegeven. Boeken en betalen blijven geblokkeerd.'}
$('#loApprove').onclick=()=>$('#loDialog').showModal();
$('#loDialog').addEventListener('close',function(){if(this.returnValue==='ok')vrijgeven()});

async function vertraag(){await stuur('arrival.delayed',{value:'22:25-22:45'});
  setWorld('disruption');document.body.classList.add('lo-disruption');
  $('#loEvent').textContent='ARRIVAL.DELAYED';
  $('#loMessage').textContent='Vlucht +6 uur → hotel beschermd → vervoer opnieuw voorbereid → vrienden krijgen één rustig voorstel.'}
$('#loDelay').onclick=vertraag;

function ask(){var q=$('#loInput').value.trim().toLowerCase();if(!q)return;$('#loInput').value='';
  if(/verstoring|vertraging|zes uur|6 uur|mis/.test(q))vertraag();
  else if(/ideaal|beste/.test(q)){setWorld('ideal');stuur('world.selected',{value:'ideal'})}
  else if(/waarschijnlijk|normaal/.test(q)){setWorld('likely');stuur('world.selected',{value:'likely'})}
  else if(/waarom|uitleg/.test(q)){$('#loWhy').hidden=false;$('#loContext').textContent='Ik toon bron, regel en afweging achter iedere beslissing.'}
  else if(/terug|spoel|replay/.test(q)){document.body.classList.add('lo-replay');$('#loContext').textContent='Teruggespoeld tot vóór de prijswijziging van 12:16.'}
  else if(/akkoord|voorbereid|toestemming/.test(q))$('#loApprove').click()}
$('#loSend').onclick=ask;$('#loInput').onkeydown=e=>{if(e.key==='Enter')ask()};
$('#loMouth').onclick=()=>$('#loInput').focus();if(window.RTGMond)RTGMond.fab($('#loMouth'),20)})();
