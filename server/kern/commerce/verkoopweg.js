/* ============================================================================
   DE VERKOOPWEG -- waarlangs iets te koop staat.

   HET WOORD IS VRIJGEMAAKT VOORDAT DIT BESTAND ER KWAM. `KANALEN` stond in vier
   domeinen met vier betekenissen en een onderlinge overlap van 0,10;
   SEMANTIEK.json had het in de top als botsing. De drie die niet over verkopen
   gingen heten nu MELDWEGEN, UITNODIGINGSWEGEN en BERICHTWEGEN, en het woord
   `kanaal` is van kern/horeca.js -- de verkoopkanalen van een zaak (tafel, bar,
   terras, afhaal, bezorging). Zie COMMERCE.md par. 3. Deze laag bouwt daarop
   voort en zet er geen vijfde betekenis naast: een VERKOOPWEG is het object, een
   `kanaal` is wat de horeca er al mee bedoelde.

   ================== WAT EEN VERKOOPWEG WEL IS ==================

   Een genoemde, gepubliceerde SELECTIE uit het aanbod van een verkoper, met een
   toegangsniveau. Meer niet, en dat is met opzet: COMMERCE.md par. 4 somt er
   twaalf eigenschappen bij op (prijsbeleid, betaalbeleid, fulfilmentbeleid...) en
   elf daarvan bestaan nog nergens. Die hier alvast als veld neerzetten zou
   precies de fout zijn die de meting bij `Koopbaar` heeft voorkomen: een vorm
   verklaren die de domeinen niet waarmaken. Wat er niet is, staat in
   NIET_GEBOUWD met de reden -- dezelfde vorm als in ./werkwoordlijst.js en
   TENANT.md.

   ================== EN WANNEER HIJ PUBLIEK MAG ==================

   PUBLIEK VERKOPEN IS AFHANKELIJK, en dat is sinds kort iets anders dan
   onmogelijk. Hier stond een onvoorwaardelijke weigering met de zin erbij:
   "Zodra de eigenaar het besluit neemt, is dat hier een regel minder en geen
   nieuwe laag." Dat is nu gebeurd, en het is inderdaad een regel MINDER
   geworden: ./publiekslot.js LEEST de twee sloten van kern/webdomein.js in
   plaats van er een derde naast te leggen.

   Slot een is de boardroom (`dom-eigendomein`, standaard uit), slot twee is de
   zaak die zelf een adres koppelt en online zet. Staan die allebei open, dan is
   deze verkoopweg geen nieuwe deur maar een etalage op een deur die al open
   staat. Staat er een dicht, dan weigert `zet` nog steeds -- maar nu MET de
   naam van het slot dat dicht zit, in plaats van met een blanket nee.

   Deze laag kan geen van beide sloten openen. Hij heeft geen schrijfweg naar de
   functie en geen schrijfweg naar het domein; hij kan alleen lezen.
   ========================================================================== */
'use strict';

const { WEGSOORTEN, TOEGANG, NIET_GEBOUWD, WEGSOORT, TOEG, MAX_PER_ZAAK } = require('./verkoopweglijst');

