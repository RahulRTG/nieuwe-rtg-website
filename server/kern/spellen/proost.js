/* Spelmotor "proost" (kern/spellen): Proost: het 18+-partyspel (alleen met paspoort-geboortedatum, afgedwongen in de lobby).
   Verbatim afgesplitst uit kern/spellen.js; de lobby (aldaar) doet matchmaking,
   beurten en views en roept deze motor via de gedeelde context aan. */
module.exports = (ctx) => {
  const { save, crypto, schud, beurtDoor, codenaamVan, nudge } = ctx;

  const P_PROOST = ['{A} proost met iedereen en neemt 1 slok.', 'Iedereen die vandaag heeft gewerkt: 1 slok.', '{A} kiest iemand die 2 slokken neemt.',
    'Linkerbuur van {A}: 1 slok.', 'Waterronde: iedereen een glas water. Verplicht.', 'Iedereen die weleens te laat op een feest kwam: 1 slok.',
    '{A} vertelt een geheimpje of neemt 3 slokken.', 'De jongste van het stel: 2 slokken.', 'Iedereen met een huisdier: 1 slok.',
    '{A} en {B} klinken en nemen samen 1 slok.', 'Wie het laatst gelachen heeft om een eigen grap: 2 slokken.', 'Iedereen die vandaag sport heeft gedaan deelt 2 slokken uit.',
    '{A} mag een regel instellen die tot het einde geldt.', 'Complimentenronde: wie een compliment krijgt, neemt 1 slok.', 'Iedereen die zijn telefoon vasthoudt: 2 slokken.',
    '{A} doet een toost op de groep; iedereen 1 slok.', 'Duimen op tafel! De laatste: 2 slokken.', 'Wie ooit een verjaardag vergat: 1 slok.',
    'Iedereen wijst de beste kok aan; die deelt 3 slokken uit.', '{B} kiest: zelf 2 slokken of iedereen 1.'];
  function proostInit(potje) {
    potje.staat = { kaart: 'Proost! Drink met mate, drink water tussendoor en zorg voor elkaar. Klaar? Pak de eerste kaart.', teller: 0, totaal: 25 };
  }
  function proostZet(potje, h, zet) {
    const st = potje.staat;
    if (String(zet.actie || '') !== 'kaart') return { status: 400, error: 'Onbekende actie.' };
    st.teller++;
    if (st.teller > st.totaal) {
      potje.status = 'klaar'; potje.winnaar = null; potje.gelijk = true;
      st.kaart = 'Dat was de laatste kaart. Proost, en kom veilig thuis.';
    } else {
      const spelers = potje.spelers.map(codenaamVan);
      const A = spelers[crypto.randomInt(0, spelers.length)];
      let B = spelers[crypto.randomInt(0, spelers.length)];
      if (spelers.length > 1) while (B === A) B = spelers[crypto.randomInt(0, spelers.length)];
      st.kaart = P_PROOST[crypto.randomInt(0, P_PROOST.length)].replace('{A}', A).replace('{B}', B);
      potje.beurt = (potje.beurt + 1) % potje.spelers.length;
    }
    save(); potje.spelers.forEach(sp => nudge(sp, potje));
    return { status: 200, ok: true, kaart: st.kaart };
  }

  /* ================= lobby: uitnodigen, accepteren, random wachtrij ================= */

  return { proostInit, proostZet };
};
