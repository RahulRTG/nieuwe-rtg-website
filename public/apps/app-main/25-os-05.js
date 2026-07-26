      if (wiebelW && !e.target.closest('.os-w-min')) { wSleep = c; c.classList.add('os-sleep'); }
    });
    pagina2.addEventListener('pointermove', e => {
      if (wTimer && !wiebelW && (Math.abs(e.movementX) > 3 || Math.abs(e.movementY) > 3)) { clearTimeout(wTimer); wTimer = null; }
      if (!wiebelW || !wSleep) return;
      const onder = document.elementFromPoint(e.clientX, e.clientY);
      const doel = onder && onder.closest && onder.closest('.card');
      if (doel && doel !== wSleep && doel.parentElement === pagina2) {
        const kinderen = [...pagina2.children];
        pagina2.insertBefore(wSleep, kinderen.indexOf(doel) > kinderen.indexOf(wSleep) ? doel.nextSibling : doel);
      }
    });
    const wLos = () => {
      if (wTimer) { clearTimeout(wTimer); wTimer = null; }
      if (wSleep) {
        wSleep.classList.remove('os-sleep'); wSleep = null;
        const s = wStand(); s.volgorde = wKaarten().map(c => c.id); wBewaar(s);
      }
    };
    pagina2.addEventListener('pointerup', wLos);
    pagina2.addEventListener('pointercancel', wLos);
    wToepas();
  }

  bouw(); bouwDots();

  /* De app-regie van de RTG-boardroom: apps die voor deze pas zijn uitgezet
     verdwijnen van het springboard (de server weigert hun API's sowieso al;
     dit houdt het scherm eerlijk). De sleutel hier is de functie-id op het
     schakelbord; alles wat niet genoemd wordt, blijft gewoon staan. */
  const REGIE = { spelen: 'spellen', podium: 'podium', flits: 'flits', theater: 'theater',
    wbw: 'wbw', passkeys: 'webauthn', ov: 'ov', clips: 'clips', office: 'kantoorpakket', vonk: 'vonk' };
  (function () {
    let tok = null; try { tok = localStorage.getItem('rtg_member_token'); } catch (e) {}
    if (!tok) return;
    fetch('/api/member/apps', { method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + tok }, body: '{}' })
      .then(r => (r.ok ? r.json() : null))
      .then(d => {
        if (!d || !Array.isArray(d.uit) || !d.uit.length) return;
        const uit = new Set(d.uit);
        let anders = false;
        for (const sleutel of Object.keys(REGIE))
          if (uit.has(REGIE[sleutel]) && LINKS[sleutel]) { delete LINKS[sleutel]; anders = true; }
        if (anders) bouw();
      }).catch(() => {});
    /* De RTG Bank-tegel bestaat pas als de boardroom de leden-bank live heeft
       gezet: de registry-invoer ontbreekt standaard ('link:bank' in de indeling
       blijft dan onzichtbaar) en komt er hier bij zodra de bank online meldt. */
    fetch('/api/bank/overzicht', { method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + tok }, body: '{}' })
      .then(r => (r.ok ? r.json() : null))
      .then(d => {
        if (d && d.online) { LINKS.bank = { naam: 'RTG Bank', url: '/apps/bank.html' }; bouw(); }
      }).catch(() => {});
  })();

  /* ============================== App Store ==============================
     De ROS is standaard een schone telefoon: alleen de basis-apps, de
     RTFoundation en de App Store staan er (25-os-01.js). Alles daarbuiten leeft
     in de Store en verschijnt op pagina 2 zodra je het installeert. De keuze
     staat per pas in localStorage; verwijderen haalt het er weer af (de basis
     en het dock kun je niet verwijderen). Dit blok staat bewust op het top-
     niveau van de OS-IIFE (functie-declaraties worden gehoist, dus bouw()
     hierboven kan geinstalleerdeItems() al gebruiken). */
  function vasteAppsSet() { return new Set(STANDAARD.concat(DOCK.map(function (t) { return 'tab:' + t; }))); }
  function geinst() { try { return JSON.parse(localStorage.getItem('rtg_os_apps_' + pas) || '[]') || []; } catch (e) { return []; } }
  function zetGeinst(a) { try { localStorage.setItem('rtg_os_apps_' + pas, JSON.stringify(a)); } catch (e) {} }
  function isGeinst(item) { return geinst().indexOf(item) >= 0; }
  // pagina 2 = de geïnstalleerde apps die echt bestaan (bouw() leest dit)
  function geinstalleerdeItems() { var v = vasteAppsSet(); return geinst().filter(function (it) { return !v.has(it) && itemZichtbaar(it); }); }
  function installeer(item) { var a = geinst(); if (a.indexOf(item) < 0) { a.push(item); zetGeinst(a); } bouw(); }
  function verwijder(item) { zetGeinst(geinst().filter(function (x) { return x !== item; })); bouw(); }

  var winkelScrim = $('#osWinkelScrim'), winkelLijst = $('#osWinkelLijst'), winkelTitel = $('#osWinkelTitel');
  function winkelRij(item) {
    var rij = document.createElement('div'); rij.className = 'os-winkel-rij';
    var zi = document.createElement('span'); zi.className = 'zi'; zi.appendChild(tegelInhoud(item)); rij.appendChild(zi);
    var naam = document.createElement('span'); naam.className = 'os-winkel-naam'; naam.textContent = itemNaam(item); rij.appendChild(naam);
    var knop = document.createElement('button'); knop.type = 'button'; knop.className = 'os-winkel-knop';
    var verf = function () {
      var g = isGeinst(item);
      knop.textContent = g ? T('os.store.uit', 'Verwijderen') : T('os.store.in', 'Installeren');
      knop.classList.toggle('geinst', g);
    };
    knop.addEventListener('click', function () { if (isGeinst(item)) verwijder(item); else installeer(item); verf(); });
    verf(); rij.appendChild(knop);
    return rij;
  }
  // de groepen die deze pas mag zien, met alleen de echt-bestaande extra-apps
  function winkelGroepen() {
    var uit = [];
    for (var i = 0; i < WINKEL_GROEPEN.length; i++) {
      var groep = WINKEL_GROEPEN[i];
      if (groep.pas && groep.pas.indexOf(pas) < 0) continue;
      var items = groep.items.filter(function (it) { return !vasteAppsSet().has(it) && itemZichtbaar(it); });
      if (items.length) uit.push({ titel: groep.titel, items: items });
    }
    return uit;
  }
  function openWinkel() {
    if (!winkelScrim) return;
    sluitScrims();
    if (winkelTitel) winkelTitel.textContent = T('os.store.h', 'App Store');
    winkelLijst.textContent = '';
    var intro = document.createElement('p'); intro.className = 'os-winkel-intro';
    intro.textContent = T('os.store.uitleg', 'Zet functies op uw beginscherm of haal ze eraf. De basis en het dock blijven altijd staan.');
    winkelLijst.appendChild(intro);
    var groepen = winkelGroepen(), n = 0;
    groepen.forEach(function (g) {
      var kop = document.createElement('div'); kop.className = 'os-winkel-groep'; kop.textContent = g.titel;
      winkelLijst.appendChild(kop);
      g.items.forEach(function (it) { winkelLijst.appendChild(winkelRij(it)); n++; });
    });
    if (!n) { var leeg = document.createElement('div'); leeg.className = 'os-bel-leeg'; leeg.textContent = T('os.store.leeg', 'Er is nu niets extra beschikbaar.'); winkelLijst.appendChild(leeg); }
    winkelScrim.classList.add('open');
  }

