/* DE TOEGANG: wie kan wat, over de twee werelden die er al zijn.

   ER KOMT GEEN DERDE RECHTENMODEL BIJ. Toegang tot een onderneming is in dit
   huis op twee plekken geregeld, en die twee zijn met opzet verschillend:

     de ZAAK      -> supplier_staff (SQLite), en daar bestaan precies twee
                     rollen: manager en staff. Dat is genoeg voor een vloer waar
                     iemand kassa draait of een bestelling aanneemt; een
                     kassamedewerker heeft geen achttien rechten nodig.
     de WERKRUIMTE -> server/bedrijf/rollen.js: achttien rechten en veertien
                     rollen, rollen met een einddatum, vier soorten inzage die
                     een REDEN vragen, en een journaal. Dat is de kant waar
                     personeelsdossiers, klantprijzen en besluiten wonen.

   Een derde model hierboven zou een derde waarheid zijn over dezelfde vraag, en
   de eerste keer dat ze uiteenlopen weet niemand welke geldt (lat-regel 4).
   Deze laag LEEST ze allebei en legt ze naast elkaar, zodat een ondernemer één
   plek heeft waar hij ziet wie er bij zijn bedrijf kan -- en waar het gat zit.

   HET GAT WORDT BENOEMD EN NIET GEDICHT. De zaak-kant kent geen fijnmazige
   rechten en geen tijdelijke toegang; wie daar iets aan wil doen, doet dat in
   de zaak-laag zelf en niet hier. Deze module zegt dus in het antwoord dat een
   manager op de zaak alles kan wat de zaak kan -- want dat is waar, en een
   scherm dat doet alsof er nuance is, geeft een schijnzekerheid die nergens op
   rust.

   ER WORDT NIETS GEZET. Geen enkele functie hier verleent of ontneemt toegang.
   Wie iemand een rol wil geven, doet dat waar die rol woont: in de zaak-app of
   in RTG Werk OS, allebei achter hun eigen poort met hun eigen journaal. Een
   tweede deur naar hetzelfde slot is een deur die niemand bewaakt.

   ALLES OP CODENAAM, en waar dat niet kan staat de reden erbij: supplier_staff
   draagt een naam omdat een dienstrooster nu eenmaal een naam nodig heeft --
   maar die naam wordt hier niet opgehaald. Wat hier staat is een aantal, een
   rol en een venster. */
'use strict';

const ROLLEN = require('../../bedrijf/rollen');

/* De rechten die alleen open gaan met een opgegeven reden. Gelezen uit de
   werkruimte-laag en niet overgetypt: zet daar iemand er een bij, dan staat hij
   hier vanzelf ook. */
const REDEN_NODIG = ROLLEN.REDEN_NODIG || [];

