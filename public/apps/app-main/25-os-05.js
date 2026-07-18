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
})();
