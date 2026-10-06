/* ============================================================================
   HET LEERHUIS -- de kennislus: officiele kennis, voorstellen uit de praktijk,
   en de impact van een nieuwe versie.

   DRIE REGELS, alle drie uit de opdracht en alle drie hier afgedwongen:
     - wie een versie schrijft is nooit de enige die hem goedkeurt
       (KNOWLEDGE_AUTHOR is niet de enige APPROVER);
     - een voorstel verandert nooit rechtstreeks ACTIVE kennis: het wordt pas
       IMPLEMENTED als er een ACTIVE versie bestaat die naar het voorstel wijst;
     - een nieuwe versie van actieve kennis gaat niet ACTIVE zonder impactklasse.
       Welke klasse het is, is een oordeel over de INHOUD en dus mensenwerk; wie
       en wat er geraakt wordt, rekent ./graaf.js uit.
   Vergelijk server/bedrijf/kennis.js (de kennisbank van een werkruimte): die
   heeft eigenaar, versie en houdbaarheid, maar geen goedkeuring en geen
   afhankelijkheden. ACADEMY.md par. 3 zegt waarom die twee (nog) niet een zijn.
   ========================================================================== */
'use strict';

const { overgang, IMPACT } = require('./standen');
const { geraakt } = require('./graaf');
const { relatieActief, heeftBestuur } = require('./oordeel');
const { weiger, eisId, eisBestuur, eisNiet, eisOrg, eigenId } = require('./hulp');

const tekst = (x, n) => String(x == null ? '' : x).slice(0, n || 200);

