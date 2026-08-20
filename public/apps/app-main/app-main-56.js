/* het zegel: aftellen en sluiten */
    document.getElementById('zgSluit').addEventListener('click', sluitZegel);
    const eind = Date.now() + (d.geldigMin || 5) * 60000;
    const tel = document.getElementById('zgTel');
    function tik(){
      const over = Math.max(0, eind - Date.now());
      const m = Math.floor(over / 60000), s = Math.floor((over % 60000) / 1000);
      tel.textContent = over > 0 ? T('zg.geldig','Geldig nog ') + m + ':' + String(s).padStart(2,'0') : T('zg.verlopen','Verlopen; maak een nieuwe.');
      if (over <= 0 && zgTimer){ clearInterval(zgTimer); zgTimer = null; }
    }
    tik(); zgTimer = setInterval(tik, 1000);
  }
  const _zegelBtn = document.getElementById('zegelBtn');
  if (_zegelBtn) _zegelBtn.addEventListener('click', openZegel);
