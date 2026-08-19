/* DE BEWIJSKETEN: waar komt dit bedrag vandaan, en klopt het nog.

   Een btw-aangifte zegt "€ 4.812 te betalen". Dat getal is te vertrouwen zolang
   je het kunt openvouwen, en tot nu toe kon dat niet: de aangifte droeg de
   optelling maar niet de posten. Dit bestand vouwt hem open, en doet dat langs
   de keten die er echt is:

     aangifte -> periode -> tarief -> factuur -> factuurregel -> de regel die
     op de factuurdatum gold (kern/fiscaal/jaargangen.js)

   DRIE DINGEN, EN HET DERDE IS HET INTERESSANTST.

   1. VERKLAREN. De opbouw van een periode, per tarief en per factuur.
   2. HERBOUWEN. Een ingediende aangifte opnieuw uitrekenen uit de primaire
      bronnen en cent voor cent vergelijken met wat er is ingediend. Gelijk =
      groen. Dit is wat een controle vraagt en wat een spreadsheet nooit kan.
   3. WAT DE KETEN ZELF TEGENSPREEKT. Een factuurregel draagt het tarief dat de
      facturatiemotor erop zette; de jaargangen weten welke tarieven er in dat
      land op die dag BESTONDEN. Staat er een percentage op een regel dat die dag
      niet voorkwam, dan klopt er iets niet -- een regel die voor een
      tariefwijziging is geboekt en erna is gedateerd, of een ingetypt tarief.

      LET OP WAT DEZE CONTROLE WEL EN NIET ZEGT. Hij zegt NIET "deze regel had
      het lage tarief moeten hebben": welke categorie een regel had, staat niet
      op de regel, en dat verzinnen zou een bewering zijn die wij niet kunnen
      waarmaken. Hij zegt alleen: dit percentage bestond die dag niet in dit
      land. Dat is smal, en juist daarom is het waar.

   EEN TELLING, NIET TWEE. De centensom per regel komt uit ./btwtelling.js --
   dezelfde die de aangifte en de inspecteur gebruiken. Deze module telt de
   posten los op en legt die som DAARNAAST: wijken ze af, dan is dat geen detail
   maar een bevinding. Zo bewijst de verklaring zichzelf tegen het getal dat hij
   verklaart. */
'use strict';

const { maakBtwTelling, periodeVak } = require('./btwtelling');
const { zekerheid } = require('./zekerheid');

