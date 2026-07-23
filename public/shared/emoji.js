/* RTG-eigen emoji voor de chats. Geen Unicode-emoji: onze eigen huisstijl-
   smileys en tekens (lijn-glyfen uit shared/glyf.js, prefix "emo-"). In een
   bericht staan ze als sneltekst :naam: (bv. :blij:), en worden bij het tonen
   omgezet naar de glyf. Zo blijft de opslag platte tekst en vertaalt de chat
   gewoon door.

   Gebruik:  RTGEmoji.render(escT(tekst))   // sneltekst -> glyf-HTML
             el.appendChild(RTGEmoji.knop(inputEl))  // kiezer-knop bij een invoer
   Vereist shared/glyf.js. Geen andere afhankelijkheden. */
(function () {
  if (window.RTGEmoji) return;

  // De set: naam (sneltekst) + label. Het beeld komt uit RTGGlyf ('emo-'+naam).
  var SET = [
    { n: 'blij', t: 'Blij' }, { n: 'knipoog', t: 'Knipoog' }, { n: 'lol', t: 'Lachen' },
    { n: 'verdriet', t: 'Verdrietig' }, { n: 'verrast', t: 'Verrast' }, { n: 'cool', t: 'Cool' },
    { n: 'kus', t: 'Kus' }, { n: 'tong', t: 'Tong' }, { n: 'slaap', t: 'Slaap' },
    { n: 'neutraal', t: 'Neutraal' }, { n: 'duim', t: 'Duim omhoog' }, { n: 'hart', t: 'Hart' },
    { n: 'vuur', t: 'Vuur' }, { n: 'feest', t: 'Feest' }, { n: 'ster', t: 'Ster' },
    { n: 'bloem', t: 'Bloem' }, { n: 'proost', t: 'Proost' }
  ];
  var KENT = {};
  SET.forEach(function (e) { KENT[e.n] = 1; });

  function glyf(naam, klasse) {
    return (window.RTGGlyf && RTGGlyf.svgHTML) ? RTGGlyf.svgHTML('emo-' + naam, { klasse: klasse || 'rtg-emo' }) : '';
  }

  // Sneltekst :naam: -> glyf. Werkt op reeds ge-escapete tekst; laat onbekende
  // tekens (:zoiets:) gewoon staan.
  function render(s) {
    if (s == null) return '';
    return String(s).replace(/:([a-z]+):/g, function (m, naam) {
      return KENT[naam] ? glyf(naam) : m;
    });
  }

  // Voeg :naam: in op de cursorpositie van een invoerveld, netjes met spatie.
  function insert(input, code) {
    if (!input) return;
    var v = input.value || '';
    var a = input.selectionStart == null ? v.length : input.selectionStart;
    var b = input.selectionEnd == null ? v.length : input.selectionEnd;
    var voor = v.slice(0, a), na = v.slice(b);
    var sp = (voor && !/\s$/.test(voor)) ? ' ' : '';
    input.value = voor + sp + code + ' ' + na;
    var pos = (voor + sp + code + ' ').length;
    input.focus();
    try { input.setSelectionRange(pos, pos); } catch (e) {}
    try { input.dispatchEvent(new Event('input', { bubbles: true })); } catch (e) {}
  }

  var open = null;
  function sluit() {
    if (!open) return;
    open.remove(); open = null;
    document.removeEventListener('click', buiten, true);
    window.removeEventListener('resize', sluit);
  }
  function buiten(e) {
    if (open && !open.contains(e.target) && !e.target.closest('[data-rtg-emo-knop]')) sluit();
  }
  function plaats(p, anchor) {
    var r = anchor.getBoundingClientRect();
    var w = Math.min(272, window.innerWidth - 16);
    p.style.position = 'fixed';
    p.style.width = w + 'px';
    p.style.left = Math.max(8, Math.min(r.left, window.innerWidth - w - 8)) + 'px';
    p.style.bottom = (window.innerHeight - r.top + 8) + 'px';
  }
  function paneel(input, anchor) {
    sluit();
    var p = document.createElement('div');
    p.className = 'rtg-emo-paneel';
    p.setAttribute('role', 'menu');
    p.innerHTML = SET.map(function (e) {
      return '<button type="button" class="rtg-emo-keuze" title="' + e.t + '" aria-label="' + e.t + '" data-emo="' + e.n + '">' + glyf(e.n, 'rtg-emo-groot') + '</button>';
    }).join('');
    document.body.appendChild(p);
    open = p;
    plaats(p, anchor);
    [].forEach.call(p.querySelectorAll('.rtg-emo-keuze'), function (b) {
      b.addEventListener('click', function () { insert(input, ':' + b.getAttribute('data-emo') + ':'); sluit(); });
    });
    setTimeout(function () {
      document.addEventListener('click', buiten, true);
      window.addEventListener('resize', sluit);
    }, 0);
    return p;
  }

  // Een kiezer-knop die je naast een chat-invoer plaatst.
  function knop(input) {
    var b = document.createElement('button');
    b.type = 'button';
    b.className = 'rtg-emo-knop';
    b.setAttribute('data-rtg-emo-knop', '');
    b.setAttribute('aria-label', 'RTG-emoji');
    b.title = 'RTG-emoji';
    b.innerHTML = glyf('blij', 'rtg-emo');
    b.addEventListener('click', function (e) {
      e.preventDefault();
      if (open) { sluit(); return; }
      paneel(input, b);
    });
    return b;
  }

  window.RTGEmoji = { SET: SET, render: render, knop: knop, insert: insert };
})();
