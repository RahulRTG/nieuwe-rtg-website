    /* Each question is a full sentence; labels and keyboard hints stay explicit. */
    const steps = () => [
      { key:'name', type:'text', auto:'name', label:T('access.portal.full_name','Volledige naam'),
        title:T('access.portal.what_is_your_name','Hoe mogen we u noemen?'),
        text:T('access.portal.enter_your_full_name_we_use_it_for_your_account_and_the_agreement','Vul uw volledige naam in. We gebruiken deze voor uw account en de overeenkomst.') },
      { key:'email', type:'email', auto:'email', label:T('access.portal.email_address','E-mailadres'),
        title:T('access.portal.which_email_address_can_we_reach_you_at','Op welk adres kunnen we u bereiken?'),
        text:T('access.portal.you_use_this_email_address_to_sign_in_and_recover_your_account','U gebruikt dit e-mailadres om in te loggen en uw account te herstellen.') },
      { key:'geboortedatum', type:'date', auto:'bday', label:T('access.portal.date_of_birth','Geboortedatum'),
        title:T('access.portal.what_is_your_date_of_birth','Wat is uw geboortedatum?'),
        text:T('access.portal.your_age_determines_which_features_you_can_use_you_must_be_at_lea','Uw leeftijd bepaalt welke onderdelen u kunt gebruiken. Voor dit account moet u minimaal 15 jaar zijn.') },
      { key:'password', type:'password', auto:'new-password', label:T('access.portal.password','Wachtwoord'),
        title:T('access.portal.how_would_you_like_to_secure_your_account','Hoe wilt u uw account beveiligen?'),
        text:T('access.portal.choose_a_unique_password_of_at_least_six_characters_you_are_creat','Kies een uniek wachtwoord van minstens zes tekens. U maakt een gratis account aan; een betaalde pas kiest u apart. Daarna leest en bevestigt u de overeenkomst.') }
    ];
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
      el('agSummary').hidden = view !== 'register' || step !== 3;
      el('agCodeLabel').hidden = view !== 'reset'; el('agForgot').hidden = view !== 'password';
      el('agFoundation').hidden = true;
      el('agGo').textContent = T('access.portal.continue','Ga verder');
      if (view === 'welcome') {
        title.textContent = T('access.portal.welcome_intro','Welkom in uw');
        title.appendChild(document.createElement('br'));
        const brand = document.createElement('em'); brand.textContent=T('access.portal.brand','RTG.'); title.appendChild(brand);
        el('agZin').textContent = T('access.portal.one_place_for_life_travel_work_and_opportunity','Eén toegang tot uw leven, reizen, werk en kansen.');
      } else if (view === 'register') {
        const s = steps()[step]; title.textContent = s.title; el('agZin').textContent = s.text;
        el('agStappen').textContent = T('access.portal.progress','Stap {step} van 4').replace('{step}',String(step+1));
        field(s.type, s.label, s.auto, draft[s.key]);
        if (step === 3) {
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
      const action={password:'identity.session.open',second:'identity.second_factor.verify',forgot:'identity.recovery.request',reset:'identity.password.replace'}[view] || (view==='register' && step===3?'identity.account.create':'');
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
