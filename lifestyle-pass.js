(function(){
  const OPENING = "Goedemiddag. Waarmee kan ik u vandaag helpen, of waar bent u naar op zoek?";

  const body = document.getElementById('conciergeBody');
  const form = document.getElementById('conciergeForm');
  const input = document.getElementById('conciergeInput');
  const sendBtn = document.getElementById('conciergeSend');

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
    el.className = 'bubble concierge typing';
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
        body: JSON.stringify({ pass: 'lifestyle', messages })
      });

      const data = await res.json();
      typingEl.remove();

      if (!res.ok) {
        addBubble(data.error || 'Even geen verbinding — probeert u het nog eens.', 'concierge');
        messages.pop();
      } else {
        messages.push({ role: 'assistant', content: data.reply });
        addBubble(data.reply, 'concierge');
      }
    } catch (err) {
      typingEl.remove();
      addBubble('Even geen verbinding — probeert u het nog eens.', 'concierge');
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

  addBubble(OPENING, 'concierge');
  messages.push({ role: 'assistant', content: OPENING });
})();

(function(){
  const targets = document.querySelectorAll('.reveal');
  if (!targets.length) return;

  if (!('IntersectionObserver' in window)) {
    targets.forEach(el => el.classList.add('is-visible'));
    return;
  }

  const observer = new IntersectionObserver((entries) => {
    entries.forEach(entry => {
      if (entry.isIntersecting) {
        entry.target.classList.add('is-visible');
        observer.unobserve(entry.target);
      }
    });
  }, { threshold: 0.15, rootMargin: '0px 0px -60px 0px' });

  targets.forEach(el => observer.observe(el));
})();

(function(){
  const bar = document.createElement('div');
  bar.className = 'leesbalk';
  document.body.appendChild(bar);

  function update(){
    const doc = document.documentElement;
    const max = doc.scrollHeight - doc.clientHeight;
    bar.style.width = (max > 0 ? (doc.scrollTop / max) * 100 : 0) + '%';
  }

  window.addEventListener('scroll', update, { passive: true });
  window.addEventListener('resize', update);
  update();
})();
