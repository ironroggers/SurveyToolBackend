import express from 'express';
import * as hotoController from '../controllers/hoto.controller.js';

const router = express.Router();

// Get all HOTO records
router.get('/', hotoController.getAllHOTOs);

// Get HOTO by ID
router.get('/:id', hotoController.getHOTOById);

// Create new HOTO
router.post('/', hotoController.createHOTO);

// Update HOTO
router.put('/:id', hotoController.updateHOTO);

// Delete HOTO
router.delete('/:id', hotoController.deleteHOTO);

export default router; 