/* De pin-herstellink opvangen (?pinherstel=...).

   WAAROM DIT BESTAAT. De algemene pin kon alleen worden gewijzigd met de OUDE
   pin. Wie hem kwijt was kwam nooit meer in zijn werk-apps of in de kantoorrol,
   en dus ook niet in de boardroom: geen weg terug, alleen een scherm dat om iets
   bleef vragen wat je niet meer wist. Dat is hier echt gebeurd, bij de eigenaar,
   op zijn eigen systeem.

   WAAROM HIER EN NIET BIJ DE POORT. Een wachtwoord herstel je uitgelogd; een pin
   vraag je aan terwijl je binnen bent, want de pin is het TWEEDE slot. Wie deze
   link opent is dus al ingelogd en hoeft alleen nog een nieuwe pin te kiezen.

   Gebruik:  RTGPinHerstel.opvangen(API, T)   -- doet niets als er geen link is. */
(function () {
  'use strict';
  if (window.RTGPinHerstel) return;

function opvangen(API, T){
  var sleutel = new URLSearchParams(location.search).get('pinherstel');
  if (!sleutel) return;
  // de sleutel uit het adres halen: hij is eenmalig en hoort niet in de
  // geschiedenis of in een gedeelde link achter te blijven
  try { var u = new URL(location.href); u.searchParams.delete('pinherstel'); history.replaceState(null, '', u); } catch(e){}

  var scrim = document.createElement('div');
  scrim.className = 'ds-pinherstel';
  var doos = document.createElement('div');
  doos.setAttribute('role','dialog');
  /* aria-modal hoort erbij en stond er niet. Dit scherm LIGT modaal -- een
     scrim over de hele pagina op z-index 9990 -- maar zei dat alleen visueel.
     Een schermlezer las dus gewoon de pagina eronder door, en de gedeelde laag
     (shared/basis: een venster sluit de rest af) zag hem niet en sloot hem
     daarom zelf af als "buiten het venster". Wat modaal is, zegt dat. */
  doos.setAttribute('aria-modal','true');
  doos.setAttribute('aria-label', T('pinh.kop','Nieuwe algemene pin'));
  doos.className = 'ds-pinherstel__doos';
  var kop = document.createElement('div');
  kop.textContent = T('pinh.kop','Nieuwe algemene pin');
  kop.className = 'ds-pinherstel__kop';
  var uit = document.createElement('p');
  uit.textContent = T('pinh.uit','Kies een pincode van 4 tot 8 cijfers. Dezelfde pin beschermt uw prive-apps en opent uw werk-apps.');
  uit.className = 'ds-pinherstel__uitleg';
  var inp = document.createElement('input');
  inp.type='password'; inp.inputMode='numeric'; inp.maxLength=8; inp.autocomplete='off';
  inp.setAttribute('aria-label', T('pinh.veld','Nieuwe pin'));
  inp.className = 'ds-pinherstel__veld';
  var fout = document.createElement('div');
  fout.className = 'ds-pinherstel__melding';
  var ga = document.createElement('button');
  ga.type='button'; ga.textContent = T('pinh.zet','Pin instellen');
  ga.className = 'ds-pinherstel__doe';
  ga.addEventListener('click', async function(){
    var pin = inp.value.trim();
    if (!/^\d{4,8}$/.test(pin)) { fout.textContent = T('pin.vorm','4 tot 8 cijfers.'); return; }
    ga.disabled = true;
    try {
      await API.call('/pin/herstel', { sleutel: sleutel, pin: pin });
      scrim.remove();
    } catch (e) { fout.textContent = e.message || T('pin.mis','Dat ging niet goed.'); ga.disabled = false; }
  });
  inp.addEventListener('keydown', function(e){ if (e.key === 'Enter') ga.click(); });
  doos.append(kop, uit, inp, fout, ga);
  scrim.appendChild(doos);
  document.body.appendChild(scrim);
  setTimeout(function(){ inp.focus(); }, 60);
}


  /* De knop onder het pinveld. Hij hoort bij deze module en niet bij het
     inlogscherm: wie de stroom wil begrijpen leest een bestand, niet twee. */
  function knop(belLijst, fout, API, T){
  const vergeten = document.createElement('button');
  vergeten.type = 'button';
  vergeten.textContent = T('pin.vergeten', 'Pin vergeten?');
  vergeten.className = 'ds-pinherstel__vergeten';
  vergeten.addEventListener('click', async () => {
    vergeten.disabled = true;
    try {
      const r = await API.call('/pin/vergeten', {});
      if (r && r.devPinUrl) {
        // geen post ingesteld: meteen door naar het scherm dat de nieuwe pin zet
        location.href = r.devPinUrl;
        return;
      }
      fout.classList.add('ds-pinherstel__melding--goed');
      fout.textContent = T('pin.verstuurd', 'We hebben u een link gestuurd om een nieuwe pin te kiezen. Hij is een uur geldig.');
    } catch (e) {
      fout.classList.remove('ds-pinherstel__melding--goed');
      fout.textContent = e.message || T('pin.mis', 'Dat ging niet goed.');
      vergeten.disabled = false;
    }
  });
  belLijst.appendChild(vergeten);
  }

  window.RTGPinHerstel = { opvangen: opvangen, knop: knop };
})();
