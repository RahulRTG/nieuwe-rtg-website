/* RTG Rit -- EEN rit uit uw eigen ritten, met een adres.

   Hetzelfde gat als bij het voertuig: `rtg://rit/<ref>` kon nergens heen, want
   geen app opende er EEN. Een ticket of taak over "de rit van dinsdag" droeg
   daardoor hooguit die woorden.

   OOK HIER HETEN TWEE DINGEN RIT, EN DIT IS DE VERWIJSBARE. `db.data.rides` is
   de oudere rittenrij waar de leverancierskant en de fiscale laag uit lezen; de
   Mobility OS werkt met OPDRACHTEN, en die dragen een stabiele `ref`, een van-
   en-naar, een status, een vervoerder en een voertuig. Dat is wat een mens
   "mijn rit" noemt en waar een verwijzing dus over gaat.

   DE DEUR IS UW EIGEN SESSIE, EN HIJ IS SMALLER DAN HET SCHERM. /api/mob/mijn
   geeft alleen de opdrachten van de INGELOGDE reiziger; er is geen parameter
   waarmee je die van een ander opvraagt. Dit bestand kiest er daarna een uit op
   `ref`. Een ref die er niet bij staat is dus of niet van u, of hij bestaat
   niet -- en welke van de twee zegt dit scherm bewust niet, want dat verschil
   verraadt of andermans rit bestaat.

   ER WORDT NIETS BIJGEREKEND. Prijs, status en de gebeurtenissen komen zoals de
   server ze geeft; twee plekken die uitrekenen wat een rit kost, lopen uiteen
   (LAT-regel 4). Dit bestand tekent ze alleen. */
