const mongoose = require('mongoose');

const orderItemSchema = new mongoose.Schema({
  product:   { type: mongoose.Schema.Types.ObjectId, ref: 'Product' },
  name:      { type: String, required: true },
  emoji:     { type: String },
  quantity:  { type: Number, required: true, min: 1 },
  price:     { type: Number, required: true },
  vendor:    { type: mongoose.Schema.Types.ObjectId, ref: 'Vendor' },
  vendorName: { type: String },
});

const orderSchema = new mongoose.Schema({
  ref: {
    type: String,
    unique: true,
    default: () => 'MH-' + Math.random().toString(36).substr(2, 7).toUpperCase()
  },

  user:    { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
  // Guest fields (when no account)
  guestName:    { type: String },
  guestPhone:   { type: String },
  guestEmail:   { type: String },

  items: [orderItemSchema],

  // Delivery
  delivery: {
    name:     { type: String, required: true },
    phone:    { type: String, required: true },
    email:    { type: String },
    district: { type: String, required: true },
    address:  { type: String, required: true },
    notes:    { type: String },
    fee:      { type: Number, default: 0 },
    estimatedDate: { type: Date },
    zone:     { type: String, enum: ['kampala','wakiso','national'], default: 'national' },
  },

  // Payment
  payment: {
    method:   { type: String, enum: ['mtn_momo','airtel_money','card','cash'], required: true },
    status:   { type: String, enum: ['pending','confirmed','failed','refunded'], default: 'pending' },
    paidAt:   { type: Date },
    reference: { type: String },
    amount:   { type: Number },
    // For mobile money
    momoNumber: { type: String },
    // For card
    cardLast4: { type: String },
  },

  // Pricing
  subtotal: { type: Number, required: true },
  total:    { type: Number, required: true },

  // Status
  status: {
    type: String,
    enum: ['pending','confirmed','preparing','out_for_delivery','delivered','cancelled','returned'],
    default: 'pending'
  },

  statusHistory: [{
    status:    { type: String },
    note:      { type: String },
    updatedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    at:        { type: Date, default: Date.now },
  }],

  rider:    { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
  riderNote: { type: String },

  cancelReason: { type: String },
  returnReason: { type: String },

}, { timestamps: true });

// Indexes
orderSchema.index({ ref: 1 });
orderSchema.index({ user: 1, createdAt: -1 });
orderSchema.index({ status: 1 });
orderSchema.index({ 'payment.method': 1 });

module.exports = mongoose.model('Order', orderSchema);