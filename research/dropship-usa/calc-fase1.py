# -*- coding: utf-8 -*-
FEE_PCT, FEE_FIX, REFUND = 0.029, 0.30, 0.05   # Stripe propio
GUM_PCT = 0.10                                  # Gumroad, 0 coste fijo

def cm(price, gumroad=False):
    fee = price*GUM_PCT if gumroad else price*FEE_PCT+FEE_FIX
    return price - fee - price*REFUND

print("MARGEN DE CONTRIBUCION DIGITAL")
print(f"{'Precio':>8}{'CM Stripe':>12}{'CM Gumroad':>12}{'% Gumroad':>11}")
for p in (97,147,197,247,297,397):
    print(f"{p:>8}{cm(p):>12.2f}{cm(p,True):>12.2f}{cm(p,True)/p:>10.0%}")

print("\n\nVEREDICTO POR CPC Y PRECIO (Gumroad, sin coste fijo)")
print("GANA = te quedas >=50% del margen | empata = cubres coste | MUERE = pierdes\n")
CPCS = [("E-commerce",1.16),("Arts&Ent",1.63),("Restaurantes",2.05),("Travel",2.14),
        ("RealEstate",2.37),("B2B",3.33),("Tech",3.80)]
print(f"{'Vertical':<14}{'CPC':>6}", end="")
for p in (147,197,297,397): print(f"{'$'+str(p):>22}", end="")
print()
for name,cpc in CPCS:
    print(f"{name:<14}{cpc:>6.2f}", end="")
    for p in (147,197,297,397):
        c = cm(p,True); out=[]
        for cvr in (0.01,0.02):
            cpa=cpc/cvr
            out.append("G" if c*0.5>=cpa else ("e" if c>=cpa else "M"))
        print(f"   1%:{out[0]}  2%:{out[1]}      ", end="")
    print()

print("\n\nPRESUPUESTO 300 EUR (~330 USD) EN DIGITAL USA")
fijo = 12 + 19   # dominio + landing (Carrd). Gumroad no cobra fijo.
ads = 330 - fijo
print(f"  dominio 12 + landing 19 = {fijo} USD fijos -> {ads} USD para publicidad")
for name,cpc in CPCS[:4]:
    clicks = ads/cpc
    print(f"\n  {name} (CPC {cpc}): {clicks:.0f} clics totales")
    for thr in (0.02,0.03):
        n=3/thr
        print(f"     umbral muerte {thr:.0%} = {n:.0f} clics/test -> {clicks/n:.1f} productos testeados")

print("\n\nEL DATO CLAVE: cuanto recupera UNA sola venta")
print(f"{'Precio':>8}{'CM':>10}{'% del gasto publicitario recuperado':>38}")
for p in (147,197,297,397):
    c=cm(p,True)
    print(f"{p:>8}{c:>10.2f}{c/ads:>37.0%}")

print("\n\nSENSIBILIDAD a 297 USD, CPC 1.63, 299 USD de ads (183 clics)")
clicks=ads/1.63
for cvr in (0.005,0.01,0.02,0.03):
    ventas=clicks*cvr; ing=ventas*cm(297,True); res=ing-ads
    print(f"  conv {cvr:>5.1%}: {ventas:>4.1f} ventas | margen {ing:>8.2f} | resultado {res:>+9.2f} USD")
