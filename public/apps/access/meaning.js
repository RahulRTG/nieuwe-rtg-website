/* Language-neutral bindings for the existing account routes. This is a projection
   contract, not an authority service: only the server may authenticate or sign. */
(function(root,factory){
  const api=factory();
  if(typeof module==='object' && module.exports) module.exports=api;
  if(root) root.RTGAccessMeaning=api;
})(typeof window==='undefined'?null:window,function(){
  'use strict';
  const VERSION=1;
  const definitions={
    'identity.account.create':{route:'/auth/register',goal:'identity.account.available',risk:'decision',
      required:{name:'string',email:'string',geboortedatum:'string',password:'string'},
      optional:{wervingscode:'string'},fixed:{tier:'guest',pasApp:'rtg'},
      authority:'server authentication, age and account policy',effect:'FREE_ACCOUNT_CREATED'},
    'identity.session.open':{route:'/auth/login',goal:'identity.session.authenticated',risk:'decision',
      required:{login:'string',password:'string'},optional:{pasApp:'string'},authority:'server password and second-factor policy',effect:'SESSION_OR_SECOND_FACTOR'},
    'identity.second_factor.verify':{route:'/auth/tweede',goal:'identity.session.authenticated',risk:'decision',
      required:{bewijs:'string',code:'string'},optional:{},authority:'server challenge, expiry and one-time proof',effect:'SESSION_AUTHENTICATED'},
    'identity.passkey.challenge':{route:'/webauthn/opties',goal:'identity.session.authenticated',risk:'interface',
      required:{},optional:{},authority:'server WebAuthn challenge',effect:'CHALLENGE_CREATED'},
    'identity.passkey.verify':{route:'/webauthn/login',goal:'identity.session.authenticated',risk:'decision',
      required:{ceremonie:'string',antwoord:'object'},optional:{pasApp:'string'},authority:'server WebAuthn signature, origin and replay checks',effect:'SESSION_AUTHENTICATED'},
    'identity.recovery.request':{route:'/auth/forgot',goal:'identity.access.recovered',risk:'decision',
      required:{email:'string'},optional:{},authority:'server recovery policy and rate limit',effect:'RECOVERY_REQUEST_ACCEPTED'},
    'identity.password.replace':{route:'/auth/reset',goal:'identity.access.recovered',risk:'decision',
      required:{token:'string',password:'string'},optional:{code:'string'},authority:'server reset token, expiry and SMS policy',effect:'PASSWORD_REPLACED'},
    'identity.agreement.accept':{route:'/onboarding/teken',goal:'identity.onboarding.complete',risk:'legal',
      required:{naam:'string',akkoord:'boolean',contractVersion:'number'},optional:{},authority:'server session, explicit consent and contract version',effect:'AGREEMENT_SIGNED'}
  };
  function freeze(value){Object.values(value).forEach(v=>{if(v && typeof v==='object')freeze(v);});return Object.freeze(value);}
  freeze(definitions);
  const semanticCache=new Map(Object.entries(definitions));
  function plan(meaningId,parameters,version){
    if(version!==undefined && version!==VERSION) throw new Error('Unsupported meaning version');
    const d=semanticCache.get(meaningId);
    if(!d) throw new Error('Unknown account meaning');
    const p=parameters || {},out={};
    const fields=Object.assign({},d.required,d.optional);
    for(const key of Object.keys(p)) if(!Object.hasOwn(fields,key)) throw new Error('Unknown parameter: '+key);
    for(const [key,type] of Object.entries(fields)) {
      const value=p[key];
      if(value===undefined && !Object.hasOwn(d.required,key)) continue;
      if(typeof value!==type || value===null || (type==='object' && Array.isArray(value))) throw new Error('Invalid parameter: '+key);
      out[key]=value;
    }
    if(meaningId==='identity.agreement.accept' && (out.akkoord!==true || !Number.isSafeInteger(out.contractVersion) || out.contractVersion<1))
      throw new Error('Explicit consent and a contract version are required');
    Object.assign(out,d.fixed || {});
    return {meaningId,meaningVersion:VERSION,goal:d.goal,route:d.route,parameters:out,
      authority:d.authority,effect:d.effect,risk:d.risk};
  }
  const DECISION=new Set(['language_notice','continue_with_a_passkey','create_my_account','sign_in','request_recovery','save_my_password',
    'choose_a_unique_password_of_at_least_six_characters_you_are_creat']);
  function risk(key){
    if(key.startsWith('access.onb.') || key.startsWith('onb.')) return 'legal';
    return DECISION.has(key.replace('access.portal.',''))?'decision':'interface';
  }
  function projection(key,nl,en,locale,translated){
    const level=risk(key),pinned=level==='decision'||level==='legal';
    if(locale==='nl')return {text:nl,language:'nl',fallback:false,risk:level,version:VERSION};
    if(pinned) return {text:en || nl,language:en?'en':'nl',fallback:locale!==(en?'en':'nl'),risk:level,version:VERSION};
    return {text:translated || en || nl,language:locale,risk:level,version:VERSION};
  }
  return Object.freeze({VERSION,definitions,plan,risk,projection,
    criticalLanguages:Object.freeze(['nl','en']),
    limits:'Structured account actions only; no natural-language intent recognition or human translation certification.'});
});
