/* RTG Theater, deelbestand "kijkplicht": WAT UW WERK U VRAAGT TE BEKIJKEN.

   De interne bibliotheek (./zaak.js) maakte intern werk mogelijk. Wat een
   organisatie daarnaast nodig heeft is banaal en belangrijk: kan ik aanwijzen
   dat iedereen de nieuwe werkinstructie moet zien, en kan ik zien wie dat heeft
   gedaan.

   HOE DAT HIER GEMETEN WORDT, EN WAAROM ZO. Niet met kijkgedrag. RTG meet
   nergens weergaven, kijktijd of bereik -- dat staat met zoveel woorden op het
   makersbord, en een uitzondering "omdat het nu de baas is die het vraagt" is
   geen uitzondering maar het einde van die regel. Wat er wel gebeurt: de
   medewerker ZEGT dat hij het gezien heeft, met een moment erbij. Dat is een
   verklaring van een mens, geen meting van een machine, en zo staat het ook op
   beide schermen.

   Wat de werkgever dus WEL krijgt: wie het heeft afgetekend en wanneer, en wie
   nog niet. Wat hij NIET krijgt: of iemand tot het eind heeft gekeken, hoe vaak,
   hoe lang, wanneer hij pauzeerde, of op welk apparaat. Die gegevens bestaan
   hier niet -- ze worden niet weggelaten uit beleefdheid, ze zijn er niet.

   EN DE MEDEWERKER ZIET HETZELFDE. Er is een lijst, en beide kanten lezen hem:
   geen dossier over iemand waar hij zelf niet in kan (LAT.md regel 5).

   NAMEN, NIET CODENAMEN. Dit is de enige plek in dit huis waar een lijst met
   NAMEN hoort: het is de personeelslijst van de werkgever zelf, die hij zelf
   heeft ingevoerd (supplier_staff). De codenaam van het RTG-account komt hier
   niet voorbij, en andersom kan de werkgever uit deze lijst geen codenaam
   afleiden -- de kluis blijft dicht.

   Krijgt de gedeelde ctx van kern/theater/index.js. */
'use strict';

const MAX_PER_ZAAK = 200;

