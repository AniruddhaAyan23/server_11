import express from 'express';
import { ObjectId } from 'mongodb';
import { getDB } from '../config/db.js';
import { verifyToken } from '../middleware/verifyToken.js';
import { verifyHR } from '../middleware/verifyHR.js';

const router = express.Router();

// Create Asset Request (Employee)
router.post('/', verifyToken, async (req, res) => {
  try {
    const db = getDB();
    const { assetId, note } = req.body;

    if (!assetId) {
      return res.status(400).json({ message: 'Asset ID is required' });
    }

    if (!ObjectId.isValid(assetId)) {
      return res.status(400).json({ message: 'Invalid asset ID' });
    }

    // Get asset details
    const asset = await db.collection('assets').findOne({ _id: new ObjectId(assetId) });
    
    if (!asset) {
      return res.status(404).json({ message: 'Asset not found' });
    }

    if (asset.availableQuantity <= 0) {
      return res.status(400).json({ message: 'Asset not available' });
    }

    // Get employee details
    const employee = await db.collection('users').findOne({ email: req.user.email });

    // Check if already requested
    const existingRequest = await db.collection('requests').findOne({
      assetId: new ObjectId(assetId),
      requesterEmail: req.user.email,
      requestStatus: 'pending'
    });

    if (existingRequest) {
      return res.status(400).json({ message: 'You already have a pending request for this asset' });
    }

    // Create request
    const request = {
      assetId: new ObjectId(assetId),
      assetName: asset.productName,
      assetType: asset.productType,
      assetImage: asset.productImage,
      requesterName: employee.name,
      requesterEmail: req.user.email,
      hrEmail: asset.hrEmail,
      companyName: asset.companyName,
      requestDate: new Date(),
      approvalDate: null,
      requestStatus: 'pending',
      note: note || '',
      processedBy: null
    };

    const result = await db.collection('requests').insertOne(request);

    res.status(201).json({ 
      message: 'Asset request submitted successfully',
      requestId: result.insertedId
    });
  } catch (error) {
    console.error('Create request error:', error);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

// Get all requests for HR
router.get('/hr-requests', verifyHR, async (req, res) => {
  try {
    const db = getDB();
    const { status, page = 1, limit = 10 } = req.query;

    const query = { hrEmail: req.user.email };
    
    if (status && status !== 'all') {
      query.requestStatus = status;
    }

    const skip = (parseInt(page) - 1) * parseInt(limit);

    const requests = await db.collection('requests')
      .find(query)
      .sort({ requestDate: -1 })
      .skip(skip)
      .limit(parseInt(limit))
      .toArray();

    const total = await db.collection('requests').countDocuments(query);

    res.json({ 
      requests,
      totalPages: Math.ceil(total / parseInt(limit)),
      currentPage: parseInt(page),
      totalRequests: total
    });
  } catch (error) {
    console.error('Get HR requests error:', error);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

// Get employee's requests
router.get('/my-requests', verifyToken, async (req, res) => {
  try {
    const db = getDB();
    
    const requests = await db.collection('requests')
      .find({ requesterEmail: req.user.email })
      .sort({ requestDate: -1 })
      .toArray();

    res.json({ requests });
  } catch (error) {
    console.error('Get my requests error:', error);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

// Approve Request (HR only)
router.put('/:id/approve', verifyHR, async (req, res) => {
  try {
    const db = getDB();
    const { id } = req.params;

    if (!ObjectId.isValid(id)) {
      return res.status(400).json({ message: 'Invalid request ID' });
    }

    const request = await db.collection('requests').findOne({
      _id: new ObjectId(id),
      hrEmail: req.user.email
    });

    if (!request) {
      return res.status(404).json({ message: 'Request not found' });
    }

    if (request.requestStatus !== 'pending') {
      return res.status(400).json({ message: 'Request already processed' });
    }

    // Check asset availability
    const asset = await db.collection('assets').findOne({ _id: request.assetId });
    
    if (!asset || asset.availableQuantity <= 0) {
      return res.status(400).json({ message: 'Asset no longer available' });
    }

    // Get HR user to check employee limit
    const hrUser = await db.collection('users').findOne({ email: req.user.email });

    // Check if employee is already affiliated
    const affiliation = await db.collection('employeeAffiliations').findOne({
      employeeEmail: request.requesterEmail,
      hrEmail: req.user.email,
      status: 'active'
    });

    // If not affiliated, check if HR has reached employee limit
    if (!affiliation) {
      const currentEmployeeCount = await db.collection('employeeAffiliations').countDocuments({
        hrEmail: req.user.email,
        status: 'active'
      });

      if (currentEmployeeCount >= hrUser.packageLimit) {
        return res.status(400).json({ 
          message: 'Employee limit reached. Please upgrade your package.' 
        });
      }

      // Create affiliation
      await db.collection('employeeAffiliations').insertOne({
        employeeEmail: request.requesterEmail,
        employeeName: request.requesterName,
        hrEmail: req.user.email,
        companyName: hrUser.companyName,
        companyLogo: hrUser.companyLogo,
        affiliationDate: new Date(),
        status: 'active'
      });

      // Update HR's current employee count
      await db.collection('users').updateOne(
        { email: req.user.email },
        { $inc: { currentEmployees: 1 } }
      );
    }

    // Update request status
    await db.collection('requests').updateOne(
      { _id: new ObjectId(id) },
      { 
        $set: { 
          requestStatus: 'approved',
          approvalDate: new Date(),
          processedBy: req.user.email
        } 
      }
    );

    // Decrease available quantity
    await db.collection('assets').updateOne(
      { _id: request.assetId },
      { $inc: { availableQuantity: -1 } }
    );

    // Add to assigned assets
    await db.collection('assignedAssets').insertOne({
      assetId: request.assetId,
      assetName: request.assetName,
      assetImage: request.assetImage,
      assetType: request.assetType,
      employeeEmail: request.requesterEmail,
      employeeName: request.requesterName,
      hrEmail: req.user.email,
      companyName: hrUser.companyName,
      assignmentDate: new Date(),
      returnDate: null,
      status: 'assigned'
    });

    res.json({ message: 'Request approved successfully' });
  } catch (error) {
    console.error('Approve request error:', error);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

// Reject Request (HR only)
router.put('/:id/reject', verifyHR, async (req, res) => {
  try {
    const db = getDB();
    const { id } = req.params;

    if (!ObjectId.isValid(id)) {
      return res.status(400).json({ message: 'Invalid request ID' });
    }

    const request = await db.collection('requests').findOne({
      _id: new ObjectId(id),
      hrEmail: req.user.email
    });

    if (!request) {
      return res.status(404).json({ message: 'Request not found' });
    }

    if (request.requestStatus !== 'pending') {
      return res.status(400).json({ message: 'Request already processed' });
    }

    await db.collection('requests').updateOne(
      { _id: new ObjectId(id) },
      { 
        $set: { 
          requestStatus: 'rejected',
          processedBy: req.user.email,
          approvalDate: new Date()
        } 
      }
    );

    res.json({ message: 'Request rejected' });
  } catch (error) {
    console.error('Reject request error:', error);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

// Return Asset (Employee) - Optional feature
router.put('/return/:assignmentId', verifyToken, async (req, res) => {
  try {
    const db = getDB();
    const { assignmentId } = req.params;

    if (!ObjectId.isValid(assignmentId)) {
      return res.status(400).json({ message: 'Invalid assignment ID' });
    }

    const assignment = await db.collection('assignedAssets').findOne({
      _id: new ObjectId(assignmentId),
      employeeEmail: req.user.email,
      status: 'assigned'
    });

    if (!assignment) {
      return res.status(404).json({ message: 'Assignment not found' });
    }

    if (assignment.assetType !== 'Returnable') {
      return res.status(400).json({ message: 'This asset is not returnable' });
    }

    // Update assignment status
    await db.collection('assignedAssets').updateOne(
      { _id: new ObjectId(assignmentId) },
      { 
        $set: { 
          status: 'returned',
          returnDate: new Date()
        } 
      }
    );

    // Increase available quantity
    await db.collection('assets').updateOne(
      { _id: assignment.assetId },
      { $inc: { availableQuantity: 1 } }
    );

    // Update request status
    await db.collection('requests').updateOne(
      {
        assetId: assignment.assetId,
        requesterEmail: req.user.email,
        requestStatus: 'approved'
      },
      { $set: { requestStatus: 'returned' } }
    );

    res.json({ message: 'Asset returned successfully' });
  } catch (error) {
    console.error('Return asset error:', error);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

export default router;