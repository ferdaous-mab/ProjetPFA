#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""generate_diagrams.py - SmartCampus"""
import matplotlib
matplotlib.use('Agg')
import matplotlib.pyplot as plt
import matplotlib.patches as P
import numpy as np, os

OUT = r"C:\Users\user\Desktop\rapport_PFA"
DPI = 150
os.makedirs(OUT, exist_ok=True)
plt.rcParams.update({'font.family': 'DejaVu Sans', 'font.size': 9})

# ── Palette dark UI ───────────────────────────────────────────────────────────
BG    = '#05050f'; HDR   = '#0b0b1a'; TABSBG= '#070714'; CARD  = '#0d0d20'
BDR   = '#1a1a35'; PRIM  = '#6366f1'; PURP  = '#a855f7'; GRN   = '#22c55e'
RED   = '#ef4444'; AMB   = '#f59e0b'; SKY   = '#0ea5e9'; WT    = '#ffffff'
DIM1  = '#aaaacc'; DIM2  = '#555577'; ACTBG = '#12123a'; PRIMLT= '#a5b4fc'
CARDBD= '#1e1e40'

# ── Palette UML (blanc) ───────────────────────────────────────────────────────
WH='#FFFFFF'; BK='#1A1A1A'; LG='#E6E6E6'; VLG='#F5F5F5'
MG='#AAAAAA'; DG='#333333'; LT='#666666'

# ── Primitives ────────────────────────────────────────────────────────────────
def fig(w=16, h=10):
    f = plt.figure(figsize=(w,h), facecolor=BG)
    a = f.add_axes([0,0,1,1]); a.set_xlim(0,w); a.set_ylim(0,h); a.axis('off')
    return f, a

def fig_uml(w=16, h=10):
    f = plt.figure(figsize=(w,h), facecolor=WH)
    a = f.add_axes([0,0,1,1]); a.set_xlim(0,w); a.set_ylim(0,h); a.axis('off')
    return f, a

def sv(f, name):
    f.savefig(os.path.join(OUT,name), dpi=DPI, bbox_inches='tight',
              facecolor=f.get_facecolor(), pad_inches=0.08)
    plt.close(f); print(f"  OK  {name}")

def bx(a, x, y, w, h, fc=WH, ec=BK, lw=1, z=2, ls='-', al=1.0):
    p = P.Rectangle((x,y),w,h,fc=fc,ec=ec,lw=lw,zorder=z,linestyle=ls)
    if al < 1.0: p.set_alpha(al)
    a.add_patch(p)

def el(a,cx,cy,rw,rh,fc=VLG,ec=BK,lw=1,z=2):
    a.add_patch(P.Ellipse((cx,cy),rw,rh,fc=fc,ec=ec,lw=lw,zorder=z))

def di(a,cx,cy,rw,rh,fc=WH,ec=BK,lw=1,z=2):
    xs=[cx,cx+rw/2,cx,cx-rw/2,cx]; ys=[cy+rh/2,cy,cy-rh/2,cy,cy+rh/2]
    a.fill(xs,ys,fc=fc,ec=ec,lw=lw,zorder=z)

def ci(a,cx,cy,r,fc=BK,ec=BK,lw=1,z=2):
    a.add_patch(P.Circle((cx,cy),r,fc=fc,ec=ec,lw=lw,zorder=z))

def ln(a,x1,y1,x2,y2,c=BK,lw=1,ls='-',z=1):
    a.plot([x1,x2],[y1,y2],c=c,lw=lw,ls=ls,zorder=z)

def ar(a,x1,y1,x2,y2,st='->',c=BK,lw=1,z=3):
    a.annotate('',xy=(x2,y2),xytext=(x1,y1),
               arrowprops=dict(arrowstyle=st,color=c,lw=lw,connectionstyle='arc3,rad=0'),zorder=z)

def tx(a,x,y,s,fs=9,ha='center',va='center',b=False,c=BK,z=5,it=False):
    a.text(x,y,s,fontsize=fs,ha=ha,va=va,
           fontweight='bold' if b else 'normal',
           fontstyle='italic' if it else 'normal',color=c,zorder=z)

def actor(a,cx,top,h=1.4,lbl='',lfs=9):
    u=h/6; ci(a,cx,top-u,u*.8,fc=WH,ec=BK,lw=1.3,z=6)
    ln(a,cx,top-2*u,cx,top-4*u,lw=1.3,z=6)
    ln(a,cx-u*1.2,top-2.8*u,cx+u*1.2,top-2.8*u,lw=1.3,z=6)
    ln(a,cx,top-4*u,cx-u,top-5.7*u,lw=1.3,z=6)
    ln(a,cx,top-4*u,cx+u,top-5.7*u,lw=1.3,z=6)
    if lbl: tx(a,cx,top-h-.22,lbl,fs=lfs,b=True)

def uc(a,cx,cy,lbl,rw=2.4,rh=0.6):
    el(a,cx,cy,rw,rh)
    lines=lbl.split('\n')
    for i,l in enumerate(lines): tx(a,cx,cy+(len(lines)-1)*.13-i*.26,l,fs=8.2,z=4)

def assoc(a,x1,y1,x2,y2,lbl='',dashed=False,hadarr=False):
    ln(a,x1,y1,x2,y2,lw=1,ls='--' if dashed else '-',z=2)
    if hadarr: ar(a,x1,y1,x2,y2,c=BK,lw=1,z=2)
    if lbl:
        mx,my=(x1+x2)/2,(y1+y2)/2; tx(a,mx,my+.15,lbl,fs=7.5,it=True,z=4)

# ── Dark wireframe helpers ────────────────────────────────────────────────────
ADMIN_TABS = [("Vue d'ensemble",'ov'),('Presences','pr'),('Risques','ri'),
              ('Notes','no'),('Alertes','al'),('Prediction IA','pi'),('Gestion','ge')]
GESTION_TABS = [('Profs','profs'),('Matieres','mat'),('Emplois','emp'),
                ('Etudiants','etu'),('Notes','gno'),('Alertes','gal'),('Sessions','ses')]
PROF_TABS  = [('Mon Dashboard','ov'),('Mes Sessions','se'),('Notes','no'),
              ('Alertes IA','al'),('Messagerie','ms')]
ETU_TABS   = [('Mon Espace','ov'),('Mes Presences','pr'),('Mes Notes','no'),
              ('Alertes','al'),('Messagerie','ms')]


def shell(a, active='ov', active_g='', role='admin', w=16, h=10):
    bx(a,0,0,w,h,fc=BG,ec='none',z=0)
    # Header bar
    bx(a,0,h-1.0,w,1.0,fc=HDR,ec='none',z=1)
    ln(a,0,h-1.0,w,h-1.0,c=BDR,lw=0.8,z=2)
    bx(a,.28,h-.82,.62,.62,fc=PRIM,ec='none',z=2)
    tx(a,.59,h-.51,'SC',fs=9,b=True,c=WT,z=3)
    tx(a,1.08,h-.38,'SmartCampus IA',fs=10.5,b=True,c=WT,ha='left',z=3)
    rlbl = 'Administration' if role=='admin' else ('Professeur' if role=='prof' else 'Etudiant')
    rcol = AMB if role=='admin' else (SKY if role=='prof' else PURP)
    tx(a,1.08,h-.72,rlbl,fs=7.5,c=rcol,ha='left',z=3)
    if role=='admin':
        bx(a,w-5.1,h-.80,1.45,.55,fc='none',ec=PRIM,lw=0.8,z=2)
        tx(a,w-4.375,h-.525,'Ass. IA',fs=7.5,c=PRIM,z=3)
        bx(a,w-3.5,h-.80,1.35,.55,fc='none',ec=SKY,lw=0.8,z=2)
        tx(a,w-2.825,h-.525,'Messages',fs=7.5,c=SKY,z=3)
    tx(a,w-.22,h-.35,'Admin',fs=7.5,c=DIM1,ha='right',z=3)
    tx(a,w-.22,h-.72,'Deconnexion',fs=7,c=RED,ha='right',z=3)
    # Tab bar
    bx(a,0,h-1.55,w,.55,fc=TABSBG,ec='none',z=1)
    ln(a,0,h-1.55,w,h-1.55,c=BDR,lw=0.6,z=2)
    tabs = ADMIN_TABS if role=='admin' else (PROF_TABS if role=='prof' else ETU_TABS)
    tw = w/len(tabs)
    for i,(lbl,key) in enumerate(tabs):
        is_a = (key==active)
        tx(a,i*tw+tw/2,h-1.275,lbl,fs=8,c=PRIM if is_a else DIM2,b=is_a,z=3)
        if is_a: bx(a,i*tw+.05,h-1.55,tw-.1,.032,fc=PRIM,ec='none',z=4)
    # Sub-tabs (gestion only)
    sh = 0.0
    if active=='ge' and role=='admin':
        sh=0.42
        bx(a,0,h-1.97,w,sh,fc='#080816',ec='none',z=1)
        ln(a,0,h-1.97,w,h-1.97,c=BDR,lw=0.5,z=2)
        stw=w/len(GESTION_TABS)
        for i,(lbl,key) in enumerate(GESTION_TABS):
            is_a=(key==active_g)
            tx(a,i*stw+stw/2,h-1.755,lbl,fs=7.8,c=PRIMLT if is_a else DIM2,b=is_a,z=3)
            if is_a: bx(a,i*stw+.04,h-1.97,stw-.08,.025,fc=PRIM,ec='none',z=4)
    ct = h-1.55-sh
    ln(a,0,ct,w,ct,c=BDR,lw=0.5,z=2)
    return 0.35, ct-0.22


def scard(a, x, y, w, h, lbl, val, vfs=16, acc=PRIM):
    bx(a,x,y,w,h,fc=CARD,ec=CARDBD,lw=0.7,z=3)
    bx(a,x,y+h-.05,w,.05,fc=acc,ec='none',z=4)
    tx(a,x+w/2,y+h*.58,val,fs=vfs,b=True,c=WT,z=5)
    tx(a,x+w/2,y+h*.18,lbl,fs=7.5,c=DIM1,z=5)

