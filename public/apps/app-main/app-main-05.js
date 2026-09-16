    /* Account access: validate the current step and submit through the existing auth routes. */
    function invalid(text){
      message(text,true); inp.focus();
    }
    async function submit(){
      if (busy) return;
      const value = inp.type === 'password' || el('agShowPassword').getAttribute('aria-pressed') === 'true' ? inp.value : inp.value.trim();
      inp.removeAttribute('aria-invalid'); el('agError').textContent='';
      if (!value || !inp.checkValidity()) return invalid(tx('Controleer dit veld en vul het volledig in.','Please check this field and complete it.'));
      if (view === 'register' && step < 3) {
        const s=steps[step];
        if (step === 1 && !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(value)) return invalid(tx('Vul een geldig e-mailadres in, bijvoorbeeld naam@voorbeeld.nl.','Enter a valid email address, such as name@example.com.'));
        if (step === 2) {
          const date=new Date(value+'T12:00:00'), now=new Date();
          let age=now.getFullYear()-date.getFullYear();
          if (now.getMonth()<date.getMonth() || (now.getMonth()===date.getMonth() && now.getDate()<date.getDate())) age--;
          if (!Number.isFinite(age) || age>120 || age<0) return invalid(tx('Controleer uw geboortedatum.','Please check your date of birth.'));
          if (age<15) {
            invalid(tx('U kunt dit account vanaf 15 jaar aanmaken. U kunt wel FoundationOS ontdekken.','You can create this account from age 15. You can explore FoundationOS.'));
            el('agFoundation').hidden=false; return;
          }
        }
        draft[s.key]=value; step++; render('register',true); return;
      }
      if (view === 'login') { accountName=value; render('password',true); return; }
      if ((view === 'register' || view === 'reset') && value.length<6) return invalid(tx('Gebruik een wachtwoord van minstens zes tekens.','Use a password of at least six characters.'));
      if (view === 'reset' && el('agCode').value && !el('agCode').checkValidity()) {
        message(tx('De sms-code bestaat uit zes cijfers.','The text message code has six digits.'),true); el('agCode').focus(); return;
      }
      waiting(true);
      message(tx('Een ogenblik, we verwerken uw verzoek.','One moment, we are processing your request.'));
      try {
        if (view === 'register') {
          const result=await login('rtg',{register:true,name:draft.name,u:draft.email,geboortedatum:draft.geboortedatum,p:value,tier:'guest',portal:true});
          if (result) { Object.keys(draft).forEach(key=>{draft[key]='';}); inp.value=''; }
        } else if (view === 'password') {
          const result=await login('rtg',{u:accountName,p:value});
          inp.value='';
          if (result && result.tweedeFactorNodig) { secondProof=result.bewijs; render('second',true); }
        } else if (view === 'second') {
          const result=await API.call('/auth/tweede',{bewijs:secondProof,code:value});
          secondProof=''; inp.value=''; await login('rtg',{response:result});
        } else if (view === 'forgot') {
          await API.call('/auth/forgot',{email:value}); render('sent',true);
        } else if (view === 'reset') {
          await API.call('/auth/reset',{token:resetToken,code:el('agCode').value.trim(),password:value});
          resetToken=''; const url=new URL(location.href); url.searchParams.delete('reset');
          history.replaceState(null,'',url.pathname+url.search+url.hash);
          render('login',true); message(tx('Uw wachtwoord is gewijzigd. U kunt nu inloggen.','Your password has been changed. You can now sign in.'));
        }
      } catch(e) {
        el('agStatus').textContent='';
        message(e && e.status ? e.message : tx('We konden geen verbinding maken. Uw ingevulde gegevens blijven staan. Probeer het opnieuw.','We could not connect. Your details are still here. Please try again.'),true);
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
      el('agShowPassword').textContent=shown?tx('Verberg wachtwoord','Hide password'):tx('Toon wachtwoord','Show password');
    });
    el('agBack').addEventListener('click',()=>{
      if (busy) return;
      if (view==='register' && step>0) {
        if (step<3) draft[steps[step].key]=inp.value;
        step--; render('register',true);
      } else if (view==='password' || view==='second' || view==='forgot' || view==='sent') {
        secondProof=''; render('login',true);
      } else { Object.keys(draft).forEach(key=>{draft[key]='';}); render('welcome',true); }
    });
    render(resetToken?'reset':'welcome',false);
  })();