module.exports = ({ db, save, nu, etalage, publiekSlot }) => {
  const klok = () => (typeof nu === 'function' ? nu() : require('../../lib/klok').nu());
  /* De twee sloten van kern/webdomein.js, gelezen door ./publiekslot.js. Niet
     gekoppeld betekent dat `publiek` dicht blijft mét de reden -- en niet dat
     hij stilletjes open gaat. */
  const slot = publiekSlot || require('./publiekslot')();
  const tekst = (v, n) => String(v == null ? '' : v).replace(/[<>]/g, '').trim().slice(0, n || 80);

  function pot() {
    if (!db.data.verkoopwegen || typeof db.data.verkoopwegen !== 'object') db.data.verkoopwegen = {};
    return db.data.verkoopwegen;
  }
  const vanZaak = (code) => {
    const c = tekst(code, 40);
    const p = pot();
    if (!Array.isArray(p[c])) p[c] = [];
    return p[c];
  };

  /* Aanmaken of bijwerken. De ZAAK komt van de aanroeper (uit een token) en
     nooit uit het lijf -- de deuren in routes/ zorgen daarvoor, en deze laag
     krijgt hem als losse parameter zodat hij er niet per ongeluk uit een
     body-object in kan glippen. */
  function zet(zaakCode, body) {
    const code = tekst(zaakCode, 40);
    if (!code) return { status: 400, error: 'Geen verkoopweg zonder zaak.' };
    const b = body || {};
    const naam = tekst(b.naam, 60);
    if (!naam) return { status: 400, error: 'Geef de verkoopweg een naam.' };

    const soort = WEGSOORT.get(tekst(b.soort, 20));
    if (!soort) return { status: 400, error: 'Kies een soort: ' + WEGSOORTEN.map(s => s.id).join(', ') + '.' };

    const toegang = TOEG.get(tekst(b.toegang, 20));
    if (!toegang) return { status: 400, error: 'Kies wie erbij mag: ' + TOEGANG.filter(t => t.kan !== false).map(t => t.id).join(', ') + '.' };
    /* AFHANKELIJK IS NIET HETZELFDE ALS VERBODEN. `kan: null` betekent: het
       hangt van de twee sloten af. Staan die open, dan mag het; staat er een
       dicht, dan weigert dit MET de naam van dat slot -- zie de kop. */
    let publiekOp = null;
    if (toegang.kan === null) {
      const st = slot.stand(code);
      if (!st.mag) {
        return { status: 403, error: st.waarom, toegang: toegang.id,
          besluitVan: 'boardroom', sloten: st.sloten, dicht: st.dicht };
      }
      publiekOp = st.adres;
    } else if (toegang.kan === false) {
      return { status: 403, error: toegang.afhankelijk || 'Deze toegang kan niet.', toegang: toegang.id };
    }

    const lijst = vanZaak(code);
    const bestaand = b.id ? lijst.find(w => w.id === tekst(b.id, 40)) : null;
    if (!bestaand && lijst.length >= MAX_PER_ZAAK) {
      return { status: 409, error: 'Meer dan ' + MAX_PER_ZAAK + ' verkoopwegen per zaak is geen kanaalstrategie meer maar een doolhof.' };
    }
    const w = bestaand || { id: 'vw' + Math.random().toString(36).slice(2, 10), zaak: code, at: klok(), live: false };
    w.naam = naam; w.soort = soort.id; w.toegang = toegang.id; w.bij = klok();
    /* De selectie: welke koopbaren horen bij deze weg. Leeg = alles wat de zaak
       te koop heeft; een lijst = precies die. Nooit een filter dat de zaak zelf
       niet kan zien -- daarom een opsomming en geen zoekopdracht. */
    w.alleen = Array.isArray(b.alleen) ? [...new Set(b.alleen.map(x => tekst(x, 80)).filter(Boolean))].slice(0, 500) : (w.alleen || []);
    /* Het adres waarop hij publiek stond TOEN hij werd gemaakt. Puur ter
       informatie: of hij het NU nog mag, wordt elke keer opnieuw gelezen (zie
       beeld en publiceer). Een verkoopweg die zijn eigen vergunning bewaart,
       blijft publiek nadat de boardroom de schakelaar heeft omgezet. */
    if (publiekOp) w.publiekOp = publiekOp; else delete w.publiekOp;
    if (!bestaand) lijst.unshift(w);
    save();
    return { ok: true, verkoopweg: beeld(w) };
  }

  /* Live zetten of uit de lucht halen. Apart van `zet`, want het is een ander
     soort besluit -- dezelfde knip als kern/webmaker-publiceren.js maakt tussen
     bouwen en publiceren. */
  function publiceer(zaakCode, id, live) {
    const w = vanZaak(zaakCode).find(x => x.id === tekst(id, 40));
    if (!w) return { status: 404, error: 'Deze verkoopweg bestaat niet.' };
    /* DE SLOTEN WORDEN HIER OPNIEUW GELEZEN. Live gaan is het moment waarop er
       iets naar buiten verandert, en tussen aanmaken en publiceren kan de
       boardroom de functie hebben uitgezet of de zaak zijn adres hebben
       losgekoppeld. Een verkoopweg die zijn vergunning van gisteren gebruikt,
       staat publiek terwijl het slot dicht zit. */
    if (live && w.toegang === 'publiek') {
      const st = slot.stand(w.zaak);
      if (!st.mag) return { status: 403, error: st.waarom, sloten: st.sloten, dicht: st.dicht };
    }
    const uit = telling(w);
    if (live && !uit.aantal) {
      return { status: 409, error: 'Deze verkoopweg heeft niets te koop. Een lege winkel online zetten helpt niemand.' };
    }
    w.live = !!live; w.bij = klok();
    save();
    return { ok: true, verkoopweg: beeld(w) };
  }

  function wis(zaakCode, id) {
    const lijst = vanZaak(zaakCode);
    const i = lijst.findIndex(x => x.id === tekst(id, 40));
    if (i < 0) return { status: 404, error: 'Deze verkoopweg bestaat niet.' };
    lijst.splice(i, 1); save();
    return { ok: true };
  }

  /* Wat er langs deze weg te koop staat, uit de graaf en niet uit een eigen
     kopie. `etalage` is de leeslaag; valt hij om, dan zegt dit dat ook. */
  function telling(w) {
    if (!etalage) return { aantal: null, reden: 'De aanbodlaag is niet gekoppeld.' };
    try {
      const e = etalage(w.zaak);
      const alles = e.teKoop || [];
      const gekozen = (w.alleen && w.alleen.length) ? alles.filter(k => w.alleen.includes(k.id)) : alles;
      return { aantal: gekozen.length, volledig: e.volledig !== false, buiten: (e.nietTeKoop || []).length };
    } catch (err) {
      return { aantal: null, reden: 'De aanbodlaag kon niet worden gelezen.' };
    }
  }

  /* De stand van de twee sloten voor deze zaak, plus wat dat voor DEZE weg
     betekent. `staatStil` is het geval dat een ondernemer moet zien: hij is
     live gezet en een slot is daarna dichtgegaan. */
  function publiekBeeld(w) {
    const st = slot.stand(w.zaak);
    return {
      mag: st.mag, adres: st.adres, sloten: st.sloten, waarom: st.waarom,
      staatStil: !!w.live && !st.mag,
      gemaaktOp: w.publiekOp || null
    };
  }

  function beeld(w) {
    const t = telling(w);
    return {
      id: w.id, zaak: w.zaak, naam: w.naam,
      soort: w.soort, soortLabel: (WEGSOORT.get(w.soort) || {}).label || w.soort,
      toegang: w.toegang, toegangLabel: (TOEG.get(w.toegang) || {}).label || w.toegang,
      wie: (TOEG.get(w.toegang) || {}).wie || null,
      alleen: w.alleen || [], selectie: (w.alleen || []).length ? 'gekozen' : 'alles wat te koop staat',
      live: !!w.live,
      teKoop: t.aantal, teKoopVolledig: t.volledig !== false, buitenDeEtalage: t.buiten == null ? null : t.buiten,
      tellingOnbekend: t.reden || null,
      /* Voor een PUBLIEKE weg: de stand van de twee sloten NU, en niet die van
         gisteren. Zo ziet een ondernemer meteen dat zijn winkel stilstaat omdat
         de boardroom de functie uitzette, in plaats van zich af te vragen
         waarom er niemand komt. Bij de andere vier soorten hoort dit blok er
         niet: die hangen nergens van af. */
      publiek: w.toegang === 'publiek' ? publiekBeeld(w) : null,
      at: w.at, bij: w.bij
    };
  }

  const lijst = (zaakCode) => vanZaak(zaakCode).map(beeld);

  return { zet, publiceer, wis, lijst, WEGSOORTEN, TOEGANG, NIET_GEBOUWD, MAX_PER_ZAAK };
};
