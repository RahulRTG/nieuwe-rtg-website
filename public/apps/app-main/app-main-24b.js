
  /* Afgesplitst van app-main-24.js, dat over de 10 KB ging toen "Mijn loon"
     erbij kwam. De snede loopt langs een echte grens: hierboven staat WAT er
     op het OS staat (de registry, de mappen), hieronder staat hoe je WERK
     opent. Twee onderwerpen die elkaar niet nodig hebben. */
  /* ---------- Werk op het OS + de algemene pin ----------
     De werk-apps zijn gewone apps op het RTG-OS: een tik op "Mijn werkplekken"
     toont de
     werkplekken die aan het ene RTG-account gekoppeld zijn (bevoegdheid), en
     openen gaat met de algemene pin (het bewijs), dezelfde pin die de
     privacygevoelige apps op dit OS beschermt. Onder water munt
     /api/account/start de werksessie, dus alle regels (zoals het werkvenster
     van de werkgever) blijven gewoon gelden. Deelt de OS-IIFE-scope:
     OSAPPS/MAPPEN/LINKS komen uit 25-os-01.js, de kiezer-scrim uit 01b. */
  /* "Mijn werkplekken", en niet "Werk". Deze tegel staat in Het Huis naast
     "Werk OS" (de werkplek-app zelf, link:werk) en droeg hetzelfde koffertje-
     icoon: twee tegels die er identiek uitzagen en bijna hetzelfde heetten,
     terwijl ze iets anders doen. Dit is de KIEZER -- hij toont de werkplekken
     die aan je RTG-account gekoppeld zijn (personeel, leverancier, kantoor) en
     opent die met je algemene pin. De naam zegt dat nu. */
  OSAPPS.werk = { naam: 'Mijn werkplekken' };
  // Werk staat in de map "Het Huis" en opent met de algemene pin.
  // deze apps zijn prive: openen kan pas na de algemene pin (5 min geldig)
  for (const pk of ['berichten', 'vonk', 'rendezvous', 'wbw', 'loonstrook']) { if (LINKS[pk]) LINKS[pk].prive = true; }

  let pinOkTot = 0; // de pin blijft vijf minuten geldig, zoals op een telefoon
  // de werkplek-zone kan om een positie vragen: dan een keer ophalen en
  // opnieuw proberen; de server vergelijkt en bewaart er niets van
  const vraagPositie = () => new Promise(af => {
    if (!navigator.geolocation) return af(null);
    navigator.geolocation.getCurrentPosition(
      p => af({ lat: p.coords.latitude, lng: p.coords.longitude }),
      () => af(null), { enableHighAccuracy: true, timeout: 8000 });
  });
  const WERKDOEL = {
    personeel: { glyf: 'navigatie', app: 'Personeel (PDA)', url: '/apps/personeel.html', bewaar: (t, r) => { localStorage.setItem('rtg_pda_token', t); localStorage.setItem('rtg_pda_code', r.code || ''); } },
    zaak:      { glyf: 'maison', app: 'Leverancier',    url: '/apps/leverancier.html', bewaar: (t) => { localStorage.setItem('rtg_sup_token', t); } },
    kantoor:   { glyf: 'office', app: 'Backoffice',     url: '/apps/backoffice.html', bewaar: (t) => { localStorage.setItem('rtg_office_token', t); } },
    /* De werkruimte van het RTG Werk OS. Die had zijn eigen tweede inlog
       (werkruimtecode + lid-token); wie zijn RTG-account er een keer aan
       koppelde, moest daarna alsnog opnieuw inloggen om binnen te komen. De
       server leest die koppeling nu ook de andere kant op, dus hier is het
       gewoon een sleutel als alle andere. Wat we bewaren is precies wat de
       losse inlog bewaart: de code en het lid-token. */
    werkruimte: { glyf: 'werk', app: 'Werk OS', url: '/apps/werk.html',
      bewaar: (t, r) => { localStorage.setItem('rtg_werk_sessie', JSON.stringify({ werkruimte: r.code, lidToken: t })); } }
  };

  /* vraag de algemene pin (of zet hem eerst) en geef hem door aan af(pin) */
  function metAlgPin(af) {
    if (Date.now() < pinOkTot) return af(null);
