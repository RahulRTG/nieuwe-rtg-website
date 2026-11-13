'use strict';

/* Projecteer de bestaande volledige a11y-meting naar exact schermgebonden
   Experience-waarnemingen. Deze module meet niets en maakt geen bewijs; zij
   weigert onvolledige, dubbele of niet-nul route-uitkomsten fail-closed. */
const STATES=['uitgelogd','ingelogd','zaak'];
const THEMES=['champagne','bordeaux','royal'];
const own=(value,key)=>Object.prototype.hasOwnProperty.call(value,key);

function expected() {
  return {
    states:Object.fromEntries(STATES.map(name=>[name,{structural:0,contrast:0}])),
    themes:Object.fromEntries(THEMES.map(name=>[name,{structural:0,contrast:0}]))
  };
}
const touchExpected=()=>({belowPremiumMinimum:0,minimumCssPixels:44});
const mobileLayoutExpected=()=>({hands:['rechts','links'],overflow:false,empty:false,barsOutside:0});
const tabletLayoutExpected=()=>({overflow:false});

function validate(measurement,screenRoutes) {
  const blockers=[];
  if(!measurement||measurement.schemaVersion!==2) blockers.push('A11Y_MEASUREMENT_SCHEMA_INVALID');
  if(measurement?.browser?.name!=='chromium'||typeof measurement?.browser?.version!=='string'||
    !/^\d+(\.\d+)+$/.test(measurement.browser.version)) blockers.push('A11Y_BROWSER_IDENTITY_INVALID');
  if(!measurement?.routes||typeof measurement.routes!=='object'||Array.isArray(measurement.routes)) {
    blockers.push('A11Y_ROUTE_RESULTS_MISSING');
    return {status:'BLOCKED',blockers,observations:{}};
  }
  const required=[...new Set(screenRoutes)].sort(),actual=Object.keys(measurement.routes).sort();
  if(required.length!==screenRoutes.length) blockers.push('EXPERIENCE_ROUTE_INVENTORY_DUPLICATE');
  const allowed=new Set(required.concat('/site/404.html'));
  for(const route of required) if(!own(measurement.routes,route)) blockers.push('A11Y_ROUTE_MISSING:'+route);
  for(const route of actual) if(!allowed.has(route)) blockers.push('A11Y_ROUTE_UNKNOWN:'+route);
  if(!own(measurement.routes,'/site/404.html')) blockers.push('A11Y_404_MISSING');
  if(Number(measurement.paginas)!==actual.length) blockers.push('A11Y_ROUTE_COUNT_MISMATCH');
  const observations={},touchObservations={},layoutObservations={};
  for(const route of required) {
    const row=measurement.routes[route];
    if(!row)continue;
    const observed={states:{},themes:{}};
    for(const state of STATES) {
      const value=row.states?.[state];
      if(!value?.measured) blockers.push('A11Y_STATE_NOT_MEASURED:'+route+':'+state);
      observed.states[state]={structural:Number(value?.structural ?? -1),contrast:Number(value?.contrast ?? -1)};
    }
    for(const theme of THEMES) {
      const value=row.themes?.[theme];
      if(!value?.measured) blockers.push('A11Y_THEME_NOT_MEASURED:'+route+':'+theme);
      observed.themes[theme]={structural:Number(value?.structural ?? -1),contrast:Number(value?.contrast ?? -1)};
    }
    if(JSON.stringify(observed)!==JSON.stringify(expected())) blockers.push('A11Y_CONTRAST_OR_STRUCTURE_FAILED:'+route);
    observations[route]=observed;
    touchObservations[route]={};
    for(const [device,key] of [['mobile-large','mobile'],['tablet','tablet']]) {
      const value=row.touchTargets?.[key];
      if(!value?.measured) blockers.push('A11Y_TOUCH_NOT_MEASURED:'+route+':'+device);
      const touch={belowPremiumMinimum:Number(value?.belowPremiumMinimum ?? -1),minimumCssPixels:44};
      if(JSON.stringify(touch)!==JSON.stringify(touchExpected())) blockers.push('A11Y_PREMIUM_TOUCH_FAILED:'+route+':'+device);
      touchObservations[route][device]=touch;
    }
    const hands=['rechts','links'],mobile={hands,overflow:false,empty:false,barsOutside:0};
    for(const hand of hands) {
      const value=row.mobile?.[hand];
      if(!value?.measured) blockers.push('A11Y_MOBILE_NOT_MEASURED:'+route+':'+hand);
      mobile.overflow=mobile.overflow||Boolean(value?.overflow);
      mobile.empty=mobile.empty||Boolean(value?.empty);
      mobile.barsOutside+=Number(value?.barsOutside ?? -1);
    }
    const tablet={overflow:Boolean(row.tablet?.overflow)};
    if(!row.tablet?.measured) blockers.push('A11Y_TABLET_NOT_MEASURED:'+route);
    if(JSON.stringify(mobile)!==JSON.stringify(mobileLayoutExpected())) blockers.push('A11Y_MOBILE_LAYOUT_FAILED:'+route);
    if(JSON.stringify(tablet)!==JSON.stringify(tabletLayoutExpected())) blockers.push('A11Y_TABLET_LAYOUT_FAILED:'+route);
    layoutObservations[route]={'mobile-large':mobile,tablet};
  }
  return {status:blockers.length?'BLOCKED':'PROVEN',blockers,observations,touchObservations,layoutObservations};
}

function configuration(browserVersion,subjectId) {
  return {browser:'chromium',browserVersion,viewport:{width:1440,height:900},deviceScaleFactor:1,touch:false,
    reducedMotion:false,locale:'nl-NL',serviceWorkers:'block',persona:'multi-session',
    state:'multi-state-theme',network:'local-test-server',subjectId};
}

function touchConfiguration(browserVersion,subjectId,device) {
  const profile=device==='mobile-large'
    ? {viewport:{width:390,height:844},safeAreaInsets:{top:59,bottom:34,left:0,right:0}}
    : device==='tablet'?{viewport:{width:834,height:1112},safeAreaInsets:null}:null;
  if(!profile)throw new Error('Onbekend a11y-aanraakprofiel: '+device);
  return {browser:'chromium',browserVersion,device,viewport:profile.viewport,safeAreaInsets:profile.safeAreaInsets,
    deviceScaleFactor:1,touch:false,reducedMotion:false,locale:'nl-NL',serviceWorkers:'block',persona:'rtg-member',
    state:'normal',network:'local-test-server',subjectId};
}

function layoutConfiguration(browserVersion,subjectId,device) {
  const configuration=touchConfiguration(browserVersion,subjectId,device);
  configuration.network='normal';
  return configuration;
}

module.exports={STATES,THEMES,expected,touchExpected,mobileLayoutExpected,tabletLayoutExpected,
  validate,configuration,touchConfiguration,layoutConfiguration};
