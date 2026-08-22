/* Persoonlijke schoolmail. De browser bewaart geen adressenboek en krijgt
   uitsluitend het postvak dat bij de persoonlijke personeelssleutel hoort. */
(function () {
  'use strict';
  function bind(api, sessie, esc, meld, rootId) {
    var root = document.getElementById(rootId);
    if (!root || root.dataset.mailGebonden === 'ja') return;
    root.dataset.mailGebonden = 'ja';
    var auth = function (extra) {
      return Object.assign({ schoolCode:sessie.code, personeelToken:sessie.token }, extra || {});
    };
    function berichtRij(m) {
      var veilig = m.veiligheid && m.veiligheid.integriteit;
      return '<button class="item knop" type="button" data-mail-id="' + esc(m.id) + '" style="width:100%;text-align:left;">' +
        '<span><b>' + esc(m.onderwerp || '(geen onderwerp)') + '</b><br><span class="stil">Van ' + esc(m.van) + '</span></span>' +
        '<span class="tag' + (veilig === 'ongeschonden' ? ' aan' : '') + '">' + esc(veilig === 'ongeschonden' ? 'integriteit geldig' : (veilig || 'oud bericht')) + '</span></button>';
    }
    function laadInbox() {
      api('/school/personeel/mail/inbox', auth()).then(function (r) {
        if (r.body.error) return meld(r.body.error);
        var lijst = root.querySelector('[data-mail-lijst]');
        lijst.innerHTML = (r.body.berichten || []).map(berichtRij).join('') || '<p class="stil">Je inbox is leeg.</p>';
        Array.prototype.forEach.call(lijst.querySelectorAll('[data-mail-id]'), function (b) {
          b.addEventListener('click', function () {
            api('/school/personeel/mail/lees', auth({ id:b.dataset.mailId })).then(function (rr) {
              if (rr.body.error) return meld(rr.body.error);
              var m=rr.body.bericht;
              root.querySelector('[data-mail-open]').innerHTML = '<div class="kaart" style="margin-top:.7rem;">' +
                '<div class="kop">' + esc(m.onderwerp || '(geen onderwerp)') + '</div><p class="stil">Van ' + esc(m.van) + ' · naar ' + esc(m.naar) + '</p>' +
                '<p style="white-space:pre-wrap;margin-top:.7rem;">' + esc(m.tekst || '') + '</p></div>';
            });
          });
        });
      });
    }
    api('/school/personeel/mail/overzicht', auth()).then(function (r) {
      if (r.body.error) { root.innerHTML='<div class="kaart"><p class="stil">' + esc(r.body.error) + '</p></div>'; return; }
      var hoofdAdres=r.body.publiekAdres || r.body.adres;
      var adresNoot=r.body.publiekAdres ? 'Publiek internetadres · intern ' + r.body.adres : 'Intern RTG-adres';
      root.innerHTML='<section class="kaart rtgdeel-vast"><div class="kop">Mijn RTG Mail</div>' +
        '<div class="item"><span><b>' + esc(hoofdAdres) + '</b><br><span class="stil">' + esc(adresNoot) + ' · ' + esc(r.body.ongelezen) + ' ongelezen</span></span>' +
        '<button class="knop" type="button" data-mail-inbox>Open inbox</button></div>' +
        '<p class="stil">' + esc(r.body.uitleg) + '</p>' +
        '<details style="margin-top:.7rem;"><summary class="knop">Nieuw bericht</summary><div class="rij" style="margin-top:.7rem;">' +
        '<input class="veld" data-mail-naar type="email" placeholder="Ontvanger" aria-label="Ontvanger">' +
        '<input class="veld" data-mail-onderwerp placeholder="Onderwerp" aria-label="Onderwerp"></div>' +
        '<textarea class="veld" data-mail-tekst rows="4" placeholder="Bericht" aria-label="Bericht" style="width:100%;margin-top:.5rem;"></textarea>' +
        '<button class="knop p" type="button" data-mail-stuur style="margin-top:.5rem;">Veilig versturen</button></details>' +
        '<div data-mail-lijst style="margin-top:.7rem;"></div><div data-mail-open></div></section>';
      root.querySelector('[data-mail-inbox]').addEventListener('click', laadInbox);
      root.querySelector('[data-mail-stuur]').addEventListener('click', function () {
        var naar=root.querySelector('[data-mail-naar]').value;
        var onderwerp=root.querySelector('[data-mail-onderwerp]').value;
        var tekst=root.querySelector('[data-mail-tekst]').value;
        api('/school/personeel/mail/stuur', auth({ naar:naar, onderwerp:onderwerp, tekst:tekst })).then(function (rr) {
          if (rr.body.error) return meld(rr.body.error);
          root.querySelector('[data-mail-tekst]').value='';
          meld(rr.body.buiten && !rr.body.echt ? 'Bericht staat veilig in de buitenpostwachtrij.' : 'Bericht veilig verstuurd.');
          laadInbox();
        });
      });
    });
  }
  window.RTGSchoolMail={ bind:bind };
})();
