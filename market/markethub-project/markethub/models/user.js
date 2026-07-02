const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');

const userSchema = new mongoose.Schema({
  name:     { type: String, required: true, trim: true, maxlength: 100 },
  email:    { type: String, required: true, unique: true, lowercase: true, trim: true },
  phone:    { type: String, required: true, trim: true },
  password: { type: String, required: true, minlength: 6, select: false },

  role:     { type: String, enum: ['customer', 'vendor', 'admin', 'rider'], default: 'customer' },
  avatar:   { type: String, default: null },
  district: { type: String, default: '' },
  address:  { type: String, default: '' },

  isVerified:    { type: Boolean, default: false },
  isActive:      { type: Boolean, default: true },
  verifyToken:   { type: String, select: false },
  resetToken:    { type: String, select: false },
  resetExpires:  { type: Date,   select: false },

  pushSubscriptions: [{ type: Object }],
  wishlist:          [{ type: mongoose.Schema.Types.ObjectId, ref: 'Product' }],

  // Loyalty points
  points: { type: Number, default: 0 },

  lastLogin: { type: Date },
  loginCount: { type: Number, default: 0 },

}, { timestamps: true });

// Hash password before save
userSchema.pre('save', async function(next) {
  if (!this.isModified('password')) return next();
  this.password = await bcrypt.hash(this.password, 12);
  next();
});

// Compare password
userSchema.methods.comparePassword = function(plain) {
  return bcrypt.compare(plain, this.password);
};

// Omit password from JSON
userSchema.methods.toJSON = function() {
  const obj = this.toObject();
  delete obj.password;
  delete obj.verifyToken;
  delete obj.resetToken;
  delete obj.resetExpires;
  return obj;
};

module.exports = mongoose.model('User', userSchema);