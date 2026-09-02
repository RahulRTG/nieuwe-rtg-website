/* Foundation OS: de winkel van de RTFoundation.

   EERST DE CORRECTIE, WANT IK HEB HIEROVER TWEE KEER IETS ANDERS GEZEGD. Ik
   meldde eerst dat een winkel op de bestaande commerce-laag kon, daarna dat dat
   niet kon. Nagemeten in de code klopt de eerste versie, met een grens: de Mall
   (kern/mall/aanbod.js) is een LEESLAAG die domeinen op een gedeelde vorm
   projecteert, kern/commerce/mand.js is de mand en kern/commerce/afrekening.js
   rekent een afrekening PER VERKOPER uit -- maar bevestigen en betalen doet elk
   domein zelf (`bevestigBij`). RTG bevestigt niets namens een verkoper. Dit
   bestand is dus dat laatste stuk voor de stichting, en niet een tweede winkel.

   HET SCHERPSTE ONDERSCHEID STAAT AL IN DIT HUIS: EEN AANKOOP IS GEEN GIFT.
   ./herkomst.js weigert een donatie waar iets tegenover staat, en ./gift.js
   geeft dan geen giftbewijs af maar een factuur. In een winkel staat er per
   definitie iets tegenover: een tas, een boek, een kaartje. Deze laag loopt
   daarom NIET langs de giftweg, en er komt hier nooit een giftbewijs uit --
   ook niet als iemand meer betaalt dan het ding kost. Wie wil geven, geeft;
   wie iets koopt, koopt.

   VIER GRENDELS:

   1. GEEN VOORRAAD, GEEN VERKOOP. Een winkel die doorverkoopt wat op is, maakt
      een belofte die iemand met de hand moet terugdraaien.

   2. DE PRIJS KOMT NOOIT UIT DE BROWSER. De invoer is (artikelId, aantal); het
      bedrag wordt hier opgezocht. Stuurt een client toch een bedrag mee, dan
      wordt dat GEMELD en niet stil genegeerd -- dezelfde regel als
      kern/commerce/afrekening.js.

   3. HET GELD LANDT IN DE WALLET VAN DE STICHTING, langs pay.partnerIn -- exact
      dezelfde weg als een gift en als elke betaling aan een zaak. Er komt geen
      tweede betaalweg bij (GELD.md).

   4. ER GAAT NIETS DE DEUR UIT ZONDER MENS. Een bestelling wordt KLAARGEZET;
      of hij verstuurd of opgehaald is, zet een mens van de stichting. Software
      die zelf "geleverd" aanvinkt, liegt over de enige stap die telt.

   AFHALEN, EN DAAROM GEEN GEGEVENSPOORT. Deze winkel verstuurt niets: je haalt
   op bij de stichting, en die ziet een codenaam en een bestelling. Er gaat dus
   geen contactgegeven naar een derde, en de poort (kern/gegevenspoort.js) hoort
   er niet voor. Hij stond er even wel, met soort 'bestelling' -- die vraagt een
   telefoonnummer met de reden "de zaak moet je kunnen bereiken als er iets
   verandert aan je TAFEL of je bestelling". Een horecareden onder een webwinkel:
   waar genoeg om door een keuring te komen en onwaar op het scherm.

   KOMT ER OOIT BEZORGING BIJ, dan hoort de poort er WEL bij (soort 'bezorging':
   telefoon en adres) en hoort de vrijstelling in scripts/check.js weg. Dat is
   geen detail dat je later wel ziet: op het moment dat er een adresveld
   verschijnt, gaat er een gegeven naar een derde dat er nu niet heen gaat.

   WAT HIER NIET IN ZIT: geen bezorging, geen verzendkosten, geen retour en geen
   btw-berekening.
   De btw hoort in kern/fiscaal/tarief.js en nergens anders; zolang deze winkel
   geen fiscale behandeling per artikel draagt, staat er geen btw-bedrag op het
   scherm -- een 0 die niemand heeft gerekend is erger dan een lege plek. */
'use strict';

const STANDEN = ['klaar', 'verstuurd', 'opgehaald', 'geannuleerd'];

