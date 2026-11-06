(function(root){
'use strict';
const wrap=(i,n)=>(i%n+n)%n,clamp=(v,a,b)=>Math.max(a,Math.min(b,v));
function build(track,physics){
 const n=track.length,offset=new Float64Array(n),normals=track.map((p,i)=>{const a=track[wrap(i-1,n)],b=track[(i+1)%n],dx=b.x-a.x,dz=b.z-a.z,l=Math.hypot(dx,dz);return{x:dz/l,z:-dx/l};});
 // Minimise bending of a path within the usable track width. The broad
 // stencil creates outside/inside/outside transitions rather than a centreline.
 const x=new Float64Array(n),z=new Float64Array(n),next=new Float64Array(n),k=5;
 for(let pass=0;pass<650;pass++){
  for(let i=0;i<n;i++){x[i]=track[i].x+normals[i].x*offset[i];z[i]=track[i].z+normals[i].z*offset[i];}
  for(let i=0;i<n;i++){const a=wrap(i-2*k,n),b=wrap(i-k,n),c=(i+k)%n,d=(i+2*k)%n;
   const fx=-x[a]+4*x[b]-6*x[i]+4*x[c]-x[d],fz=-z[a]+4*z[b]-6*z[i]+4*z[c]-z[d];
   next[i]=clamp(offset[i]+.035*(fx*normals[i].x+fz*normals[i].z),-4.45,4.45);
  }
  for(let i=0;i<n;i++)offset[i]=.9*next[i]+.05*(next[wrap(i-1,n)]+next[(i+1)%n]);
 }
 // Remove short-wavelength wiggles left by the broad optimisation stencil.
 for(let pass=0;pass<90;pass++){for(let i=0;i<n;i++)next[i]=.5*offset[i]+.25*(offset[wrap(i-1,n)]+offset[(i+1)%n]);offset.set(next);}
 const points=track.map((p,i)=>({x:p.x+normals[i].x*offset[i],y:p.y,z:p.z+normals[i].z*offset[i]}));
 const distance=points.map((p,i)=>Math.hypot(p.x-points[(i+1)%n].x,p.z-points[(i+1)%n].z));
 const limits=points.map((p,i)=>{const a=points[wrap(i-3,n)],b=points[(i+3)%n];const ax=p.x-a.x,az=p.z-a.z,bx=b.x-p.x,bz=b.z-p.z;
  const curvature=2*Math.abs(ax*bz-az*bx)/Math.max(.001,Math.hypot(ax,az)*Math.hypot(bx,bz)*Math.hypot(b.x-a.x,b.z-a.z));
  const gripMargin=.82,den=curvature-gripMargin*.0032;
  return Math.min(physics.MAX,den>0?Math.sqrt(gripMargin*1.7*9.81/den):physics.MAX);
 });
 const speeds=Float64Array.from(limits),braking=physics.BRAKE*.85,accel=physics.ACCEL*.95;
 // Warning limits must not include the forward acceleration plan: a driver
 // may leave a corner faster than that plan without needing to slow down.
 const brakingSpeeds=Float64Array.from(limits);
 for(let pass=0;pass<2;pass++)for(let i=n-1;i>=0;i--)brakingSpeeds[i]=Math.min(brakingSpeeds[i],Math.sqrt(brakingSpeeds[(i+1)%n]**2+2*braking*distance[i]));
 for(let pass=0;pass<4;pass++){
  for(let i=n-1;i>=0;i--)speeds[i]=Math.min(speeds[i],Math.sqrt(speeds[(i+1)%n]**2+2*braking*distance[i]));
  for(let i=0;i<n;i++){const j=(i+1)%n;speeds[j]=Math.min(speeds[j],Math.sqrt(speeds[i]**2+2*accel*distance[i]));}
 }
 const cumulative=[0];for(const d of distance)cumulative.push(cumulative[cumulative.length-1]+d);const length=cumulative[n];
 const candidates=[];
 for(let i=0;i<n;i++){if(limits[i]>physics.MAX*.96)continue;let isMin=true;for(let d=-8;d<=8;d++)if(limits[wrap(i+d,n)]<limits[i]-1e-5){isMin=false;break;}if(isMin)candidates.push(i);}
 const apexes=[];candidates.sort((a,b)=>limits[a]-limits[b]);for(const i of candidates)if(apexes.every(j=>{const d=Math.abs(cumulative[i]-cumulative[j]);return Math.min(d,length-d)>95;}))apexes.push(i);apexes.sort((a,b)=>a-b);
 return{points,offset,normals,distance,limits,speeds,brakingSpeeds,braking,accel,cumulative,length,apexes,max:physics.MAX};
}
function guidance(line,index,speed){const n=line.points.length,i=wrap(index,n),allowed=line.brakingSpeeds[i],nearLimit=allowed<line.max-.5&&speed>allowed-1.5;let apex=-1,distance=Infinity;
 for(const j of line.apexes){let d=line.cumulative[j]-line.cumulative[i];if(d<-6)d+=line.length;if(d>=-6&&d<distance){distance=Math.max(0,d);apex=j;}}
 if(apex<0||distance>1400)return{action:speed>allowed+1?'BRAKE':nearLimit?'LIFT':'ACCELERATE',target:allowed,allowed,distance:Infinity,brakeIn:Infinity,apex:-1};
 const target=line.limits[apex],brakeDistance=Math.max(0,(speed*speed-target*target)/(2*line.braking))+Math.max(0,speed-target)*.35;
 const brakeIn=distance-brakeDistance;
 const action=speed>allowed+1||(speed>target+1&&brakeIn<=0)?'BRAKE':nearLimit||(speed>target+1&&brakeIn<Math.min(45,speed*.6))?'LIFT':'ACCELERATE';
 return{action,target,allowed,distance,brakeIn,apex};
}
function signal(speed,allowed,max=Infinity){if(allowed>=max-.01)return'green';return speed>allowed+1?'red':speed>allowed-2.5?'yellow':'green';}
const api={build,guidance,signal};if(typeof module!=='undefined')module.exports=api;else root.RacingLine=api;
})(typeof window==='undefined'?globalThis:window);
