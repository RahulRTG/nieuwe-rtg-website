/* Schermrust: de tegenhanger van elk verslavend patroon. Op de vrije-tijd
   apps (Salon, Clips, Theater, Podium, Spelen, Sound, Vonk) telt RTG stil
   de actieve schermtijd van vandaag mee, over alle apps samen (een teller
   in localStorage, dus niets gaat over de lijn). Na een half uur zonder
   pauze vraagt een rustige kaart of het genoeg is: uw telefoon mag ook
   weg. Geen dwang: een knop is genoeg om door te gaan, en een kwartier
   echt weg is een pauze en zet de teller terug. Werk-apps, rij-schermen
   en educatieve apps dragen dit script bewust NIET.

   Een pagina kan de drempel verlagen met data-schermrust-min op <html>
   (de RTF-jeugdapps staan op 20 minuten). */
(() => {
  if (window.Schermrust) return;
  const KEY = 'rtg_schermtijd';
  const MINUTEN = Number(document.documentElement.getAttribute('data-schermrust-min')) || 30;
  const HERINNER = 20 * 60;  // na "nog even door": volgende vraag na 20 minuten
  const PAUZE = 15 * 60000;  // een kwartier echt weg telt als pauze
  const dag = () => new Date().toISOString().slice(0, 10);

  let st;
  try { st = JSON.parse(localStorage.getItem(KEY) || '{}') || {}; } catch (e) { st = {}; }
  if (st.dag !== dag()) st = { dag: dag(), sec: 0, tot: MINUTEN * 60, laatst: Date.now() };
  if (!(st.tot > 0)) st.tot = MINUTEN * 60;
  if (Date.now() - (st.laatst || 0) > PAUZE) { st.sec = 0; st.tot = MINUTEN * 60; }
  const bewaar = () => { try { localStorage.setItem(KEY, JSON.stringify(st)); } catch (e) {} };

  let kaart = null;
  function toon() {
    if (kaart) return;
    const min = Math.round(st.sec / 60);
    kaart = document.createElement('div');
    kaart.setAttribute('role', 'dialog');
    kaart.setAttribute('aria-modal', 'true');
    kaart.setAttribute('aria-label', 'Tijd voor rust');
    kaart.className = 'ds-schermrust';
    const doos = document.createElement('div');
    doos.className = 'ds-schermrust__doos';
    const kop = document.createElement('div');
    kop.textContent = 'Even niks.';
    kop.className = 'ds-schermrust__kop';
    const tekst = document.createElement('p');
    tekst.textContent = 'U bent vandaag al ' + min + ' minuten op uw scherm bezig. Uw telefoon mag ook even weg; ' +
      'de echte wereld is de mooiste Salon. Een wandeling, uw hobby, of gewoon niks.';
    tekst.className = 'ds-schermrust__tekst';
    const weg = document.createElement('button');
    weg.textContent = 'Ik leg hem weg';
    weg.className = 'ds-schermrust__doe';
    const door = document.createElement('button');
    door.textContent = 'Nog even door';
    door.className = 'ds-schermrust__door';
    const dicht = (tekstNa) => {
      st.tot = st.sec + HERINNER;
      bewaar();
      kaart.remove();
      kaart = null;
      if (tekstNa) {
        const groet = document.createElement('div');
        groet.textContent = tekstNa;
        groet.setAttribute('role', 'status');
        groet.className = 'ds-schermrust__status';
        document.body.appendChild(groet);
        setTimeout(() => groet.remove(), 3500);
      }
    };
    weg.addEventListener('click', () => dicht('Goed zo. Tot straks.'));
    door.addEventListener('click', () => dicht(null));
    doos.append(kop, tekst, weg, door);
    kaart.appendChild(doos);
    document.body.appendChild(kaart);
    weg.focus();
  }

  let weggeweest = 0;
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'hidden') weggeweest = Date.now();
    else if (weggeweest && Date.now() - weggeweest > PAUZE) { st.sec = 0; st.tot = MINUTEN * 60; bewaar(); }
  });
  setInterval(() => {
    if (document.visibilityState !== 'visible') return;
    st.sec += 10;
    st.laatst = Date.now();
    bewaar();
    if (st.sec >= st.tot) toon();
  }, 10000);

  window.Schermrust = { stand: () => ({ ...st }), forceer: toon };
})();
