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
    wbw: 'wbw', passkeys: 'webauthn', ov: 'ov' };
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
  })();
})();
