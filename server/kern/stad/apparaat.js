/* RTG Stad, deel "apparaat": de Stadsdoos als PRODUCT.

   Er stond al een poort waar een kastje met een eigen sleutel metingen mag
   insturen. Dat is genoeg om te demonstreren en te weinig om uit te rollen.
   Een apparaat dat jaren buiten hangt, heeft een levensloop: het wordt
   gemaakt, getest, geregistreerd, geïnstalleerd, gekalibreerd, het krijgt
   updates, zijn sleutel moet een keer vernieuwd kunnen worden, hij valt uit,
   hij wordt vervangen, en aan het eind moet er iets van hem gewist worden.

   Vijf dingen die hier bij komen, en elk lost een gat op dat je pas ziet als
   er echt hardware hangt:

   1. DE LEVENSCYCLUS met een productpaspoort. Vaste overgangen, geen sprongen:
      een doos kan niet van "geproduceerd" naar "actief" zonder installatie en
      kalibratie. Wat er niet mag, gebeurt niet -- en het antwoord zegt waarom.
   2. SLEUTELROTATIE MET OVERLAP. De nieuwe sleutel wordt EEN keer getoond, de
      oude blijft nog even geldig. Zonder die overlap breek je elk apparaat dat
      op dat moment net offline is, en dat zijn er in het veld altijd een paar.
   3. ONDERTEKENDE UPDATES. Het manifest draagt versie, hash en een
      handtekening die met de EIGEN sleutel van het apparaat is gezet. Een doos
      kan dus zien dat de update van zijn eigen stad komt, en er staat altijd
      een terugvalversie bij: een update zonder weg terug is een fout die je
      maar een keer maakt.
   4. KALIBRATIE per sensor, met een geldigheidstermijn. Een meting van een
      sensor die drie jaar niet is nagelopen, is geen meting maar een getal.
   5. SABOTAGE. Een doos die gemanipuleerd wordt, meldt dat -- en dan is het
      geen onderhoudsklusje maar een beveiligingsmelding.

   WAT HIER NIET STAAT, en dat is geen omissie maar de grens van software:
   firmware, secure boot en de fysieke behuizing. Dit is de kant die de STAD
   bijhoudt; wat er in het kastje draait, is een ander vak.

   Krijgt de gedeelde ctx van kern/stad/index.js. */
const FASEN = ['geproduceerd', 'getest', 'geregistreerd', 'geinstalleerd', 'gekalibreerd',
  'actief', 'onderhoud', 'vervangen', 'gewist', 'afgevoerd'];
/* Welke stap mag na welke. Terug kan alleen waar dat in het echt ook kan:
   van actief naar onderhoud en weer terug, en van onderhoud naar vervangen. */
const OVERGANG = {
  geproduceerd: ['getest', 'afgevoerd'],
  getest: ['geregistreerd', 'afgevoerd'],
  geregistreerd: ['geinstalleerd', 'afgevoerd'],
  geinstalleerd: ['gekalibreerd', 'onderhoud'],
  gekalibreerd: ['actief', 'onderhoud'],
  actief: ['onderhoud', 'vervangen'],
  onderhoud: ['gekalibreerd', 'actief', 'vervangen'],
  vervangen: ['gewist'],
  gewist: ['afgevoerd'],
  afgevoerd: []
};
const SLEUTEL_OVERLAP_MS = 24 * 60 * 60 * 1000;   // de oude sleutel blijft een dag geldig
const KALIBRATIE_MAANDEN = 24;                     // daarna is een meting geen meting meer
const BUFFER_DAGEN = 30;                           // zo ver mag een doos nabestellen

