/* ============================================================================
   DE AANSCHAF -- wat er gebeurt als een lid een app van een derde koopt, en de
   omzet die een uitgever daarvan terugziet.

   Apart van ./geld.js omdat dat bestand met beide helften over de
   10 kB-keuringsgrens van dit huis ging, en omdat de naad hier echt loopt: daar
   staat WAT iets kost (de afdracht en de rekensom), hier staat wat er GEBEURT.

   TWEE REGELS DIE HIER WORDEN AFGEDWONGEN.

   1. KOPEN GEBEURT IN DE WINKEL, NOOIT IN DE APP. Deze functie wordt aangeroepen
      vanaf een scherm van RTG, met de bon ervoor. De brug van de cel kent geen
      methode die geld beweegt, en die komt er ook niet: GELD.md par. 3 zegt dat
      alles wat een derde raakt maximaal "klaarzetten" is.

   2. EEN UITGEVER ZIET AANTALLEN EN BEDRAGEN, NOOIT WIE. Ook geen codenaam --
      een codenaam plus een tijdstip is een spoor, en het codenaam-ontwerp van
      dit huis is er juist om dat onmogelijk te maken.
   ========================================================================== */
'use strict';

module.exports = function maakAanschaf({ S, save, nu, boek, eigen, norm, uitgever, app, versie, pay, findSupplier, bon, afdracht }) {

  function aankopen(key) {
    const s = S();
    if (!s.aankopen || typeof s.aankopen !== 'object') s.aankopen = {};
    if (!s.aankopen[String(key)] || typeof s.aankopen[String(key)] !== 'object') s.aankopen[String(key)] = {};
    return s.aankopen[String(key)];
  }
  const gekocht = (key, sleutel) => eigen(aankopen(key), sleutel);
  const isBetaald = (sleutel) => {
    const a = app(sleutel); const v = a && a.live ? versie(a.live) : null;
    return !!(v && Number(v.manifest.prijsCenten || 0) > 0);
  };

  /* Kopen. De zaak van de uitgever is de ontvanger: die heeft al een
     RTG Pay-partnerrekening en een uitbetaalweg. Heeft hij die niet, dan gaat de
     aanschaf niet door -- geld dat nergens heen kan, hoort niet geind te worden. */
  async function koop({ key, codenaam, sleutel, land, idem }) {
    if (gekocht(key, sleutel)) return { status: 200, ok: true, al: true, bon: gekocht(key, sleutel) };
    const r = bon({ sleutel, land });
    if (r.error) return r;
    if (r.gratis) return { status: 400, error: 'Deze app is gratis; zet hem gewoon op je startscherm.' };

    const a = app(sleutel);
    const u = uitgever(a.org);
    if (!u || u.status !== 'toegelaten') return { status: 409, error: 'De uitgever van deze app kan op dit moment niets ontvangen.' };
    const zaak = u.leverancier ? findSupplier(u.leverancier) : null;
    if (!zaak) return { status: 409, error: 'De uitgever heeft geen werkplek waar de opbrengst heen kan. RTG lost dit met hem op; probeer het later opnieuw.' };

    const inhoudingen = [];
    if (r.btwCenten > 0) inhoudingen.push({ naar: 'rtg:btw', centen: r.btwCenten, oms: 'Btw ' + r.btwProcent + '% (' + r.land + '), afgedragen door RTG' });
    if (r.afdrachtCenten > 0) inhoudingen.push({ naar: 'rtg:appstore', centen: r.afdrachtCenten, oms: 'Afdracht App Store ' + r.afdrachtProcent + '%' });

    const b = await pay.verkoop({ codenaam, naarPartner: zaak.code, brutoCenten: r.brutoCenten,
      inhoudingen, soort: 'appstore', oms: 'App Store: ' + r.naam, ref: sleutel, idem });
    if (b.error) return { status: b.status || 400, error: b.error };

    /* De bon wordt hier BEVROREN. Verandert de afdracht morgen, of het
       btw-tarief, dan blijft hier staan wat er die dag gold -- anders is een
       verkoop van vorig jaar niet meer na te rekenen. */
    /* De CODENAAM gaat mee op de bon, en dat is het betaaladres en geen extra
       gegeven: hij stond al in de boeking die er net is gedaan. Zonder hem zou
       een teruggave later moeten raden waar het geld heen moet, en raden is bij
       geld nooit goed. */
    const vast = { sleutel: r.sleutel, naam: r.naam, versie: r.versie, uitgever: r.uitgever, codenaam,
      land: r.land, btwProcent: r.btwProcent, brutoCenten: r.brutoCenten, btwCenten: r.btwCenten,
      nettoCenten: r.nettoCenten, afdrachtProcent: r.afdrachtProcent, afdrachtCenten: r.afdrachtCenten,
      uitgeverCenten: r.uitgeverCenten, zaak: zaak.code, boekingId: b.boekingId, at: nu() };
    aankopen(key)[sleutel] = vast;
    boek('aanschaf', sleutel, null, { brutoCenten: vast.brutoCenten, land: vast.land, boekingId: vast.boekingId });
    save();
    return { status: 200, ok: true, bon: vast, let: 'Betaald. De app staat nu op je startscherm; updates zijn gratis.' };
  }

  /* ------------------------------------------------------------- de omzet */

  /* Wat een uitgever van zijn eigen verkopen ziet: aantallen en bedragen, nooit
     wie. Een uitgever hoort niet te kunnen zien welk lid zijn app kocht -- ook
     niet op codenaam, want een codenaam plus een tijdstip is een spoor. */
  function omzet(org) {
    const o = norm(org);
    const mijn = new Set(Object.values(S().apps || {}).filter(a => a.org === o).map(a => a.sleutel));
    const bak = S().aankopen || {};
    const per = {};
    let bruto = 0, btw = 0, afdr = 0, netto = 0, aantal = 0;
    for (const key of Object.keys(bak)) {
      for (const [sleutel, b] of Object.entries(bak[key] || {})) {
        if (!mijn.has(sleutel) || !b || !b.brutoCenten) continue;
        if (!per[sleutel]) per[sleutel] = { sleutel, naam: b.naam, aantal: 0, brutoCenten: 0, btwCenten: 0, afdrachtCenten: 0, uitgeverCenten: 0 };
        per[sleutel].aantal++; per[sleutel].brutoCenten += b.brutoCenten; per[sleutel].btwCenten += b.btwCenten;
        per[sleutel].afdrachtCenten += b.afdrachtCenten; per[sleutel].uitgeverCenten += b.uitgeverCenten;
        aantal++; bruto += b.brutoCenten; btw += b.btwCenten; afdr += b.afdrachtCenten; netto += b.uitgeverCenten;
      }
    }
    return { aantal, brutoCenten: bruto, btwCenten: btw, afdrachtCenten: afdr, uitgeverCenten: netto,
      perApp: Object.values(per).sort((a, b) => b.brutoCenten - a.brutoCenten),
      afdrachtNu: afdracht(),
      let: 'Aantallen en bedragen, nooit wie. Wat hier staat is al op de RTG Pay-rekening van je zaak bijgeschreven; uitbetalen doe je daar.' };
  }

  return { koop, gekocht, isBetaald, aankopen, omzet };
};
