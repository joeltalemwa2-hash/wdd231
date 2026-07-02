// ===== MARKETHUB UG — MAIN JS =====

// Toast
function showToast(msg, type = "") {
  const t = document.getElementById("toast");
  if (!t) return;
  t.textContent = msg;
  t.className = "toast show " + type;
  setTimeout(() => t.className = "toast", 3000);
}

// Search
function doSearch() {
  const q = document.getElementById("searchInput")?.value?.trim();
  if (q) window.location.href = "pages/products.html?q=" + encodeURIComponent(q);
}
document.getElementById("searchInput")?.addEventListener("keydown", e => { if (e.key === "Enter") doSearch(); });

// Search toggle
document.getElementById("searchToggle")?.addEventListener("click", () => {
  const bar = document.getElementById("searchBar");
  bar.classList.toggle("open");
  if (bar.classList.contains("open")) document.getElementById("searchInput")?.focus();
});

// Hamburger
document.getElementById("hamburger")?.addEventListener("click", () => {
  document.getElementById("navMain")?.classList.toggle("open");
});

// Newsletter
function subscribeNewsletter(e) {
  e.preventDefault();
  showToast("🎉 Subscribed! Check your inbox.", "success");
  e.target.reset();
}

// Wishlist toggle
function toggleWishlist(btn) {
  btn.classList.toggle("active");
  btn.textContent = btn.classList.contains("active") ? "❤️" : "🤍";
  showToast(btn.classList.contains("active") ? "Added to wishlist" : "Removed from wishlist");
}

// Render product card
function renderProductCard(p) {
  const badgeHtml = p.badge ? `<span class="product-badge ${p.badge}">${p.badge.toUpperCase()}</span>` : "";
  const oldPriceHtml = p.oldPrice ? `<span class="price-old">${formatPrice(p.oldPrice)}</span>` : "";
  return `
    <div class="product-card" data-id="${p.id}">
      <a href="pages/product-detail.html?id=${p.id}">
        <div class="product-thumb">
          ${badgeHtml}
          <button class="wishlist-btn" onclick="event.preventDefault(); toggleWishlist(this)">🤍</button>
          <span>${p.emoji}</span>
        </div>
        <div class="product-body">
          <div class="product-cat">${p.cat}</div>
          <div class="product-name">${p.name}</div>
          <div class="product-vendor">by ${p.vendor}</div>
          <div class="product-rating">${renderStars(p.rating)} <span>(${p.reviews})</span></div>
          <div class="product-price">
            <span class="price-current">${formatPrice(p.price)}</span>
            ${oldPriceHtml}
          </div>
        </div>
      </a>
      <div class="product-footer">
        <button class="btn-add-cart" onclick="addToCart(${p.id})">Add to Cart</button>
      </div>
    </div>
  `;
}

// Featured grid
const fg = document.getElementById("featuredGrid");
if (fg) fg.innerHTML = PRODUCTS.slice(0, 8).map(renderProductCard).join("");

// Init cart UI
updateCartUI();