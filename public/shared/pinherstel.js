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
  scrim.style.cssText = 'position:fixed;inset:0;z-index:9990;background:rgba(0,0,0,.72);display:flex;align-items:center;justify-content:center;padding:1.2rem;';
  var doos = document.createElement('div');
  doos.setAttribute('role','dialog');
  doos.setAttribute('aria-label', T('pinh.kop','Nieuwe algemene pin'));
  doos.style.cssText = 'width:min(22rem,100%);background:var(--paneel,#151312);border:1px solid var(--line);border-radius:14px;padding:1.2rem;color:var(--txt,#F7F5F1);font-family:Inter,system-ui,sans-serif;';
  var kop = document.createElement('div');
  kop.textContent = T('pinh.kop','Nieuwe algemene pin');
  kop.style.cssText = 'font-family:"Bodoni Moda",Georgia,serif;font-size:1.15rem;margin-bottom:.5rem;';
  var uit = document.createElement('p');
  uit.textContent = T('pinh.uit','Kies een pincode van 4 tot 8 cijfers. Dezelfde pin beschermt uw prive-apps en opent uw werk-apps.');
  uit.style.cssText = 'margin:0 0 .9rem;font-size:.85rem;line-height:1.55;color:var(--muted,#8A8680);';
  var inp = document.createElement('input');
  inp.type='password'; inp.inputMode='numeric'; inp.maxLength=8; inp.autocomplete='off';
  inp.setAttribute('aria-label', T('pinh.veld','Nieuwe pin'));
  inp.style.cssText = 'width:100%;margin:0 0 .5rem;background:var(--card2,#1B1817);border:1px solid var(--line);border-radius:10px;padding:.6rem .8rem;font-size:1rem;letter-spacing:.4em;text-align:center;color:var(--txt);';
  var fout = document.createElement('div');
  fout.style.cssText = 'min-height:1.2rem;font-size:.8rem;color:var(--burgundy-on-dark,#C23A5E);margin-bottom:.6rem;';
  var ga = document.createElement('button');
  ga.type='button'; ga.textContent = T('pinh.zet','Pin instellen');
  ga.style.cssText = 'width:100%;border:none;border-radius:999px;padding:.65rem;font:inherit;font-size:.86rem;font-weight:600;background:var(--gold,#857007);color:#0C0C0B;cursor:pointer;';
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
  vergeten.style.cssText = 'display:block;margin:0.7rem auto 0;background:none;border:none;color:var(--muted,#8A8680);font:inherit;font-size:0.8rem;text-decoration:underline;cursor:pointer;';
  vergeten.addEventListener('click', async () => {
    vergeten.disabled = true;
    try {
      const r = await API.call('/pin/vergeten', {});
      if (r && r.devPinUrl) {
        // geen post ingesteld: meteen door naar het scherm dat de nieuwe pin zet
        location.href = r.devPinUrl;
        return;
      }
      fout.style.color = 'var(--gold,#857007)';
      fout.textContent = T('pin.verstuurd', 'We hebben u een link gestuurd om een nieuwe pin te kiezen. Hij is een uur geldig.');
    } catch (e) {
      fout.textContent = e.message || T('pin.mis', 'Dat ging niet goed.');
      vergeten.disabled = false;
    }
  });
  belLijst.appendChild(vergeten);
  }

  window.RTGPinHerstel = { opvangen: opvangen, knop: knop };
})();
