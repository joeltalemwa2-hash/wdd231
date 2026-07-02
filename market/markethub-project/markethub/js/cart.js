// ===== CART MANAGEMENT =====

function getCart() {
  try { return JSON.parse(localStorage.getItem("mh_cart") || "[]"); } catch { return []; }
}
function saveCart(cart) {
  localStorage.setItem("mh_cart", JSON.stringify(cart));
  updateCartUI();
}
function updateCartUI() {
  const cart = getCart();
  const total = cart.reduce((s, i) => s + i.qty, 0);
  document.querySelectorAll("#cartCount, .cart-count").forEach(el => {
    el.textContent = total;
    el.style.display = total > 0 ? "flex" : "none";
  });
}
function addToCart(productId, qty = 1) {
  const product = PRODUCTS.find(p => p.id === productId);
  if (!product) return;
  const cart = getCart();
  const existing = cart.find(i => i.id === productId);
  if (existing) { existing.qty += qty; }
  else { cart.push({ id: productId, qty, name: product.name, price: product.price, emoji: product.emoji, vendor: product.vendor }); }
  saveCart(cart);
  showToast("✓ Added to cart!", "success");
}
function removeFromCart(productId) {
  const cart = getCart().filter(i => i.id !== productId);
  saveCart(cart);
}
function updateCartQty(productId, delta) {
  const cart = getCart();
  const item = cart.find(i => i.id === productId);
  if (item) {
    item.qty = Math.max(1, item.qty + delta);
    saveCart(cart);
  }
}
function clearCart() {
  saveCart([]);
}
function getCartTotal() {
  return getCart().reduce((s, i) => s + (i.price * i.qty), 0);
}