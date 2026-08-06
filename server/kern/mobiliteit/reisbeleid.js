/* Mobility OS (deelmodule): het zakelijke reisbeleid.

   DIT IS WAT DE ZAKELIJKE LAAG EEN PRODUCT MAAKT IN PLAATS VAN EEN KNOP. Een
   knop "zakelijke rit" is een vinkje op een factuur. Een reisbeleid is wat een
   werkgever echt wil: een maximum per rit, een budget per medewerker, tijden
   en gebieden waarbinnen het mag, een verplichte kostenplaats, en een grens
   waarboven een mens ernaar kijkt.

   EN HET BEGINT MET WIE ER MAG BOEKEN. Voordat er een regel wordt getoetst,
   staat hier de vraag of deze reiziger uberhaupt bij dit bedrijf werkt. Die
   controle stond eerst alleen bij de bedrijfspendel, en de ritten-ingang nam
   de organisatiecode gewoon aan uit het verzoek -- waarmee elk lid dat de code
   van een bedrijf kende op diens rekening kon rijden. Zo'n controle hoort niet
   per ingang herhaald te worden maar op EEN plek te staan, en dat is hier.

   ELKE AFWIJZING NOEMT DE REGEL EN HET GETAL. "Niet toegestaan" laat een
   medewerker raden of het aan het bedrag, het tijdstip of de kostenplaats lag,
   en dan belt hij zijn manager -- precies wat een beleid moet voorkomen.

   WAT HET BELEID NIET DOET: iemand tegenhouden die prive wil reizen. Het geldt
   alleen als de ORGANISATIE betaalt. Wie buiten de regels valt, krijgt te horen
   dat hij het zelf kan boeken; dat is geen omweg om het beleid heen maar het
   verschil tussen een werkgever en een voogd. */

const DAGNAMEN = ['zo', 'ma', 'di', 'wo', 'do', 'vr', 'za'];

