    if (API.live){ try { applyState((await API.call('/state')).state); } catch (e) {} }
    renderAll();
    renderBell();
    openTab(tab);
  });

  /* ---------- PWA ---------- */

  if ('serviceWorker' in navigator && (location.protocol === 'http:' || location.protocol === 'https:')){
    navigator.serviceWorker.register('/sw.js').catch(() => {});
  }

  const logoutBtn = document.getElementById('logoutBtn');
  if (logoutBtn) logoutBtn.addEventListener('click', doLogout);

  /* ---------- AVG: inzage en vergetelheid ---------- */
  const privExport = document.getElementById('privExport');
  if (privExport) privExport.addEventListener('click', async () => {
    if (!API.live){ toast(T('app.priv.needlogin','Log eerst in.')); return; }
    try {
      const data = await API.call('/privacy/export');
      const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
      const a = document.createElement('a');
      a.href = URL.createObjectURL(blob);
      a.download = 'rtg-mijn-gegevens.json';
      document.body.appendChild(a); a.click(); a.remove();
      setTimeout(() => URL.revokeObjectURL(a.href), 4000);
      toast(T('app.priv.exported','Uw gegevens zijn gedownload als JSON.'));
    } catch(e){ toast(e.message); }
  });
  const privDelete = document.getElementById('privDelete');
  if (privDelete) privDelete.addEventListener('click', async () => {
    if (!API.live){ toast(T('app.priv.needlogin','Log eerst in.')); return; }
    if (!confirm(T('app.priv.confirm','Weet u het zeker? Dit wist uw cv, chats, likes en locatie definitief en logt u overal uit.'))) return;
    try {
      await API.call('/privacy/delete');
      try { localStorage.removeItem('rtg_member_token'); } catch(e2){}
      location.reload();
    } catch(e){ toast(e.message); }
  });

  restoreSession();
})();
