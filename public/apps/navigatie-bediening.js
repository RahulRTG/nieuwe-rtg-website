/* RTG Navigatie: de bediening rond de kaart. De status van de motor (de
   badge, met "Demonstratienet" waar dat zo is), inspreken, de poort met
   "Kies vertrekpunt", de kaartlagen en een wegprobleem melden. De stand staat
   in window.RTGNav (navigatie-kern.js). */
(() => {
  'use strict';
  const N = window.RTGNav, { $, S, LAAG, api, zeg, toon, token, landVan } = N;

  /* DE STATUS WORDT OOK OPGEHAALD ALS DE KAART FAALT -- juist dan. Een badge
     die niet is bijgewerkt is geen lege badge; hij liegt. Wat er staat komt
     uit `net` en `routeerbaarHier` van de motor zelf, en een demonstratienet
     heet ook zo. */
  N.haalStatus = async function haalStatus() {
    const r = await api('status', S.hier ? { lat: S.hier.lat, lng: S.hier.lng, land: S.land } : {});
    if (r.status !== 200) return;
    $('#sourceNetwork').textContent = r.body.live ? r.body.live.netwerk : '0';
    $('#sourcePartners').textContent = r.body.live ? r.body.live.partners : '0';
    const dekking = r.body.dekking;
    if (r.body.net === 'gebied' && dekking) {
      /* Een geladen gebiedspakket is geen NWB en geen raster, en de
         naamsvermelding die ODbL eist staat waar de bron van een route staat. */
      $('#sourceCore').textContent = dekking.land || 'Kaart';
      $('#sourceCoreLabel').textContent = dekking.licentie || 'Kaartdata';
      if (dekking.naamsvermelding) $('#bron').textContent = dekking.naamsvermelding;
    } else if (dekking && dekking.actief) {
      $('#sourceCore').textContent = N.getal(dekking.wegvakken / 1000000, 2) + ' mln';
      $('#sourceCoreLabel').textContent = 'NWB-wegvakken';
    } else if (r.body.net === 'geen') {
      $('#sourceCore').textContent = 'Geen';
      $('#sourceCoreLabel').textContent = 'Kaartdata';
    }
    const badge = { nwb: 'NWB Nederland actief', demonstratie: 'Demonstratienet',
      geen: 'Geen kaartdata voor Nederland',
      gebied: (r.body.dekking && r.body.dekking.land ? r.body.dekking.land : 'Kaart') + ' actief',
      'gebied-geen': 'Kaart nog niet gebouwd' }[r.body.net];
    $('#liveBadge').textContent = badge || (r.body.routeerbaarHier === false ? 'Motor kan hier niet routeren' : (r.body.motor || 'Motor actief'));
    /* Alleen melden wat de gebruiker tegenhoudt. */
    if (r.body.routeerbaarHier === false && r.body.netReden) zeg(r.body.netReden);
  };

  (() => {
    const Speech = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!Speech) { $('#voice').hidden = true; return; }
    const spraak = new Speech(); spraak.lang = 'nl-NL'; spraak.interimResults = false;
    $('#voice').addEventListener('click', () => { try { spraak.start(); $('#voice').setAttribute('aria-pressed', 'true'); } catch (_) {} });
    spraak.addEventListener('result', e => {
      const tekst = e.results && e.results[0] && e.results[0][0] ? e.results[0][0].transcript : '';
      $('#zoek').value = tekst; N.zoekBestemmingen(tekst);
    });
    spraak.addEventListener('end', () => $('#voice').setAttribute('aria-pressed', 'false'));
    spraak.addEventListener('error', () => { $('#voice').setAttribute('aria-pressed', 'false'); zeg('Inspreken is nu niet beschikbaar.'); });
  })();

  $('#manualStart').addEventListener('click', () => {
    $('#manualStart').hidden = true; $('#manualPanel').hidden = false; $('#startZoek').focus();
    zoekVertrek('');
  });
  /* Kiest iemand een bestemming terwijl zijn plek onbekend is, dan landt hij
     hier en niet bij een serverfout over een veld dat hij nooit heeft gezien. */
  N.vraagVertrekpunt = function vraagVertrekpunt() {
    if (!$('#poortReden').textContent.trim()) $('#poortReden').textContent = 'RTG weet nog niet waar u bent. Kies zelf uw vertrekpunt; RTG verzint nooit waar u staat.';
    toon('#poort', true);
    if (token) $('#poortKaarten').hidden = false;
    if ($('#manualPanel').hidden) $('#manualStart').hidden = false;
  };
  let startT, startVraag = 0;
  $('#startZoek').addEventListener('input', e => {
    clearTimeout(startT); startT = setTimeout(() => zoekVertrek(e.target.value.trim()), 180);
  });
  async function zoekVertrek(q) {
    const vraag = ++startVraag;
    const r = await api('bestemmingen', { q });
    if (r.status !== 200 || vraag !== startVraag) return;
    const lijst = $('#startResultaten'); lijst.textContent = '';
    for (const p of (r.body.bestemmingen || []).slice(0, 8)) {
      const b = document.createElement('button'); b.type = 'button'; b.className = 'ds-vel__rij';
      const nm = document.createElement('span'); nm.className = 'ds-vel__naam';
      const naam = document.createElement('strong'); naam.textContent = p.naam;
      const soort = document.createElement('small'); soort.textContent = (LAAG[p.laag] || LAAG.leverancier).naam + (p.extra ? ' · ' + p.extra : '');
      nm.append(naam, soort); b.append(N.stip(p.laag), nm);
      b.addEventListener('click', async () => {
        S.hier = { lat: p.lat, lng: p.lng }; S.land = landVan(S.hier); S.wachtNogOpPlek = false;
        toon('#poort', false);
        await N.initialiseerKaart(); zeg('Vertrekpunt ingesteld op ' + p.naam + '.');
      });
      lijst.appendChild(b);
    }
  }

  /* De kaartlagen, met de stip in de laagkleur: knop en legenda tegelijk.
     Een laag aanzetten zonder kaart is geen fout van de gebruiker; de knop
     zegt waarom er niets gebeurt, en de stand wordt WEL onthouden. */
  for (const laag of ['leverancier', 'ov', 'laad', 'tank', 'civic', 'flits']) {
    const b = document.createElement('button'); b.type = 'button'; b.className = 'ds-chip';
    b.dataset.laag = laag; b.setAttribute('aria-pressed', String(!!S.actief[laag]));
    b.append(N.stip(laag), ' ' + LAAG[laag].knop);
    b.addEventListener('click', async () => {
      S.actief[laag] = !S.actief[laag]; b.setAttribute('aria-pressed', S.actief[laag]);
      if (!S.kaartData) { zeg(($('#poort').classList.contains('zien') && $('#poortReden').textContent)
        || 'De kaart is er nog niet: kies eerst een vertrekpunt.'); return; }
      if (laag === 'flits' && S.actief.flits) await haalFlits();
      N.bouwPinnen();
    });
    $('#lagen').appendChild(b);
  }
  N.haalFlits = haalFlits;
  async function haalFlits() {
    if (!S.hier) return;
    const r = await api('poi', { lagen: ['flits'], lat: S.hier.lat, lng: S.hier.lng, land: S.land });
    if (r.status === 200) S.flitsPunten = (r.body.lagen.flits || []).map(f => ({ ...f, laag: 'flits' }));
  }

  /* Een wegprobleem melden (terug het Flits-netwerk in): vier knoppen in het
     scherm zelf, met het toetsenbord en een schermlezer te bedienen; geen
     venster van de browser dat de pagina blokkeert. */
  function toonMeldkeuze(open) {
    $('#meldkeuze').hidden = !open;
    $('#meldknop').setAttribute('aria-expanded', String(open));
    if (open) $('#meldkeuze').querySelector('button').focus();
  }
  $('#meldknop').addEventListener('click', () => toonMeldkeuze($('#meldkeuze').hidden));
  $('#meldkeuze').addEventListener('keydown', e => { if (e.key === 'Escape') { toonMeldkeuze(false); $('#meldknop').focus(); } });
  const MELDNAAM = { file: 'File', ongeval: 'Ongeval', object: 'Object op de weg', wegwerk: 'Wegwerkzaamheden' };
  $('#meldkeuze').addEventListener('click', async e => {
    const knop = e.target.closest('button[data-soort]'); if (!knop) return;
    const soort = knop.dataset.soort;
    toonMeldkeuze(false); $('#meldknop').focus();
    if (!soort) return;
    if (!S.hier) return zeg('Ik weet nog niet waar u bent; een melding zonder plek zegt niets.');
    const r = await api('meld', { soort, lat: S.hier.lat, lng: S.hier.lng, land: S.land });
    if (r.body.error) return zeg(r.body.error);
    zeg(r.body.bevestigd ? 'Dank u: de bestaande melding is bevestigd.' : MELDNAAM[soort] + ' gemeld voor het netwerk.');
    await haalFlits(); N.bouwPinnen();
  });
})();
