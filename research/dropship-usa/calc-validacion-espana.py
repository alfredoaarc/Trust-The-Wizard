print("=== UMBRAL DEL CANAL: USA vs ESPANA/UE ===")
print("Fase validacion: basta CM >= CPA (empatar). Fase beneficio: CM >= 2xCPA.\n")
print(f"{'Mercado':<10}{'CPC':>7}{'CVR':>7}{'CPA':>9}{'AOV emp.':>11}{'AOV benef.':>12}")
for m,cpc,sym in (("USA",0.68,"$"),("USA",0.88,"$"),("Espana/UE",0.36,"EUR"),("Espana/UE",0.41,"EUR")):
    for cvr in (0.01,0.02):
        cpa=cpc/cvr
        print(f"{m:<10}{cpc:>7.2f}{cvr:>7.1%}{cpa:>9.2f}{cpa/0.55:>11.0f}{2*cpa/0.55:>12.0f}")

print("\n=== CUANTOS DISPAROS COMPRAN 300 EUR EN ESPANA ===")
print("Regla de tres: 0 ventas en N clics descarta CVR > 3/N con 95% conf.\n")
for target in (0.02,0.03):
    n=3/target
    print(f" Umbral de muerte {target:.0%} -> {n:.0f} clics por producto")
    for cpc in (0.36,0.41):
        coste=n*cpc
        print(f"   CPC {cpc} EUR: {coste:.0f} EUR por test")

print("\n=== REPARTO 300 EUR (validacion, sin comprar stock) ===")
plan=[("Dominio .com 1 ano",12),("Shopify 3 meses promo 1 EUR/mes",3),
      ("Colchon plataforma mes 4 si sobrevive",0),("Reserva para COGS 1a venta",45)]
fijo=sum(c for _,c in plan)
for n,c in plan: print(f"  {n:<42}{c:>6} EUR")
ads=300-fijo
print(f"  {'PUBLICIDAD':<42}{ads:>6} EUR")
print(f"\n  Con CPC 0.36 EUR -> {ads/0.36:.0f} clics totales")
for target in (0.02,0.03):
    n=3/target; print(f"   = {ads/(n*0.36):.1f} productos testeados a umbral {target:.0%}")

print("\n=== RIESGO DE PERDIDA TOTAL ===")
print(" Comprando stock por adelantado : 100% del capital en riesgo si el producto falla")
print(" Sin stock, COGS solo tras venta : solo el gasto publicitario esta en riesgo")
print(f" Peor caso realista: {ads} EUR de ads sin ninguna venta = {ads/300:.0%} del presupuesto")
print(f" Mejor caso: producto con CM>CPA -> las ventas del test devuelven el gasto")
