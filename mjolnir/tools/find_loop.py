"""Find the most seamless loop in a recording: python3 tools/find_loop.py TRACK.mp3 FROM TO MINLEN MAXLEN

Compares 6 s of spectrum and loudness around every pair of points between FROM and TO seconds, takes the
most alike pair and lines its end up on the beat. Prints start and loop length for SEAMS in build_music.py.
"""
import numpy as np, subprocess, sys
SR=22050; hop=512; N=2048
def load(p,sr=SR):
    raw=subprocess.run(['ffmpeg','-v','error','-i',p,'-ac','1','-ar',str(sr),'-f','f32le','-'],capture_output=True,check=True).stdout
    return np.frombuffer(raw,np.float32)
p=sys.argv[1]; lo,hi,mn,mx=map(float,sys.argv[2:6])
x=load(p)
fr=np.array([np.abs(np.fft.rfft(x[i:i+N]*np.hanning(N)))[:400] for i in range(0,len(x)-N,hop)])
bands=np.logspace(np.log10(2),np.log10(399),40).astype(int)
F=np.array([np.log1p(fr[:,bands[i]:max(bands[i]+1,bands[i+1])].mean(1)) for i in range(len(bands)-1)]).T
r=np.log1p(fr.sum(1)); fps=SR/hop; W=int(3*fps)
FT=np.array([np.concatenate([F[i-W:i+W].ravel(),3*r[i-W:i+W]]) if W<=i<len(F)-W else np.zeros(1) for i in range(len(F))],dtype=object)
best=(9,0,0)
for a in range(max(W,int(lo*fps)), int((hi-mn)*fps), 3):
    fa=FT[a]
    for b in range(a+int(mn*fps), min(int(hi*fps), a+int(mx*fps), len(F)-W), 2):
        d=np.mean((fa-FT[b])**2)
        if d<best[0]: best=(d,a/fps,b/fps)
d,a,b=best
# refine b on the beat with a fine loudness envelope
SR2=44100; y=load(p,SR2); h=64
env=np.sqrt(np.convolve(y**2,np.ones(512)/512,'same'))[::h]
A=int(a*SR2/h); Wd=int(2*SR2/h); ref=env[A-Wd:A+Wd]; ref=(ref-ref.mean())/ref.std()
bb=max(range(int((b-.35)*SR2/h),int((b+.35)*SR2/h)), key=lambda k: (lambda c:(ref*(c-c.mean())/c.std()).mean())(env[k-Wd:k+Wd]))
print('%s score %.3f start %.3f len %.4f'%(p.split('/')[-1], d, a, bb*h/SR2-a))