module.exports = (ctx) => {
  const { d, save, crypto, schoon, nu, nodes, seintje, beveilig } = ctx;

  const hash = s => crypto.createHash('sha256').update(String(s)).digest('hex');
  const paspoorten = () => { if (!d().stadPaspoort || typeof d().stadPaspoort !== 'object') d().stadPaspoort = {}; return d().stadPaspoort; };

  /* Het paspoort van een doos. Bestaat er nog geen (alle dozen die er al
     hingen voordat deze laag er was), dan krijgt hij er een die eerlijk zegt
     dat hij van vóór de registratie is -- in plaats van te doen alsof zijn
     herkomst bekend is. */
  function paspoort(serial) {
    const n = nodes()[String(serial || '')];
    if (!n) return null;
    const p = paspoorten();
    if (!p[n.serial]) {
      p[n.serial] = { serial: n.serial, model: 'Stadsdoos v1', batch: n.demo ? 'demo' : 'onbekend',
        fase: n.demo ? 'actief' : 'geregistreerd', firmware: null, kalibratie: {},
        historie: [{ fase: n.demo ? 'actief' : 'geregistreerd', at: n.at || nu(), door: 'migratie',
          notitie: 'paspoort achteraf aangemaakt; herkomst van vóór de productregistratie' }],
        sabotage: null, at: nu() };
      save();
    }
    return p[n.serial];
  }

  const publiek = (pp, n) => ({ ...pp, naam: n.naam, zone: n.zone, sensoren: n.sensoren,
    demo: !!n.demo, kalibratieGeldigMaanden: KALIBRATIE_MAANDEN,
    kalibratieVerlopen: verlopenSensoren(pp, n), mag: OVERGANG[pp.fase] || [] });

  // welke sensoren zijn te lang niet nagelopen? Een lege lijst is hier een
  // uitspraak en geen stilte: hij betekent "alle sensoren zijn bij"
  function verlopenSensoren(pp, n) {
    const grens = nu() - KALIBRATIE_MAANDEN * 30 * 86400000;
    return (n.sensoren || []).filter(s => !pp.kalibratie[s] || pp.kalibratie[s].at < grens);
  }

  /* Een stap in de levensloop. De overgangstabel is de hele controle: wie een
     doos van "geproduceerd" naar "actief" wil praten, moet er langs alle
     tussenstappen mee -- want dat zijn precies de stappen waarin iemand hem
     heeft nagekeken. */
  function faseZet({ serial, fase, wie, notitie }) {
    const n = nodes()[String(serial || '')];
    if (!n) return { status: 404, error: 'Onbekende Stadsdoos.' };
    const pp = paspoort(n.serial);
    const doel = String(fase || '');
    if (!FASEN.includes(doel)) return { status: 400, error: 'Kies een fase: ' + FASEN.join(', ') + '.' };
    if (!(OVERGANG[pp.fase] || []).includes(doel))
      return { status: 400, error: 'Van "' + pp.fase + '" kan alleen naar ' + (OVERGANG[pp.fase] || []).join(' of ') +
        '; niet rechtstreeks naar "' + doel + '".' };
    if (doel === 'actief' && verlopenSensoren(pp, n).length)
      return { status: 400, error: 'Niet alle sensoren zijn gekalibreerd (' + verlopenSensoren(pp, n).join(', ') + '). Kalibreer eerst.' };
    pp.fase = doel;
    pp.historie.unshift({ fase: doel, at: nu(), door: schoon(wie, 60) || 'kantoor', notitie: schoon(notitie, 200) || null });
    if (pp.historie.length > 40) pp.historie.length = 40;
    /* GEWIST betekent gewist. De sleutel gaat eruit, en daarmee kan het
       apparaat niets meer insturen -- ook niet als iemand hem uit de container
       vist. Dat is het enige moment in dit bestand waar iets onomkeerbaar is,
       en dat hoort bij deze fase. */
    if (doel === 'gewist') { n.sleutelHash = null; n.oudeSleutel = null; n.actief = false; }
    if (doel === 'vervangen' || doel === 'afgevoerd') n.actief = false;
    save(); seintje();
    return { ok: true, paspoort: publiek(pp, n) };
  }

  /* Sleutelrotatie. De nieuwe sleutel wordt EEN keer getoond; de oude blijft
     SLEUTEL_OVERLAP_MS geldig zodat een doos die net offline was hem nog kan
     ophalen. Zonder die overlap sluit je precies de apparaten buiten waar je
     het minst vaak bij kunt. */
  function sleutelNieuw({ serial, wie }) {
    const n = nodes()[String(serial || '')];
    if (!n) return { status: 404, error: 'Onbekende Stadsdoos.' };
    if (n.demo) return { status: 400, error: 'Een demodoos heeft geen sleutel; die bestaat alleen op papier.' };
    const pp = paspoort(n.serial);
    if (['gewist', 'afgevoerd'].includes(pp.fase)) return { status: 400, error: 'Deze doos is ' + pp.fase + '; die krijgt geen sleutel meer.' };
    const nieuw = crypto.randomBytes(16).toString('hex');
    n.oudeSleutel = n.sleutelHash ? { hash: n.sleutelHash, tot: nu() + SLEUTEL_OVERLAP_MS } : null;
    n.sleutelHash = hash(nieuw);
    n.sleutelAt = nu();
    save(); seintje();
    return { ok: true, serial: n.serial, sleutel: nieuw,
      oudeGeldigTot: n.oudeSleutel ? n.oudeSleutel.tot : null,
      let_op: 'Bewaar de sleutel nu; hij wordt niet nog eens getoond. De oude blijft ' +
        (SLEUTEL_OVERLAP_MS / 3600000) + ' uur geldig, zodat een doos die offline was hem nog kan ophalen.',
      wie: schoon(wie, 60) || 'kantoor' };
  }

  /* De kalibratie staat in ./kalibratie.js: dat is een eigen vak, met een
     eigen termijn, en het raakt elke binnenkomende meting. */
  const { kalibreer, corrigeer } = require('./kalibratie')(ctx, { paspoort, paspoorten, KALIBRATIE_MAANDEN });

  /* De updates en de sabotagemelding staan in ./apparaatupdate.js: dat gaat
     over wat er NAAR een doos toe gaat en wat hij terugroept, dit over zijn
     levensloop in de administratie. */
  const { updates, updateUit, updateVoor, firmwareGemeld, sabotage } = require('./apparaatupdate')(ctx, { paspoort });

  const vloot = () => Object.values(nodes()).filter(n => n.actief || paspoorten()[n.serial])
    .map(n => publiek(paspoort(n.serial), n));

  return {
    FASEN, OVERGANG, KALIBRATIE_MAANDEN, BUFFER_DAGEN, paspoort, corrigeer, updateVoor, firmwareGemeld, sabotage, verlopenSensoren,
    api: {
      stadVloot: () => ({ status: 200, fasen: FASEN, overgangen: OVERGANG, updates: updates().slice(0, 10),
        kalibratieGeldigMaanden: KALIBRATIE_MAANDEN, apparaten: vloot() }),
      stadPaspoort: ({ serial }) => {
        const n = nodes()[String(serial || '')];
        return n ? { status: 200, paspoort: publiek(paspoort(n.serial), n) } : { status: 404, error: 'Onbekende Stadsdoos.' };
      },
      stadFaseZet: faseZet,
      stadSleutelNieuw: sleutelNieuw,
      stadKalibreer: kalibreer,
      stadUpdateUit: updateUit
    }
  };
};
