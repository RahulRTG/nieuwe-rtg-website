/* Overheid-domein "kantoor": het Belastingkantoor -- de meest luxe, uitgebreide
   en slimme werkplek van de Belastingdienst. De inspecteurscockpit ziet alles in
   een oogopslag (ontvangen, te ontvangen, teruggaven, toeslagen, btw-beeld), de
   invordering loopt netjes via de Berichtenbox (herinnering, betalingsregeling,
   kwijtschelding -- altijd een mens die beslist), en het kantoor werkt samen met
   alles wat moet: de facturatiemotor (btw per onderneming), het KVK-handelsregister
   en de Dienst Toeslagen. De slimme signalen wijzen de inspecteur op wat aandacht
   vraagt; de AI-chef-inspecteur (Rahul) denkt mee op het hele beeld. Beslissen
   doet altijd de mens. Krijgt de gedeelde ctx van kern/overheid/index.js. */
module.exports = (ctx) => {
  const { db, save, anthropic, nu, jaar, schoon, eur, seed, bericht } = ctx;

  const aanslagen = () => db.data.rijkAanslagen || [];
  const dagen = iso => Math.floor((Date.now() - new Date(iso || 0)) / 86400000);
  const open = a => a.saldo > 0 && !a.betaald && !a.kwijtgescholden;

  /* ---- de samenwerking: btw-beeld uit de facturatiemotor + KVK ---- */
  function btwBeeld() {
    seed();
    const j = String(jaar());
    const perZaak = {};
    for (const f of (db.data.facturen || [])) {
      if (!f.verkoper || !f.verkoper.code || String(f.datum || '').slice(0, 4) !== j) continue;
      const p = perZaak[f.verkoper.code] || (perZaak[f.verkoper.code] = { code: f.verkoper.code, naam: f.verkoper.naam, facturen: 0, omzet: 0, btw: 0 });
      p.facturen += 1; p.omzet += f.totaal || 0; p.btw += f.btwBedrag || 0;
    }
    const kvk = db.data.rijkKvk || [];
    const lijst = Object.values(perZaak).map(p => ({ ...p, omzet: Math.round(p.omzet), btw: Math.round(p.btw),
      ingeschreven: kvk.some(k => k.supplierCode === p.code) }))
      .sort((a, b) => b.btw - a.btw).slice(0, 100);
    return { ok: true, jaar: j, zaken: lijst,
      totaalBtw: Math.round(lijst.reduce((s, p) => s + p.btw, 0)),
      totaalOmzet: Math.round(lijst.reduce((s, p) => s + p.omzet, 0)) };
  }

  /* ---- de slimme signalen: wat vraagt de aandacht van de inspecteur ---- */
  function signalen() {
    const uit = [];
    for (const a of aanslagen()) {
      if (open(a) && dagen(a.ingediend || a.at) > 30 && !a.herinnerd)
        uit.push({ soort: 'invordering', ref: a.ref, wie: a.codenaam, tekst: 'Aanslag ' + a.jaar + ' staat ' + dagen(a.ingediend || a.at) + ' dagen open (€ ' + a.saldo + '); nog geen herinnering gestuurd.' });
      if (a.inkomen > 0 && a.aftrek > a.inkomen * 0.4)
        uit.push({ soort: 'controle', ref: a.ref, wie: a.codenaam, tekst: 'Aftrek (€ ' + a.aftrek + ') is meer dan 40% van het inkomen; een blik waard.' });
    }
    const bb = btwBeeld();
    for (const z of bb.zaken) if (!z.ingeschreven && z.omzet > 0)
      uit.push({ soort: 'register', ref: z.code, wie: z.naam, tekst: 'Omzet (€ ' + z.omzet + ') buiten het handelsregister; KVK-inschrijving ontbreekt.' });
    return uit.slice(0, 60);
  }

  /* ---- de cockpit: het hele beeld in een oogopslag ---- */
  function bdCockpit() {
    seed();
    const alle = aanslagen(), j = jaar();
    const ontvangen = alle.filter(a => a.betaald && !a.kwijtgescholden).reduce((s, a) => s + Math.max(0, a.saldo), 0);
    const teOntvangen = alle.filter(open).reduce((s, a) => s + a.saldo, 0);
    const teruggaven = alle.filter(a => a.saldo < 0).reduce((s, a) => s + Math.abs(a.saldo), 0);
    const toeslagen = (db.data.rijkToeslagen || []).filter(t => t.status === 'toegekend');
    const bb = btwBeeld();
    return { ok: true, jaar: j,
      aanslagen: alle.length, ingediendDitJaar: alle.filter(a => a.jaar === j).length,
      ontvangen: eur(ontvangen), teOntvangen: eur(teOntvangen), teruggaven: eur(teruggaven),
      openstaand: alle.filter(open).length, regelingen: alle.filter(a => a.regeling).length,
      toeslagenLopend: toeslagen.length, toeslagenPerMaand: eur(toeslagen.reduce((s, t) => s + t.maandbedrag, 0)),
      btwDitJaar: bb.totaalBtw, omzetDitJaar: bb.totaalOmzet, ondernemingen: (db.data.rijkKvk || []).length,
      signalen: signalen() };
  }

  function bdAanslagen(filter) {
    seed(); filter = filter || {};
    let lijst = aanslagen();
    if (filter.stand === 'open') lijst = lijst.filter(open);
    if (filter.stand === 'betaald') lijst = lijst.filter(a => a.betaald);
    if (filter.stand === 'teruggaaf') lijst = lijst.filter(a => a.saldo < 0);
    return { ok: true, aanslagen: lijst.slice(0, 200).map(a => ({
      ref: a.ref, wie: a.codenaam, jaar: a.jaar, inkomen: a.inkomen, aftrek: a.aftrek, saldo: a.saldo,
      betaald: !!a.betaald, kwijtgescholden: !!a.kwijtgescholden, herinnerd: a.herinnerd || null,
      regeling: a.regeling ? { maanden: a.regeling.maanden, per: a.regeling.per } : null,
      dagenOpen: open(a) ? dagen(a.ingediend || a.at) : 0 })) };
  }

  /* ---- invordering: een mens beslist, de Berichtenbox draagt het besluit ---- */
  function pak(r) { return aanslagen().find(x => x.ref === String(r || '')); }
  function bdHerinnering(actor, r) {
    const a = pak(r);
    if (!a) return { status: 404, error: 'Aanslag niet gevonden.' };
    if (!open(a)) return { status: 409, error: 'Voor deze aanslag staat niets open.' };
    a.herinnerd = nu();
    bericht(a.key, 'Belastingdienst', 'Betalingsherinnering ' + a.jaar,
      'Er staat nog € ' + a.saldo + ' open voor je aanslag ' + a.jaar + ' (' + a.ref + '). Betaal via MijnOverheid, of vraag een betalingsregeling aan.', 'belasting');
    save();
    return { ok: true };
  }
  function bdRegeling(actor, r, maanden) {
    const a = pak(r);
    if (!a) return { status: 404, error: 'Aanslag niet gevonden.' };
    if (!open(a)) return { status: 409, error: 'Voor deze aanslag staat niets open.' };
    const m = Math.round(Number(maanden) || 0);
    if (m < 2 || m > 24) return { status: 400, error: 'Kies een regeling van 2 tot 24 maanden.' };
    a.regeling = { maanden: m, per: Math.ceil(a.saldo / m), door: actor || 'inspecteur', at: nu() };
    bericht(a.key, 'Belastingdienst', 'Betalingsregeling toegekend',
      'Voor je aanslag ' + a.jaar + ' is een regeling getroffen: ' + m + ' maanden van € ' + a.regeling.per + '.', 'belasting');
    save();
    return { ok: true, regeling: a.regeling };
  }
  function bdKwijtschelding(actor, r, reden) {
    const a = pak(r);
    if (!a) return { status: 404, error: 'Aanslag niet gevonden.' };
    if (!open(a)) return { status: 409, error: 'Voor deze aanslag staat niets open.' };
    a.kwijtgescholden = true; a.kwijt = { reden: schoon(reden, 200) || 'op besluit van de inspecteur', door: actor || 'inspecteur', at: nu() };
    bericht(a.key, 'Belastingdienst', 'Kwijtschelding',
      'De openstaande € ' + a.saldo + ' van je aanslag ' + a.jaar + ' is kwijtgescholden (' + a.kwijt.reden + '). Je hoeft niets meer te betalen.', 'belasting');
    save();
    return { ok: true };
  }

  /* ---- de AI-chef-inspecteur: Rahul denkt mee op het hele beeld ----
     Adviserend, nooit beslissend: elke herinnering, regeling of kwijtschelding
     blijft een menselijke handeling. Werkomgeving, dus neutraal karakter. */
  async function bdAI(vraag) {
    const c = bdCockpit();
    const beeld = 'Ontvangen € ' + c.ontvangen + ', te ontvangen € ' + c.teOntvangen + ' (' + c.openstaand + ' open, ' + c.regelingen + ' regelingen), teruggaven € ' + c.teruggaven +
      '. Toeslagen: ' + c.toeslagenLopend + ' lopend (€ ' + c.toeslagenPerMaand + '/mnd). Btw dit jaar € ' + c.btwDitJaar + ' over € ' + c.omzetDitJaar + ' omzet, ' + c.ondernemingen + ' ondernemingen in het register. ' +
      'Signalen: ' + (c.signalen.length ? c.signalen.slice(0, 5).map(s => s.soort + ': ' + s.tekst).join(' | ') : 'geen') + '.';
    const q = schoon(vraag, 400);
    if (anthropic && q) {
      try {
        const r = await anthropic.messages.create({
          model: 'claude-sonnet-5', max_tokens: 350,
          system: require('../rahul').RAHUL_LEAD + 'je bent de chef-inspecteur van het Belastingkantoor op het RTG-platform. ' +
            'Je adviseert de inspecteurs over invordering, controle-signalen en het btw-beeld, kort en beslist. ' +
            'Je adviseert ALLEEN: elk besluit (herinnering, regeling, kwijtschelding) neemt een mens. Geen fiscaal advies aan burgers; dit is het interne kantoor. Huidige beeld: ' + beeld,
          messages: [{ role: 'user', content: q }]
        });
        const tekst = r.content && r.content[0] && r.content[0].text;
        if (tekst) return { ok: true, antwoord: tekst };
      } catch (e) { /* val terug */ }
    }
    return { ok: true, demo: true, antwoord: 'Het beeld van vandaag: ' + beeld + ' Mijn advies: pak eerst de invorderingssignalen op (herinnering sturen kost niets), en kijk daarna naar de controle-signalen. Beslissen doet u zelf.' };
  }

  return { bdCockpit, bdAanslagen, bdHerinnering, bdRegeling, bdKwijtschelding, bdBtwBeeld: btwBeeld, bdAI };
};