(() => {
  const $ = s => document.querySelector(s);
  const token = (() => { try { return localStorage.getItem('rtg_token'); } catch (e) { return null; } })();
  const gevraagd = new URLSearchParams(location.search).get('rit') || '';

  const api = (pad, body) => fetch('/api/mob/' + pad, { method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + token },
    body: JSON.stringify(body || {}) }).then(async r => ({ status: r.status, body: await r.json().catch(() => ({})) }));

  let meldT;
  const zeg = t => { const m = $('#melding'); m.textContent = t; m.classList.add('zien');
    clearTimeout(meldT); meldT = setTimeout(() => m.classList.remove('zien'), 4200); };
  const leeg = el => { while (el.firstChild) el.removeChild(el.firstChild); };
  const eur = c => Number.isFinite(c) ? '€ ' + (c / 100).toLocaleString('nl-NL', { minimumFractionDigits: 2 }) : null;

  function rij(naam, waarde, klasse) {
    const d = document.createElement('div'); d.className = 'rij';
    const a = document.createElement('span'); a.textContent = naam;
    const b = document.createElement('b'); b.textContent = waarde;
    if (klasse) b.className = 'stand ' + klasse;
    d.appendChild(a); d.appendChild(b); return d;
  }

  const KLAAR = ['afgerekend', 'voltooid'];
  const WEG = ['geannuleerd'];

  function toonDit(o) {
    $('#dit').hidden = false; $('#geen').hidden = true;
    $('#vNaam').textContent = (o.van || '?') + ' naar ' + (o.naar || '?');
    $('#vSub').textContent = [o.ref, o.categorie, o.ritsoort].filter(Boolean).join(' · ');

    const stand = $('#vStand'); leeg(stand);
    const s = document.createElement('span');
    s.className = 'stand ' + (WEG.includes(o.status) ? 'nee' : (KLAAR.includes(o.status) ? 'ja' : 'bijna'));
    s.textContent = o.status || 'onbekend';
    stand.appendChild(s);

    const red = $('#vRedenen'); leeg(red);
    const lijst = document.createElement('ul');
    if (o.annulering) {
      const li = document.createElement('li');
      li.textContent = '· geannuleerd: ' + (o.annulering.reden || o.annulering);
      lijst.appendChild(li);
    }
    for (const g of (o.gebeurtenissen || []).slice(-6)) {
      const li = document.createElement('li');
      li.textContent = '· ' + (g.wat || g.status || JSON.stringify(g));
      lijst.appendChild(li);
    }
    if (!lijst.childNodes.length) {
      const li = document.createElement('li');
      li.textContent = 'Geen bijzonderheden vastgelegd bij deze rit.';
      lijst.appendChild(li);
    }
    red.appendChild(lijst);

    const reis = $('#vReis'); leeg(reis);
    reis.appendChild(rij('van', o.van || '-'));
    reis.appendChild(rij('naar', o.naar || '-'));
    if (o.vertrekWens) reis.appendChild(rij('vertrek gewenst', o.vertrekWens));
    if (o.aankomstWens) reis.appendChild(rij('aankomst gewenst', o.aankomstWens));
    if (Number.isFinite(o.reizigers)) reis.appendChild(rij('reizigers', String(o.reizigers)));
    if (Number.isFinite(o.km)) reis.appendChild(rij('afstand', o.km + ' km'));
    if (Number.isFinite(o.minuten)) reis.appendChild(rij('duur', o.minuten + ' min'));
    const p = eur(o.prijs);
    if (p) reis.appendChild(rij('prijs', p));

    const wie = $('#vWie'); leeg(wie);
    wie.appendChild(rij('vervoerder', o.vervoerder || 'nog niet toegewezen'));
    wie.appendChild(rij('voertuig', o.voertuig || 'nog niet toegewezen'));
    wie.appendChild(rij('chauffeur', o.chauffeur || 'nog niet toegewezen'));
    /* "Nog niet toegewezen" is een echte stand en geen ontbrekend gegeven: een
       rit wordt aangevraagd voordat er een auto aan hangt. Dat verschil hoort er
       te staan, anders leest een leeg vak als een fout. */
    $('#vWieLet').textContent = 'Wat hier op "nog niet toegewezen" staat, is nog niet gekozen -- dat is een stand van de rit en geen ontbrekende invoer.';
  }

  function toonLijst(ritten) {
    const doel = $('#vloot'); leeg(doel);
    for (const o of ritten) {
      const b = document.createElement('button');
      b.type = 'button'; b.className = 'vlootrij';
      b.textContent = (o.van || '?') + ' naar ' + (o.naar || '?') + ' · ' + (o.status || '');
      b.addEventListener('click', () => {
        history.replaceState(null, '', '?rit=' + encodeURIComponent(o.ref));
        toonDit(o);
      });
      doel.appendChild(b);
    }
    $('#vlootLet').textContent = ritten.length
      ? 'Dit zijn uw eigen ritten. Er is geen manier om die van iemand anders op te vragen: /api/mob/mijn kent uw sessie en geen parameter voor een ander.'
      : 'U heeft nog geen ritten.';
  }

  async function laad() {
    if (!token) {
      $('#geen').hidden = false;
      $('#geenTekst').textContent = 'Meld u aan om uw ritten te zien. Zonder sessie wordt hier niets getoond -- dat is geen leeg scherm maar een gesloten deur.';
      return;
    }
    const r = await api('mijn');
    if (r.status !== 200) {
      $('#geen').hidden = false;
      $('#geenTekst').textContent = (r.body && r.body.error) || 'Uw ritten konden niet worden geladen.';
      return;
    }
    const ritten = ((r.body && r.body.ritten) || []).slice();
    if (r.body && r.body.lopend && !ritten.some(o => o.ref === r.body.lopend.ref)) ritten.unshift(r.body.lopend);
    toonLijst(ritten);
    if (!gevraagd) {
      $('#geen').hidden = false;
      $('#geenTekst').textContent = 'Kies een rit hieronder, of open er een met een adres: ?rit=<ref>.';
      return;
    }
    const o = ritten.find(x => x.ref === gevraagd);
    if (!o) {
      $('#geen').hidden = false;
      $('#geenTekst').textContent = 'Rit "' + gevraagd + '" staat niet bij uw ritten. Dat betekent of dat hij niet van u is, of dat hij niet bestaat; welke van de twee zegt dit scherm bewust niet.';
      return;
    }
    toonDit(o);
  }

  $('#ververs').addEventListener('click', () => { laad().then(() => zeg('Bijgewerkt.')); });
  laad();
})();
