import express from 'express';
import { ObjectId } from 'mongodb';
import { getDB } from '../config/db.js';
import { verifyToken } from '../middleware/verifyToken.js';
import { verifyHR } from '../middleware/verifyHR.js';

const router = express.Router();

// Get my assigned assets (Employee)
router.get('/my-assets', verifyToken, async (req, res) => {
  try {
    const db = getDB();
    const { search, type } = req.query;

    const query = { 
      employeeEmail: req.user.email,
      status: 'assigned'
    };

    if (search) {
      query.assetName = { $regex: search, $options: 'i' };
    }

    if (type && type !== 'all') {
      query.assetType = type;
    }

    const assets = await db.collection('assignedAssets')
      .find(query)
      .sort({ assignmentDate: -1 })
      .toArray();

    res.json({ assets });
  } catch (error) {
    console.error('Get my assets error:', error);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

// Get my team (Employee)
router.get('/my-team', verifyToken, async (req, res) => {
  try {
    const db = getDB();

    const affiliations = await db.collection('employeeAffiliations')
      .find({ 
        employeeEmail: req.user.email,
        status: 'active'
      })
      .toArray();

    if (affiliations.length === 0) {
      return res.json({ companies: [] });
    }

    const companies = [];

    for (const affiliation of affiliations) {
      const teamAffiliations = await db.collection('employeeAffiliations')
        .find({
          hrEmail: affiliation.hrEmail,
          status: 'active',
          employeeEmail: { $ne: req.user.email }
        })
        .toArray();

      const teamMembers = [];
      for (const teamAff of teamAffiliations) {
        const employee = await db.collection('users').findOne(
          { email: teamAff.employeeEmail },
          { projection: { password: 0 } }
        );
        if (employee) {
          teamMembers.push({
            ...employee,
            affiliationDate: teamAff.affiliationDate
          });
        }
      }

      companies.push({
        companyName: affiliation.companyName,
        companyLogo: affiliation.companyLogo,
        hrEmail: affiliation.hrEmail,
        teamMembers
      });
    }

    res.json({ companies });
  } catch (error) {
    console.error('Get my team error:', error);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

// Get upcoming birthdays in team
router.get('/team-birthdays', verifyToken, async (req, res) => {
  try {
    const db = getDB();

    const affiliations = await db.collection('employeeAffiliations')
      .find({ 
        employeeEmail: req.user.email,
        status: 'active'
      })
      .toArray();

    if (affiliations.length === 0) {
      return res.json({ birthdays: [] });
    }

    const currentMonth = new Date().getMonth() + 1;
    const allBirthdays = [];

    for (const affiliation of affiliations) {
      const teamAffiliations = await db.collection('employeeAffiliations')
        .find({
          hrEmail: affiliation.hrEmail,
          status: 'active'
        })
        .toArray();

      for (const teamAff of teamAffiliations) {
        const employee = await db.collection('users').findOne(
          { email: teamAff.employeeEmail },
          { projection: { password: 0 } }
        );
        
        if (employee && employee.dateOfBirth) {
          const birthMonth = new Date(employee.dateOfBirth).getMonth() + 1;
          if (birthMonth === currentMonth) {
            allBirthdays.push({
              name: employee.name,
              email: employee.email,
              dateOfBirth: employee.dateOfBirth,
              companyName: affiliation.companyName
            });
          }
        }
      }
    }

    res.json({ birthdays: allBirthdays });
  } catch (error) {
    console.error('Get team birthdays error:', error);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

// Get my company affiliations (Employee)
router.get('/my-affiliations', verifyToken, async (req, res) => {
  try {
    const db = getDB();

    const affiliations = await db.collection('employeeAffiliations')
      .find({ 
        employeeEmail: req.user.email,
        status: 'active'
      })
      .toArray();

    res.json({ affiliations });
  } catch (error) {
    console.error('Get my affiliations error:', error);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

// Get HR's employee list (HR only)
router.get('/hr-employees', verifyHR, async (req, res) => {
  try {
    const db = getDB();
    const { search, page = 1, limit = 10 } = req.query;

    const affiliationQuery = { 
      hrEmail: req.user.email,
      status: 'active'
    };

    if (search) {
      affiliationQuery.employeeName = { $regex: search, $options: 'i' };
    }

    const skip = (parseInt(page) - 1) * parseInt(limit);

    const affiliations = await db.collection('employeeAffiliations')
      .find(affiliationQuery)
      .sort({ affiliationDate: -1 })
      .skip(skip)
      .limit(parseInt(limit))
      .toArray();

    const employees = [];
    for (const aff of affiliations) {
      const employee = await db.collection('users').findOne(
        { email: aff.employeeEmail },
        { projection: { password: 0 } }
      );

      const assetCount = await db.collection('assignedAssets').countDocuments({
        employeeEmail: aff.employeeEmail,
        hrEmail: req.user.email,
        status: 'assigned'
      });

      if (employee) {
        employees.push({
          ...employee,
          affiliationDate: aff.affiliationDate,
          assetCount
        });
      }
    }

    const total = await db.collection('employeeAffiliations').countDocuments(affiliationQuery);

    res.json({ 
      employees,
      totalPages: Math.ceil(total / parseInt(limit)),
      currentPage: parseInt(page),
      totalEmployees: total
    });
  } catch (error) {
    console.error('Get HR employees error:', error);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

// Remove employee from team (HR only)
router.delete('/remove/:email', verifyHR, async (req, res) => {
  try {
    const db = getDB();
    const { email } = req.params;

    const result = await db.collection('employeeAffiliations').updateOne(
      { 
        employeeEmail: email,
        hrEmail: req.user.email,
        status: 'active'
      },
      { 
        $set: { 
          status: 'inactive',
          removedDate: new Date()
        } 
      }
    );

    if (result.matchedCount === 0) {
      return res.status(404).json({ message: 'Employee not found in your team' });
    }

    await db.collection('users').updateOne(
      { email: req.user.email },
      { $inc: { currentEmployees: -1 } }
    );

    res.json({ message: 'Employee removed from team' });
  } catch (error) {
    console.error('Remove employee error:', error);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

export default router;