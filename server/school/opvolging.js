/* School (deelmodule): No-Lost-Child -- de keten na de hulplijn.

   De knop van het kind staat in ./hulplijn.js. Hier staat wat er daarna
   gebeurt: toewijzen, gezien, afspraak, afgerond -- en de bewaking die luider
   wordt als er niets gebeurt (kern/opvolging.js).

   Drie dingen die dit deel dragen:

   1. DE DREMPEL BLIJFT LAAG. Het kind vult geen formulier in. Na de knop zijn
      er hooguit TWEE keuzes: wanneer, en van wie. Allebei mag "maakt niet uit",
      en allebei zijn een wens en geen opdracht aan de school.
   2. ESCALATIE VERTELT DAT ER IETS LIGT, NIET WAT OF VAN WIE. Het schoolbeeld
      voor de directie draagt geen naam en geen tekst -- alleen de klas, hoe
      lang het al open staat, en wat er ontbreekt. Dat moet wel: een
      vertrouwelijke melding is juist bedoeld voor als het thuis niet veilig is,
      en die route mag niet alsnog opengaan omdat niemand reageerde.
   3. AFRONDEN DOET EEN MENS, MET ZIJN NAAM. Er is geen stap die vanzelf gaat
      en geen melding die vanzelf verdwijnt. */
const { stand, fase, VOLGENDE } = require('../kern/opvolging');

/* De vorm van een ESCALATIE, los en zonder omgeving. Hier zit de grens die
   het zwaarst weegt: er staat geen naam in, geen tekst en geen sleutel. Dat
   is niet te toetsen op het antwoord van de route -- een verse melding
   escaleert nog niet, dus die lijst is dan leeg en bewijst niets. Daarom
   staat de rij hier, en zet de toets de sleutelverzameling vast. */
function escalatieVan(klas, m, st) {
  return { klas: klas.naam, klasCode: klas.code, acuut: !!m.acuut, fase: st.fase,
    urenOpen: st.sinds, ernst: st.ernst || null, wacht: st.wacht, volgende: VOLGENDE[st.fase] };
}

const WANNEER = ['vandaag', 'deze-week', 'maakt-niet-uit'];
const VAN_WIE = ['mentor', 'iemand-anders', 'maakt-niet-uit'];

