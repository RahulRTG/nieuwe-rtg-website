  /* ---------- het gesprek met Rahul op het beginscherm ----------

     De balk onderaan was een doorgeefluik: je typte iets en belandde in zijn
     app. Nu is het een gesprek dat op het beginscherm zelf staat, en Rahul
     BEGINT. Niet met een praatje, maar met wat hij op dit moment werkelijk
     ziet: een seintje, een verwachting, of een gedachte die hij voor je heeft
     geparkeerd. Ziet hij niets, dan zegt hij dat ook gewoon.

     Alles wat hij hier zegt komt van de server (/fluister/profiel, /voorspel,
     /spar/lijst) -- er wordt hier niets verzonnen om het scherm te vullen, en
     er staat nooit een kunstmatige haast bij. Je kunt het negeren; dan blijft
     het staan en gaat er niets knipperen.

     Antwoorden gaat via dezelfde motor als in zijn app (/fluister), dus hij kan
     hier ook echt iets regelen. Wat hij niet oppakt, gaat naar de gewone
     gesprekslaag. Geld gaat nooit zonder een "ja" de deur uit; dat zit in de
     motor zelf, niet hier. */
  const aiDraad = $('#osAiDraad'), aiTips = $('#osAiTips');
  let draadOpen = false, rahulBegon = false;
  const gezegd = new Set();   // wat hij al gezegd heeft; nooit twee keer hetzelfde

  function draadBel(tekst, wie) {
    if (!aiDraad) return null;
    const b = document.createElement('div');
    b.className = 'os-bel van-' + (wie === 'mij' ? 'mij' : 'rahul');
    b.textContent = tekst;
    aiDraad.appendChild(b);
    // hoogstens de laatste zes beurten; het beginscherm blijft een beginscherm
    while (aiDraad.children.length > 6) aiDraad.removeChild(aiDraad.firstChild);
    aiDraad.hidden = false;
    draadOpen = true;
    aiDraad.scrollTop = aiDraad.scrollHeight;
    if (window.RTGMond && aiOrbMond && wie !== 'mij') aiOrbMond.praat(Math.min(4200, 420 + tekst.length * 38));
    /* In de wereldstand staat de draad niet open te wachten: daar komt Rahul
       op als een gouden ring met EEN zin, en pas als hij werkelijk iets heeft.
       Die zin is dus deze zin -- hij wordt daar niet opnieuw bedacht, want dan
       zouden er twee Rahuls zijn die net iets anders zeggen. Wat ik zelf typ is
       geen mededeling van hem, dus dat blijft eruit. */
    if (wie !== 'mij' && window.RTGWereld && RTGWereld.aan()) RTGWereld.rahulZei(tekst);
    return b;
  }

  function draadTips(lijst) {
    if (!aiTips) return;
    aiTips.textContent = '';
    if (!lijst || !lijst.length) { aiTips.hidden = true; return; }
    lijst.slice(0, 3).forEach(t => {
      const b = document.createElement('button');
      b.type = 'button';
      b.textContent = t.tekst;
      b.addEventListener('click', () => { aiTips.hidden = true; osRahulVraag(t.vraag || t.tekst); });
      aiTips.appendChild(b);
    });
    aiTips.hidden = false;
  }

  /* Wat Rahul uit zichzelf zegt zodra je thuis bent. Eén zin, de belangrijkste;
     de rest laat hij staan tot je erom vraagt. Volgorde: wat hij ziet, wat hij
     verwacht, wat hij heeft geparkeerd, en anders een rustige opening. */
  async function osRahulOpent() {
    if (rahulBegon || !aiDraad || !API.live || gast()) return;
    rahulBegon = true;
    let zin = null, tips = [];
    try {
      const prof = await API.call('/fluister/profiel');
      const sein = (prof && prof.seintjes || [])[0];
      if (sein && sein.tekst) {
        zin = sein.tekst;
        gezegd.add(sein.tekst);   // en dan niet nog eens bij het volgende rondje
        tips.push({ tekst: T('os.ai.t.regel', 'Regel dit'), vraag: sein.tekst });
      }
    } catch (e) { /* geen profiel: dan gewoon de volgende bron */ }
    if (!zin) {
      try {
        const v = ((await API.call('/voorspel')).verwachtingen || [])[0];
        if (v && v.wat) {
          zin = T('os.ai.verwacht', 'Ik verwacht') + ': ' + v.wat + (v.waarom ? ' (' + v.waarom + ')' : '') + '.';
          tips.push({ tekst: T('os.ai.t.klaar', 'Zet het klaar'), vraag: v.wat });
        }
      } catch (e) { /* niets verwacht */ }
    }
    if (!zin) {
      try {
        const s = ((await API.call('/spar/lijst', {})).spar || [])[0];
        if (s && s.wat) zin = T('os.ai.spar', 'We waren nog bezig met') + ': ' + s.wat + '.';
      } catch (e) { /* niets geparkeerd */ }
    }
    if (!zin) zin = T('os.ai.rustig', 'Er ligt niets dringends. Zeg het maar; ik zoek het op, zet het klaar of regel het.');
    draadBel(zin, 'rahul');
    tips.push({ tekst: T('os.ai.t.dag', 'Hoe ziet mijn dag eruit?'), vraag: T('os.ai.q.dag', 'hoe ziet mijn dag eruit') });
    tips.push({ tekst: T('os.ai.t.kun', 'Wat kun je?'), vraag: T('os.ai.q.kun', 'wat kun je') });
    draadTips(tips);
  }

  /* Een vraag beantwoorden ZONDER het beginscherm te verlaten. Pakt de motor
     hem niet op, dan gaat hij alsnog naar de gewone gesprekslaag; en heeft die
     ook niets, dan zegt Rahul dat eerlijk in plaats van iets te verzinnen. */
  async function osRahulVraag(vraag) {
    const q = String(vraag || '').trim();
    if (!q) return;
    draadBel(q, 'mij');
    if (aiTips) aiTips.hidden = true;
    if (!API.live) { draadBel(T('os.ai.offline', 'Ik kan er nu niet bij; start de server en vraag het nog eens.'), 'rahul'); return; }
    const wacht = draadBel(T('os.ai.denkt', 'Even kijken…'), 'rahul');
    if (wacht) wacht.classList.add('denkt');
    const zet = (tekst) => {
      if (!wacht) return draadBel(tekst, 'rahul');
      wacht.classList.remove('denkt');
      wacht.textContent = tekst;
      if (aiOrbMond) aiOrbMond.praat(Math.min(4200, 420 + tekst.length * 38));
      aiDraad.scrollTop = aiDraad.scrollHeight;
    };
    try {
      const r = await API.call('/fluister', { q });
      if (r && r.pakte && r.antwoord) {
        zet(r.antwoord);
        if (r.gedaan) toast(T('fl.gedaan', 'Rahul heeft het geregeld.'));
        // een voorstel van Rahul krijgt hier dezelfde twee knoppen als in zijn app
        draadTips(r.voorstel
          ? [{ tekst: T('fl.ja', 'Ja, doe maar'), vraag: 'ja' }, { tekst: T('fl.nee', 'Nee, laat maar'), vraag: 'nee' }]
          : []);
        return;
      }
    } catch (e) { /* de motor pakte het niet; door naar de gesprekslaag */ }
    try {
      const d = await API.call('/ai', { messages: [{ role: 'user', content: q }] });
      zet((d && d.reply) || T('os.ai.geen', 'Daar kwam ik even niet uit. Vraag het gerust anders.'));
    } catch (e) {
      zet(T('os.ai.geen', 'Daar kwam ik even niet uit. Vraag het gerust anders.'));
    }
  }

  /* ---------- hij blijft meekijken ----------
     Proactief zijn is niet één zin bij binnenkomst. Als er ondertussen iets
     verandert, hoort hij dat te zeggen. Dus kijkt hij nog eens zodra je
     terugkomt bij de app, en verder rustig elk kwartier -- alleen als het
     scherm echt zichtbaar is en je op het beginscherm staat.

     Twee regels waar we ons aan houden. Hij zegt alleen iets als het NIEUW is
     (dezelfde zin komt nooit twee keer), en er gaat niets knipperen, tellen of
     trillen. Geen kunstmatige haast: dat is precies het soort aandacht-trekkerij
     dat hier niet thuishoort. Staat er iets en doe je er niets mee, dan blijft
     het gewoon staan. */
  async function osRahulKijkt() {
    if (!aiDraad || !API.live || gast() || document.hidden) return;
    const thuis = document.querySelector('.view.active');
    if (!thuis || thuis.dataset.view !== 'home') return;
    let sein = null;
    try { sein = ((await API.call('/fluister/profiel')).seintjes || [])[0]; } catch (e) { return; }
    if (!sein || !sein.tekst || gezegd.has(sein.tekst)) return;
    gezegd.add(sein.tekst);
    draadBel(sein.tekst, 'rahul');
    draadTips([{ tekst: T('os.ai.t.regel', 'Regel dit'), vraag: sein.tekst }]);
  }
  document.addEventListener('visibilitychange', () => { if (!document.hidden) osRahulKijkt(); });
  setInterval(osRahulKijkt, 15 * 60 * 1000);

  /* Het beginscherm zit in zijn eigen blok; de rest van de app (renderAll, die
     weet wanneer je gegevens binnen zijn) zit in een ander. Daarom hangen we
     Rahuls opening hier aan het venster: dat is de enige draad tussen die twee,
     en zo begint hij pas als er echt iets te vertellen valt. */
  window.RTGThuisRahul = { opent: osRahulOpent, vraag: osRahulVraag, kijkt: osRahulKijkt };
