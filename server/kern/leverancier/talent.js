/* Anonieme Talent Exchange-kaarten voor de werkgever. Persoonsgegevens en
   de interne RTF-verwijzing blijven bewust buiten de supplier state. */
module.exports = (db) => function talentMatches(supplierCode) {
  return (Array.isArray(db.data.talentInteresses) ? db.data.talentInteresses : [])
    .filter(x => x.supplierCode === supplierCode && x.status !== 'afgewezen' && x.status !== 'traject')
    .slice(0, 40)
    .map(x => ({
      id: x.id, vacatureId: x.vacatureId, func: x.func, status: x.status, at: x.at,
      headline: x.talent && x.talent.headline || '',
      skills: x.talent && x.talent.skills || [],
      experienceCount: x.talent && x.talent.experienceCount || 0
    }));
};
