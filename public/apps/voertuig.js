/* RTG Voertuig -- EEN voertuig uit de vloot, met een adres.

   WAAROM DIT SCHERM ER IS. De verwijsvorm van dit huis (rtg://<soort>/<id>) kon
   nergens heen voor een voertuig: er was geen app die er EEN opende. Een ticket
   over een kapotte bus droeg daardoor hooguit "bus 28" in de vrije tekst, en dat
   is geen verwijzing maar een hoop. Dit is het adres dat daaraan ontbrak.

   TWEE DINGEN HETEN HIER VOERTUIG, EN DIT IS DE DUURZAME. `db.data.ovVoertuigen`
   is een LIVE positie met een houdbaarheid van twee minuten -- die verdwijnt
   zodra een chauffeur zijn dienst beeindigt, en er dus naar verwijzen zou een
   link opleveren die vrijwel altijd dood is. Dit scherm toont een `mobAsset`:
   het voertuig zelf, met zijn papieren, en dat bestaat morgen nog. "Bus 28 is
   defect" gaat over dit ding en niet over een positie.

   DE KERN VAN HET SCHERM IS DE FAIL-CLOSED PAPIERENREGEL die in
   kern/mobiliteit/assets.js staat: een verplicht document zonder geldige
   einddatum telt als ONGELDIG en niet als "vast wel in orde". Er wordt hier
   niets bijgerekend -- inzetbaar, de redenen en wat er bijna afloopt komen
   kant-en-klaar van de server, want twee plekken die uitrekenen of een taxi mag
   rijden, lopen uiteen (LAT-regel 4). Dit bestand tekent ze alleen.

   WIE ER BINNENKOMT is de vervoerder zelf: /api/supplier/mob/vloot hangt achter
   supplierAuth. Wie geen sleutel heeft, ziet dat en niet een leeg scherm. */
