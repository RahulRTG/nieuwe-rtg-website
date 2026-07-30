  /* Onderaan: wanneer dit bord voor het laatst veranderde. Klein, maar het
     beantwoordt de vraag die mensen echt stellen ("stond dat altijd al zo?"). */
  function tekenVoet() {
    var doel = $('bord');
    var v = document.createElement('p'); v.className = 'rtg-voet';
    v.textContent = bordNu.gewijzigd
      ? T('bo.gewijzigd', 'Laatst gewijzigd op') + ' ' + datum(bordNu.gewijzigd) + '.'
      : T('bo.nooit', 'Je hebt hier nog niets omgezet; alles staat op de standaard.');
    doel.appendChild(v);
    /* Werk je voor een bedrijf, dan mag dat bedrijf functies op dit bord
       dichtzetten. Dat hoort er te staan voordat je het tegenkomt, niet pas
       als je op een grijze knop drukt -- en met de regel erbij, want die is de
       reden dat dit veilig is. */
    if (werkgevers && werkgevers.length) {
      var w = document.createElement('p'); w.className = 'rtg-voet';
      w.textContent = werkgevers.map(function (x) { return x.naam; }).join(', ') + ': ' +
        T('bo.werkgever', 'je werkgever kan functies op dit bord dichtzetten, nooit openzetten.');
      doel.appendChild(w);
    }
    var log = document.createElement('section'); log.className = 'rtg-groep';
    var h = document.createElement('h2'); h.textContent = T('bo.spoor', 'Wat er is veranderd'); log.appendChild(h);
    var gu = document.createElement('div'); gu.className = 'rtg-uitleg';
    gu.textContent = T('bo.spoor.sub', 'Elke omzetting op dit bord, met wie hem deed. Dit spoor is van jou en gaat mee in je gegevens-download.');
    log.appendChild(gu);
    var lijst = document.createElement('div'); lijst.id = 'logboek';
    var laden = document.createElement('p'); laden.className = 'rtg-uitleg'; laden.textContent = T('bo.spoor.laden', 'Logboek laden...');
    lijst.appendChild(laden);
    log.appendChild(lijst);
    doel.appendChild(log);
  }

  function datum(iso) {
    var d = new Date(iso);
    if (isNaN(d.getTime())) return iso;
    return d.toLocaleString(taal() === 'nl' ? 'nl-NL' : taal(), { day: 'numeric', month: 'long', hour: '2-digit', minute: '2-digit' });
  }

  function laadLogboek() {
    post('/api/member/boardroom/logboek', { max: 25 }).then(function (r) {
      var doel = $('logboek'); if (!doel) return;
      var regels = (r.d && r.d.logboek) || [];
      doel.textContent = '';
      if (!regels.length) {
        var leeg = document.createElement('p'); leeg.className = 'rtg-uitleg';
        leeg.textContent = T('bo.spoor.leeg', 'Nog niets omgezet.');
        doel.appendChild(leeg); return;
      }
      regels.forEach(function (r2) {
        var rij2 = document.createElement('div'); rij2.className = 'rtg-logrij';
        var wat = (r2.wijzigingen || []).map(function (w) {
          return w.naam + ' ' + T(w.naar ? 'bo.aanwoord' : 'bo.uitwoord', w.naar ? 'aan' : 'uit');
        }).join(', ');
        var b = document.createElement('b'); b.textContent = wat || 'gewijzigd';
        rij2.appendChild(b);
        var m = document.createElement('span');
        m.textContent = datum(r2.at) + ' · ' + (r2.door === 'ouder'
          ? T('bo.doorouder', 'door je ouder/beheerder') : T('bo.doorjou', 'door jou'));
        rij2.appendChild(m);
        doel.appendChild(rij2);
      });
    }).catch(function () { /* het logboek is bijzaak; het bord staat er al */ });
  }

  function laad() {
    if (!token()) { $('melding').textContent = T('bo.nulogin', 'Log in als lid om je boardroom te zien.'); return; }
    post('/api/member/boardroom', {}).then(function (r) {
      if (r.status !== 200 || !r.d.bord) {
        $('melding').textContent = (r.d && r.d.error) || T('bo.geenbord', 'Je boardroom is er alleen voor leden met een account.');
        return;
      }
      bordNu = r.d.bord;
      werkgevers = r.d.werkgevers || [];
      teken();
    }).catch(function () { $('melding').textContent = T('bo.nietgeladen', 'Kon de boardroom niet laden.'); });
  }

  document.addEventListener('DOMContentLoaded', laad);
  /* Wisselt de lezer van taal, dan halen we het bord opnieuw op: de namen van
     de functies komen van de server, dus alleen de pagina hertalen is niet
     genoeg. De i18n-laag zendt hiervoor 'rtglang'. */
  window.addEventListener('rtglang', function () { if (token()) laad(); });
})();
