(function(root){
'use strict';
// Approximate Spa elevation anchors. Interpolate a continuous grade instead of
// forcing the gradient back to zero at every intermediate point on a straight.
const anchors=[[0,414],[.043,430],[.145,384],[.19,430],[.325,466],[.405,432],[.565,388],[.69,373],[.795,386],[.945,410],[1,414]];
function create(profile=anchors){
 const n=profile.length-1,h=[],d=[],m=[];
 for(let i=0;i<n;i++){h[i]=profile[i+1][0]-profile[i][0];d[i]=(profile[i+1][1]-profile[i][1])/h[i];}
 for(let i=0;i<n;i++){const prev=(i+n-1)%n,a=d[prev],b=d[i],w1=2*h[i]+h[prev],w2=h[i]+2*h[prev];m[i]=a*b<=0?0:(w1+w2)/(w1/a+w2/b);}m[n]=m[0];
 function height(t){t=(t%1+1)%1;let i=0;while(i<n-1&&t>profile[i+1][0])i++;const u=(t-profile[i][0])/h[i],u2=u*u,u3=u2*u;return(2*u3-3*u2+1)*profile[i][1]+(u3-2*u2+u)*h[i]*m[i]+(-2*u3+3*u2)*profile[i+1][1]+(u3-u2)*h[i]*m[i+1]-400;}
 return{height,anchors:profile};
}
const api={create,anchors};if(typeof module!=='undefined')module.exports=api;else root.Elevation=api;
})(typeof window==='undefined'?globalThis:window);
