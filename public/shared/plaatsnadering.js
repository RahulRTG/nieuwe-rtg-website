/* DE KNOP DIE NIET MEER MET DE HAND HOEFT (PLAATS.md fase 4).

   Invisible Arrival had deze functie al, en goed: een tijdelijke pass met drie
   knoppen -- "Ik vertrek nu", "Ik ben in de buurt", "Ik ben gearriveerd" --
   waarmee een gast vrijwillig een status deelt, zodat de zaak de tafel kan
   klaarzetten. Met eronder de belofte: *een status delen is vrijwillig, bevat
   geen GPS en vervalt automatisch na uw bezoek.*

   Fase 4 bouwt daar dus geen tweede functie naast. Hij haalt er het handwerk
   uit: als jij dat wilt, meldt je toestel zelf dat je in de buurt bent. Precies
   dezelfde puls die je met je duim zou geven, met precies hetzelfde gevolg.

   EN DE BELOFTE BLIJFT LETTERLIJK WAAR. Er gaat nog steeds geen GPS naar de
   pass en geen route naar de zaak: de hek-motor rekent op het toestel
   (shared/plaats.js) en wat er vertrekt is de puls 'in-de-buurt'. De zaak leert
   niet waar je bent, alleen dat je eraan komt -- dat is wat ze nodig heeft om
   een tafel gereed te maken, en niets meer.

   DE TWEE WERELDEN RAKEN ELKAAR ALLEEN HIER, OP HET TOESTEL. Een Arrival Pass is
   anoniem (een accessToken, geen account); de plaatslaag werkt op codenamen. Op
   de SERVER worden die twee nooit aan elkaar geknoopt, en dat is met opzet: het
   arrival-domein leert geen codenaam en de plaatslaag leert geen pass. De enige
   plek waar ze samenkomen is dit bestand, in de browser van de mens over wie het
   gaat. Wie dit ooit naar de server wil verplaatsen "omdat het makkelijker is",
   koppelt daarmee een anonieme pass aan een identiteit.

   HET WERKWOORD BLIJFT KLAARZETTEN. De puls gaat pas als jij een keer ja hebt
   gezegd, en de handknoppen blijven gewoon werken. Zeg je nee, dan verandert er
   niets aan de pagina zoals hij was. */