module.exports = (ctx) => {
  const { db, save, nu, id, lijsten, kanaalMet, videoMet, zakenVan, personeelVan } = ctx;

  function tabel() {
    if (!Array.isArray(db.data.theaterKijkplicht)) db.data.theaterKijkplicht = [];
    return db.data.theaterKijkplicht;
  }
  const leidtBij = (key, code) => zakenVan(key).some(z => z.code === code && z.leiding);
  const werktBij = (key, code) => zakenVan(key).some(z => z.code === code);
  const regelMet = (rid) => tabel().find(r => r.id === String(rid || '')) || null;

  /* De video moet bij de INTERNE bibliotheek van diezelfde zaak horen. Een
     openbare video als "verplicht" aanwijzen zou betekenen dat de werkgever
     iets oplegt wat buiten zijn eigen wereld staat -- en dan hangt de plicht
     aan iets dat de maker morgen kan weghalen. */
  function internVan(code, videoId) {
    const v = videoMet(String(videoId || ''));
    if (!v || !v.klaar) return null;
    const k = kanaalMet(v.kanaalId);
    return k && k.zaakCode === code ? v : null;
  }

  /* ---- de leiding wijst aan ---- */
  function zet(key, opdracht) {
    const o = opdracht || {};
    const code = String(o.zaakCode || '');
    if (!leidtBij(key, code)) return { status: 403, error: 'Alleen de leiding van de zaak wijst werk aan.' };
    lijsten();
    if (o.weg === true) {
      const r = regelMet(o.id);
      if (!r || r.zaakCode !== code) return { status: 404, error: 'Deze regel bestaat niet.' };
      db.data.theaterKijkplicht = tabel().filter(x => x !== r); save();
      return { status: 200, ok: true, lijst: stand(key, code).lijst };
    }
    const v = internVan(code, o.videoId);
    if (!v) return { status: 404, error: 'Kies een video uit de interne bibliotheek van deze zaak.' };
    if (tabel().some(r => r.zaakCode === code && r.videoId === v.id))
      return { status: 409, error: 'Deze video staat er al op.' };
    if (tabel().filter(r => r.zaakCode === code).length >= MAX_PER_ZAAK)
      return { status: 409, error: 'Meer dan ' + MAX_PER_ZAAK + ' regels wordt een archief, geen lijst.' };
    const uiterlijk = /^\d{4}-\d{2}-\d{2}$/.test(String(o.uiterlijk || '')) ? String(o.uiterlijk) : null;
    tabel().push({ id: id(), zaakCode: code, videoId: v.id, uiterlijk, door: key, at: nu(), gedaan: {} });
    save();
    return { status: 200, ok: true, lijst: stand(key, code).lijst };
  }

  /* ---- de medewerker tekent zelf af ---- */
  function gedaan(key, opdracht) {
    const o = opdracht || {};
    const r = regelMet(o.id);
    if (!r || !werktBij(key, r.zaakCode)) return { status: 404, error: 'Deze regel bestaat niet.' };
    r.gedaan = r.gedaan || {};
    if (o.aan === false) delete r.gedaan[key];
    else r.gedaan[key] = nu();
    save();
    return { status: 200, ok: true, gedaan: !!r.gedaan[key],
      let: 'Dit is uw eigen verklaring, met dit moment erbij. RTG meet niet of en hoe lang u gekeken heeft.' };
  }

  /* ---- wat IK moet bekijken ---- */
  function mijn(key) {
    lijsten();
    const codes = new Set(zakenVan(key).map(z => z.code));
    const rijen = tabel().filter(r => codes.has(r.zaakCode)).map(r => {
      const v = videoMet(r.videoId);
      const zaak = zakenVan(key).find(z => z.code === r.zaakCode);
      return { id: r.id, zaakCode: r.zaakCode, zaakNaam: (zaak && zaak.naam) || r.zaakCode,
        videoId: r.videoId, titel: v ? v.titel : null, weg: !v,
        uiterlijk: r.uiterlijk, gedaan: !!(r.gedaan || {})[key], gedaanOp: (r.gedaan || {})[key] || null };
    });
    return { status: 200, rijen,
      uitleg: 'Uw werk vraagt u dit te bekijken. U tekent zelf af dat u het gezien heeft: RTG meet geen kijkgedrag, ' +
        'geen kijktijd en geen weergaven. Uw werkgever ziet precies deze lijst -- niet meer.' };
  }

  /* ---- wat de LEIDING ziet: dezelfde lijst, met wie er heeft afgetekend ---- */
  function stand(key, zaakCode) {
    const code = String(zaakCode || '');
    if (!leidtBij(key, code)) return { status: 403, error: 'Alleen de leiding van de zaak ziet deze stand.' };
    lijsten();
    const mensen = personeelVan(code);
    const lijst = tabel().filter(r => r.zaakCode === code).map(r => {
      const v = videoMet(r.videoId);
      return { id: r.id, videoId: r.videoId, titel: v ? v.titel : null, weg: !v, uiterlijk: r.uiterlijk, at: r.at,
        mensen: mensen.map(p => ({ naam: p.naam,
          /* Wie geen RTG-account aan zijn personeelsplek heeft gekoppeld, KAN
             niet aftekenen. Dat als "nog niet gedaan" tonen zou een verwijt zijn
             voor iets wat hij niet kan; het staat er daarom als eigen stand. */
          gekoppeld: !!p.key,
          gedaan: !!(p.key && (r.gedaan || {})[p.key]),
          gedaanOp: (p.key && (r.gedaan || {})[p.key]) || null })) };
    });
    return { status: 200, lijst, personeel: mensen.length,
      uitleg: 'U ziet wie heeft afgetekend dat hij het gezien heeft, en wanneer. Meer wordt er niet vastgelegd: ' +
        'RTG meet geen kijktijd, geen weergaven en geen apparaat. Uw team ziet exact dezelfde lijst.' };
  }

  return { kijkplichtZet: zet, kijkplichtGedaan: gedaan, kijkplichtMijn: mijn, kijkplichtStand: stand };
};
