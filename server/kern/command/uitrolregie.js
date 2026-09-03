/* ============================================================================
   DE UITROLREGIE -- de trap vanzelf op, en bij tegenwind vanzelf een tree terug.

   WAT ONTBRAK. De schakelkast kende drie standen die allemaal een MENS vragen:
   een functie aan/uit (server/functies.js), een hele trede in een klik
   (boardroom/schakelaar.js: schakelFase) en een canary die één functie over de
   mensen verdeelt (./canary.js). Die canary rolt wél vanzelf terug bij een golf
   serverfouten, maar verbreden doet hij nooit uit zichzelf. Er was dus geen
   manier om te zeggen: "ga live op de smalste stand, en klim verder zolang het
   houdt".

   Dat is wat hier woont. De regie kent de trap uit functies/register/index.js,
   zet de volgende trede pas als de huidige zich bewezen heeft, en zakt een tree
   zodra hij dat niet doet.

   ------------------------------------------------------------------------
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

   ------------------------------------------------------------------------
   DE DRIE KEUZES OVER HET METEN staan sinds 3 september 2026 bij de meting zelf,
   in ./uitrolmeting.js: waar de cijfers vandaan komen (server/meting.js, met een
   nulmeting per trede), waarom een herstart NIET als groen telt, en waarom er
   over al het verkeer wordt gemeten en niet over de nieuwe paden alleen. Ze zijn
   met de code meeverhuisd en niet ingekort -- een reden die achterblijft bij een
   bestand dat de code niet meer draagt, is een reden die niemand meer leest.

   ------------------------------------------------------------------------
   WAT DEZE REGIE NIET IS

   Geen deploy-automaat: hij zet functies open die al draaien, hij rolt geen
   code uit. Geen vervanger van de storingswachter (functies/wachter.js), die
   bij een golf fouten één functie dichtgooit -- dat is een noodrem en dit is een
   uitrol. En geen bewijs dat een trede goed is: een laag foutpercentage zegt
   dat er niets omvalt, niet dat het klopt.
   ========================================================================== */
'use strict';
const { maakTikker } = require('./tikker');
/* De METING staat sinds 3 september 2026 apart (TAKEN.md 5.57): "hoeveel
   serverfouten sinds deze trede" is een andere vraag dan "mag hij klimmen". */
const { maakUitrolmeting } = require('./uitrolmeting');

const klok = require('../../lib/klok');

const STANDAARD = {
  drempel: 0.02,      // meer dan 2% serverfouten op al het verkeer
  minimum: 200,       // en pas als er genoeg antwoorden zijn om dat te zeggen
  rustMs: 30 * 60000, // hoe lang een trede zich minstens moet houden
  tikMs: 60000,       // hoe vaak de weging vanzelf draait
  geschiedenisMax: 200
};