(function () {
  'use strict';
  if (window.RTGPlaatsNadering) return;

  var gevraagd = false, af = null, gemeld = false;

  function pasToken() {
    try { return localStorage.getItem('rtg_arrival_pass'); } catch (e) { return null; }
  }
  function lid() {
    try { return localStorage.getItem('rtg_member_token'); } catch (e) { return null; }
  }
  function api(pad, body, token) {
    var h = { 'Content-Type': 'application/json' };
    if (token) h.Authorization = 'Bearer ' + token;
    return fetch(pad, { method: 'POST', headers: h, body: JSON.stringify(body || {}) })
      .then(function (r) { return r.json().catch(function () { return null; }); })
      .catch(function () { return null; });
  }

  /* Het aanbod. Zelfde vorm als shared/plek.js en shared/plaatsdienst.js: een
     rustige kaart onderin met een duidelijke "nu niet". De tekst zegt wat de
     zaak ziet EN wat ze niet ziet, want dat is precies waar iemand ja of nee op
     hoort te zeggen. */
  function bied(naam) {
    return new Promise(function (klaar) {
      var st = document.createElement('style');
      st.textContent =
        '.rtgnader{position:fixed;left:50%;transform:translateX(-50%);z-index:9983;' +
          'bottom:calc(env(safe-area-inset-bottom,0px) + 1.5rem);width:min(24rem,calc(100vw - 2rem));' +
          'background:var(--paneel,#151312);border:1px solid var(--line,var(--lijn,#2A2724));' +
          'border-radius:14px;padding:1rem 1.1rem;color:var(--txt,#F7F5F1);' +
          'font-family:Inter,system-ui,sans-serif;box-shadow:0 14px 40px rgba(0,0,0,.45);}' +
        '.rtgnader p{margin:0 0 .8rem;font-size:.85rem;line-height:1.55;color:var(--muted,var(--zacht,#8A8680));}' +
        '.rtgnader .rij{display:flex;gap:.6rem;}' +
        '.rtgnader button{flex:1;border:none;border-radius:999px;padding:.6rem;font:inherit;' +
          'font-size:.82rem;font-weight:600;cursor:pointer;}' +
        '.rtgnader .ja{background:var(--gold,#857007);color:#0C0C0B;}' +
        '.rtgnader .nee{background:none;color:var(--muted,#8A8680);font-weight:500;}';
      document.head.appendChild(st);

      var doos = document.createElement('div');
      doos.className = 'rtgnader';
      doos.setAttribute('role', 'dialog');
      doos.setAttribute('aria-label', 'Zelf melden dat je in de buurt bent');
      var p = document.createElement('p');
      p.textContent = 'Zal ik het zelf melden als je in de buurt van ' + naam + ' komt? ' +
        'Dan kunnen ze je tafel op tijd gereedmaken. ' + naam + ' ziet alleen dat je eraan komt, ' +
        'niet waar je bent. Je locatie blijft op je toestel, en je kunt het altijd zelf blijven doen.';
      var rij = document.createElement('div'); rij.className = 'rij';
      var ja = document.createElement('button'); ja.className = 'ja'; ja.type = 'button'; ja.textContent = 'Ja, meld het zelf';
      var nee = document.createElement('button'); nee.className = 'nee'; nee.type = 'button'; nee.textContent = 'Nu niet';
      rij.append(nee, ja);
      doos.append(p, rij);
      document.body.appendChild(doos);

      var vorigeFocus = document.activeElement;
      ja.focus();
      function sluit(a) {
        doos.remove(); st.remove();
        try { if (vorigeFocus && vorigeFocus.focus && document.contains(vorigeFocus)) vorigeFocus.focus({ preventScroll: true }); } catch (e) {}
        klaar(a);
      }
      doos.addEventListener('keydown', function (ev) { if (ev.key === 'Escape') { ev.preventDefault(); sluit(false); } });
      ja.addEventListener('click', function () { sluit(true); });
      nee.addEventListener('click', function () { sluit(false); });
    });
  }

  /* De pass ophalen om te weten OF er een bezoek op de rol staat en bij welke
     zaak. Zonder pass is er geen reden, en zonder reden geen venster -- dat is
     de regel van de laag en niet een beleefdheid. */
  async function pas() {
    var t = pasToken();
    if (!t) return null;
    var r = await api('/api/arrival/pass', { pass: t });
    return (r && r.ok && r.pass) ? r.pass : null;
  }

  async function ronde() {
    if (!window.RTGPlaats || !window.RTGPlek || !lid()) return;
    var p = await pas();
    if (!p || !p.zaak || !p.zaak.code) return;
    // al gemeld of het delen gestopt: dan is er niets meer te doen
    if (p.pulse === 'in-de-buurt' || p.pulse === 'gearriveerd' || p.pulse === 'delen-gestopt') return;
    if (gevraagd || !document.body) return;
    gevraagd = true;

    var wil = await bied(p.zaak.naam || 'de zaak');
    if (!wil) return;
    /* Het venster hangt aan het bezoek en loopt af als het bezoek voorbij is:
       de pass draagt zijn eigen vervaldatum, dus die rekenen we om in minuten.
       Toestemming die langer duurt dan de reden ervoor, is toestemming zonder
       reden. */
    var minuten = 120;
    if (p.vervaltAt) {
      var over = Math.round((Date.parse(p.vervaltAt) - Date.now()) / 60000);
      if (over > 0) minuten = over;
    }
    var v = await api('/api/plaats/venster',
      { doel: 'nadering', bron: 'bezoek aan ' + p.zaak.code, minuten: minuten }, lid());
    if (!v || v.status !== 200) return;

    var hekId = 'leverancier:' + p.zaak.code;
    af = window.RTGPlaats.opWissel(function (w) {
      /* ALLEEN het hek van DEZE zaak, en alleen naar binnen. Elke andere
         overgang is niet van dit bezoek, en een puls sturen over een zaak waar
         je toevallig langsloopt zou de zaak iets vertellen over je route. */
      if (gemeld || w.doel !== 'nadering' || w.hek !== hekId || w.wat !== 'binnen') return;
      gemeld = true;
      var t = pasToken();
      if (t) api('/api/arrival/pulse', { pass: t, pulse: 'in-de-buurt' });
    });
    await window.RTGPlaats.start('nadering', {
      waarom: 'Om zelf te kunnen melden dat je in de buurt bent, zodat je tafel op tijd klaarstaat. Je locatie blijft op je toestel.'
    });
  }

  function begin() { ronde(); }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', begin);
  else begin();
  window.addEventListener('pagehide', function () {
    if (af) { af(); af = null; }
    if (window.RTGPlaats) { try { window.RTGPlaats.stop(); } catch (e) {} }
  });

  window.RTGPlaatsNadering = { ronde: ronde, _bied: bied };
})();
