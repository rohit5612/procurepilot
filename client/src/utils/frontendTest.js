/**
 * Frontend Test Utility
 * Tests frontend connectivity to backend APIs
 */

import { inventoryAPI, procurementAPI, userManagementAPI, systemAPI, authAPI } from './api.js';

export const testFrontendConnectivity = async () => {
  const results = {
    passed: 0,
    failed: 0,
    errors: []
  };

  const test = async (name, testFn) => {
    try {
      console.log(`🧪 Testing: ${name}`);
      await testFn();
      results.passed++;
      console.log(`✅ PASSED: ${name}`);
    } catch (error) {
      results.failed++;
      results.errors.push({ name, error: error.message });
      console.log(`❌ FAILED: ${name} - ${error.message}`);
    }
  };

  console.log('🚀 Starting Frontend Connectivity Tests');
  console.log('=====================================');

  // Test 1: Health Check
  await test('Health Check', async () => {
    const response = await systemAPI.getHealth();
    if (!response.ok) throw new Error('Health check failed');
    const data = await response.json();
    if (data.status !== 'OK') throw new Error('Health status not OK');
  });

  // Test 2: API Info
  await test('API Info', async () => {
    const response = await systemAPI.getApiInfo();
    if (!response.ok) throw new Error('API info failed');
    const data = await response.json();
    if (!data.endpoints) throw new Error('No endpoints found');
  });

  // Test 3: Authentication
  await test('Authentication', async () => {
    const response = await authAPI.login({
      email: 'admin@erp.com',
      password: 'Password123!'
    });
    if (!response.ok) throw new Error('Login failed');
    const data = await response.json();
    if (!data.token) throw new Error('No token received');
  });

  // Test 4: User Management APIs
  await test('User Management - Departments', async () => {
    const response = await userManagementAPI.getDepartments();
    if (!response.ok) throw new Error('Departments API failed');
    const data = await response.json();
    if (!Array.isArray(data.data)) throw new Error('Departments not an array');
  });

  await test('User Management - Roles', async () => {
    const response = await userManagementAPI.getRoles();
    if (!response.ok) throw new Error('Roles API failed');
    const data = await response.json();
    if (!Array.isArray(data.data)) throw new Error('Roles not an array');
  });

  // Test 5: Inventory APIs
  await test('Inventory - Items', async () => {
    const response = await inventoryAPI.getItems();
    if (!response.ok) throw new Error('Items API failed');
    const data = await response.json();
    if (!Array.isArray(data.data)) throw new Error('Items not an array');
  });

  await test('Inventory - Categories', async () => {
    const response = await inventoryAPI.getCategories();
    if (!response.ok) throw new Error('Categories API failed');
    const data = await response.json();
    if (!Array.isArray(data.data)) throw new Error('Categories not an array');
  });

  await test('Inventory - Warehouses', async () => {
    const response = await inventoryAPI.getWarehouses();
    if (!response.ok) throw new Error('Warehouses API failed');
    const data = await response.json();
    if (!Array.isArray(data.data)) throw new Error('Warehouses not an array');
  });

  await test('Inventory - Units of Measure', async () => {
    const response = await inventoryAPI.getUnitsOfMeasure();
    if (!response.ok) throw new Error('Units of Measure API failed');
    const data = await response.json();
    if (!Array.isArray(data.data)) throw new Error('Units of Measure not an array');
  });

  // Test 6: Procurement APIs
  await test('Procurement - Suppliers', async () => {
    const response = await procurementAPI.getSuppliers();
    if (!response.ok) throw new Error('Suppliers API failed');
    const data = await response.json();
    if (!Array.isArray(data.data)) throw new Error('Suppliers not an array');
  });

  await test('Procurement - Price Lists', async () => {
    const response = await procurementAPI.getPriceLists();
    if (!response.ok) throw new Error('Price Lists API failed');
    const data = await response.json();
    if (!Array.isArray(data.data)) throw new Error('Price Lists not an array');
  });

  // Test 7: System APIs
  await test('System - Modules', async () => {
    const response = await systemAPI.getModules();
    if (!response.ok) throw new Error('Modules API failed');
    const data = await response.json();
    if (!Array.isArray(data.data)) throw new Error('Modules not an array');
  });

  // Summary
  console.log('\n📊 Frontend Connectivity Test Summary');
  console.log(`✅ Passed: ${results.passed}`);
  console.log(`❌ Failed: ${results.failed}`);
  console.log(`📈 Success Rate: ${((results.passed / (results.passed + results.failed)) * 100).toFixed(1)}%`);

  if (results.errors.length > 0) {
    console.log('\n❌ Failed Tests:');
    results.errors.forEach(({ name, error }) => {
      console.log(`   - ${name}: ${error}`);
    });
  }

  if (results.failed === 0) {
    console.log('\n🎉 All frontend connectivity tests passed!');
    console.log('✅ Frontend is ready for testing');
  } else {
    console.log('\n⚠️  Some connectivity tests failed. Please check the errors above.');
  }

  return results;
};

export default testFrontendConnectivity;
