/* Refresh only presentation during a language change; identity stays in memory. */
    function refreshChrome(){
      el('agLanguageNotice').textContent=T('access.portal.language_notice','Sommige bevestigingen worden in het Engels getoond. Uw acties en bevoegdheden blijven gelijk.');
      el('agLanguageNotice').hidden=RTGAccessMeaning.criticalLanguages.includes(lang());
      el('agPasskey').dataset.rtgMeaning='identity.passkey.verify';
      gate.setAttribute('aria-label',T('access.portal.sign_in','Log in'));
      gate.querySelector(".access-brand small").textContent=T("access.portal.secure_access","VEILIGE TOEGANG");
      gate.querySelector("#agBack").textContent=T("access.portal.back","Terug");
      gate.querySelector("#agPasskey span").textContent=T("access.portal.continue_with_a_passkey","Verder met passkey");
      gate.querySelector(".access-hint").textContent=T("access.portal.you_use_your_device_s_security","U gebruikt de beveiliging van uw apparaat.");
      gate.querySelector("#agAnders span").textContent=T("access.portal.another_way","Andere manier");
      gate.querySelector(".access-new>span").textContent=T("access.portal.are_you_new_to_rtg","Bent u nieuw bij RTG?");
      gate.querySelector("#agNieuw").textContent=T("access.portal.create_your_rtg","Maak uw RTG");
      gate.querySelector("#agCodeLabel>span").textContent=T("access.portal.text_message_code_if_you_received_one","Sms-code, als u die heeft ontvangen");
      gate.querySelector("#agSummary summary").textContent=T("access.portal.review_your_details","Controleer uw gegevens");
      gate.querySelector("#agForgot").textContent=T("access.portal.forgot_your_password","Wachtwoord vergeten");
      gate.querySelector("#agFoundation").textContent=T("access.portal.explore_foundationos_it_is_and_always_will_be_100_free","Ontdek FoundationOS. Dit is en blijft altijd 100% gratis.");
      if (interests && interests.length) {
        el('agExperience').textContent=T('access.portal.explored','U verkende {worlds}. Dit wordt hier getoond en niet in uw account opgeslagen.').replace('{worlds}',interests.join(', '));
        el('agExperience').hidden=false;
      }
    }
