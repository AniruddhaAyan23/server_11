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
router.get('/:id', verifyToken, async (req, res) => {
  try {
    const db = getDB();
    const { id } = req.params;

    if (!ObjectId.isValid(id)) {
      return res.status(400).json({ message: 'Invalid asset ID' });
    }

    const asset = await db.collection('assets').findOne({ _id: new ObjectId(id) });

    if (!asset) {
      return res.status(404).json({ message: 'Asset not found' });
    }

    res.json({ asset });
  } catch (error) {
    console.error('Get asset error:', error);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});
router.put('/:id', verifyHR, async (req, res) => {
  try {
    const db = getDB();
    const { id } = req.params;
    const { productName, productImage, productType, productQuantity } = req.body;

    if (!ObjectId.isValid(id)) {
      return res.status(400).json({ message: 'Invalid asset ID' });
    }

    const updateData = {
      updatedAt: new Date()
    };

    if (productName) updateData.productName = productName;
    if (productImage) updateData.productImage = productImage;
    if (productType) updateData.productType = productType;
    if (productQuantity !== undefined) {
      updateData.productQuantity = parseInt(productQuantity);
    }

    const result = await db.collection('assets').updateOne(
      { _id: new ObjectId(id), hrEmail: req.user.email },
      { $set: updateData }
    );

    if (result.matchedCount === 0) {
      return res.status(404).json({ message: 'Asset not found or unauthorized' });
    }

    res.json({ message: 'Asset updated successfully' });
  } catch (error) {
    console.error('Update asset error:', error);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});
router.delete('/:id', verifyHR, async (req, res) => {
  try {
    const db = getDB();
    const { id } = req.params;

    if (!ObjectId.isValid(id)) {
      return res.status(400).json({ message: 'Invalid asset ID' });
    }

    const result = await db.collection('assets').deleteOne({
      _id: new ObjectId(id),
      hrEmail: req.user.email
    });

    if (result.deletedCount === 0) {
      return res.status(404).json({ message: 'Asset not found or unauthorized' });
    }

    res.json({ message: 'Asset deleted successfully' });
  } catch (error) {
    console.error('Delete asset error:', error);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});