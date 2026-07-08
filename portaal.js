(function(){
  const tabs = document.querySelectorAll('.tab');
  const panelen = document.querySelectorAll('.paneel');

  tabs.forEach(tab => {
    tab.addEventListener('click', () => {
      tabs.forEach(t => t.classList.remove('actief'));
      panelen.forEach(p => p.classList.remove('actief'));
      tab.classList.add('actief');
      document.getElementById('paneel-' + tab.dataset.paneel).classList.add('actief');
    });
  });
})();

(function(){
  const OPENING = "Goedendag. Ik ben je assistent — stel je vraag, dan help ik direct waar ik kan. En waar een mens het verschil maakt, schakel ik het team in.";

  const body = document.getElementById('pcBody');
  const form = document.getElementById('pcForm');
  const input = document.getElementById('pcInput');
  const sendBtn = document.getElementById('pcSend');

  let messages = [];
  let busy = false;

  function addBubble(text, who){
    const el = document.createElement('div');
    el.className = 'bubble ' + who;
    el.textContent = text;
    body.appendChild(el);
    body.scrollTop = body.scrollHeight;
    return el;
  }

  function addTyping(){
    const el = document.createElement('div');
    el.className = 'bubble assistent typing';
    el.innerHTML = '<span></span><span></span><span></span>';
    body.appendChild(el);
    body.scrollTop = body.scrollHeight;
    return el;
  }

  function setBusy(state){
    busy = state;
    input.disabled = state;
    sendBtn.disabled = state;
  }

  async function sendMessage(text){
    if (!text.trim() || busy) return;

    messages.push({ role: 'user', content: text });
    addBubble(text, 'user');
    setBusy(true);

    const typingEl = addTyping();

    try {
      const res = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ pass: 'portaal', messages })
      });

      const data = await res.json();
      typingEl.remove();

      if (!res.ok) {
        addBubble(data.error || 'Even geen verbinding — probeer het nog eens.', 'assistent');
        messages.pop();
      } else {
        messages.push({ role: 'assistant', content: data.reply });
        addBubble(data.reply, 'assistent');
      }
    } catch (err) {
      typingEl.remove();
      addBubble('Even geen verbinding — probeer het nog eens.', 'assistent');
      messages.pop();
    }

    setBusy(false);
    input.focus();
  }

  form.addEventListener('submit', (e) => {
    e.preventDefault();
    const text = input.value;
    input.value = '';
    sendMessage(text);
  });

  addBubble(OPENING, 'assistent');
  messages.push({ role: 'assistant', content: OPENING });
})();
