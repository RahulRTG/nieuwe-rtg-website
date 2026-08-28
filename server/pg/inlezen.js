/* PostgreSQL-opslag, deel "inlezen": de LEESKANT van de gedeelde staat.

   Afgesplitst uit ./sync.js, dat daarmee over de tien kilobyte ging en -- de
   echte reden -- twee onderwerpen droeg. Schrijven en inlezen zijn elkaars
   spiegelbeeld maar hebben niets met elkaar te maken: de schrijfkant beslist
   wat er weg moet en in welke volgorde, de leeskant haalt op wat een ANDER
   proces heeft geschreven. Ze delen alleen de staat-maps uit de context. */

module.exports = (ctx) => {
  const { pool, merge3, uitStore, toegepast, laatsteJson } = ctx;

  /* Haal collecties op die een ander proces sinds onze laagst-toegepaste versie
     schreef en werk db.data bij (met merge als wij lokaal iets openstaan hebben).
     Wordt getriggerd door NOTIFY en als vangnet ook periodiek. */
  async function haalNieuwer(dataNu, opSessieWijziging) {
    let laagst = 0;
    for (const v of toegepast.values()) if (v < laagst || laagst === 0) laagst = v;
    // Eerst alleen key+ver: de drempel is de LAAGSTE toegepaste versie over alle
    // collecties, dus deze lijst bevat ook collecties die we allang hebben. Met
    // "val" erbij zou elke poll (elke 2 s) de volledige blobs van alle sinds de
    // start herschreven collecties (op mega-schaal tientallen MB's) over de lijn
    // trekken om ze hieronder meestal over te slaan; dat vrat geheugen en band-
    // breedte. Nu halen we de blob alleen op voor wat echt nieuw voor ons is.
    const { rows } = await pool.query('SELECT key, ver FROM kv WHERE ver > $1', [laagst]);
    let sessie = false;
    for (const r of rows) {
      if (Number(r.ver) <= (toegepast.get(r.key) || 0)) continue;
      // De blob apart ophalen, MET zijn eigen versienummer: tussen de lijst-query
      // en deze fetch kan een ander proces alweer geschreven hebben, en dan zou
      // het lijst-versienummer achterlopen op de inhoud die we toepassen.
      const vr = await pool.query('SELECT val, ver, weg FROM kv WHERE key = $1', [r.key]);
      if (!vr.rows.length) continue;
      const ver = Number(vr.rows[0].ver);
      if (ver <= (toegepast.get(r.key) || 0)) continue;
      /* Een GRAFSTEEN: een ander proces heeft deze collectie bewust gewist. Hier
         toepassen en niet mergen -- anders zet deze node hem bij de volgende
         flush gewoon weer terug, en is het wissen alleen gelukt op de machine
         waar het commando toevallig liep (TAKEN.md 4.38). */
      if (vr.rows[0].weg) {
        delete dataNu[r.key];
        laatsteJson.delete(r.key);
        toegepast.set(r.key, ver);
        continue;
      }
      const baseJson = laatsteJson.get(r.key);
      const hunJson = uitStore(vr.rows[0].val);
      const lokaalOpen = baseJson !== undefined && JSON.stringify(dataNu[r.key]) !== baseJson;
      if (lokaalOpen) {
        dataNu[r.key] = merge3(JSON.parse(baseJson), dataNu[r.key], JSON.parse(hunJson));
      } else {
        dataNu[r.key] = JSON.parse(hunJson);
        laatsteJson.set(r.key, hunJson);
      }
      toegepast.set(r.key, ver);
      if (r.key === 'sessions') sessie = true;
    }
    if (sessie && opSessieWijziging) opSessieWijziging();
    return rows.length;
  }

  return { haalNieuwer };
};
