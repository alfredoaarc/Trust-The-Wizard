def scenario(name, price, cogs, ship, duty_rate, duty_base, entry_fee, ret=0.05):
    duty = duty_base * duty_rate
    pay = price*0.029 + 0.30
    reserve = price*ret
    costs = cogs+ship+duty+entry_fee+pay+reserve
    cm = price-costs
    print(f"\n{name}: precio ${price}")
    print(f"  COGS {cogs:.2f} envio {ship:.2f} arancel {duty:.2f} entrada {entry_fee:.2f} pasarela {pay:.2f} devol {reserve:.2f}")
    print(f"  coste total {costs:.2f} -> margen contribucion {cm:.2f}")
    if cm <= 0:
        print("  MARGEN NEGATIVO"); return
    print(f"  CPA max (50% CM) {cm*0.5:.2f}")
    for cvr in (0.01,0.015,0.02,0.03):
        print(f"   CVR {cvr:.1%}: CPC break-even(CM total) ${cm*cvr:.3f} | CPC con techo CPA ${cm*0.5*cvr:.3f}")

# A: dropship directo China, arancel sobre valor de transaccion = precio retail
scenario("A China directo, arancel sobre RETAIL", 60, 12, 8, 0.27, 60, 10)
# B: mismo pero arancel solo sobre COGS (supuesto optimista)
scenario("B China directo, arancel sobre COGS", 60, 12, 8, 0.27, 12, 10)
# C: mundo pre-2025 sin arancel ni entrada
scenario("C Mundo 2024 sin arancel ni entrada", 60, 12, 8, 0.0, 0, 0)
# D: ticket alto desde stock en Espana
scenario("D Ticket alto, stock Espana, origen UE", 150, 30, 20, 0.10, 150, 10)

print("\n--- Presupuesto ---")
usd = 330
for plat,label in ((39,"Shopify Basic 39"),(1,"Shopify promo 1")):
    ads = usd - plat - 12 - 40
    print(f"{label}: quedan ${ads} para ads")
    for cpc in (0.68,0.88):
        clicks = ads/cpc
        print(f"   CPC ${cpc}: {clicks:.0f} clics | ventas esperadas @1% {clicks*0.01:.1f} @2% {clicks*0.02:.1f}")
        print(f"      regla de tres: 0 ventas en {clicks:.0f} clics solo descarta CVR > {3/clicks:.2%}")
