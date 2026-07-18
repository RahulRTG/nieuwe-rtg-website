      const n = document.createElement('span'); n.className = 'wos-naam'; n.textContent = a.naam;
      b.appendChild(n);
      b.addEventListener('click', () => {
        scrim.classList.remove('open');
        a.el.scrollIntoView({ behavior: 'smooth', block: 'start' });
        a.el.classList.add('wos-flits');
        setTimeout(() => a.el.classList.remove('wos-flits'), 1600);
      });
      grid.appendChild(b);
    }
    scrim.addEventListener('click', e => { if (e.target === scrim) scrim.classList.remove('open'); });
    document.addEventListener('keydown', e => {
      if (e.key === 'Escape') scrim.classList.remove('open');
      if ((e.metaKey || e.ctrlKey) && String(e.key).toLowerCase() === 'k') { e.preventDefault(); scrim.classList.toggle('open'); }
    });

    const open = () => scrim.classList.add('open');
    if (opts.knopIn) {
      const k = document.createElement('button');
      k.className = 'wos-bord-knop';
      k.innerHTML = HUIS_SVG + '<span>Panelen</span>';
      k.addEventListener('click', open);
      opts.knopIn.appendChild(k);
    }
    return { open };
  }

  window.WerkOS = { koppel, bord };
})();
