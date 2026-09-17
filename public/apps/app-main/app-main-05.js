    /* Account access: validate the current step and submit through the existing auth routes. */
    function invalid(text){
      message(text,true); inp.focus();
    }
    async function submit(){
      if (busy) return;
      const value = inp.type === 'password' || el('agShowPassword').getAttribute('aria-pressed') === 'true' ? inp.value : inp.value.trim();
      inp.removeAttribute('aria-invalid'); el('agError').textContent='';
      if (!value || !inp.checkValidity()) return invalid(()=>T('access.portal.please_check_this_field_and_complete_it','Controleer dit veld en vul het volledig in.'));
      if (view === 'register' && step < 3) {
        const s=steps()[step];
        if (step === 1 && !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(value)) return invalid(()=>T('access.portal.enter_a_valid_email_address_such_as_name_example_com','Vul een geldig e-mailadres in, bijvoorbeeld naam@voorbeeld.nl.'));
        if (step === 2) {
          const date=new Date(value+'T12:00:00'), now=new Date();
          let age=now.getFullYear()-date.getFullYear();
          if (now.getMonth()<date.getMonth() || (now.getMonth()===date.getMonth() && now.getDate()<date.getDate())) age--;
          if (!Number.isFinite(age) || age>120 || age<0) return invalid(()=>T('access.portal.please_check_your_date_of_birth','Controleer uw geboortedatum.'));
          if (age<15) {
            invalid(()=>T('access.portal.you_can_create_this_account_from_age_15_you_can_explore_foundatio','U kunt dit account vanaf 15 jaar aanmaken. U kunt wel FoundationOS ontdekken.'));
            el('agFoundation').hidden=false; return;
          }
        }
        draft[s.key]=value; step++; render('register',true); return;
      }
      if (view === 'login') { accountName=value; render('password',true); return; }
      if ((view === 'register' || view === 'reset') && value.length<6) return invalid(()=>T('access.portal.use_a_password_of_at_least_six_characters','Gebruik een wachtwoord van minstens zes tekens.'));
      if (view === 'reset' && el('agCode').value && !el('agCode').checkValidity()) {
        message(()=>T('access.portal.the_text_message_code_has_six_digits','De sms-code bestaat uit zes cijfers.'),true); el('agCode').focus(); return;
      }
      waiting(true);
      message(()=>T('access.portal.one_moment_we_are_processing_your_request','Een ogenblik, we verwerken uw verzoek.'));
      try {
        if (view === 'register') {
          const result=await login('rtg',{register:true,name:draft.name,u:draft.email,geboortedatum:draft.geboortedatum,p:value,tier:'guest',portal:true});
          if (result) { Object.keys(draft).forEach(key=>{draft[key]='';}); inp.value=''; }
        } else if (view === 'password') {
          const result=await login('rtg',{u:accountName,p:value});
          inp.value='';
          if (result && result.tweedeFactorNodig) { secondProof=result.bewijs; render('second',true); }
        } else if (view === 'second') {
          const result=await accessRequest('identity.second_factor.verify',{bewijs:secondProof,code:value});
          secondProof=''; inp.value=''; await login('rtg',{response:result});
        } else if (view === 'forgot') {
          await accessRequest('identity.recovery.request',{email:value}); render('sent',true);
        } else if (view === 'reset') {
          await accessRequest('identity.password.replace',{token:resetToken,code:el('agCode').value.trim(),password:value});
          resetToken=''; const url=new URL(location.href); url.searchParams.delete('reset');
          history.replaceState(null,'',url.pathname+url.search+url.hash);
          render('login',true); message(()=>T('access.portal.your_password_has_been_changed_you_can_now_sign_in','Uw wachtwoord is gewijzigd. U kunt nu inloggen.'));
        }
      } catch(e) {
        el('agStatus').textContent='';
        message(()=>e && e.status ? e.message : T('access.portal.we_could_not_connect_your_details_are_still_here_please_try_again','We konden geen verbinding maken. Uw ingevulde gegevens blijven staan. Probeer het opnieuw.'),true);
      } finally {
        waiting(false);
        if (!form.hidden && gate.style.display !== 'none') inp.focus({preventScroll:true});
      }
    }
    form.addEventListener('submit',event=>{event.preventDefault();submit();});
    el('agPasskey').addEventListener('click',passkeyLogin);
    el('agAnders').addEventListener('click',()=>render('login',true));
    el('agNieuw').addEventListener('click',()=>{step=0;render('register',true);});
    el('agForgot').addEventListener('click',()=>render('forgot',true));
    el('agShowPassword').addEventListener('click',()=>{
      const shown=inp.type==='password'; inp.type=shown?'text':'password';
      el('agShowPassword').setAttribute('aria-pressed',String(shown));
      el('agShowPassword').textContent=shown?T('access.portal.hide_password','Verberg wachtwoord'):T('access.portal.show_password','Toon wachtwoord');
    });
    el('agBack').addEventListener('click',()=>{
      if (busy) return;
      if (view==='register' && step>0) {
        if (step<3) draft[steps()[step].key]=inp.value;
        step--; render('register',true);
      } else if (view==='password' || view==='second' || view==='forgot' || view==='sent') {
        secondProof=''; render('login',true);
      } else { Object.keys(draft).forEach(key=>{draft[key]='';}); render('welcome',true); }
    });
    window.addEventListener('rtglang',()=>{ if (gate.style.display !== 'none') render(view,false,true); });
    render(resetToken?'reset':'welcome',false);
  })();