module.exports = ({ db, staffLijst }) => {

  const zaakVan = (o) => (o && o.supplierCode
    ? (db.data.suppliers || []).find(x => x.code === o.supplierCode) || null : null);

  /* De werkruimte van deze onderneming, als er een is. Dezelfde sleutel als
     ./contracten.js gebruikt: de zaakcode. */
  const ruimteVan = (o) => (o && o.supplierCode
    ? ((db.data.werkruimtes || {})[o.supplierCode] || null) : null);

  /* ---- de zaak-kant ----
     Twee rollen, en dat is de waarheid. Geen namen: een aantal per rol en de
     koppeling aan een RTG-account volstaat voor de vraag "wie kan erbij". */
  function zaakTeam(s) {
    const rijen = (staffLijst ? staffLijst(s.code) : []) || [];
    const actief = rijen.filter(x => x && x.active !== 0 && x.active !== false);
    const managers = actief.filter(x => x.role === 'manager');
    return {
      soort: 'zaak', code: s.code,
      totaal: actief.length,
      managers: managers.length,
      medewerkers: actief.length - managers.length,
      gekoppeld: actief.filter(x => x.member_id || x.lid).length,
      rollen: [
        { id: 'manager', label: 'Beheerder', aantal: managers.length,
          wat: 'Kan alles wat de zaak kan: prijzen, personeel, instellingen en uitbetalingen.' },
        { id: 'staff', label: 'Medewerker', aantal: actief.length - managers.length,
          wat: 'Werkt op de vloer: agenda, kassa en bestellingen, binnen het eigen werkvenster.' }
      ],
      let: 'Op de zaak bestaan precies deze twee rollen. Er is geen fijnmazig recht en geen tijdelijke toegang; een beheerder kan dus alles. Wilt u dat scheiden, dan hoort dat werk in RTG Werk OS.'
    };
  }

  /* ---- de werkruimte-kant ----
     Hier zit het fijnmazige model. Wij tellen en klokken; verlenen gebeurt
     daar. Een rol met een verlopen venster telt niet mee -- dat is precies het
     punt van een tijdelijke rol. */
  function werkruimte(w, vandaag) {
    const leden = Object.values(w.leden || {}).filter(l => l && l.actief !== false);
    const perRol = {};
    let verlopen = 0, tijdelijk = 0, nogNiet = 0;
    for (const l of leden) {
      for (const r of (l.rollen || [])) {
        const id = typeof r === 'string' ? r : r.id;
        const van = typeof r === 'object' ? r.van : null;
        const tot = typeof r === 'object' ? r.tot : null;
        /* Precies hetzelfde venster als bedrijf/rollen.js zelf hanteert: van/tot
           inclusief. Zou dit iets soepeler of strenger zijn, dan zegt dit scherm
           iets anders dan de poort die de toegang echt bewaakt. */
        if (tot && String(tot) < vandaag) { verlopen += 1; continue; }
        if (van && String(van) > vandaag) { nogNiet += 1; continue; }
        if (tot) tijdelijk += 1;
        perRol[id] = (perRol[id] || 0) + 1;
      }
    }
    const bekend = (ROLLEN.ROLLEN || []);
    return {
      soort: 'werkruimte', code: w.code || null,
      leden: leden.length,
      rollen: Object.entries(perRol).map(([id, aantal]) => {
        const r = bekend.find(x => x.id === id);
        return { id, aantal, label: r ? r.naam : id,
          rechten: r ? r.rechten.length : null,
          alleenLezen: !!(r && r.alleenLezen) };
      }).sort((a, b) => b.aantal - a.aantal),
      tijdelijk, nogNiet,
      /* Verlopen rollen tellen niet mee en worden apart genoemd: een tijdelijk
         recht dat je zelf moet intrekken, is een permanent recht -- dat het hier
         vanzelf vervalt, hoort zichtbaar te zijn. */
      verlopen,
      redenNodig: REDEN_NODIG,
      let: 'Vier soorten inzage gaan alleen open met een opgegeven reden, en die reden komt in het journaal. Een rol met een einddatum vervalt vanzelf.'
    };
  }

  /* ---- het beeld ---- */
  function toegang(o, nuMs) {
    const s = zaakVan(o);
    if (!s) {
      return { stand: 'geen-zaak',
        uitleg: 'Zolang er geen zaak is gekoppeld, kan er ook niemand bij: er is nog niets om toegang tot te hebben.' };
    }
    const vandaag = new Date(Number.isFinite(nuMs) ? nuMs : Date.now()).toISOString().slice(0, 10);
    const w = ruimteVan(o);

    const delen = [zaakTeam(s)];
    if (w) delen.push(werkruimte(w, vandaag));

    return {
      stand: 'bestaat', zaak: s.code,
      delen,
      werkruimte: !!w,
      /* Zonder werkruimte is er geen fijnmazig model, en dat is een KEUZE die de
         ondernemer nog kan maken -- geen tekortkoming van dit scherm. */
      werkruimteUitleg: w ? null
        : 'U heeft geen werkruimte in RTG Werk OS. Daar wonen de fijnmazige rechten, de tijdelijke rollen en het journaal; zonder werkruimte kan een beheerder op de zaak alles.',
      geenTweedeDeur: 'Toegang verlenen of intrekken gebeurt waar de rol woont: in de zaak-app of in RTG Werk OS, allebei met hun eigen journaal. Dit scherm leest alleen.',
      nietGemeten: 'Hier staan geen namen. Wie iemand is, staat in de identiteitskluis; wat hier telt is hoeveel mensen er zijn, met welke rol en voor hoe lang.'
    };
  }

  return { TOEGANG_REDEN_NODIG: REDEN_NODIG, toegang };
};

/* De opvolging. Twee regels, en allebei gaan ze over hetzelfde: toegang die
   ruimer is dan iemand doorheeft. */
function toegangOpvolging(t) {
  if (!t || t.stand !== 'bestaat') return [];
  const uit = [];
  const zaak = t.delen.find(d => d.soort === 'zaak');

  /* Meer dan een handvol beheerders. Geen scherpe grens met een percentage: bij
     drie mensen zegt "de helft is beheerder" niets. */
  if (zaak && zaak.managers >= 3) {
    uit.push({ id: 'veel-beheerders', aantal: zaak.managers,
      kop: zaak.managers + ' mensen kunnen alles op uw zaak',
      waarom: 'Een beheerder kan prijzen wijzigen, personeel toevoegen en uitbetalingen doen. Op de zaak bestaat geen tussenrol; wie dat wil scheiden, doet dat in RTG Werk OS.' });
  }

  const w = t.delen.find(d => d.soort === 'werkruimte');
  if (w && w.verlopen > 0) {
    uit.push({ id: 'verlopen-rollen', aantal: w.verlopen,
      kop: w.verlopen + ' tijdelijke rol' + (w.verlopen === 1 ? ' is' : 'len zijn') + ' verlopen',
      waarom: 'Ze geven geen toegang meer -- dat gaat vanzelf. Dit is een seintje dat er iemand was die tijdelijk meekeek, niet dat er iets openstaat.' });
  }
  return uit;
}

module.exports.toegangOpvolging = toegangOpvolging;
module.exports.REDEN_NODIG = REDEN_NODIG;
