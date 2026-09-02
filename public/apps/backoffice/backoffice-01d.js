  /* ---- backoffice, DE VAKBEWIJZEN ----
     TERUGGEZET OP 23 AUGUSTUS 2026. Deze vier functies stonden in deel 01c en
     zijn op 21 augustus (32ace3a9, "drie te grote bestanden") VERWIJDERD in
     plaats van verplaatst, terwijl `loadVakbewijzen()` in deel 01 gewoon bleef
     staan. Wat dat opleverde was geen foutmelding maar een oneindige lus: de
     ReferenceError viel in de catch van restoreSession, die hem las als een
     verlopen sessie, het kantoortoken weggooide en doorstuurde naar de
     personeelspoort -- waar een geldige sessie stond, dus die stuurde terug.
     Zeven keer per seconde. De aftekening van vakbewijzen was al die tijd
     onbereikbaar, en niemand zag WAAROM omdat de fout stil werd opgegeten.
     Sinds vandaag staan de sessiecontrole en de schermopbouw in deel 01 los
     van elkaar, dus een fout hier logt niemand meer uit.

     WAAROM DIT SCHERM ER MOEST KOMEN. De persoonseis (server/kern/persoonseis.js)
     houdt personeel in een kinderopvang, een praktijk of een beveiligingsteam
     tegen tot RTG hun stuk heeft gezien. Die aftekening kon alleen over een
     API -- en een poort die dichtzit met een sleutel die niemand kan pakken, is
     geen beveiliging maar een storing. Dit is de plek waar een mens het stuk
     ziet en tekent.

     TWEE DINGEN DIE HIER BEWUST ZO ZIJN.

     1. GEEN ECHTE NAAM, ALLEEN DE CODENAAM. De naam ligt in de kluis en elke
        blik daarin hoort door het inzagejournaal (zie pendingVerifications in
        kern/kantoor/index.js). Voor deze stapel is dat niet nodig: wie aftekent
        bekijkt een STUK, en de koppeling tussen dat stuk en de mens is de
        identiteitsverificatie hiernaast, die al gedaan is.
     2. DE AFTEKENING VRAAGT EEN NAAM, en die wordt hier GEVRAAGD en niet
        geraden. De server weigert een lege naam met 400; een knop die stilletjes
        "backoffice" invult zou van een aftekening een vinkje maken. */

  // ---- de stapel: wat is ingediend en wacht op een mens ----
  async function loadVakbewijzen(){
    const el = document.getElementById('vakbewijzen'); if (!el) return;
    let r = null;
    /* De stapel zelf staat niet achter de kluispoort (hij toont codenamen en
       geen nummers), maar aftekenen en het nummer openen wel. Gaat er hier toch
       een kluisdeur dicht, dan zegt het paneel waarom -- zie kluisDicht in deel 01b,
       want deze delen zitten in een gedeeld bereik. */
    try { r = await call('/office/vakbewijzen'); }
    catch(e){ kluisDicht(el, e); return; }
    if (r.soorten) VAK_SOORTEN = r.soorten;
    const open = r.open || [], verlopend = r.verlopend || [];
    const rij = v =>
      '<div class="vrow" data-sleutel="'+escHtml(v.sleutel)+'" data-wat="'+escHtml(v.wat)+'">' +
        '<div class="vi"><div class="nm">'+escHtml(vakLabel(v.wat)) +
          ' <span class="bij">· '+escHtml(v.wie || '-')+'</span></div>' +
          '<div class="sub" data-nr>' +
            (v.tot ? T('bo.vak.tot','geldig tot')+' '+escHtml(v.tot) : T('bo.vak.geendatum','geen einddatum')) +
            (v.toelichting ? ' · '+escHtml(v.toelichting) : '') + '</div></div>' +
        /* Het NUMMER staat er niet bij. Het ligt in de identiteitskluis, en die
           gaat alleen open met een reden die in het inzagejournaal landt en waar
           de betrokkene bericht van krijgt. Een lijst die het nummer gewoon
           toont, zou van elke blik een ongemerkte blik maken. */
        '<button class="vbtn" data-nummer>'+T('bo.vak.nummer','Nummer inzien')+'</button>' +
        '<button class="vbtn ok" data-teken>'+T('bo.vak.teken','Gezien en aftekenen')+'</button>' +
      '</div>';
    el.innerHTML = (open.length ? open.map(rij).join('')
      : '<div class="empty">'+T('bo.vak.leeg','Geen openstaande vakbewijzen.')+'</div>') +
      /* Wat er BINNENKORT afloopt hoort op hetzelfde bord: zonder die blik
         merkt een zaak het verlopen pas op de ochtend dat er iemand niet meer
         naar binnen kan. */
      (verlopend.length ? '<div class="sub vkop">' +
        T('bo.vak.verlopend','Loopt binnen 60 dagen af') + '</div>' + verlopend.map(v =>
        '<div class="vrow"><div class="vi"><div class="nm">'+escHtml(vakLabel(v.wat)) +
          ' <span class="bij">· '+escHtml(v.wie || '-')+'</span></div>' +
          '<div class="sub">'+T('bo.vak.tot','geldig tot')+' '+escHtml(v.tot || '')+'</div></div>' +
        '<button class="vbtn no" data-intrek data-sleutel="'+escHtml(v.sleutel)+'" data-wat="'+escHtml(v.wat)+'">' +
          T('bo.vak.intrek','Intrekken')+'</button></div>').join('') : '');

    el.querySelectorAll('[data-teken]').forEach(b => b.addEventListener('click', e => {
      const row = e.target.closest('.vrow');
      teken(row.dataset.sleutel, row.dataset.wat);
    }));
    el.querySelectorAll('[data-nummer]').forEach(b => b.addEventListener('click', e => {
      const row = e.target.closest('.vrow');
      nummerInzien(row);
    }));
    el.querySelectorAll('[data-intrek]').forEach(b => b.addEventListener('click', e =>
      intrek(e.target.dataset.sleutel, e.target.dataset.wat)));
  }

  /* De leesbare naam van een soort. De lijst komt van de server (het register in
     kern/persoonseis-lijst.js); valt die weg, dan tonen we de id -- lelijker,
     maar nooit een leeg vakje waar een mens op moet gokken. */
  let VAK_SOORTEN = null;
  const vakLabel = id => (VAK_SOORTEN && VAK_SOORTEN[id] && VAK_SOORTEN[id].naam) || id;

  /* HET NUMMER OPVRAGEN. De reden wordt hier GEVRAAGD en niet verzonnen; de
     server weigert een lege of nietszeggende reden met 400. Wat er terugkomt
     zetten we in de rij zelf, met de grens eronder -- zodat wie het leest ook
     ziet dat de betrokkene hier bericht van heeft gekregen. */
  async function nummerInzien(row){
    const reden = prompt(T('bo.vak.reden','Waarvoor heeft u dit nummer nodig? De betrokkene krijgt uw reden te zien.'));
    if (reden === null) return;
    let r;
    try { r = await call('/office/vakbewijs/nummer', { sleutel: row.dataset.sleutel, wat: row.dataset.wat, reden: (reden||'').trim() }); }
    catch(e){ alert(e.message); return; }
    const sub = row.querySelector('[data-nr]');
    if (sub) sub.innerHTML = '<b>'+escHtml(r.nummer || T('bo.vak.geennr','zonder nummer'))+'</b> · ' + sub.innerHTML +
      '<div class="vgrens">'+escHtml(r.grens || '')+'</div>';
    const knop = row.querySelector('[data-nummer]'); if (knop) knop.remove();
  }

  async function teken(sleutel, wat){
    const door = prompt(T('bo.vak.wie','Wie tekent af dat dit stuk is gezien? (uw naam)'));
    if (door === null) return;
    if (!door.trim()) { alert(T('bo.vak.naamnodig','Een aftekening zonder naam is geen aftekening.')); return; }
    try {
      const r = await call('/office/vakbewijs/teken', { sleutel, wat, door: door.trim() });
      /* De grens die de server meestuurt tonen we letterlijk. Wie aftekent moet
         weten wat hij WEL en NIET vastlegt: dat het stuk er is, niet dat het
         klopt. RTG is geen inspectie. */
      if (r && r.grens) alert(r.grens);
    } catch(e){ alert(e.message); return; }
    loadVakbewijzen();
  }

  async function intrek(sleutel, wat){
    const reden = prompt(T('bo.vak.waarom','Waarom trekt u dit stuk in? (bijvoorbeeld: doorgehaald in het register)'));
    if (reden === null) return;
    const door = prompt(T('bo.vak.wie','Wie tekent af dat dit stuk is gezien? (uw naam)'));
    if (door === null || !door.trim()) return;
    try { await call('/office/vakbewijs/intrek', { sleutel, wat, door: door.trim(), reden: reden.trim() }); }
    catch(e){ alert(e.message); return; }
    loadVakbewijzen();
  }
