/* DE WEG TERUG VAN EEN BETAALDE REIS -- het recht, en wie het uitvoert.

   Deelbestand van ./reisbureau-betaling.js. Het krijgt de `eigen`-greep van die
   eigenaar mee en schrijft dus ALS die eigenaar (keuringsregel 63): er komt geen
   tweede schrijver op `reisTeruggaven` of `reisGeldrijen`.

   DRIE STANDEN, EN DE DERDE ONTSTAAT ALLEEN UIT EEN BOEKING.

     klaargezet   het recht staat (uitgevoerd: false); er is geen geld bewogen
     uitgevoerd   een mens van het kantoor heeft het uitgevoerd EN kern/pay heeft
                  de boeking gedaan -- de stand wordt pas gezet met de delen van
                  die boeking erbij, nooit doordat iemand "klaar" zegt
     afgewezen    een mens wees het af, met een reden die het lid leest

   Hier stond alleen de eerste: "een mens van het kantoor voert hem uit langs
   kern/pay", maar er was geen weg om dat te doen (Fase 0, defect D8). De
   uitvoering betaalt van `rtg:reisbureau` terug, de positie waar RTG de reissom
   int, naar het BETAALADRES op de bon -- nooit naar een opnieuw opgezocht adres:
   een tweede weg naar dezelfde waarheid kan afwijken, en bij geld is dat het
   verschil tussen "terugbetaald" en "aan iemand anders overgemaakt" (dezelfde
   regel als kern/appstore/teruggave.js).

   WAT DIT BESTAND NIET DOET: beslissen WIE mag uitvoeren. Dat doet de route
   (routes/kantoren/reisteruggave.js): een mens op naam, met een passkey, en
   vanaf duizend euro met een tweede mens. Hier komt alleen binnen WIE het was. */
'use strict';

const { spiegelVoor } = require('./reisbureau-terugboeking');

