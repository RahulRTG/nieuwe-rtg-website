/* De rekenmotor van RTG Gereedschap: een eigen tokenizer plus
   shunting-yard, dus GEEN eval en geen verrassingen. Begrijpt + - x /
   procent en haakjes, komma of punt als decimaalteken, en een leidend
   minteken. Draait in de browser en (voor de tests) in Node. */
(function (wortel) {
  'use strict';

  function tokens(t) {
    const uit = [];
    const s = String(t || '').replace(/\s+/g, '').replace(/,/g, '.').replace(/[x×]/g, '*').replace(/÷/g, '/');
    let i = 0;
    while (i < s.length) {
      const c = s[i];
      if (/[0-9.]/.test(c)) {
        let n = '';
        while (i < s.length && /[0-9.]/.test(s[i])) n += s[i++];
        if ((n.match(/\./g) || []).length > 1) return null;
        uit.push({ n: parseFloat(n) });
        continue;
      }
      if ('+-*/%()'.includes(c)) { uit.push({ op: c }); i++; continue; }
      return null;   // een teken dat we niet kennen: liever eerlijk fout dan raden
    }
    return uit;
  }

  /* Shunting-yard: van leesvolgorde naar rekenvolgorde (RPN). Het procentteken
     plakt aan het getal ervoor: 21% wordt 0,21 en "200+10%" is 200 + 10% van 200
     (zoals elke zakrekenmachine dat doet). */
  function naarRpn(ts) {
    const uit = [], stapel = [];
    const rang = { '+': 1, '-': 1, '*': 2, '/': 2, '~': 3 };
    let vorig = null;
    for (let i = 0; i < ts.length; i++) {
      let t = ts[i];
      if (t.n != null) { uit.push(t); vorig = 'n'; continue; }
      if (t.op === '%') {
        // {n}% -> n/100; bij + of - erna volgt "percent van links" in reken()
        uit.push({ op: '%' }); vorig = 'n'; continue;
      }
      if (t.op === '-' && vorig !== 'n' && vorig !== ')') { stapel.push({ op: '~' }); continue; }
      if (t.op === '(') { stapel.push(t); vorig = '('; continue; }
      if (t.op === ')') {
        while (stapel.length && stapel[stapel.length - 1].op !== '(') uit.push(stapel.pop());
        if (!stapel.length) return null;
        stapel.pop(); vorig = ')'; continue;
      }
      while (stapel.length && rang[stapel[stapel.length - 1].op] >= rang[t.op]) uit.push(stapel.pop());
      stapel.push(t); vorig = 'op';
    }
    while (stapel.length) { const t = stapel.pop(); if (t.op === '(') return null; uit.push(t); }
    return uit;
  }

  function reken(uitdrukking) {
    const ts = tokens(uitdrukking);
    if (!ts || !ts.length) return { fout: 'Dat is geen som.' };
    const rpn = naarRpn(ts);
    if (!rpn) return { fout: 'De haakjes kloppen niet.' };
    const st = [];
    for (const t of rpn) {
      if (t.n != null) { st.push({ w: t.n }); continue; }
      if (t.op === '%') { const a = st.pop(); if (!a) return { fout: 'Dat is geen som.' }; st.push({ w: a.w / 100, pct: true }); continue; }
      if (t.op === '~') { const a = st.pop(); if (!a) return { fout: 'Dat is geen som.' }; st.push({ w: -a.w, pct: a.pct }); continue; }
      const b = st.pop(), a = st.pop();
      if (!a || !b) return { fout: 'Dat is geen som.' };
      // "200 + 10%" of "200 - 10%": het percent slaat op het linkerdeel
      const bw = b.pct && (t.op === '+' || t.op === '-') ? a.w * b.w : b.w;
      if (t.op === '+') st.push({ w: a.w + bw });
      else if (t.op === '-') st.push({ w: a.w - bw });
      else if (t.op === '*') st.push({ w: a.w * b.w });
      else if (t.op === '/') {
        if (b.w === 0) return { fout: 'Delen door nul gaat niet; dat is geen mening maar wiskunde.' };
        st.push({ w: a.w / b.w });
      }
    }
    if (st.length !== 1 || !Number.isFinite(st[0].w)) return { fout: 'Dat is geen som.' };
    // afronden op 10 cijfers tegen zwevendekomma-ruis (0.1+0.2)
    return { waarde: Math.round(st[0].w * 1e10) / 1e10 };
  }

  const RTGReken = { reken };
  if (typeof module !== 'undefined' && module.exports) module.exports = RTGReken;
  else wortel.RTGReken = RTGReken;
})(typeof window !== 'undefined' ? window : globalThis);
