const mongoose = require('mongoose');

const vendorSchema = new mongoose.Schema({
  user:        { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, unique: true },
  name:        { type: String, required: true, trim: true },
  slug:        { type: String, unique: true, lowercase: true },
  description: { type: String, maxlength: 2000 },
  logo:        { type: String },
  coverImage:  { type: String },
  emoji:       { type: String, default: '🏪' },
  category:    { type: String, required: true },
  district:    { type: String, required: true },
  address:     { type: String },
  phone:       { type: String, required: true },
  email:       { type: String },
  website:     { type: String },
  since:       { type: Number, default: () => new Date().getFullYear() },

  // Verification
  isVerified:  { type: Boolean, default: false },
  isActive:    { type: Boolean, default: true },
  verifiedAt:  { type: Date },
  documents:   [{ type: String }], // uploaded NIN / business registration docs

  // Payout
  payout: {
    method:     { type: String, enum: ['mtn_momo','airtel_money','bank'], default: 'mtn_momo' },
    number:     { type: String }, // MoMo / Airtel number or bank account
    bankName:   { type: String },
    accountName: { type: String },
  },

  // Stats (denormalised for performance)
  productCount: { type: Number, default: 0 },
  totalSales:   { type: Number, default: 0 },
  totalRevenue: { type: Number, default: 0 },
  rating:       { type: Number, default: 0 },
  reviewCount:  { type: Number, default: 0 },

  commissionRate: { type: Number, default: 0.08 }, // 8% default

  // Social
  social: {
    facebook:  { type: String },
    instagram: { type: String },
    whatsapp:  { type: String },
  },

}, { timestamps: true });

vendorSchema.pre('save', function(next) {
  if (!this.slug || this.isModified('name')) {
    this.slug = this.name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');
  }
  next();
});

vendorSchema.index({ slug: 1 });
vendorSchema.index({ isVerified: 1, isActive: 1 });
vendorSchema.index({ category: 1 });

module.exports = mongoose.model('Vendor', vendorSchema);