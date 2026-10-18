/* DE KYC-WACHTRIJ: echte namen en e-mailadressen uit de identiteitskluis.

   Stond tot 18 oktober 2026 in ./index.js. Afgesplitst toen het spoor ervan
   kon gaan WEIGEREN en index.js daarmee over de 10 kB van keuringsregel 13
   ging; dit is ook een echte grens -- een kluisdeur met een eigen belofte,
   tussen bedrading die er niets van weet. */
'use strict';

module.exports = ({ accounts, inzagelog }) => {
  /* Backoffice: identiteitsverificaties beoordelen.

     Dit is de grootste inzage die er bestaat: de backoffice ziet hier de echte
     naam EN het e-mailadres van iedereen in de wachtrij. Precies daarom gaat
     het door het inzagejournaal (server/inzagelog.js) -- één regel per keer dat
     het scherm wordt geopend, met de id's die erin stonden. Anders is dit een
     kluisdeur die openstaat zonder dat er ooit iets van te merken is.

     wie = de backoffice-medewerker of eigenaar die het scherm opende; de route
     geeft die mee. Wordt hij niet meegegeven, dan staat er 'backoffice' -- dat
     is minder waard, maar nog altijd oneindig veel meer dan niets. */
  /* EN HET SPOOR KAN WEIGEREN (18 oktober 2026, LAT.md regel 21). Hier stond
     noteerVeel() in een lege catch: faalde het journaal, dan kwamen de namen
     en e-mailadressen gewoon mee (STILSPOOR.json). Nu duurzaam, en zonder
     vaststaande regel geen namen: { status, error } in plaats van de rij --
     de route (routes/office/verificaties.js) maakt daar een 503 van. */
  async function pendingVerifications(wie) {
    const rij = accounts.listByVerification('pending');
    const spoor = await inzagelog.noteerVeelVast({
      door: wie && wie.id != null ? { id: wie.id, naam: wie.naam } : { naam: 'backoffice' },
      overIds: rij.map(u => u.id),
      waarom: 'KYC: identiteitsverificaties beoordelen',
      bron: 'backoffice/verificaties'
    });
    if (!spoor || !spoor.ok) return { status: (spoor && spoor.status) || 503, error: (spoor && spoor.error) || 'niet vastgelegd' };
    // De backoffice mag voor de KYC-controle de echte naam/e-mail uit de kluis zien.
    /* De OPGEGEVEN geboortedatum gaat mee, zodat de keurder hem naast het
       document kan leggen. Hij is namelijk zelf ingetypt bij de aanmelding en
       tot nu toe werd hij bij de goedkeuring nooit tegen het paspoort
       gehouden -- zie routes/office/verificaties.js. */
    return rij.map(u => {
      let md = {};
      try { md = accounts.getMemberState(u.id) || {}; } catch (e) { md = {}; }
      return { id: u.id, name: accounts.realNameOf(u), email: accounts.emailOf(u), codename: u.codename,
        tier: u.tier, doc: u.id_doc, at: u.created_at,
        geborenOpgegeven: md.geboren || null, geborenBron: md.geborenBron || 'opgegeven' };
    });
  }

  return { pendingVerifications };
};
