/* RTG Theater, deelbestand "huisstijl": DE INTERNE WERELD ONDER DE EIGEN NAAM.

   Wat hier WEL gebeurt: de interne bibliotheek van een organisatie draagt haar
   eigen naam, payoff, accentkleur en thema, in plaats van die van RTG. Voor de
   medewerker die hem opent staat er "Bakkerij Imran · intern" en niet "RTG
   Theater".

   WAT HIER NIET GEBEURT, EN WAAROM NIET. Dit is geen eigen DOMEIN. Er is in dit
   huis geen externe hosting, geen certificaat-machinerie voor domeinen van
   derden en geen routering op hostnaam -- en dat is geen gat maar een keuze die
   ergens anders al is gemaakt: kern/webmaker.js zegt met zoveel woorden "geen
   echte domeinen, geen extern hosten: alles blijft in het ecosysteem". Een
   scherm dat "uw eigen domein" belooft terwijl geen enkele regel code een
   domein bedient, is precies de belofte-zonder-code waar LAT.md regel 6 over
   gaat. Staat als open punt in TAKEN.md, met wat ervoor nodig zou zijn.

   DE MERKREGELS VAN RTG BLIJVEN STAAN. De accentkleur van een organisatie geldt
   binnen HAAR EIGEN blok en verder nergens: de balk, de navigatie en de rest van
   de app blijven van RTG. Een tenant die de hele app kan omverven, kan een lid
   laten denken dat hij ergens anders is dan hij is.

   De vorm van de huisstijl is bewust dezelfde als die van de krantsite van een
   zaak (kern/journalistiek.js): naam, payoff, accent, thema. Twee keer hetzelfde
   idee met twee verschillende velden zou twee schermen opleveren die net anders
   werken.

   Krijgt de gedeelde ctx van kern/theater/index.js. */
'use strict';

/* WAT EEN GELDIG MERK IS, STAAT NIET MEER HIER. Dit bestand had zijn eigen
   kopie van "een accentkleur is een hexcode" en "een thema is licht of donker",
   en zo ook kern/webmerk.js en kern/journalistiek.js. Vier kopieen van dezelfde
   regel, en ze waren al uit elkaar gelopen: hier gaf een foute kleur een 400,
   daar werd hij STIL genegeerd -- dus dezelfde invoer gaf op de ene plek een
   melding en op de andere de stille indruk dat het gelukt was. Nu leest deze
   module de definitie (kern/tenant/merkkern.js) en bewaart hij zelf. */
const merkkern = require('../tenant/merkkern');

const STANDAARD_ACCENT = merkkern.STANDAARD_ACCENT;
const MAX_LOGO = merkkern.MAX_LOGO;

module.exports = (ctx) => {
  const { save, zakenVan } = ctx;

  const leidtBij = (key, code) => zakenVan(key).some(z => z.code === code && z.leiding);

  /* De huisstijl van EEN interne bibliotheek, altijd volledig ingevuld. Een half
     ingevulde stijl zou het scherm laten kiezen wat het invult, en dan staat de
     standaard op twee plekken. */
  function van(k, zaakNaam) {
    const h = (k && k.huisstijl) || {};
    return {
      naam: h.naam || zaakNaam || (k && k.naam) || 'Intern',
      payoff: h.payoff || '',
      accent: h.accent || STANDAARD_ACCENT,
      thema: h.thema === 'donker' ? 'donker' : 'licht',
      logo: h.logo || null,
      eigen: !!(h.naam || h.accent || h.logo || h.payoff),
      let: 'Deze huisstijl geldt binnen de interne wereld van deze organisatie. ' +
        'De rest van de app blijft van RTG, en een eigen domein bestaat hier niet.'
    };
  }

  function zet(key, opdracht) {
    const o = opdracht || {};
    const code = String(o.zaakCode || '');
    if (!leidtBij(key, code)) return { status: 403, error: 'Alleen de leiding van de zaak zet de huisstijl.' };
    const k = ctx.zaak.kanaalVanZaak(code);
    if (!k) return { status: 404, error: 'Deze zaak heeft nog geen interne bibliotheek.' };
    const zaak = zakenVan(key).find(z => z.code === code);
    const uit = merkkern.leesMerkvelden(o, k.huisstijl || {}, ctx.schoon);
    if (uit.error) return { status: uit.status || 400, error: uit.error };
    k.huisstijl = uit.merk;
    save();
    return { status: 200, ok: true, huisstijl: van(k, zaak && zaak.naam) };
  }

  /* Wat de MEDIA OS nodig heeft: per zaak van dit lid de naam en het merk, ook
     als er nog geen bibliotheek staat. Zo kan de zakenstand de naam van de
     organisatie dragen zonder zelf iets over huisstijlen te weten. */
  function merkVoor(key) {
    return zakenVan(key).map(z => {
      const k = ctx.zaak.kanaalVanZaak(z.code);
      return { code: z.code, naam: z.naam, leiding: z.leiding,
        bibliotheek: !!k, huisstijl: k ? van(k, z.naam) : null };
    });
  }

  return { huisstijlZet: zet, huisstijlVan: van, huisstijlMerkVoor: merkVoor, STANDAARD_ACCENT };
};