module.exports = (sctx) => {
  const { router, save, nu, schoon, S, eigenVeld, K, klasVan, schoolVan, gezinSessie, leerlingVan } = sctx;
  const lijst = (k) => (Array.isArray(k.hulplijn) ? k.hulplijn : []);
  const vind = (k, id) => lijst(k).find(x => x.id === String(id || ''));

  /* ---------- het kind: hooguit twee keuzes, allebei vrijblijvend ---------- */
  router.post('/school/hulplijn/wens', (req, res) => {
    const s = gezinSessie(req, res); if (!s) return;
    const k = eigenVeld(K(), String(req.body.klasCode || '').trim().toUpperCase());
    const l = k && leerlingVan(k, s.g, s.p.id);
    if (!l) return res.status(403).json({ error: 'Dit is van het kind zelf: open het vanuit je eigen klas.' });
    const m = vind(k, req.body.id);
    if (!m || m.sleutel !== l.sleutel) return res.status(404).json({ error: 'Melding niet gevonden.' });
    const wanneer = WANNEER.includes(String(req.body.wanneer)) ? String(req.body.wanneer) : 'maakt-niet-uit';
    const vanWie = VAN_WIE.includes(String(req.body.vanWie)) ? String(req.body.vanWie) : 'maakt-niet-uit';
    m.wens = { wanneer, vanWie };
    save();
    res.json({ ok: true, wens: m.wens,
      uitleg: 'We proberen het zo te doen. Lukt dat niet, dan hoor je het; je hoeft verder niets in te vullen.' });
  });

  /* ---------- de mentor: toewijzen, afspraak, afronden ---------- */
  router.post('/school/hulplijn/toewijzen', (req, res) => {
    const k = klasVan(req, res); if (!k) return;
    const m = vind(k, req.body.id);
    if (!m) return res.status(404).json({ error: 'Melding niet gevonden.' });
    const naam = schoon(req.body.mentor, 60) || (k.leraar || null);
    if (!naam) return res.status(400).json({ error: 'Noem wie hiernaar kijkt.' });
    m.toegewezen = { naam, at: nu() };
    save();
    res.json({ ok: true, toegewezen: m.toegewezen, volgende: VOLGENDE.toegewezen });
  });

  router.post('/school/hulplijn/afspraak', (req, res) => {
    const k = klasVan(req, res); if (!k) return;
    const m = vind(k, req.body.id);
    if (!m) return res.status(404).json({ error: 'Melding niet gevonden.' });
    if (!m.gezienAt) return res.status(409).json({ error: 'Laat eerst weten dat u de melding gezien heeft.' });
    const wanneer = schoon(req.body.wanneer, 40), metWie = schoon(req.body.metWie, 60);
    if (!wanneer || !metWie) return res.status(400).json({ error: 'Een afspraak heeft een moment en een mens.' });
    m.afspraak = { wanneer, metWie, at: nu() };
    save();
    res.json({ ok: true, afspraak: m.afspraak, volgende: VOLGENDE.afspraak });
  });

  router.post('/school/hulplijn/afronden', (req, res) => {
    const k = klasVan(req, res); if (!k) return;
    const m = vind(k, req.body.id);
    if (!m) return res.status(404).json({ error: 'Melding niet gevonden.' });
    const door = schoon(req.body.door, 60);
    if (!door) return res.status(400).json({ error: 'Zet uw naam erbij; afronden doet een mens.' });
    if (!m.gezienAt) return res.status(409).json({ error: 'Een melding die niemand heeft gezien, kan niet afgerond zijn.' });
    m.afgerondAt = nu(); m.afgerondDoor = door;
    m.afgerondNotitie = schoon(req.body.notitie, 300) || null;
    m.status = 'afgerond';
    save();
    res.json({ ok: true, uitleg: 'Afgerond op uw naam. De melding blijft staan; afronden wist niets.' });
  });

  /* ---------- de bewaking, in de klas ---------- */
  router.post('/school/hulplijn/bewaking', (req, res) => {
    const k = klasVan(req, res); if (!k) return;
    const tijd = nu();
    const rijen = lijst(k).map(m => {
      const st = stand({ acuut: m.acuut, at: m.at, toegewezen: m.toegewezen, gezienAt: m.gezienAt,
        afspraak: m.afspraak, afgerondAt: m.afgerondAt }, tijd);
      return { id: m.id, naam: m.naam, acuut: !!m.acuut, vertrouwelijk: !!m.vertrouwelijk,
        wens: m.wens || null, fase: st.fase, escaleert: st.escaleert, wacht: st.wacht,
        urenOpen: st.sinds, volgende: VOLGENDE[st.fase] };
    });
    res.json({ ok: true, meldingen: rijen, open: rijen.filter(r => r.escaleert).length,
      uitleg: 'De bewaking kijkt alleen naar de keten: is er iemand die kijkt, en hoe lang staat het open. Wat er aan de hand is, beoordeelt ze niet.' });
  });

  /* ---------- de escalatie, bij de directie ----------
     Zonder naam en zonder tekst. Dat is geen zuinigheid maar de kern: een
     vertrouwelijke melding is bedoeld voor als het thuis niet veilig is, en die
     route mag niet alsnog opengaan omdat er niemand reageerde. Wat de directie
     nodig heeft om te handelen is de klas en de tijd. */
  router.post('/school/directie/bewaking', (req, res) => {
    const g = schoolVan(req, res); if (!g) return;
    const sch = g.sch || g;
    const tijd = nu();
    const rijen = [];
    for (const k of Object.values(K())) {
      if (k.schoolCode !== sch.code) continue;
      for (const m of lijst(k)) {
        const st = stand({ acuut: m.acuut, at: m.at, toegewezen: m.toegewezen, gezienAt: m.gezienAt,
          afspraak: m.afspraak, afgerondAt: m.afgerondAt }, tijd);
        if (!st.escaleert) continue;
        rijen.push(escalatieVan(k, m, st));
      }
    }
    rijen.sort((a, b) => (b.acuut ? 1 : 0) - (a.acuut ? 1 : 0) || b.urenOpen - a.urenOpen);
    res.json({ ok: true, escalaties: rijen.slice(0, 50), aantal: rijen.length,
      uitleg: 'Hier staat DAT er iets ligt en hoe lang, niet wat of van wie. Een vertrouwelijke melding blijft bij de mentor; bel de klas, ga hem niet openen.' });
  });
};
module.exports.escalatieVan = escalatieVan;
module.exports.WANNEER = WANNEER;
module.exports.VAN_WIE = VAN_WIE;
