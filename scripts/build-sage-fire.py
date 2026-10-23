# Builds assets/images/sage/fire-{red,blue,green}-loop.webp (dev tool, not part of the app).
# Keyframe 1 ships with the app (the Reduce Motion still); keyframes 2-8 are source art only and
# live in art-source/sage/ so nothing under assets/ is unused.
# Usage: pip install opencv-python-headless numpy pillow && python scripts/build-sage-fire.py [steps] [red blue green]
# (no colours = all three).
#
# Smooth in-between flame frames from the 8 aligned Sage fire keyframes.
# The solid body of the flame morphs as a shape (signed-distance blend after optical-flow
# alignment), so in-betweens stay crisp instead of showing see-through "ghost" doubles; colour
# and the soft outer fringe are flow-warped and blended. Flow comes from the red frames and is
# reused for teal, so both colours stay frame-for-frame in sync.
# Green (Bard) has no drawn frames: it is the red fire recoloured frame by frame (see green()),
# so it moves exactly like the red one.
import cv2, numpy as np, os, sys
from PIL import Image
ROOT=os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
SRC=os.path.join(ROOT,'assets/images/sage')
ART=os.path.join(ROOT,'art-source/sage')
OUT=os.path.join(ROOT,'.cache/sage-fire-frames')
STEPS=int(sys.argv[1]) if len(sys.argv)>1 else 9
BUILD=sys.argv[2:] or ['red','blue','green']
def bleed(rgb, a):
    # Spread colour into transparent pixels so warped colour is defined everywhere.
    out=rgb.copy(); w=(a>0.02).astype(np.float32)
    acc=rgb*w[...,None]; ww=w.copy()
    for k in [3,7,15,31,63,127]:
        bacc=cv2.GaussianBlur(acc,(0,0),k); bw=cv2.GaussianBlur(ww,(0,0),k)
        fill=(w<0.5)&(bw>1e-3)
        out[fill]=(bacc[fill]/bw[fill][:,None])
        w=np.maximum(w,(bw>1e-3).astype(np.float32)); acc=out*w[...,None]; ww=w.copy()
    return out
def sdf(core):
    m=core.astype(np.uint8)
    return (cv2.distanceTransform(1-m,cv2.DIST_L2,5)-cv2.distanceTransform(m,cv2.DIST_L2,5)).astype(np.float32)
def load(c,i):
    f=np.array(Image.open(f'{SRC if i==1 else ART}/fire-{c}-{i}@3x.png').convert('RGBA')).astype(np.float32)/255
    a=f[...,3]; core=a>0.5
    return dict(rgb=bleed(f[...,:3],a), a=a, sdf=sdf(core), fringe=np.where(core,0,a))
keys={c:[load(c,i) for i in range(1,9)] for c in ['red','blue'] if c=='red' or c in BUILD}
H,W=keys['red'][0]['a'].shape
# Red -> magical green. The red art runs from deep red (hue ~8 deg: outer flame and smoke) to
# orange-gold (~34 deg: the hot tips). That range maps to emerald (150 deg) .. green-gold (70 deg),
# keeping all the painted shading; saturation and value are nudged so it glows rather than goes muddy.
def green(rgb):
    # Float HSV (hue in degrees): 8-bit hue steps would band once the hue range is stretched.
    hsv=cv2.cvtColor(np.clip(rgb,0,1).astype(np.float32),cv2.COLOR_RGB2HSV)
    h=hsv[...,0]; h=np.where(h>300,h-360,h)
    t=np.clip((h-8)/(34-8),-0.3,1.3)
    hsv[...,0]=(150+(70-150)*t)%360
    hsv[...,1]=np.clip(hsv[...,1]*0.95,0,1); hsv[...,2]=np.clip(hsv[...,2]*1.04,0,1)
    return cv2.cvtColor(hsv,cv2.COLOR_HSV2RGB)
def guide(k):  # smooth shape field for the flow to track (handles big sways well)
    return (np.clip(0.5-k['sdf']/40,0,1)*255).astype(np.uint8)
def flow(a,b):
    return cv2.calcOpticalFlowFarneback(guide(a),guide(b),None,0.5,6,61,8,7,1.5,cv2.OPTFLOW_FARNEBACK_GAUSSIAN)
gx,gy=np.meshgrid(np.arange(W,dtype=np.float32),np.arange(H,dtype=np.float32))
def warp(img,f,t,border):
    return cv2.remap(img,gx-t*f[...,0],gy-t*f[...,1],cv2.INTER_LINEAR,borderMode=cv2.BORDER_REPLICATE if border else cv2.BORDER_CONSTANT,borderValue=0)
for c in BUILD: os.makedirs(f'{OUT}/{c}',exist_ok=True)
if 'green' in BUILD:  # the Reduce Motion still for Bard: red keyframe 1, recoloured
    k=keys['red'][0]; still=np.concatenate([green(k['rgb']),k['a'][...,None]],-1)
    # Saved as RGBA; the shipped file is then palette-reduced like the other stills
    # (pip install imagequant pyoxipng: imagequant.quantize_pil_image, then oxipng level 4).
    Image.fromarray((still*255+0.5).astype(np.uint8),'RGBA').save(f'{SRC}/fire-green-1@3x.png',optimize=True)
n=0
for i in range(8):
    j=(i+1)%8; fab=flow(keys['red'][i],keys['red'][j]); fba=flow(keys['red'][j],keys['red'][i])
    for s in range(STEPS):
        t=s/STEPS; w=t*t*(3-2*t)
        for c in keys:
            A=keys[c][i]; B=keys[c][j]
            sd=(1-w)*warp(A['sdf'],fab,t,1)+w*warp(B['sdf'],fba,1-t,1)
            core=np.clip(0.5-sd/1.2,0,1)  # crisp antialiased edge
            fr=(1-w)*warp(A['fringe'],fab,t,0)+w*warp(B['fringe'],fba,1-t,0)
            aA=warp(A['a'],fab,t,0)*(1-w); aB=warp(B['a'],fba,1-t,0)*w
            rgb=(warp(A['rgb'],fab,t,1)*(aA+1e-3)[...,None]+warp(B['rgb'],fba,1-t,1)*(aB+1e-3)[...,None])/(aA+aB+2e-3)[...,None]
            al=np.maximum(core,np.where(core>0.99,0,fr))
            if s==0:  # keyframes exactly as drawn
                al=A['a']; rgb=A['rgb']
            for name in ([c] if c in BUILD else [])+(['green'] if c=='red' and 'green' in BUILD else []):
                out=np.concatenate([np.clip(green(rgb) if name=='green' else rgb,0,1),al[...,None]],-1)
                Image.fromarray((out*255+0.5).astype(np.uint8),'RGBA').save(f'{OUT}/{name}/{n:03d}.png')
        n+=1
print('frames',n)

# 72 frames at 24 fps (3 s loop), scaled to 725 x 393 (about the on-screen size on an A55).
import glob
for c in BUILD:
    fr=[Image.open(f).resize((725,393),Image.LANCZOS) for f in sorted(glob.glob(f'{OUT}/{c}/*.png'))]
    # Green's brighter tips cost more bytes; alpha quality 73 keeps it a touch under the red and blue
    # loops (edge difference about 0.2/255 on average, invisible).
    fr[0].save(f'{SRC}/fire-{c}-loop.webp',save_all=True,append_images=fr[1:],duration=42,loop=0,quality=75,method=6,alpha_quality=73 if c=='green' else 75)
