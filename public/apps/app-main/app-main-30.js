/* de app-regie van de boardroom: uitgezette apps verdwijnen van het springboard */
  bouw();

  /* De app-regie van de RTG-boardroom: apps die voor deze pas zijn uitgezet
     verdwijnen van het springboard (de server weigert hun API's sowieso al;
     dit houdt het scherm eerlijk). De sleutel hier is de functie-id op het
     schakelbord; alles wat niet genoemd wordt, blijft gewoon staan. */
  const REGIE = { spelen: 'spellen', podium: 'podium', flits: 'flits', theater: 'theater',
    wbw: 'wbw', passkeys: 'webauthn', ov: 'ov', clips: 'clips', office: 'kantoorpakket', vonk: 'vonk',
    mediaos: 'mediaos' };
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
    /* De RTG Rekening-tegel bestaat pas als de boardroom de rekeninglaag live heeft
       gezet: de registry-invoer ontbreekt standaard ('link:bank' in de indeling
       blijft dan onzichtbaar) en komt er hier bij zodra de bank online meldt. */
    fetch('/api/bank/overzicht', { method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + tok }, body: '{}' })
      .then(r => (r.ok ? r.json() : null))
      .then(d => {
        if (d && d.online) { LINKS.bank = { naam: 'RTG Rekening', url: '/apps/geld.html#bank' }; bouw(); }
      }).catch(() => {});
  })();

  /* ============ De boardroom bestuurt het beginscherm ============
     Er is EEN boardroom, en die staat op de server (/api/member/boardroom,
     kern/lidboard). Daar zet je je functies aan en uit; de stand reist mee naar
     al je toestellen en de server handhaaft hem ook echt op de API.

     Dit scherm is daar de spiegel van, geen tweede lijstje. Zet je "Spelen" uit
     in je boardroom, dan verdwijnt de tegel hier -- niet omdat dit scherm een
     eigen voorkeur bijhoudt (dat was een lijstje in localStorage dat alleen op
     dit toestel bestond en de API niets deed), maar omdat de functie zelf uit
     staat. Een tegel die je wel kunt openen maar die daarna 403 geeft, is
     erger dan geen tegel.

     Wat er niet in BORDKAART staat, kent geen boardroom-schakelaar en staat er
     dus altijd: de mappen houden het scherm toch al rustig. */
  var BORDKAART = {
    'tab:reizen': 'reizen',
    'tab:salon': 'salon',
    'tab:bestellen': 'bestellen',
    'tab:betalen': 'pay',
    'tab:zorg': 'care',
    'link:spelen': 'spelen',
    'link:berichten': 'dm',
    'link:wallet': 'wallet'
  };
  var bordUit = null;   // Set met functie-id's die UIT staan; null = nog niet geladen
  function isAan(item) {
    if (!bordUit) return true;                 // nog niets geladen: niets verbergen
    var fid = BORDKAART[item];
    return !fid || !bordUit.has(fid);
  }
  function laadBoardroom() {
    var tok = null; try { tok = localStorage.getItem('rtg_member_token'); } catch (e) {}
    if (!tok) return;
    fetch('/api/member/boardroom', { method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + tok }, body: '{}' })
      .then(function (r) { return r.ok ? r.json() : null; })
      .then(function (d) {
        if (!d || !d.bord) return;
        var uit = new Set();
        (d.bord.categorieen || []).forEach(function (cat) {
          (cat.functies || []).forEach(function (fn) { if (!fn.aan) uit.add(fn.id); });
        });
        bordUit = uit;
        bouw();
      }).catch(function () { /* geen bord: dan staat alles gewoon aan */ });
  }
  laadBoardroom();
  // terug van de boardroom-app? Dan de verse stand ophalen.
  window.addEventListener('pageshow', function (e) { if (e.persisted) laadBoardroom(); });

  // De tegel in het bedieningspaneel opent de echte boardroom.
  var ccBoard = $('#osCcBoardroom');
  if (ccBoard) ccBoard.addEventListener('click', function () {
    sluitScrims();
    location.href = '/apps/boardroom.html';
  });
