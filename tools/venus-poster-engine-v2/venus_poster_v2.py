#!/usr/bin/env python3
"""CELESTIAL LOBBY Venus Poster Engine V2: modular high-resolution compositor."""
from pathlib import Path
import json, random
import numpy as np
from PIL import Image, ImageDraw, ImageFont, ImageFilter, ImageEnhance

ROOT=Path(__file__).resolve().parent
ASSETS=ROOT/"assets"; OUT=ROOT/"output"; CFG=ROOT/"venus_config.json"
DEFAULT={
 "canvas":{"width":2160,"height":4320},
 "identity":{"server":"VENUS","subtitle":"INCUBUS' FAVORITE","section":"DWELLER","name":"VAELITH","epithet":"THE VELVETBORN","traits":"CHARM • SYNERGY • ELITE PROGRESSION","classification":"MID-HIGH • ADVANCED PLAYERS"},
 "palette":{"shadow":[17,7,24],"plum":[49,23,66],"rose_gold":[221,151,132],"champagne":[255,224,178],"pearl":[255,241,231],"pink":[225,139,177]},
 "assets":{"background":"background.png","architecture":"architecture.png","character":"character.png","foreground":"foreground.png","particles":"particles.png"},
 "character":{"height":0.76,"anchor_x":0.5,"anchor_y":0.77,"x_offset":0.0,"glow":36,"glow_opacity":0.2,"shadow_opacity":0.45},
 "effects":{"vignette":0.38,"atmosphere":0.12,"bottom_fade_start":0.68,"bottom_fade":0.88,"particles":180,"seed":2711,"grain":0.012,"contrast":1.07,"color":1.05},
 "type":{"font_regular":"","font_bold":"","server_y":0.715,"server_size":250,"subtitle_y":0.795,"subtitle_size":78,"section_y":0.855,"section_size":42,"name_y":0.884,"name_size":112,"epithet_y":0.92,"epithet_size":58,"traits_y":0.957,"traits_size":37,"classification_y":0.978,"classification_size":31}
}
def config():
 if not CFG.exists(): CFG.write_text(json.dumps(DEFAULT,indent=2),encoding="utf-8")
 return json.loads(CFG.read_text(encoding="utf-8"))
def load(name):
 p=ASSETS/name
 return Image.open(p).convert("RGBA") if name and p.exists() else None
def cover(im,size):
 w,h=size; s=max(w/im.width,h/im.height); im=im.resize((int(im.width*s),int(im.height*s)),Image.Resampling.LANCZOS)
 x=(im.width-w)//2; y=(im.height-h)//2
 return im.crop((x,y,x+w,y+h))
def gradient(size,stops):
 w,h=size; a=np.zeros((h,w,4),dtype=np.uint8)
 for y,p in enumerate(np.linspace(0,1,h)):
  for i in range(len(stops)-1):
   p0,c0=stops[i]; p1,c1=stops[i+1]
   if p0<=p<=p1:
    t=(p-p0)/(p1-p0 or 1); c=[round(c0[k]*(1-t)+c1[k]*t) for k in range(4)]; break
  else: c=stops[-1][1]
  a[y,:,:]=c
 return Image.fromarray(a,"RGBA")
def font(path,size,bold=False):
 candidates=[path] if path else []
 candidates += ["/usr/share/fonts/truetype/dejavu/DejaVuSerif-Bold.ttf" if bold else "/usr/share/fonts/truetype/dejavu/DejaVuSerif.ttf"]
 for p in candidates:
  if p and Path(p).exists(): return ImageFont.truetype(p,size)
 return ImageFont.load_default()
def fitfont(text,path,size,maxw,bold=False):
 while size>12:
  f=font(path,size,bold)
  if ImageDraw.Draw(Image.new("L",(1,1))).textbbox((0,0),text,font=f)[2]<=maxw:return f
  size-=2
 return font(path,12,bold)
def text_layer(canvas,text,y,size,color,path,bold=False,tracking=0,metal=False):
 w,h=canvas.size; f=fitfont(text,path,size,int(w*.92),bold)
 mask=Image.new("L",(w,h),0); d=ImageDraw.Draw(mask)
 widths=[d.textlength(c,font=f) for c in text]; x=(w-sum(widths)-tracking*(len(text)-1))/2
 for c,cw in zip(text,widths): d.text((int(x),int(y)),c,font=f,fill=255); x+=cw+tracking
 if metal:
  fill=gradient((w,h),[(0,(255,245,220,255)),(.45,(255,224,178,255)),(1,(221,151,132,255))]); fill.putalpha(mask); layer=fill
 else:
  layer=Image.new("RGBA",(w,h),(*color,0)); layer.putalpha(mask)
 shadow=Image.new("RGBA",(w,h),(0,0,0,0)); shadow.putalpha(mask.filter(ImageFilter.GaussianBlur(8)).point(lambda p:int(p*.72)))
 shifted=Image.new("RGBA",(w,h),(0,0,0,0)); shifted.alpha_composite(shadow,(0,8))
 return Image.alpha_composite(Image.alpha_composite(canvas,shifted),layer)
