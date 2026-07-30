  /* Onderaan: wanneer dit bord voor het laatst veranderde. Klein, maar het
     beantwoordt de vraag die mensen echt stellen ("stond dat altijd al zo?"). */
  function tekenVoet() {
    var doel = $('bord');
    var v = document.createElement('p'); v.className = 'rtg-voet';
    v.textContent = bordNu.gewijzigd
      ? 'Laatst gewijzigd op ' + datum(bordNu.gewijzigd) + '.'
      : 'Je hebt hier nog niets omgezet; alles staat op de standaard.';
    doel.appendChild(v);
    var log = document.createElement('section'); log.className = 'rtg-groep';
    var h = document.createElement('h2'); h.textContent = 'Wat er is veranderd'; log.appendChild(h);
    var gu = document.createElement('div'); gu.className = 'rtg-uitleg';
    gu.textContent = 'Elke omzetting op dit bord, met wie hem deed. Dit spoor is van jou en gaat mee in je gegevens-download.';
    log.appendChild(gu);
    var lijst = document.createElement('div'); lijst.id = 'logboek';
    var laden = document.createElement('p'); laden.className = 'rtg-uitleg'; laden.textContent = 'Logboek laden...';
    lijst.appendChild(laden);
    log.appendChild(lijst);
    doel.appendChild(log);
  }

  function datum(iso) {
    var d = new Date(iso);
    if (isNaN(d.getTime())) return iso;
    return d.toLocaleString('nl-NL', { day: 'numeric', month: 'long', hour: '2-digit', minute: '2-digit' });
  }

  function laadLogboek() {
    post('/api/member/boardroom/logboek', { max: 25 }).then(function (r) {
      var doel = $('logboek'); if (!doel) return;
      var regels = (r.d && r.d.logboek) || [];
      doel.textContent = '';
      if (!regels.length) {
        var leeg = document.createElement('p'); leeg.className = 'rtg-uitleg';
        leeg.textContent = 'Nog niets omgezet.';
        doel.appendChild(leeg); return;
      }
      regels.forEach(function (r2) {
        var rij2 = document.createElement('div'); rij2.className = 'rtg-logrij';
        var wat = (r2.wijzigingen || []).map(function (w) {
          return w.naam + ' ' + (w.naar ? 'aan' : 'uit');
        }).join(', ');
        var b = document.createElement('b'); b.textContent = wat || 'gewijzigd';
        rij2.appendChild(b);
        var m = document.createElement('span');
        m.textContent = datum(r2.at) + ' · ' + (r2.door === 'ouder' ? 'door je ouder/beheerder' : 'door jou');
        rij2.appendChild(m);
        doel.appendChild(rij2);
      });
    }).catch(function () { /* het logboek is bijzaak; het bord staat er al */ });
  }

  function laad() {
    if (!token()) { $('melding').textContent = 'Log in als lid om je boardroom te zien.'; return; }
    post('/api/member/boardroom', {}).then(function (r) {
      if (r.status !== 200 || !r.d.bord) {
        $('melding').textContent = (r.d && r.d.error) || 'Je boardroom is er alleen voor leden met een account.';
        return;
      }
      bordNu = r.d.bord;
      teken();
    }).catch(function () { $('melding').textContent = 'Kon de boardroom niet laden.'; });
  }

  document.addEventListener('DOMContentLoaded', laad);
})();
