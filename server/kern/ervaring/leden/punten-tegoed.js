/* Leden-deel "punten-tegoed" (kern/ervaring/leden): HET OUDE TEGOED.

   Dit bestand is een uitloop. Verzilverde punten stonden hier als apart bedrag
   naast RTG Pay -- een euro-aanspraak op RTG die alleen als KORTING kon worden
   ingelost, op de drie betaalpaden die hem kenden. Twee bedragen die allebei
   geld van hetzelfde lid voorstellen, is precies waar kern/geldwereld.js voor
   waarschuwt.

   Sinds verzilveren in de WALLET landt (./punten.js) vult niets dit veld nog.
   Wat hier staat bestaat alleen om saldi van VOOR die verandering leeg te laten
   lopen: bestaande leden hun tegoed afpakken is geen opruiming. Bij een leeg
   veld doet alles hieronder niets, dus het kost niets om het te laten staan --
   en zodra de laatste rekening leeg is, kan dit hele bestand weg. Dat is
   makkelijker te zien als het een bestand is dan als het tussen de rest staat.

   Krijgt puntenRek mee, zodat er maar EEN plek is die weet hoe een
   puntenrekening eruitziet en hoe de oude euro-vorm wordt omgerekend. */
'use strict';

module.exports = ({ db, save, nu, puntenRek }) => {
  /* Bij het betalen: verreken tegoed (RTG legt bij; de zaak ziet het volle
     bedrag). SINDS VERZILVEREN IN DE WALLET LANDT, VULT NIETS DIT VELD NOG.
     Deze functie bestaat dus alleen nog om saldi van VOOR die verandering leeg
     te laten lopen. Hem meteen weghalen zou het tegoed van bestaande leden
     laten verdampen; hem laten staan kost niets, want bij een leeg veld doet
     hij niets. Loopt de laatste rekening leeg, dan kan hij weg -- en dan valt
     ook de laatste plek weg waar twee saldi naast elkaar bestaan. */
  function pasTegoedToe(key, totaal) {
    if (!db.data.punten[key]) return 0;          // geen rekening: niets te verrekenen, en niets aan te maken
    const p = puntenRek(key);
    if (!(p.tegoedCenten > 0)) return 0;
    /* De aanroepers rekenen in EURO'S (o.total en r.quote zijn euro-getallen),
       dus dat blijft de vorm van het antwoord. Binnen deze functie is alles
       centen, zodat het bewaarde saldo exact blijft. */
    const kortingCenten = Math.min(p.tegoedCenten, Math.max(0, Math.round((Number(totaal) || 0) * 100)));
    if (kortingCenten <= 0) return 0;
    p.tegoedCenten -= kortingCenten;
    p.historie.unshift({ punten: 0, reden: '€ ' + (kortingCenten / 100) + ' tegoed verrekend', at: nu() });
    return kortingCenten / 100; // save() gebeurt in de betaal-handler
  }


  /* TERUGGEVEN WAT ER NIET IS UITGEGEVEN. pasTegoedToe() trekt het tegoed af
     VOORDAT de betaling is gedaan -- dat moet, want het bepaalt hoeveel het lid
     nog zelf betaalt. Lukt die betaling vervolgens niet, dan is het tegoed weg
     zonder dat er iets voor is gekocht. Deze functie zet het terug.

     Bewust GEEN algemene "voeg tegoed toe": hij hoort alleen bij het terugdraaien
     van een mislukte betaling, en een functie die tegoed uit het niets kan maken
     is precies wat je in een geldlaag niet wilt hebben rondslingeren. Het bedrag
     komt daarom in EURO'S binnen -- in dezelfde vorm als pasTegoedToe hem
     teruggaf -- zodat alleen een teruggave die op een eerdere aftrek slaat er
     doorheen komt. */
  function herstelTegoed(key, euro) {
    const centen = Math.round((Number(euro) || 0) * 100);
    if (!(centen > 0) || !db.data.punten[key]) return 0;
    const p = puntenRek(key);
    p.tegoedCenten += centen;
    p.historie.unshift({ punten: 0, reden: '€ ' + (centen / 100) + ' tegoed terug (betaling ging niet door)', at: nu() });
    save();
    return centen / 100;
  }


  return { pasTegoedToe, herstelTegoed };
};
