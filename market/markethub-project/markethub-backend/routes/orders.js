const express = require('express');
const router = express.Router();
const Order = require('../models/Order');
const Product = require('../models/Product');
const { protect, restrict, optionalAuth } = require('../middleware/auth');

// Helper: calculate delivery fee
function calcDeliveryFee(district) {
  const d = (district || '').toLowerCase();
  if (d === 'kampala') return parseInt(process.env.DELIVERY_FEE_KAMPALA) || 5000;
  if (d === 'wakiso' || d === 'entebbe') return parseInt(process.env.DELIVERY_FEE_WAKISO) || 8000;
  return parseInt(process.env.DELIVERY_FEE_NATIONAL) || 15000;
}

function calcZone(district) {
  const d = (district || '').toLowerCase();
  if (d === 'kampala') return 'kampala';
  if (d === 'wakiso' || d === 'entebbe') return 'wakiso';
  return 'national';
}

// POST /api/orders — place a new order (guest or authenticated)
router.post('/', optionalAuth, async (req, res) => {
  try {
    const { items, delivery, payment } = req.body;
    if (!items?.length) return res.status(400).json({ error: 'Order must have at least one item.' });
    if (!delivery?.name || !delivery?.phone || !delivery?.district || !delivery?.address)
      return res.status(400).json({ error: 'Delivery details are incomplete.' });
    if (!payment?.method)
      return res.status(400).json({ error: 'Payment method is required.' });
    if (!['mtn_momo','airtel_money','card','cash'].includes(payment.method))
      return res.status(400).json({ error: 'Invalid payment method.' });

    // Validate items and resolve prices from DB
    const resolvedItems = [];
    let subtotal = 0;
    for (const item of items) {
      if (item.product) {
        const p = await Product.findById(item.product).populate('vendor','name');
        if (!p || !p.isActive) return res.status(400).json({ error: `Product not available: ${item.name}` });
        if (p.stock < item.quantity) return res.status(400).json({ error: `Insufficient stock for: ${p.name}` });
        resolvedItems.push({ product: p._id, name: p.name, emoji: p.emoji, quantity: item.quantity, price: p.price, vendor: p.vendor._id, vendorName: p.vendor.name });
        subtotal += p.price * item.quantity;
        // Decrement stock
        await Product.findByIdAndUpdate(p._id, { $inc: { stock: -item.quantity, sales: item.quantity } });
      } else {
        // Guest/offline item (no product ID)
        resolvedItems.push({ name: item.name, emoji: item.emoji, quantity: item.quantity, price: item.price });
        subtotal += item.price * item.quantity;
      }
    }

    const deliveryFee = subtotal >= (parseInt(process.env.FREE_DELIVERY_THRESHOLD) || 200000) ? 0 : calcDeliveryFee(delivery.district);
    const total = subtotal + deliveryFee;

    const estimatedDate = new Date();
    estimatedDate.setDate(estimatedDate.getDate() + (calcZone(delivery.district) === 'kampala' ? 0 : 2));

    const order = await Order.create({
      user: req.user?._id || null,
      guestName: req.user ? undefined : delivery.name,
      guestPhone: req.user ? undefined : delivery.phone,
      guestEmail: req.user ? undefined : delivery.email,
      items: resolvedItems,
      delivery: { ...delivery, fee: deliveryFee, zone: calcZone(delivery.district), estimatedDate },
      payment: { method: payment.method, momoNumber: payment.momoNumber, status: 'pending' },
      subtotal,
      total,
      status: 'pending',
      statusHistory: [{ status: 'pending', note: 'Order placed' }],
    });

    // TODO: Send confirmation email/SMS/push notification
    // await sendOrderConfirmation(order);

    res.status(201).json({ success: true, ref: order.ref, orderId: order._id, total: order.total, estimatedDate: order.delivery.estimatedDate });
  } catch (err) {
    console.error('[Orders] Create error:', err);
    res.status(500).json({ error: err.message });
  }
});

