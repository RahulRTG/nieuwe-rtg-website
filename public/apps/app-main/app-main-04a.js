    /* Each question is a full sentence; labels and keyboard hints stay explicit. */
    const steps = [
      { key:'name', type:'text', auto:'name', label:tx('Volledige naam','Full name'),
        title:tx('Hoe mogen we u noemen?','What is your name?'),
        text:tx('Vul uw volledige naam in. We gebruiken deze voor uw account en de overeenkomst.','Enter your full name. We use it for your account and the agreement.') },
      { key:'email', type:'email', auto:'email', label:tx('E-mailadres','Email address'),
        title:tx('Op welk adres kunnen we u bereiken?','Which email address can we reach you at?'),
        text:tx('U gebruikt dit e-mailadres om in te loggen en uw account te herstellen.','You use this email address to sign in and recover your account.') },
      { key:'geboortedatum', type:'date', auto:'bday', label:tx('Geboortedatum','Date of birth'),
        title:tx('Wat is uw geboortedatum?','What is your date of birth?'),
        text:tx('Uw leeftijd bepaalt welke onderdelen u kunt gebruiken. Voor dit account moet u minimaal 15 jaar zijn.','Your age determines which features you can use. You must be at least 15 to create this account.') },
      { key:'password', type:'password', auto:'new-password', label:tx('Wachtwoord','Password'),
        title:tx('Hoe wilt u uw account beveiligen?','How would you like to secure your account?'),
        text:tx('Kies een uniek wachtwoord van minstens zes tekens. U maakt een gratis account aan; een betaalde pas kiest u apart. Daarna leest en bevestigt u de overeenkomst.','Choose a unique password of at least six characters. You are creating a free account; paid passes are a separate choice. You will then read and confirm the agreement.') }
    ];
    function field(type, label, auto, value){
      inp.type = type; inp.value = value || ''; inp.name = auto || 'answer';
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
      el('agShowPassword').textContent = tx('Toon wachtwoord','Show password');
      el('agShowPassword').setAttribute('aria-pressed','false');
    }
    function render(next, focus){
      if (passkeyAbort) { passkeyAbort.abort(); passkeyAbort = null; passkeyAttempt++; }
      view = next; gate.dataset.accessView = view;
      inp.value = ''; el('agCode').value = ''; inp.removeAttribute('aria-invalid');
      el('agError').textContent = ''; el('agStatus').textContent = '';
      el('agWelcome').hidden = view !== 'welcome'; form.hidden = view === 'welcome' || view === 'sent';
      el('agBack').hidden = view === 'welcome'; el('agStappen').hidden = view !== 'register';
      el('agSummary').hidden = view !== 'register' || step !== 3;
      el('agCodeLabel').hidden = view !== 'reset'; el('agForgot').hidden = view !== 'password';
      el('agFoundation').hidden = true;
      el('agGo').textContent = tx('Ga verder','Continue');
      if (view === 'welcome') {
        title.innerHTML = tx('Welkom<br>in uw<br><em>RTG.</em>','Welcome<br>to your<br><em>RTG.</em>');
        el('agZin').textContent = tx('Eén toegang tot uw leven, reizen, werk en kansen.','One place for life, travel, work and opportunity.');
      } else if (view === 'register') {
        const s = steps[step]; title.textContent = s.title; el('agZin').textContent = s.text;
        el('agStappen').textContent = tx('Stap ','Step ') + (step + 1) + tx(' van 4',' of 4');
        field(s.type, s.label, s.auto, draft[s.key]);
        if (step === 3) {
          el('agGo').textContent = tx('Maak mijn account aan','Create my account');
          const review = el('agReview'); review.textContent = '';
          steps.slice(0,3).forEach((s,i) => {
            const button = document.createElement('button'); button.type = 'button'; button.className = 'access-secondary';
            button.textContent = s.label + ': ' + draft[s.key] + tx(', wijzigen',', edit');
            button.addEventListener('click', () => { step=i; render('register',true); });
            review.appendChild(button);
          });
        }
      } else {
        const copy = {
          login:[tx('Welkom terug.','Welcome back.'),tx('Vul uw e-mailadres of gebruikersnaam in. Daarna vragen we om uw wachtwoord.','Enter your email address or username. We will then ask for your password.'),'text',tx('E-mailadres of gebruikersnaam','Email address or username'),'username',accountName],
          password:[tx('Open uw RTG.','Open your RTG.'),tx('Vul uw wachtwoord in om veilig verder te gaan.','Enter your password to continue securely.'),'password',tx('Wachtwoord','Password'),'current-password',''],
          second:[tx('Bevestig dat u het bent.','Confirm it is you.'),tx('Vul de code uit uw authenticator-app of een van uw herstelcodes in.','Enter the code from your authenticator app or one of your recovery codes.'),'text',tx('Verificatiecode','Verification code'),'one-time-code',''],
          forgot:[tx('We helpen u weer op weg.','Let us help you get back in.'),tx('Vul het e-mailadres van uw account in. Als herstel mogelijk is, ontvangt u daar de vervolgstappen.','Enter your account email address. If recovery is available, you will receive the next steps there.'),'email',tx('E-mailadres','Email address'),'email',accountName.includes('@')?accountName:''],
          reset:[tx('Kies een nieuw wachtwoord.','Choose a new password.'),tx('Gebruik minstens zes tekens. Heeft u ook een sms-code ontvangen? Vul die dan hieronder in. Zonder ontvangen sms-code laat u dat veld leeg.','Use at least six characters. If you also received a text message code, enter it below. Otherwise, leave that field empty.'),'password',tx('Nieuw wachtwoord','New password'),'new-password',''],
          sent:[tx('Controleer uw e-mail.','Check your email.'),tx('Als dit adres bij een account hoort en herstel mogelijk is, ontvangt u de vervolgstappen per e-mail. Kijk ook in uw ongewenste e-mail.','If this address belongs to an account and recovery is available, you will receive the next steps by email. Please also check your spam folder.'),'email','','off','']
        }[view];
        title.textContent = copy[0]; el('agZin').textContent = copy[1]; field(copy[2],copy[3],copy[4],copy[5]);
        if (view === 'password' || view === 'second') el('agGo').textContent = tx('Log in','Sign in');
        if (view === 'forgot') el('agGo').textContent = tx('Vraag herstel aan','Request recovery');
        if (view === 'reset') el('agGo').textContent = tx('Sla mijn wachtwoord op','Save my password');
      }
      if (focus) { if (!form.hidden) inp.focus({preventScroll:true}); else title.focus({preventScroll:true}); gate.scrollTop=0; }
    }
