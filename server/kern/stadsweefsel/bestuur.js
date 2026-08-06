/* RTG Stadsweefsel, deel "bestuur": wie mag wat besluiten, en hoe blijkt dat.

   Het weefsel kon tot nu toe alles UITREKENEN -- wat er kapot is, wat het kost,
   wat het opleverde -- en dat is precies het punt waarop zo'n systeem gevaarlijk
   wordt als er geen bestuur boven hangt. Een platform dat weet wat er moet
   gebeuren, gaat het vroeg of laat ook doen, en dan is de vraag wie dat heeft
   besloten. Deze laag beantwoordt die vraag vóóraf.

   VIER ORGANEN, en ze doen niet hetzelfde:
     raad        stelt vast wat groot is, en controleert
     college     bestuurt binnen wat de raad heeft vastgesteld
     wijkraad    adviseert over wat in de eigen wijk gebeurt (geen besluit)
     rekenkamer  onderzoekt achteraf, en besluit nooit iets
   Plus de ethische commissie, die over de rekenregels gaat (./ainiveau.js) en
   ook alleen adviseert.

   HET MANDAAT IS DE ENIGE PLEK DIE "MAG DIT" BEANTWOORDT, en hij hangt aan het
   BEDRAG en aan het RISICO, niet aan wie het toevallig vraagt. Onder de
   ambtelijke grens tekent een ambtenaar; daarboven het college; daarboven de
   raad. Werk aan veiligheidskritieke infrastructuur schuift altijd een trede
   op. Dat is geen bureaucratie maar het verschil tussen een uitgave en een
   besluit.

   EN HET WERKT ALLEEN ALS HET BIJT. Vandaar dat kern/stadsweefsel/begroting.js
   een project boven de ambtelijke grens WEIGERT zolang er geen aangenomen
   besluit van het juiste orgaan onder ligt. Een mandaat dat alleen in een
   document staat, is een mening.

   STEMMEN GAAT PER FRACTIE EN NIET PER PERSOON. In een demostad hoort geen
   ledenlijst: raadsleden zijn mensen, en dit systeem heeft geen enkele reden om
   te weten wie wat stemde. De zetels van een fractie zijn genoeg om een
   meerderheid uit te rekenen.

   Krijgt de gedeelde ctx van kern/stadsweefsel/index.js. */
const ORGAANSOORT = {
  raad: { label: 'Gemeenteraad', besluit: true, uitleg: 'stelt vast en controleert' },
  college: { label: 'College van B&W', besluit: true, uitleg: 'bestuurt binnen wat is vastgesteld' },
  wijkraad: { label: 'Wijkraad', besluit: false, uitleg: 'adviseert over de eigen wijk' },
  rekenkamer: { label: 'Rekenkamer', besluit: false, uitleg: 'onderzoekt achteraf, onafhankelijk' },
  ethiek: { label: 'Ethische commissie', besluit: false, uitleg: 'adviseert over de rekenregels van de stad' }
};

/* De mandaatgrenzen in euro. Ze staan hier als getal en niet als beleid in een
   la: wie ze wil verzetten, verzet ze zichtbaar en in het auditlog. */
const MANDAAT = [
  { rol: 'ambtenaar', tot: 25000, orgaan: null, uitleg: 'dagelijks beheer: een ambtenaar tekent' },
  { rol: 'college', tot: 500000, orgaan: 'college', uitleg: 'een collegebesluit is nodig' },
  { rol: 'raad', tot: Infinity, orgaan: 'raad', uitleg: 'de raad stelt dit vast' }
];