// GET /api/orders — my orders (authenticated)
router.get('/', protect, async (req, res) => {
  try {
    const { page = 1, limit = 10, status } = req.query;
    const filter = { user: req.user._id };
    if (status) filter.status = status;

    const [orders, total] = await Promise.all([
      Order.find(filter).sort('-createdAt').skip((page - 1) * limit).limit(Number(limit)).lean(),
      Order.countDocuments(filter),
    ]);
    res.json({ success: true, orders, total, pages: Math.ceil(total / limit) });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/orders/track/:ref — track by ref (no auth required)
router.get('/track/:ref', async (req, res) => {
  try {
    const order = await Order.findOne({ ref: req.params.ref.toUpperCase() })
      .select('-guestEmail -payment.momoNumber')
      .populate('rider', 'name phone');
    if (!order) return res.status(404).json({ error: 'Order not found. Check your reference number.' });
    res.json({ success: true, order });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/orders/:id — single order (owner or admin/rider)
router.get('/:id', protect, async (req, res) => {
  try {
    const order = await Order.findById(req.params.id).populate('items.product', 'name images').populate('rider', 'name phone');
    if (!order) return res.status(404).json({ error: 'Order not found.' });
    if (order.user?.toString() !== req.user._id.toString() && !['admin','rider'].includes(req.user.role))
      return res.status(403).json({ error: 'Access denied.' });
    res.json({ success: true, order });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// PATCH /api/orders/:id/status — admin or rider
router.patch('/:id/status', protect, restrict('admin', 'rider'), async (req, res) => {
  try {
    const { status, note } = req.body;
    const validStatuses = ['confirmed','preparing','out_for_delivery','delivered','cancelled','returned'];
    if (!validStatuses.includes(status)) return res.status(400).json({ error: 'Invalid status.' });

    const order = await Order.findById(req.params.id);
    if (!order) return res.status(404).json({ error: 'Order not found.' });

    order.status = status;
    order.statusHistory.push({ status, note: note || '', updatedBy: req.user._id });
    if (status === 'delivered') {
      order.payment.status = 'confirmed';
      order.payment.paidAt = new Date();
    }
    await order.save();

    // TODO: Push notification to customer
    res.json({ success: true, order });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// PATCH /api/orders/:id/cancel — customer cancels (pending only)
router.patch('/:id/cancel', protect, async (req, res) => {
  try {
    const order = await Order.findOne({ _id: req.params.id, user: req.user._id });
    if (!order) return res.status(404).json({ error: 'Order not found.' });
    if (!['pending','confirmed'].includes(order.status)) return res.status(400).json({ error: 'Order cannot be cancelled at this stage.' });

    order.status = 'cancelled';
    order.cancelReason = req.body.reason || 'Cancelled by customer';
    order.statusHistory.push({ status: 'cancelled', note: order.cancelReason, updatedBy: req.user._id });
    await order.save();

    // Restore stock
    for (const item of order.items) {
      if (item.product) await Product.findByIdAndUpdate(item.product, { $inc: { stock: item.quantity, sales: -item.quantity } });
    }

    res.json({ success: true, message: 'Order cancelled.' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/orders/admin/all — admin
router.get('/admin/all', protect, restrict('admin'), async (req, res) => {
  try {
    const { page = 1, limit = 20, status, district, payment } = req.query;
    const filter = {};
    if (status) filter.status = status;
    if (district) filter['delivery.district'] = new RegExp(district, 'i');
    if (payment) filter['payment.method'] = payment;

    const [orders, total] = await Promise.all([
      Order.find(filter).sort('-createdAt').skip((page-1)*limit).limit(Number(limit)).populate('user','name phone').populate('rider','name'),
      Order.countDocuments(filter),
    ]);
    res.json({ success: true, orders, total, pages: Math.ceil(total/limit) });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;