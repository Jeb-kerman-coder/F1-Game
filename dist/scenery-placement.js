(function(root){
'use strict';
function clear(track,placement,bounds,margin=18){
 const c=Math.cos(placement.angle),s=Math.sin(placement.angle),minX=bounds.minX-margin,maxX=bounds.maxX+margin,minZ=bounds.minZ-margin,maxZ=bounds.maxZ+margin;
 function local(p){const dx=p.x-placement.x,dz=p.z-placement.z;return{x:c*dx-s*dz,z:s*dx+c*dz};}
 let a=local(track[track.length-1]);
 for(const point of track){const b=local(point);let lo=0,hi=1;
  for(const [start,delta,min,max]of[[a.x,b.x-a.x,minX,maxX],[a.z,b.z-a.z,minZ,maxZ]]){
   if(Math.abs(delta)<1e-10){if(start<min||start>max){hi=-1;break;}}
   else{let t0=(min-start)/delta,t1=(max-start)/delta;if(t0>t1)[t0,t1]=[t1,t0];lo=Math.max(lo,t0);hi=Math.min(hi,t1);if(lo>hi)break;}
  }
  if(lo<=hi)return false;a=b;
 }
 return true;
}
function place(track,index,preferredOffset,bounds){const n=track.length,p=track[index],a=track[(index+n-1)%n],b=track[(index+1)%n],dx=b.x-a.x,dz=b.z-a.z,length=Math.hypot(dx,dz),rx=dz/length,rz=-dx/length,angle=Math.atan2(dx,dz),sign=Math.sign(preferredOffset)||1;
 for(const side of[sign,-sign])for(let distance=Math.max(32,Math.abs(preferredOffset));distance<=640;distance+=8){const result={x:p.x+rx*distance*side,y:p.y,z:p.z+rz*distance*side,angle,offset:distance*side};if(clear(track,result,bounds))return result;}
 throw new Error('No clear trackside scenery position found');
}
const api={clear,place};if(typeof module!=='undefined')module.exports=api;else root.SceneryPlacement=api;
})(typeof window==='undefined'?globalThis:window);
