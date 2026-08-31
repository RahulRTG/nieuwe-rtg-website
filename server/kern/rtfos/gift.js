/* Foundation OS, deel "gift": de doneerknop die nog dicht staat.

   WAAROM DIT BESTAAT TERWIJL DE KNOP ER NIET IS. `./donateur.js` zegt in zijn
   kop: geen doneerknop en geen incasso. Dat blijft waar. Wat hier staat is de
   VOORBEREIDING uit GIFT.md: de stand die de eigenaar moet zetten, en het
   klaarzetten van een voorgenomen gift dat nooit betaalt.

   DE SCHAKELAAR IS DE POSITIE, NIET EEN INSTELLING ERNAAST. Zelfde vorm als de
   terugstortstand in kern/bankregie/vergunning.js: wat de eigenaar hier zet, IS
   wat RTG met giften doet -- niet twee dingen die toevallig samenhangen. Hij
   staat standaard DICHT, en hij kan niet open zonder dat de twee dingen zijn
   ingevuld die een gift ergens laten landen. Een knop die opengaat terwijl er
   geen ontvanger is, stuurt geld nergens heen.

   DRIE GRENDELS DIE HIER ZELF STAAN:

   1. OPEN KAN ALLEEN MET EEN ONTVANGER EN EEN VORM. Geen entiteit = geen open
      stand, en de weigering zegt welke van de twee ontbreekt. Dat is besluit 1
      en 2 uit GIFT.md, en ze zijn hier niet te omzeilen.

   2. EEN VOORNEMEN IS GEEN GIFT EN GEEN BETALING. `voorbereid()` rekent uit wat
      er ZOU gebeuren -- is het een gift of sponsoring, wordt het eerst
      beoordeeld, komt er een bewijs of een ontvangstbevestiging -- en boekt
      niets. Er is in dit bestand geen enkele aanroep naar de betaalpoort, en
      test/rtfos-gift.test.js zakt als er een komt.

   3. ONBEKEND IS NIET AFTREKBAAR. Staat de ANBI-status van de stichting niet
      vast, dan heet het stuk een ontvangstbevestiging en zegt het voornemen dat
      de gift niet aftrekbaar is. Dat is dezelfde regel als bij de fiscale
      klassen in CLAUDE.md: wat niemand heeft ingedeeld, valt terug op de
      voorzichtige kant en zegt dat het niet is ingedeeld -- nooit stilzwijgend
      de gunstige uitkomst.

   Wat hier NIET in zit en ook niet hoort: geen bedrag dat beweegt, geen
   incasso, geen teller van wat er is opgehaald. Zie GIFT.md par. 5. */
'use strict';

/* De drie lijsten staan in ./gift-vormen.js, want ./gift-voornemen.js heeft
   VORMEN ook nodig. De vormen uit besluit 2 verschillen juridisch en niet
   cosmetisch, en `onbekend` is met opzet iets anders dan `nee`. */
const { STANDEN, VORMEN, ANBI_STANDEN } = require('./gift-vormen');

