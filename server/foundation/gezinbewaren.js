/* RTFoundation (deelmodule): DE BEWAARTERMIJN VAN EEN GEZIN.

   Besluiten van de eigenaar, 5 oktober 2026 (DPIA-GEZIN.md par. 7):
   - een gezin dat 12 MAANDEN niet is gebruikt, gaat weg na een aankondiging;
   - een gezin van VOOR B18 (alleen een adres van zes tekens, geen gezinscode en
     geen eigenaar) gaat weg na een aankondiging. Het opent sinds B18/B19 niets
     meer en kan ook niet worden meegenomen (./gezinmeenemen.js vraagt de
     gezinscode), dus het zijn gegevens van kinderen zonder iemand die erbij kan.

   WIE WAT DOET -- dezelfde verdeling als server/bewaarwacht.js. De machine telt,
   kondigt aan en zet klaar; een MENS geeft het wissen vrij
   (routes/techniek/bewaren.js, alleen de eigenaar, bevestig 'WIS' en passkey).
   Er wordt niets gewist voordat de aankondiging AANKONDIGING_DAGEN oud is.

   GEBRUIK HEFT DE AANKONDIGING OP. "Laatst gebruikt" is het jongste moment
   waarop iemand in dit gezin een sessie kreeg (elke ingang geeft er een:
   inloggen, roteren, het ouderaccount), of het aanmaken of meenemen. Wie na de
   aankondiging terugkomt, is geen kandidaat meer en de aankondiging vervalt bij
   de volgende ronde; een wisronde rekent het ook zelf opnieuw na, en vertrouwt
   dus nooit op een aankondiging van vorige maand.

   WAAR DE AANKONDIGING LANDT. Een gezin aan een account krijgt een bericht op
   de sleutel van dat account (meldLid). Een anoniem gezin heeft geen kanaal:
   geen account en geen contactgegeven, met opzet. Daar is de aankondiging een
   stempel op het gezin plus de openbare mededeling, en dat staat zo in de DPIA
   in plaats van te doen alsof er iemand is bericht. */
'use strict';

const DAG = 86400000;
const ONGEBRUIKT_DAGEN = 365;
const AANKONDIGING_DAGEN = 30;

module.exports = ({ G, save, nu, heeftGezinscode, wisGezin }) => {
  // meldLid (opzet/meldaan.js) komt laat binnen, via opzet/kernlaag1.js
  let melder = null;
  const setMelder = fn => { melder = typeof fn === 'function' ? fn : null; };
  const ms = v => { const t = Date.parse(v); return Number.isFinite(t) ? t : 0; };

  function laatstGebruikt(g) {
    let t = Math.max(ms(g.at), ms(g.eigenaar && g.eigenaar.at));
    for (const p of Object.values(g.profielen || {}))
      for (const s of (p && Array.isArray(p.sessies) ? p.sessies : [])) t = Math.max(t, ms(s && s.issued_at));
    return t;
  }
  /* Waarom dit gezin weg mag, of null. Een gezin met een eigenaar is nooit
     "van voor B18": het is meegenomen of via een account gemaakt. */
  function soort(g, t) {
    if (!(g.eigenaar && g.eigenaar.userId != null) && !heeftGezinscode(g.code)) return 'zonder-gezinscode';
    if (laatstGebruikt(g) + ONGEBRUIKT_DAGEN * DAG < t) return 'ongebruikt';
    return null;
  }
  function rijp(g, t) {
    return !!(g.bewaren && g.bewaren.soort === soort(g, t) && ms(g.bewaren.aangekondigd) + AANKONDIGING_DAGEN * DAG <= t);
  }

  /* Alleen tellingen: een lijst gezinsadressen op het bord is meer dan een mens
     nodig heeft om te beslissen. */
  function rapport() {
    const t = ms(nu());
    const uit = { kandidaten: 0, zonderGezinscode: 0, ongebruikt: 0, aangekondigd: 0, rijp: 0,
      termijn: { ongebruiktDagen: ONGEBRUIKT_DAGEN, aankondigingDagen: AANKONDIGING_DAGEN } };
    for (const g of Object.values(G())) {
      const s = soort(g, t);
      if (!s) continue;
      uit.kandidaten++;
      uit[s === 'zonder-gezinscode' ? 'zonderGezinscode' : 'ongebruikt']++;
      if (g.bewaren && g.bewaren.soort === s) uit.aangekondigd++;
      if (rijp(g, t)) uit.rijp++;
    }
    return uit;
  }

  /* De ronde van de wacht. Kondigt aan wat kandidaat is en nog niet is
     aangekondigd, en haalt de aankondiging weg bij wie weer gebruikt is. */
  function kondigAan(meldLid = melder) {
    const t = ms(nu()), stamp = nu();
    let aangekondigd = 0, vervallen = 0, bericht = 0;
    for (const g of Object.values(G())) {
      const s = soort(g, t);
      if (!s) { if (g.bewaren) { delete g.bewaren; vervallen++; } continue; }
      if (g.bewaren && g.bewaren.soort === s) continue;
      g.bewaren = { soort: s, aangekondigd: stamp };
      aangekondigd++;
      if (g.eigenaar && g.eigenaar.userId != null && typeof meldLid === 'function') {
        try {
          if (meldLid('user-' + g.eigenaar.userId, { icon: 'pas', title: 'Uw gezin in FoundationOS',
            body: 'Uw gezin is een jaar niet gebruikt. Over ' + AANKONDIGING_DAGEN + ' dagen kan het worden gewist. Open Mijn gezin om het te bewaren.' })) bericht++;
        } catch (e) { /* het bericht is een extra; de stempel staat */ }
      }
    }
    if (aangekondigd || vervallen) save();
    return { aangekondigd, vervallen, bericht };
  }

  /* De wisronde. Zonder echt is het een PROEF. Elk gezin wordt hier opnieuw
     nagerekend: alleen wie nu nog kandidaat is, met een aankondiging van
     dezelfde soort die oud genoeg is. */
  function veeg({ echt } = {}) {
    const t = ms(nu());
    const rijpe = Object.values(G()).filter(g => rijp(g, t));
    if (echt) for (const g of rijpe) wisGezin(g);
    return { echt: !!echt, gewist: echt ? rijpe.length : 0, zouWissen: rijpe.length, rapport: rapport() };
  }

  return { rapport, kondigAan, veeg, laatstGebruikt, setMelder, ONGEBRUIKT_DAGEN, AANKONDIGING_DAGEN };
};
