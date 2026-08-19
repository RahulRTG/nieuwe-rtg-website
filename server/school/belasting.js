/* School (deelmodule): de donderdag van de leerling en de week van de docent.

   TWEE BEELDEN, EN ALLEBEI ZIJN HET HULP.

   1. DE WEEK VAN DE KLAS. Wat komt er de komende twee weken op de kinderen af:
      huiswerk met een deadline, toetsen met een datum -- en niet alleen uit
      deze klas. Zitten er kinderen ook in een andere klas, dan telt dat mee,
      want de donderdag van een kind trekt zich niets aan van vakgrenzen.

      Wat er van die andere klas MEEKOMT is een telling en verder niets: geen
      titel, geen vak, geen leraar. Een docent hoort te zien DAT er twee dingen
      elders op die dag vallen; wat een collega precies opgeeft, gaat hem niet
      aan. Daarom telt deze module alleen en leest ze geen inhoud.

   2. DE WEEK VAN DE DOCENT. Wat er op hem afkomt: nakijkwerk dat is ingeleverd,
      huiswerkdeadlines, toetsdagen. Eenennegentig open antwoorden naast een
      rapportdeadline is een planningsfout en geen karakterfout.

   ER WORDT NIETS BEWAARD. Deze module schrijft niet: beide beelden worden
   telkens uitgerekend. Er is dus geen geschiedenis van hoe snel iemand zijn
   stapel wegwerkt, en die kan er later ook niet stilletjes bij komen (grens 8).

   EN ER GAAT NIETS NAAR HET KIND. Een drukke dag is een signaal aan wie het
   werk zet. Een melding aan een leerling dat het te druk is, verplaatst de last
   naar degene die er niets over te zeggen heeft. */
const { week } = require('../kern/belasting');

module.exports = (sctx) => {
  const { router, K, S, eigenVeld, klasVan, personeelVan, rapporten } = sctx;
  const dag = () => new Date().toISOString().slice(0, 10);

  /* Het werk van EEN klas, als telbare stukken. Titels blijven hier al buiten;
     wat er niet in gaat, kan er ook niet uit komen. */
  function stukkenVan(k, eigen) {
    const uit = [];
    for (const h of (k.huiswerk || [])) if (h.deadline)
      uit.push({ datum: h.deadline, soort: 'huiswerk', vak: eigen ? (h.vak || null) : null, eigen });
    for (const t of (k.toetsen || [])) if (t.datum)
      uit.push({ datum: t.datum, soort: t.soort === 'so' ? 'so' : 'toets', vak: eigen ? (t.vak || null) : null, eigen });
    return uit;
  }

  /* De andere klassen waar kinderen uit DEZE klas ook in zitten. */
  function elders(k) {
    const sleutels = new Set((k.leerlingen || []).map(l => l.sleutel));
    const uit = [];
    for (const ander of Object.values(K())) {
      if (ander.code === k.code || ander.schoolCode !== k.schoolCode) continue;
      if (!(ander.leerlingen || []).some(l => sleutels.has(l.sleutel))) continue;
      uit.push(...stukkenVan(ander, false));
    }
    return uit;
  }

  router.post('/school/belasting/klas', (req, res) => {
    const k = klasVan(req, res); if (!k) return;
    const stukken = stukkenVan(k, true).concat(elders(k));
    const w = week(stukken, dag(), Number(req.body.dagen) || 0);
    res.json(Object.assign({ ok: true, klas: { code: k.code, naam: k.naam } }, w,
      { uitleg: 'Wat er de komende dagen op deze kinderen afkomt, ook uit andere klassen. Van elders telt alleen het aantal: wat een collega opgeeft, staat er niet bij. Dit is planning, geen oordeel.' }));
  });

  router.post('/school/belasting/mij', (req, res) => {
    const auth = personeelVan(req, res); if (!auth) return;
    const { sch, p } = auth;
    const mijn = Object.values(K()).filter(x => x.schoolCode === sch.code &&
      (x.leraarId === p.id || (x.leraren || []).some(y => y.id === p.id) || (x.waarnemer && x.waarnemer.id === p.id)));
    const stukken = [];
    for (const k of mijn) {
      stukken.push(...stukkenVan(k, true));
      /* Nakijkwerk telt op VANDAAG: het ligt er nu, en het schuift niet op door
         het te laten liggen. Dat is precies wat een docent wil zien staan. */
      const nakijken = (k.toetsen || []).reduce((n, t) => n + Object.values(t.werk || {})
        .filter(w => w.klaar && !w.becijferd).length, 0);
      for (let i = 0; i < Math.min(nakijken, 200); i++) stukken.push({ datum: dag(), soort: 'nakijken', vak: null, eigen: true });
    }
    const concepten = (rapporten && sch ? rapporten(sch) : [])
      .filter(r => !r.vastgesteld && mijn.some(k => k.code === r.klasCode));
    for (const r of concepten) stukken.push({ datum: dag(), soort: 'rapport', vak: null, eigen: true });

    const w = week(stukken, dag(), Number(req.body.dagen) || 0);
    res.json(Object.assign({ ok: true, klassen: mijn.length }, w,
      { uitleg: 'Wat er op u afkomt, zodat u kunt schuiven. Er wordt niet bijgehouden hoe snel u het wegwerkt; werkdruk is hulp en geen beoordeling.' }));
  });
};
