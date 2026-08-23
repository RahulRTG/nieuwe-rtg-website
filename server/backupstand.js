/* ============================================================================
   IS ER EEN BACK-UP -- en dan de echte vraag: staat er ook iets IN?

   HET GAT DAT DIT DICHT. Twee plekken besloten "er is een dagback-up" op grond
   van EEN DING: dat er een map bestaat die YYYY-MM-DD heet. De BAK-01-check in
   server/techniek.js deed het zo, en de bewering "Dagelijkse back-up" in de
   tenantstand ook. Een lege map leest dan als groen. Een backup die halverwege
   afbrak leest als groen. Een db.json van nul bytes leest als groen.

   Dat is precies de vorm waar de hele bewijslaag tegen is: een bewering
   waarvan het enige bewijs is dat er iets STAAT dat eruitziet als bewijs. De
   naam van een map is geen back-up.

   WAT ER NU WORDT NAGEKEKEN, en niet meer dan dat:

   1. Elk bestand dat in de LEVENDE datamap staat en op de backuplijst hoort,
      staat ook in de backup, en is niet leeg -- behalve de -wal-bestanden, want
      een leeg write-ahead-log is na een checkpoint de GEZONDE toestand.
      Vergelijken met de levende map en niet met de volle lijst: store.db en
      grootboek.db bestaan alleen in sommige opstellingen, en een backup
      verwijten dat hij iets mist wat nergens bestaat, is een vals alarm dat
      mensen leren negeren.
   2. db.json opent en is een object. Dat is de goedkoopste controle die het
      verschil ziet tussen "een bestand van 40 MB" en "een bestand van 40 MB
      dat halverwege is afgekapt".

   WAT ER NIET WORDT NAGEKEKEN, en dat hoort erbij te staan: of de inhoud KLOPT
   (daar is een terugzetproef voor, en die is er niet -- zie kern/tenant/
   bewijs-sla.js), of de sqlite-bestanden openen, en of de tweede kopie op
   RTG_BACKUP_DIR er is. Dit is een aanwezigheidscontrole met tanden, geen
   herstelproef, en het mag ook niet voor het tweede doorgaan.
   ========================================================================== */
'use strict';

const fs = require('fs');
const path = require('path');

const DAG = /^\d{4}-\d{2}-\d{2}$/;

function lees(datadir) {
  const map = path.join(datadir, 'backups');
  if (!fs.existsSync(map)) return { er: false, reden: 'er is nog geen back-upmap; de eerste draait bij de volgende start' };
  let dagen;
  try {
    dagen = fs.readdirSync(map).filter(n => DAG.test(n) &&
      (() => { try { return fs.statSync(path.join(map, n)).isDirectory(); } catch (e) { return false; } })()).sort();
  } catch (e) { return { er: false, reden: 'de back-upmap is niet te lezen (' + e.message + ')' }; }
  if (!dagen.length) return { er: false, reden: 'er staat geen enkele dagback-up in de map' };

  const dag = dagen[dagen.length - 1];
  const dir = path.join(map, dag);
  const ouderdom = Math.floor((Date.now() - Date.parse(dag)) / 86400000);
  return Object.assign({ er: true, dag, ouderdom, bewaard: dagen.length }, inhoud(datadir, dir));
}

/* De vergelijking: alles wat LEEFT en op de lijst staat, hoort er ook te zijn. */
function inhoud(datadir, dir) {
  let lijst;
  /* Dezelfde lijst die de backup SCHRIJFT (./opzet/backup-lijst.js). Hem hier
     opnieuw intypen zou de bekende fout zijn: twee lijsten van hetzelfde lopen
     uiteen zodra iemand er een aanraakt, en zo viel grootboek.db ooit buiten de
     backup. Lukt lezen niet, dan is er geen oordeel -- `compleet: null` en de
     reden, want een meter zonder invoer zakt (LAT-regel 3). */
  try { lijst = { bestanden: require('./opzet/backup-lijst').BACKUP_BESTANDEN }; }
  catch (e) { return { compleet: null, reden: 'de backuplijst is niet te lezen (' + e.message + '); zonder die lijst valt er niets te vergelijken' }; }

  const mist = [];
  const leeg = [];
  let gezien = 0;
  for (const naam of lijst.bestanden) {
    const bron = path.join(datadir, naam);
    if (!fs.existsSync(bron)) continue;                 // bestaat hier niet, dus geen verwijt
    gezien++;
    const kopie = path.join(dir, naam);
    if (!fs.existsSync(kopie)) { mist.push(naam); continue; }
    /* EEN LEGE -wal IS DE GEZONDE TOESTAND en geen kapotte backup: na een
       checkpoint is het write-ahead-log leeg, en dat is precies wat de backup
       vlak voor het kopieren doet. Deze regel is er omdat de eerste versie van
       dit bestand meteen drie lege wal-bestanden als kapot meldde -- een vals
       alarm dat mensen leren negeren, en dan is de hele meter waardeloos. */
    if (naam.endsWith('-wal')) continue;
    let n = 0;
    try { n = fs.statSync(kopie).size; } catch (e) { n = 0; }
    if (n === 0) leeg.push(naam);
  }

  /* db.json is de enige die we goedkoop kunnen OPENEN, en juist daar zie je het
     verschil tussen een groot bestand en een afgekapt groot bestand. */
  let jsonFout = null;
  const dbKopie = path.join(dir, 'db.json');
  if (fs.existsSync(dbKopie)) {
    try {
      const o = JSON.parse(fs.readFileSync(dbKopie, 'utf8'));
      if (!o || typeof o !== 'object') jsonFout = 'db.json in de back-up is geen object';
    } catch (e) { jsonFout = 'db.json in de back-up opent niet: ' + e.message; }
  }

  const stuk = mist.length || leeg.length || jsonFout;
  return {
    gecontroleerd: gezien, mist, leeg, jsonFout,
    compleet: !stuk,
    reden: stuk
      ? [mist.length ? 'mist ' + mist.join(', ') : null,
        leeg.length ? 'leeg: ' + leeg.join(', ') : null, jsonFout].filter(Boolean).join('; ')
      : gezien + ' bestand(en) aanwezig en niet leeg, db.json opent'
  };
}

module.exports = { lees, inhoud, DAG };
