/* Personeel, deel 3b: het oude inlogFORMULIER, nog als vangnet.
   De gewone ingang is het gesprek met Rahul (deel 3). Dit blok staat er
   voor het geval shared/rahulpoort.js niet geladen is; zonder inlogscherm
   zou de app onbruikbaar zijn en dat risico nemen we niet. Deelt de
   IIFE-scope met de andere delen. */
  // Het oude formulier, nog als vangnet (zie stepLogin).
  function formulierLogin(){
    $('#gateStep').innerHTML =
      '<form class="lform" id="loginForm" autocomplete="on">'+
        '<input id="liUser" type="text" autocomplete="username" placeholder="'+T('pd.li.user','E-mail of gebruikersnaam')+'" aria-label="'+T('pd.li.user','E-mail of gebruikersnaam')+'">'+
        '<input id="liPass" type="password" autocomplete="current-password" placeholder="'+T('pd.li.pass','Wachtwoord')+'" aria-label="'+T('pd.li.pass','Wachtwoord')+'">'+
        '<div class="err" id="liErr" role="alert"></div>'+
        '<button class="prim" type="submit">'+T('pd.login','Inloggen')+'</button>'+
      '</form>'+
      '<div class="llinks">'+
        '<button class="llink" id="toJoin" type="button">'+T('pd.aanmelden','Aanmelden bij een bedrijf')+'</button>'+
        '<button class="llink" id="toForgot" type="button">'+T('pd.forgot','Wachtwoord vergeten?')+'</button>'+
        '<button class="llink" id="toDevice" type="button">'+T('pd.ondevice','Vast apparaat? Inloggen met naam en pincode')+'</button>'+
      '</div>';
    $('#loginForm').addEventListener('submit', async e => {
      e.preventDefault();
      $('#liErr').textContent = '';
      const btn = e.target.querySelector('button.prim'); btn.disabled = true;
      try { await mijnLogin($('#liUser').value.trim(), $('#liPass').value); }
      catch(err){ $('#liErr').textContent = err.message || T('pd.badlogin','Onjuiste inloggegevens.'); btn.disabled = false; }
    });
    $('#toJoin').addEventListener('click', stepAanmelden);
    $('#toForgot').addEventListener('click', stepForgot);
    $('#toDevice').addEventListener('click', stepSector);
    $('#liUser').focus();
  }