function maakTeruggave({ eigen, bureau, pay, klok, nieuwId, save, rijenVan, KAS }) {
  const lijst = () => eigen.kijk('reisTeruggaven');
  const teruggaveVan = (id) => lijst().find(r => r.id === String(id || '')) || null;

  /* Het betaaladres van een betaalde reis. Eerst de bon zelf (`betaald.van`,
     sinds 4 oktober 2026); voor een oudere betaling de grootboekboeking waar de
     bon naar wijst. Komt het nergens vandaan, dan null -- en dan weigert de
     uitvoering met de reden in plaats van een adres te raden. */
  function betaaladres(a) {
    if (a.betaald && a.betaald.van) return String(a.betaald.van);
    const p = pay();
    if (!p || typeof p.boekingenVan !== 'function' || !a.betaald) return null;
    const b = p.boekingenVan(KAS, 1000).find(x => x.id === a.betaald.boeking);
    return b && /^lid:/.test(b.van) ? b.van.slice(4) : null;
  }

  /* HET RECHT KLAARZETTEN. De spiegel wordt puur berekend
     (./reisbureau-terugboeking.js) en hier alleen bewaard. Er wordt GEEN geld
     verplaatst -- er ontstaat een teruggaveRECHT dat een mens uitvoert. */
  function terugboeken(ref, { reden, geldrijIds } = {}) {
    const rb = bureau();
    if (!rb) return { status: 503, error: 'Het reisbureau is niet beschikbaar.' };
    const a = rb.aanvraagVan(ref);
    if (!a) return { status: 404, error: 'Aanvraag niet gevonden.' };
    if (!a.betaald) return { status: 409, error: 'Deze reis is niet betaald; er valt niets terug te draaien.' };

    const uit = spiegelVoor({ rijen: rijenVan(a.ref), kiesIds: geldrijIds || null, reden,
      boekingId: a.betaald.boeking });
    if (!uit.ok) return { status: 409, error: 'Deze terugboeking kan niet.', hoe: uit.waarom };

    const stempel = klok();
    for (const x of uit.rijen) {
      const r = x.rij;
      eigen.bak('reisGeldrijen').push({
        id: nieuwId('RGH'), ref: a.ref, at: stempel, spiegelVan: x.spiegelVan,
        bedragCenten: r.bedragCenten, valuta: r.valuta,
        economischeHerkomst: r.economischeHerkomst,
        economischeEigenaar: r.economischeEigenaar, naarWie: r.naarWie,
        grond: r.grond, bronObject: r.bronObject, relatie: r.relatie,
        land: r.land, bewijs: r.bewijs
      });
    }
    const recht = {
      id: nieuwId('RTG'), ref: a.ref, at: stempel,
      centen: uit.terugCenten, valuta: 'EUR', volledig: uit.volledig,
      economischeHerkomst: 'rtg', aan: 'lid', grond: String(reden).slice(0, 200),
      /* bevroren op het moment van klaarzetten, zoals de bedragen */
      codenaam: betaaladres(a),
      uitgevoerd: false, besluit: null,
      hoe: 'teruggaveRECHT; een mens van het kantoor voert hem uit langs kern/pay (GELD.md)'
    };
    eigen.bak('reisTeruggaven').push(recht);
    save();
    return { ok: true, teruggedraaid: uit.rijen.length, centen: uit.terugCenten, volledig: uit.volledig, recht: recht.id };
  }

  const open = (r) => !r.uitgevoerd && !r.besluit;

  /* UITVOEREN. `door` en (vanaf de vier-ogengrens) `tweede` komen van de route,
     uit de sessie. De idem-sleutel is het id van het recht: een herhaling na een
     storing tussen boeking en markering boekt niet nog eens maar krijgt de eerste
     boeking terug (lib/idem.js), en markeert dan alsnog. */
  async function uitvoeren({ id, door, tweede }) {
    const r = teruggaveVan(id);
    if (!r) return { status: 404, error: 'Dit teruggaverecht bestaat niet.' };
    if (!open(r)) return { status: 409, error: 'Hierover is al besloten (' + (r.uitgevoerd ? 'uitgevoerd' : 'afgewezen') + ').' };
    if (!door) return { status: 403, error: 'Een teruggave voert een mens op naam uit; de sessie noemt niemand.' };
    if (!r.codenaam) return { status: 409, error: 'Bij deze betaling staat geen betaaladres; RTG kan niet vaststellen naar wie het geld terug moet. Handel dit buiten het systeem af en wijs het recht af met die reden.' };
    const p = pay();
    if (!p || typeof p.terugGave !== 'function') return { status: 503, error: 'De betaallaag is niet beschikbaar; er is niets geboekt.' };
    const b = await p.terugGave({ codenaam: r.codenaam, vanPartner: null, partnerCenten: 0,
      uitRtg: [{ rekening: KAS, centen: r.centen }],
      oms: 'Teruggave reis ' + r.ref, ref: r.ref, idem: r.id });
    if (!b || b.error) return { status: (b && b.status) || 502, error: (b && b.error) || 'De teruggave is niet geboekt.' };
    r.uitgevoerd = true;
    r.besluit = { stand: 'uitgevoerd', door: String(door).slice(0, 80), tweede: tweede ? String(tweede).slice(0, 80) : null,
      at: klok(), delen: b.delen || null, herhaald: !!b.herhaald };
    save();
    return { ok: true, recht: r };
  }

  function afwijzen({ id, door, reden }) {
    const r = teruggaveVan(id);
    if (!r) return { status: 404, error: 'Dit teruggaverecht bestaat niet.' };
    if (!open(r)) return { status: 409, error: 'Hierover is al besloten.' };
    if (!door) return { status: 403, error: 'Een afwijzing neemt een mens op naam; de sessie noemt niemand.' };
    if (String(reden || '').trim().length < 10) return { status: 400, error: 'Een afwijzing draagt een reden van ten minste tien tekens; die leest het lid.' };
    r.besluit = { stand: 'afgewezen', door: String(door).slice(0, 80), reden: String(reden).trim().slice(0, 400), at: klok() };
    save();
    return { ok: true, recht: r };
  }

  return {
    terugboeken, uitvoeren, afwijzen, teruggaveVan,
    teruggavenVan: (ref) => lijst().filter(r => r.ref === String(ref || '')),
    teruggavenOpen: () => lijst().filter(open).slice(-200)
  };
}

module.exports = { maakTeruggave };