def dthdr(a, x, y, cols, ws):
    xc=x
    for col,w in zip(cols,ws):
        bx(a,xc,y-.20,w,.40,fc=ACTBG,ec=BDR,lw=0.6,z=3)
        tx(a,xc+w/2,y,col,fs=7.8,b=True,c=DIM1,z=4); xc+=w

def dtrow(a, x, y, vals, ws, alt=False):
    xc=x
    for val,w in zip(vals,ws):
        bx(a,xc,y-.18,w,.36,fc='#0f0f28' if alt else CARD,ec=BDR,lw=0.45,z=3)
        tx(a,xc+.1,y,str(val),fs=7.8,ha='left',c=WT,z=4); xc+=w

def dbadge(a, x, y, lbl, bg='#1e1e5a', fc=PRIMLT):
    bw=max(len(lbl)*.082+.2,.5)
    bx(a,x,y-.11,bw,.22,fc=bg,ec='none',z=4)
    tx(a,x+bw/2,y,lbl,fs=7.0,c=fc,z=5); return x+bw+.1

def dinput(a, x, y, ph='', w=3.5):
    bx(a,x,y-.16,w,.32,fc='#0a0a1a',ec=BDR,lw=0.7,z=4)
    if ph: tx(a,x+.1,y,ph,fs=7.8,ha='left',c=DIM2,z=5)

def dbtn(a, x, y, lbl, prim=True, fs=8.0, z=6):
    bw=max(len(lbl)*.09+.32,.9)
    bx(a,x,y-.17,bw,.34,fc=PRIM if prim else 'none',ec='none' if prim else BDR,lw=.8,z=z)
    tx(a,x+bw/2,y,lbl,fs=fs,b=prim,c=WT if prim else DIM1,z=z+1)
    return x+bw+.15

def dsec(a, x, y, lbl, w=15.3):
    tx(a,x,y,lbl,fs=9.5,ha='left',b=True,c=WT,z=4)
    ln(a,x,y-.13,x+w,y-.13,c=BDR,lw=.7,z=3)

def dmoverlay(a,w=16,h=10):
    p=P.Rectangle((0,0),w,h,fc='#000000',ec='none',zorder=7); p.set_alpha(.78); a.add_patch(p)

def dmbox(a, title, mx, my, mw, mh):
    bx(a,mx,my,mw,mh,fc='#0a0a1a',ec=CARDBD,lw=1.2,z=8)
    bx(a,mx,my+mh-.58,mw,.58,fc=ACTBG,ec='none',z=9)
    tx(a,mx+mw/2,my+mh-.29,title,fs=10,b=True,c=WT,z=10)
    tx(a,mx+mw-.28,my+mh-.29,'x',fs=10,c=DIM1,z=10)

# ── Activity / Sequence helpers ───────────────────────────────────────────────
def act_box(a,cx,cy,w=3.0,h=.58,lbl=''):
    a.add_patch(P.FancyBboxPatch((cx-w/2,cy-h/2),w,h,'round,pad=0,rounding_size=0.2',
                fc=VLG,ec=BK,lw=1,zorder=3))
    lines=lbl.split('\n')
    for i,l in enumerate(lines): tx(a,cx,cy+(len(lines)-1)*.13-i*.26,l,fs=8.2,z=4)

def act_dec(a,cx,cy,lbl=''):
    di(a,cx,cy,1.7,.75)
    lines=lbl.split('\n')
    for i,l in enumerate(lines): tx(a,cx,cy+(len(lines)-1)*.13-i*.26,l,fs=8,z=4)

def act_start(a,cx,cy): ci(a,cx,cy,.22,fc=BK,ec=BK,z=4)
def act_end(a,cx,cy):
    ci(a,cx,cy,.28,fc=WH,ec=BK,lw=2,z=4); ci(a,cx,cy,.18,fc=BK,ec=BK,z=5)

def act_arr(a,x1,y1,x2,y2,lbl=''):
    ar(a,x1,y1,x2,y2,c=BK,lw=1,z=3)
    if lbl: mx,my=(x1+x2)/2,(y1+y2)/2; tx(a,mx+.25,my,lbl,fs=7.5,ha='left',z=4)

def seq_lifeline(a,x,top,bottom,label):
    bx(a,x-.95,top-.28,1.9,.56,fc=LG,ec=BK,lw=1,z=3)
    lines=label.split('\n')
    for i,l in enumerate(lines): tx(a,x,top+(len(lines)-1)*.11-i*.22,l,fs=8.5,b=True,z=4)
    ln(a,x,top-.28,x,bottom,c=MG,lw=1,ls='--',z=2)

def seq_msg(a,x1,x2,y,lbl,ret=False):
    ar(a,x1,y,x2,y,st='<-' if ret else '->',c=BK,lw=1.2,z=4)
    tx(a,(x1+x2)/2,y+.14,lbl,fs=7.8,z=5)

def seq_act(a,x,ytop,ybot):
    bx(a,x-.13,ybot,.26,ytop-ybot,fc=WH,ec=BK,lw=1,z=3)

def cls_box(a,x,y,w,h,name,attrs,methods,z=2):
    bx(a,x,y+h-.55,w,.55,fc=LG,ec=BK,lw=1.2,z=z)
    tx(a,x+w/2,y+h-.27,name,fs=9.5,b=True,z=z+2)
    bx(a,x,y+h-.55-len(attrs)*.36,w,len(attrs)*.36,fc=WH,ec=BK,lw=1,z=z)
    for i,att in enumerate(attrs): tx(a,x+.12,y+h-.72-i*.36,att,fs=7.5,ha='left',z=z+2)
    off=len(attrs)*.36
    bx(a,x,y,w,h-.55-off,fc='#FAFAFA',ec=BK,lw=1,z=z)
    for i,mth in enumerate(methods): tx(a,x+.12,y+h-.72-off-i*.36,mth,fs=7.5,ha='left',z=z+2)

def db_table(a,x,y,w,name,cols):
    n=len(cols); total_h=n*.38+.5
    bx(a,x,y+total_h-.5,w,.5,fc=LG,ec=BK,lw=1.2,z=3)
    tx(a,x+w/2,y+total_h-.25,name,fs=9,b=True,z=4)
    for i,(col,typ,pk,fk) in enumerate(cols):
        cy=y+total_h-.5-i*.38-.19
        bx(a,x,cy-.19,w,.38,fc='#F2F2F2' if i%2==0 else WH,ec='#CCCCCC',lw=.5,z=3)
        prefix='[PK] ' if pk else ('[FK] ' if fk else '      ')
        tx(a,x+.12,cy,prefix+col,fs=7.5,ha='left',z=4)
        tx(a,x+w-.1,cy,typ,fs=7,ha='right',c=LT,z=4)
    bx(a,x,y,w,total_h,fc='none',ec=BK,lw=1.2,z=2)

# =============================================================================
# DIAGRAMMES UML (fond blanc)
# =============================================================================

def make_uc_admin():
    f,a=fig_uml(17,14)
    tx(a,8.5,13.7,"Diagramme de Cas d'Utilisation - Administrateur",fs=13,b=True,c=BK)
    bx(a,2.7,.3,13.7,13.0,fc=WH,ec=BK,lw=1.8,z=1)
    tx(a,9.05,13.1,'SmartCampus - Systeme de Gestion Scolaire Intelligente',fs=10.5,b=True,c=BK)
    actor(a,1.3,13.0,h=1.5,lbl='Administrateur',lfs=9)
    groups=[
        ("Gestion des Utilisateurs",3.0,5.0,
         [(6.5,12.5,"S'authentifier",2.2,.55),(6.5,11.6,"Gerer etudiants",2.2,.55),(6.5,10.9,"Gerer professeurs",2.2,.55)]),
        ("Gestion Academique",3.0,5.0,
         [(6.5,10.0,"Gerer matieres",2.2,.55),(6.5,9.2,"Gerer emploi du temps",2.4,.55),(6.5,8.5,"Gerer sessions",2.2,.55)]),
        ("Reconnaissance Faciale",8.5,5.0,
         [(11.5,12.5,"Enroler un etudiant",2.4,.55),(11.5,11.7,"Prendre les presences\n(reconnaissance faciale)",2.7,.65),(11.5,10.8,"Consulter presences",2.4,.55)]),
        ("Intelligence Artificielle",8.5,5.0,
         [(11.5,9.8,"Consulter alertes IA",2.4,.55),(11.5,9.0,"Voir etudiants a risque",2.5,.55),(11.5,8.2,"Tableau de bord BI\n(analyse Claude AI)",2.6,.65),(11.5,7.3,"Commande vocale\n(assistant IA)",2.5,.65)]),
        ("Gestion Notes & Comm.",3.0,5.0,
         [(6.5,7.2,"Saisir notes",2.2,.55),(6.5,6.4,"Envoyer alertes",2.2,.55),(6.5,5.5,"Messagerie interne",2.3,.55),(6.5,4.7,"Reinitialiser mot passe",2.6,.55)]),
    ]
    for grp_lbl,gx,gw,ucs in groups:
        total_h=max([cy for _,cy,*_ in ucs])-min([cy for _,cy,*_ in ucs])+1.5
        min_cy=min(cy for _,cy,*_ in ucs)
        bx(a,gx,min_cy-.5,gw,total_h,fc='none',ec=MG,lw=.8,ls='--',z=1)
        tx(a,gx+gw/2,min_cy+total_h-.3,grp_lbl,fs=8,it=True,c=MG,z=3)
        for cx,cy,lbl,rw,rh in ucs:
            uc(a,cx,cy,lbl,rw,rh); ln(a,1.3,cy,cx-rw/2,cy,lw=1,z=2)
    assoc(a,11.5,9.5,11.5,9.0,'include',dashed=True,hadarr=True)
    sv(f,'uc_admin.png')


