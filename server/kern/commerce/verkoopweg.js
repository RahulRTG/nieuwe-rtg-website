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

   ================== EN WAT HIJ MET OPZET NIET KAN ==================

   PUBLIEK VERKOPEN KAN HIER NIET, en dat is geen ontbrekende regel maar een
   geweigerde. kern/webdomein.js legt uit waarom: binnen het huis leest alleen
   een ingelogd lid mee, op een openbaar adres leest iedereen mee -- "dat is geen
   instelling maar een verandering van wie de lezers zijn". Daar zitten twee
   sloten op, en het eerste is een besluit van de boardroom. Een verkoopweg die
   zichzelf publiek kan zetten, is een derde slot dat de andere twee omzeilt.

   Dus weigert `zet` de toegang `publiek` MET de reden, zoals TENANT.md de modus
   `sovereign` weigert in plaats van hem als knop te laten bestaan. Zodra de
   eigenaar het besluit neemt, is dat hier een regel minder en geen nieuwe laag.
   ========================================================================== */
'use strict';

const WEGSOORTEN = [
  { id: 'web', label: 'Website', wat: 'een site van de verkoper zelf' },
  { id: 'pos', label: 'Kassa', wat: 'aan de balie, op het scherm van de zaak' },
  { id: 'qr', label: 'QR ter plekke', wat: 'aan tafel, op de kamer, bij het schap' },
  { id: 'b2b', label: 'Zakelijk portaal', wat: 'voor bedrijven met een relatie' },
  { id: 'mall', label: 'RTG Mall', wat: 'binnen de leden-app' },
  { id: 'agent', label: 'AI-agent', wat: 'een gesprek in plaats van een scherm' }
];

/* DE TOEGANG. `publiek` staat er WEL in en is met opzet niet te kiezen: een
   lijst waar hij niet in staat, laat de vraag onbeantwoord; een lijst waar hij
   in staat met een weigering, geeft het antwoord. Zie de kop. */
const TOEGANG = [
  { id: 'personeel', label: 'Alleen personeel', kan: true, wie: 'medewerkers van de zaak' },
  { id: 'leden', label: 'RTG-leden', kan: true, wie: 'iedereen die is ingelogd' },
  { id: 'klanten', label: 'Eigen klanten', kan: true, wie: 'leden die de verkoper heeft uitgenodigd' },
  { id: 'bedrijven', label: 'Zakelijke relaties', kan: true, wie: 'organisaties met een relatie' },
  { id: 'publiek', label: 'Iedereen op internet', kan: false,
    wie: 'ook wie geen account heeft',
    waarom: 'Publiek verkopen verandert wie de lezers zijn, en dat is een besluit van de boardroom en niet van een verkoper. kern/webdomein.js heeft daar twee sloten voor; een verkoopweg die zichzelf publiek zet, zou daar een derde naast leggen die de andere twee omzeilt.' }
];

const NIET_GEBOUWD = {
  prijsbeleid: 'Een eigen prijs per verkoopweg (kassaprijs anders dan webprijs) vraagt een tweede prijsbron naast het domein. Zolang die er niet is, geldt de prijs van het aanbod; een verkoopweg met een eigen prijslijst zou meteen de vraag oproepen welke van de twee klopt.',
  betaalbeleid: 'Welke betaalwijzen een verkoopweg toestaat, hoort bij kern/pay en niet hier. Er komt geen tweede plek die bepaalt of iets betaald mag worden.',
  fulfilmentbeleid: 'Bezorgen en afhalen staan per zaak in kern/leverancier/bezorgregel.js. Een verkoopweg die dat overschrijft, laat een zaak per weg iets anders beloven dan haar bezorgschakelaar zegt.',
  eigenDomein: 'Een eigen adres is kern/webdomein.js en staat standaard uit, met twee sloten. Die staan daar met reden; een verkoopweg legt er geen derde naast.',
  merk: 'Het merk van een verkoper woont in kern/webmerk.js en geldt per vestiging. Een verkoopweg met een eigen huisstijl zou een vierde plek zijn waar een logo vandaan komt.'
};

const OP_ID = (l) => new Map(l.map(x => [x.id, x]));
const WEGSOORT = OP_ID(WEGSOORTEN), TOEG = OP_ID(TOEGANG);

const MAX_PER_ZAAK = 20;

module.exports = ({ db, save, nu, etalage }) => {
  const klok = () => (typeof nu === 'function' ? nu() : require('../../lib/klok').nu());
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
    if (!toegang) return { status: 400, error: 'Kies wie erbij mag: ' + TOEGANG.filter(t => t.kan).map(t => t.id).join(', ') + '.' };
    /* DE WEIGERING MET DE REDEN. Zie de kop: dit is geen ontbrekende regel. */
    if (!toegang.kan) return { status: 403, error: toegang.waarom, toegang: toegang.id, besluitVan: 'boardroom' };

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
      at: w.at, bij: w.bij
    };
  }

  const lijst = (zaakCode) => vanZaak(zaakCode).map(beeld);

  return { zet, publiceer, wis, lijst, WEGSOORTEN, TOEGANG, NIET_GEBOUWD, MAX_PER_ZAAK };
};
