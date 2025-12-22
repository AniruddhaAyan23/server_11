import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import { connectDB } from './config/db.js';
import authRoutes from './routes/auth.js';
import assetRoutes from './routes/assets.js';
import requestRoutes from './routes/requests.js';
import employeeRoutes from './routes/employees.js';
import packageRoutes from './routes/packages.js';
import paymentRoutes from './routes/payments.js';

dotenv.config();

const app = express();
const PORT = process.env.PORT || 5000;