module.exports = (ctx) => {
  const { db, save, schoon, nu, accounts, findSupplier } = ctx;

  function ensureBeleid() {
    if (!db.data.mobBeleid || typeof db.data.mobBeleid !== 'object') db.data.mobBeleid = {};
  }

  /* Werkt dit lid bij dit bedrijf? Op het moment zelf nagevraagd bij de
     personeelsadministratie, nooit uit iets wat de app meestuurt. */
  function werktBij(key, code) {
    const org = schoon(code, 20).toUpperCase();
    if (!org) return null;
    const lidId = Number(String(key || '').replace('user-', ''));
    if (!Number.isFinite(lidId)) return null;
    let posities = [];
    try { posities = accounts.staffPositions(lidId) || []; } catch (e) { return null; }
    return posities.find(p => String(p.supplier_code).toUpperCase() === org) || null;
  }

  const beleidVan = org => {
    ensureBeleid();
    return db.data.mobBeleid[schoon(org, 20).toUpperCase()] || null;
  };

  const tijd = t => (/^([01]\d|2[0-3]):[0-5]\d$/.test(String(t || '')) ? String(t) : null);
  const minuten = t => Number(t.slice(0, 2)) * 60 + Number(t.slice(3, 5));

  /* Het beleid vastleggen. Alleen de manager van het bedrijf (de route bewaakt
     dat): een medewerker die zijn eigen maximum kan zetten, heeft geen maximum. */
  function beleidZet(org, body = {}, door) {
    ensureBeleid();
    const code = schoon(org, 20).toUpperCase();
    if (!findSupplier(code)) return { status: 404, error: 'Onbekende organisatie.' };

    const b = db.data.mobBeleid[code] || (db.data.mobBeleid[code] = { org: code, gemaakt: nu() });
    const getal = (v, max) => {
      if (v == null) return undefined;
      const n = Math.round(Number(v));
      return Number.isFinite(n) && n >= 0 && n <= max ? n : null;
    };

    for (const [veld, max] of [['maxPrijs', 10000000], ['goedkeuringVanaf', 10000000], ['budgetPerMaand', 100000000]]) {
      const n = getal(body[veld], max);
      if (n === null) return { status: 400, error: 'De waarde van ' + veld + ' moet een bedrag in centen zijn.' };
      if (n !== undefined) b[veld] = n;
    }
    if (Array.isArray(body.dagen)) {
      const d = body.dagen.map(x => Math.round(Number(x))).filter(x => x >= 0 && x <= 6);
      b.dagen = [...new Set(d)].sort();
    }
    if (body.van != null || body.tot != null) {
      const v = tijd(body.van), t = tijd(body.tot);
      if ((body.van != null && !v) || (body.tot != null && !t))
        return { status: 400, error: 'Geef de tijden als uu:mm.' };
      if (v && t && minuten(t) <= minuten(v)) return { status: 400, error: 'Het venster eindigt niet na zijn begin.' };
      if (v) b.van = v;
      if (t) b.tot = t;
    }
    if (Array.isArray(body.steden)) b.steden = body.steden.slice(0, 30).map(x => schoon(x, 40)).filter(Boolean);
    if (Array.isArray(body.kostenplaatsen)) b.kostenplaatsen = body.kostenplaatsen.slice(0, 60).map(x => schoon(x, 40)).filter(Boolean);
    if (body.kostenplaatsVerplicht != null) b.kostenplaatsVerplicht = !!body.kostenplaatsVerplicht;
    if (Array.isArray(body.ritsoorten)) b.ritsoorten = body.ritsoorten.slice(0, 20).map(x => schoon(x, 20)).filter(Boolean);
    b.gewijzigd = nu();
    b.door = schoon(door, 60) || 'werkgever';
    save();
    return { ok: true, beleid: beleidBeeld(b) };
  }

  const beleidBeeld = b => ({ org: b.org,
    maxPrijs: b.maxPrijs || 0, goedkeuringVanaf: b.goedkeuringVanaf || 0,
    budgetPerMaand: b.budgetPerMaand || 0,
    dagen: b.dagen || null, dagnamen: (b.dagen || []).map(d => DAGNAMEN[d]),
    van: b.van || null, tot: b.tot || null,
    steden: b.steden || [], kostenplaatsen: b.kostenplaatsen || [],
    kostenplaatsVerplicht: !!b.kostenplaatsVerplicht, ritsoorten: b.ritsoorten || [],
    gewijzigd: b.gewijzigd || null, door: b.door || null,
    uitleg: 'Een leeg veld betekent geen grens. Het beleid geldt alleen als de organisatie betaalt.' });

  const beleidLees = org => {
    const b = beleidVan(org);
    return { ok: true, beleid: b ? beleidBeeld(b) : null,
      reden: b ? null : 'Er is nog geen reisbeleid; dan gelden er geen grenzen behalve die van de vervoerder.' };
  };

  // wat deze medewerker deze maand al op rekening van het bedrijf zette
  function besteedDezeMaand(org, key) {
    const maand = nu().slice(0, 7);
    return (db.data.mobOpdrachten || [])
      .filter(o => o.organisatie === org && o.reiziger === key &&
        String(o.gemaakt).slice(0, 7) === maand &&
        o.status !== 'geannuleerd' &&
        !(o.goedkeuring && o.goedkeuring.status === 'geweigerd'))
      .reduce((n, o) => n + (o.prijs || 0), 0);
  }

  /* De toets. `voorstel` is wat er geboekt gaat worden: prijs, ritsoort, stad,
     kostenplaats. Geeft terug of het mag, of er een mens naar moet kijken, en
     bij een nee ALTIJD de regel en het getal. */
  function beleidToets(org, key, voorstel = {}) {
    const code = schoon(org, 20).toUpperCase();
    if (!werktBij(key, code))
      return { mag: false, goedkeuringNodig: false,
        redenen: ['U staat niet als medewerker bij dit bedrijf ingeschreven.'] };

    const b = beleidVan(code);
    const eur = c => '€ ' + (c / 100).toFixed(2).replace('.', ',');
    if (!b) return { mag: true, goedkeuringNodig: false, redenen: [], beleid: null,
      uitleg: 'Er is geen reisbeleid ingesteld.' };

    const redenen = [];
    const prijs = Math.max(0, Math.round(Number(voorstel.prijs) || 0));

    if (b.maxPrijs && prijs > b.maxPrijs)
      redenen.push('Deze rit kost ' + eur(prijs) + '; het maximum per rit is ' + eur(b.maxPrijs) + '.');

    const besteed = besteedDezeMaand(code, key);
    if (b.budgetPerMaand && besteed + prijs > b.budgetPerMaand)
      redenen.push('Deze rit brengt u deze maand op ' + eur(besteed + prijs) +
        '; uw budget is ' + eur(b.budgetPerMaand) + ' (nu besteed: ' + eur(besteed) + ').');

    const wanneer = voorstel.wanneer ? new Date(voorstel.wanneer) : new Date();
    if (!isNaN(wanneer)) {
      if (b.dagen && b.dagen.length && !b.dagen.includes(wanneer.getDay()))
        redenen.push('Zakelijk reizen mag op ' + b.dagen.map(d => DAGNAMEN[d]).join(', ') +
          '; dit is een ' + DAGNAMEN[wanneer.getDay()] + '.');
      if (b.van && b.tot) {
        const m = wanneer.getHours() * 60 + wanneer.getMinutes();
        if (m < minuten(b.van) || m > minuten(b.tot))
          redenen.push('Zakelijk reizen mag tussen ' + b.van + ' en ' + b.tot + '; het is nu ' +
            String(wanneer.getHours()).padStart(2, '0') + ':' + String(wanneer.getMinutes()).padStart(2, '0') + '.');
      }
    }

    const stad = schoon(voorstel.stad, 40);
    if ((b.steden || []).length && stad && !b.steden.includes(stad))
      redenen.push('Zakelijk reizen is toegestaan in ' + b.steden.join(', ') + '; deze rit is in ' + stad + '.');

    const kp = schoon(voorstel.kostenplaats, 40);
    if (b.kostenplaatsVerplicht && !kp)
      redenen.push('Er is een kostenplaats verplicht bij een zakelijke rit.');
    if (kp && (b.kostenplaatsen || []).length && !b.kostenplaatsen.includes(kp))
      redenen.push('Kostenplaats "' + kp + '" bestaat niet; kies uit ' + b.kostenplaatsen.join(', ') + '.');

    if ((b.ritsoorten || []).length && voorstel.ritsoort && !b.ritsoorten.includes(voorstel.ritsoort))
      redenen.push('Zakelijk mag alleen ' + b.ritsoorten.join(', ') + '; dit is een rit van soort ' + voorstel.ritsoort + '.');

    /* De goedkeuringsdrempel is GEEN afwijzing. Boven het bedrag mag de rit
       best, maar er kijkt eerst een mens naar. Die twee door elkaar halen is
       precies waarom mensen om een beleid heen gaan werken. */
    const goedkeuringNodig = !redenen.length && !!b.goedkeuringVanaf && prijs >= b.goedkeuringVanaf;

    return { mag: !redenen.length, goedkeuringNodig, redenen,
      besteed, budget: b.budgetPerMaand || 0, beleid: beleidBeeld(b),
      uitleg: redenen.length
        ? 'Deze rit past niet in het reisbeleid. U kunt hem wel op eigen rekening boeken.'
        : (goedkeuringNodig
          ? 'Deze rit kost ' + eur(prijs) + ' en gaat eerst langs een leidinggevende (drempel ' + eur(b.goedkeuringVanaf) + ').'
          : 'Past binnen het reisbeleid.') };
  }

  return { ensureBeleid, werktBij, beleidZet, beleidLees, beleidToets, beleidVan, besteedDezeMaand, beleidBeeld };
};