module.exports = (ctx) => {
  const { nu, rid, schoon, S, audit, naarCenten, euro, save } = ctx;

  const A = () => { const s = S(); if (!Array.isArray(s.winkelartikelen)) s.winkelartikelen = []; return s.winkelartikelen; };
  const B = () => { const s = S(); if (!Array.isArray(s.winkelbestellingen)) s.winkelbestellingen = []; return s.winkelbestellingen; };

  const artikelBeeld = a => ({ id: a.id, naam: a.naam, uitleg: a.uitleg || null,
    euro: euro(a.centen), voorraad: a.voorraad, doel: a.doel || null,
    open: a.open !== false && a.voorraad > 0 });

  /* ---------- de winkel, voor iedereen die kijkt ---------- */
  function etalage() {
    const rijen = A().filter(a => a.open !== false).map(artikelBeeld);
    return { ok: true, aantal: rijen.length, artikelen: rijen,
      /* DE ZIN DIE HET VERSCHIL MAAKT, en die hoort in de etalage en niet in de
         kleine lettertjes onder de knop. */
      uitleg: 'Dit is een winkel en geen collectebus: je koopt iets, dus er staat iets tegenover. ' +
        'Een aankoop is daarom geen aftrekbare gift en je krijgt er geen giftbewijs voor. ' +
        'De opbrengst gaat naar het werk van de stichting.' };
  }

  /* ---------- het kantoor ---------- */
  function artikelZet(b, wie) {
    b = b || {};
    const naam = schoon(b.naam, 80);
    if (naam.length < 2) return { status: 400, error: 'Hoe heet dit artikel?' };
    const centen = naarCenten(b.euro);
    if (!centen) return { status: 400, error: 'Wat kost het? Een artikel zonder prijs kan niet verkocht worden.' };
    const voorraad = Math.max(0, Math.round(Number(b.voorraad) || 0));
    const bestaand = b.id ? A().find(x => x.id === String(b.id)) : null;
    const a = bestaand || { id: rid(), at: nu() };
    Object.assign(a, { naam, uitleg: schoon(b.uitleg, 300) || null, centen, voorraad,
      doel: schoon(b.doel, 120) || null, open: b.open !== false,
      door: schoon(wie, 60) || 'kantoor', bij: nu() });
    if (!bestaand) A().push(a);
    audit(a.door, bestaand ? 'winkel.artikel-gewijzigd' : 'winkel.artikel', a.id, naam + ', ' + euro(centen));
    save();
    return { ok: true, artikel: artikelBeeld(a) };
  }

  function bestellingen() {
    return { ok: true, bestellingen: B().slice(-200).reverse().map(o => ({
      id: o.id, koper: o.codenaam, artikel: o.naam, aantal: o.aantal,
      euro: euro(o.centen), stand: o.stand, at: o.at, bron: o.bron || null })) };
  }

  /* GRENDEL 4: een mens zet de stand. */
  function standZet(b, wie) {
    b = b || {};
    const o = B().find(x => x.id === String(b.id || ''));
    if (!o) return { status: 404, error: 'Deze bestelling bestaat niet.' };
    const stand = String(b.stand || '');
    if (!STANDEN.includes(stand)) return { status: 400, error: 'Kies ' + STANDEN.join(', ') + '.' };
    o.stand = stand;
    o.standDoor = schoon(wie, 60) || 'kantoor';
    o.standAt = nu();
    audit(o.standDoor, 'winkel.stand', o.id, stand);
    save();
    return { ok: true, stand };
  }

  /* ---------- kopen ---------- */
  async function koop(b) {
    b = b || {};
    const codenaam = schoon(b.codenaam, 40);
    if (!codenaam) return { status: 401, error: 'Hiervoor is een eigen RTG-account nodig.' };
    const a = A().find(x => x.id === String(b.artikelId || ''));
    if (!a || a.open === false) return { status: 404, error: 'Dit artikel staat niet te koop.' };
    const aantal = Math.max(1, Math.min(20, Math.round(Number(b.aantal) || 1)));
    /* GRENDEL 1 */
    if (a.voorraad < aantal) {
      return { status: 409, error: a.voorraad > 0
        ? 'Er zijn er nog ' + a.voorraad + '. Wil je er zoveel?'
        : 'Dit artikel is uitverkocht.' , voorraad: a.voorraad };
    }
    /* GRENDEL 2: gemeld en niet stil genegeerd. */
    const meegestuurd = (b.euro !== undefined || b.centen !== undefined)
      ? 'Je stuurde een bedrag mee; dat is genegeerd. De prijs komt van de server.' : null;

    const centen = a.centen * aantal;
    const ontvanger = ctx.winkelOntvanger ? ctx.winkelOntvanger() : null;
    if (!ontvanger) {
      return { status: 409, error: 'De stichting heeft nog geen positie in RTG Pay; er kan nu niets afgerekend worden.' };
    }
    const pay = ctx.pay;
    if (!pay || typeof pay.partnerIn !== 'function') {
      return { status: 503, error: 'RTG Pay is nu niet bereikbaar. Er is niets afgeschreven; probeer het straks opnieuw.' };
    }
    const idem = schoon(b.idem, 60) || ('winkel-' + codenaam + '-' + a.id + '-' + aantal + '-' + nu().slice(0, 10));
    const betaald = await pay.partnerIn({ supplierCode: ontvanger, codenaam, centen,
      oms: 'RTFoundation winkel -- ' + a.naam, soort: 'winkel', idem });
    if (!betaald || betaald.error) return betaald || { status: 502, error: 'De betaling is niet gelukt.' };

    a.voorraad -= aantal;
    const o = { id: rid(), codenaam, artikelId: a.id, naam: a.naam, aantal, centen,
      stand: 'klaar', at: nu(), bron: null };
    B().push(o);
    audit(codenaam, 'winkel.koop', o.id, a.naam + ' x' + aantal + ', ' + euro(centen));
    save();
    return { ok: true, bestelling: { id: o.id, artikel: a.naam, aantal, euro: euro(centen), stand: o.stand },
      kosten: betaald.kosten || 0, meegestuurd,
      zegt: [
        /* het bedrag zoals de kaart het zegt ("€ 12,50"), niet als kaal getal (12.5) */
        'Gekocht: ' + a.naam + (aantal > 1 ? ' (' + aantal + 'x)' : '') + ' voor € ' + euro(centen).toFixed(2).replace('.', ',') + '.',
        /* DE GRENS, EN NIET IN DE KLEINE LETTERTJES. */
        'Dit is een aankoop en geen gift: er staat iets tegenover, dus je krijgt hiervoor geen giftbewijs en het is niet aftrekbaar.',
        'De stichting zet klaar wat je hebt gekocht. Wanneer het verstuurd of klaargelegd is, zet een mens van de stichting dat hier.'
      ] };
  }

  function mijn(codenaam) {
    const ik = schoon(codenaam, 40);
    if (!ik) return { status: 401, error: 'Hiervoor is een eigen RTG-account nodig.' };
    return { ok: true, bestellingen: B().filter(o => o.codenaam === ik).slice(-50).reverse()
      .map(o => ({ id: o.id, artikel: o.naam, aantal: o.aantal, euro: euro(o.centen), stand: o.stand, at: o.at })) };
  }

  return { etalage, artikelZet, bestellingen, standZet, koop, mijn, STANDEN };
};
module.exports.STANDEN = STANDEN;