def make_uc_prof():
    f,a=fig_uml(16,11)
    tx(a,8,10.7,"Diagramme de Cas d'Utilisation - Professeur",fs=13,b=True,c=BK)
    bx(a,2.8,.3,12.6,10.0,fc=WH,ec=BK,lw=1.8,z=1)
    tx(a,9.1,10.2,'SmartCampus - Systeme de Gestion Scolaire Intelligente',fs=10,b=True,c=BK)
    actor(a,1.4,9.8,h=1.5,lbl='Professeur',lfs=9)
    ucs=[(7.0,9.2,"S'authentifier",2.2,.55),(7.0,8.2,"Consulter mon dashboard",2.8,.55),
         (7.0,7.1,"Creer / Lancer une session",2.8,.55),(12.0,9.2,"Consulter presences\nde mes cours",2.7,.65),
         (12.0,8.1,"Saisir / modifier notes",2.5,.55),(7.0,5.9,"Consulter alertes IA",2.4,.55),
         (12.0,6.8,"Messagerie interne",2.3,.55),(12.0,5.8,"Assistant vocal\n(consultation stats)",2.7,.65),
         (9.5,4.5,"Voir etudiants a risque\ndans mes cours",2.8,.65),(9.5,3.2,"Consulter emploi du temps",2.6,.55)]
    bx(a,3.0,.5,12.0,9.4,fc='none',ec=MG,lw=.8,ls='--',z=1)
    for cx,cy,lbl,rw,rh in ucs:
        uc(a,cx,cy,lbl,rw,rh); ln(a,1.4,cy,cx-rw/2,cy,lw=1,z=2)
    assoc(a,7.0,7.1,12.0,9.2,'include',dashed=True,hadarr=True)
    sv(f,'uc_prof.png')


def make_uc_etudiant():
    f,a=fig_uml(15,10)
    tx(a,7.5,9.7,"Diagramme de Cas d'Utilisation - Etudiant",fs=13,b=True,c=BK)
    bx(a,2.6,.3,11.6,9.0,fc=WH,ec=BK,lw=1.8,z=1)
    tx(a,8.4,9.2,'SmartCampus - Systeme de Gestion Scolaire Intelligente',fs=10,b=True,c=BK)
    actor(a,1.3,9.0,h=1.5,lbl='Etudiant',lfs=9)
    ucs=[(7.0,8.4,"S'authentifier",2.2,.55),(7.0,7.4,"Consulter mon dashboard",2.7,.55),
         (12.0,8.4,"Consulter mes presences",2.7,.55),(12.0,7.4,"Consulter mes notes\net moyennes",2.7,.65),
         (7.0,6.2,"Consulter alertes\nme concernant",2.6,.65),(12.0,6.2,"Messagerie interne",2.3,.55),
         (7.0,4.9,"Voir emploi du temps",2.5,.55),(12.0,5.1,"Reinitialiser\nmon mot de passe",2.5,.65),
         (9.5,3.6,"S'enroler\n(saisie photo faciale)",2.7,.65)]
    bx(a,2.8,.5,11.2,8.5,fc='none',ec=MG,lw=.8,ls='--',z=1)
    for cx,cy,lbl,rw,rh in ucs:
        uc(a,cx,cy,lbl,rw,rh); ln(a,1.3,cy,cx-rw/2,cy,lw=1,z=2)
    sv(f,'uc_etudiant.png')


def make_seq_enrolment():
    f,a=fig_uml(16,12)
    tx(a,8,11.7,"Diagramme de Sequence : Enrolement Facial d'un Etudiant",fs=13,b=True,c=BK)
    PARTS=[("Etudiant",2.0),("Interface\nReact",5.5),("Backend\nFastAPI",9.0),("IA\nInsightFace",12.5),("BDD\nPostgres",15.5)]
    TOP=11.2; BOT=.5
    for lbl,x in PARTS: seq_lifeline(a,x,TOP,BOT,lbl)
    msgs=[(2.0,5.5,10.4,"Acces page enrolement",False),(5.5,9.0,9.8,"GET /enrollment/check/{id}",False),
          (9.0,15.5,9.2,"SELECT student WHERE id=...",False),(15.5,9.0,8.6,"Etudiant trouve",True),
          (9.0,5.5,8.0,"Formulaire + Camera",True),(2.0,5.5,7.3,"Captures 5 photos (angles)",False),
          (5.5,9.0,6.6,"POST /enrollment/upload [5 images]",False),(9.0,12.5,5.9,"detectFace(images[])",False),
          (12.5,9.0,5.2,"Embeddings[512] + scores qualite",True),(9.0,15.5,4.5,"INSERT student_faces_temp",False),
          (15.5,9.0,3.8,"OK",True),(5.5,9.0,3.1,"POST /enrollment/finalize",False),
          (9.0,12.5,2.4,"moyennerEmbeddings() -> embedding final",False),(12.5,9.0,1.8,"Embedding[512] final",True),
          (9.0,15.5,1.2,"INSERT student_faces + UPDATE is_enrolled=True",False),(15.5,9.0,.7,"OK",True)]
    seq_act(a,5.5,10.4,.6); seq_act(a,9.0,9.8,.6); seq_act(a,12.5,5.8,1.7); seq_act(a,15.5,9.1,.6)
    for x1,x2,y,lbl,ret in msgs: seq_msg(a,x1,x2,y,lbl,ret=ret)
    bx(a,.5,.4,14.8,1.2,fc='none',ec=MG,lw=1,ls='--',z=1)
    bx(a,.5,1.5,.8,.28,fc=LG,ec=MG,lw=.7,z=2)
    tx(a,.9,1.63,'alt',fs=7.5,b=True,c=MG,z=3)
    tx(a,8,.75,'[Qualite insuffisante] -> Demander de reprendre les photos',fs=7.5,it=True,c=LT,z=3)
    sv(f,'seq_enrolment.png')


def make_seq_attendance():
    f,a=fig_uml(16,12)
    tx(a,8,11.7,"Diagramme de Sequence : Prise de Presences par Reconnaissance Faciale",fs=12,b=True,c=BK)
    PARTS=[("Professeur",2.0),("Interface\nReact",5.2),("Backend\nFastAPI",8.5),("IA\nInsightFace",11.8),("BDD\nPostgres",15.0)]
    TOP=11.2; BOT=.5
    for lbl,x in PARTS: seq_lifeline(a,x,TOP,BOT,lbl)
    msgs=[(2.0,5.2,10.5,"Lancer session + activer camera",False),(5.2,8.5,9.9,"POST /recognition/start-session",False),
          (8.5,15.0,9.3,"INSERT session (statut='en_cours')",False),(15.0,8.5,8.7,"session_id",True),
          (8.5,5.2,8.1,"Flux video actif",True),(5.2,8.5,7.4,"POST /recognition/recognize [frame]",False),
          (8.5,11.8,6.7,"detectAndEmbed(frame)",False),(11.8,8.5,6.0,"query_vector[512]",True),
          (8.5,15.0,5.3,"SELECT student (cosine similarity < 0.4)",False),(15.0,8.5,4.6,"student_id + confidence",True),
          (8.5,15.0,3.9,"UPSERT attendance (status='present')",False),(15.0,8.5,3.2,"OK",True),
          (8.5,5.2,2.5,"{student: ..., confidence: 0.96}",True),(5.2,2.0,1.8,"Etudiant reconnu affiche en temps reel",True),
          (2.0,5.2,1.1,"Terminer la session",False),(5.2,8.5,.6,"POST /recognition/end-session",False)]
    seq_act(a,5.2,10.5,.5); seq_act(a,8.5,9.9,.5); seq_act(a,11.8,6.8,5.9); seq_act(a,15.0,9.2,.5)
    for x1,x2,y,lbl,ret in msgs: seq_msg(a,x1,x2,y,lbl,ret=ret)
    sv(f,'seq_attendance.png')


def make_activity_risk():
    f,a=fig_uml(13,15)
    tx(a,6.5,14.7,"Diagramme d'Activite : Detection des Etudiants a Risque (IA)",fs=12,b=True,c=BK)
    X=6.5
    act_start(a,X,14.0); act_arr(a,X,14.0-.22,X,13.3+.29)
    act_box(a,X,13.3,w=3.8,lbl="Tache planifiee : IA analyse\ntous les etudiants (cron job)")
    act_arr(a,X,13.3-.29,X,12.4+.29)
    act_box(a,X,12.4,w=3.5,lbl="Recuperer etudiants inscrits\ndepuis la BDD")
    act_arr(a,X,12.4-.29,X,11.5+.35); act_dec(a,X,11.5,lbl="Pour chaque\netudiant")
    act_arr(a,X,11.5-.38,X,10.6+.29)
    act_box(a,X,10.6,w=3.5,lbl="Compter absences\ndepuis 2 semaines")
    act_arr(a,X,10.6-.29,X,9.7+.35); act_dec(a,X,9.7,lbl="Absences > 3\nseuil ?")
    tx(a,X+.5,9.55,"Oui",fs=7.5,ha='left',c=BK); ln(a,X+.85,9.7,X+2.8,9.7,c=BK,lw=1)
    act_box(a,X+4.2,9.7,w=2.5,lbl="Creer alerte\n'absences excessives'")
    tx(a,X-.5,9.55,"Non",fs=7.5,ha='right',c=BK); act_arr(a,X,9.7-.38,X,8.7+.29)
    act_box(a,X,8.7,w=3.5,lbl="Calculer moyenne\ndes notes de l'etudiant")
    act_arr(a,X,8.7-.29,X,7.8+.35); act_dec(a,X,7.8,lbl="Moyenne < 10\nseuil ?")
    tx(a,X+.5,7.65,"Oui",fs=7.5,ha='left',c=BK); ln(a,X+.85,7.8,X+2.8,7.8,c=BK,lw=1)
    act_box(a,X+4.2,7.8,w=2.5,lbl="Creer alerte\n'notes insuffisantes'")
    tx(a,X-.5,7.65,"Non",fs=7.5,ha='right',c=BK); act_arr(a,X,7.8-.38,X,6.8+.29)
    act_dec(a,X,6.8,lbl="Risque cumule\n(absences + notes) ?")
    tx(a,X+.5,6.65,"Oui",fs=7.5,ha='left',c=BK); ln(a,X+.85,6.8,X+2.8,6.8,c=BK,lw=1)
    act_box(a,X+4.2,6.8,w=2.5,lbl="Creer alerte\n'risque d echec'")
    for fx,fy in [(X+4.2,9.7),(X+4.2,7.8),(X+4.2,6.8)]:
        ln(a,fx+2.5/2,fy-.29,fx+2.5/2,5.8,c=BK,lw=1)
    ln(a,X+5.45,5.8,X,5.8,c=BK,lw=1); ar(a,X,5.8,X,5.55,c=BK,lw=1)
    act_box(a,X,5.2,w=3.8,lbl="Enregistrer alerte en BDD\n(cible: prof + admin + etudiant)")
    act_arr(a,X,5.2-.29,X,4.3+.35); act_dec(a,X,4.3,lbl="Autres\netudiants ?")
    tx(a,X+.5,4.15,"Oui",fs=7.5,ha='left',c=BK)
    ln(a,X+.85,4.3,X+3.5,4.3,c=BK,lw=1); ln(a,X+3.5,4.3,X+3.5,11.5,c=BK,lw=1)
    ar(a,X+3.5,11.5,X+.85,11.5,c=BK,lw=1)
    tx(a,X-.5,4.15,"Non",fs=7.5,ha='right',c=BK); act_arr(a,X,4.3-.38,X,3.3+.29)
    act_box(a,X,3.3,w=3.5,lbl="Envoyer notifications\nen temps reel (WebSocket)")
    act_arr(a,X,3.3-.29,X,2.3+.22); act_end(a,X,2.3)
    sv(f,'activity_risk.png')


