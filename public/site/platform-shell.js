(function(w,d){
 'use strict';
 var D=w.RTGPublicContent,P=w.RTGPublicPlatform;
 var node=P.node,icon=P.icon,button=P.button,copy=P.copy,photo=P.photo,lips=P.lips,asset=P.asset;
 function init(o){
  var kind=o.kind,data=D[kind],company=kind==='company',source=o.source,selected=data.stories[0],controller;
  function select(id,notify){return controller.select(id,notify);}
  function collapse(){return controller.collapse();}
  function menu(){return controller.menu();}
  function refresh(){return controller.refresh();}
  var header=node('header',null,'rtg-edge-top pp-header'), brand=node('a',null,'rtg-edge-mark pp-brand');brand.textContent='RTG';brand.href='#platform-home';brand.addEventListener('click',function(e){e.preventDefault();collapse();w.scrollTo({top:0,behavior:'instant'});});
  var context=button(company?'company':'app',function(){menu();},'pp-context');context.append(icon('next'));
  var searchButton=button(null,function(){collapse();search.focus();search.scrollIntoView({block:'center'});},'pp-icon-button');searchButton.append(icon('search'));searchButton.setAttribute('aria-label',copy('search'));searchButton.dataset.i18nAria='public.search';
  var language=button(null,function(){w.RTGi18n&&w.RTGi18n.openModal();},'pp-icon-button pp-language');language.setAttribute('aria-label',copy('language'));language.dataset.i18nAria='public.language';
  var profile=button(null,function(){o.open(company?'support':'begin');},'pp-icon-button pp-profile');profile.append(icon('people'));profile.setAttribute('aria-label',copy(company?'contact':'profile'));profile.dataset.i18nAria='public.'+(company?'contact':'profile');
  header.append(brand,context,node('span','tagline','pp-tagline'),searchButton,language,profile);
  var root=node('main',null,'wd-shell pp-shell');root.id='platform-home';
  var greeting=node('header',null,'wd-greeting');greeting.append(node('h1',company?'companyKicker':'welcomeApp'),node('span',company?'subCompany':'subApp','pp-subtitle'),node('p','tagline'));
  var people=node('aside',null,'wd-people'), home=node('section',null,'wd-home pp-home'), favorites=node('aside',null,'wd-favorites'), library=node('section',null,'wd-library');
  people.append(node('h2',company?'contact':'people'));if(!company)people.append(node('small','example','pp-overline'));
  var contacts=company?[['about','about','people','origin'],['support','supportBody','people','support'],['cooperate','cooperateBody','brief','support']]:[['rahulAppCardTitle','rahulBody','spark','rahul'],['crew','crewBody','people','moment'],['team','teamBody','brief','world:work']];
  contacts.forEach(function(item){var row=button(null,function(){o.open(item[3]);},'wd-person pp-person'), labels=node('span');labels.append(node('strong',item[0]),node('span',item[1],'wd-muted'));row.append(icon(item[2]),labels);people.append(row);});
  people.append(node('p',company?'peopleQuote':'anonymous','pp-people-note'));
  var stories=node('div',null,'pp-stories');stories.setAttribute('aria-label',copy('worlds'));
  data.stories.forEach(function(story){var b=button(null,function(){select(story.id,true);},'pp-story');b.dataset.publicStory=story.id;b.append(photo(story.photo),node('span',story.label));stories.append(b);});
  var more=button(null,function(){menu();},'pp-story pp-story-more');more.append(icon('menu'),node('span','more'));stories.append(more);
  var intro=node('h2',company?'companyIntro':'welcomeApp','pp-mobile-intro');
  var feature=node('article',null,'wh-photo pp-feature'), picture=photo(selected.photo,'pp-feature-photo',true), featureCopy=node('div',null,'pp-feature-copy');
  var overline=node('span',company?'originLabel':'demo','pp-overline'), title=node('h2'), body=node('p'), action=button(company?'storyOpen':'proposalOpen',function(){o.open(controller.selected().target);},'pp-button');
  title.id='platform-story-title';feature.setAttribute('aria-labelledby',title.id);
  var summary=node('span',null,'pp-itinerary');summary.translate=false;summary.hidden=company;
  featureCopy.append(overline,title,summary,body,action);
  featureCopy.append(node('small',company?'illustration':'demoBoundary','pp-boundary'));
  feature.append(picture,featureCopy);
  var stepper=node('div',null,'pp-stepper');data.stories.forEach(function(story){var b=button(null,function(){select(story.id,true);},'pp-step');b.dataset.publicStep=story.id;b.setAttribute('aria-label',copy(story.label));b.dataset.i18nAria='public.'+story.label;stepper.append(b);});
  home.append(stories,intro,feature,stepper);
  var focus=node('section',null,'wd-focus pp-detail');focus.hidden=true;
  var focusHead=node('header',null,'wd-focus-head'), focusTitle=node('h2');focusTitle.tabIndex=-1;
  focusHead.append(focusTitle,button('back',collapse,'wd-text-button'));var detail=node('div',null,'pp-detail-content');focus.append(focusHead,detail);
  var libraryHead=node('div',null,'wd-library-heading'), libraryTitle=node('div');libraryTitle.append(node('h2',company?'companyLibrary':'libraryApp'),node('p',company?'companyLibraryIntro':'libraryDemo'));
  var filters=node('div',null,'pp-library-tools'), searchLabel=node('label',null,'pp-search-label'),search=node('input',null,'wd-search');search.type='search';search.id='platform-search';searchLabel.htmlFor=search.id;searchLabel.append(node('span','search'),search);
  var filter=node('select',null,'pp-filter');filter.setAttribute('aria-label',copy('worlds'));filter.dataset.i18nAria='public.worlds';
  (company?['all','favorites','living','travel','work','foundation']:['all','living','travel','work','foundation']).forEach(function(value){var opt=node('option',value==='all'?'all':value==='favorites'?'companyFavorites':null);opt.value=value;if(!['all','favorites'].includes(value))opt.textContent={living:'LivingOS',travel:'TravelOS',work:'WorkOS',foundation:'FoundationOS'}[value];filter.append(opt);});
  var gridButton=button(null,function(){controller.setView(false);},'pp-icon-button'),listButton=button(null,function(){controller.setView(true);},'pp-icon-button');
  gridButton.append(icon('grid'));gridButton.dataset.i18nAria='public.grid';gridButton.setAttribute('aria-label',copy('grid'));listButton.append(icon('list'));listButton.dataset.i18nAria='public.list';listButton.setAttribute('aria-label',copy('list'));
  filters.append(searchLabel,filter,gridButton,listButton);libraryHead.append(libraryTitle,filters);
  var catalog=node('div',null,'wd-catalog'),empty=node('p','noResults','pp-empty');empty.hidden=true;empty.setAttribute('role','status');
  library.append(libraryHead,catalog,empty);
  var menuPanel=node('div',null,'pp-menu-panel');menuPanel.hidden=true;
  data.cards.forEach(function(card){var b=button(card.title,function(){w.RTGAdaptiveEdge.setState('dock');o.open(card.target);},'pp-menu-item');b.dataset.publicTarget=card.target;menuPanel.append(b);});
  if(!company)[['originCardTitle','verhaal'],['proposalOpen','moment'],['why','uw-rtg'],['faq','vragen'],['support','service']].forEach(function(row){var b=button(row[0],function(){w.RTGAdaptiveEdge.setState('dock');o.open(row[1]);},'pp-menu-item');b.dataset.publicTarget=row[1];menuPanel.append(b);});
  menuPanel.append(button('language',function(){w.RTGAdaptiveEdge.setState('dock');w.RTGi18n.openModal();},'pp-menu-item'));
  var worldPanel=node('div',null,'pp-menu-panel');worldPanel.hidden=true;
  ['living','travel','work','foundation'].forEach(function(world){var b=button(null,function(){w.RTGAdaptiveEdge.setState('dock');o.open(company?'/worlds/'+world+'/':'world:'+world);},'pp-menu-item');b.textContent={living:'LivingOS',travel:'TravelOS',work:'WorkOS',foundation:'FoundationOS'}[world];worldPanel.append(b);});
  var languageNotice=node('p','fallback','pp-language-notice');languageNotice.hidden=true;languageNotice.setAttribute('role','status');
  greeting.append(languageNotice);root.append(greeting,people,home,favorites,focus,library);
  var footer=node('footer',null,'pp-footer');footer.append(node('p','freeFull'),node('span','footer'));
  source.before(header,root,footer,menuPanel,worldPanel);source.classList.add('pp-source');source.setAttribute('aria-hidden','true');
  d.body.classList.add('rtg-stijl');d.body.dataset.rtgSkin='heritage';d.body.dataset.publicPlatform=kind;d.body.dataset.worldHome='living';d.body.dataset.rtgDesktop='living';
  var skip=d.querySelector('.skip-link');if(skip)skip.href='#platform-home';
  controller=w.RTGPublicController({o:o,data:data,company:company,root:root,detail:detail,focus:focus,focusTitle:focusTitle,home:home,favorites:favorites,library:library,title:title,body:body,picture:picture,stories:stories,stepper:stepper,overline:overline,summary:summary,language:language,search:search,filter:filter,catalog:catalog,empty:empty,gridButton:gridButton,listButton:listButton,menuPanel:menuPanel,worldPanel:worldPanel});
  var widgets=(company?w.RTGCompanyWidgets:w.RTGPublicWidgets)({o:o,data:data,company:company,favorites:favorites,refresh:refresh});
  search.addEventListener('input',controller.filterCards);filter.addEventListener('change',controller.filterCards);
  data.cards.filter(function(c){return c.id!=='support';}).forEach(function(card){catalog.append(widgets.widget(card));});
  widgets.favoritesPaint();controller.setView(false);select(selected.id,false);
  w.addEventListener('rtglang',function(){refresh();controller.filterCards();var lang=w.RTGi18n.lang;languageNotice.hidden=lang==='nl'||lang==='en'||Object.keys(D.words).every(function(key){return w.I18N[lang]&&typeof w.I18N[lang]['public.'+key]==='string';});});
  root.addEventListener('keydown',function(e){if(e.key==='Escape'&&controller.current()&&!d.querySelector('dialog[open]')){e.preventDefault();collapse();}});
  return controller;

 }
 w.RTGPublicPlatform.init=init;
})(window,document);
