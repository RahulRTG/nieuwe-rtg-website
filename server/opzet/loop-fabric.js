'use strict';

module.exports=(kern,hulp)=>{
  kern.workLoopSource=require('../bedrijf/loop-source')({leesCollectie:hulp.leesCollectie,bewerkCollectie:hulp.bewerkCollectie,serviceProof:hulp.zegel});
  const educationReleaseToets=(releaseRef,academyOrganization,academyContext)=>kern.library.education.resolve({
    releaseRef,academyOrganization,academyContext});
  const leerhuis=require('../kern/leerhuis').maakLeerhuis({db:hulp.db,save:hulp.save,educationReleaseToets});
  const academyLoopSource=require('../kern/leerhuis/loop-source')({leesCollectie:hulp.leesCollectie,bewerkCollectie:hulp.bewerkCollectie,leerhuis,serviceProof:hulp.zegel});
  kern.loopFabric=require('../kern/loop-fabric')({db:hulp.db,bewerkCollectie:hulp.bewerkCollectie,
    livingWorld:kern.livingWorld,workSource:kern.workLoopSource,academySource:academyLoopSource,
    librarySource:kern.library.loopSource});
};