def make_activity_voice():
    f,a=fig_uml(12,13)
    tx(a,6,12.7,"Diagramme d'Activite : Traitement d'une Commande Vocale",fs=12,b=True,c=BK)
    X=6
    act_start(a,X,12.1); act_arr(a,X,12.1-.22,X,11.3+.29)
    act_box(a,X,11.3,w=3.4,lbl="Admin appuie sur\n'Enregistrer' (micro)")
    act_arr(a,X,11.3-.29,X,10.4+.29)
    act_box(a,X,10.4,w=3.4,lbl="Capture audio (MediaRecorder)\nenvoi a l'API")
    act_arr(a,X,10.4-.29,X,9.5+.29)
    act_box(a,X,9.5,w=3.4,lbl="POST /voice/transcribe\n-> AssemblyAI")
    act_arr(a,X,9.5-.29,X,8.6+.35); act_dec(a,X,8.6,lbl="Transcription\nreussie ?")
    tx(a,X-.5,8.45,"Non",fs=7.5,ha='right',c=BK); ln(a,X-.85,8.6,X-3.0,8.6,c=BK,lw=1)
    act_box(a,X-4.2,8.6,w=2.2,lbl="Afficher erreur\nmicro")
    act_end(a,X-4.2,7.7); ln(a,X-4.2,8.35,X-4.2,8.0,c=BK,lw=1); ar(a,X-4.2,8.0,X-4.2,7.7,c=BK,lw=1)
    tx(a,X+.5,8.45,"Oui",fs=7.5,ha='left',c=BK); act_arr(a,X,8.6-.38,X,7.7+.29)
    act_box(a,X,7.7,w=3.4,lbl="POST /voice/command\n-> Groq/Gemini (detection intention)")
    act_arr(a,X,7.7-.29,X,6.8+.35); act_dec(a,X,6.8,lbl="Intention\ndetectee ?")
    tx(a,X+.5,6.65,"Oui action",fs=7.5,ha='left',c=BK); ln(a,X+.85,6.8,X+2.5,6.8,c=BK,lw=1)
    act_box(a,X+3.8,6.8,w=2.4,lbl="Demander\nconfirmation")
    act_arr(a,X+3.8,6.8-.29,X+3.8,5.8+.35); act_dec(a,X+3.8,5.8,lbl="Confirme ?")
    tx(a,X+3.8+.5,5.65,"Oui",fs=7.5,ha='left',c=BK); ln(a,X+3.8+.85,5.8,X+6.8,5.8,c=BK,lw=1)
    act_box(a,X+7.8,5.8,w=2.0,lbl="Executer\nl'action")
    tx(a,X+3.8-.5,5.65,"Non",fs=7.5,ha='right',c=BK); ln(a,X+3.8-.85,5.8,X+.5,5.8,c=BK,lw=1)
    tx(a,X-.5,6.65,"Inconnu",fs=7.5,ha='right',c=BK); act_arr(a,X,6.8-.38,X,5.8+.29)
    act_box(a,X,5.8,w=3.4,lbl="Reponse conversationnelle\n(stats / infos)")
    act_arr(a,X,5.8-.29,X,4.8+.29)
    act_box(a,X,4.8,w=3.4,lbl="Synthese vocale (TTS)\nAffichage textuel")
    ln(a,X+7.8+1.0,5.8,X+7.8+1.0,4.8,c=BK,lw=1); ln(a,X+7.8+1.0,4.8,X+3.4/2,4.8,c=BK,lw=1)
    act_arr(a,X,4.8-.29,X,3.8+.22); act_end(a,X,3.8)
    sv(f,'activity_voice.png')


def make_class():
    f,a=fig_uml(19,15)
    tx(a,9.5,14.7,'Diagramme de Classes - SmartCampus',fs=13,b=True,c=BK)
    classes=[
        (1.0,11.5,4.0,2.9,'Student',
         ['- id : UUID','- nom, prenom : String','- email : String (unique)','- classe : String','- annee_scolaire : String','- is_enrolled : Boolean'],
         ['+ enroll() : void','+ getAttendances() : List']),
        (6.0,12.5,3.8,2.3,'StudentFace',
         ['- id : UUID','- student_id : UUID','- embedding : Vector(512)','- det_score : Float'],
         ['+ compare(other) : Float']),
        (10.5,12.5,3.8,2.3,'StudentImage',
         ['- id : UUID','- student_id : UUID','- url : String (Cloudinary)','- angle : String','- is_primary : Boolean'],
         ['+ upload() : void']),
        (15.0,11.5,3.8,2.5,'User',
         ['- id : UUID','- email : String','- password_hash : String','- role : Enum(admin|prof|etudiant)','- is_active : Boolean'],
         ['+ login() : Token','+ resetPassword() : void']),
        (1.0,7.5,3.8,2.5,'Matiere',
         ['- id : UUID','- nom, code : String','- coefficient : Float','- classe : String','- annee_scolaire : String'],
         ['+ getSessions() : List','+ getGrades() : List']),
        (6.0,7.5,3.8,3.2,'Session',
         ['- id : UUID','- matiere_id : UUID','- classe : String','- date : Date','- heure_debut, heure_fin : Time','- video_url : String','- status : Enum'],
         ['+ start() : void','+ end() : void','+ getAttendances() : List']),
        (11.0,7.5,3.8,2.5,'Attendance',
         ['- id : UUID','- student_id : UUID','- session_id : UUID','- status : Enum(present|absent|retard)','- confidence : Float'],
         ['+ markPresent() : void']),
        (15.5,7.5,3.3,2.5,'Grade',
         ['- id : UUID','- student_id : UUID','- matiere_id : UUID','- note : Float (0-20)','- type : Enum','- date : Date'],
         ['+ getMoyenne() : Float']),
        (1.0,3.2,4.0,3.0,'Alert',
         ['- id : UUID','- student_id : UUID','- type : Enum(absences|notes|risque_echec)','- severity : Enum(low|medium|high)','- target_role : String','- is_read : Boolean'],
         ['+ markRead() : void','+ send() : void']),
        (6.5,3.2,3.8,2.8,'EmploiTemps',
         ['- id : UUID','- matiere_id : UUID','- classe : String','- jour : String','- heure_debut : Time','- heure_fin : Time'],
         ['+ getSlots() : List']),
        (11.5,3.2,3.8,2.5,'Message',
         ['- id : UUID','- sender_id : UUID','- receiver_id : UUID','- content : Text','- is_read : Boolean','- reply_to_id : UUID'],
         ['+ send() : void','+ markRead() : void']),
    ]
    for x,y,w,h,name,attrs,methods in classes: cls_box(a,x,y,w,h,name,attrs,methods)
    ln(a,3.0,12.5,6.0,13.0,c=BK,lw=1.2); tx(a,4.5,13.2,'1..*',fs=7.5,c=BK)
    ln(a,3.0,12.5,10.5,13.0,c=BK,lw=1.2)
    ln(a,5.0,11.5,6.0,10.0,c=BK,lw=1.2); tx(a,5.3,11.0,'1',fs=7.5,c=BK); tx(a,6.2,10.2,'*',fs=10,c=BK)
    ln(a,5.0,9.5,6.0,9.0,c=BK,lw=1.2); tx(a,5.2,9.6,'*',fs=10,c=BK)
    ln(a,9.8,9.0,11.0,9.0,c=BK,lw=1.2); tx(a,10.3,9.2,'1',fs=7.5,c=BK); tx(a,11.2,9.2,'*',fs=10,c=BK)
    ln(a,3.0,9.5,1.5,9.5,c=BK,lw=1.2); ln(a,1.5,9.5,1.5,4.0,c=BK,lw=1.2)
    ar(a,1.5,4.0,2.0,4.0,c=BK,lw=1); tx(a,1.6,4.2,'*',fs=10,c=BK)
    ln(a,9.8,9.0,9.5,7.5,c=BK,lw=1.2); ln(a,9.5,7.5,11.0,7.5,c=BK,lw=1.2)
    ln(a,9.8,8.0,15.5,8.0,c=BK,lw=1.2); tx(a,15.7,8.2,'*',fs=10,c=BK)
    ln(a,3.0,9.5,6.5,4.5,c=BK,lw=1.2); ln(a,6.5,7.5,9.5,5.0,c=BK,lw=1.2)
    ln(a,15.0,11.5,17.0,9.5,c=BK,lw=1.2); ln(a,17.0,9.5,17.0,3.5,c=BK,lw=1.2); ln(a,17.0,3.5,15.3,3.5,c=BK,lw=1.2)
    sv(f,'class_diagram.png')


