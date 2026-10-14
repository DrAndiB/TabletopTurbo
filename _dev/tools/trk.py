import math, sys, json
import numpy as np
def catmull(p0,p1,p2,p3,t,alpha=0.5):
    d=lambda a,b: max(math.hypot(b[0]-a[0],b[1]-a[1]),1e-4)**alpha
    t0=0;t1=t0+d(p0,p1);t2=t1+d(p1,p2);t3=t2+d(p2,p3)
    tt=t1+(t2-t1)*t
    def L(a,b,ta,tb): return [((tb-tt)/(tb-ta))*a[k]+((tt-ta)/(tb-ta))*b[k] for k in range(2)]
    A1=L(p0,p1,t0,t1);A2=L(p1,p2,t1,t2);A3=L(p2,p3,t2,t3)
    B1=L(A1,A2,t0,t2);B2=L(A2,A3,t1,t3)
    return L(B1,B2,t1,t2)
def build(pts):
    n=len(pts);dense=[]
    for i in range(n):
        p0,p1,p2,p3=pts[(i-1)%n],pts[i],pts[(i+1)%n],pts[(i+2)%n]
        seg=max(8,math.ceil(math.hypot(p2[0]-p1[0],p2[1]-p1[1])/0.25))
        for j in range(seg): dense.append(catmull(p0,p1,p2,p3,j/seg))
    d=np.array(dense)
    seglen=np.hypot(*(np.roll(d,-1,0)-d).T)
    cum=np.concatenate([[0],np.cumsum(seglen)])
    L=cum[-1]
    N=int(math.ceil(L/0.5)); s=np.arange(N)*L/N
    x=np.interp(s,cum,np.concatenate([d[:,0],[d[0,0]]])); z=np.interp(s,cum,np.concatenate([d[:,1],[d[0,1]]]))
    tx=np.roll(x,-1)-np.roll(x,1); tz=np.roll(z,-1)-np.roll(z,1); l=np.hypot(tx,tz); tx/=l; tz/=l
    ang=np.arctan2(tz,tx); da=np.roll(ang,-2)-np.roll(ang,2); da=(da+np.pi)%(2*np.pi)-np.pi
    curv=da/(4*L/N)
    return dict(L=L,x=x,z=z,tx=tx,tz=tz,curv=curv,ds=L/N,N=N)
if __name__=='__main__':
    pts=json.loads(open(sys.argv[1]).read())
    T=build(pts)
    print('length',round(T['L'],1),'N',T['N'])
    c=np.abs(T['curv']); i=np.argmax(c); print('min radius',round(1/c[i],1),'at',round(T['x'][i]),round(T['z'][i]))
    # local min radii
    rad=1/np.maximum(c,1e-6)
    for k in range(0,T['N'],1):
        pass
    # print tight spots
    tight=[(round(rad[k],1),round(T['x'][k]),round(T['z'][k]), round(k*T['ds'])) for k in range(T['N']) if rad[k]<14 and rad[k]<=rad[k-1] and rad[k]<=rad[(k+1)%T['N']]]
    print('tight',tight)
    # proximity: min dist between points more than 60 apart along track
    x,z=T['x'],T['z'];N=T['N'];ds=T['ds']
    P=np.stack([x,z],1)[::4]; M=len(P)
    best=[]
    for a in range(M):
        dd=np.hypot(*(P-P[a]).T)
        sep=np.abs(np.arange(M)-a)*4*ds; sep=np.minimum(sep,T['L']-sep)
        dd[sep<70]=1e9
        b=np.argmin(dd)
        if dd[b]<34: best.append((round(dd[b],1),round(P[a][0]),round(P[a][1]),round(a*4*ds)))
    print('close', best[:40])
    print('xrange',round(x.min()),round(x.max()),'zrange',round(z.min()),round(z.max()))
    import matplotlib; matplotlib.use('Agg'); import matplotlib.pyplot as plt
    fig,ax=plt.subplots(figsize=(12,7.5))
    ax.add_patch(plt.Rectangle((-170,-98),340,194,fill=False)); ax.add_patch(plt.Rectangle((-96,-98),16,40,fill=True,alpha=0.3))
    for zz in np.arange(-100,101,20): ax.axhline(zz,color="0.8",lw=0.5)
    nx,nz=-T['tz'],T['tx']
    w=7
    ax.plot(x+nx*w,z+nz*w,'k-',lw=0.6);ax.plot(x-nx*w,z-nz*w,'k-',lw=0.6);ax.plot(x,z,'r:',lw=0.5)
    for k in range(0,N,int(50/ds)): ax.text(x[k],z[k],str(int(k*ds)),fontsize=7,color='b')
    for p in pts: ax.plot(p[0],p[1],'g.',ms=4)
    for extra in (sys.argv[3:] if len(sys.argv)>3 else []): pass
    ax.set_xlim(-160,160);ax.set_ylim(100,-100);ax.set_aspect('equal');ax.grid(alpha=0.3)
    plt.savefig(sys.argv[2],dpi=90,bbox_inches='tight')