module.exports = {
  kennisSchrijf(st, i, door) {
    eisBestuur(st, door, ['KNOWLEDGE_OWNER', 'CURRICULUM_OWNER'], 'kennis schrijven');
    eisId(i.id, 'kennisitem');
    if (!i.bron) weiger('kennis zonder bron is geen officiele kennis', 400, 'noem de bron of het bewijs');
    const k = st.kennis[i.id];
    const versie = k ? Math.max(...Object.keys(k.versies).map(Number)) + 1 : 1;
    if (k && Object.values(k.versies).some(v => v.stand === 'DRAFT' || v.stand === 'REVIEW'))
      weiger('er ligt al een concept van ' + i.id + '; werk dat af of trek het terug', 409);
    if (i.voorstel && (!st.voorstellen[i.voorstel] || st.voorstellen[i.voorstel].stand !== 'APPROVED'))
      weiger('voorstel ' + i.voorstel + ' is niet goedgekeurd', 409);
    return [{ soort: 'kennisVersie', data: { id: i.id, versie, domein: tekst(i.domein, 60), titel: tekst(i.titel, 160),
      tekst: tekst(i.tekst, 8000), bron: tekst(i.bron, 300), risico: tekst(i.risico || 'normaal', 30),
      doelgroep: tekst(i.doelgroep, 120), geldigVan: i.geldigVan || null, geldigTot: i.geldigTot || null,
      reden: tekst(i.reden, 400), voorstel: i.voorstel || null,
      herkomst: i.herkomst === 'startpakket' ? 'startpakket' : null } }];
  },

  kennisStand(st, i, door, ctx) {
    eisOrg(st);
    const k = st.kennis[i.id]; const v = k && k.versies[i.versie];
    if (!v) weiger('die kennisversie bestaat niet in deze organisatie', 404);
    const o = overgang('kennis', v.stand, i.naar); if (!o.ok) weiger(o.reden, 409);
    if (i.naar === 'REVIEW' || (i.naar === 'DRAFT' && v.stand === 'REVIEW')) {
      if (door !== v.auteur) eisBestuur(st, door, ['KNOWLEDGE_OWNER'], 'kennis ter review zetten');
    } else {
      eisBestuur(st, door, ['KNOWLEDGE_OWNER'], 'kennis van stand veranderen');
    }
    const uit = [];
    if (i.naar === 'ACTIVE') {
      eisNiet(door, v.auteur, 'wie een kennisversie schrijft, keurt hem niet zelf goed');
      /* Besluit B7: een tekst uit een startpakket is voor deze organisatie pas
         waar als iemand HIER zegt waarom (startpakket.js, grens 2). */
      if (v.herkomst === 'startpakket' && !String(i.bron || '').trim())
        weiger('een concept uit het startpakket wordt pas officiele kennis met de eigen bron van deze organisatie', 409,
          'noem bij het activeren de bron (bron: ...)');
      if (k.actief) {
        if (!IMPACT.includes(i.impactKlasse)) weiger('een opvolgende versie vraagt een impactklasse: ' + IMPACT.join(', '), 400);
      }
    }
    uit.push({ soort: 'kennisStand', data: { id: i.id, versie: i.versie, naar: i.naar, reden: tekst(i.reden, 300),
      bron: i.naar === 'ACTIVE' && v.herkomst === 'startpakket' ? tekst(i.bron, 300) : null } });
    if (i.naar === 'ACTIVE' && k.actief) {
      const im = geraakt(st, i.id, i.impactKlasse);
      uit.push({ soort: 'impact', data: { kennis: i.id, versie: i.versie, van: k.actief, klasse: i.impactKlasse,
        vaardigheden: im.vaardigheden, curricula: im.curricula, rollen: im.rollen,
        mensen: im.mensen.map(m => m.persoon), trainers: im.trainers.map(t => t.persoon), beleid: im.beleid.map(b => b.id),
        id: ctx.id() } });
      /* Wie opnieuw beoordeeld moet worden, krijgt zijn leerpad opnieuw -- met
         de reden erbij. Bij LEARNING_UPDATE niet: dan volstaat een nieuw stuk
         kennisbewijs, en een heel pad opnieuw is checkbox-overload (grondwet 13). */
      if (IMPACT.indexOf(i.impactKlasse) >= IMPACT.indexOf('ASSESSMENT_REQUIRED'))
        for (const m of im.mensen) for (const c of im.curricula) {
          const l = st.personen[m.persoon].leren[c];
          if (l && l.stand !== 'ASSIGNED' && l.stand !== 'LEARNING')
            uit.push({ soort: 'leren', data: { persoon: m.persoon, curriculum: c, versie: st.curricula[c].versie,
              reden: 'verversing: kennis ' + i.id + ' ging naar versie ' + i.versie + ' (' + i.impactKlasse + ')' } });
        }
    }
    if (i.naar === 'ACTIVE' && v.voorstel) {
      const voorstel=st.voorstellen[v.voorstel];
      const approval=voorstel && voorstel.historie.slice().reverse().find(h=>h.stand==='APPROVED');
      if (!voorstel || !approval) weiger('de kennisversie verwijst niet naar een goedgekeurd praktijkvoorstel',409);
      const at=new Date(ctx.nu()).toISOString(),receiptId='lhcr_'+ctx.id();
      const previousRef=k.actief ? {domain:'leerhuis',type:'knowledge',id:st.id+':'+k.id,version:k.actief} : null;
      const newRef={domain:'leerhuis',type:'knowledge',id:st.id+':'+k.id,version:i.versie};
      uit.push({soort:'loopChangeReceipt',data:{receiptId,sourceDomain:'leerhuis',
        sourceObject:{domain:'leerhuis',type:'knowledge-line',id:st.id+':'+k.id,version:null},previousRef,newRef,
        changeType:'knowledge.version-activated',decisionRef:{domain:'leerhuis',type:'practice-proposal-decision',id:voorstel.id,version:approval.at},
        observationRef:{domain:'leerhuis',type:'practice-observation',id:voorstel.id,version:voorstel.at},
        expectation:{statement:voorstel.verwachting || voorstel.voorstel,successCriteria:voorstel.succescriteria || [],
          contextHash:null},operationId:ctx.sleutel || ('leerhuis:'+st.id+':'+k.id+':'+i.versie),
        correlationId:receiptId,appliedAt:at,actorRef:door,
        authorityRef:{organization:st.id,role:'KNOWLEDGE_OWNER'},context:{organizationCode:st.id,
          consumer:{domain:'leerhuis',id:st.id},scopeRefs:[newRef],purpose:voorstel.purpose || 'academy-practice-improvement'},
        integrityRef:null}});
    }
    return uit;
  },

  /* Praktijk mag officiele kennis ter discussie stellen (grondwet 11). Iedereen
     met een lopende relatie mag een voorstel doen; niemand hoeft daarvoor een
     rol te hebben. */
  voorstelIndienen(st, i, door, ctx) {
    eisOrg(st);
    if (!relatieActief(st, door)) weiger('alleen wie hier werkt of meedoet kan een voorstel indienen', 403);
    for (const veld of ['probleem', 'voorstel', 'reden']) if (!i[veld]) weiger('een voorstel noemt ' + veld, 400);
    if (i.kennis && !st.kennis[i.kennis]) weiger('kennisitem ' + i.kennis + ' bestaat niet', 404);
    if (i.verificationOf) {
      const ref=i.verificationOf;
      if (!ref || ref.domain!=='leerhuis' || ref.type!=='change-receipt' || ref.version!==1 ||
          !st.loopReceipts[ref.id]) weiger('het te verifiëren wijzigingsbewijs bestaat niet in dit leerhuis',404);
    }
    const kennisVersie=i.kennis && st.kennis[i.kennis] ? st.kennis[i.kennis].actief : null;
    return [{ soort: 'voorstel', data: { id: eigenId(st.voorstellen, i.id, ctx), kennis: i.kennis || null, kennisVersie,
      probleem: tekst(i.probleem, 800),
      huidigeRegel: tekst(i.huidigeRegel, 800), voorstel: tekst(i.voorstel, 1600), reden: tekst(i.reden, 800),
      bewijs: tekst(i.bewijs, 800), voorbeelden: tekst(i.voorbeelden, 800), risico: tekst(i.risico, 300),
      domein: tekst(i.domein, 60),verwachting:tekst(i.verwachting,1200),
      succescriteria:Array.isArray(i.succescriteria) ? i.succescriteria.slice(0,8).map(x=>tekst(x,300)) : [],
      purpose:tekst(i.purpose || 'academy-practice-improvement',120),verificationOf:i.verificationOf || null,
      assessment:i.assessment ? tekst(i.assessment,40) : null } }];
  },

  voorstelStand(st, i, door) {
    eisBestuur(st, door, ['KNOWLEDGE_OWNER', 'QUALITY_AUTHORITY'], 'een voorstel behandelen');
    const v = st.voorstellen[i.id]; if (!v) weiger('voorstel bestaat niet', 404);
    const o = overgang('voorstel', v.stand, i.naar); if (!o.ok) weiger(o.reden, 409);
    if (i.naar === 'APPROVED' || i.naar === 'REJECTED') {
      eisNiet(door, v.indiener, 'wie een voorstel indient, beslist er niet zelf over');
      if (!heeftBestuur(st, door, 'KNOWLEDGE_OWNER')) weiger('goedkeuren of afwijzen vraagt KNOWLEDGE_OWNER', 403);
    }
    let kennisVersie = null;
    if (i.naar === 'IMPLEMENTED') {
      const k = v.kennis && st.kennis[v.kennis];
      const actief = k && k.actief && k.versies[k.actief];
      if (!actief || actief.voorstel !== v.id)
        weiger('een voorstel is pas uitgevoerd als er een ACTIVE kennisversie naar verwijst', 409, 'schrijf de nieuwe versie met voorstel=' + v.id + ' en laat hem goedkeuren');
      kennisVersie = { id: k.id, versie: k.actief };
    }
    if (i.naar === 'MEASURED' && !i.meting) weiger('gemeten zonder meting bestaat niet', 400);
    return [{ soort: 'voorstelStand', data: { id: v.id, naar: i.naar, notitie: tekst(i.notitie, 600), kennisVersie, meting: i.meting ? tekst(i.meting, 800) : null } }];
  }
};
