import { verifyToken } from './verifyToken.js';

export const verifyHR = (req, res, next) => {
  verifyToken(req, res, () => {
    if (req.user.role !== 'hr') {
      return res.status(403).json({ 
        message: 'Access denied. HR Manager access only.' 
      });
    }
    next();
  });
};

export default verifyHR;