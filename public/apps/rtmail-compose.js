/* The existing personal draft API owns persistence and delivery. The Edge
   borrows this form's controls; it never sends mail on its own. */
(function(w,d){
  'use strict';
  var mail=w.RTGMail, home=d.getElementById('rtmVoorzijde');if(!mail||!home)return;
  var current=null, release=null, saving=Promise.resolve(), revision=0, stored=0, timer=null, sending=false;
  var form=d.createElement('section');form.className='rtm-compose';form.hidden=true;
  form.innerHTML='<form id="rtmComposeForm"><div class="rtm-paper"><div class="rtm-compose-heading"><p>RTG Mail</p><h1>Uw woorden, persoonlijk.</h1></div><label>Aan<input name="naar" maxlength="254" autocomplete="off" required placeholder="Naam of e-mailadres"></label>'+
    '<label>Onderwerp<input name="onderwerp" maxlength="160" autocomplete="off" placeholder="Waar gaat uw bericht over?"></label>'+
    '<label class="rtm-paper-body"><span class="rtm-reader-label">Uw bericht</span><textarea name="tekst" maxlength="8000" rows="8" placeholder="Schrijf uw bericht…"></textarea></label></div>'+
    '<p class="rtm-compose-status" role="status" aria-live="polite"></p><div class="rtm-compose-controls">'+
    '<button type="button" data-mail-back aria-label="Terug naar uw post">←</button><button type="button" data-mail-save>Bewaar concept</button>'+
    '<button type="submit" form="rtmComposeForm" data-mail-send>Versturen ↗</button></div></form>';
  home.after(form);
  var fields=form.querySelector('form'), controls=form.querySelector('.rtm-compose-controls'), status=form.querySelector('[role="status"]');
  var drafts=d.createElement('section');drafts.className='rtm-draft-list';drafts.hidden=true;drafts.setAttribute('aria-label','Uw concepten');home.querySelector('.rtm-binnen').appendChild(drafts);
  function tell(s){status.textContent=s;}
  function mount(){if(!form.hidden&&!release&&w.RTGAdaptiveEdge)release=w.RTGAdaptiveEdge.mountSurface(controls,{kind:'mail'});}
  function values(){return {id:current&&current.id,naar:fields.elements.naar.value,onderwerp:fields.elements.onderwerp.value,tekst:fields.elements.tekst.value};}
  function save(){
    clearTimeout(timer);var rev=revision, data=values();
    if(stored===rev&&current)return saving;
    tell('Uw concept wordt bewaard…');
    saving=saving.catch(function(){}).then(function(){
      data.id=current&&current.id;
      return mail.api('concept/bewaar',data).then(function(r){current=r.concept;stored=rev;if(revision===rev)tell('Uw concept is bewaard.');return current;});
    });
    return saving.catch(function(e){tell('Uw concept is nog niet bewaard. '+e.message);throw e;});
  }
  function open(c){
    if(!form.hidden)return;
    current=c||null;revision=1;stored=c?1:0;sending=false;
    ['naar','onderwerp','tekst'].forEach(function(key){fields.elements[key].value=c&&c[key]||'';});
    home.hidden=true;form.hidden=false;d.body.classList.add('rtm-composing');
    tell(c?'Uw bewaarde concept is geopend.':'Uw bericht wordt pas verstuurd wanneer u dat bevestigt.');mount();fields.elements.naar.focus();
  }
  function close(){
    if(release)release();release=null;form.hidden=true;d.body.classList.remove('rtm-composing');home.hidden=false;
    if(w.RTGMailVoorzijde)w.RTGMailVoorzijde.voorzijde();
  }
  async function back(){
    if(sending)return;
    try{await save();}catch(e){return;}
    if(stored===revision)close();
  }
  async function list(){
    if(!form.hidden)return;
    drafts.hidden=false;drafts.textContent='Uw concepten worden opgehaald…';
    try{
      var r=await mail.api('concepten',{});drafts.textContent='';
      var h=d.createElement('h2');h.textContent='Uw concepten';drafts.appendChild(h);
      (r.concepten||[]).forEach(function(c){var b=d.createElement('button');b.type='button';b.textContent=(c.onderwerp||'Zonder onderwerp')+' · '+(c.naar||'Nog geen ontvanger');b.onclick=function(){if(c.plan){tell('Dit concept staat gepland.');return;}open(c);};if(c.plan){b.disabled=true;b.textContent+=' · gepland';}drafts.appendChild(b);});
      if(!(r.concepten||[]).length)drafts.appendChild(d.createTextNode('U heeft geen open concepten.'));
      drafts.scrollIntoView({block:'center'});
    }catch(e){drafts.textContent=e.message;}
  }
  fields.addEventListener('input',function(){revision++;tell('Uw wijzigingen zijn nog niet bewaard.');clearTimeout(timer);timer=setTimeout(function(){if(!sending)save().catch(function(){});},700);});
  controls.querySelector('[data-mail-save]').onclick=function(){save().catch(function(){});};
  controls.querySelector('[data-mail-back]').onclick=back;
  fields.addEventListener('submit',async function(e){
    e.preventDefault();if(sending||!fields.reportValidity())return;
    if(!w.confirm('Wilt u dit bericht versturen aan '+fields.elements.naar.value.trim()+'?'))return;
    sending=true;clearTimeout(timer);Array.from(fields.elements).forEach(function(n){n.disabled=true;});controls.querySelectorAll('button').forEach(function(n){n.disabled=true;});
    try{
      await save();await mail.api('concept/verstuur',{id:current.id});
      current=null;stored=revision;fields.reset();close();
      var notice=d.createElement('p');notice.className='rtm-send-result';notice.setAttribute('role','status');notice.textContent='Uw bericht is verstuurd.';home.querySelector('.rtm-binnen').prepend(notice);
    }catch(err){tell('Verzending is niet bevestigd. Uw concept blijft open. '+err.message);}
    finally{sending=false;Array.from(fields.elements).forEach(function(n){n.disabled=false;});controls.querySelectorAll('button').forEach(function(n){n.disabled=false;});}
  });
  [['Nieuw bericht',function(){open();}],['Concepten',list]].forEach(function(x){var b=d.createElement('button');b.type='button';b.textContent=x[0];b.onclick=x[1];home.querySelector('.rtm-nav').appendChild(b);});
  w.addEventListener('rtg-adaptive-ready',mount);
  w.addEventListener('beforeunload',function(e){if(!form.hidden&&revision!==stored){e.preventDefault();e.returnValue='';}});
}(window,document));
