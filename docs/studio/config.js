// Einstellungen der Studio-Seite.
window.STUDIO_CONFIG = {
  // Bestell-Endpunkt (Cloudflare-Worker des Selfie-Bots). Leer = Bestellen ausgeschaltet.
  orderUrl: "https://selfie-bot.5hitcake92.workers.dev/order",
  // Bezahl-Link (Ko-fi-Shop-Artikel). Die Bestellnummer gibt der Kunde in der Nachricht an.
  payUrl: "https://ko-fi.com/5hitcake",
  // Erst auf true setzen, wenn Impressum + Datenschutzerklaerung vollstaendig sind.
  ordersOpen: false,
};
