/* De openbare voordeur van School Partner: een inlogmail aanvragen en een
   fragmentlink bewust inwisselen. Het geheim verdwijnt meteen uit de adresbalk
   en komt nooit in permanente opslag; pas het API-antwoord gaat naar de door
   app.js beheerde tabsessie. */
(function () {
  'use strict';
  function bind(api, open, esc, meld) {
    var code=document.getElementById('mailCode'), email=document.getElementById('mailAdres');
    document.getElementById('mailGa').addEventListener('click', function () {
      if (!code.value.trim() || !email.value.trim()) return meld('Vul de schoolcode en je schoolmail in.');
      api('/school/personeel/inloglink', { schoolCode:code.value.trim().toUpperCase(), email:email.value.trim() })
        .then(function (r) { meld(r.body.error || r.body.bericht || 'Controleer je schoolmail.'); });
    });
    ['mailCode','mailAdres'].forEach(function (id) {
      document.getElementById(id).addEventListener('keydown', function (e) { if (e.key === 'Enter') document.getElementById('mailGa').click(); });
    });
    var m=/^#(uitnodiging|inloggen)=(.+)$/.exec(location.hash), vak=document.getElementById('linkBevestiging');
    if (!m) return false;
    var soort=m[1], geheim='';
    try { geheim=decodeURIComponent(m[2]); } catch (e) {}
    history.replaceState(null, '', location.pathname);
    vak.hidden=false; vak.innerHTML='<div class="kop">Persoonlijke schooltoegang controleren</div><p class="stil">Even controleren voor deze eenmalige link wordt gebruikt.</p>';
    if (!geheim) { vak.innerHTML+='<p class="stil">Deze link is beschadigd.</p>'; return true; }
    if (soort === 'uitnodiging') {
      api('/school/personeel/uitnodiging/bekijk', { uitnodiging:geheim }).then(function (r) {
        var u=r.body.uitnodiging;
        if (!u) { vak.innerHTML='<div class="kop">Uitnodiging niet beschikbaar</div><p class="stil">' + esc(r.body.error || 'Vraag de directie om een nieuwe uitnodiging.') + '</p>'; return; }
        vak.innerHTML='<div class="kop">Uitnodiging van ' + esc(u.school.naam) + '</div><p>Voor <b>' + esc(u.naam) + '</b> · ' + esc(u.email) + '</p>' +
          '<p class="stil">Rollen: ' + (u.rollen || []).map(esc).join(', ') + '. Controleer dit vóór je accepteert.</p>' +
          '<button class="knop p" id="linkOpen" type="button">Accepteer en open mijn werkruimte</button>';
        document.getElementById('linkOpen').addEventListener('click', function () {
          api('/school/personeel/uitnodiging/accepteer', { uitnodiging:geheim })
            .then(function (x) { if (x.body.error) return meld(x.body.error); vak.hidden=true; open(x.body); });
        });
      });
    } else {
      vak.innerHTML='<div class="kop">Eenmalige inloglink</div><p class="stil">Deze link werkt één keer en opent alleen de rollen die de directie heeft toegewezen.</p>' +
        '<button class="knop p" id="linkOpen" type="button">Open mijn werkruimte</button>';
      document.getElementById('linkOpen').addEventListener('click', function () {
        api('/school/personeel/inlog/accepteer', { inlog:geheim })
          .then(function (x) { if (x.body.error) return meld(x.body.error); vak.hidden=true; open(x.body); });
      });
    }
    return true;
  }
  window.RTGSchoolToegang={ bind:bind };
})();
