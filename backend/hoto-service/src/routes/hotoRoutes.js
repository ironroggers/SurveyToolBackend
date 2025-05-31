import express from 'express';
import {
  getHotos,
  getHoto,
  createHoto,
  updateHoto,
  deleteHoto,
  getHotosByLocation,
  getHotosByType,
  getHotoStats
} from '../controllers/hotoController.js';

const router = express.Router();

// Stats route (should be before /:id route)
router.get('/stats', getHotoStats);

// Location and type specific routes
router.get('/location/:locationId', getHotosByLocation);
router.get('/type/:hotoType', getHotosByType);

// Main CRUD routes
router.route('/')
  .get(getHotos)
  .post(createHoto);

router.route('/:id')
  .get(getHoto)
  .put(updateHoto)
  .delete(deleteHoto);

export default router; 