/* ============================================================================
   DE UITROLWEGING -- de automaat van ./uitrolregie.js: zakken bij tegenwind,
   klimmen bij groen, en stilstaan voor een trede die een mens vraagt.

   Afgesplitst uit ./uitrolregie.js (18 oktober 2026). De naad is de vraag die
   hier beantwoord wordt: de regie ZET een trede (met de hand of op verzoek van
   deze automaat), de weging BESLUIT of er vanzelf iets mag gebeuren. Dat
   besluit draagt de mensrem, en die staat dus hier en niet daar.

   DE MENSREM, en waarom die geen instelling is

   Twee treden gaan NOOIT vanzelf open, hoe groen elk cijfer ook staat:

     ontmoeten   het kanaal waarop het ene lid het andere rechtstreeks bereikt
     fundament   de betaalrail

   Dat is niet mijn voorzichtigheid maar de wet van dit huis. GELD.md: "De grens
   is hard: geld verlaat het huis nooit autonoom." LIFE.md: "Alles wat een
   tweede persoon bereikt -- een uitnodiging, een bericht, een reservering op
   andermans naam, een betaling -- blijft maximaal klaarzetten. Er is geen regel,
   geen instelling en geen vertrouwensniveau waarmee dat automatisch wordt."

   Een uitrolautomaat die die twee openzet omdat het foutpercentage laag is,
   overtreedt die twee zinnen letterlijk. Daarom klimt de regie eronaartoe,
   meet, en blijft dan staan met stand 'wacht-op-mens'. De trede staat dan
   KLAAR; bevestigen doet de mens. Dat is hetzelfde werkwoord als in LIFE.md.

   En let op de RICHTING: de mensrem geldt alleen omhoog. Terugzakken mag altijd
   vanzelf. Een rem die ook het dichtdraaien tegenhoudt, is geen rem maar een
   klem -- dan blijft een kapotte betaalrail openstaan tot iemand wakker wordt.

   ========================================================================== */
'use strict';

/* De weging krijgt de handelingen en de stand van de regie mee; hij raakt zelf
   geen opslag aan. `TREDEN` en `index` zijn de trap uit functies/register. */
function maakUitrolweging({ staat, oordeel, index, TREDEN, zet, boek, save }) {
  /* De weging. Zakt bij tegenwind, klimt bij groen, en blijft staan voor een
     trede met de mensrem. Raakt niets aan als de regie niet klimt -- behalve
     zakken, want die richting mag altijd (zie de kop). */
  return function weeg() {
    const u = staat();
    if (!u.trede) return { gedaan: null };
    const o = oordeel(u);
    const i = index(u.trede);

    if (o.zakbaar) {
      const vorige = TREDEN()[i - 1];
      if (!vorige) { // al op de smalste trede: niet verder te zakken
        if (u.stand !== 'gestopt') {
          u.stand = 'gestopt';
          u.reden = 'de smalste trede haalt de drempel niet: ' + o.uitleg;
          boek(u, u.trede, u.trede, 'automaat', 'automaat', u.reden);
          save();
        }
        return { gedaan: 'gestopt-onderaan', oordeel: o };
      }
      const r = zet(vorige.id, 'automaat', 'automaat');
      const u2 = staat();
      u2.stand = 'gestopt';
      u2.reden = 'automaat: teruggezakt na ' + o.uitleg;
      boek(u2, u.trede, vorige.id, 'automaat', 'automaat', u2.reden);
      save();
      return { gedaan: 'gezakt', naar: vorige.id, oordeel: o, zet: r };
    }

    if (u.stand !== 'klimt') return { gedaan: null, oordeel: o };
    if (!o.klimbaar) return { gedaan: null, oordeel: o };

    const volgende = TREDEN()[i + 1];
    if (!volgende) {
      u.stand = 'stil';
      u.reden = 'de trap is uit: alles staat open';
      save();
      return { gedaan: 'boven', oordeel: o };
    }
    if (volgende.mens) {
      u.stand = 'wacht-op-mens';
      u.reden = volgende.mensWaarom || 'deze trede vraagt een menselijke bevestiging';
      boek(u, u.trede, volgende.id, 'automaat', 'automaat', 'klaargezet, wacht op een mens');
      save();
      return { gedaan: 'wacht-op-mens', volgende: volgende.id, oordeel: o };
    }
    const r = zet(volgende.id, 'automaat', 'automaat');
    const u2 = staat();
    u2.stand = 'klimt';
    save();
    return { gedaan: 'geklommen', naar: volgende.id, oordeel: o, zet: r };
  };
}

module.exports = { maakUitrolweging };
