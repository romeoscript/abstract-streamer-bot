// Test script for Otomato API
// Run with: node test-api.js

require('dotenv').config();
const axios = require('axios');

const API_URL = process.env.API_URL || 'https://api.otomato.xyz/api';
const TOKEN = process.env.OTOMATO_TOKEN;

if (!TOKEN) {
  console.error('❌ Please set OTOMATO_TOKEN in your .env file');
  process.exit(1);
}

const headers = {
  'Authorization': TOKEN,  // No "Bearer " prefix needed
  'Content-Type': 'application/json'
};

async function testListWorkflows() {
  console.log('🔍 Testing: List Workflows');
  try {
    const response = await axios.get(`${API_URL}/workflows`, { headers });
    console.log(`✅ Status: ${response.status}`);
    console.log(`📊 Found ${response.data.length} workflows:`);
    
    response.data.forEach((workflow, index) => {
      console.log(`  ${index + 1}. ${workflow.name} (${workflow.id})`);
    });
    
    return response.data;
  } catch (error) {
    console.error(`❌ Error: ${error.response?.status} - ${error.response?.statusText}`);
    console.error(`📝 Response:`, error.response?.data);
    return [];
  }
}

async function testCreateWorkflow() {
  console.log('\n🔧 Testing: Create Workflow');
  
  const workflowData = {
    name: `Test Workflow - ${Date.now()}`,
    state: 'inactive',
    nodes: [
      {
        ref: '1',
        blockId: 103,
        type: 'trigger',
        state: 'inactive',
        parameters: {
          streamer: 'testuser'
        },
        position: { x: 400, y: 120 }
      },
      {
        ref: '2',
        blockId: 100001,
        type: 'action',
        state: 'inactive',
        parameters: {
          message: 'Test message from API',
          chat_id: '123456789',
          webhook: 'https://api.telegram.org/bot123456789:ABC/sendMessage'
        },
        position: { x: 400, y: 240 }
      }
    ],
    edges: [
      {
        source: '1',
        target: '2'
      }
    ]
  };
  
  try {
    const response = await axios.post(`${API_URL}/workflows`, workflowData, { headers });
    console.log(`✅ Status: ${response.status}`);
    console.log(`🆔 Created workflow: ${response.data.id || 'No ID returned'}`);
    return response.data;
  } catch (error) {
    console.error(`❌ Error: ${error.response?.status} - ${error.response?.statusText}`);
    console.error(`📝 Response:`, error.response?.data);
    return null;
  }
}

async function testDeleteWorkflow(workflowId) {
  if (!workflowId) {
    console.log('⏭️ Skipping delete test - no workflow ID');
    return;
  }
  
  console.log(`\n🗑️ Testing: Delete Workflow ${workflowId}`);
  
  try {
    const response = await axios.delete(`${API_URL}/workflows/${workflowId}`, { headers });
    console.log(`✅ Status: ${response.status}`);
    console.log('✅ Workflow deleted successfully');
  } catch (error) {
    console.error(`❌ Error: ${error.response?.status} - ${error.response?.statusText}`);
    console.error(`📝 Response:`, error.response?.data);
  }
}

async function runTests() {
  console.log('🚀 Starting Otomato API Tests\n');
  console.log(`🔗 API URL: ${API_URL}`);
  console.log(`🔑 Token: ${TOKEN.substring(0, 20)}...`);
  console.log('');
  
  // Test 1: List workflows
  const workflows = await testListWorkflows();
  
  // Test 2: Create workflow
  const newWorkflow = await testCreateWorkflow();
  
  // Test 3: Delete the workflow we just created
  if (newWorkflow && newWorkflow.id) {
    await testDeleteWorkflow(newWorkflow.id);
  } else {
    // If creation failed, try to delete the first workflow (if any)
    if (workflows.length > 0) {
      console.log('\n⚠️ Using first existing workflow for delete test');
      await testDeleteWorkflow(workflows[0].id);
    }
  }
  
  console.log('\n🎉 API tests completed!');
}

runTests().catch(console.error);
