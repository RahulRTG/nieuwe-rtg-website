/* Presentatie van dezelfde serverdeur. Tokens, profielwissel en de beslissing
   blijven in sessie-00; deze functie blijft in dezelfde bestaande bundel-IIFE. */
  var toegangAchtergrond = [];
  function verbergToegangAchtergrond(slot) {
    if (toegangAchtergrond.length || !document.body) return;
    Array.prototype.forEach.call(document.body.children, function (node) {
      if (node === slot) return;
      toegangAchtergrond.push({ node: node, hidden: node.hasAttribute('hidden'),
        inert: node.hasAttribute('inert'), aria: node.getAttribute('aria-hidden') });
      node.hidden = true; node.setAttribute('inert', ''); node.setAttribute('aria-hidden', 'true');
    });
  }
  function herstelToegangAchtergrond() {
    toegangAchtergrond.splice(0).forEach(function (staat) {
      if (!staat.node || !staat.node.isConnected) return;
      staat.node.hidden = staat.hidden;
      if (!staat.inert) staat.node.removeAttribute('inert');
      if (staat.aria == null) staat.node.removeAttribute('aria-hidden'); else staat.node.setAttribute('aria-hidden', staat.aria);
    });
  }
  function toegangBeeld(reden, laden, beheer) {
    return '<div class="ds-foundation-slot"><p class="ds-label">RTF · veilige toegang</p>' +
      '<h1 class="ds-titel ds-titel--scherm">' + (laden ? 'Jouw veilige wereld wacht op je' : 'Deze ruimte blijft nog dicht') + '</h1>' +
      '<p role="status">' + esc(reden || 'De server controleert je leeftijd en passen voordat dit scherm opengaat.') + '</p>' +
      (laden ? '<progress class="ds-foundation-laden" aria-label="Toegang controleren"></progress>' :
        '<div class="ds-foundation-acties"><a class="ds-knop ds-knop--primair" data-rtf-wissel href="index.html#profielen">Kies een profiel →</a>' +
        '<a class="ds-knop" data-rtf-uitweg href="/apps/app.html">Naar RTG OS</a>' +
        (beheer ? '<a class="ds-knop" href="beheer.html">Leeftijd instellen</a>' : '') + '</div>') + '</div>';
  }
  function toegangSlot(reden, laden) {
    var id = 'rtf-toegang-slot', el = document.getElementById(id);
    document.documentElement.classList.add('rtf-toegang-dicht', 'ds-foundation-dicht');
    laadSessiePresentatie('/ds/rtg-ds.css');
    if (!el) {
      el = document.createElement('dialog'); el.id = id; el.setAttribute('role', 'alertdialog'); el.setAttribute('aria-modal', 'true');
      el.className = 'ds-dialoog ds-foundation-toegang';
      (document.body || document.documentElement).appendChild(el);
    }
    verbergToegangAchtergrond(el);
    var s = lees(), beheer = !!(s && s.profiel && s.profiel.beheerder);
    el.innerHTML = toegangBeeld(reden, laden, beheer);
    var wisselKnop = el.querySelector('[data-rtf-wissel]');
    if (wisselKnop) wisselKnop.onclick = function () {
      var ss = lees(); if (ss) { wissel(ss); localStorage.setItem(KEY, JSON.stringify(ss)); }
    };
    try { if (!el.open) el.showModal(); } catch (e) {}
    return el;
  }
