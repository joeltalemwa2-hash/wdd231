const mongoose = require('mongoose');

const reviewSchema = new mongoose.Schema({
  user:    { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  name:    { type: String, required: true },
  rating:  { type: Number, required: true, min: 1, max: 5 },
  comment: { type: String, maxlength: 1000 },
  verified: { type: Boolean, default: false }, // verified purchase
}, { timestamps: true });

const productSchema = new mongoose.Schema({
  name:        { type: String, required: true, trim: true, maxlength: 200 },
  slug:        { type: String, unique: true, lowercase: true },
  description: { type: String, required: true, maxlength: 3000 },
  shortDesc:   { type: String, maxlength: 200 },

  category: {
    type: String,
    required: true,
    enum: ['Fashion','Food','Home & Living','Beauty','Electronics','Art & Crafts','Health','Books','Sports','Other']
  },
  subcategory: { type: String, default: '' },
  tags:        [{ type: String }],
  emoji:       { type: String, default: '🛍️' },

  vendor:   { type: mongoose.Schema.Types.ObjectId, ref: 'Vendor', required: true },
  images:   [{ type: String }],
  thumbnail: { type: String },

  price:    { type: Number, required: true, min: 0 },
  oldPrice: { type: Number, default: null },
  currency: { type: String, default: 'UGX' },

  stock:    { type: Number, default: 100, min: 0 },
  sku:      { type: String, default: '' },
  weight:   { type: Number, default: 0 }, // grams
  dimensions: { length: Number, width: Number, height: Number },

  badge:    { type: String, enum: ['new', 'sale', 'trending', 'bestseller', null], default: null },
  isFeatured: { type: Boolean, default: false },
  isActive:   { type: Boolean, default: true },

  reviews:     [reviewSchema],
  rating:      { type: Number, default: 0 },
  reviewCount: { type: Number, default: 0 },

  views:    { type: Number, default: 0 },
  sales:    { type: Number, default: 0 },

}, { timestamps: true });

// Auto-generate slug
productSchema.pre('save', function(next) {
  if (!this.slug || this.isModified('name')) {
    this.slug = this.name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');
  }
  next();
});

// Recalculate rating on review add
productSchema.methods.calcRating = function() {
  if (!this.reviews.length) { this.rating = 0; this.reviewCount = 0; return; }
  this.rating = Math.round((this.reviews.reduce((s, r) => s + r.rating, 0) / this.reviews.length) * 10) / 10;
  this.reviewCount = this.reviews.length;
};

// Indexes
productSchema.index({ name: 'text', description: 'text', tags: 'text' });
productSchema.index({ category: 1, isActive: 1 });
productSchema.index({ vendor: 1 });
productSchema.index({ isFeatured: 1, isActive: 1 });
productSchema.index({ price: 1 });

module.exports = mongoose.model('Product', productSchema);