    if (!text || !pchat) return;
    inp.value = '';
    try { renderPChat((await API.call('/partner/chat/send', { supplierCode: pchat.code, dept: pchat.dept, text })).messages); }
    catch(e){ toast(e.message); }
  }
  $('#pcClose').addEventListener('click', closePChat);
  $('#pchat-scrim').addEventListener('click', closePChat);
  // vooraf al op elkaars Salon kijken: nooit vreemden van elkaar
  $('#pcSalon').addEventListener('click', () => { if (pchat) openEtalage(pchat.code); });
  $('#pcSend').addEventListener('click', sendPChat);
  $('#pcInput').addEventListener('keydown', e => { if (e.key === 'Enter') sendPChat(); });
  // De gast vraagt zelf om aandacht: het team krijgt meteen een prioriteitsmelding.
  document.querySelectorAll('#pcAttn [data-attn]').forEach(b => b.addEventListener('click', async () => {
    if (!pchat) return;
    try { await API.call('/aandacht', { supplierCode: pchat.code, reden: b.dataset.attn }); toast(T('app.attn.ok','Het team is gewaarschuwd en komt eraan.')); }
    catch(e){ toast(e.message); }
  }));

