const express = require('express');
const router = express.Router();
const Order = require('../models/Order');
const { protect, restrict } = require('../middleware/auth');

// ===== MTN Mobile Money (Pay on Delivery confirmation) =====
// NOTE: For live MTN MoMo, use the MTN MoMo API:
// https://momodeveloper.mtn.com/
// For POD, we just record the method; payment is confirmed by rider.

// POST /api/payments/mtn/initiate
router.post('/mtn/initiate', async (req, res) => {
  try {
    const { orderId, msisdn, amount } = req.body;
    if (!orderId || !msisdn || !amount) return res.status(400).json({ error: 'orderId, msisdn and amount required.' });

    // In production: call MTN MoMo Collection API here
    // For now: record intent and return success
    const order = await Order.findById(orderId);
    if (!order) return res.status(404).json({ error: 'Order not found.' });

    order.payment.momoNumber = msisdn;
    order.payment.status = 'pending';
    order.payment.reference = 'MTN-' + Date.now();
    await order.save({ validateBeforeSave: false });

    // Simulate MTN API response
    res.json({
      success: true,
      message: 'MTN MoMo payment will be collected on delivery.',
      reference: order.payment.reference,
      instructions: `The rider will request payment to their MTN MoMo number. Confirm the push on ${msisdn}.`,
      // In production: { financialTransactionId, status }
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/payments/mtn/callback — MTN webhook (production)
router.post('/mtn/callback', async (req, res) => {
  try {
    // Validate MTN callback signature in production
    const { externalId, status, financialTransactionId } = req.body;
    if (status === 'SUCCESSFUL') {
      await Order.findOneAndUpdate(
        { 'payment.reference': externalId },
        { 'payment.status': 'confirmed', 'payment.paidAt': new Date(), 'payment.reference': financialTransactionId }
      );
    }
    res.status(200).json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ===== Airtel Money =====
// POST /api/payments/airtel/initiate
router.post('/airtel/initiate', async (req, res) => {
  try {
    const { orderId, msisdn, amount } = req.body;
    const order = await Order.findById(orderId);
    if (!order) return res.status(404).json({ error: 'Order not found.' });

    order.payment.momoNumber = msisdn;
    order.payment.reference = 'ATL-' + Date.now();
    await order.save({ validateBeforeSave: false });

    res.json({
      success: true,
      message: 'Airtel Money payment will be collected on delivery.',
      reference: order.payment.reference,
      instructions: `Rider will send an Airtel Money request to ${msisdn} on arrival.`,
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ===== Card POS (Pay on Delivery) =====
// POST /api/payments/card/confirm — rider confirms card payment via POS
router.post('/card/confirm', protect, restrict('rider', 'admin'), async (req, res) => {
  try {
    const { orderId, posReference, last4 } = req.body;
    const order = await Order.findById(orderId);
    if (!order) return res.status(404).json({ error: 'Order not found.' });
    if (order.payment.method !== 'card') return res.status(400).json({ error: 'Order not set for card payment.' });

    order.payment.status = 'confirmed';
    order.payment.paidAt = new Date();
    order.payment.reference = posReference;
    order.payment.cardLast4 = last4;
    order.status = 'delivered';
    order.statusHistory.push({ status: 'delivered', note: `Card payment confirmed. POS ref: ${posReference}`, updatedBy: req.user._id });
    await order.save();

    res.json({ success: true, message: 'Card payment confirmed and order marked delivered.' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ===== Cash on Delivery confirmation =====
// POST /api/payments/cash/confirm — rider confirms cash received
router.post('/cash/confirm', protect, restrict('rider', 'admin'), async (req, res) => {
  try {
    const { orderId, amountReceived } = req.body;
    const order = await Order.findById(orderId);
    if (!order) return res.status(404).json({ error: 'Order not found.' });
    if (order.payment.method !== 'cash') return res.status(400).json({ error: 'Order not set for cash.' });

    order.payment.status = 'confirmed';
    order.payment.paidAt = new Date();
    order.payment.amount = amountReceived;
    order.payment.reference = 'CASH-' + Date.now();
    order.status = 'delivered';
    order.statusHistory.push({ status: 'delivered', note: `Cash received: UGX ${amountReceived?.toLocaleString()}`, updatedBy: req.user._id });
    await order.save();

    res.json({ success: true, message: 'Cash payment confirmed.' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/payments/summary — admin stats
router.get('/summary', protect, restrict('admin'), async (req, res) => {
  try {
    const stats = await Order.aggregate([
      { $match: { 'payment.status': 'confirmed' } },
      { $group: { _id: '$payment.method', count: { $sum: 1 }, revenue: { $sum: '$total' } } },
      { $sort: { revenue: -1 } }
    ]);
    const totalRevenue = stats.reduce((s, i) => s + i.revenue, 0);
    res.json({ success: true, stats, totalRevenue });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;