/* UITVOERENDE MEDIA (deelmodule): HET AANBOD -- wat een partituur kost, en hoe
   een aankoop een aanspraak wordt.

   Dit sluit de keten die UITVOEREND.md par. 4.1 beschrijft:

     aanbod -> aankoop -> aanspraak -> uitvoering

   Tot nu toe verleende alleen de MAKER een aanspraak, met de hand. Dat was de
   helft: het begrip klopte, maar er was geen gebeurtenis die er een liet
   ontstaan. Hier is die gebeurtenis, en het is een betaling.

   ER KOMT GEEN TWEEDE GELDSTROOM BIJ. De aankoop loopt over RTG Pay langs
   precies de rail die het Podium al gebruikt om een lid aan een maker te laten
   betalen (kern/podium/handel.js: `pay.stuur`). Dit bestand boekt niets zelf en
   telt geen saldi (LAT.md regel 4).

   TWEE STAPPEN, EN DAT IS MET OPZET GEEN EEN. Eerst de BON (wat betaal ik, aan
   wie, en wat krijg ik), dan de KOOP. Een knop die meteen afrekent is sneller en
   is precies wat GELD.md par. 3 verbiedt: alles wat een ander raakt is maximaal
   klaarzetten, en bevestigen doet de mens.

   DE HELE KETEN IS IDEMPOTENT, en dat is geen extraatje maar de reden dat dit
   bestand zo klein kan zijn. `pay.stuur` is idempotent op zijn `idem` en geeft
   bij een herhaling dezelfde BOEKING terug; die boeking is hier de `bron` van de
   aanspraak, en ./aanspraak.js verleent per (code, bron) maar een keer. Een
   dubbeltik of een netwerkherhaling levert dus dezelfde betaling en dezelfde
   aanspraak op -- niet twee van allebei, en ook niet een van het een en twee van
   het ander, wat de gevaarlijkste uitkomst zou zijn.

   WAT DIT NIET DOET, en dat hoort er hardop bij te staan: RTG maakt hier GEEN
   btw-stukken op. Dit is dezelfde rail en dus dezelfde grens als bij de
   verkoopzone van het Podium, waar dat als open punt staat (TAKEN.md 4.16). Wie
   van zijn werk een bedrijf maakt, hoort dat als zaak te doen -- en dan hoort de
   verkoop over de partnerrekening te lopen zoals in de App Store, met de btw in
   het land van de koper (kern/fiscaal/digitaal.js). Zolang dat er niet is, zegt
   de bon dat met zoveel woorden in plaats van een tarief te verzinnen. */
'use strict';

const MIN_CENTEN = 100;        // een euro; daaronder kost de boeking meer dan hij opbrengt
const MAX_CENTEN = 100000;     // duizend euro; daarboven hoort een echte verkoopweg

module.exports = ({ partituur, aanspraak, pay, codenaamVan, onboarding }) => {

  /* Wat een koper te zien krijgt VOORDAT hij iets betaalt. Geen 402 en geen
     fout als hij het al heeft: dat is geen probleem maar een antwoord. */
  function bon(sess, partituurId) {
    const p = partituur.met(partituurId);
    if (!p || !p.klaar) return { status: 404, error: 'Deze partituur bestaat niet.' };
    if (!(p.prijsCenten > 0)) return { status: 409, error: 'Voor deze partituur wordt geen geld gevraagd.' };
    if (p.key === sess.key) return { status: 400, error: 'Dit is uw eigen werk.' };
    const heeft = aanspraak.heeft(sess.key, p.aanspraakNodig);
    return {
      status: 200, ok: true, partituurId: p.id, naam: p.naam,
      maker: codenaamVan ? codenaamVan(p.key) : null,
      centen: p.prijsCenten, aanspraak: p.aanspraakNodig,
      alGekocht: heeft.ok,
      krijgt: 'Toegang tot dit werk, zolang uw aanspraak geldt. Wat u ziet is één uitvoering ' +
        'van de partituur -- de lengte hangt af van wat u vraagt en van wat de maker toestaat.',
      /* Wat RTG hier NIET doet. Een bon die alleen het mooie deel noemt, is een
         bon die de koper later verrast (LAT.md regel 6). */
      nietGebouwd: 'RTG maakt van deze aankoop geen btw-factuur op en verzorgt geen retourregeling. ' +
        'Het geld gaat rechtstreeks van u naar de maker, zoals bij het Podium; RTG is hier geen verkoper.',
      let: 'U betaalt ' + (p.prijsCenten / 100).toFixed(2) + ' euro aan de maker. Bevestigen doet u zelf.'
    };
  }

  /* Kopen. De volgorde is dwingend: eerst kijken of het al van u is (anders
     betaalt iemand twee keer voor hetzelfde), dan de paspoortpoort van RTG Pay,
     dan pas geld. */
  async function koop(sess, opdracht) {
    const o = opdracht || {};
    const r = bon(sess, o.partituurId);
    if (r.error) return r;
    if (r.alGekocht) return { status: 200, ok: true, al: true, aanspraak: aanspraak.heeft(sess.key, r.aanspraak).aanspraak,
      let: 'U had dit al; er is niets afgeschreven.' };

    /* DEZELFDE POORT ALS ELK ANDER GELD-MOMENT. RTG Pay vraagt van een echt
       account eenmalig het paspoort; deze aankoop is daar geen uitzondering op.
       Zou hij hier ontbreken, dan is dit de weg om die poort te omzeilen. */
    if (onboarding && typeof onboarding.payGate === 'function') {
      const g = onboarding.payGate(sess);
      if (!g.ok) return { status: g.status || 403, error: g.error, kyc: true };
    }
    const koper = codenaamVan ? codenaamVan(sess.key) : null;
    if (!koper || !r.maker) return { status: 409, error: 'De betaling kan niet worden aangeboden: een van beide codenamen ontbreekt.' };
    if (!(r.centen >= MIN_CENTEN && r.centen <= MAX_CENTEN))
      return { status: 409, error: 'De prijs van deze partituur valt buiten wat hier verkocht kan worden.' };

    const b = await pay.stuur({ van: koper, aanCodenaam: r.maker, centen: r.centen,
      oms: 'Uitvoerende media · ' + r.naam,
      idem: o.idem ? 'uitvoerkoop:' + o.idem : undefined, soort: 'uitvoering' });
    if (b.error) return { status: b.status || 400, error: b.error };

    /* DE BOEKING IS DE BRON, en dat is het scharnier van deze hele module. Bij
       een herhaald verzoek met dezelfde `idem` geeft pay.stuur DEZELFDE boeking
       terug; ./aanspraak.js verleent per (code, bron) maar een keer, dus er
       ontstaat geen tweede aanspraak. Zou hier een eigen id worden verzonnen,
       dan was de betaling wel idempotent en de aanspraak niet -- en dan betaalt
       iemand een keer en krijgt hij twee rechten, of erger, andersom. */
    const v = aanspraak.verleen(sess.key, { code: r.aanspraak, herkomst: 'aankoop', bron: String(b.boeking) });
    if (v.error) return v;
    return { status: 200, ok: true, aanspraak: v.aanspraak, boeking: b.boeking,
      herhaald: !!v.herhaald,
      let: 'Betaald aan ' + r.maker + '. Het werk staat nu voor u open.' };
  }

  return { bon, koop, MIN_CENTEN, MAX_CENTEN };
};
