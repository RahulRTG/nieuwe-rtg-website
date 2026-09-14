
const { magBij } = require('./eigendom');/* RTG Bank, deel "incasso": terugkerende betalingen en machtigingen (incasso). Een
   lid zet een vaste overboeking klaar (huur, sparen, een abonnement) die per week of
   maand automatisch loopt; de incassoronde voert alles uit wat aan de beurt is. Net
   als de renteronde: idempotent op de klok (een uitvoering zet de volgende datum
   vooruit, dus twee keer draaien op dezelfde dag boekt niet dubbel). Krijgt de
   gedeelde ctx van kern/bank/index.js. */
module.exports = (ctx) => {
  const { db, save, crypto, schoon, nu, d, boekAsync, rekMeta, metIdem } = ctx;

  const DAG_MS = 86400000;
  const INTERVAL = { week: 7 * DAG_MS, maand: 30 * DAG_MS };
  function reeks() { if (!Array.isArray(d().bankTerugkerend)) d().bankTerugkerend = []; return d().bankTerugkerend; }
  const publiek = t => ({ id: t.id, vanIban: t.vanIban, naarIban: t.naarIban, centen: t.centen, interval: t.interval,
    oms: t.oms, actief: t.actief, volgendeAt: t.volgendeAt, laatsteAt: t.laatsteAt || null, mislukt: t.mislukt || 0 });

  /* DE VERVELENDSTE VAN DE NEGEN (TAKEN.md 4.57). Twee klikken gaven twee vaste
     betalingen, en die betalen niet EEN keer te veel maar elke maand opnieuw --
     tot iemand het opmerkt. Dat maakt dit de enige van de reeks waar de fout
     zichzelf blijft herhalen, en daarmee de duurste.

     De afdruk draagt bron, doel, bedrag en interval; de omschrijving niet (vrije
     tekst is geen ander verzoek). Wie er bewust twee wil, doet een nieuwe poging
     met een verse sleutel -- dat blijft mogen. */
  async function zet({ vanIban, naarIban, centen, interval, oms, codenaam, idem }) {
    const m = rekMeta(vanIban);
    if (!magBij(m, codenaam)) return { status: 404, error: 'De bronrekening bestaat niet.' };
    if (!rekMeta(naarIban)) return { status: 404, error: 'De tegenrekening bestaat niet.' };
    if (!INTERVAL[interval]) return { status: 400, error: 'Kies per week of per maand.' };
    const c = Math.round(Number(centen));
    if (!Number.isFinite(c) || c < 1 || c > 100000000) return { status: 400, error: 'Dat bedrag kan niet.' };
    return metIdem(idem ? 'tkzet:' + vanIban + ':' + idem : null, 'tkzet|' + vanIban + '|' + naarIban + '|' + c + '|' + interval, () => {
      const t = { id: 'TK' + crypto.randomBytes(5).toString('hex').toUpperCase(), vanIban, naarIban, codenaam: m.codenaam,
        centen: c, interval, oms: schoon(oms, 120) || 'Vaste betaling', actief: true, volgendeAt: nu() + INTERVAL[interval], laatsteAt: null, mislukt: 0 };
      reeks().unshift(t);
      if (reeks().length > 50000) reeks().pop();
      save();
      return { ok: true, terugkerend: publiek(t) };
    }, { geld: 'zet een reeks toekomstige boekingen klaar' });
  }
  function lijst(codenaam) {
    const c = String(codenaam || '').trim();
    return { ok: true, terugkerend: reeks().filter(t => t.codenaam === c).map(publiek) };
  }
  function stop({ id, codenaam }) {
    const t = reeks().find(x => x.id === id);
    if (!magBij(t, codenaam)) return { status: 404, error: 'Deze vaste betaling bestaat niet.' };
    t.actief = false;
    save();
    return { ok: true, id, actief: false };
  }
  /* De incassoronde: voer alles uit wat aan de beurt is. Met { nu: t } of
     { vooruitMs } kan het kantoor (of een test) de klok vooruitzetten. */
  async function ronde({ tot } = {}) {
    const grens = Number.isFinite(tot) ? tot : nu();
    let uitgevoerd = 0, mislukt = 0, bedrag = 0;
    for (const t of reeks()) {
      if (!t.actief) continue;
      let veiligheid = 0;
      while (t.volgendeAt <= grens && veiligheid++ < 500) {
        const b = await boekAsync({ van: t.vanIban, naar: t.naarIban, centen: t.centen, soort: 'incasso', oms: t.oms });
        if (b.error) { t.mislukt = (t.mislukt || 0) + 1; mislukt++; if (t.mislukt >= 5) t.actief = false; break; }
        t.laatsteAt = t.volgendeAt; t.volgendeAt += INTERVAL[t.interval]; t.mislukt = 0;
        uitgevoerd++; bedrag += t.centen;
      }
    }
    save();
    return { ok: true, uitgevoerd, mislukt, bedragCenten: bedrag };
  }

  /* DE VOORUITBLIK: wat zou deze ronde doen, zonder iets te boeken.

     WAAROM HIJ ER IS. Het voornemen (kern/commercie/voornemen.js) weegt het
     TOTAAL voordat de eerste boeking valt, en dat kan alleen als het totaal
     vooraf te kennen is. Tot nu was de enige manier om te weten wat een
     incassoronde int, hem draaien -- en dan is wegen te laat.

     HIJ SPIEGELT DE LUS VAN `ronde` EXACT, inclusief de inhaalslag (een vaste
     betaling die drie maanden achterloopt, boekt drie keer) en inclusief de
     veiligheidsteller. Een vooruitblik die de lus anders rekent dan de
     uitvoering, is erger dan geen vooruitblik: dan tekent een mens voor een
     bedrag dat niet komt.

     WAT HIJ NIET WEET, en dat staat in de uitslag: of een boeking LUKT. Saldo,
     bevroren rekeningen en limieten beslist boekAsync, en die wordt hier met
     opzet niet aangeroepen -- een vooruitblik die boekt is een ronde. Vandaar
     `bedragCenten` als BOVENgrens: wat er ten hoogste geind wordt. */
  function vooruitblik({ tot } = {}) {
    const grens = Number.isFinite(tot) ? tot : nu();
    const posten = [];
    let bedrag = 0;
    for (const t of reeks()) {
      if (!t.actief) continue;
      let volgende = t.volgendeAt, keer = 0, veiligheid = 0;
      while (volgende <= grens && veiligheid++ < 500) { keer++; volgende += INTERVAL[t.interval]; }
      if (!keer) continue;
      posten.push({ id: t.id, vanIban: t.vanIban, naarIban: t.naarIban, centen: t.centen,
        keer, centenTotaal: t.centen * keer, oms: t.oms });
      bedrag += t.centen * keer;
    }
    return { ok: true, aantal: posten.length, boekingen: posten.reduce((n, p) => n + p.keer, 0),
      bedragCenten: bedrag, posten,
      grens: 'BOVENgrens: dit is wat er aan de beurt is, niet wat er zal lukken -- saldo, ' +
        'bevroren rekeningen en limieten beslist de boeking zelf, en die is hier niet aangeroepen.' };
  }

  return { bankTerugkerendZet: zet, bankTerugkerend: lijst, bankTerugkerendStop: stop, bankIncassoRonde: ronde,
    bankIncassoVooruitblik: vooruitblik };
};
