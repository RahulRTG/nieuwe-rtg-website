  bouw();

  /* De app-regie van de RTG-boardroom: apps die voor deze pas zijn uitgezet
     verdwijnen van het springboard (de server weigert hun API's sowieso al;
     dit houdt het scherm eerlijk). De sleutel hier is de functie-id op het
     schakelbord; alles wat niet genoemd wordt, blijft gewoon staan. */
  const REGIE = { spelen: 'spellen', podium: 'podium', flits: 'flits', theater: 'theater',
    wbw: 'wbw', passkeys: 'webauthn', ov: 'ov', clips: 'clips', office: 'kantoorpakket', vonk: 'vonk' };
  (function () {
    let tok = null; try { tok = localStorage.getItem('rtg_member_token'); } catch (e) {}
    if (!tok) return;
    fetch('/api/member/apps', { method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + tok }, body: '{}' })
      .then(r => (r.ok ? r.json() : null))
      .then(d => {
        if (!d || !Array.isArray(d.uit) || !d.uit.length) return;
        const uit = new Set(d.uit);
        let anders = false;
        for (const sleutel of Object.keys(REGIE))
          if (uit.has(REGIE[sleutel]) && LINKS[sleutel]) { delete LINKS[sleutel]; anders = true; }
        if (anders) bouw();
      }).catch(() => {});
    /* De RTG Bank-tegel bestaat pas als de boardroom de leden-bank live heeft
       gezet: de registry-invoer ontbreekt standaard ('link:bank' in de indeling
       blijft dan onzichtbaar) en komt er hier bij zodra de bank online meldt. */
    fetch('/api/bank/overzicht', { method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + tok }, body: '{}' })
      .then(r => (r.ok ? r.json() : null))
      .then(d => {
        if (d && d.online) { LINKS.bank = { naam: 'RTG Bank', url: '/apps/bank.html' }; bouw(); }
      }).catch(() => {});
  })();

  /* ====================== Aan en uit (geen App Store) ======================
     Er valt niets te installeren: alles waar je pas je recht op geeft staat
     al in je mappen. Wat je bewaart is dus precies andersom als vroeger --
     niet een lijstje van wat AAN staat, maar van wat je hebt UITgezet. Dat
     scheelt een concept ("de Store"), en een nieuwe app hoeft niet gevonden
     te worden: hij staat er de volgende keer gewoon bij.

     De functierij onder de klok (bellen, berichten, videobellen, wallet) kan
     niet uit: dat is de basis van het toestel. Dit blok staat bewust op het
     topniveau van de OS-IIFE, want functie-declaraties worden gehoist en
     itemZichtbaar() hierboven gebruikt isAan() al. */
  function uitLijst() { try { return JSON.parse(localStorage.getItem('rtg_os_uit_' + pas) || '[]') || []; } catch (e) { return []; } }
  function zetUit(a) { try { localStorage.setItem('rtg_os_uit_' + pas, JSON.stringify(a)); } catch (e) {} }
  function isAan(item) { return uitLijst().indexOf(item) < 0; }
  function zetAan(item, aan) {
    var a = uitLijst().filter(function (x) { return x !== item; });
    if (!aan) a.push(item);
    zetUit(a); bouw();
  }

  var winkelScrim = $('#osWinkelScrim'), winkelLijst = $('#osWinkelLijst'), winkelTitel = $('#osWinkelTitel');
  function winkelRij(item) {
    var rij = document.createElement('div'); rij.className = 'os-winkel-rij';
    var zi = document.createElement('span'); zi.className = 'zi'; zi.appendChild(tegelInhoud(item)); rij.appendChild(zi);
    var naam = document.createElement('span'); naam.className = 'os-winkel-naam'; naam.textContent = itemNaam(item); rij.appendChild(naam);
    var knop = document.createElement('button'); knop.type = 'button'; knop.className = 'os-winkel-knop';
    var verf = function () {
      var aan = isAan(item);
      knop.textContent = aan ? T('os.board.aan', 'Staat aan') : T('os.board.uit', 'Staat uit');
      knop.setAttribute('aria-pressed', aan ? 'true' : 'false');
      knop.classList.toggle('geinst', !aan);
    };
    knop.addEventListener('click', function () { zetAan(item, !isAan(item)); verf(); });
    verf(); rij.appendChild(knop);
    return rij;
  }
  /* De schakelbare functies, per map gegroepeerd: precies wat er in je mappen
     staat, plus wat je hebt uitgezet (dat valt uit itemZichtbaar, dus dat
     halen we er hier expliciet bij -- anders kon je het nooit meer aanzetten). */
  function winkelGroepen() {
    var uit = [];
    MAPPEN.forEach(function (map) {
      var items = map.items.filter(function (it) {
        if (FUNCTIES.indexOf(it) >= 0) return false;           // de vaste basis niet
        return itemZichtbaar(it) || (!isAan(it) && bestaatItem(it));
      });
      if (items.length) uit.push({ titel: mapNaam(map), items: items });
    });
    return uit;
  }
  // bestaat de app echt (los van aan/uit)? Zelfde regels als itemZichtbaar,
  // alleen zonder de aan/uit-toets.
  function bestaatItem(item) {
    if (item.startsWith('tab:')) return tabZichtbaar(item.slice(4));
    if (item.startsWith('link:') && PREMIUM.has(item.slice(5)) && !premiumPas) return false;
    return !!itemDef(item);
  }

  /* ---------- De Boardroom: uw eigen regiekamer ----------
     De enige plek waar u aan uw beginscherm sleutelt: bovenaan een telling
     (hoeveel functies aan staan van hoeveel u er mag), dan de vaste basis als
     vergrendelde rij (met een slot-glyf, niet uit te zetten), en daaronder
     per map de functies waar u recht op heeft, met een aan/uit-schakelaar.
     Alles staat standaard aan; hier zet u uit wat u niet wilt zien. */
  var BASIS_REGELS = [
    { glyf: 'bellen',  naam: 'Bellen, videobellen en berichten' },
    { glyf: 'pas',     naam: 'Uw wallet met de ledenpas' },
    { glyf: null, mono: 'R', naam: 'Rahul, uw AI' },
    { glyf: 'rtf',     naam: 'De RTFoundation' }
  ];
  function boardBasisRij(def) {
    var rij = document.createElement('div'); rij.className = 'os-board-rij os-board-vast';
    var zi = document.createElement('span'); zi.className = 'zi';
    var g = def.glyf && window.RTGGlyf && RTGGlyf.svg(def.glyf);
    if (g) zi.appendChild(g);
    else { var mo = document.createElement('span'); mo.className = 'os-monogram'; mo.textContent = def.mono || '•'; zi.appendChild(mo); }
    rij.appendChild(zi);
    var naam = document.createElement('span'); naam.className = 'os-winkel-naam'; naam.textContent = def.naam; rij.appendChild(naam);
    var slot = document.createElement('span'); slot.className = 'os-board-slot'; slot.setAttribute('aria-label', T('os.board.vast', 'Altijd aan'));
    var sg = window.RTGGlyf && RTGGlyf.svg('slot'); if (sg) slot.appendChild(sg);
    rij.appendChild(slot);
    return rij;
  }
  function openBoardroom() {
    if (!winkelScrim) return;
    sluitScrims();
    if (winkelTitel) winkelTitel.textContent = T('os.board.h', 'Boardroom');
    winkelLijst.textContent = '';
    var intro = document.createElement('p'); intro.className = 'os-winkel-intro';
    intro.textContent = T('os.board.uitleg', 'Uw eigen regiekamer: alles waar u recht op heeft staat al in uw mappen. Hier zet u uit wat u niet wilt zien, en weer aan als u het toch mist. De basis van het toestel (bellen, berichten, uw wallet, Rahul en de RTFoundation) blijft altijd aan, zodat het systeem veilig en werkend blijft.');
    winkelLijst.appendChild(intro);

    // telling: hoeveel van de schakelbare functies staan aan
    var groepen = winkelGroepen();
    var alle = []; groepen.forEach(function (g) { alle = alle.concat(g.items); });
    var aan = alle.filter(isAan).length;
    var sum = document.createElement('div'); sum.className = 'os-board-sum';
    var cijfer = document.createElement('strong'); cijfer.textContent = aan + ' / ' + alle.length;
    sum.appendChild(cijfer);
    sum.appendChild(document.createTextNode(' ' + T('os.board.telling', 'functies staan aan')));
    winkelLijst.appendChild(sum);

    // de vaste basis, vergrendeld
    var basisKop = document.createElement('div'); basisKop.className = 'os-winkel-groep';
    basisKop.textContent = T('os.board.basis', 'Altijd aan · de basis');
    winkelLijst.appendChild(basisKop);
    BASIS_REGELS.forEach(function (d) { winkelLijst.appendChild(boardBasisRij(d)); });

    // en de functies waar u recht op heeft, met een schakelaar
