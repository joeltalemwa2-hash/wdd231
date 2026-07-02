const express = require('express');
const router = express.Router();
const Product = require('../models/Product');
const { protect, restrict, optionalAuth } = require('../middleware/auth');

// GET /api/products — list with filter, sort, search, pagination
router.get('/', optionalAuth, async (req, res) => {
  try {
    const { category, vendor, badge, search, featured, sort = '-createdAt', page = 1, limit = 20, minPrice, maxPrice } = req.query;
    const filter = { isActive: true };

    if (category) filter.category = category;
    if (vendor)   filter.vendor   = vendor;
    if (badge)    filter.badge    = badge;
    if (featured === 'true') filter.isFeatured = true;
    if (minPrice || maxPrice) {
      filter.price = {};
      if (minPrice) filter.price.$gte = Number(minPrice);
      if (maxPrice) filter.price.$lte = Number(maxPrice);
    }
    if (search) filter.$text = { $search: search };

    const sortMap = {
      'price-asc': { price: 1 }, 'price-desc': { price: -1 },
      'rating': { rating: -1 }, 'reviews': { reviewCount: -1 },
      'newest': { createdAt: -1 }, 'popular': { sales: -1 },
    };
    const sortObj = sortMap[sort] || { createdAt: -1 };

    const skip = (Number(page) - 1) * Number(limit);
    const [products, total] = await Promise.all([
      Product.find(filter).populate('vendor', 'name slug emoji isVerified').sort(sortObj).skip(skip).limit(Number(limit)).lean(),
      Product.countDocuments(filter),
    ]);

    res.json({
      success: true,
      total,
      page: Number(page),
      pages: Math.ceil(total / Number(limit)),
      products,
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/products/featured
router.get('/featured', async (req, res) => {
  try {
    const products = await Product.find({ isFeatured: true, isActive: true })
      .populate('vendor', 'name slug emoji isVerified')
      .sort('-sales').limit(8).lean();
    res.json({ success: true, products });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/products/categories
router.get('/categories', async (req, res) => {
  try {
    const cats = await Product.aggregate([
      { $match: { isActive: true } },
      { $group: { _id: '$category', count: { $sum: 1 } } },
      { $sort: { count: -1 } },
    ]);
    res.json({ success: true, categories: cats.map(c => ({ name: c._id, count: c.count })) });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/products/:id
router.get('/:id', optionalAuth, async (req, res) => {
  try {
    const product = await Product.findOne({
      $or: [{ _id: req.params.id.match(/^[0-9a-fA-F]{24}$/) ? req.params.id : null }, { slug: req.params.id }],
      isActive: true,
    }).populate('vendor', 'name slug emoji rating isVerified district').populate('reviews.user', 'name avatar');

    if (!product) return res.status(404).json({ error: 'Product not found.' });

    // Increment view count
    Product.findByIdAndUpdate(product._id, { $inc: { views: 1 } }).catch(() => {});

    res.json({ success: true, product });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/products — vendor/admin only
router.post('/', protect, restrict('vendor', 'admin'), async (req, res) => {
  try {
    const product = await Product.create({ ...req.body, vendor: req.user.vendorId || req.body.vendor });
    res.status(201).json({ success: true, product });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

// PUT /api/products/:id — vendor (own) or admin
router.put('/:id', protect, restrict('vendor', 'admin'), async (req, res) => {
  try {
    const product = await Product.findByIdAndUpdate(req.params.id, req.body, { new: true, runValidators: true });
    if (!product) return res.status(404).json({ error: 'Product not found.' });
    res.json({ success: true, product });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

// DELETE /api/products/:id
router.delete('/:id', protect, restrict('vendor', 'admin'), async (req, res) => {
  try {
    await Product.findByIdAndUpdate(req.params.id, { isActive: false });
    res.json({ success: true, message: 'Product removed.' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/products/:id/reviews
router.post('/:id/reviews', protect, async (req, res) => {
  try {
    const { rating, comment } = req.body;
    if (!rating || rating < 1 || rating > 5) return res.status(400).json({ error: 'Rating must be 1–5.' });

    const product = await Product.findById(req.params.id);
    if (!product) return res.status(404).json({ error: 'Product not found.' });

    const already = product.reviews.find(r => r.user.toString() === req.user._id.toString());
    if (already) return res.status(409).json({ error: 'You have already reviewed this product.' });

    product.reviews.push({ user: req.user._id, name: req.user.name, rating: Number(rating), comment });
    product.calcRating();
    await product.save();

    res.status(201).json({ success: true, rating: product.rating, reviewCount: product.reviewCount });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;