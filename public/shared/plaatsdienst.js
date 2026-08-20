/* DE BRUG TUSSEN TWEE SESSIES, EN DE MENS ERTUSSEN (PLAATS.md fase 2c).

   De hek-motor draait in de LEDEN-app; een dienst leeft in de PERSONEELS-app.
   Die twee sessies raken elkaar bewust nooit -- dat is de kracht van het ontwerp
   en tegelijk de reden dat een venster tot nu toe alleen met de hand open kon.

   DE VERLEIDING WAS OM DE ZAAK HET TE LATEN DOEN: bij het inklokken meteen een
   venster openen op het account van de medewerker. Dan opent een WERKGEVER een
   toestemming op de telefoon van zijn personeel, en toestemming die een ander
   voor je geeft is geen toestemming. Die deur blijft dicht.

   WAT ER WEL MAG IS KLAARZETTEN. Loopt jouw dienst, dan zegt je EIGEN app dat,
   en biedt hij aan de aanwezigheid aan te zetten. Eén tik en het staat aan.
   Geen tik en er gebeurt niets, deze sessie niet meer gevraagd. Het werkwoord
   van deze laag is klaarzetten, nooit doen (PLAATS.md par. 3, in lijn met
   LIFE.md: "bevestigen doet de mens").

   EN HET VENSTER SLUIT ALS DE DIENST VOORBIJ IS. Dat is de belofte "toestemming
   heeft altijd een einde" op zijn concreetst: niet alleen een einddatum die
   vanzelf verloopt, maar een venster dat weggaat op het moment dat de reden
   ervoor weg is. Uitgeklokt is uitgekeken.

   Hangt aan /shared/plaats.js (de motor) en /shared/plek.js (de schakelaar en de
   vraag). Ontbreekt een van beide, dan doet dit bestand niets -- geen stille
   terugval op een rauwe watchPosition. */
