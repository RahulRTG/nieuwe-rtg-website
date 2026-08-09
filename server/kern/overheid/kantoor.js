/* Overheid-domein "kantoor": het Belastingkantoor -- de meest luxe, uitgebreide
   en slimme werkplek van de Belastingdienst. De inspecteurscockpit ziet alles in
   een oogopslag (ontvangen, te ontvangen, teruggaven, toeslagen, btw-beeld), de
   invordering loopt netjes via de Berichtenbox (herinnering, betalingsregeling,
   kwijtschelding -- altijd een mens die beslist, en bij kwijtschelding TWEE
   mensen; die drie wonen in ./kantoor-invordering.js), en het kantoor werkt samen met
   alles wat moet: de facturatiemotor (btw per onderneming), het KVK-handelsregister
   en de Dienst Toeslagen. De slimme signalen wijzen de inspecteur op wat aandacht
   vraagt; de AI-chef-inspecteur (Rahul) denkt mee op het hele beeld. Beslissen
   doet altijd de mens. Krijgt de gedeelde ctx van kern/overheid/index.js. */
module.exports = (ctx) => {
  const { db, save, anthropic, nu, jaar, schoon, eur, seed, bericht, telPerZaak, btwSignalen, vorigeBtwPeriode } = ctx;

  const aanslagen = () => db.data.rijkAanslagen || [];
  const dagen = iso => Math.floor((Date.now() - new Date(iso || 0)) / 86400000);
  const open = a => a.saldo > 0 && !a.betaald && !a.kwijtgescholden;

  /* ---- de samenwerking: btw-beeld uit de facturatiemotor + KVK ----

     TWEE DINGEN ZIJN HIER RECHTGEZET toen de aangifte van de ondernemer erbij
     kwam (kern/fiscaal/btwaangifte.js).

     1. DE TELLING. Dit blok telde zelf op: `omzet += f.totaal` en
        `btw += f.btwBedrag`. Dat is een tweede optelling naast die van de
        aangifte, en een inspecteur die anders rekent dan de aangever vindt
        altijd een verschil. Nu loopt het door telPerZaak() uit
        kern/fiscaal/btwtelling.js -- dezelfde routine, tot op de regelsom.

     2. HET WOORD OMZET. `f.totaal` is het factuurbedrag INCLUSIEF btw, en dat
        stond onder de kop "omzet". In fiscale taal is omzet de grondslag, dus
        exclusief btw -- precies het getal dat in de aangifte staat. Wie de twee
        naast elkaar legde, vergeleek twee verschillende dingen zonder dat
        iets dat zei. Het veld heet nu `grondslag` en draagt ook dat getal. */
  function btwBeeld() {
    seed();
    const j = String(jaar());
    const perZaak = telPerZaak({ van: j + '-01-01', tot: j + '-12-31' });
    const kvk = db.data.rijkKvk || [];
    const lijst = [...perZaak.values()].map(p => ({ code: p.code, naam: p.naam, facturen: p.facturen,
      grondslag: Math.round(p.grondslagCenten / 100), btw: Math.round(p.btwCenten / 100),
      ingeschreven: kvk.some(k => k.supplierCode === p.code) }))
      .sort((a, b) => b.btw - a.btw).slice(0, 100);
    return { ok: true, jaar: j, zaken: lijst,
      totaalBtw: Math.round(lijst.reduce((s, p) => s + p.btw, 0)),
      totaalGrondslag: Math.round(lijst.reduce((s, p) => s + p.grondslag, 0)) };
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
    for (const z of bb.zaken) if (!z.ingeschreven && z.grondslag > 0)
      uit.push({ soort: 'register', ref: z.code, wie: z.naam, tekst: 'Omzet (€ ' + z.grondslag + ') buiten het handelsregister; KVK-inschrijving ontbreekt.' });
    /* De btw-signalen over de LAATST AFGESLOTEN periode: niets ingediend,
       afwijkend ingediend, of blijven hangen in een concept. Zie
       ./btwtoezicht.js -- daar staat ook waarom het niet de lopende periode is. */
    uit.push(...btwSignalen(vorigeBtwPeriode()));
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
      btwDitJaar: bb.totaalBtw, grondslagDitJaar: bb.totaalGrondslag, ondernemingen: (db.data.rijkKvk || []).length,
      btwPeriode: vorigeBtwPeriode(),
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
      /* De lopende voordracht tot kwijtschelding gaat MEE naar het scherm, met
         de naam erbij. Zonder die naam kan de tweede inspecteur niet zien of
         hij zelf de voordrager was, en dan botst hij pas op de vier-ogen-regel
         nadat hij op de knop heeft gedrukt. */
      kwijtVoorstel: a.kwijtVoorstel ? { door: a.kwijtVoorstel.door, reden: a.kwijtVoorstel.reden, at: a.kwijtVoorstel.at } : null,
      dagenOpen: open(a) ? dagen(a.ingediend || a.at) : 0 })) };
  }

  /* ---- invordering: een mens beslist, de Berichtenbox draagt het besluit ----
     Woont in ./kantoor-invordering.js. Daar staat ook waarom de kwijtschelding
     sinds deze ronde door TWEE inspecteurs gaat en de andere twee niet. */
  const deelInvordering = require('./kantoor-invordering')({ nu, save, schoon, bericht, aanslagen, open });

  /* ---- de AI-chef-inspecteur: Rahul denkt mee op het hele beeld ----
     Adviserend, nooit beslissend: elke herinnering, regeling of kwijtschelding
     blijft een menselijke handeling. Werkomgeving, dus neutraal karakter. */
  async function bdAI(vraag) {
    const c = bdCockpit();
    const beeld = 'Ontvangen € ' + c.ontvangen + ', te ontvangen € ' + c.teOntvangen + ' (' + c.openstaand + ' open, ' + c.regelingen + ' regelingen), teruggaven € ' + c.teruggaven +
      '. Toeslagen: ' + c.toeslagenLopend + ' lopend (€ ' + c.toeslagenPerMaand + '/mnd). Btw dit jaar € ' + c.btwDitJaar + ' over € ' + c.grondslagDitJaar + ' omzet (grondslag), ' + c.ondernemingen + ' ondernemingen in het register. ' +
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

  return Object.assign({ bdCockpit, bdAanslagen, bdBtwBeeld: btwBeeld, bdAI }, deelInvordering);
};
