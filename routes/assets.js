import express from 'express';
import { ObjectId } from 'mongodb';
import { getDB } from '../config/db.js';
import { verifyHR } from '../middleware/verifyHR.js';
import { verifyToken } from '../middleware/verifyToken.js';

const router = express.Router();

// Add Asset (HR only)
router.post('/', verifyHR, async (req, res) => {
  try {
    const db = getDB();
    const { productName, productImage, productType, productQuantity } = req.body;

    if (!productName || !productImage || !productType || !productQuantity) {
      return res.status(400).json({ message: 'All fields are required' });
    }
    
    const hrUser = await db.collection('users').findOne({ email: req.user.email });

    if (!hrUser) {
      return res.status(404).json({ message: 'HR user not found' });
    }
    const asset = {
      productName,
      productImage,
      productType,
      productQuantity: parseInt(productQuantity),
      availableQuantity: parseInt(productQuantity),
      dateAdded: new Date(),
      hrEmail: req.user.email,
      companyName: hrUser.companyName
    };

    const result = await db.collection('assets').insertOne(asset);
    
    res.status(201).json({ 
      message: 'Asset added successfully', 
      assetId: result.insertedId 
    });
  } catch (error) {
    console.error('Add asset error:', error);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});
router.get('/hr-assets', verifyHR, async (req, res) => {
  try {
    const db = getDB();
    const { search, page = 1, limit = 10 } = req.query;
    
    const query = { hrEmail: req.user.email };
    
    if (search) {
      query.productName = { $regex: search, $options: 'i' };
    }

    const skip = (parseInt(page) - 1) * parseInt(limit);
    
    const assets = await db.collection('assets')
      .find(query)
      .sort({ dateAdded: -1 })
      .skip(skip)
      .limit(parseInt(limit))
      .toArray();
    const total = await db.collection('assets').countDocuments(query);

    res.json({ 
      assets, 
      totalPages: Math.ceil(total / parseInt(limit)),
      currentPage: parseInt(page),
      totalAssets: total
    });
  } catch (error) {
    console.error('Get HR assets error:', error);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});
router.get('/available', verifyToken, async (req, res) => {
  try {
    const db = getDB();
    const { search, type } = req.query;
    
    const query = { availableQuantity: { $gt: 0 } };
    
    if (search) {
      query.productName = { $regex: search, $options: 'i' };
    }
    
    if (type && type !== 'all') {
      query.productType = type;
    }

    const assets = await db.collection('assets')
      .find(query)
      .sort({ dateAdded: -1 })
      .toArray();
    
    res.json({ assets });
  } catch (error) {
    console.error('Get available assets error:', error);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});