(function () {
  'use strict';
  if (window.RTGPlaatsDienst) return;

  var HERHAAL_MS = 5 * 60 * 1000;   // vaak genoeg om een uitklok te volgen, zelden genoeg om niet te storen
  var gevraagd = false;             // deze sessie al een keer aangeboden
  var motorLoopt = false;
  var timer = null;

  function api(pad, body) {
    var token = null;
    try { token = localStorage.getItem('rtg_member_token'); } catch (e) {}
    if (!token) return Promise.resolve(null);
    return fetch('/api/plaats/' + pad, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + token },
      body: JSON.stringify(body || {})
    }).then(function (r) { return r.json().catch(function () { return null; }); })
      .catch(function () { return null; });
  }

  /* Het aanbod. Dezelfde vorm als de vraag van shared/plek.js: een rustige kaart
     onderin, in de stijl van het huis, met een duidelijke "nu niet". Bewust geen
     eigen ontwerp -- een tweede soort toestemmingskaartje leert een mens dat er
     verschillende soorten toestemming zijn, en dat is hier niet zo. */
  function bied(naam) {
    return new Promise(function (klaar) {
      var st = document.createElement('style');
      st.textContent =
        '.rtgdienst{position:fixed;left:50%;transform:translateX(-50%);z-index:9984;' +
          'bottom:calc(env(safe-area-inset-bottom,0px) + 5.5rem);width:min(24rem,calc(100vw - 2rem));' +
          'background:var(--paneel,#151312);border:1px solid var(--line,var(--lijn,#2A2724));' +
          'border-radius:0;padding:1rem 1.1rem;color:var(--txt,#F7F5F1);' +
          'font-family:Inter,system-ui,sans-serif;box-shadow:0 14px 40px rgba(0,0,0,.45);}' +
        '.rtgdienst p{margin:0 0 .8rem;font-size:.85rem;line-height:1.55;color:var(--muted,var(--zacht,#8A8680));}' +
        '.rtgdienst .rij{display:flex;gap:.6rem;}' +
        '.rtgdienst button{flex:1;border:none;border-radius:0;padding:.6rem;font:inherit;' +
          'font-size:.82rem;font-weight:600;cursor:pointer;}' +
        '.rtgdienst .ja{background:var(--gold,#857007);color:#0C0C0B;}' +
        '.rtgdienst .nee{background:none;color:var(--muted,#8A8680);font-weight:500;}';
      document.head.appendChild(st);

      var doos = document.createElement('div');
      doos.className = 'rtgdienst';
      doos.setAttribute('role', 'dialog');
      doos.setAttribute('aria-label', 'Aanwezigheid tijdens je dienst');
      var p = document.createElement('p');
      /* De tekst zegt wat er gebeurt EN wat er niet gebeurt. "Je werkgever ziet
         dat je er was, niet waar je bent geweest" is de hele belofte van deze
         laag in één zin, en juist bij aanwezigheid op het werk hoort die er te
         staan voordat iemand ja zegt. */
      p.textContent = 'Je dienst bij ' + naam + ' loopt. Zal ik je aanwezigheid ' +
        'bijhouden? Je werkgever ziet dan dat je er was, niet waar je bent geweest. ' +
        'Je locatie blijft op je toestel, en het stopt als je uitklokt.';
      var rij = document.createElement('div'); rij.className = 'rij';
      var ja = document.createElement('button'); ja.className = 'ja'; ja.type = 'button'; ja.textContent = 'Aanzetten';
      var nee = document.createElement('button'); nee.className = 'nee'; nee.type = 'button'; nee.textContent = 'Nu niet';
      rij.append(nee, ja);
      doos.append(p, rij);
      document.body.appendChild(doos);

      var vorigeFocus = document.activeElement;
      ja.focus();
      function sluit(antwoord) {
        doos.remove(); st.remove();
        try { if (vorigeFocus && vorigeFocus.focus && document.contains(vorigeFocus)) vorigeFocus.focus({ preventScroll: true }); } catch (e) {}
        klaar(antwoord);
      }
      doos.addEventListener('keydown', function (ev) { if (ev.key === 'Escape') { ev.preventDefault(); sluit(false); } });
      ja.addEventListener('click', function () { sluit(true); });
      nee.addEventListener('click', function () { sluit(false); });
    });
  }

  function startMotor() {
    if (motorLoopt || !window.RTGPlaats) return Promise.resolve();
    return window.RTGPlaats.start('dienst', {
      waarom: 'Om je aanwezigheid tijdens je dienst bij te houden. Je locatie blijft op je toestel; RTG krijgt alleen te horen of je op je werkplek bent.'
    }).then(function (r) { motorLoopt = !!(r && r.ok); });
  }
  /* STOPPEN DOE JE ALLEEN WAT JE ZELF BENT BEGONNEN.

     Hier stond een onvoorwaardelijke RTGPlaats.stop(). De motor is GEDEELD --
     shared/plaatsnadering.js gebruikt hem ook, en een volgende laag straks --
     dus dit zette het werk van een ander stil zodra er hier toevallig geen
     dienst liep. Op app.html gebeurde dat elke keer: dit bestand kijkt bij het
     laden of er een dienst is, vindt er geen, en trok de motor onder alles
     vandaan wat er net was gestart. Een schermtoets ving het; zonder die toets
     was het een functie die "soms niet werkt". */
  function stopMotor() {
    if (motorLoopt && window.RTGPlaats) { try { window.RTGPlaats.stop(); } catch (e) {} }
    motorLoopt = false;
  }

  async function ronde() {
    if (!window.RTGPlaats || !window.RTGPlek) return;
    var r = await api('dienst');
    if (!r || r.status !== 200) return;
    var loopt = (r.diensten || [])[0] || null;

    /* GEEN DIENST MEER: het venster gaat dicht en de motor stopt. Alleen als het
       venster ook DOOR een dienst is geopend -- een venster dat het lid zelf om
       een andere reden openzette, is niet van ons om te sluiten. */
    if (!loopt) {
      stopMotor();
      if (r.venster && /^dienst bij /.test(String(r.venster.bron || ''))) await api('venster/sluit', { doel: 'dienst' });
      return;
    }
    // toestemming ligt er al: gewoon beginnen, zonder iets te vragen
    if (r.venster) { await startMotor(); return; }
    // en anders: één keer aanbieden, deze sessie
    if (gevraagd || !document.body) return;
    gevraagd = true;
    var wil = await bied(loopt.naam);
    if (!wil) return;
    var v = await api('venster', { doel: 'dienst', bron: 'dienst bij ' + loopt.zaak, minuten: 12 * 60 });
    if (!v || v.status !== 200) return;
    await startMotor();
  }

  function begin() {
    ronde();
    if (timer) clearInterval(timer);
    timer = setInterval(ronde, HERHAAL_MS);
    if (timer.unref) timer.unref();
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', begin);
  else begin();
  // het toestel blijft niet peilen als niemand kijkt
  // bij het verlaten van de pagina mag alles stoppen: daar kijkt niemand meer
  window.addEventListener('pagehide', function () {
    if (timer) clearInterval(timer);
    if (window.RTGPlaats) { try { window.RTGPlaats.stop(); } catch (e) {} }
    motorLoopt = false;
  });

  window.RTGPlaatsDienst = { ronde: ronde, _bied: bied };
})();