def place_character(canvas,im,cfg):
 if im is None: print("Missing transparent assets/character.png"); return canvas
 w,h=canvas.size; c=cfg["character"]; nh=int(h*c["height"]); nw=int(im.width*nh/im.height)
 im=im.resize((nw,nh),Image.Resampling.LANCZOS); x=int(w*c["anchor_x"]-nw/2+w*c["x_offset"]); y=int(h*c["anchor_y"]-nh)
 alpha=im.getchannel("A")
 glow=Image.new("RGBA",im.size,(*cfg["palette"]["rose_gold"],0)); glow.putalpha(alpha.filter(ImageFilter.GaussianBlur(c["glow"])).point(lambda p:int(p*c["glow_opacity"])))
 sh=Image.new("RGBA",im.size,(8,3,12,0)); sh.putalpha(alpha.point(lambda p:int(p*c["shadow_opacity"])).filter(ImageFilter.GaussianBlur(max(2,c["glow"]//2))))
 for layer,offset in [(glow,(x,y)),(sh,(x,y+12)),(im,(x,y))]:
  temp=Image.new("RGBA",canvas.size,(0,0,0,0)); temp.alpha_composite(layer,dest=offset); canvas=Image.alpha_composite(canvas,temp)
 return canvas
def particles(canvas,count,seed,color):
 w,h=canvas.size; layer=Image.new("RGBA",(w,h),(0,0,0,0)); d=ImageDraw.Draw(layer); r=random.Random(seed); scale=max(1,w//2160)
 for _ in range(count):
  x=r.randrange(w); y=r.randrange(h); q=r.choice([1,1,2,2,3,4])*scale; a=r.randint(35,145)
  d.ellipse((x-q,y-q,x+q,y+q),fill=(*color,a))
 return Image.alpha_composite(canvas,layer.filter(ImageFilter.GaussianBlur(max(1,scale))))
def main():
 c=config(); w,h=c["canvas"]["width"],c["canvas"]["height"]; size=(w,h); OUT.mkdir(exist_ok=True)
 bg=load(c["assets"]["background"])
 if bg is None: bg=gradient(size,[(0,(48,19,60,255)),(.5,(118,57,99,255)),(1,(22,8,27,255))])
 else: bg=cover(bg,size)
 canvas=bg
 # Separate independently replaceable layers: architecture, character, foreground, particles.
 for key in ("architecture",):
  layer=load(c["assets"][key])
  if layer: canvas=Image.alpha_composite(canvas,cover(layer,size))
 tint=Image.new("RGBA",size,(*c["palette"]["pink"],int(255*c["effects"]["atmosphere"])))
 canvas=Image.alpha_composite(canvas,tint)
 canvas=place_character(canvas,load(c["assets"]["character"]),c)
 fg=load(c["assets"]["foreground"])
 if fg: canvas=Image.alpha_composite(canvas,cover(fg,size))
 p=load(c["assets"]["particles"])
 if p: canvas=Image.alpha_composite(canvas,cover(p,size))
 e=c["effects"]; canvas=particles(canvas,e["particles"],e["seed"],tuple(c["palette"]["champagne"]))
 canvas=Image.alpha_composite(canvas,gradient(size,[(0,(0,0,0,0)),(e["bottom_fade_start"],(0,0,0,0)),(1,(*c["palette"]["shadow"],int(255*e["bottom_fade"])))]))
 # Radial vignette
 yy,xx=np.mgrid[0:h,0:w]; rad=np.sqrt(((xx-w/2)/(w/2))**2+((yy-h/2)/(h/2))**2)
 alpha=(np.clip((rad-.25)/.95,0,1)*e["vignette"]*185).astype(np.uint8)
 vig=Image.new("RGBA",size,(8,3,13,0)); vig.putalpha(Image.fromarray(alpha)); canvas=Image.alpha_composite(canvas,vig)
 t=c["type"]; ident=c["identity"]; pal=c["palette"]; regular=t["font_regular"]; bold=t["font_bold"]
 canvas=text_layer(canvas,ident["server"],int(h*t["server_y"]),t["server_size"],pal["champagne"],bold,True,metal=True)
 canvas=text_layer(canvas,ident["subtitle"],int(h*t["subtitle_y"]),t["subtitle_size"],pal["pearl"],regular,False,tracking=2)
 d=ImageDraw.Draw(canvas); cy=int(h*.838); d.line((w*.21,cy,w*.79,cy),fill=(*pal["rose_gold"],230),width=max(2,w//1080))
 d.polygon([(w/2,cy-9),(w/2+9,cy),(w/2,cy+9),(w/2-9,cy)],fill=(*pal["champagne"],255))
 for key,ykey,sizekey,col,b in [("section","section_y","section_size","rose_gold",False),("name","name_y","name_size","champagne",True),("epithet","epithet_y","epithet_size","pearl",False),("traits","traits_y","traits_size","rose_gold",False),("classification","classification_y","classification_size","pearl",False)]:
  canvas=text_layer(canvas,ident[key],int(h*t[ykey]),t[sizekey],pal[col],bold if b else regular,b,tracking=3 if key in ("section","epithet") else 0,metal=(key=="name"))
 rgb=ImageEnhance.Contrast(canvas.convert("RGB")).enhance(e["contrast"]); rgb=ImageEnhance.Color(rgb).enhance(e["color"])
 if e["grain"]:
  a=np.asarray(rgb).astype(np.int16); noise=np.random.default_rng(e["seed"]).normal(0,e["grain"]*255,(h,w,1)); rgb=Image.fromarray(np.clip(a+noise,0,255).astype("uint8"))
 out=OUT/"CELESTIAL_LOBBY_VENUS_V2.png"; rgb.save(out,"PNG",dpi=(300,300),optimize=True)
 print(f"Exported {out} ({w}x{h})")
if __name__=="__main__": main()
