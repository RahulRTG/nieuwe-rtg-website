/* Het leerpaspoort en de leerlijn voor een Foundation-leerling. Dit is geen
   tweede leermotor: dezelfde onderwijs-, leerstof-, examen- en bijleskernen
   als RTG School draaien hier achter de Foundation-, Leeftijd- en Leerlingpas. */
const { FASEN } = require('../kern/onderwijs-ladder');
const { DOELEN } = require('../kern/leerstof');

module.exports = (kern) => {
  const { app, rtf, onderwijs, leerstof, vervolg, bijles } = kern;
  const stuur = (res, r) => r.error ? res.status(r.status || 400).json({ error: r.error }) : res.json(r);

  function auth(req, res, next) {
    const sess = rtf.verifieerProfiel(req.body.code, req.body.token);
    if (!sess) return res.status(403).json({ error: 'Log opnieuw in bij je gezin.' });
    const rechten = rtf.leerlingPassen(sess);
    if (!rechten || !rechten.leeftijdBevestigd)
      return res.status(403).json({ error: 'Vul eerst de geboortedatum in; zonder leeftijdspas blijft het leerpaspoort dicht.' });
    if (!rechten.leerling)
      return res.status(403).json({ error: 'Het leerpaspoort hoort bij een leerlingprofiel.' });
    req.rtfLeerling = { sleutel: sess.handle, sess, rechten };
    next();
  }
  const veilig = (res, werk) => Promise.resolve().then(werk).then(r => stuur(res, r))
    .catch(() => res.status(500).json({ error: 'Er ging iets mis. Probeer het opnieuw.' }));
  const handel = (werk) => (req, res) => veilig(res, () => werk(req.rtfLeerling, req.body || {}));

  function trappen(l) {
    const leeftijd = l.rechten.leeftijd;
    if (leeftijd < 12) return ['po'];
    if (leeftijd < 16) return ['po', 'vo'];
    if (leeftijd < 18) return ['po', 'vo', 'mbo'];
    return ['po', 'vo', 'mbo', 'hbo', 'wo'];
  }
  const faseMag = (l, id) => {
    const f = FASEN.find(x => x.id === String(id || ''));
    return !!(f && trappen(l).includes(f.trap));
  };
  const doelMag = (l, id) => {
    const d = DOELEN[String(id || '')];
    if (!d) return false;
    if (d.groep) return trappen(l).includes('po');
    return faseMag(l, d.fase);
  };
  const dicht = () => ({ status: 403, error: 'Deze leerstof hoort nog niet bij jouw leeftijdspas.' });

  app.post('/api/rtf/leerling/ladder', auth, handel((l) => {
    const ladder = onderwijs.ladder();
    const ids = new Set(ladder.fasen.filter(f => faseMag(l, f.id)).map(f => f.id));
    return Object.assign({}, ladder, { fasen: ladder.fasen.filter(f => ids.has(f.id)),
      doorstroom: (ladder.doorstroom || []).filter(d => ids.has(d.van)).map(d => Object.assign({}, d, { naar: d.naar.filter(id => ids.has(id)) })) });
  }));
  app.post('/api/rtf/leerling/paspoort', auth, handel((l) => onderwijs.mijn(l.sleutel)));
  // hetzelfde bewijs, voor de leerling in de Foundation-app
  app.post('/api/rtf/leerling/bewijs', auth, handel((l, b) => onderwijs.bewijsVan(l.sleutel, b)));
  app.post('/api/rtf/leerling/inschrijf', auth, handel((l, b) => faseMag(l, b.fase) ? onderwijs.inschrijf(l.sleutel, b) : dicht()));
  app.post('/api/rtf/leerling/jaar-over', auth, handel((l) => onderwijs.jaarOver(l.sleutel)));
  app.post('/api/rtf/leerling/vakken', auth, handel((l, b) => b.fase && !faseMag(l, b.fase) ? dicht() : leerstof.leerstofVakken(l.sleutel, b)));
  app.post('/api/rtf/leerling/les', auth, handel((l, b) => doelMag(l, b.doel) ? leerstof.leerstofLes(l.sleutel, b) : dicht()));
  app.post('/api/rtf/leerling/pad', auth, handel((l, b) => doelMag(l, b.doel) ? leerstof.leerstofPad(l.sleutel, b) : dicht()));
  app.post('/api/rtf/leerling/oefen', auth, handel((l, b) => doelMag(l, b.doel) ? leerstof.leerstofOefenStart(l.sleutel, b) : dicht()));
  app.post('/api/rtf/leerling/antwoord', auth, handel((l, b) => leerstof.leerstofOefenAntwoord(l.sleutel, b)));
  // de Memory Engine, ook voor de leerling in de Foundation-app
  app.post('/api/rtf/leerling/herhalen', auth, handel((l) => leerstof.leerstofHerhalen(l.sleutel)));
  app.post('/api/rtf/leerling/dag', auth, handel((l) => leerstof.leerstofDag(l.sleutel)));
  app.post('/api/rtf/leerling/herhaal', auth, handel((l, b) => doelMag(l, b.doel) ? leerstof.leerstofHerhaalStart(l.sleutel, b) : dicht()));
  app.post('/api/rtf/leerling/examen', auth, handel((l, b) => faseMag(l, b.fase) && l.rechten.leeftijd >= 12 ? vervolg.examenStart(l.sleutel, b) : dicht()));
  app.post('/api/rtf/leerling/examen-antwoord', auth, handel((l, b) => vervolg.examenAntwoord(l.sleutel, b)));
  app.post('/api/rtf/leerling/advies', auth, handel((l) => vervolg.advies(l.sleutel)));
  app.post('/api/rtf/leerling/bijles/gesprek', auth, handel((l) => bijles.gesprek('lid:' + l.sleutel)));
  app.post('/api/rtf/leerling/bijles/vraag', auth, handel(async (l, b) => {
    const mijn = onderwijs.mijn(l.sleutel);
    const niveau = mijn.fase ? mijn.fase.naam + (mijn.jaar > 1 ? ' (jaar ' + mijn.jaar + ')' : '') : null;
    return bijles.vraag({ sleutel: 'lid:' + l.sleutel, naam: l.sess.p.naam, niveau,
      doelen: Object.keys(mijn.doelen || {}).slice(-5), tekst: b.tekst });
  }));
};
