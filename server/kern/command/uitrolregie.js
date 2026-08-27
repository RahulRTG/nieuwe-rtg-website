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
   DRIE KEUZES DIE ERTOE DOEN

   1. DE METING KOMT UIT server/meting.js, dezelfde tellers als /api/metrics, de
      servicedoelen en de canary. Een uitrol die zelf telt kan een ander verhaal
      vertellen dan het foutbudget, en dan is niet meer te zeggen welke van de
      twee had moeten stoppen. Omdat die tellers sinds procesbegin lopen, legt
      elke trede een NULMETING vast en rekent de regie op het verschil.

   2. HERSTARTEN WIST DE NULMETING, en dan KLIMT DE REGIE NIET. Het verschil
      staat dan lager dan de nulmeting, en dat is geen groen maar een onbekende.
      Stilzwijgend doorrekenen geeft een negatief foutaantal en dus altijd groen
      -- precies de kant waarop een uitrolautomaat niet fout mag gaan. Hij meldt
      'nulmeting kwijt' en wacht tot er weer echt gemeten is.

   3. HIJ MEET ALLE VERKEER EN NIET ALLEEN DE NIEUWE PADEN. Een trede openzetten
      kan iets breken dat er niet in staat -- een nieuwe query die de database
      belast, een laag die ineens meer werk krijgt. Alleen de nieuwe paden wegen
      zou juist dat missen.

   ------------------------------------------------------------------------
   WAT DEZE REGIE NIET IS

   Geen deploy-automaat: hij zet functies open die al draaien, hij rolt geen
   code uit. Geen vervanger van de storingswachter (functies/wachter.js), die
   bij een golf fouten één functie dichtgooit -- dat is een noodrem en dit is een
   uitrol. En geen bewijs dat een trede goed is: een laag foutpercentage zegt
   dat er niets omvalt, niet dat het klopt.
   ========================================================================== */
'use strict';

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
  const index = id => TREDEN().findIndex(t => t.id === id);

  function staat() {
    /* Door de deur van het domein (./opslag.js, gedeeld.uitrol) en niet
       rechtstreeks in db.data -- keuringsregel 62 houdt dat sindsdien bij.
       Het vak maakt beide lagen zelf aan; zie de kop van dat vak voor waarom
       gedeeld.techniek() hier niet volstond. */
    return opslag.gedeeld.uitrol();
  }

  /* Alle antwoorden en alle serverfouten van dit moment. Zie keuze 3 in de kop:
     bewust over het HELE verkeer en niet over de paden van de nieuwe trede. */
  function tel() {
    const r = meting.reeksen();
    let antwoorden = 0, fouten = 0;
    for (const v of r.verzoeken) {
      antwoorden += v.aantal;
      if (v.status === '5xx') fouten += v.aantal;
    }
    return { antwoorden, fouten };
  }

  function boek(u, van, naar, door, hoe, reden) {
    u.geschiedenis.unshift({ at: iso(), van: van || null, naar: naar || null,
      door: String(door || 'onbekend'), hoe, reden: reden || null });
    if (u.geschiedenis.length > STANDAARD.geschiedenisMax) u.geschiedenis.length = STANDAARD.geschiedenisMax;
  }

  /* Het oordeel over de HUIDIGE trede. Vier uitkomsten, en drie ervan zijn
     "nog niet weten" -- die worden met opzet uit elkaar gehouden, want ze
     vragen om ander gedrag van de bediener. */
  function oordeel(u) {
    if (!u.trede) return { stand: 'geen trede', klimbaar: false };
    const nuTel = tel();
    const antwoorden = nuTel.antwoorden - ((u.basis && u.basis.antwoorden) || 0);
    const fouten = nuTel.fouten - ((u.basis && u.basis.fouten) || 0);
    if (antwoorden < 0 || fouten < 0) {
      return { stand: 'nulmeting kwijt', klimbaar: false, zakbaar: false,
        uitleg: 'het proces is herstart, dus er valt niets te wegen tot deze trede opnieuw wordt gezet' };
    }
    const wachtMs = u.sinds ? (tijd() - Date.parse(u.sinds)) : 0;
    const deel5xx = antwoorden ? Number((fouten / antwoorden).toFixed(4)) : null;
    const genoeg = antwoorden >= STANDAARD.minimum;
    const uitgerust = wachtMs >= STANDAARD.rustMs;
    if (genoeg && deel5xx > STANDAARD.drempel) {
      return { stand: 'over de drempel', klimbaar: false, zakbaar: true, antwoorden, fouten, deel5xx, wachtMs,
        uitleg: Math.round(deel5xx * 1000) / 10 + '% serverfouten op ' + antwoorden + ' antwoorden' };
    }
    if (!genoeg) return { stand: 'onvoldoende gemeten', klimbaar: false, zakbaar: false, antwoorden, fouten, deel5xx, wachtMs,
      uitleg: antwoorden + ' van de ' + STANDAARD.minimum + ' antwoorden die nodig zijn om iets te durven zeggen' };
    if (!uitgerust) return { stand: 'nog niet uitgerust', klimbaar: false, zakbaar: false, antwoorden, fouten, deel5xx, wachtMs,
      uitleg: 'deze trede staat ' + Math.round(wachtMs / 60000) + ' van de ' + Math.round(STANDAARD.rustMs / 60000) + ' minuten' };
    return { stand: 'binnen de drempel', klimbaar: true, zakbaar: false, antwoorden, fouten, deel5xx, wachtMs };
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

  /* De tikker. Zonder deze betekent "klimt vanzelf": pas als er iemand kijkt.
     unref, zodat hij een proces nooit openhoudt. */
  function tikker() {
    const t = setInterval(() => { try { weeg(); } catch (e) { /* nooit de lus breken */ } }, STANDAARD.tikMs);
    if (t.unref) t.unref();
    return t;
  }

  return { stand, zet, klim, pauze, bevestig, weeg, oordeel: () => oordeel(staat()), tikker, STANDAARD };
}

module.exports = { maakUitrolregie, STANDAARD };