def make_db():
    f,a=fig_uml(19,14)
    tx(a,9.5,13.7,'Schema de la Base de Donnees - SmartCampus',fs=13,b=True,c=BK)
    TABLES=[
        (1.0,10.5,4.0,'students',[('id','UUID',True,False),('nom, prenom','String',False,False),('email','String',False,False),('classe','String',False,False),('annee_scolaire','String',False,False),('is_enrolled','Boolean',False,False),('cin, telephone','String',False,False)]),
        (6.0,11.5,3.8,'student_faces',[('id','UUID',True,False),('student_id','UUID',False,True),('embedding','Vector(512)',False,False),('det_score','Float',False,False)]),
        (10.5,11.5,3.8,'student_images',[('id','UUID',True,False),('student_id','UUID',False,True),('url','String',False,False),('angle','String',False,False),('is_primary','Boolean',False,False)]),
        (15.0,10.5,3.8,'users',[('id','UUID',True,False),('email','String',False,False),('password_hash','String',False,False),('role','Enum',False,False),('student_id','UUID',False,True),('is_active','Boolean',False,False)]),
        (1.0,6.0,3.8,'matieres',[('id','UUID',True,False),('nom, code','String',False,False),('coefficient','Float',False,False),('classe','String',False,False),('annee_scolaire','String',False,False),('professeur_id','UUID',False,True)]),
        (6.0,6.5,4.0,'sessions',[('id','UUID',True,False),('matiere_id','UUID',False,True),('classe','String',False,False),('date','Date',False,False),('heure_debut','Time',False,False),('heure_fin','Time',False,False),('status','Enum',False,False)]),
        (11.0,6.0,3.8,'attendances',[('id','UUID',True,False),('student_id','UUID',False,True),('session_id','UUID',False,True),('status','Enum',False,False),('confidence','Float',False,False),('detected_at','DateTime',False,False)]),
        (15.5,6.0,3.3,'grades',[('id','UUID',True,False),('student_id','UUID',False,True),('matiere_id','UUID',False,True),('note','Float',False,False),('type','Enum',False,False),('date','Date',False,False)]),
        (1.0,1.5,4.0,'alerts',[('id','UUID',True,False),('student_id','UUID',False,True),('type','Enum',False,False),('severity','Enum',False,False),('target_role','String',False,False),('is_read','Boolean',False,False)]),
        (6.5,1.5,3.8,'emplois_temps',[('id','UUID',True,False),('matiere_id','UUID',False,True),('classe','String',False,False),('jour','String',False,False),('heure_debut','Time',False,False),('heure_fin','Time',False,False)]),
        (11.5,1.5,3.8,'messages',[('id','UUID',True,False),('sender_id','UUID',False,True),('receiver_id','UUID',False,True),('content','Text',False,False),('is_read','Boolean',False,False),('reply_to_id','UUID',False,True)]),
    ]
    for t in TABLES: db_table(a,t[0],t[1],t[2],t[3],t[4])
    rels=[(3.0,11.5,6.0,12.0),(3.0,11.5,10.5,12.0),(5.0,12.5,15.0,11.5),(2.9,8.5,2.9,6.5),
          (7.5,8.5,8.0,7.5),(10.0,7.5,11.0,7.5),(2.9,8.5,13.0,7.5),(2.9,8.5,15.5,7.5),
          (4.9,8.5,17.3,7.5),(2.9,8.5,2.9,2.8),(4.9,8.0,8.3,2.8)]
    for x1,y1,x2,y2 in rels: ln(a,x1,y1,x2,y2,c=MG,lw=.8,ls='--',z=1)
    tx(a,16.0,2.0,'Legende:',fs=8.5,ha='left',b=True,c=BK)
    tx(a,16.0,1.6,'[PK] Cle primaire',fs=8,ha='left',c=BK)
    tx(a,16.0,1.2,'[FK] Cle etrangere',fs=8,ha='left',c=BK)
    tx(a,16.0,.8,'Vector(512): pgvector',fs=8,ha='left',c=BK)
    sv(f,'db_schema.png')


# =============================================================================
# MAQUETTES D'INTERFACE (theme dark SmartCampus)
# =============================================================================

def make_page_accueil():
    f,a=fig(16,10)
    bx(a,4.0,1.2,8.0,7.8,fc=CARD,ec=CARDBD,lw=0.8,z=2)
    bx(a,7.1,7.4,1.8,1.8,fc=PRIM,ec='none',z=3)
    tx(a,8.0,8.3,'SC',fs=24,b=True,c=WT,z=4)
    tx(a,8.0,7.0,'SmartCampus IA',fs=15,b=True,c=WT,z=4)
    tx(a,8.0,6.6,'Systeme de Gestion Scolaire Intelligente',fs=9.5,c=DIM1,z=4)
    tx(a,8.0,6.28,'ESISA Fes  -  PFA 2024-2025',fs=8,c=DIM2,it=True,z=4)
    feats=[('Reconnaissance\nFaciale','Presences auto',PRIM),
           ('Prediction IA','Etudiants a risque',RED),
           ('Ass. Vocal','Commandes vocales',AMB)]
    for i,(title,sub,col) in enumerate(feats):
        fx=5.0+i*2.7
        bx(a,fx-.9,4.6,2.5,1.3,fc='#0f0f28',ec=BDR,lw=0.6,z=3)
        bx(a,fx-.9,5.85,2.5,.075,fc=col,ec='none',z=4)
        tx(a,fx+.35,5.3,title,fs=8,b=True,c=WT,z=4)
        tx(a,fx+.35,4.95,sub,fs=7.5,c=DIM1,z=4)
    bx(a,4.8,3.8,6.4,.58,fc=PRIM,ec='none',z=3)
    tx(a,8.0,4.09,'Se connecter  ->',fs=10.5,b=True,c=WT,z=4)
    bx(a,4.8,3.05,6.4,.52,fc='none',ec=BDR,lw=0.8,z=3)
    tx(a,8.0,3.31,"S'enroler (premiere connexion)",fs=9,c=DIM1,z=4)
    tx(a,8.0,0.45,'SmartCampus IA  -  ESISA Fes  -  PFA 2024-2025',fs=7.5,c=DIM2,z=4)
    sv(f,'page_accueil.png')


def make_page_login():
    f,a=fig(14,9)
    bx(a,3.0,0.8,8.0,8.0,fc=CARD,ec=CARDBD,lw=0.8,z=2)
    bx(a,6.1,7.5,1.8,1.8,fc=PRIM,ec='none',z=3)
    tx(a,7.0,8.4,'SC',fs=22,b=True,c=WT,z=4)
    tx(a,7.0,7.15,'SmartCampus IA',fs=12,b=True,c=WT,z=4)
    tx(a,7.0,6.78,'Connectez-vous a votre espace',fs=8.5,c=DIM1,z=4)
    tx(a,3.3,6.28,'Adresse email',fs=8,ha='left',c=DIM1,z=4)
    bx(a,3.3,5.78,7.4,.44,fc='#0a0a1a',ec=BDR,lw=0.7,z=3)
    tx(a,3.5,6.0,'email@etudiant.ma',fs=8.5,ha='left',c=DIM2,z=4)
    tx(a,3.3,5.42,'Mot de passe',fs=8,ha='left',c=DIM1,z=4)
    bx(a,3.3,4.92,7.4,.44,fc='#0a0a1a',ec=BDR,lw=0.7,z=3)
    tx(a,3.5,5.14,'............',fs=11,ha='left',c=DIM2,z=4)
    bx(a,3.3,4.2,7.4,.52,fc=PRIM,ec='none',z=3)
    tx(a,7.0,4.46,'Se connecter  ->',fs=10.5,b=True,c=WT,z=4)
    tx(a,7.0,3.82,'Mot de passe oublie ?',fs=8.5,c=PRIM,z=4)
    bx(a,3.3,1.0,7.4,2.4,fc='#0f0f28',ec=BDR,lw=0.7,z=3)
    tx(a,7.0,2.92,'Pas encore de compte ?',fs=8.5,c=DIM1,z=4)
    tx(a,7.0,2.55,'Realisez votre enrolement facial',fs=8,c=DIM2,z=4)
    bx(a,4.2,1.15,5.6,.48,fc='none',ec=BDR,lw=0.7,z=4)
    tx(a,7.0,1.39,"S'enroler ->",fs=9,c=DIM1,z=5)
    sv(f,'page_login.png')


def make_page_enrolment():
    f,a=fig(16,10)
    bx(a,0,9.0,16,1.0,fc=HDR,ec='none',z=1)
    ln(a,0,9.0,16,9.0,c=BDR,lw=0.8,z=2)
    bx(a,.28,9.18,.62,.62,fc=PRIM,ec='none',z=2)
    tx(a,.59,9.49,'SC',fs=9,b=True,c=WT,z=3)
    tx(a,1.08,9.63,'SmartCampus IA',fs=10.5,b=True,c=WT,ha='left',z=3)
    tx(a,1.08,9.28,'Enrolement Facial',fs=7.5,c=PRIMLT,ha='left',z=3)
    steps=["1. Informations","2. Capture Photo","3. Confirmation"]
    for i,s in enumerate(steps):
        bx(a,3.5+i*3.8,8.25,3.2,.38,fc=PRIM if i==0 else CARD,ec=PRIM if i==0 else BDR,lw=.7,z=3)
        tx(a,5.1+i*3.8,8.44,s,fs=8,c=WT if i==0 else DIM2,b=(i==0),z=4)
    # Left panel - form
    bx(a,.35,.4,7.5,7.5,fc=CARD,ec=CARDBD,lw=.7,z=2)
    tx(a,4.1,7.6,'Etape 1 : Informations Personnelles',fs=10,b=True,c=WT,z=4)
    fields=[(.55,6.9,'Nom *',3.3),(.55,5.95,'Email *',3.3),(.55,5.0,'Annee scolaire *',3.3),
            (3.95,6.9,'Prenom *',3.3),(3.95,5.95,'Classe *',3.3),(3.95,5.0,'CIN',3.3)]
    for fx,fy,lbl,fw in fields:
        tx(a,fx,fy+.21,lbl,fs=7.5,ha='left',c=DIM1,z=4)
        bx(a,fx,fy-.16,fw,.34,fc='#0a0a1a',ec=BDR,lw=.7,z=3)
    bx(a,.55,4.1,7.1,.48,fc=PRIM,ec='none',z=3)
    tx(a,4.1,4.34,'Valider les informations  ->',fs=9.5,b=True,c=WT,z=4)
    # Right panel - camera
    bx(a,8.1,.4,7.5,7.5,fc=CARD,ec=CARDBD,lw=.7,z=2)
    tx(a,11.85,7.6,'Etape 2 : Capture Photo (5 angles)',fs=10,b=True,c=WT,z=4)
    bx(a,8.7,3.7,6.3,3.55,fc='#050510',ec=BDR,lw=.8,z=3)
    bx(a,9.9,4.1,3.9,2.75,fc='none',ec=PRIM,lw=1.0,ls='--',z=4)
    tx(a,11.85,5.48,'Alignez votre visage dans le cadre',fs=9,c=DIM2,z=5)
    tx(a,11.85,5.1,'[Vue en direct]',fs=8.5,c=DIM2,it=True,z=5)
    angles=['Ctr','Gch','Drt','Haut','Bas']
    for i,ang in enumerate(angles):
        ci(a,9.1+i*1.1,3.35,.23,fc=PRIM if i==0 else '#1a1a35',ec=PRIM,z=4)
        tx(a,9.1+i*1.1,3.0,ang,fs=7,c=PRIMLT if i==0 else DIM2,z=5)
    bx(a,8.7,1.15,6.3,.48,fc=PRIM,ec='none',z=3)
    tx(a,11.85,1.39,'Capturer (photo 1/5)',fs=9.5,b=True,c=WT,z=4)
    tx(a,11.85,.72,'InsightFace (ArcFace)  -  Qualite requise > 85%',fs=7.5,c=DIM2,it=True,z=4)
    sv(f,'page_enrolment.png')