module.exports = (ctx) => {
  const { d, save, crypto, nu, geo } = ctx;

  const organen = () => { if (!Array.isArray(d().weefselOrganen)) d().weefselOrganen = []; return d().weefselOrganen; };
  const besluiten = () => { if (!Array.isArray(d().weefselBesluiten)) d().weefselBesluiten = []; return d().weefselBesluiten; };
  const orgaan = (id) => organen().find(o => o.id === String(id || '')) || null;
  const besluit = (id) => besluiten().find(b => b.id === String(id || '') || b.ref === String(id || '')) || null;

  /* De seed: de organen zoals een stad ze heeft. De wijkraden komen uit de
     GEOGRAFIE -- een wijkraad zonder wijk bestaat niet, en zo staat er nooit
     een raad voor een buurt die het weefsel niet kent. */
  function zorgOrganen() {
    if (organen().length) return;
    geo.zorgGeografie();
    const zet = (id, soort, naam, extra) => organen().push({ id, soort, naam, ...(extra || {}), at: nu() });
    zet('raad', 'raad', 'Gemeenteraad', { zetels: 27, fracties: [
      { naam: 'Stadsbelang', zetels: 8 }, { naam: 'Groen & Water', zetels: 6 },
      { naam: 'Ondernemend', zetels: 5 }, { naam: 'Sociaal', zetels: 5 }, { naam: 'Onafhankelijk', zetels: 3 }
    ] });
    zet('college', 'college', 'College van B&W', { portefeuilles: [
      { naam: 'Financien', domein: null }, { naam: 'Verkeer & mobiliteit', domein: 'verkeer' },
      { naam: 'Energie & klimaat', domein: 'energie' }, { naam: 'Water & riolering', domein: 'water' },
      { naam: 'Openbare ruimte', domein: 'licht' }
    ] });
    for (const w of geo.opNiveau('wijk')) zet('wijkraad-' + w.id, 'wijkraad', 'Wijkraad ' + w.naam, { gebied: w.id });
    zet('rekenkamer', 'rekenkamer', 'Rekenkamer', { onafhankelijk: true });
    zet('ethiek', 'ethiek', 'Ethische commissie', { onafhankelijk: true });
    save();
  }

  /* WIE MAG DIT VASTSTELLEN? Het antwoord hangt aan het bedrag en aan het
     risico, en het geeft altijd de REDEN mee -- een poort die alleen ja of nee
     zegt, is achteraf in een logregel niet meer na te vertellen. */
  function mandaat({ bedrag, kritiek }) {
    const b = Number(bedrag) > 0 ? Number(bedrag) : 0;
    let i = MANDAAT.findIndex(m => b <= m.tot);
    if (i < 0) i = MANDAAT.length - 1;
    // veiligheidskritieke infrastructuur schuift altijd een trede op
    if (kritiek && i < MANDAAT.length - 1) i++;
    const m = MANDAAT[i];
    return { rol: m.rol, orgaan: m.orgaan, bedrag: b, kritiek: !!kritiek,
      besluitNodig: !!m.orgaan,
      reden: m.uitleg + (kritiek ? ' (een trede hoger: veiligheidskritiek)' : '') +
        (m.orgaan ? '' : ' -- tot EUR ' + MANDAAT[0].tot.toLocaleString('nl-NL')) };
  }

  /* Dekt dit besluit die uitgave? Drie voorwaarden, en de derde wordt het
     vaakst vergeten: het besluit moet AANGENOMEN zijn, van het juiste orgaan,
     en het bedrag moet er ook echt onder passen. Een raadsbesluit voor twee
     ton dekt geen project van vier ton. */
  function dekt(besluitId, eis) {
    const bs = besluit(besluitId);
    if (!bs) return { ok: false, reden: 'Er is geen besluit met dat kenmerk.' };
    if (bs.status !== 'aangenomen') return { ok: false, reden: 'Besluit ' + bs.ref + ' is ' + bs.status + ', niet aangenomen.' };
    if (eis.orgaan && bs.orgaan !== eis.orgaan)
      return { ok: false, reden: 'Dit vraagt een besluit van ' + (ORGAANSOORT[eis.orgaan] || {}).label + '; ' + bs.ref + ' komt van ' + bs.orgaan + '.' };
    if (bs.bedrag && eis.bedrag > bs.bedrag)
      return { ok: false, reden: 'Besluit ' + bs.ref + ' dekt EUR ' + bs.bedrag + '; hier gaat het om EUR ' + eis.bedrag + '.' };
    return { ok: true, besluit: bs.ref };
  }

  /* De weg van voorstel naar besluit (indienen, adviseren, stemmen, sluiten)
     staat in ./besluitvorming.js; hier wonen de organen en het mandaat. */
  // publiek en mandaat zijn functiedeclaraties (gehesen), dus ze mogen hier al mee
  const H = { besluiten, besluit, orgaan, ORGAANSOORT, zorgOrganen, publiek };
  const { voorstel, advies, stem, sluit } = require('./besluitvorming')(ctx, H);

  function publiek(b) {
    return { ...b, mandaatUitleg: b.bedrag ? mandaat({ bedrag: b.bedrag }).reden : null };
  }

  function lijst(f) {
    zorgOrganen();
    f = f || {};
    let rij = besluiten();
    if (f.orgaan) rij = rij.filter(b => b.orgaan === String(f.orgaan));
    if (f.status) rij = rij.filter(b => b.status === String(f.status));
    if (f.projectId) rij = rij.filter(b => b.projectId === String(f.projectId));
    return rij;
  }

  return {
    ORGAANSOORT, MANDAAT, zorgOrganen, orgaan, organen, besluit, besluiten, mandaat, dekt, lijst, publiek,
    api: {
      weefselOrganen: () => { zorgOrganen(); return { status: 200, soorten: ORGAANSOORT, mandaat: MANDAAT.map(m => ({ ...m, tot: m.tot === Infinity ? null : m.tot })), organen: organen() }; },
      weefselMandaat: ({ bedrag, kritiek }) => ({ status: 200, ...mandaat({ bedrag, kritiek }) }),
      weefselBesluiten: (f) => { const rij = lijst(f); return { status: 200, aantal: rij.length, besluiten: rij.slice(0, 200).map(publiek) }; },
      weefselBesluit: ({ id }) => { const b = besluit(id); return b ? { status: 200, besluit: publiek(b) } : { status: 404, error: 'Onbekend besluit.' }; },
      weefselVoorstel: voorstel,
      weefselAdvies: advies,
      weefselStem: stem,
      weefselBesluitSluit: sluit
    }
  };
};
