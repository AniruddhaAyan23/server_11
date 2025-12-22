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