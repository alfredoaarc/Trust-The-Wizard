def dig(price, cur, cpcs, refund=0.05):
    pay = price*0.029+0.30; res = price*refund
    cm = price - pay - res
    print(f"\n{cur}{price} digital | pasarela {pay:.2f} reembolsos {res:.2f} -> CM {cur}{cm:.2f} ({cm/price:.0%}) | CPA max {cur}{cm*0.5:.2f}")
    for cpc in cpcs:
        row=f"   CPC {cur}{cpc:<5}"
        for cvr in (0.01,0.02,0.03):
            cpa=cpc/cvr
            if cm*0.5>=cpa: v="GANA"
            elif cm>=cpa:   v="empata"
            else:           v="MUERE"
            row+=f" | {cvr:.0%}: CPA {cur}{cpa:>6.1f} {v:<6}"
        print(row)

print("="*100)
print("DIGITAL EN ESPANA (Search, no Shopping). CPC search ecommerce UE ~0.38-0.44 EUR; nichos caros mas")
print("="*100)
for p in (30,50,97,197): dig(p,"EUR",(0.40,0.80,1.50))

print("\n"+"="*100)
print("DIGITAL EN USA (Search). CPC search medio USA 2026 = 2.96 USD (+12% interanual)")
print("="*100)
for p in (97,197,397): dig(p,"$",(1.50,2.96))

print("\n"+"="*100)
print("COMPARATIVA DE RIESGO: que porcentaje del capital esta en riesgo")
print("="*100)
for modelo,stock,aduana,ads in (("Fisico USA con stock",  "100%","si","si"),
                                ("Fisico ES sin stock",   "0%","no","si"),
                                ("Digital",               "0%","no","si")):
    print(f" {modelo:<24} inventario en riesgo: {stock:<5} aduanas: {aduana:<3} riesgo publicitario: {ads}")