(() => {
  const $ = s => document.querySelector(s);
  const token = (() => { try { return localStorage.getItem('rtg_pda_token'); } catch (e) { return null; } })();
  const gevraagd = new URLSearchParams(location.search).get('voertuig') || '';

  const api = (pad, body) => fetch('/api/supplier/mob/' + pad, { method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + token },
    body: JSON.stringify(body || {}) }).then(async r => ({ status: r.status, body: await r.json().catch(() => ({})) }));

  let meldT;
  const zeg = t => { const m = $('#melding'); m.textContent = t; m.classList.add('zien');
    clearTimeout(meldT); meldT = setTimeout(() => m.classList.remove('zien'), 4200); };
  const leeg = el => { while (el.firstChild) el.removeChild(el.firstChild); };

  function rij(naam, waarde, klasse) {
    const d = document.createElement('div'); d.className = 'rij';
    const a = document.createElement('span'); a.textContent = naam;
    const b = document.createElement('b'); b.textContent = waarde;
    if (klasse) { b.className = 'stand ' + klasse; }
    d.appendChild(a); d.appendChild(b); return d;
  }

  function toonPapieren(v) {
    const doel = $('#vPapieren'); leeg(doel);
    const verplicht = v.verplichtePapieren || [];
    if (!verplicht.length) {
      doel.appendChild(rij('geen verplichte papieren', 'voor deze categorie'));
      $('#vPapierenLet').textContent = 'Deze voertuigcategorie kent geen verplichte documenten. Dat is een eigenschap van de categorie en geen ontbrekende invoer.';
      return;
    }
    const papieren = v.papieren || {};
    for (const naam of verplicht) {
      const p = papieren[naam];
      const tot = p && (p.tot || p.geldigTot || p.einddatum);
      doel.appendChild(rij(naam, tot ? 'tot ' + tot : 'geen einddatum', tot ? '' : 'nee'));
    }
    /* De zin die dit scherm draagt. Hij staat er ALTIJD, ook als alles groen is:
       wie hem alleen bij een probleem leest, denkt bij een leeg scherm dat er
       niets gecontroleerd is. */
    $('#vPapierenLet').textContent = 'Een verplicht document zonder geldige einddatum telt als ONGELDIG, niet als "vast wel in orde" -- daarom staat een voertuig zonder papieren niet op beschikbaar maar op geblokkeerd, met de reden erbij.';
  }

  function toonDit(v) {
    $('#dit').hidden = false; $('#geen').hidden = true;
    $('#vNaam').textContent = v.naam || v.id;
    $('#vSub').textContent = [v.categorieNaam, v.registratie, v.laag].filter(Boolean).join(' · ');

    const stand = $('#vStand'); leeg(stand);
    const s = document.createElement('span');
    s.className = 'stand ' + (v.inzetbaar ? 'ja' : 'nee');
    s.textContent = v.inzetbaar ? 'inzetbaar' : 'niet inzetbaar';
    stand.appendChild(s);
    if ((v.bijnaOp || []).length) {
      const b = document.createElement('span');
      b.className = 'stand bijna'; b.textContent = v.bijnaOp.length + ' loopt bijna af';
      stand.appendChild(document.createTextNode(' '));
      stand.appendChild(b);
    }

    const red = $('#vRedenen'); leeg(red);
    const lijst = document.createElement('ul');
    for (const r of (v.redenen || [])) {
      const li = document.createElement('li'); li.textContent = '· ' + r; lijst.appendChild(li);
    }
    for (const b of (v.bijnaOp || [])) {
      const li = document.createElement('li');
      li.textContent = '· loopt bijna af: ' + (typeof b === 'string' ? b : (b.naam || JSON.stringify(b)));
      lijst.appendChild(li);
    }
    if (!lijst.childNodes.length) {
      const li = document.createElement('li');
      li.textContent = 'Geen blokkade en niets dat bijna afloopt.';
      lijst.appendChild(li);
    }
    red.appendChild(lijst);

    const ken = $('#vKenmerken'); leeg(ken);
    ken.appendChild(rij('plaatsen', String(v.plaatsen)));
    ken.appendChild(rij('bagage', String(v.bagage)));
    ken.appendChild(rij('rolstoeltoegankelijk', v.rolstoel ? 'ja' : 'nee'));
    ken.appendChild(rij('bemanning nodig', String(v.bemanningNodig)));
    ken.appendChild(rij('onderhoud', v.onderhoud || 'in orde'));
    if (v.uitDienst) ken.appendChild(rij('uit dienst', 'ja', 'nee'));
  }

  function toonVloot(assets) {
    const doel = $('#vloot'); leeg(doel);
    for (const a of assets) {
      const b = document.createElement('button');
      b.type = 'button'; b.className = 'vlootrij';
      b.textContent = (a.naam || a.id) + ' · ' + (a.inzetbaar ? 'inzetbaar' : 'niet inzetbaar');
      b.addEventListener('click', () => {
        history.replaceState(null, '', '?voertuig=' + encodeURIComponent(a.id));
        toonDit(a); toonPapieren(a);
      });
      doel.appendChild(b);
    }
    $('#vlootLet').textContent = assets.length
      ? 'Deze vloot is van de vervoerder waarmee u bent aangemeld; voertuigen van een andere vervoerder staan hier niet.'
      : 'Er staat geen voertuig op naam van deze vervoerder.';
  }

  async function laad() {
    if (!token) {
      $('#geen').hidden = false;
      $('#geenTekst').textContent = 'Dit scherm is van de vervoerder: meld u aan met uw personeelssleutel. Zonder sleutel wordt hier niets getoond -- dat is geen leeg scherm maar een gesloten deur.';
      return;
    }
    const r = await api('vloot');
    if (r.status !== 200) {
      $('#geen').hidden = false;
      $('#geenTekst').textContent = (r.body && r.body.error) || 'De vloot kon niet worden geladen.';
      return;
    }
    const assets = (r.body && r.body.assets) || [];
    toonVloot(assets);
    if (!gevraagd) {
      $('#geen').hidden = false;
      $('#geenTekst').textContent = 'Kies een voertuig uit de vloot hieronder, of open er een met een adres: ?voertuig=<id>.';
      return;
    }
    const v = assets.find(a => a.id === gevraagd);
    if (!v) {
      $('#geen').hidden = false;
      /* Er wordt NIET geraden welk voertuig bedoeld werd. Een id dat hier niet
         staat, hoort bij een andere vervoerder of bestaat niet meer -- en die
         twee zeggen we niet uit elkaar, want dat verschil verraadt of een
         voertuig bij een ander bestaat. */
      $('#geenTekst').textContent = 'Voertuig "' + gevraagd + '" staat niet in deze vloot. Dat betekent of dat het niet (meer) bestaat, of dat het bij een andere vervoerder hoort; welke van de twee zegt dit scherm bewust niet.';
      return;
    }
    toonDit(v); toonPapieren(v);
  }

  $('#ververs').addEventListener('click', () => { laad().then(() => zeg('Bijgewerkt.')); });
  laad();
})();
