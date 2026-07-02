// ===== MARKETHUB UG — PRODUCT & VENDOR DATA =====

const PRODUCTS = [
  { id: 1, name: "Handwoven Kente Shoulder Bag", vendor: "AfriCraft UG", vendorId: "africraftug", cat: "Fashion", emoji: "👜", price: 85000, oldPrice: null, rating: 4.9, reviews: 42, badge: "new", desc: "Beautifully handwoven kente bag crafted by skilled Ugandan artisans. Durable, vibrant, and unique." },
  { id: 2, name: "Raw Karamoja Wildflower Honey 500g", vendor: "Nature's Best", vendorId: "naturesbest", cat: "Food", emoji: "🍯", price: 35000, oldPrice: null, rating: 4.9, reviews: 87, badge: null, desc: "Pure raw honey harvested from the wildflowers of Karamoja. No additives, 100% natural." },
  { id: 3, name: "Vibrant Ankara Print Wrap Dress", vendor: "FabricUG", vendorId: "fabricug", cat: "Fashion", emoji: "👘", price: 95000, oldPrice: 120000, rating: 4.3, reviews: 31, badge: "sale", desc: "Gorgeous Ankara-print wrap dress available in multiple sizes. Perfect for any occasion." },
  { id: 4, name: "Handcrafted Mahogany Side Table", vendor: "Woodcraft KLA", vendorId: "woodcraftkla", cat: "Home & Living", emoji: "🪵", price: 290000, oldPrice: null, rating: 4.9, reviews: 19, badge: null, desc: "Solid mahogany side table crafted by master woodworkers in Kampala. Built to last a lifetime." },
  { id: 5, name: "Shea & Coconut Body Butter 200ml", vendor: "Glow Naturals", vendorId: "glownaturals", cat: "Beauty", emoji: "🧴", price: 28000, oldPrice: null, rating: 4.9, reviews: 63, badge: "new", desc: "Rich body butter made with organic shea and coconut oils. Deeply moisturising, fast-absorbing." },
  { id: 6, name: "Original Ugandan Landscape Painting", vendor: "Studio Kla", vendorId: "studiokla", cat: "Art & Crafts", emoji: "🎨", price: 450000, oldPrice: null, rating: 5.0, reviews: 7, badge: null, desc: "One-of-a-kind acrylic landscape painting by Kampala-based artist. Certificate of authenticity included." },
  { id: 7, name: "Premium Bugisu Arabica Coffee 250g", vendor: "Mount Elgon Farms", vendorId: "mtelgon", cat: "Food", emoji: "☕", price: 22000, oldPrice: null, rating: 4.9, reviews: 114, badge: null, desc: "Single-origin arabica beans grown on the slopes of Mount Elgon. Rich, fruity, and aromatic." },
  { id: 8, name: "Hand-knitted Sisal Floor Basket", vendor: "Rwenzori Crafts", vendorId: "rwenzoricrafts", cat: "Art & Crafts", emoji: "🧶", price: 48000, oldPrice: 65000, rating: 4.3, reviews: 28, badge: "sale", desc: "Beautiful sisal basket hand-knitted by women's cooperatives in western Uganda." },
  { id: 9, name: "Organic Moringa Powder 100g", vendor: "Nature's Best", vendorId: "naturesbest", cat: "Health", emoji: "🌿", price: 18000, oldPrice: null, rating: 4.7, reviews: 52, badge: null, desc: "Pure organic moringa leaf powder. Rich in vitamins, minerals, and antioxidants." },
  { id: 10, name: "Beaded Maasai Bracelet Set", vendor: "AfriCraft UG", vendorId: "africraftug", cat: "Fashion", emoji: "📿", price: 25000, oldPrice: null, rating: 4.8, reviews: 76, badge: "new", desc: "Set of 3 handmade beaded bracelets inspired by traditional African patterns." },
  { id: 11, name: "Ugandan Chilli Hot Sauce 300ml", vendor: "Kampala Spice Co.", vendorId: "klaSpice", cat: "Food", emoji: "🌶️", price: 15000, oldPrice: null, rating: 4.6, reviews: 41, badge: null, desc: "Fiery homemade hot sauce crafted from fresh Ugandan chillies. Unique, bold flavour." },
  { id: 12, name: "Carved Soapstone Elephant", vendor: "Studio Kla", vendorId: "studiokla", cat: "Art & Crafts", emoji: "🐘", price: 75000, oldPrice: null, rating: 5.0, reviews: 14, badge: null, desc: "Hand-carved soapstone elephant figurine. A perfect gift or home décor piece." },
];

const VENDORS = [
  { id: "africraftug", name: "AfriCraft UG", emoji: "👜", cat: "Handmade Fashion & Accessories", products: 124, rating: 4.9, verified: true, location: "Kampala", since: 2019, desc: "Uganda's leading handmade fashion house, creating wearable art from traditional African textiles." },
  { id: "naturesbest", name: "Nature's Best", emoji: "🌿", cat: "Organic Foods & Honey", products: 48, rating: 4.8, verified: true, location: "Karamoja", since: 2020, desc: "Purveyors of Uganda's finest organic foods, sourced directly from rural farming cooperatives." },
  { id: "woodcraftkla", name: "Woodcraft KLA", emoji: "🪵", cat: "Furniture & Home Décor", products: 67, rating: 4.9, verified: true, location: "Kampala", since: 2018, desc: "Expert woodworkers crafting beautiful, durable furniture from sustainably sourced Ugandan timber." },
  { id: "mtelgon", name: "Mount Elgon Farms", emoji: "☕", cat: "Specialty Coffee & Tea", products: 29, rating: 5.0, verified: true, location: "Mbale", since: 2021, desc: "Family-owned coffee farm on the slopes of Mount Elgon, growing world-class arabica beans." },
  { id: "fabricug", name: "FabricUG", emoji: "👘", cat: "African Print Fashion", products: 85, rating: 4.3, verified: true, location: "Jinja", since: 2020, desc: "Celebrating African fashion through vibrant, high-quality ankara and kitenge creations." },
  { id: "glownaturals", name: "Glow Naturals", emoji: "✨", cat: "Natural Beauty & Skincare", products: 38, rating: 4.9, verified: true, location: "Entebbe", since: 2022, desc: "All-natural skincare products made with Uganda's finest botanical ingredients." },
  { id: "studiokla", name: "Studio Kla", emoji: "🎨", cat: "Fine Art & Sculpture", products: 22, rating: 5.0, verified: true, location: "Kampala", since: 2017, desc: "A collective of Kampala's most talented visual artists, offering original paintings and sculptures." },
  { id: "rwenzoricrafts", name: "Rwenzori Crafts", emoji: "🧶", cat: "Traditional Crafts & Basketry", products: 54, rating: 4.3, verified: true, location: "Fort Portal", since: 2019, desc: "Women's cooperative producing traditional crafts from the Rwenzori highlands." },
];

function formatPrice(p) {
  return "UGX " + p.toLocaleString("en-UG");
}

function renderStars(rating) {
  const full = Math.floor(rating);
  const half = rating % 1 >= 0.5;
  let s = "";
  for (let i = 0; i < full; i++) s += "★";
  if (half) s += "½";
  return s;
}