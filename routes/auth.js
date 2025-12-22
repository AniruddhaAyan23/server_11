import express from 'express';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { getDB } from '../config/db.js';
import { verifyToken } from '../middleware/verifyToken.js';

const router = express.Router();

// Register HR Manager
router.post('/register-hr', async (req, res) => {
  try {
    const db = getDB();
    const { name, email, password, companyName, companyLogo, dateOfBirth } = req.body;

    if (!name || !email || !password || !companyName || !companyLogo || !dateOfBirth) {
      return res.status(400).json({ message: 'All fields are required' });
    }

    if (password.length < 6) {
      return res.status(400).json({ message: 'Password must be at least 6 characters' });
    }

    const existingUser = await db.collection('users').findOne({ email });
    if (existingUser) {
      return res.status(400).json({ message: 'Email already registered' });
    }

    const hashedPassword = await bcrypt.hash(password, 10);

    const hrUser = {
      name,
      email,
      password: hashedPassword,
      role: 'hr',
      companyName,
      companyLogo,
      dateOfBirth: new Date(dateOfBirth),
      packageLimit: 5,
      currentEmployees: 0,
      subscription: 'basic',
      profileImage: companyLogo,
      createdAt: new Date(),
      updatedAt: new Date()
    };

    const result = await db.collection('users').insertOne(hrUser);
    
    const token = jwt.sign(
      { 
        userId: result.insertedId.toString(), 
        email, 
        role: 'hr',
        companyName 
      },
      process.env.JWT_SECRET,
      { expiresIn: '7d' }
    );

    res.status(201).json({ 
      message: 'HR Manager registered successfully',
      token,
      user: { 
        _id: result.insertedId,
        name,
        email,
        role: 'hr',
        companyName,
        companyLogo,
        packageLimit: 5,
        currentEmployees: 0
      }
    });
  } catch (error) {
    console.error('Register HR error:', error);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

// Register Employee
router.post('/register-employee', async (req, res) => {
  try {
    const db = getDB();
    const { name, email, password, dateOfBirth } = req.body;

    if (!name || !email || !password || !dateOfBirth) {
      return res.status(400).json({ message: 'All fields are required' });
    }

    if (password.length < 6) {
      return res.status(400).json({ message: 'Password must be at least 6 characters' });
    }

    const existingUser = await db.collection('users').findOne({ email });
    if (existingUser) {
      return res.status(400).json({ message: 'Email already registered' });
    }

    const hashedPassword = await bcrypt.hash(password, 10);

    const employee = {
      name,
      email,
      password: hashedPassword,
      role: 'employee',
      dateOfBirth: new Date(dateOfBirth),
      profileImage: 'https://i.ibb.co/hL3hMHY/default-avatar.png',
      createdAt: new Date(),
      updatedAt: new Date()
    };

    const result = await db.collection('users').insertOne(employee);
    
    const token = jwt.sign(
      { 
        userId: result.insertedId.toString(), 
        email, 
        role: 'employee' 
      },
      process.env.JWT_SECRET,
      { expiresIn: '7d' }
    );

    res.status(201).json({ 
      message: 'Employee registered successfully',
      token,
      user: { 
        _id: result.insertedId,
        name,
        email,
        role: 'employee'
      }
    });
  } catch (error) {
    console.error('Register Employee error:', error);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

// Login
router.post('/login', async (req, res) => {
  try {
    const db = getDB();
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({ message: 'Email and password are required' });
    }

    const user = await db.collection('users').findOne({ email });
    if (!user) {
      return res.status(401).json({ message: 'Invalid email or password' });
    }

    const isValidPassword = await bcrypt.compare(password, user.password);
    if (!isValidPassword) {
      return res.status(401).json({ message: 'Invalid email or password' });
    }

    const token = jwt.sign(
      { 
        userId: user._id.toString(), 
        email: user.email, 
        role: user.role,
        companyName: user.companyName || null
      },
      process.env.JWT_SECRET,
      { expiresIn: '7d' }
    );

    const { password: _, ...userWithoutPassword } = user;

    res.json({ 
      message: 'Login successful',
      token,
      user: userWithoutPassword
    });
  } catch (error) {
    console.error('Login error:', error);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

// Get current user
router.get('/me', verifyToken, async (req, res) => {
  try {
    const db = getDB();
    const user = await db.collection('users').findOne(
      { email: req.user.email },
      { projection: { password: 0 } }
    );

    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    res.json({ user });
  } catch (error) {
    console.error('Get user error:', error);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

// Update profile
router.put('/profile', verifyToken, async (req, res) => {
  try {
    const db = getDB();
    const { name, profileImage, dateOfBirth } = req.body;

    const updateData = {
      updatedAt: new Date()
    };

    if (name) updateData.name = name;
    if (profileImage) updateData.profileImage = profileImage;
    if (dateOfBirth) updateData.dateOfBirth = new Date(dateOfBirth);

    const result = await db.collection('users').updateOne(
      { email: req.user.email },
      { $set: updateData }
    );

    if (result.matchedCount === 0) {
      return res.status(404).json({ message: 'User not found' });
    }

    const updatedUser = await db.collection('users').findOne(
      { email: req.user.email },
      { projection: { password: 0 } }
    );

    res.json({ 
      message: 'Profile updated successfully',
      user: updatedUser
    });
  } catch (error) {
    console.error('Update profile error:', error);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

export default router;