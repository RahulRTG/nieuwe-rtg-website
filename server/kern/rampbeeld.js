/* Het gezamenlijke rampbeeld: tijdens een grote calamiteit delen de
   hulpdiensten, de zorg en defensie hun paraatheid in EEN overzicht, zodat
   niemand blind coordineert. Het beeld telt live over de korpsen heen:

   - korpsen (politie, brandweer, ambulance, special forces): vrije en
     ingezette eenheden over land, water en lucht;
   - ziekenhuizen: vrije bedden en de drukte op de eerste hulp (SEH);
   - defensie: paraatheid van eenheden en het veldhospitaal;
   - de open meldingen die nog om een eenheid vragen.

   Coordinatieniveau: normaal -> incident -> opgeschaald -> ramp. Wie in de
   keten zit (of de boardroom) ziet het beeld van de eigen keten-partners;
   de boardroom ziet alles. Puur coordinatie van hulp: geen offensieve
   functie, geen klantdata, alleen operationele paraatheid. */

const NIVEAUS = ['normaal', 'incident', 'opgeschaald', 'ramp'];
const KORPS_TYPES = ['politie', 'brandweer', 'ambulance', 'specials'];

module.exports = ({ db, save, findSupplier, anthropic }) => {
  const nu = () => Date.now();
  const lijst = x => Array.isArray(x) ? x : (x && typeof x === 'object' ? Object.values(x) : []);
  function hulp() { if (!db.data.hulp) db.data.hulp = {}; return db.data.hulp; }

  // de keten-partners van een korps (akkoord-verbindingen uit de ketenchat)
  function partnersVan(code) {
    const links = ((hulp().keten || {}).links) || [];
    return links.filter(l => l.status === 'akkoord' && (l.a === code || l.b === code)).map(l => l.a === code ? l.b : l.a);
  }

  /* Het niveau op- of afschalen. Blijft bij de keten en de boardroom; wordt
     met naam en tijd vastgelegd. */
  function schaal(niveau, door) {
    if (!NIVEAUS.includes(niveau)) return { status: 400, error: 'Kies: ' + NIVEAUS.join(', ') + '.' };
    hulp().ramp = { niveau, sinds: nu(), door: String(door || 'coordinatie').replace(/[<>]/g, '').slice(0, 40) };
    save();
    return { ok: true, ramp: hulp().ramp };
  }

  // het beeld voor een set codes (of alle hulp/zorg/defensie voor de boardroom)
  function beeldVoor(codes) {
    const set = codes ? new Set(codes) : null;
    const h = hulp();
    const isIn = s => set ? set.has(s.code) : true;
    const suppliers = (db.data.suppliers || []);
    const korpsen = [], ziekenhuizen = [], defensie = [];
    let eenhedenVrij = 0, eenhedenIn = 0, beddenVrij = 0, sehWachtend = 0;

    for (const s of suppliers) {
      if (!isIn(s)) continue;
      if (KORPS_TYPES.includes(s.type)) {
        const eh = (h.eenheden || {})[s.code] || [];
        const vrij = eh.filter(e => e.status === 'vrij').length;
        const inzet = eh.filter(e => e.status === 'onderweg' || e.status === 'ter-plaatse').length;
        eenhedenVrij += vrij; eenhedenIn += inzet;
        korpsen.push({ code: s.code, naam: s.name, soort: s.type, vrij, inzet, totaal: eh.length,
          perSoort: ['land', 'water', 'lucht', 'heli'].map(k => ({ soort: k, vrij: eh.filter(e => e.soort === k && e.status === 'vrij').length })).filter(x => x.vrij) });
      } else if (s.type === 'ziekenhuis') {
        const bed = (h.bedden || {})[s.code] || { totaal: 0, bezet: 0 };
        const vrij = Math.max(0, (bed.totaal || 0) - (bed.bezet || 0));
        const wacht = ((h.seh || {})[s.code] || []).filter(p => p.status === 'wacht').length;
        beddenVrij += vrij; sehWachtend += wacht;
        ziekenhuizen.push({ code: s.code, naam: s.name, beddenVrij: vrij, beddenTotaal: bed.totaal || 0, sehWachtend: wacht });
      } else if (s.type === 'defensie') {
        const d = (db.data.defensie || {})[s.code] || {};
        const ee = d.eenheden || [];
        defensie.push({ code: s.code, naam: s.name,
          gevechtsgereed: ee.filter(e => e.paraat === 'gevechtsgereed').length,
          beperkt: ee.filter(e => e.paraat === 'beperkt').length,
          gewonden: (d.gewonden || []).filter(g => g.status !== 'ontslagen' && g.status !== 'geevacueerd').length });
      }
    }
    const meldingenOpen = lijst(h.meldingen).filter(m => m.status !== 'afgerond' && (!set || set.has(m.korps))).length;
    return {
      korpsen, ziekenhuizen, defensie,
      totalen: { eenhedenVrij, eenhedenIngezet: eenhedenIn, beddenVrij, sehWachtend, meldingenOpen }
    };
  }

  /* Het rampbeeld voor een viewer. Een korps ziet zichzelf plus de
     keten-partners; de boardroom (viewerCode null) ziet alles. */
  function beeld(viewerCode) {
    let codes = null;
    if (viewerCode) {
      const self = findSupplier(viewerCode);
      const magZien = self && (KORPS_TYPES.includes(self.type) || ['ziekenhuis', 'huisarts', 'defensie', 'apotheek', 'specialist', 'beautymedical'].includes(self.type));
      if (!magZien) return { status: 403, error: 'Alleen hulpdiensten, zorg en defensie delen het rampbeeld.' };
      codes = [viewerCode, ...partnersVan(viewerCode)];
      if (codes.length === 1) return { status: 409, error: 'Verbind eerst met een ander korps in de keten; daarna deelt u het rampbeeld.' };
    }
    return { ok: true, ramp: hulp().ramp || { niveau: 'normaal', sinds: null, door: null }, ...beeldVoor(codes) };
  }

  /* De AI-coordinator: leest het gedeelde beeld en doet CONCRETE
     inzetvoorstellen. Nadrukkelijk adviserend: de coordinator voert nooit
     zelf iets uit; een mens wijst de eenheid daadwerkelijk toe. Zo blijft de
     verantwoordelijkheid waar hij hoort. */
  function regelAdvies(b) {
    const adviezen = [];
    const h = hulp();
    const codesInBeeld = new Set([...(b.korpsen || []).map(k => k.code), ...(b.defensie || []).map(d => d.code)]);
    const vrijeZiekenhuizen = (b.ziekenhuizen || []).filter(z => z.beddenVrij > 0).sort((a, c) => c.beddenVrij - a.beddenVrij);
    // open meldingen zonder toegewezen eenheid -> stel een vrije eenheid voor
    const open = lijst(h.meldingen).filter(m => m.status !== 'afgerond' && !m.eenheidId && codesInBeeld.has(m.korps));
    for (const m of open.slice(0, 6)) {
      const eigen = (h.eenheden || {})[m.korps] || [];
      let e = eigen.find(x => x.status === 'vrij');
      let van = m.korps;
      if (!e) { // geen eigen eenheid vrij: kijk of een partner er een heeft
        for (const k of b.korpsen || []) {
          const kv = ((h.eenheden || {})[k.code] || []).find(x => x.status === 'vrij');
          if (kv) { e = kv; van = k.code; break; }
        }
      }
      const zk = vrijeZiekenhuizen[0];
      adviezen.push('Prio ' + m.prio + ' "' + String(m.tekst).slice(0, 50) + '"' + (m.plek ? ' (' + m.plek + ')' : '') +
        (e ? ': stuur ' + e.naam + ' (' + e.soort + ', ' + van + ')' : ': GEEN vrije eenheid; overweeg op te schalen of bijstand te vragen') +
        (zk ? '; dichtstbijzijnde ziekenhuis met ruimte is ' + zk.naam + ' (' + zk.beddenVrij + ' bedden)' : '') + '.');
    }
    // ziekenhuizen die vollopen
    for (const z of (b.ziekenhuizen || [])) if (z.beddenTotaal > 0 && z.beddenVrij === 0) adviezen.push(z.naam + ' zit vol; leid nieuwe gewonden om naar een ziekenhuis met ruimte.');
    // korpsen zonder vrije eenheden
    for (const k of (b.korpsen || [])) if (k.totaal > 0 && k.vrij === 0) adviezen.push(k.naam + ' heeft geen vrije eenheid meer; vraag bijstand of schaal op.');
    if (!adviezen.length) adviezen.push('Op dit moment geen knelpunten: open meldingen zijn bemand en er zijn vrije bedden. Houd het beeld in de gaten.');
    return adviezen;
  }
  async function coordinatorAi(viewerCode, vraag) {
    const b = beeld(viewerCode);
    if (b.error) return b;
    const regels = regelAdvies(b);
    const v = String(vraag || '').replace(/[<>]/g, '').trim().slice(0, 300);
    if (anthropic) {
      try {
        const beeldTekst = 'Niveau: ' + b.ramp.niveau + '. Totalen: ' + JSON.stringify(b.totalen) +
          '. Korpsen: ' + (b.korpsen || []).map(k => k.naam + ' (' + k.vrij + ' vrij: ' + k.perSoort.map(p => p.vrij + ' ' + p.soort).join(',') + ')').join('; ') +
          '. Ziekenhuizen: ' + (b.ziekenhuizen || []).map(z => z.naam + ' ' + z.beddenVrij + ' bedden').join('; ') +
          '. Defensie: ' + (b.defensie || []).map(d => d.naam + ' ' + d.gevechtsgereed + ' gereed').join('; ') +
          '. Voorlopige voorstellen: ' + regels.join(' | ');
        const r = await anthropic.messages.create({
          model: 'claude-sonnet-5', max_tokens: 450,
          system: require('./rahul').RAHUL_LEAD + 'je bent de coordinator-assistent van het gezamenlijke rampbeeld (hulpdiensten, zorg en defensie). Je doet KORTE, concrete inzetvoorstellen: welke vrije eenheid naar welke melding, welk ziekenhuis met ruimte, wanneer op te schalen. ' +
            'Je BESLIST NOOIT en voert niets uit: je adviseert, de meldkamer beslist. Wees eerlijk als iets krap is en verzin geen eenheden of bedden die er niet zijn. Dit is een demonstratie- en oefenomgeving; bij echt levensgevaar geldt altijd 112 en het eigen protocol. Situatie: ' + beeldTekst,
          messages: [{ role: 'user', content: v || 'Geef je belangrijkste inzetvoorstellen op dit moment.' }]
        });
        const t = (r && r.content && r.content[0] && r.content[0].text || '').trim();
        if (t) return { ok: true, antwoord: t, voorstellen: regels, niveau: b.ramp.niveau };
      } catch (e) { /* de regelgebaseerde terugval hieronder */ }
    }
    return { ok: true, antwoord: 'Voorstellen (u beslist zelf): ' + regels.join(' '), voorstellen: regels, niveau: b.ramp.niveau };
  }

  return { rampbeeld: { NIVEAUS, beeld, schaal, coordinatorAi } };
};
