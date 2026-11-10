  /* Mijn RTG gebruikt het bestaande instellingenpaneel en dezelfde PersonalOS-
     bron als de onboarding. Er ontstaat geen tweede dashboard of catalogus:
     de capabilityknoppen komen uit de actuele, door Authority gefilterde
     compositie. Conditioneel bewaren voorkomt last-write-wins tussen twee
     toestellen; bij 409 toont dit toestel de nieuwere serverstand. */
  const personalScrim=$('#osPersonalScrim'), personalOpen=$('#osCcPersonal');
  const personalGoals=$('#osPersonalGoals'), personalLayouts=$('#osPersonalLayouts');
  const personalPins=$('#osPersonalPins'), personalStatus=$('#osPersonalStatus');
  const PERSONAL_DOELEN=['dagelijks_leven','reizen','talent_ontwikkelen','ondernemen','werken_en_leren','ondersteuning','bijdragen'];
  const PERSONAL_INDELINGEN=['simple','balanced','advanced'];
  function personalDoelLabel(id){return T('personalos.goal.'+id,({dagelijks_leven:'Dagelijks leven',reizen:'Reizen',talent_ontwikkelen:'Talent ontwikkelen',ondernemen:'Ondernemen',werken_en_leren:'Werken en leren',ondersteuning:'Ondersteuning',bijdragen:'Bijdragen'})[id]||id);}
  function personalIndelingLabel(id){return T('personalos.layout.'+id,({simple:'Eenvoudig',balanced:'Gebalanceerd',advanced:'Uitgebreid'})[id]||id);}
  let personalConcept=null, personalBewaarVolgorde=0;
  function personalKnop(vak,label,aan,doe){
    const b=document.createElement('button');b.type='button';b.textContent=label;b.classList.toggle('aan',aan);
    b.setAttribute('aria-pressed',String(aan));b.addEventListener('click',doe);vak.appendChild(b);
  }
  function personalTeken(){
    if(!personalConcept||!personalGoals||!personalLayouts||!personalPins)return;
    personalGoals.textContent='';personalLayouts.textContent='';personalPins.textContent='';
    PERSONAL_DOELEN.forEach(function(id){personalKnop(personalGoals,personalDoelLabel(id),personalConcept.goals.includes(id),function(){
      personalConcept.goals=personalConcept.goals.includes(id)?personalConcept.goals.filter(function(x){return x!==id;}):personalConcept.goals.concat(id);personalTeken();});});
    PERSONAL_INDELINGEN.forEach(function(id){personalKnop(personalLayouts,personalIndelingLabel(id),personalConcept.layout===id,function(){personalConcept.layout=id;personalTeken();});});
    const gezien=new Set();
    ((personalOSComposition&&personalOSComposition.worlds)||[]).forEach(function(w){(w.capabilities||[]).forEach(function(c){
      if(gezien.has(c.id))return;gezien.add(c.id);personalKnop(personalPins,c.name,personalConcept.pinnedCapabilities.includes(c.id),function(){
        personalConcept.pinnedCapabilities=personalConcept.pinnedCapabilities.includes(c.id)
          ?personalConcept.pinnedCapabilities.filter(function(x){return x!==c.id;}):personalConcept.pinnedCapabilities.concat(c.id);personalTeken();});});});
  }
  function openPersonal(){
    if(!personalScrim)return;sluitScrims();
    const p=personalOSPreferences||{goals:[],layout:'balanced',pinnedCapabilities:[],hiddenSuggestions:[],worldOrder:[],worldOrderMode:'auto',revision:0};
    personalConcept={goals:(p.goals||[]).slice(),layout:p.layout||'balanced',pinnedCapabilities:(p.pinnedCapabilities||[]).slice(),
      hiddenSuggestions:(p.hiddenSuggestions||[]).slice(),worldOrder:(p.worldOrder||[]).slice(),worldOrderMode:p.worldOrderMode||'auto',revision:Number(p.revision)||0};
    personalStatus.textContent='';personalTeken();personalScrim.classList.add('open');
  }
  if(personalOpen)personalOpen.addEventListener('click',openPersonal);
  const personalClose=$('#osPersonalClose');if(personalClose)personalClose.addEventListener('click',sluitScrims);
  const personalSave=$('#osPersonalSave');if(personalSave)personalSave.addEventListener('click',async function(){
    if(!personalConcept||!personalConcept.goals.length){personalStatus.textContent=T('personalos.settings.goal_required','Kies ten minste één doel.');return;}
    const poging=++personalBewaarVolgorde;personalSave.disabled=true;personalStatus.textContent=T('personalos.settings.saving','Uw RTG wordt bewaard.');
    try{
      const uit=await API.call('/personalos/complete',{goals:personalConcept.goals,layout:personalConcept.layout,
        pinnedCapabilities:personalConcept.pinnedCapabilities,hiddenSuggestions:personalConcept.hiddenSuggestions,
        worldOrder:personalConcept.worldOrder,worldOrderMode:personalConcept.worldOrderMode,preferenceVersion:personalConcept.revision});
      if(poging!==personalBewaarVolgorde)return;
      personalOSPreferences=uit.preferences;await laadPersonalOS();personalConcept.revision=personalOSPreferences.revision;
      if(typeof wereldBij==='function')wereldBij();personalStatus.textContent=T('personalos.settings.saved','Uw persoonlijke RTG is bijgewerkt.');
    }catch(e){
      if(poging!==personalBewaarVolgorde)return;
      if(e&&e.status===409&&e.data&&e.data.currentPreferences){personalOSPreferences=e.data.currentPreferences;openPersonal();personalStatus.textContent=T('personalos.settings.conflict','Uw RTG was op een ander apparaat gewijzigd. De nieuwste versie is geladen.');}
      else personalStatus.textContent=e.message||T('personalos.settings.save_failed','Bewaren is niet gelukt.');
    }finally{if(poging===personalBewaarVolgorde)personalSave.disabled=false;}
  });
