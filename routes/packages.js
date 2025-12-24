import express from 'express';
import { getDB } from '../config/db.js';
import { verifyToken } from '../middleware/verifyToken.js';

const router = express.Router();

// Get all packages
router.get('/', verifyToken, async (req, res) => {
  try {
    const db = getDB();
    
    const packages = await db.collection('packages')
      .find({})
      .sort({ price: 1 })
      .toArray();

    res.json({ packages });
  } catch (error) {
    console.error('Get packages error:', error);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

// Get current user's package info
router.get('/my-package', verifyToken, async (req, res) => {
  try {
    const db = getDB();
    
    const user = await db.collection('users').findOne(
      { email: req.user.email },
      { projection: { packageLimit: 1, currentEmployees: 1, subscription: 1 } }
    );

    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    res.json({ 
      packageLimit: user.packageLimit || 5,
      currentEmployees: user.currentEmployees || 0,
      subscription: user.subscription || 'basic'
    });
  } catch (error) {
    console.error('Get my package error:', error);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

export default router;