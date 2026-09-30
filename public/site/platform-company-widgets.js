/* Company content in the native widget frame. Preferences stay in this page session. */
(function(w,d){
 'use strict';
 var P=w.RTGPublicPlatform,D=w.RTGPublicContent,node=P.node,button=P.button,icon=P.icon;
 w.RTGCompanyWidgets=function(v){
  var state={},pinned=['architecture','foundation'],views=[];
  function text(el,key){el.dataset.i18n='public.'+key;el.dataset.i18nSource=D.words[key][0];el.textContent=P.copy(key);}
  function sync(root,value){views.filter(function(x){return x.root.isConnected&&x.root.dataset.companySurface===root.dataset.companySurface;}).forEach(function(x){x.draw(value);});}
  function watch(root,draw){views=views.filter(function(x){return x.root.isConnected;});views.push({root:root,draw:draw});}
  function tabs(root,items,draw,selected){var nav=node('div',null,'pc-tabs');items.forEach(function(item,i){var b=button(item.key,function(){sync(root,i);},'pc-tab');if(item.label){b.textContent=item.label;b.translate=false;}if(item.key){b.setAttribute('aria-label',P.copy(item.key));b.dataset.i18nAria='public.'+item.key;}b.setAttribute('aria-pressed',String(i===selected));nav.append(b);});root.append(nav);watch(root,function(i){draw(i);nav.querySelectorAll('button').forEach(function(x,n){x.setAttribute('aria-pressed',String(n===i));});});return nav;}
  function surface(card,root){
   var s=state[card.id]||(state[card.id]={index:0,calendar:false});root.dataset.companySurface=card.id;
   if(card.id==='origin'){
    var step=node('div',null,'pc-step-number'),title=node('h3'),body=node('p',null,'wd-muted');root.append(step,title,body);
    var keys=['originTravel','originLife','originPlatform'];
    function origin(i){s.index=i;step.textContent=String(i+1).padStart(2,'0');text(title,keys[i]);text(body,keys[i]+'Body');}origin(s.index);
    tabs(root,keys.map(function(k,i){return{key:k,label:String(i+1).padStart(2,'0')};}),origin,s.index);
   }else if(card.id==='worlds'||card.id==='product'){
    var worldNames=['living','travel','work','foundation'],worldLabels=['LivingOS','TravelOS','WorkOS','FoundationOS'];
    var mark=node('div',null,'pc-world-mark'),title=node('h3'),body=node('p',null,'wd-muted');root.append(mark,title,body);
    function world(i){s.index=i;mark.dataset.world=worldNames[i];mark.replaceChildren(icon(['home','plane','brief','heart'][i]));title.textContent=worldLabels[i];title.translate=false;text(body,['worldLiving','worldTravel','worldWork','worldFoundation'][i]);}world(s.index);
    tabs(root,worldLabels.map(function(label){return{label:label};}),world,s.index);
   }else if(card.id==='architecture'){
    var labels=['Person','Intent','Authority','Evidence'],keys=['architecturePerson','architectureIntent','architectureAuthority','architectureEvidence'];
    var diagram=node('div',null,'pc-meaning'),number=node('span',null,'pc-step-number'),title=node('h3'),body=node('p',null,'wd-muted');diagram.append(number,title,body);root.append(diagram);
    function meaning(i){s.index=i;number.textContent=['01','04','06','09'][i];title.textContent=labels[i];title.translate=false;text(body,keys[i]);}meaning(s.index);
    tabs(root,labels.map(function(label){return{label:label};}),meaning,s.index);root.append(node('small','architectureNote','pc-caption'));
   }else if(card.id==='language'){
    var letters=node('div',null,'pc-language-art');['Aa','ع','あ'].forEach(function(t){var x=node('span');x.textContent=t;x.translate=false;letters.append(x);});root.append(letters,node('h3','languageLead'),node('p','languageBody','wd-muted'));
    var nav=node('div',null,'pc-tabs');['nl','en','ar'].forEach(function(lang){var b=button(null,function(){w.RTGi18n.set(lang,false);},'pc-tab');b.textContent={nl:'Nederlands',en:'English',ar:'العربية'}[lang];b.translate=false;b.dataset.publicLanguage=lang;nav.append(b);});root.append(nav);
   }else if(card.id==='rahul'){
    root.append(P.lips(),node('blockquote','rahulWish','pc-intent'));
    ['rahulUnderstand','rahulPrepare','rahulDecide'].forEach(function(key,i){var row=node('div',null,'wd-data-row');row.append(icon(['people','list','shield'][i]),node('span',key));root.append(row);});root.append(node('small','rahulCaption','pc-caption'));
   }else if(card.id==='control'){
    var shield=node('div',null,'wd-security');shield.append(icon('shield'));root.append(shield,node('h3','controlDemo'));
    var label=node('label',null,'pp-toggle'),toggle=node('input');toggle.type='checkbox';toggle.setAttribute('role','switch');toggle.checked=s.calendar;toggle.dataset.companyPermission='';label.append(toggle,node('span','controlToggle'));root.append(label);
    var response=node('p',s.calendar?'controlYes':'controlNo','pc-permission-result');response.setAttribute('role','status');watch(root,function(value){s.calendar=value;toggle.checked=value;text(response,value?'controlYes':'controlNo');});toggle.onchange=function(){sync(root,toggle.checked);};root.append(response,node('small','controlBoundary','pc-caption'));
   }else if(card.id==='foundation'){
    var mark=node('div',null,'pc-world-mark');mark.dataset.world='foundation';root.append(mark,node('h3','free'));var body=node('p',null,'wd-muted'),keys=['foundationFamily','foundationLearn','foundationTalent'];root.append(body);
    function foundation(i){s.index=i;mark.replaceChildren(icon(['people','book','spark'][i]));text(body,keys[i]+'Body');}foundation(s.index);tabs(root,keys.map(function(k){return{key:k};}),foundation,s.index);
   }else if(card.id==='questions'){
    ['faqCompany','faqFree','faqAI'].forEach(function(key){var row=node('details',null,'pc-question');row.append(node('summary',key),node('p',key+'Body'));root.append(row);});
   }
  }
  function widget(card,favorite){
   var box=node('article',null,'wd-widget pp-widget pc-widget pc-editorial-card');box.dataset.publicWidget=card.id;box.dataset.widget=card.id;box.dataset.world=card.world;if(favorite)box.dataset.favorite='true';
   var open=button(null,function(){v.o.open(card.target);},'wd-widget-open pc-editorial-open');
   var index=node('span',null,'pc-card-index'),heading=node('span',card.title,'pc-card-title'),description=node('span',card.body,'pc-card-description'),footer=node('span',null,'pc-card-footer'),action=node('span',card.action);
   index.textContent=String(v.data.cards.indexOf(card)+1).padStart(2,'0');index.translate=false;
   footer.append(action,icon('next'));open.append(index,heading,description,footer);open.setAttribute('aria-label',P.copy(card.title)+' · '+P.copy('open'));box.append(open);return box;
  }
  function setPin(pin){var yes=pinned.includes(pin.dataset.companyPin);pin.setAttribute('aria-pressed',String(yes));pin.setAttribute('aria-label',P.copy(yes?'companyUnpin':'companyPin'));}
  function refreshPins(){d.querySelectorAll('[data-company-pin]').forEach(setPin);var search=d.querySelector('#platform-search');if(search)search.dispatchEvent(new Event('input'));}
  function favoritesPaint(){v.favorites.replaceChildren();}
  w.addEventListener('rtglang',refreshPins);return{widget:widget,favoritesPaint:favoritesPaint};
 };
})(window,document);
