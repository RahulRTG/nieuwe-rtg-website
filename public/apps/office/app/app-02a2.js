
  /* ---------- menselijke documentwerkstroom ---------- */
  function faseNu() {
    return open && open.werkstroom && FASE_NAAM[open.werkstroom.fase] ? open.werkstroom.fase : 'concept';
  }
  function tekenFase() {
    if (!open) return;
    var fase = faseNu(), hoofd = $('#faseHoofd');
    $('#faseBadge').textContent = FASE_NAAM[fase];
    $('#faseBadge').dataset.fase = fase;
    hoofd.style.display = 'none';
    if (!magBewerken) return;
    if (fase === 'concept') { hoofd.textContent = 'Vraag beoordeling'; hoofd.dataset.naar = 'beoordeling'; hoofd.style.display = ''; }
    else if (fase === 'beoordeling' && open.eigenaar) { hoofd.textContent = 'Keur goed'; hoofd.dataset.naar = 'goedgekeurd'; hoofd.style.display = ''; }
    else if (fase === 'goedgekeurd' && open.eigenaar) { hoofd.textContent = 'Archiveer'; hoofd.dataset.naar = 'archief'; hoofd.style.display = ''; }
    else if (fase === 'archief' && open.eigenaar) { hoofd.textContent = 'Heropen'; hoofd.dataset.naar = 'concept'; hoofd.style.display = ''; }
  }
  function faseUitleg(fase) {
    return fase === 'beoordeling' ? 'Het stuk wacht op een menselijke controle. Alleen de eigenaar kan het formeel goedkeuren.'
      : fase === 'goedgekeurd' ? 'De eigenaar heeft dit stuk goedgekeurd. Een inhoudelijke wijziging zet het automatisch terug naar concept.'
      : fase === 'archief' ? 'Het stuk is afgesloten en blijft terugvindbaar. De eigenaar kan het weer openen.'
      : 'Dit is werk in uitvoering. Een schrijver kan het ter beoordeling aanbieden.';
  }
  function tekenAudit() {
    var audit = (open && open.werkstroom && open.werkstroom.audit) || [];
    $('#faseAudit').innerHTML = audit.length ? audit.map(function (a) {
      var details = a.van && a.naar ? ' · ' + (FASE_NAAM[a.van] || a.van) + ' → ' + (FASE_NAAM[a.naar] || a.naar) : '';
      return '<article><time>' + esc(datum(a.om)) + '</time><p><b>' + esc(AUDIT_NAAM[a.actie] || a.actie) +
        '</b>' + esc(details) + '<br>' + esc(a.door || '') + '</p></article>';
    }).join('') : '<p class="stil">Het beslisspoor is alleen zichtbaar voor de eigenaar.</p>';
  }
  function tekenFaseModal() {
    if (!open) return;
    var fase = faseNu(), acties = [];
    $('#faseKop').textContent = FASE_NAAM[fase];
    $('#faseUitleg').textContent = faseUitleg(fase);
    if (magBewerken && fase === 'concept') acties.push(['beoordeling', 'Vraag beoordeling', 'vol']);
    if (magBewerken && fase === 'beoordeling') acties.push(['concept', 'Terug naar concept', '']);
    if (open.eigenaar && fase === 'beoordeling') acties.push(['goedgekeurd', 'Keur als mens goed', 'vol']);
    if (open.eigenaar && fase === 'goedgekeurd') {
      acties.push(['concept', 'Heropen als concept', '']); acties.push(['archief', 'Archiveer', 'vol']);
    }
    if (open.eigenaar && fase === 'archief') acties.push(['concept', 'Heropen als concept', 'vol']);
    $('#faseActies').innerHTML = acties.map(function (a) {
      return '<button class="knop ' + a[2] + '" type="button" data-fase-naar="' + a[0] + '">' + a[1] + '</button>';
    }).join('');
    Array.prototype.forEach.call($('#faseActies').querySelectorAll('[data-fase-naar]'), function (b) {
      b.addEventListener('click', function () { zetFase(b.dataset.faseNaar); });
    });
    tekenAudit();
  }
  function zetFase(naar) {
    if (!open) return Promise.resolve(false);
    var mens = naar === 'goedgekeurd' || naar === 'archief';
    if (mens && !confirm(naar === 'goedgekeurd'
      ? 'Keurt u dit document zelf goed? Rahul kan deze beslissing niet nemen.'
      : 'Wilt u dit document zelf archiveren?')) return Promise.resolve(false);
    var doc = open;
    return Promise.resolve(vuil ? bewaarNu() : true).then(function (veilig) {
      if (veilig === false || open !== doc) return false;
      return api('fase', { id: doc.id, naar: naar, mens: mens }).then(function (r) {
        if (r.status !== 200) { zeg(r.body.error || 'Kon de werkstatus niet wijzigen.'); return false; }
        doc.gewijzigd = r.body.gewijzigd;
        doc.werkstroom = doc.werkstroom || { audit: [] };
        doc.werkstroom.fase = r.body.fase; doc.werkstroom.laatstDoor = r.body.laatstDoor;
        if (r.body.actie && Array.isArray(doc.werkstroom.audit)) doc.werkstroom.audit.unshift(r.body.actie);
        zetTab(doc); tekenFase(); tekenFaseModal(); laadLijst();
        zeg('Werkstatus: ' + FASE_NAAM[r.body.fase] + '.');
        return true;
      });
    });
  }
  $('#faseBadge').addEventListener('click', function () {
    if (!open) return;
    Promise.resolve(vuil ? bewaarNu() : true).then(function (veilig) {
      if (veilig === false) return;
      return api('open', { id: open.id }).then(function (r) {
        if (r.status === 200) {
          open.gewijzigd = r.body.gewijzigd; open.werkstroom = r.body.werkstroom;
          tekenFase(); tekenFaseModal(); $('#faseScrim').classList.add('open');
        }
      });
    });
  });
  $('#faseHoofd').addEventListener('click', function () { zetFase(this.dataset.naar); });
  $('#faseDicht').addEventListener('click', function () { $('#faseScrim').classList.remove('open'); });
