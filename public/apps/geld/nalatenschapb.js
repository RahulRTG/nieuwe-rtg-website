/* Stand Nalatenschap, deel 2 van 2: de handelingen en de registratie. Leunt
   op w.RTGGeldDeel.nalatenschap uit nalatenschap.js (stijl, tekenwerk,
   meeneembron).

   Premium: de server weigert een RTG-pas met een 403 en een nette zin. Die
   zin is hier de hele poortwachter. Er staat met opzet geen eigen deur voor,
   want een tweede oordeel naast dat van de server gaat er vroeg of laat
   naast lopen (LAT.md regel 4: een waarheid, een plek).

   Dezelfde routes als de pagina, letterlijk en volledig:
   /api/member/rechterhand/nalatenschap (het dossier),
   /api/member/rechterhand/nalatenschap/doc en /doc/weg (documenten),
   /api/member/rechterhand/nalatenschap/contact en /contact/weg (personen),
   /api/member/rechterhand/nalatenschap/wens en /wens/weg (wensen),
   /api/member/rechterhand/ai (de adviseur, met app: 'nalatenschap'). */
(function (w, d) {
  'use strict';
  var V = w.RTGGeld = w.RTGGeld || { standen: [] };
  var D = (w.RTGGeldDeel = w.RTGGeldDeel || {}).nalatenschap;
  var $ = function (s) { return d.querySelector(s); };

  async function laad() {
    var Geld = w.Geld;
    try {
      D.stand = await Geld.api('/api/member/rechterhand/nalatenschap');
      D.teken(D.stand);
    } catch (e) {
      D.stand = null;
      /* De hint alleen bij "niet ingelogd" (401): bij een 403 is de serverzin
         over de Lifestyle Pass het hele verhaal, en een 500 tegen een
         ingelogd lid "log eerst in" noemen is een leugen. De pagina toonde
         de inlogkaart ook alleen zonder token. */
      $('#nlVak').innerHTML = '<p class="stil">' + Geld.esc(e.message) +
        (e.status === 401 ? ' Log eerst in via de leden-app.' : '') + '</p>';
    }
  }

  async function docToe() {
    var Geld = w.Geld;
    var titel = $('#nlDT').value.trim();
    if (!titel) return Geld.melding('Titel?');
    try {
      await Geld.api('/api/member/rechterhand/nalatenschap/doc', {
        titel: titel, soort: $('#nlDS').value, waar: $('#nlDW').value, notitie: $('#nlDN').value
      });
      laad();
    } catch (e) { Geld.melding(e.message); }
  }

  async function conToe() {
    var Geld = w.Geld;
    var naam = $('#nlCN').value.trim();
    if (!naam) return Geld.melding('Naam?');
    try {
      await Geld.api('/api/member/rechterhand/nalatenschap/contact', {
        naam: naam, rol: $('#nlCR').value, telefoon: $('#nlCT').value, email: $('#nlCE').value
      });
      laad();
    } catch (e) { Geld.melding(e.message); }
  }

  async function wensToe() {
    var Geld = w.Geld;
    var tekst = $('#nlWX').value.trim();
    if (!tekst) return Geld.melding('Wat wilt u vastleggen?');
    try {
      await Geld.api('/api/member/rechterhand/nalatenschap/wens', { titel: $('#nlWT').value, tekst: tekst });
      laad();
    } catch (e) { Geld.melding(e.message); }
  }

  async function weg(pad, id) {
    try { await w.Geld.api(pad, { id: id }); laad(); }
    catch (e) { w.Geld.melding(e.message); }
  }

  async function vraag() {
    var Geld = w.Geld, u = $('#nlAiUit'), v = $('#nlAiIn').value.trim();
    if (!v) return;
    u.hidden = false;
    u.textContent = 'Een ogenblik…';
    try {
      var r = await Geld.api('/api/member/rechterhand/ai', { app: 'nalatenschap', vraag: v });
      u.textContent = r.antwoord || 'Geen antwoord.';
      $('#nlAiIn').value = '';
    } catch (e) { u.textContent = e.message; }
  }

  /* Gedelegeerd op de omhulling: de lijsten worden bij elke verversing
     opnieuw getekend, en de omhulling verdwijnt netjes mee als de stand
     wisselt. Alleen het document vraagt een bevestiging, precies als op de
     pagina: daar staat het "waar het ligt" in dat niemand uit zijn hoofd
     opnieuw intikt. */
  function klik(e) {
    var b = e.target.closest('button');
    if (!b) return;
    if (b.dataset.nldoc) {
      if (!w.confirm('Dit document verwijderen?')) return;
      return weg('/api/member/rechterhand/nalatenschap/doc/weg', b.dataset.nldoc);
    }
    if (b.dataset.nlcon) return weg('/api/member/rechterhand/nalatenschap/contact/weg', b.dataset.nlcon);
    if (b.dataset.nlwen) weg('/api/member/rechterhand/nalatenschap/wens/weg', b.dataset.nlwen);
  }

  // submit borrelt op, dus ook een opnieuw getekend formulier doet gewoon mee
  function opSubmit(e) {
    if (e.target.id === 'nlDForm') { e.preventDefault(); docToe(); }
    else if (e.target.id === 'nlCForm') { e.preventDefault(); conToe(); }
    else if (e.target.id === 'nlWForm') { e.preventDefault(); wensToe(); }
    else if (e.target.id === 'nlAiForm') { e.preventDefault(); vraag(); }
  }

  function start() {
    D.stijl();
    D.stand = null;
    var wrap = $('#nlWrap');
    wrap.addEventListener('click', klik);
    wrap.addEventListener('submit', opSubmit);
    if (w.RTGUitvoer) w.RTGUitvoer.bron(D.bron);
    laad();
  }

  /* Geen interval of stream hier, maar de meeneembron zou anders blijven
     hangen en documenten afgeven op een stand die er niet meer staat. */
  function stop() {
    if (w.RTGUitvoer) w.RTGUitvoer.bron(null);
  }

  V.standen.push({
    id: 'nalatenschap',
    naam: 'Nalatenschap',
    uitleg: 'Een discreet, versleuteld dossier voor later: welke documenten er zijn en waar ze liggen, uw vertrouwenspersonen, en uw wensen. Onderdeel van de Lifestyle Pass.',
    html: '<div id="nlWrap"><div id="nlVak"><p class="stil">Laden…</p></div></div>',
    start: start,
    stop: stop
  });
})(window, document);
