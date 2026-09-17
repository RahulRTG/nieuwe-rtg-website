/* Team access uses the same canvas and Edge as the member portal. Labels are
   translated in place: no rerender may erase credentials or repeat a request. */
  function teamText(key, source){
    return '<span data-i18n="'+esc(key)+'" data-i18n-source="'+esc(source)+'">'+esc(T(key, source))+'</span>';
  }
  function teamField(id, key, source, type, attributes){
    return '<label class="access-field" for="'+id+'">'+teamText(key, source)+
      '<input id="'+id+'" type="'+type+'" '+attributes+'></label>';
  }
  function teamBack(id){
    return '<button class="access-secondary access-back" id="'+id+'" type="button">'+teamText('pd.back','Terug')+'</button>';
  }
  function teamAccessView(view, key, title, descriptionKey, description){
    $('#gate').dataset.accessView = view;
    $('#teamAccessTitle').innerHTML = teamText(key, title);
    $('#teamAccessDescription').innerHTML = teamText(descriptionKey, description);
    $('#gate').scrollTop = 0;
  }
  function formulierLogin(){
    $('#gateStep').innerHTML =
      '<form class="lform" id="loginForm" autocomplete="on">'+
        teamField('liUser', 'pd.li.user', 'E-mail of gebruikersnaam', 'text', 'autocomplete="username" autocapitalize="none" spellcheck="false" required')+
        teamField('liPass', 'pd.li.pass', 'Wachtwoord', 'password', 'autocomplete="current-password" required')+
        '<div class="access-error" id="liErr" role="alert" data-i18n-ignore></div>'+
        '<button class="access-primary" type="submit">'+teamText('pd.access.logingo','Ga verder naar mijn werkplek.')+'</button>'+
      '</form><div class="llinks">'+
        '<button class="access-link" id="toJoin" type="button">'+teamText('pd.access.joinlink','Ik wil mij aanmelden bij een bedrijf.')+'</button>'+
        '<button class="access-link" id="toForgot" type="button">'+teamText('pd.access.forgotlink','Ik ben mijn wachtwoord vergeten.')+'</button>'+
        '<button class="access-link" id="toDevice" type="button">'+teamText('pd.access.devicelink','Ik gebruik een apparaat op mijn werkplek.')+'</button>'+
      '</div>';
    $('#loginForm').addEventListener('submit', async e => {
      e.preventDefault();
      $('#liErr').textContent = '';
      const btn = e.target.querySelector('button[type="submit"]'); btn.disabled = true;
      try { await mijnLogin($('#liUser').value.trim(), $('#liPass').value); }
      catch(err){ $('#liErr').textContent = err.message || T('pd.badlogin','Onjuiste inloggegevens.'); btn.disabled = false; }
    });
    $('#toJoin').addEventListener('click', stepAanmelden);
    $('#toForgot').addEventListener('click', stepForgot);
    $('#toDevice').addEventListener('click', stepSector);
  }
