/* Foundation OS, deel "bestuur": vergaderingen, quorum en besluiten.

   WAAROM DIT SOFTWARE MOET ZIJN EN GEEN WORD-BESTAND. Een stichting wordt niet
   afgerekend op wat ze deed maar op of ze het BEVOEGD deed. Bij een geschil,
   een subsidiecontrole of een accountantsverklaring is de vraag altijd
   dezelfde: was er quorum, wie zat erbij, wie had een belang, en staat het
   besluit in vastgestelde notulen. Een notulenbestand in een map beantwoordt
   geen van die vier -- en het kan achteraf worden bijgewerkt, wat precies de
   reden is dat niemand erop vertrouwt.

   DRIE GRENDELS:

   1. GEEN QUORUM, GEEN BESLUIT. Het aantal aanwezigen wordt geteld tegen het
      aantal zetels in dat orgaan; onder de helft is er vergaderd en niet
      besloten. Het antwoord zegt hoeveel er nodig waren, want "geweigerd" zonder
      getal leert de secretaris niets.

   2. WIE EEN BELANG HEEFT, STEMT NIET MEE. Een aanwezige die bij dit
      agendapunt als belanghebbend is aangemerkt, kan niet als voorstemmer
      worden geteld. Dat is geen formaliteit: een bestuurder die meebeslist over
      een opdracht aan zijn eigen bedrijf is het schoolvoorbeeld waar een
      ANBI-status op sneuvelt.

   3. VASTGESTELDE NOTULEN LIGGEN VAST. Notulen worden in een VOLGENDE
      vergadering vastgesteld -- niet in de eigen, want dan stelt de
      vergadering zichzelf vast. Daarna weigert elke wijziging. Een besluit dat
      je later nog kunt bijschaven is geen besluit maar een aantekening.

   WAT ER NIET IN ZIT: geen stemgeheim, geen digitale handtekening, geen
   automatische agenda-uitnodiging. Dat zijn dingen die je erbij kunt bouwen;
   ze dragen geen van drieen de vraag "mocht dit". */

const SOORTEN = ['landelijk', 'stad'];

