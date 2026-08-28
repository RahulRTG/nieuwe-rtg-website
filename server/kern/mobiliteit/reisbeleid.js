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
  const { db, save, schoon, nu, accounts, findSupplier, opslag } = ctx;

  function ensureBeleid() {
    opslag.bak('mobBeleid');
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
    return opslag.bak('mobBeleid')[schoon(org, 20).toUpperCase()] || null;
  };

  const tijd = t => (/^([01]\d|2[0-3]):[0-5]\d$/.test(String(t || '')) ? String(t) : null);
  const minuten = t => Number(t.slice(0, 2)) * 60 + Number(t.slice(3, 5));

  /* Het beleid vastleggen. Alleen de manager van het bedrijf (de route bewaakt
     dat): een medewerker die zijn eigen maximum kan zetten, heeft geen maximum. */
  function beleidZet(org, body = {}, door) {
    ensureBeleid();
    const code = schoon(org, 20).toUpperCase();
    if (!findSupplier(code)) return { status: 404, error: 'Onbekende organisatie.' };

    const b = opslag.bak('mobBeleid')[code] || (opslag.bak('mobBeleid')[code] = { org: code, gemaakt: nu() });
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
    /* Een veld dat NIET meekomt betekent "laat staan"; een veld dat WEL
       meekomt maar leeg is betekent "haal weg". Dat onderscheid ontbrak, en
       daardoor kon een eenmaal gezet venster nooit meer weg: het scherm stuurt
       bij een leeggemaakt veld `van: null`, en daarop sloeg dit blok zichzelf
       over. Een werkgever die zijn venster introk, hield het -- en zijn mensen
       kregen 's avonds "Zakelijk reizen mag tussen 08:00 en 18:00" te zien
       terwijl het scherm zei dat er geen venster stond. */
    const noemt = (k) => Object.prototype.hasOwnProperty.call(body, k);
    const leeg = (k) => noemt(k) && (body[k] === null || body[k] === '');
    if (noemt('van') || noemt('tot')) {
      const v = leeg('van') ? null : tijd(body.van);
      const t = leeg('tot') ? null : tijd(body.tot);
      if ((noemt('van') && !leeg('van') && !v) || (noemt('tot') && !leeg('tot') && !t))
        return { status: 400, error: 'Geef de tijden als uu:mm.' };
      // de grens telt alleen als er straks ECHT twee tijden staan
      const wordtVan = leeg('van') ? null : (v || b.van || null);
      const wordtTot = leeg('tot') ? null : (t || b.tot || null);
      if (wordtVan && wordtTot && minuten(wordtTot) <= minuten(wordtVan))
        return { status: 400, error: 'Het venster eindigt niet na zijn begin.' };
      if (leeg('van')) delete b.van; else if (v) b.van = v;
      if (leeg('tot')) delete b.tot; else if (t) b.tot = t;
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

  return { ensureBeleid, werktBij, beleidZet, beleidLees, beleidVan, beleidBeeld };
};
