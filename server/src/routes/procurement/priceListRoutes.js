import express from 'express';
import priceListController from '../../controllers/procurement/priceListController.js';
import { authMiddleware } from '../../middleware/auth/authMiddleware.js';
import { hasPermission } from '../../middleware/auth/permissionMiddleware.js';

const router = express.Router();

// Apply authentication middleware to all routes
router.use(authMiddleware);

// Price Lists Routes
router.post('/price-lists', hasPermission('procurement.price_list.create'), priceListController.createPriceList);
router.get('/price-lists', hasPermission('procurement.price_list.read'), priceListController.getPriceLists);
router.get('/price-lists/:priceListId', hasPermission('procurement.price_list.read'), priceListController.getPriceListById);
router.put('/price-lists/:priceListId', hasPermission('procurement.price_list.update'), priceListController.updatePriceList);
router.delete('/price-lists/:priceListId', hasPermission('procurement.price_list.delete'), priceListController.deletePriceList);

// Item Prices Routes
router.post('/price-lists/:priceListId/items', hasPermission('procurement.price_list.create'), priceListController.addItemPrice);
router.get('/price-lists/:priceListId/items', hasPermission('procurement.price_list.read'), priceListController.getItemPrices);
// Alias to match client path
router.get('/price-lists/:priceListId/prices', hasPermission('procurement.price_list.read'), priceListController.getItemPrices);
router.get('/item-prices/:itemPriceId', hasPermission('procurement.price_list.read'), priceListController.getItemPriceById);
router.put('/item-prices/:itemPriceId', hasPermission('procurement.price_list.update'), priceListController.updateItemPrice);
router.post('/item-prices', hasPermission('procurement.price_list.create'), priceListController.addItemPriceStandalone);
router.delete('/item-prices/:itemPriceId', hasPermission('procurement.price_list.delete'), priceListController.deleteItemPrice);

export default router;
