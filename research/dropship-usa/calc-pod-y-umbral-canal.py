def ev(name, price, cogs, ship, cpc_mkt, ret=0.05):
    pay = price*0.029+0.30; res = price*ret
    cm = price - cogs - ship - pay - res
    print(f"\n{name}  precio ${price}")
    print(f"  COGS {cogs} envio {ship} pasarela {pay:.2f} devol {res:.2f} -> CM ${cm:.2f} | CPA max ${cm*0.5:.2f}")
    for cvr in (0.01,0.02):
        cpa = cpc_mkt/cvr
        print(f"   CVR {cvr:.0%}: CPA real ${cpa:.2f} vs CPA max ${cm*0.5:.2f} -> {'VIABLE' if cm*0.5>cpa else 'MUERTO'}"
              f"  (BE CPC ${cm*cvr:.3f} vs mercado ${cpc_mkt})")

CPC=0.68
ev("POD camiseta Printify", 28, 8.00, 3.99, CPC)
ev("POD camiseta Printful", 28, 12.00, 3.99, CPC)
ev("POD taza Printify", 19.99, 3.68, 4.50, CPC)
ev("POD camiseta precio alto", 45, 8.00, 3.99, CPC)

print("\n=== LEY GENERAL: que margen exige el canal ===")
print("CPA = CPC / CVR. Para quedarte la mitad necesitas CM >= 2 x CPA.\n")
print(f"{'CPC':>6} {'CVR':>6} {'CPA':>8} {'CM min':>9} {'AOV @55% margen':>17}")
for cpc in (0.68,0.88):
    for cvr in (0.01,0.015,0.02,0.03):
        cpa=cpc/cvr; cm=2*cpa
        print(f"{cpc:>6} {cvr:>6.1%} {cpa:>8.2f} {cm:>9.2f} {cm/0.55:>17.0f}")
