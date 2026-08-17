  /* ---- backoffice, vervolg van deel 01b: DE VAKBEWIJZEN ----
     Geknipt op een top-niveau grens binnen dezelfde IIFE, net als 01b; de delen
     worden achter elkaar geplakt.

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
    try { r = await call('/office/vakbewijzen'); } catch(e){ return; }
    if (r.soorten) VAK_SOORTEN = r.soorten;
    const open = r.open || [], verlopend = r.verlopend || [];
    const rij = v =>
      '<div class="vrow" data-sleutel="'+escHtml(v.sleutel)+'" data-wat="'+escHtml(v.wat)+'">' +
        '<div class="vi"><div class="nm">'+escHtml(vakLabel(v.wat)) +
          ' <span style="color:var(--soft);font-weight:400;font-size:0.72rem;">· '+escHtml(v.wie || '-')+'</span></div>' +
          '<div class="sub">'+escHtml(v.nummer || T('bo.vak.geennr','zonder nummer')) +
            (v.tot ? ' · '+T('bo.vak.tot','geldig tot')+' '+escHtml(v.tot) : ' · '+T('bo.vak.geendatum','geen einddatum')) +
            (v.toelichting ? ' · '+escHtml(v.toelichting) : '') + '</div></div>' +
        '<button class="vbtn ok" data-teken>'+T('bo.vak.teken','Gezien en aftekenen')+'</button>' +
      '</div>';
    el.innerHTML = (open.length ? open.map(rij).join('')
      : '<div class="empty">'+T('bo.vak.leeg','Geen openstaande vakbewijzen.')+'</div>') +
      /* Wat er BINNENKORT afloopt hoort op hetzelfde bord: zonder die blik
         merkt een zaak het verlopen pas op de ochtend dat er iemand niet meer
         naar binnen kan. */
      (verlopend.length ? '<div class="sub" style="margin:0.8rem 0 0.3rem;color:var(--soft);">' +
        T('bo.vak.verlopend','Loopt binnen 60 dagen af') + '</div>' + verlopend.map(v =>
        '<div class="vrow"><div class="vi"><div class="nm">'+escHtml(vakLabel(v.wat)) +
          ' <span style="color:var(--soft);font-weight:400;font-size:0.72rem;">· '+escHtml(v.wie || '-')+'</span></div>' +
          '<div class="sub">'+T('bo.vak.tot','geldig tot')+' '+escHtml(v.tot || '')+'</div></div>' +
        '<button class="vbtn no" data-intrek data-sleutel="'+escHtml(v.sleutel)+'" data-wat="'+escHtml(v.wat)+'">' +
          T('bo.vak.intrek','Intrekken')+'</button></div>').join('') : '');

    el.querySelectorAll('[data-teken]').forEach(b => b.addEventListener('click', e => {
      const row = e.target.closest('.vrow');
      teken(row.dataset.sleutel, row.dataset.wat);
    }));
    el.querySelectorAll('[data-intrek]').forEach(b => b.addEventListener('click', e =>
      intrek(e.target.dataset.sleutel, e.target.dataset.wat)));
  }

  /* De leesbare naam van een soort. De lijst komt van de server (het register in
     kern/persoonseis-lijst.js); valt die weg, dan tonen we de id -- lelijker,
     maar nooit een leeg vakje waar een mens op moet gokken. */
  let VAK_SOORTEN = null;
  const vakLabel = id => (VAK_SOORTEN && VAK_SOORTEN[id] && VAK_SOORTEN[id].naam) || id;

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
