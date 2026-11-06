(function(root){
'use strict';
const clamp=(v,a,b)=>Math.max(a,Math.min(b,v)),wrap=(s,l)=>(s%l+l)%l;
function brakingLead(difficulty){return .7-(clamp(difficulty,1,100)-1)/99*.65;}
function seeded(seed){return()=>{seed=(1664525*seed+1013904223)>>>0;return seed/4294967296;};}
function pose(track,s,offset,length=7004){const u=wrap(s,length)/length*track.length,i=Math.floor(u),t=u-i,a=track[i],b=track[(i+1)%track.length],dx=b.x-a.x,dz=b.z-a.z,l=Math.hypot(dx,dz);return{x:a.x+(b.x-a.x)*t+dz/l*offset,y:a.y+(b.y-a.y)*t,z:a.z+(b.z-a.z)*t-dx/l*offset,heading:Math.atan2(dx,dz),grade:(b.y-a.y)/l,index:i};}
function project(track,x,z,length=7004,hint=null){let best={d:Infinity};const n=track.length;function test(i){i=(i%n+n)%n;const a=track[i],b=track[(i+1)%n],dx=b.x-a.x,dz=b.z-a.z,l2=dx*dx+dz*dz,t=clamp(((x-a.x)*dx+(z-a.z)*dz)/l2,0,1),px=a.x+t*dx,pz=a.z+t*dz,d=Math.hypot(x-px,z-pz);if(d<best.d)best={d,index:i,s:((i+t)/n*length)%length,offset:((x-px)*dz-(z-pz)*dx)/Math.sqrt(l2)};}
 if(hint!==null){for(let i=hint-22;i<=hint+22;i++)test(i);}if(hint===null||best.d>32)for(let i=0;i<n;i++)test(i);return best;
}
function create(track,line,config,physics,random=Math.random){
 const length=7004,n=track.length,step=length/n,drivers=[],baseLead=brakingLead(config.aiDifficulty),hold=2+random()*2;
 const state={phase:'wait',elapsed:0,raceTime:0,hold,goTime:7+hold,lightsVisible:false,redLights:0,drivers,passes:0,player:null,contacts:0};
 function sampled(values,s){const u=wrap(s,length)/length*n,i=Math.floor(u),t=u-i;return values[i]+(values[(i+1)%n]-values[i])*t;}
 const names=['A. Moreau','L. Hart','M. Costa','E. Sato','N. Weber','T. Laurent','R. Silva','J. Novak','D. Rossi','K. Andersen','S. Park','I. Martin','V. Eriksen','C. Bennett','O. Diaz','F. Meyer','H. Clarke','P. Dubois','G. Marino'];
 let id=0;
 for(let grid=1;grid<=20;grid++){
  if(grid===config.gridPosition)continue;const variation=random()*2-1,cornerFactor=1+(random()-.5)*.03,limits=Float64Array.from(line.limits,v=>Math.min(physics.MAX,v*cornerFactor)),envelope=Float64Array.from(limits);
  for(let pass=0;pass<2;pass++)for(let i=n-1;i>=0;i--)envelope[i]=Math.min(envelope[i],Math.sqrt(envelope[(i+1)%n]**2+2*physics.BRAKE*step));
  drivers.push({id:id++,name:names[id-1],grid,s:-grid*8,v:0,offset:grid%2?-3:3,gridOffset:grid%2?-3:3,offsetVelocity:0,brakeLead:clamp(baseLead+variation*.022,.028,.73),accel:physics.ACCEL*(.985+random()*.03),reaction:.14+random()*.20,cornerFactor,limits,envelope,passing:null,nextPass:22+random()*35,decisionAt:0,finishTime:null,braking:false,completedLaps:0});
 }
 for(const d of drivers){const human=config.humans?.find(h=>h.grid===d.grid);if(human){d.external=true;d.peerId=human.id;d.name=human.name;}else d.peerId='ai-'+d.grid;}
 const player={id:'player',name:'YOU',grid:config.gridPosition,s:-config.gridPosition*8,wrapped:length-config.gridPosition*8,v:0,offset:config.gridPosition%2?-3:3,d:3,index:Math.floor((length-config.gridPosition*8)/step),finishTime:null,completedLaps:0,finished:false};state.player=player;
 function gridPhase(){if(state.elapsed<2){state.phase='wait';state.lightsVisible=false;state.redLights=0;}else if(state.elapsed<7){state.phase='lights';state.lightsVisible=true;state.redLights=clamp(Math.floor(state.elapsed-2+1e-8),0,5);}else if(state.elapsed<state.goTime){state.phase='hold';state.lightsVisible=true;state.redLights=5;}else{state.phase='racing';state.lightsVisible=false;state.redLights=0;}}
 function updatePlayer(car){if(!car||state.phase!=='racing'||player.finished)return;const p=project(track,car.x,car.z,length,player.index);let delta=p.s-player.wrapped;if(delta>length/2)delta-=length;if(delta<-length/2)delta+=length;if(Math.abs(delta)<120){player.s+=delta;}player.wrapped=p.s;player.index=p.index;player.offset=p.offset;player.d=p.d;player.v=car.v;player.completedLaps=Math.max(0,Math.floor(player.s/length));if(player.s>=config.laps*length){player.finished=true;player.finishTime=state.raceTime;if(!config.multiplayer)state.phase='finished';state.lightsVisible=false;}}
 function physicalGap(a,b){return wrap(b.s-a.s,length);}
 function ahead(driver,field){let leader=null,gap=Infinity;for(const other of field){if(other===driver||other.finishTime!==null&&other.s>config.laps*length+300||other.id==='player'&&other.d>7)continue;const d=physicalGap(driver,other);if(d>0&&d<gap&&Math.abs(driver.offset-other.offset)<2.2){gap=d;leader=other;}}return{leader,gap};}
 function laneFree(driver,lane,field){return field.every(other=>other===driver||other.id==='player'&&other.d>7||Math.abs(wrap(other.s-driver.s+length/2,length)-length/2)>22||Math.abs(other.offset-lane)>2.25);}
 function stepAI(dt){const field=[...drivers,player];
  for(const d of drivers){if(d.external||config.remoteAI)continue;if(d.finishTime!==null){d.v=Math.max(28,d.v-3*dt);d.s+=d.v*dt;continue;}if(state.raceTime<d.reaction)continue;
   const index=Math.floor(wrap(d.s,length)/length*n),localLimit=sampled(d.limits,d.s),lookahead=d.v*d.brakeLead;let target=Math.min(localLimit,sampled(d.envelope,d.s+lookahead));
   const traffic=ahead(d,field);let desiredOffset=clamp(line.offset[index]*.78,-3.6,3.6);const launch=clamp((d.s+d.grid*8)/170,0,1);desiredOffset=d.gridOffset*(1-launch)+desiredOffset*launch;
   if(d.passing){const other=field.find(x=>x.id===d.passing.id);if(!other||wrap(d.s-other.s+length/2,length)-length/2>10||state.raceTime-d.passing.started>14){if(other&&d.s>other.s)state.passes++;d.passing=null;d.nextPass=state.raceTime+35+random()*30;}else desiredOffset=d.passing.lane;}
   if(!d.passing&&state.raceTime>=d.decisionAt){d.decisionAt=state.raceTime+.6;if(state.raceTime>d.nextPass&&localLimit>38&&traffic.leader&&traffic.gap>5.6&&traffic.gap<48&&target>traffic.leader.v+.45){const lanes=traffic.leader.offset>=0?[-3.7,3.7]:[3.7,-3.7];const lane=lanes.find(x=>Math.abs(x-traffic.leader.offset)>2.5&&laneFree(d,x,field));if(lane!==undefined){d.passing={id:traffic.leader.id,lane,started:state.raceTime};desiredOffset=lane;}else d.nextPass=state.raceTime+3;}}
   if(traffic.leader&&traffic.gap<100){const following=Math.max(0,traffic.leader.v+(traffic.gap-(6.4+d.v*.27))*.85);target=Math.min(target,following);if(!d.passing&&traffic.gap<18)desiredOffset=d.offset;}
   const oldOffset=d.offset,maxLateral=1.05*dt;d.offset+=clamp(desiredOffset-d.offset,-maxLateral,maxLateral);d.offset=clamp(d.offset,-4.55,4.55);d.offsetVelocity=(d.offset-oldOffset)/dt;
   d.braking=d.v>target+.15;d.v=clamp(d.v+(d.braking?-Math.min(physics.BRAKE*dt,d.v-target):Math.min(d.accel*dt,Math.max(0,target-d.v))),0,physics.MAX);const oldS=d.s;d.s+=d.v*dt;d.completedLaps=Math.max(0,Math.floor(d.s/length));if(oldS<config.laps*length&&d.s>=config.laps*length)d.finishTime=state.raceTime-dt+(config.laps*length-oldS)/Math.max(.01,d.v);
  }
  // Longitudinal separation stops traffic from driving through another car.
  for(let i=0;i<drivers.length;i++)for(let j=i+1;j<drivers.length;j++){const a=drivers[i],b=drivers[j];let ds=wrap(b.s-a.s+length/2,length)-length/2;if(Math.abs(ds)<5.65&&Math.abs(a.offset-b.offset)<2.05){const rear=ds>=0?a:b,front=ds>=0?b:a;if(rear.external||config.remoteAI)continue;rear.s-=5.65-Math.abs(ds);rear.v=Math.min(rear.v,front.v*.98);}}
  if(player.d<7&&!player.finished)for(const d of drivers){if(d.external||config.remoteAI)continue;const ds=wrap(player.s-d.s+length/2,length)-length/2;if(ds>=0&&ds<5.5&&Math.abs(d.offset-player.offset)<2.05){d.s-=5.5-ds;d.v=Math.min(d.v,Math.max(0,player.v*.97));}}
 }
 let accumulator=0;
 function advance(dt,car){dt=clamp(dt,0,.1);if(state.phase==='finished')return;state.elapsed+=dt;if(state.phase!=='racing'){gridPhase();if(state.phase!=='racing')return;}state.raceTime=Math.max(0,state.elapsed-state.goTime);updatePlayer(car);if(state.phase==='finished')return;accumulator+=dt;while(accumulator>=1/120){stepAI(1/120);accumulator-=1/120;}}
 function standings(){return [...drivers,player].sort((a,b)=>{if(a.finishTime!==null&&b.finishTime!==null)return a.finishTime-b.finishTime;if(a.finishTime!==null)return-1;if(b.finishTime!==null)return 1;return b.s-a.s||a.grid-b.grid;});}
 function contact(car){if(state.phase!=='racing'||player.finished)return;for(const d of drivers){if(d.s>config.laps*length+300)continue;const p=pose(track,d.s,d.offset,length),fx=Math.sin(p.heading),fz=Math.cos(p.heading),rx=fz,rz=-fx,dx=car.x-p.x,dz=car.z-p.z,along=dx*fx+dz*fz,side=dx*rx+dz*rz;if(Math.abs(along)<4.7&&Math.abs(side)<1.95){if(4.7-Math.abs(along)<1.95-Math.abs(side)){const push=(along>=0?1:-1)*(4.72-Math.abs(along));car.x+=fx*push;car.z+=fz*push;if(along<0)car.v=Math.min(car.v,d.v*.96);}else{const push=(side>=0?1:-1)*(1.97-Math.abs(side));car.x+=rx*push;car.z+=rz*push;car.v*=.99;}state.contacts++;}}
 }
 return{state,advance,standings,contact,pose:d=>pose(track,d.s,d.offset,length),brakingLead:baseLead};
}
const api={create,brakingLead,pose,project,seeded};if(typeof module!=='undefined')module.exports=api;else root.RaceCore=api;
})(typeof window==='undefined'?globalThis:window);
