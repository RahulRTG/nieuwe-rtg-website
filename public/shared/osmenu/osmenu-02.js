    function gpsAan() { try { return localStorage.getItem('rtg_os_gps') === '1'; } catch (e) { return false; } }
    var gpsRij = el('div', 'osmenu-toggle');
    gpsRij.appendChild(icoNode('gps'));
    var gtl = el('div', 'tl'); gtl.appendChild(el('b', null, 'Locatie (GPS)'));
    gtl.appendChild(el('small', null, 'Voor kaarten, ritten en veiligheid'));
    gpsRij.appendChild(gtl);
    var gLab = el('label', 'osmenu-sw');
    var gInp = d.createElement('input'); gInp.type = 'checkbox'; gInp.checked = gpsAan();
    gInp.addEventListener('change', function () {
      if (gInp.checked) {
        try { localStorage.setItem('rtg_os_gps', '1'); } catch (e) {}
        if (w.navigator && w.navigator.geolocation) {
          w.navigator.geolocation.getCurrentPosition(function () {}, function () {
            try { localStorage.setItem('rtg_os_gps', '0'); } catch (e) {}
            gInp.checked = false;   // toestemming geweigerd -> weer uit
          });
        }
      } else { try { localStorage.setItem('rtg_os_gps', '0'); } catch (e) {} }
    });
    gLab.appendChild(gInp); gLab.appendChild(el('span', 'baan')); gLab.appendChild(el('span', 'knop'));
    gpsRij.appendChild(gLab);

    function vastRij(icoon, titel, uitlegTekst) {
      var rij = el('div', 'osmenu-toggle');
      rij.appendChild(icoNode(icoon));
      var tl = el('div', 'tl');
      var b = el('b'); b.appendChild(d.createTextNode(titel + ' '));
      if (w.RTGUitleg && w.RTGUitleg.knop) b.appendChild(w.RTGUitleg.knop(uitlegTekst, 'Waarom kan dit niet?'));
      tl.appendChild(b);
      tl.appendChild(el('small', null, 'Je toestel schakelt dit zelf'));
      rij.appendChild(tl);
      var lab = el('label', 'osmenu-sw uit');
      var inp = d.createElement('input'); inp.type = 'checkbox'; inp.disabled = true;
      lab.appendChild(inp); lab.appendChild(el('span', 'baan')); lab.appendChild(el('span', 'knop'));
      rij.appendChild(lab);
      return rij;
    }
    var wifiRij = vastRij('wifi', 'Wifi',
      'Een website mag de wifi van je toestel niet aan- of uitzetten; dat kan alleen je telefoon zelf, via de instellingen. RTG-OS toont de schakelaar, maar bedient de radio niet.');
    var btRij = vastRij('bluetooth', 'Bluetooth',
      'Een website mag Bluetooth van je toestel niet aan- of uitzetten; dat kan alleen je telefoon zelf, via de instellingen. RTG-OS toont de schakelaar, maar bedient de radio niet.');
    // Zaakdoos: het lokale kastje van de zaak. Staat er een adres, dan probeert
    // elke app dat eerst en valt terug op de cloud als de doos niet reageert.
    function doosRij() {
      var rij = el('div', 'osmenu-conn');
      rij.appendChild(icoNode('netwerk'));
      var tl = el('div', 'tl');
      tl.appendChild(el('b', null, 'Zaakdoos'));
      var opdoos = w.RTGdoos && w.RTGdoos.opDeDoos && w.RTGdoos.opDeDoos();
      tl.appendChild(el('small', null, opdoos ? 'Nu verbonden met de Zaakdoos' : 'Adres van het kastje in de zaak'));
      rij.appendChild(tl);
      var inp = d.createElement('input');
      inp.type = 'url'; inp.placeholder = 'http://…'; inp.setAttribute('aria-label', 'Zaakdoos-adres');
      inp.value = (w.RTGdoos && w.RTGdoos.adres && w.RTGdoos.adres()) || '';
      inp.style.cssText = 'flex:none;width:9rem;max-width:42vw;background:rgba(255,255,255,.06);border:1px solid rgba(255,255,255,.14);border-radius:8px;color:inherit;font:inherit;font-size:.8rem;padding:.35rem .5rem;';
      var bwr = el('button', 'osmenu-mini'); bwr.type = 'button'; bwr.textContent = 'Bewaar';
      bwr.addEventListener('click', function () {
        if (w.RTGdoos) { w.RTGdoos.instellen(inp.value); w.RTGdoos.uit(false); }
        if (inp.value.trim() && w.RTGdoos && w.RTGdoos.naarDoos) w.RTGdoos.naarDoos();
      });
      rij.appendChild(inp); rij.appendChild(bwr);
      return rij;
    }
    lijf.appendChild(sectie('antenne', 'Verbinding', [gpsRij, wifiRij, btRij, doosRij()], false));

    // ---- instellingen (incl. afmelden) ----
    var instKinderen = [
      menurij(['slot', 'Privacy', '/apps/juridisch/privacy.html']),
      menurij(['juridisch', 'Voorwaarden', '/apps/juridisch/voorwaarden.html'])
    ];
    if (winfo && acc) {
      instKinderen.push(knoprij('uitloggen', 'Afmelden', function () {
        try { localStorage.removeItem(winfo.sleutel); } catch (e) {}
        try { if (kluis) kluis.wisVensterAccount(); } catch (e) {}
        w.location.reload();
      }));
    }
    lijf.appendChild(sectie('gear', 'Instellingen & privacy', instKinderen, false));

    // ---- hulp ----
    lijf.appendChild(sectie('help', 'Hulp & ondersteuning', HULP.map(menurij), false));

    paneel.appendChild(lijf);
    body.appendChild(scrim);
    body.appendChild(paneel);

    // openen/sluiten
    function open() {
      scrim.classList.add('open'); paneel.classList.add('open');
      paneel.setAttribute('aria-hidden', 'false'); ham.setAttribute('aria-expanded', 'true');
      dicht.focus();
    }
    function sluit() {
      scrim.classList.remove('open'); paneel.classList.remove('open');
      paneel.setAttribute('aria-hidden', 'true'); ham.setAttribute('aria-expanded', 'false');
    }
    ham.addEventListener('click', function () { if (paneel.classList.contains('open')) sluit(); else open(); });
    dicht.addEventListener('click', sluit);
    scrim.addEventListener('click', sluit);
    d.addEventListener('keydown', function (e) { if (e.key === 'Escape' && paneel.classList.contains('open')) sluit(); });

    w.RTGosmenu = { open: open, sluit: sluit };
  }

  if (d.readyState === 'loading') d.addEventListener('DOMContentLoaded', bouw);
  else bouw();
})(window, document);