module.exports = (ctx) => {
  const { nu, schoon, S, audit, naarCenten, euro, save } = ctx;

  const d = () => {
    const s = S();
    if (!s.giftstand || typeof s.giftstand !== 'object') {
      s.giftstand = { stand: 'dicht', ontvanger: null, vormen: [], anbi: 'onbekend', rsin: '', door: null, at: null };
    }
    return s.giftstand;
  };

  /* Wat ontbreekt er nog voordat deze knop open KAN? Een lijst en geen boolean:
     "het kan niet" is voor de eigenaar geen bruikbaar antwoord. */
  function ontbreekt() {
    const g = d();
    const uit = [];
    if (!g.ontvanger || !g.ontvanger.soort) {
      uit.push({ besluit: 1, wat: 'ontvanger',
        vraag: 'Waar landt het geld? Zonder walletcode van de RTFoundation gaat een gift nergens heen.' });
    }
    if (!Array.isArray(g.vormen) || !g.vormen.length) {
      uit.push({ besluit: 2, wat: 'vormen',
        vraag: 'Welke giftvormen gaan open: eenmalig, geoormerkt op een project, of periodiek?' });
    }
    if (g.anbi === 'onbekend') {
      /* Dit houdt de knop NIET tegen, en dat is met opzet: een stichting die
         geen ANBI is mag giften aannemen. Het bepaalt alleen hoe het stuk heet
         dat de gever terugkrijgt. Wel gemeld, want anders staat er straks
         "giftbewijs" op een aanname. */
      uit.push({ besluit: 3, wat: 'anbi', blokkeert: false,
        vraag: 'Is de RTFoundation zelf een ANBI? Zolang dat niet vaststaat, heet het stuk een ontvangstbevestiging.' });
    }
    return uit;
  }

  function stand() {
    const g = d();
    const open = g.stand === 'open';
    const mist = ontbreekt();
    return { ok: true,
      stand: STANDEN.includes(g.stand) ? g.stand : 'dicht',
      ontvanger: g.ontvanger || null,
      vormen: Array.isArray(g.vormen) ? g.vormen : [],
      anbi: ANBI_STANDEN.includes(g.anbi) ? g.anbi : 'onbekend',
      rsin: g.rsin || '',
      door: g.door || null, at: g.at || null,
      ontbreekt: mist,
      uitleg: open
        ? 'RTG neemt giften aan voor de RTFoundation. Wat er wordt aangenomen en hoe het wordt verantwoord, staat in het donateursportaal.'
        : 'RTG neemt geen giften aan. Dit is geen storing maar een stand: ' +
          (mist.length ? 'er staat nog een besluit open.' : 'de eigenaar heeft hem dicht gezet.') };
  }

  /* De schakelaar. Alleen vanuit de boardroom -- de poort staat op de route. */
  function standZet(b, wie) {
    b = b || {};
    const g = d();

    if (b.ontvanger !== undefined) {
      const o = b.ontvanger;
      if (o === null) { g.ontvanger = null; }
      else {
        /* EEN WALLET ZOALS EEN LEVERANCIER ER EEN HEEFT (besluit van de
           eigenaar, 31 augustus 2026). Dat is met opzet geen nieuwe betaalvorm:
           kern/pay/partner.js boekt al van een lid naar `partner:<code>`, en de
           stichting betaalt zichzelf uit naar haar bankrekening langs precies
           dezelfde weg als elke zaak (/api/supplier/pay/uitbetaal). Er komt dus
           geen tweede betaalweg bij, alleen een tweede houder van een wallet. */
        const soort = schoon(o && o.soort, 20);
        if (soort !== 'wallet') {
          return { status: 400, error: 'De ontvanger is een wallet, zoals een leverancier er een heeft. De stichting betaalt zichzelf daarvandaan uit naar haar eigen bankrekening.' };
        }
        const code = schoon(o.code, 40).toUpperCase();
        if (!code) return { status: 400, error: 'Welke walletcode? Zonder die code landt er niets.' };
        g.ontvanger = { soort: 'wallet', code };
      }
    }
    if (b.vormen !== undefined) {
      const v = Array.isArray(b.vormen) ? b.vormen.filter(x => VORMEN.includes(x)) : [];
      if (Array.isArray(b.vormen) && v.length !== b.vormen.length) {
        return { status: 400, error: 'Kies uit: ' + VORMEN.join(', ') + '.' };
      }
      g.vormen = v;
    }
    if (b.anbi !== undefined) {
      if (!ANBI_STANDEN.includes(b.anbi)) return { status: 400, error: 'Kies ' + ANBI_STANDEN.join(', ') + '.' };
      g.anbi = b.anbi;
      if (b.anbi === 'ja') {
        const rsin = String(b.rsin || '').replace(/\D/g, '');
        if (!/^\d{9}$/.test(rsin)) return { status: 400, error: 'Een RSIN bestaat uit 9 cijfers.' };
        g.rsin = rsin;
      } else { g.rsin = ''; }
    }

    if (b.stand !== undefined) {
      if (!STANDEN.includes(b.stand)) return { status: 400, error: 'Kies ' + STANDEN.join(' of ') + '.' };
      if (b.stand === 'open') {
        const blokkeert = ontbreekt().filter(x => x.blokkeert !== false);
        if (blokkeert.length) {
          return { status: 409,
            error: 'Deze knop kan nog niet open: ' + blokkeert.map(x => x.vraag).join(' '),
            ontbreekt: blokkeert };
        }
      }
      g.stand = b.stand;
    }

    g.door = schoon(wie, 60) || 'boardroom';
    g.at = nu();
    save();
    audit(g.door, 'gift.stand', g.stand, JSON.stringify({ ontvanger: !!g.ontvanger, vormen: g.vormen, anbi: g.anbi }));
    return stand();
  }

  /* Het voornemen woont hiernaast: dit bestand ging over de 10 KB, en de naad
     loopt langs de lezer -- hier de eigenaar, daar de gever. */
  const voornemen = require('./gift-voornemen')(ctx, {
    standVan: d, uitlegVan: () => stand().uitleg, ontbreektVan: ontbreekt
  });
  /* En de enige plek waar geld beweegt, ook apart: dit bestand gaat over de
     stand, dat over de handeling. */
  const periodiek = require('./gift-periodiek')(ctx, { standVan: stand });
  /* donateur.js legt de overeenkomst vast en zei daarbij "aftrekbaar zonder
     drempel". Dat hangt af van de ANBI-stand, en die woont hier. Via de ctx,
     zodat er niet twee plekken zijn die hem bijhouden. */
  ctx.giftAnbi = () => stand().anbi;
  ctx.giftRsin = () => stand().rsin;
  /* De SEPA-machtiging bij een meerjarig plan. Hij hangt NA het plan (hij
     leest het) en zet zijn intrekker op de ctx, zodat een gestopt plan geen
     volmacht achterlaat zonder dat die twee delen elkaar over en weer laden. */
  const machtiging = require('./gift-machtiging')(ctx, {
    planVan: periodiek.mijn, standVan: stand
  });
  ctx.giftMachtigingWeg = machtiging.bijPlanGestopt;
  const betalen = require('./gift-betalen')(ctx, {
    standVan: d, voorbereidVan: voornemen.voorbereid,
    bronUitGift: (x) => ctx.bronUitGift(x),
    termijnAf: periodiek.termijnAf
  });

  return { stand, standZet, voorbereid: voornemen.voorbereid, bevestig: betalen.bevestig,
    plan: periodiek, machtiging, ontbreekt, STANDEN, VORMEN, ANBI_STANDEN };
};
module.exports.STANDEN = STANDEN;
module.exports.VORMEN = VORMEN;
module.exports.ANBI_STANDEN = ANBI_STANDEN;
