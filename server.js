import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import { connectDB } from './config/db.js';

// Import routes
import authRoutes from './routes/auth.js';
import assetRoutes from './routes/assets.js';
import requestRoutes from './routes/requests.js';
import employeeRoutes from './routes/employees.js';
import packageRoutes from './routes/packages.js';
import paymentRoutes from './routes/payments.js';

dotenv.config();

const app = express();
const PORT = process.env.PORT || 5000;

// Middleware
app.use(cors({
  origin: process.env.CLIENT_URL || 'http://localhost:5173',
  credentials: true
}));
app.use(express.json());

// Connect to MongoDB
connectDB();

// Routes
app.use('/api/auth', authRoutes);
app.use('/api/assets', assetRoutes);
app.use('/api/requests', requestRoutes);
app.use('/api/employees', employeeRoutes);
app.use('/api/packages', packageRoutes);
app.use('/api/payments', paymentRoutes);

// Health check
app.get('/', (req, res) => {
  res.json({ message: 'AssetVerse API is running' });
});

// Error handling middleware
app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(500).json({ message: 'Something went wrong!', error: err.message });
});

app.listen(PORT, () => {
  console.log(`🚀 Server running on port ${PORT}`);
});