def make_admin_dashboard():
    f,a=fig()
    cx,cy=shell(a,active='ov')
    kpis=[('Etudiants inscrits','247',PRIM),('Enroles facial','198',RED),
          ("Sessions auj.",'12',AMB),('Alertes actives','5',GRN)]
    for i,(lbl,val,acc) in enumerate(kpis):
        scard(a,cx+i*3.82,cy-1.05,3.65,1.0,lbl,val,vfs=18,acc=acc)
    dsec(a,cx,cy-1.3,'Taux de presence par classe (semaine en cours)',w=15.3)
    classes=[('1A',88),('1B',92),('2A',75),('2B',85),('3A',78),('4A',91)]
    for i,(cl,v) in enumerate(classes):
        bh=v/100*2.2
        bx(a,cx+i*2.42+.15,cy-3.65,1.95,bh,fc=PRIM,ec='none',z=3)
        tx(a,cx+i*2.42+1.12,cy-1.48,f'{v}%',fs=7.8,c=WT,z=4)
        tx(a,cx+i*2.42+1.12,cy-3.8,cl,fs=8,c=DIM1,z=4)
    ln(a,cx,cy-3.65,cx+14.9,cy-3.65,c=BDR,lw=.6,z=2)
    dsec(a,cx,cy-4.05,'Alertes IA recentes',w=15.3)
    dthdr(a,cx,cy-4.3,['Etudiant','Type alerte','Niveau','Severite','Date'],[3.5,4.0,2.2,2.0,1.8])
    rows=[('Ahmed Alaoui','Absences excessives','2eme annee','High','10/06/25'),
          ('Sara Benali','Notes insuffisantes','3eme annee','Medium','09/06/25'),
          ('Omar Tahiri','Risque d echec','1ere annee','High','08/06/25')]
    for i,r in enumerate(rows):
        dtrow(a,cx,cy-4.72-i*.42,r,[3.5,4.0,2.2,2.0,1.8],alt=(i%2==1))
    sv(f,'admin_dashboard.png')


def make_admin_etudiants():
    f,a=fig()
    cx,cy=shell(a,active='ge',active_g='etu')
    dbtn(a,cx,cy,'+ Ajouter etudiant')
    dinput(a,cx+1.85,cy,'Rechercher un etudiant...',w=4.0)
    dthdr(a,cx,cy-.55,['Nom complet','Classe','Annee','Enrole','Statut IA','Actions'],[3.2,1.1,2.2,1.2,2.4,1.7])
    rows=[('Ahmed Alaoui','2A','2eme annee','Oui','A risque'),
          ('Sara Benali','3B','3eme annee','Oui','Normal'),
          ('Omar Tahiri','1A','1ere annee','Non','N/A'),
          ('Fatima Radi','2A','2eme annee','Oui','Normal'),
          ('Youssef Amiri','4A','4eme annee','Oui','Normal')]
    for i,r in enumerate(rows):
        dtrow(a,cx,cy-.97-i*.40,r,[3.2,1.1,2.2,1.2,2.4,1.7],alt=(i%2==1))
    sv(f,'admin_etudiants.png')


def make_admin_etudiant_detail():
    f,a=fig()
    cx,cy=shell(a,active='ge',active_g='etu')
    for i,(lbl,val) in enumerate([('Nom complet','Ahmed Alaoui'),('Classe','2A'),
                                   ('Annee','2eme annee'),('Enrolment','Enrole')]):
        bx(a,cx+i*3.8,cy-.95,3.6,.9,fc=CARD,ec=CARDBD,lw=.7,z=3)
        tx(a,cx+i*3.8+.12,cy-.22,lbl,fs=7.5,ha='left',c=DIM1,z=4)
        tx(a,cx+i*3.8+1.8,cy-.6,val,fs=9.5,b=True,c=WT,z=4)
    dsec(a,cx,cy-1.2,'Statistiques de presence',w=15.3)
    for i,(lbl,val,acc) in enumerate([('Total seances','42',PRIM),('Presences','34',GRN),('Absences','8',RED),('Taux','80.9 %',AMB)]):
        scard(a,cx+i*3.82,cy-2.35,3.65,.95,lbl,val,vfs=14,acc=acc)
    dsec(a,cx,cy-2.62,'Alertes IA actives',w=15.3)
    dthdr(a,cx,cy-2.85,['Type alerte','Severite','Date'],[5.5,2.5,3.0])
    dtrow(a,cx,cy-3.27,['Absences excessives','High','10/06/2025'],[5.5,2.5,3.0])
    dtrow(a,cx,cy-3.67,['Notes insuffisantes','Medium','05/06/2025'],[5.5,2.5,3.0],alt=True)
    dsec(a,cx,cy-4.12,'Notes par matiere',w=15.3)
    dthdr(a,cx,cy-4.35,['Matiere','Note 1','Note 2','Moyenne','Type'],[4.0,2.0,2.0,2.0,1.8])
    dtrow(a,cx,cy-4.77,['Mathematiques','8.5','9.0','8.75','Controle'],[4.0,2.0,2.0,2.0,1.8])
    dtrow(a,cx,cy-5.17,['Algorithmique','7.0','11.0','9.0','TP'],[4.0,2.0,2.0,2.0,1.8],alt=True)
    sv(f,'admin_etudiant_detail.png')


def make_admin_professeurs():
    f,a=fig()
    cx,cy=shell(a,active='ge',active_g='profs')
    dbtn(a,cx,cy,'+ Ajouter professeur')
    dthdr(a,cx,cy-.55,['Nom complet','Email','Matieres enseignees','Statut','Actions'],[3.2,3.8,4.2,1.6,1.2])
    rows=[('Dr. Karim Bennani','k.bennani@school.ma','Mathematiques, Algo','Actif'),
          ('Prof. Sara Idrissi','s.idrissi@school.ma','Physique-Chimie','Actif'),
          ('Dr. Mohammed Fassi','m.fassi@school.ma','Informatique','Actif'),
          ('Prof. Aicha Bensouda','a.bensouda@school.ma','Langue Francaise','Inactif')]
    for i,r in enumerate(rows):
        dtrow(a,cx,cy-.97-i*.40,r,[3.2,3.8,4.2,1.6,1.2],alt=(i%2==1))
    sv(f,'admin_professeurs.png')


def make_admin_matieres():
    f,a=fig()
    cx,cy=shell(a,active='ge',active_g='mat')
    dbtn(a,cx,cy,'+ Ajouter matiere')
    dthdr(a,cx,cy-.55,['Nom','Code','Classe','Annee','Coeff.','Professeur','Actions'],[3.0,1.0,1.0,2.2,.8,3.2,1.0])
    rows=[('Mathematiques','MAT','2A','2eme annee','4','Dr. Bennani'),
          ('Algorithmique','ALG','2A','2eme annee','3','Dr. Fassi'),
          ('Physique-Chimie','PHC','1A','1ere annee','3','Prof. Idrissi'),
          ('Informatique','INF','3A','3eme annee','4','Dr. Fassi')]
    for i,r in enumerate(rows):
        dtrow(a,cx,cy-.97-i*.40,r,[3.0,1.0,1.0,2.2,.8,3.2,1.0],alt=(i%2==1))
    sv(f,'admin_matieres.png')


def make_admin_sessions():
    f,a=fig()
    cx,cy=shell(a,active='ge',active_g='ses')
    dbtn(a,cx,cy,'+ Creer session')
    dthdr(a,cx,cy-.55,['Matiere','Classe','Date','Heure','Salle','Statut','Actions'],[2.8,1.0,1.8,1.8,1.2,2.0,1.2])
    rows_data=[('Mathematiques','2A','13/06/2025','08h-10h','A101','Planifiee'),
               ('Algorithmique','2A','13/06/2025','10h-12h','B202','En cours'),
               ('Physique-Chimie','1A','13/06/2025','14h-16h','C303','Planifiee'),
               ('Informatique','3A','12/06/2025','08h-10h','Info1','Terminee')]
    scol={'Planifiee':DIM1,'En cours':GRN,'Terminee':DIM2}
    for i,r in enumerate(rows_data):
        dtrow(a,cx,cy-.97-i*.40,r,[2.8,1.0,1.8,1.8,1.2,2.0,1.2],alt=(i%2==1))
        tx(a,cx+8.7,cy-.97-i*.40,r[5],fs=7.8,ha='left',c=scol.get(r[5],DIM1),z=5)
    sv(f,'admin_sessions.png')


