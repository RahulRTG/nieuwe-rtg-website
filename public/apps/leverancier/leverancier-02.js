/* de sector van een zaak bepalen */
    if (!sup) return null;
    for (const k of Object.keys(SECTOR_DEF)){
      if (!SECTOR_DEF[k].legacy && SECTOR_DEF[k].codes.includes(sup.code)) return k;
    }
    const t = String(sup.type || '').toLowerCase();
    const k2 = TYPE2SECTOR[t] || t;
    return (SECTOR_DEF[k2] && !SECTOR_DEF[k2].legacy) ? k2 : null;
  }
  function naarEigenSector(sup){
    const doel = sectorVan(sup);
    if (!doel || SECTOR === doel) return false;
