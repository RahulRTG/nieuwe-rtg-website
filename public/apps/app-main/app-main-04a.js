/* Aanmeldformulier en de progressieve accountstappen. */

    let presentationOnly=false;
    function field(type, label, auto, value){
      if(!presentationOnly){inp.type = type; inp.value = value || '';} inp.name = auto || 'answer';
      inp.autocomplete = auto || 'off'; inp.inputMode = type === 'email' ? 'email' : 'text';
      inp.autocapitalize = auto === 'name' ? 'words' : 'none'; inp.spellcheck = false;
      inp.maxLength = type === 'password' ? 200 : type === 'email' ? 254 : 80;
      inp.removeAttribute('min'); inp.removeAttribute('max'); inp.removeAttribute('minlength');
      if (type === 'date') {
        const now = new Date(), oldest = new Date(now.getFullYear()-120, now.getMonth(), now.getDate());
        const iso = d => d.getFullYear() + '-' + String(d.getMonth()+1).padStart(2,'0') + '-' + String(d.getDate()).padStart(2,'0');
        inp.max = iso(now); inp.min = iso(oldest);
      }
      if (type === 'password' && auto === 'new-password') inp.minLength = 6;
      inp.placeholder = ''; inp.setAttribute('aria-label', label);
      el('agFieldLabel').textContent = label;
      el('agShowPassword').hidden = type !== 'password';
      el('agShowPassword').textContent = T('access.portal.show_password','Toon wachtwoord');
      el('agShowPassword').setAttribute('aria-pressed','false');
    }
    function render(next, focus, preserve){
      const saved = preserve ? {value:inp.value,code:el('agCode').value,type:inp.type,shown:el('agShowPassword').getAttribute('aria-pressed'),invalid:inp.getAttribute('aria-invalid'),foundation:!el('agFoundation').hidden} : null;
      if (!preserve && passkeyAbort) { passkeyAbort.abort(); passkeyAbort = null; passkeyAttempt++; }
      presentationOnly=!!preserve;
      view = next; gate.dataset.accessView = view;
      refreshChrome();
      if (!preserve) lastMessage = null;
      if(!preserve){inp.value = ''; el('agCode').value = ''; inp.removeAttribute('aria-invalid');}
      el('agError').textContent = ''; el('agStatus').textContent = '';
      el('agWelcome').hidden = view !== 'welcome'; form.hidden = view === 'welcome' || view === 'sent';
      el('agBack').hidden = view === 'welcome'; el('agStappen').hidden = view !== 'register';
      el('agSummary').hidden = view !== 'register' || step !== 5;
      el('agPersonal').hidden = true;
      el('agCodeLabel').hidden = view !== 'reset'; el('agForgot').hidden = view !== 'password';
      el('agFoundation').hidden = true;
      el('agGo').textContent = T('access.portal.continue','Ga verder');
      if (view === 'welcome') {
        title.textContent = T('access.portal.welcome_intro','Welkom bij');
        title.appendChild(document.createElement('br'));
        const brand = document.createElement('em'); brand.textContent=T('access.portal.brand','RTG.'); title.appendChild(brand);
        el('agZin').textContent = T('access.portal.one_place_for_life_travel_work_and_opportunity','Eén account voor RTG, Connect, Travel en Work.');
      } else if (view === 'register') {
        const reeks=steps(), s = reeks[step]; title.textContent = s.title; el('agZin').textContent = s.text;
        el('agStappen').textContent = T('access.portal.progress_total','Stap {step} van {total}')
          .replace('{step}',String(step+1)).replace('{total}',String(reeks.length));
        el('agLabel').hidden=!!s.kind;
        if(s.kind){el('agShowPassword').hidden=true;personalKeuzes(s);if(s.kind==='layout')personalPreview();}
        else field(s.type, s.label, s.auto, draft[s.key]);
        if (step === 5) {
          el('agGo').textContent = T('access.portal.create_my_account','Maak mijn account aan');
          const review = el('agReview'); review.textContent = '';
          steps().slice(0,3).forEach((s,i) => {
            const button = document.createElement('button'); button.type = 'button'; button.className = 'access-secondary';
            button.setAttribute('data-user-content','');
            button.textContent = s.label + ': ';
            const value=document.createElement('bdi'); value.textContent=draft[s.key]; button.appendChild(value);
            button.appendChild(document.createTextNode(T('access.portal.edit',', wijzigen')));
            button.addEventListener('click', () => { step=i; render('register',true); });
            review.appendChild(button);
          });
          const p=document.createElement('p'); p.textContent=T('personalos.onboarding.review','Uw RTG: {goals} · {layout}')
            .replace('{goals}',draft.goals.map(function(x){return personalGoalLabel(x)}).join(', ')).replace('{layout}',personalLayoutLabel(draft.layout)); review.appendChild(p);
        }
      } else {
        const copy = {
          login:[T('access.portal.welcome_back','Welkom terug.'),T('access.portal.enter_your_email_address_or_username_we_will_then_ask_for_your_pa','Vul uw e-mailadres of gebruikersnaam in. Daarna vragen we om uw wachtwoord.'),'text',T('access.portal.email_address_or_username','E-mailadres of gebruikersnaam'),'username',accountName],
          password:[T('access.portal.open_your_rtg','Open uw RTG.'),T('access.portal.enter_your_password_to_continue_securely','Vul uw wachtwoord in om veilig verder te gaan.'),'password',T('access.portal.password','Wachtwoord'),'current-password',''],
          second:[T('access.portal.confirm_it_is_you','Bevestig dat u het bent.'),T('access.portal.enter_the_code_from_your_authenticator_app_or_one_of_your_recover','Vul de code uit uw authenticator-app of een van uw herstelcodes in.'),'text',T('access.portal.verification_code','Verificatiecode'),'one-time-code',''],
          forgot:[T('access.portal.let_us_help_you_get_back_in','We helpen u weer op weg.'),T('access.portal.enter_your_account_email_address_if_recovery_is_available_you_wil','Vul het e-mailadres van uw account in. Als herstel mogelijk is, ontvangt u daar de vervolgstappen.'),'email',T('access.portal.email_address','E-mailadres'),'email',accountName.includes('@')?accountName:''],
          reset:[T('access.portal.choose_a_new_password','Kies een nieuw wachtwoord.'),T('access.portal.use_at_least_six_characters_if_you_also_received_a_text_message_c','Gebruik minstens zes tekens. Heeft u ook een sms-code ontvangen? Vul die dan hieronder in. Zonder ontvangen sms-code laat u dat veld leeg.'),'password',T('access.portal.new_password','Nieuw wachtwoord'),'new-password',''],
          sent:[T('access.portal.check_your_email','Controleer uw e-mail.'),T('access.portal.if_this_address_belongs_to_an_account_and_recovery_is_available_y','Als dit adres bij een account hoort en herstel mogelijk is, ontvangt u de vervolgstappen per e-mail. Kijk ook in uw ongewenste e-mail.'),'email','','off','']
        }[view];
        title.textContent = copy[0]; el('agZin').textContent = copy[1]; field(copy[2],copy[3],copy[4],copy[5]);
        if (view === 'password' || view === 'second') el('agGo').textContent = T('access.portal.sign_in','Log in');
        if (view === 'forgot') el('agGo').textContent = T('access.portal.request_recovery','Vraag herstel aan');
        if (view === 'reset') el('agGo').textContent = T('access.portal.save_my_password','Sla mijn wachtwoord op');
      }
      if(view!=='register')el('agLabel').hidden=false;
      const action={password:'identity.session.open',second:'identity.second_factor.verify',forgot:'identity.recovery.request',reset:'identity.password.replace'}[view] || (view==='register' && step===5?'identity.account.create':'');
      el('agGo').dataset.rtgMeaning=action;
      if (saved) {
        // Do not rewrite a focused input: it would collapse its selection or IME composition.
        el('agShowPassword').setAttribute('aria-pressed',saved.shown);
        el('agShowPassword').textContent=saved.shown==='true'?T('access.portal.hide_password','Verberg wachtwoord'):T('access.portal.show_password','Toon wachtwoord');
        if(saved.invalid) inp.setAttribute('aria-invalid',saved.invalid);
        el('agFoundation').hidden=!saved.foundation;
        if(lastMessage) message(lastMessage.text,lastMessage.error);
      }
      presentationOnly=false;
      if (focus) { if (!form.hidden) inp.focus({preventScroll:true}); else title.focus({preventScroll:true}); gate.scrollTop=0; }
    }