def make_admin_presences():
    f,a=fig()
    cx,cy=shell(a,active='pr')
    for i,(lbl,val) in enumerate([('Session','Algo 2A'),('Date','13/06/2025'),('Presents','18/24'),('Taux','75 %')]):
        bx(a,cx+i*3.82,cy-.95,3.65,.9,fc=CARD,ec=CARDBD,lw=.7,z=3)
        tx(a,cx+i*3.82+.12,cy-.22,lbl,fs=7.5,ha='left',c=DIM1,z=4)
        tx(a,cx+i*3.82+1.82,cy-.6,val,fs=10,b=True,c=WT,z=4)
    dsec(a,cx,cy-1.2,'Reconnaissance faciale en temps reel',w=15.3)
    bx(a,cx,cy-4.4,6.5,3.1,fc='#050510',ec=BDR,lw=.8,z=3)
    tx(a,cx+3.25,cy-2.85,'[Flux camera actif]',fs=10,c=DIM2,it=True,z=4)
    bx(a,cx+.4,cy-4.05,2.2,2.5,fc='none',ec=GRN,lw=1.5,z=4)
    tx(a,cx+1.5,cy-1.65,'Ahmed Alaoui',fs=8.5,c=GRN,z=5)
    tx(a,cx+1.5,cy-1.9,'Confiance: 96%',fs=7.5,c=GRN,z=5)
    dsec(a,cx+6.8,cy-1.2,'Liste des etudiants',w=8.0)
    dthdr(a,cx+6.8,cy-1.45,['Etudiant','Statut','Heure'],[3.8,2.0,1.8])
    rows=[('Ahmed Alaoui','Present','08:12'),('Sara Benali','Present','08:15'),
          ('Omar Tahiri','Absent','--'),('Fatima Radi','Present','08:10'),
          ('Youssef Amiri','Present','08:18')]
    for i,r in enumerate(rows):
        dtrow(a,cx+6.8,cy-1.87-i*.40,r,[3.8,2.0,1.8],alt=(i%2==1))
        tx(a,cx+11.05,cy-1.87-i*.40,r[1],fs=7.8,ha='left',c=GRN if r[1]=='Present' else RED,z=5)
    dbtn(a,cx,cy-4.7,'Terminer la session')
    sv(f,'admin_presences.png')


def make_admin_notes():
    f,a=fig()
    cx,cy=shell(a,active='ge',active_g='gno')
    dbtn(a,cx,cy,'+ Saisir une note')
    dinput(a,cx+1.85,cy,'Classe / Matiere...',w=4.5)
    dthdr(a,cx,cy-.55,['Etudiant','Matiere','Note /20','Type','Date','Actions'],[3.2,3.0,1.5,1.8,2.0,1.2])
    rows=[('Ahmed Alaoui','Mathematiques','14.5','Controle','01/06/2025'),
          ('Sara Benali','Algorithmique','17.0','TP','05/06/2025'),
          ('Omar Tahiri','Mathematiques','9.0','Controle','01/06/2025'),
          ('Fatima Radi','Physique-Chimie','13.5','Examen','10/06/2025')]
    for i,r in enumerate(rows):
        dtrow(a,cx,cy-.97-i*.40,r,[3.2,3.0,1.5,1.8,2.0,1.2],alt=(i%2==1))
        nc=RED if float(r[2])<10 else (GRN if float(r[2])>=14 else WT)
        tx(a,cx+6.35,cy-.97-i*.40,r[2],fs=8,ha='left',c=nc,z=5)
    sv(f,'admin_notes.png')


def make_admin_alertes():
    f,a=fig()
    cx,cy=shell(a,active='al')
    dbtn(a,cx,cy,'+ Envoyer alerte manuelle')
    dthdr(a,cx,cy-.55,['Etudiant','Type','Severite','Cible','Date','Lu'],[2.8,3.2,1.6,2.4,2.0,.8])
    rows=[('Ahmed Alaoui','Absences excessives','High','Prof + Admin','10/06/25','Non'),
          ('Omar Tahiri','Risque echec','High','Admin','09/06/25','Non'),
          ('Sara Benali','Notes insuffisantes','Medium','Prof','05/06/25','Oui'),
          ('Fatima Radi','Absences excessives','Medium','Prof + Admin','02/06/25','Oui')]
    sev_col={'High':RED,'Medium':AMB}
    for i,r in enumerate(rows):
        dtrow(a,cx,cy-.97-i*.40,r,[2.8,3.2,1.6,2.4,2.0,.8],alt=(i%2==1))
        tx(a,cx+6.12,cy-.97-i*.40,r[2],fs=7.8,ha='left',c=sev_col.get(r[2],PRIM),z=5)
    sv(f,'admin_alertes.png')


def make_admin_bi():
    f,a=fig()
    cx,cy=shell(a,active='ov')
    kpis=[('Taux presence global','83.2 %',PRIM),('Moyenne generale','13.4/20',GRN),
          ('Etudiants a risque','11',RED),('Alertes actives','18',AMB)]
    for i,(lbl,val,acc) in enumerate(kpis):
        scard(a,cx+i*3.82,cy-1.05,3.65,1.0,lbl,val,vfs=15,acc=acc)
    dbtn(a,cx,cy-1.35,'Generer analyse IA (Claude Anthropic)')
    dbtn(a,cx+3.2,cy-1.35,'Filtrer par classe',prim=False)
    dsec(a,cx,cy-1.78,'Analyse generee par Claude AI (Anthropic)',w=15.3)
    bx(a,cx,cy-5.0,15.3,3.0,fc=ACTBG,ec=BDR,lw=.8,z=3)
    bx(a,cx+.15,cy-2.1,1.5,.32,fc=PRIM,ec='none',z=4)
    tx(a,cx+.9,cy-1.94,'Claude AI',fs=8,b=True,c=WT,z=5)
    ai_lines=["L'analyse de la cohorte 2024-2025 indique un taux de presence global de 83.2%,",
              "legerement inferieur a l'objectif de 85%. La classe 2A presente le plus faible",
              "taux (72%), avec 4 etudiants presentant des absences recurrentes le lundi matin.",
              "Correlation absences/echec : r=0.78. Recommandation : entretien individuel urgent",
              "pour les 3 etudiants cumulant absences > 5 et moyenne < 10."]
    for i,l in enumerate(ai_lines):
        tx(a,cx+.2,cy-2.42-i*.48,l,fs=8.2,ha='left',c=DIM1,z=4)
    sv(f,'admin_bi.png')


def make_admin_voice():
    f,a=fig()
    cx,cy=shell(a,active='ov')
    dmoverlay(a)
    mw,mh=8.5,8.2; mx=(16-mw)/2; my=(10-mh)/2
    bx(a,mx,my,mw,mh,fc='#0a0a1a',ec=CARDBD,lw=1.2,z=8)
    bx(a,mx,my+mh-.65,mw,.65,fc=ACTBG,ec='none',z=9)
    bx(a,mx+.25,my+mh-.55,.5,.5,fc=PRIM,ec='none',z=10)
    tx(a,mx+.5,my+mh-.3,'AI',fs=9,b=True,c=WT,z=11)
    tx(a,mx+.9,my+mh-.3,'Assistant IA',fs=10.5,b=True,c=WT,ha='left',z=11)
    tx(a,mx+.9,my+mh-.52,'SmartCampus ESISA',fs=7.5,c=DIM1,ha='left',z=11)
    tx(a,mx+mw-.28,my+mh-.3,'x',fs=11,c=DIM1,z=11)
    # User bubble
    bx(a,mx+2.2,my+mh-1.75,mw-2.5,.55,fc=PRIM,ec='none',z=9)
    tx(a,mx+2.4,my+mh-1.48,'Creer professeur Ahmed Benali, email ahmed@school.ma',fs=8,ha='left',c=WT,z=10)
    # Assistant bubble
    bx(a,mx+.25,my+mh-2.8,mw-2.5,.75,fc='#0f0f28',ec=BDR,lw=.5,z=9)
    tx(a,mx+.45,my+mh-2.45,'Je vais creer le compte de Ahmed Benali.',fs=8,ha='left',c=WT,z=10)
    tx(a,mx+.45,my+mh-2.68,'Confirmez-vous ? (oui / non)',fs=8,ha='left',c=DIM1,z=10)
    # Action card
    bx(a,mx+.25,my+mh-4.35,mw-.5,1.2,fc='#0f1050',ec=PRIM,lw=.8,z=9)
    tx(a,mx+.45,my+mh-3.6,'Creer Professeur',fs=9,b=True,c=PRIMLT,ha='left',z=10)
    tx(a,mx+.45,my+mh-3.9,'Nom: Ahmed Benali  |  Email: ahmed@school.ma',fs=8,ha='left',c=DIM1,z=10)
    bx(a,mx+.45,my+mh-4.22,1.8,.3,fc=PRIM,ec='none',z=10)
    tx(a,mx+1.35,my+mh-4.07,'Confirmer',fs=8,b=True,c=WT,z=11)
    bx(a,mx+2.4,my+mh-4.22,1.5,.3,fc='none',ec=BDR,lw=.7,z=10)
    tx(a,mx+3.15,my+mh-4.07,'Annuler',fs=8,c=DIM1,z=11)
    # Suggestions
    tx(a,mx+.25,my+1.65,'Suggestions :',fs=7.5,ha='left',c=DIM2,z=9)
    chips=['Voir alertes','Etudiants a risque','Stats presences']
    chip_x=mx+.25
    for chip in chips:
        bw=len(chip)*.092+.4
        bx(a,chip_x,my+1.1,bw,.35,fc='#0f0f28',ec=BDR,lw=.6,z=9)
        tx(a,chip_x+bw/2,my+1.275,chip,fs=7.8,c=PRIMLT,z=10)
        chip_x+=bw+.2
    ci(a,mx+mw/2,my+.65,.42,fc=PRIM,ec='none',z=9)
    tx(a,mx+mw/2,my+.65,'MIC',fs=8.5,b=True,c=WT,z=10)
    bx(a,mx+.25,my+.08,mw-1.2,.44,fc='#0a0a1a',ec=BDR,lw=.7,z=9)
    tx(a,mx+.45,my+.3,'Parlez ou ecrivez une commande...',fs=8,ha='left',c=DIM2,z=10)
    sv(f,'admin_voice.png')