function maakUitrolregie({ opslag, save, meting, functies, schakelFase, nu }) {
  const tijd = nu || klok.nu;
  const iso = () => new Date(tijd()).toISOString();
  const TREDEN = () => (functies && functies.FASES) || [];
  const { tel, oordeel } = maakUitrolmeting({ meting, nu: tijd, STANDAARD });
  const index = id => TREDEN().findIndex(t => t.id === id);

  function staat() {
    /* Door de deur van het domein (./opslag.js, gedeeld.uitrol) en niet
       rechtstreeks in db.data -- keuringsregel 62 houdt dat sindsdien bij.
       Het vak maakt beide lagen zelf aan; zie de kop van dat vak voor waarom
       gedeeld.techniek() hier niet volstond. */
    return opslag.gedeeld.uitrol();
  }

  function boek(u, van, naar, door, hoe, reden) {
    u.geschiedenis.unshift({ at: iso(), van: van || null, naar: naar || null,
      door: String(door || 'onbekend'), hoe, reden: reden || null });
    if (u.geschiedenis.length > STANDAARD.geschiedenisMax) u.geschiedenis.length = STANDAARD.geschiedenisMax;
  }

  /* Een trede zetten. `hoe` is 'hand' of 'automaat'; de nulmeting gaat MEE,
     want vanaf nu is het een andere proef. */
  function zet(id, door, hoe) {
    const i = index(String(id || ''));
    if (i < 0) return { status: 404, error: 'Onbekende trede: ' + id };
    const u = staat();
    const was = u.trede;
    const r = schakelFase(TREDEN()[i].id, door);
    if (!r || r.error) return r || { status: 500, error: 'De trede kon niet gezet worden.' };
    u.trede = TREDEN()[i].id;
    u.sinds = iso();
    u.basis = tel();
    u.reden = null;
    boek(u, was, u.trede, door, hoe || 'hand', r.aan + ' functies aan, ' + r.uit + ' dicht');
    save();
    return { ok: true, trede: u.trede, aan: r.aan, uit: r.uit };
  }

  function klim(door) {
    const u = staat();
    if (!u.trede) return { status: 409, error: 'Zet eerst een trede; de regie opent geen dichte kast uit zichzelf.' };
    u.stand = 'klimt';
    u.reden = null;
    boek(u, u.trede, u.trede, door, 'hand', 'automatisch klimmen aangezet');
    save();
    return stand();
  }

  function pauze(door, reden) {
    const u = staat();
    u.stand = 'stil';
    u.reden = reden || 'met de hand gepauzeerd';
    boek(u, u.trede, u.trede, door, 'hand', u.reden);
    save();
    return stand();
  }

  /* De mensrem opheffen voor DEZE ene stap. Bewust niet een instelling die hem
     permanent uitzet: dan is het geen rem meer. Zie de kop. */
  function bevestig(door) {
    /* Eerst wegen, dan pas kijken. Zonder dit hangt het antwoord af van de
       vraag of er toevallig net iemand naar het scherm keek: de stand
       'wacht-op-mens' wordt door weeg() gezet, dus een bediener die bevestigt
       zonder eerst te verversen kreeg een 409 terwijl de trede wel degelijk
       klaarstond. En het is ook de veilige volgorde: is de meting intussen
       omgeslagen, dan zakt de regie hier eerst en bevestigt de mens niets meer. */
    weeg();
    const u = staat();
    if (u.stand !== 'wacht-op-mens') return { status: 409, error: 'Er staat geen trede te wachten op een mens.' };
    const volgende = TREDEN()[index(u.trede) + 1];
    if (!volgende) return { status: 409, error: 'De trap is uit.' };
    const r = zet(volgende.id, door, 'hand');
    if (r && r.error) return r;
    const u2 = staat();
    u2.stand = 'klimt';
    save();
    return stand();
  }

  /* De weging. Zakt bij tegenwind, klimt bij groen, en blijft staan voor een
     trede met de mensrem. Raakt niets aan als de regie niet klimt -- behalve
     zakken, want die richting mag altijd (zie de kop). */
  function weeg() {
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
  }

  function stand() {
    const gedaan = weeg();
    const u = staat();
    const i = index(u.trede);
    const volgende = i >= 0 ? TREDEN()[i + 1] : null;
    return {
      trede: u.trede, sinds: u.sinds, stand: u.stand, reden: u.reden,
      oordeel: gedaan.oordeel || oordeel(u),
      zojuist: gedaan.gedaan || null,
      volgende: volgende ? { id: volgende.id, naam: volgende.naam, mens: !!volgende.mens,
        mensWaarom: volgende.mensWaarom || null } : null,
      trap: TREDEN().map((t, n) => ({ id: t.id, naam: t.naam, mens: !!t.mens,
        aantalAan: t.aan ? t.aan.length : null, hier: n === i, gehad: n <= i })),
      geschiedenis: u.geschiedenis.slice(0, 20),
      standaard: STANDAARD,
      uitleg: 'de cijfers komen uit server/meting.js, dezelfde tellers als /api/metrics en de ' +
        'servicedoelen; de regie rekent op het verschil sinds de trede werd gezet'
    };
  }

  // Zonder tikker betekent "klimt vanzelf": pas als er iemand kijkt. Zie ./tikker.js.
  const tikker = maakTikker(weeg, STANDAARD.tikMs);

  return { stand, zet, klim, pauze, bevestig, weeg, oordeel: () => oordeel(staat()), tikker, STANDAARD };
}

module.exports = { maakUitrolregie, STANDAARD };
