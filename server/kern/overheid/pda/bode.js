/* Overheids-PDA, deelbestand "bode": de bode van de rechtbank zet de
   zittingen van vandaag klaar (rechtstreeks uit de zittingsrol), en de
   AI-conciërge denkt per rol mee -- beslissen en handelen doet altijd de
   medewerker zelf. Krijgt de subctx van ./index.js. */
module.exports = (ctx) => {
  const { db, save, anthropic, nu, schoon, loc, vandaag, pdaOverzicht, LOCATIES, ROLLEN } = ctx;

  /* ---- bode (rechtbank): de zittingen van vandaag klaarzetten ---- */
  function pdaZittingen() {
    const d = vandaag();
    const rol = (db.data.rijkZaken || []).filter(z => z.status === 'gepland' && z.zitting && z.zitting.datum >= d)
      .sort((a, b) => (a.zitting.datum + a.zitting.tijd).localeCompare(b.zitting.datum + b.zitting.tijd)).slice(0, 40)
      .map(z => ({ ref: z.ref, titel: z.titel, datum: z.zitting.datum, tijd: z.zitting.tijd, zaal: z.zitting.zaal,
        rechter: z.zitting.rechter, klaargezet: !!z.zitting.klaargezet, vandaag: z.zitting.datum === d }));
    return { ok: true, datum: d, zittingen: rol };
  }
  function pdaKlaarzet(actor, zaakRef) {
    const z = (db.data.rijkZaken || []).find(x => x.ref === String(zaakRef || ''));
    if (!z || !z.zitting) return { status: 404, error: 'Zitting niet gevonden.' };
    if (z.zitting.klaargezet) return { status: 409, error: 'Deze zaal staat al klaar.' };
    z.zitting.klaargezet = true; z.zitting.klaargezetDoor = actor || 'bode'; z.zitting.klaargezetAt = nu();
    save();
    return { ok: true, zitting: { ref: z.ref, zaal: z.zitting.zaal, klaargezet: true } };
  }

  /* ---- de AI-conciërge: denkt mee per rol, de medewerker handelt ---- */
  async function pdaAI(l, rol, vraag) {
    l = loc(l);
    if (!l) return { status: 400, error: 'Kies een geldige locatie.' };
    const o = pdaOverzicht(l);
    const beeld = LOCATIES[l].label + ': ' + o.bezoekersBinnen + ' bezoekers binnen, ' + o.incidentenOpen + ' open incidenten, ' +
      o.takenOpen + ' schoonmaaktaken open (' + o.takenKlaar + ' klaar), ' + o.rondesVandaag + ' rondes vandaag' +
      (l === 'rechtbank' ? ', ' + o.zittingenVandaag + ' zittingen op de rol' : '') + '.';
    const r = ROLLEN[String(rol || '')] ? String(rol) : 'receptie';
    const q = schoon(vraag, 400);
    if (anthropic && q) {
      try {
        const resp = await anthropic.messages.create({
          model: 'claude-sonnet-5', max_tokens: 300,
          system: require('../../rahul').RAHUL_LEAD + 'je bent de AI-conciërge op de Overheids-PDA van ' + LOCATIES[l].label +
            ', en je helpt nu een collega van de ' + ROLLEN[r].label.toLowerCase() + ' (' + ROLLEN[r].wat + '). ' +
            'Praktisch en kort; je adviseert alleen, de collega handelt zelf. Bij echt gevaar: eerst 112, dan melden. Huidige beeld: ' + beeld,
          messages: [{ role: 'user', content: q }]
        });
        const tekst = resp.content && resp.content[0] && resp.content[0].text;
        if (tekst) return { ok: true, antwoord: tekst };
      } catch (e) { /* val terug */ }
    }
    return { ok: true, demo: true, antwoord: 'Het beeld: ' + beeld + ' Voor de ' + ROLLEN[r].label.toLowerCase() + ': ' +
      (r === 'security' ? 'loop de ronde langs alle ' + LOCATIES[l].ruimtes.length + ' ruimtes en meld wat afwijkt; bij echt gevaar eerst 112.'
        : r === 'schoonmaak' ? 'begin bij de hal (het visitekaartje) en vink elke ruimte af; extra werk meld je met een tik.'
        : r === 'bode' ? 'zet de zalen van vandaag op volgorde van de rol klaar en meld ze gereed.'
        : 'meld elke bezoeker aan met een badge en schrijf ze bij vertrek uit; zo klopt de lijst altijd.') };
  }

  return { pdaZittingen, pdaKlaarzet, pdaAI };
};
