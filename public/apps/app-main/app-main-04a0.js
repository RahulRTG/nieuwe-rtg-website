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
      { key:'goals', kind:'goals', title:T('personalos.onboarding.goals.title','Wat wilt u als eerste bereiken?'),
        text:T('personalos.onboarding.goals.text','Kies een of meer doelen. Dit bepaalt alleen de indeling van uw RTG, nooit uw rechten of toegang.') },
      { key:'layout', kind:'layout', title:T('personalos.onboarding.layout.title','Hoe wilt u RTG gebruiken?'),
        text:T('personalos.onboarding.layout.text','Kies een rustige, gebalanceerde of uitgebreide weergave en bekijk direct de openbare preview.') },
      { key:'password', type:'password', auto:'new-password', label:T('access.portal.password','Wachtwoord'),
        title:T('access.portal.how_would_you_like_to_secure_your_account','Hoe wilt u uw account beveiligen?'),
        text:T('access.portal.choose_a_unique_password_of_at_least_six_characters_you_are_creat','Kies een uniek wachtwoord van minstens zes tekens. U maakt een gratis account aan; een betaalde pas kiest u apart. Daarna leest en bevestigt u de overeenkomst.') }
    ];