function maakHerkomst({ db, jaargangen }) {
  const { telFacturen, regelBtwCenten } = maakBtwTelling({ db });
  const facturen = () => (Array.isArray(db.data.facturen) ? db.data.facturen : []);
  const datumVan = (f) => String(f.datum || String(f.at || '').slice(0, 10));

  /* De tarieven die in dit land op die dag BESTONDEN. Zonder jaargangen valt
     hij terug op niets -- en dan wordt er ook niets beweerd, want een controle
     op een tabel die je niet hebt is geen controle (LAT.md regel 8). */
  function tarievenOp(land, datum) {
    if (!jaargangen || typeof jaargangen.regelsOp !== 'function') return null;
    const r = jaargangen.regelsOp(land, datum);
    if (!r || !r.tarieven) return null;
    return new Set(Object.values(r.tarieven).map(Number));
  }

  /* ---------- 1. verklaren ---------- */
  /* De opbouw van een periode: per tarief, met de facturen die eronder liggen.
     `zaak` draagt de code en het land, net als bij btwaangifte.maak(). */
  function verklaar(zaak, periode) {
    if (!zaak || !zaak.code) return { status: 404, error: 'Deze zaak kennen we niet.' };
    const vak = periodeVak(periode);
    if (!vak) return { status: 400, error: 'Geef een periode als 2026K3 (kwartaal) of 2026-07 (maand).' };
    const code = String(zaak.code).toUpperCase();
    const land = (zaak.settings && zaak.settings.land) || 'NL';

    const potten = new Map();
    const vreemd = [];
    let som = 0, aantal = 0;
    for (const f of facturen()) {
      const datum = datumVan(f);
      if (datum < vak.van || datum > vak.tot) continue;
      if (!f.verkoper || String(f.verkoper.code || '').toUpperCase() !== code) continue;
      const regels = Array.isArray(f.regels) ? f.regels : [];
      if (!regels.length) continue;
      const bestond = tarievenOp(land, datum);
      aantal += 1;
      for (const r of regels) {
        const { inclC, btwC, tarief } = regelBtwCenten(r);
        const p = potten.get(tarief) || { tarief, grondslagCenten: 0, btwCenten: 0, facturen: [] };
        p.grondslagCenten += inclC - btwC; p.btwCenten += btwC; som += btwC;
        const laatste = p.facturen[p.facturen.length - 1];
        if (laatste && laatste.nummer === (f.nummer || f.id)) { laatste.btwCenten += btwC; laatste.regels += 1; }
        else p.facturen.push({ nummer: f.nummer || f.id, datum, btwCenten: btwC, regels: 1 });
        potten.set(tarief, p);
        /* Het percentage op de regel tegen de tarieven die die dag bestonden. */
        if (bestond && !bestond.has(tarief))
          vreemd.push({ nummer: f.nummer || f.id, datum, tarief,
            bestond: [...bestond].sort((a, b) => a - b) });
      }
    }

    /* DE ZELFCONTROLE: dezelfde periode via de aggregaat-routine die de
       aangifte gebruikt. Loopt dat uiteen, dan verklaart deze opbouw een ander
       getal dan er wordt aangegeven, en dat is het eerste wat je moet weten. */
    const t = telFacturen(code, vak);
    const sluit = t.verkoopSom === som;

    return { ok: true, code, land, periode: vak.periode, van: vak.van, tot: vak.tot,
      verschuldigdCenten: som, facturen: aantal,
      tarieven: [...potten.values()].sort((a, b) => b.tarief - a.tarief),
      sluitAan: sluit,
      afwijkingCenten: sluit ? 0 : t.verkoopSom - som,
      vreemdeTarieven: vreemd,
      regelstand: jaargangen && typeof jaargangen.geschiedenis === 'function'
        ? { bron: 'jaargangen', jaargangen: jaargangen.geschiedenis(land).filter(x => x.geldigVanaf <= vak.tot).map(x => x.id) }
        : { bron: 'lopend', jaargangen: [] },
      /* EERLIJK OVER DE RAND, en niet in eigen woorden: dezelfde klasse als de
         aangifte die deze opbouw verklaart (./zekerheid.js), inclusief waar hij
         ophoudt -- omzet zonder factuur. Twee plekken die elk hun eigen
         voorbehoud verzinnen, zeggen na een tijd iets anders. */
      zekerheid: zekerheid('btw.aangifte') };
  }

  /* ---------- 2. herbouwen ---------- */
  /* Een INGEDIENDE aangifte opnieuw uitrekenen uit de primaire bronnen en
     vergelijken. Anders dan de controle in btwaangifte.dienIn() weigert deze
     niets: hij rapporteert. Weigeren hoort bij het indienen, verantwoorden bij
     het terugkijken -- en een controleur die alleen "geweigerd" te zien krijgt,
     weet nog steeds niet hoeveel het scheelt. */
  function herbouw(aangifte) {
    if (!aangifte || !aangifte.id) return { status: 404, error: 'Deze aangifte kennen we niet.' };
    const t = telFacturen(aangifte.code, { van: aangifte.van, tot: aangifte.tot });
    const nuVerschuldigd = t.verkoopSom;
    const nuVoorbelasting = t.voorbelasting;
    const gelijk = nuVerschuldigd === aangifte.verschuldigdCenten && nuVoorbelasting === aangifte.voorbelastingCenten;
    return { ok: true, id: aangifte.id, periode: aangifte.periode, stand: aangifte.stand,
      gelijk,
      ingediend: { verschuldigdCenten: aangifte.verschuldigdCenten, voorbelastingCenten: aangifte.voorbelastingCenten,
        saldoCenten: aangifte.saldoCenten },
      herbouwd: { verschuldigdCenten: nuVerschuldigd, voorbelastingCenten: nuVoorbelasting,
        saldoCenten: nuVerschuldigd - nuVoorbelasting },
      verschilCenten: (nuVerschuldigd - nuVoorbelasting) - aangifte.saldoCenten,
      uitslag: gelijk
        ? 'Herbouwd uit het factuurregister: op de cent gelijk aan wat er is ingediend.'
        : 'Herbouwd uit het factuurregister en NIET gelijk aan wat er is ingediend. Er is sinds het indienen iets aan de facturen van deze periode veranderd.' };
  }

  /* ---------- 3. de omgekeerde weg ---------- */
  /* WAT RAAKT DEZE REGELWIJZIGING. De vraag die een fiscale afdeling stelt zodra
     er iets verandert, en die tot nu toe alleen met de hand te beantwoorden was.

     Wat hier wordt geteld is smal en nagaanbaar: facturen van dat land vanaf de
     ingangsdatum die een tarief dragen dat door deze wijziging is VERVANGEN.
     Dat zijn de regels die het oude percentage dragen terwijl er een nieuw
     percentage gold -- niet "alles wat het tarief aanraakt", want dat zou ook
     alles meetellen wat gewoon goed staat. */
  function geraakt(land, jaargangId) {
    if (!jaargangen || typeof jaargangen.geschiedenis !== 'function')
      return { status: 409, error: 'Zonder jaargangen is niet na te gaan wat een regelwijziging raakt.' };
    const j = jaargangen.geschiedenis(land).find(x => x.id === jaargangId);
    if (!j) return { status: 404, error: 'Deze wijziging kennen we niet.' };
    const oude = new Set(Object.values((j.vorige && j.vorige.tarieven) || {}).filter(v => v != null).map(Number));
    if (!oude.size) return { ok: true, jaargang: j.id, geldigVanaf: j.geldigVanaf, tariefwijziging: false,
      facturen: 0, regels: 0, zaken: [], let: 'Deze wijziging raakt geen btw-tarief; er zijn dus geen facturen die erdoor van behandeling veranderen.' };

    const zaken = new Map();
    let nFacturen = 0, nRegels = 0;
    for (const f of facturen()) {
      const datum = datumVan(f);
      if (datum < j.geldigVanaf) continue;
      const code = f.verkoper && String(f.verkoper.code || '').toUpperCase();
      if (!code) continue;
      let raak = 0;
      for (const r of Array.isArray(f.regels) ? f.regels : []) if (oude.has(Number(r.btw) || 0)) raak += 1;
      if (!raak) continue;
      nFacturen += 1; nRegels += raak;
      zaken.set(code, (zaken.get(code) || 0) + 1);
    }
    return { ok: true, jaargang: j.id, land: j.land, geldigVanaf: j.geldigVanaf, tariefwijziging: true,
      vervangen: [...oude].sort((a, b) => a - b), nu: j.wijzigingen.tarieven || null,
      facturen: nFacturen, regels: nRegels,
      zaken: [...zaken.entries()].map(([code, n]) => ({ code, facturen: n })).sort((a, b) => b.facturen - a.facturen),
      let: nFacturen
        ? 'Deze facturen dragen na de ingangsdatum nog een percentage dat door deze wijziging is vervangen. Dat hoeft niet fout te zijn -- een levering van voor de wijziging mag het oude tarief dragen -- maar het is wel de lijst om na te lopen.'
        : 'Geen enkele factuur na de ingangsdatum draagt nog een vervangen percentage.' };
  }

  return { herkomst: { verklaar, herbouw, geraakt } };
}

module.exports = { maakHerkomst };