def make_prof_dashboard():
    f,a=fig()
    cx,cy=shell(a,active='ov',role='prof')
    kpis=[('Matieres enseignees','2',PRIM),('Sessions ce mois','16',AMB),
          ('Taux de presence','81 %',GRN),('Alertes IA','3',RED)]
    for i,(lbl,val,acc) in enumerate(kpis):
        scard(a,cx+i*3.82,cy-1.05,3.65,1.0,lbl,val,vfs=18,acc=acc)
    dsec(a,cx,cy-1.3,'Mes matieres',w=15.3)
    dthdr(a,cx,cy-1.52,['Matiere','Classe','Annee','Prochaine session'],[4.0,1.2,2.5,4.0])
    dtrow(a,cx,cy-1.94,['Mathematiques','2A','2eme annee','13/06 08h00-10h00'],[4.0,1.2,2.5,4.0])
    dtrow(a,cx,cy-2.34,['Algorithmique','2B','2eme annee','14/06 10h00-12h00'],[4.0,1.2,2.5,4.0],alt=True)
    dsec(a,cx,cy-2.75,'Etudiants a surveiller (IA)',w=15.3)
    dthdr(a,cx,cy-2.97,['Etudiant','Classe','Absences','Moyenne','Risque'],[3.5,1.2,1.8,2.0,2.5])
    rows=[('Ahmed Alaoui','2A','7','8.5/20','Eleve'),('Omar Tahiri','2A','5','9.0/20','Moyen')]
    for i,r in enumerate(rows):
        dtrow(a,cx,cy-3.39-i*.40,r,[3.5,1.2,1.8,2.0,2.5],alt=(i%2==1))
        tx(a,cx+9.6,cy-3.39-i*.40,r[4],fs=7.8,ha='left',c=RED if r[4]=='Eleve' else AMB,z=5)
    sv(f,'prof_dashboard.png')


def make_prof_notes():
    f,a=fig()
    cx,cy=shell(a,active='no',role='prof')
    dbtn(a,cx,cy,'+ Ajouter une note')
    for i,(lbl,val) in enumerate([('Matiere','Mathematiques'),('Classe','2A'),('Annee','2eme annee')]):
        bx(a,cx+i*4.0,cy-.9,3.7,.85,fc=CARD,ec=CARDBD,lw=.7,z=3)
        tx(a,cx+i*4.0+.12,cy-.2,lbl,fs=7.5,ha='left',c=DIM1,z=4)
        tx(a,cx+i*4.0+1.85,cy-.58,val,fs=9.5,b=True,c=WT,z=4)
    dthdr(a,cx,cy-1.1,['Etudiant','Type eval.','Note /20','Date','Commentaire','Actions'],[3.2,2.0,1.5,1.8,3.5,1.2])
    rows=[('Ahmed Alaoui','Controle','14.5','01/06/2025',''),
          ('Sara Benali','Controle','17.0','01/06/2025',''),
          ('Omar Tahiri','Controle','9.0','01/06/2025','A surveiller')]
    for i,r in enumerate(rows):
        dtrow(a,cx,cy-1.52-i*.40,r,[3.2,2.0,1.5,1.8,3.5,1.2],alt=(i%2==1))
        nc=RED if float(r[2])<10 else (GRN if float(r[2])>=16 else WT)
        tx(a,cx+5.32,cy-1.52-i*.40,r[2],fs=8,ha='left',c=nc,z=5)
    sv(f,'prof_notes.png')


def make_student_dashboard():
    f,a=fig()
    cx,cy=shell(a,active='ov',role='etudiant')
    kpis=[('Classe','2A - 2eme',PRIM),('Taux presence','80.9 %',GRN),
          ('Moyenne generale','8.75/20',RED),('Statut IA','A risque',AMB)]
    for i,(lbl,val,acc) in enumerate(kpis):
        scard(a,cx+i*3.82,cy-1.05,3.65,1.0,lbl,val,vfs=12,acc=acc)
    bx(a,cx,cy-1.3,15.3,.48,fc='#3d1515',ec=RED,lw=.8,z=3)
    tx(a,cx+.2,cy-1.06,'Alerte : Vos absences sont excessives (7 absences). Suivi avec votre professeur recommande.',
       fs=8.5,ha='left',c=RED,z=4)
    dsec(a,cx,cy-2.0,'Mes notes recentes',w=15.3)
    dthdr(a,cx,cy-2.22,['Matiere','Note','Type','Date'],[5.0,2.0,2.5,2.5])
    dtrow(a,cx,cy-2.64,['Mathematiques','14.5/20','Controle','01/06/2025'],[5.0,2.0,2.5,2.5])
    dtrow(a,cx,cy-3.04,['Algorithmique','9.0/20','Controle','01/06/2025'],[5.0,2.0,2.5,2.5],alt=True)
    dsec(a,cx,cy-3.48,'Mes absences recentes',w=15.3)
    dthdr(a,cx,cy-3.70,['Matiere','Session','Date','Statut'],[4.0,3.5,2.5,2.0])
    dtrow(a,cx,cy-4.12,['Algorithmique','Session 8','09/06/2025','Absent'],[4.0,3.5,2.5,2.0])
    tx(a,cx+10.12,cy-4.12,'Absent',fs=7.8,ha='left',c=RED,z=5)
    sv(f,'student_dashboard.png')


def make_messaging_page():
    f,a=fig(16,10)
    bx(a,0,0,16,10,fc='#0a0a1a',ec='none',z=0)
    # Sidebar
    bx(a,0,0,3.8,10,fc=HDR,ec='none',z=1)
    ln(a,3.8,0,3.8,10,c=BDR,lw=.8,z=2)
    tx(a,1.9,9.6,'Messages',fs=11,b=True,c=WT,z=3)
    bx(a,.2,8.9,3.4,.4,fc=CARD,ec=BDR,lw=.6,z=3)
    tx(a,.38,9.1,'Rechercher...',fs=8,ha='left',c=DIM2,z=4)
    contacts=[('Dr. Bennani','Hier','Bonjour, j avais...','prof',True),
              ('Admin Sys.','2j','Votre compte...','admin',False),
              ('Mme. Idrissi','Lundi','Concernant...','prof',False)]
    for i,(name,date,prev,role,active) in enumerate(contacts):
        y=8.55-i*1.35
        if active: bx(a,0,y-1.15,3.8,1.2,fc=ACTBG,ec='none',z=2)
        if active: bx(a,0,y-1.15,.04,1.2,fc=PRIM,ec='none',z=4)
        av_col=SKY if role=='prof' else AMB
        ci(a,.58,y-.55,.28,fc=av_col,ec='none',z=3)
        tx(a,.58,y-.55,name[0],fs=8,b=True,c=WT,z=4)
        tx(a,1.3,y-.35,name,fs=8.5,b=True,c=WT,ha='left',z=4)
        tx(a,3.6,y-.35,date,fs=7,c=DIM2,ha='right',z=4)
        tx(a,1.3,y-.72,prev,fs=7.5,c=DIM2,ha='left',it=True,z=4)
    # Chat header
    bx(a,3.8,9.2,12.2,.8,fc=HDR,ec='none',z=2)
    ln(a,3.8,9.2,16,9.2,c=BDR,lw=.7,z=3)
    ci(a,4.55,9.6,.27,fc=SKY,ec='none',z=3)
    tx(a,4.55,9.6,'B',fs=8,b=True,c=WT,z=4)
    tx(a,5.15,9.67,'Dr. Karim Bennani',fs=9.5,b=True,c=WT,ha='left',z=4)
    tx(a,5.15,9.38,'Professeur  -  En ligne',fs=7.5,c=GRN,ha='left',z=4)
    # Messages
    tx(a,9.9,8.78,'-- Aujourd hui --',fs=7.5,c=DIM2,z=4)
    bx(a,4.05,7.65,5.8,.62,fc='#0d0d20',ec=BDR,lw=.5,z=3)
    tx(a,4.22,7.96,'Bonjour, concernant la presence d Ahmed Alaoui...',fs=8,ha='left',c=WT,z=4)
    tx(a,4.22,7.7,'08:32',fs=7,ha='left',c=DIM2,z=4)
    bx(a,9.95,6.5,5.7,.62,fc=PRIM,ec='none',z=3)
    tx(a,10.1,6.81,'Il a ete absent 3 fois cette semaine.',fs=8,ha='left',c=WT,z=4)
    tx(a,15.5,6.55,'08:35',fs=7,ha='right',c=PRIMLT,z=4)
    bx(a,4.05,5.4,5.5,.62,fc='#0d0d20',ec=BDR,lw=.5,z=3)
    tx(a,4.22,5.71,'Je vais envoyer une alerte a ses parents.',fs=8,ha='left',c=WT,z=4)
    ln(a,4.05,5.1,9.0,5.1,c=BDR,lw=.5,z=3)
    tx(a,9.6,5.1,'1 message non lu',fs=7,c=DIM2,z=4)
    # Input
    bx(a,3.8,0,12.2,.78,fc=HDR,ec='none',z=2)
    ln(a,3.8,.78,16,.78,c=BDR,lw=.7,z=3)
    bx(a,4.1,.14,10.0,.48,fc='#0d0d20',ec=BDR,lw=.7,z=3)
    tx(a,4.28,.38,'Ecrire un message...',fs=8.5,ha='left',c=DIM2,z=4)
    ci(a,15.3,.38,.28,fc=PRIM,ec='none',z=4)
    tx(a,15.3,.38,'>',fs=9,b=True,c=WT,z=5)
    sv(f,'messaging_page.png')


# =============================================================================
# MAIN
# =============================================================================
if __name__ == '__main__':
    np.random.seed(42)
    print("=== Diagrammes UML ===")
    make_uc_admin(); make_uc_prof(); make_uc_etudiant()
    make_seq_enrolment(); make_seq_attendance()
    make_activity_risk(); make_activity_voice()
    make_class(); make_db()

    print("\n=== Maquettes d'interface (theme dark) ===")
    make_page_accueil(); make_page_login(); make_page_enrolment()
    make_admin_dashboard(); make_admin_etudiants(); make_admin_etudiant_detail()
    make_admin_professeurs(); make_admin_matieres(); make_admin_sessions()
    make_admin_presences(); make_admin_notes(); make_admin_alertes()
    make_admin_bi(); make_admin_voice()
    make_prof_dashboard(); make_prof_notes()
    make_student_dashboard(); make_messaging_page()

    print(f"\nTous les fichiers ont ete generes dans : {OUT}")
