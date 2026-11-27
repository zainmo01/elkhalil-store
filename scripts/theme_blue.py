# Medical-blue trial theme. Revert: `git revert` the commit that applied it.
import re,colorsys,sys
GOLD={'#05483c':'#0b3c73','#0a6b52':'#1668c7','#062a26':'#0b2545','#2b7f68':'#3b82d6','#03352c':'#082c57','#0b7a60':'#1c78dc','#e8c65a':'#4fb3f0','#f2c94c':'#4fb3f0','#c9a227':'#1668c7','#fbf4dc':'#eaf3fc'}
def rot(r,g,b):
    h,l,s=colorsys.rgb_to_hls(r/255,g/255,b/255);d=h*360
    if 135<=d<=185 and s>.05:
        h=(d+46)/360
        return tuple(round(x*255) for x in colorsys.hls_to_rgb(h,l,s))
    return (r,g,b)
def hexsub(m):
    x=m.group(0).lower()
    if x in GOLD:return GOLD[x]
    r,g,b=[int(x[i:i+2],16) for i in (1,3,5)];return '#%02x%02x%02x'%rot(r,g,b)
RG={(5,72,60):(11,60,115),(10,107,82):(22,104,199),(6,42,38):(11,37,69),(5,50,42):(11,45,85)}
def rgbasub(m):
    r,g,b=[int(v) for v in m.group(2,3,4)];r,g,b=RG.get((r,g,b),(r,g,b));r,g,b=rot(r,g,b);return f"{m.group(1)}({r},{g},{b}{m.group(5)})"
for f in sys.argv[1:]:
    s=open(f).read()
    s=re.sub(r'#[0-9a-fA-F]{6}\b',hexsub,s)
    s=re.sub(r'(rgba?)\(\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)\s*((?:,\s*[0-9.]+)?)\)',rgbasub,s)
    open(f,'w').write(s)