module.exports = (ctx) => {
  const { nu, rid, schoon, S, audit, wie, poort, save } = ctx;

  const vind = id => S().vergaderingen.find(v => v.id === String(id || '')) || null;

  /* Het orgaan: wie hoort er te zitten. Landelijk is de boardroom -- die telt
     niet in zetels maar in mensen met toegang, en dat getal kent dit OS niet.
     Daarom draagt een landelijke vergadering zijn eigen ledental, ingevuld door
     de secretaris. Dat is eerlijker dan een verzonnen noemer: een quorum
     berekenen uit een getal dat je niet hebt, is de meter uit LAT.md regel 3. */
  function zetelsIn(v) {
    if (v.soort === 'stad') return S().zetels.filter(z => z.stad === v.stad).length;
    return Number(v.omvang) || 0;
  }
  function quorumVan(v) {
    const n = zetelsIn(v);
    return n > 0 ? Math.floor(n / 2) + 1 : 0;
  }

  const beeld = v => ({
    id: v.id, soort: v.soort, stad: v.stad || null, datum: v.datum, plaats: v.plaats,
    agenda: v.agenda || [], aanwezig: v.aanwezig || [], afwezig: v.afwezig || [],
    omvang: zetelsIn(v), quorum: quorumVan(v),
    // gerekend en niet opgeslagen: het aantal zetels verandert, de vergadering niet
    heeftQuorum: (v.aanwezig || []).length >= quorumVan(v) && quorumVan(v) > 0,
    besluiten: (v.besluiten || []).map(b => ({ id: b.id, onderwerp: b.onderwerp, tekst: b.tekst,
      voor: b.voor, tegen: b.tegen, onthouding: b.onthouding, belanghebbend: b.belanghebbend || [],
      aangenomen: b.aangenomen, at: b.at })),
    vastgesteld: v.vastgesteld || null, at: v.at });

  function mag(req, soort, stadId) {
    const w = wie(req);
    if (soort === 'landelijk') {
      return w.landelijk ? { ok: true, w } : { status: 403, error: 'Een landelijke bestuursvergadering legt het landelijke bestuur vast.' };
    }
    const g = poort(w, stadId, 'stad.beheren');
    return g.ok ? { ok: true, w } : g;
  }

  function maak(req, b) {
    b = b || {};
    const soort = SOORTEN.includes(b.soort) ? b.soort : 'stad';
    const g = mag(req, soort, b.stad);
    if (!g.ok) return g;
    const datum = schoon(b.datum, 10);
    if (!/^\d{4}-\d{2}-\d{2}$/.test(datum)) return { status: 400, error: 'Wanneer vergadert u? Een datum als 2026-09-14.' };
    const omvang = Math.max(0, Math.min(99, Math.round(Number(b.omvang) || 0)));
    if (soort === 'landelijk' && !omvang) {
      return { status: 400, error: 'Hoeveel bestuurders telt het landelijke bestuur? Zonder dat getal is er geen quorum te berekenen, ' +
        'en een quorum uit een verzonnen noemer is erger dan geen quorum.' };
    }
    const v = { id: rid(), soort, stad: soort === 'stad' ? String(b.stad) : null,
      datum, plaats: schoon(b.plaats, 80), omvang,
      agenda: (Array.isArray(b.agenda) ? b.agenda : []).map(x => schoon(x, 120)).filter(Boolean).slice(0, 30),
      aanwezig: [], afwezig: [], besluiten: [], vastgesteld: null, at: nu() };
    S().vergaderingen.push(v);
    audit(g.w.key, 'bestuur.vergadering', v.id, soort + ' ' + datum);
    save();
    return { ok: true, vergadering: beeld(v) };
  }

  function presentie(req, id, b) {
    b = b || {};
    const v = vind(id);
    if (!v) return { status: 404, error: 'Deze vergadering bestaat niet.' };
    if (v.vastgesteld) return { status: 400, error: 'De notulen van deze vergadering zijn vastgesteld; de presentielijst ligt daarmee vast.' };
    const g = mag(req, v.soort, v.stad);
    if (!g.ok) return g;
    const lijst = x => (Array.isArray(x) ? x : []).map(k => schoon(k, 60)).filter(Boolean).slice(0, 99);
    v.aanwezig = lijst(b.aanwezig);
    v.afwezig = lijst(b.afwezig);
    audit(g.w.key, 'bestuur.presentie', v.id, v.aanwezig.length + ' aanwezig');
    save();
    return { ok: true, vergadering: beeld(v) };
  }

  /* Een besluit nemen. Hier zitten grendel 1 en 2. */
  function besluit(req, id, b) {
    b = b || {};
    const v = vind(id);
    if (!v) return { status: 404, error: 'Deze vergadering bestaat niet.' };
    if (v.vastgesteld) return { status: 400, error: 'De notulen zijn vastgesteld. Een nieuw besluit hoort in een nieuwe vergadering.' };
    const g = mag(req, v.soort, v.stad);
    if (!g.ok) return g;

    const q = quorumVan(v);
    const aanwezig = (v.aanwezig || []).length;
    if (!q) {
      return { status: 400, error: 'Er is geen omvang van dit orgaan bekend, dus er valt geen quorum te berekenen. ' +
        'Leg eerst vast hoeveel bestuurders er zijn.' };
    }
    if (aanwezig < q) {
      return { status: 400, error: 'Er waren ' + aanwezig + ' van de ' + zetelsIn(v) + ' bestuurders aanwezig; er zijn er ' + q +
        ' nodig. Dit is een vergadering geweest, geen besluit.' };
    }
    const onderwerp = schoon(b.onderwerp, 120);
    if (!onderwerp) return { status: 400, error: 'Waar gaat het besluit over?' };

    const belang = (Array.isArray(b.belanghebbend) ? b.belanghebbend : []).map(k => schoon(k, 60)).filter(Boolean);
    const voor = (Array.isArray(b.voor) ? b.voor : []).map(k => schoon(k, 60)).filter(Boolean);
    const tegen = (Array.isArray(b.tegen) ? b.tegen : []).map(k => schoon(k, 60)).filter(Boolean);
    const onth = (Array.isArray(b.onthouding) ? b.onthouding : []).map(k => schoon(k, 60)).filter(Boolean);

    /* GRENDEL 2. Wie een belang heeft, stemt niet mee -- ook niet tegen. Het
       gaat er niet om welke kant hij op stemt maar dat hij aan de stemming
       deelnam; dat is wat een besluit aantastbaar maakt. */
    const meegestemd = [...voor, ...tegen].filter(k => belang.includes(k));
    if (meegestemd.length) {
      return { status: 400, error: meegestemd.join(', ') + ' is bij dit punt als belanghebbend aangemerkt en kan dus niet meestemmen. ' +
        'Zet zo iemand op onthouding, of laat het belang vervallen als het er niet is.' };
    }
    const buiten = [...voor, ...tegen, ...onth].filter(k => !(v.aanwezig || []).includes(k));
    if (buiten.length) {
      return { status: 400, error: buiten.join(', ') + ' stond niet op de presentielijst en kan dus niet hebben gestemd.' };
    }

    const rij = { id: rid(), onderwerp, tekst: schoon(b.tekst, 600),
      voor, tegen, onthouding: onth, belanghebbend: belang,
      aangenomen: voor.length > tegen.length, at: nu() };
    if (!Array.isArray(v.besluiten)) v.besluiten = [];
    v.besluiten.push(rij);
    audit(g.w.key, 'bestuur.besluit', v.id, onderwerp + ' -- ' + (rij.aangenomen ? 'aangenomen' : 'verworpen') +
      ' (' + voor.length + '/' + tegen.length + ')');
    save();
    return { ok: true, besluit: rij, vergadering: beeld(v) };
  }

  return { maak, presentie, besluit, vind, beeld, quorumVan, zetelsIn, mag, SOORTEN };
};
module.exports.SOORTEN = SOORTEN;
