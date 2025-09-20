// Workflow Management Tool for Abstract Streamer Bot
// This script helps manage and delete workflows created by the bot

import { apiServices } from 'otomato-sdk';
import dotenv from 'dotenv';

dotenv.config();

async function listAndManageWorkflows() {
    if (!process.env.API_URL || !process.env.OTOMATO_TOKEN) {
        console.error('❌ Missing required environment variables');
        console.error('Please set API_URL and OTOMATO_TOKEN in your .env file');
        return;
    }

    apiServices.setUrl(process.env.API_URL);
    apiServices.setAuth(process.env.OTOMATO_TOKEN);

    try {
        console.log('📋 Fetching your workflows...');
        
        // Get all workflows for the user
        const response = await apiServices.get('/workflows');
        
        if (response.status === 200 && response.data) {
            const workflows = response.data;
            
            console.log(`\n📊 Found ${workflows.length} workflow(s):\n`);
            
            workflows.forEach((workflow, index) => {
                console.log(`${index + 1}. ${workflow.name}`);
                console.log(`   ID: ${workflow.id}`);
                console.log(`   State: ${workflow.state || 'unknown'}`);
                console.log(`   Created: ${workflow.dateCreated || 'unknown'}`);
                console.log(`   Nodes: ${workflow.nodes?.length || 0}`);
                console.log(`   Edges: ${workflow.edges?.length || 0}`);
                console.log('   ---');
            });

            // Show management options
            console.log('\n🔧 Management Options:');
            console.log('1. To delete a workflow, use its ID:');
            console.log('   const workflow = new Workflow("", [], []);');
            console.log('   workflow.id = "WORKFLOW_ID_HERE";');
            console.log('   await workflow.delete();');
            
            console.log('\n2. To delete by name pattern:');
            workflows.forEach((workflow) => {
                if (workflow.name.includes('Abstract') || workflow.name.includes('Streamer')) {
                    console.log(`   Found Abstract/Streamer workflow: ${workflow.name} (ID: ${workflow.id})`);
                }
            });

        } else {
            console.log('❌ Failed to fetch workflows:', response.data);
        }

    } catch (error) {
        console.error('❌ Error fetching workflows:', error.message);
    }
}

// Function to delete workflow by ID
async function deleteWorkflowById(workflowId) {
    if (!process.env.API_URL || !process.env.OTOMATO_TOKEN) return;

    apiServices.setUrl(process.env.API_URL);
    apiServices.setAuth(process.env.OTOMATO_TOKEN);

    try {
        console.log(`🗑️  Deleting workflow: ${workflowId}`);
        
        const response = await apiServices.delete(`/workflows/${workflowId}`);
        
        if (response.status === 204) {
            console.log('✅ Workflow deleted successfully!');
        } else {
            console.log('❌ Failed to delete workflow:', response.data);
        }

    } catch (error) {
        console.error('❌ Error deleting workflow:', error.message);
    }
}

// Function to delete all Abstract/Streamer workflows
async function deleteAllStreamerWorkflows() {
    if (!process.env.API_URL || !process.env.OTOMATO_TOKEN) return;

    apiServices.setUrl(process.env.API_URL);
    apiServices.setAuth(process.env.OTOMATO_TOKEN);

    try {
        console.log('🔍 Finding Abstract/Streamer workflows...');
        
        const response = await apiServices.get('/workflows');
        
        if (response.status === 200 && response.data) {
            const workflows = response.data;
            const streamerWorkflows = workflows.filter((workflow) => 
                workflow.name.includes('Abstract') || 
                workflow.name.includes('Streamer') ||
                workflow.name.includes('Live')
            );

            console.log(`Found ${streamerWorkflows.length} streamer-related workflow(s)`);

            for (const workflow of streamerWorkflows) {
                console.log(`🗑️  Deleting: ${workflow.name} (${workflow.id})`);
                await deleteWorkflowById(workflow.id);
            }

            console.log('✅ All streamer workflows processed!');
        }

    } catch (error) {
        console.error('❌ Error:', error.message);
    }
}

// Function to delete specific workflow by ID using SDK
async function deleteWorkflowBySDK(workflowId) {
    if (!process.env.API_URL || !process.env.OTOMATO_TOKEN) return;

    const { Workflow } = await import('otomato-sdk');
    
    apiServices.setUrl(process.env.API_URL);
    apiServices.setAuth(process.env.OTOMATO_TOKEN);

    try {
        console.log(`🗑️  Deleting workflow using SDK: ${workflowId}`);
        
        // Create a workflow object with the ID
        const workflow = new Workflow('', [], []);
        workflow.id = workflowId;
        
        const deletionResult = await workflow.delete();
        
        if (deletionResult.success) {
            console.log('✅ Workflow deleted successfully!');
        } else {
            console.error('❌ Failed to delete workflow:', deletionResult.error);
        }

    } catch (error) {
        console.error('❌ Error deleting workflow:', error.message);
    }
}

// Main function to run the management tool
async function main() {
    console.log('🚀 Workflow Management Tool\n');
    
    // Check command line arguments
    const args = process.argv.slice(2);
    const command = args[0];
    
    switch (command) {
        case 'list':
            await listAndManageWorkflows();
            break;
            
        case 'delete':
            const workflowId = args[1];
            if (!workflowId) {
                console.error('❌ Please provide a workflow ID: node manage-workflows.js delete <workflow-id>');
                return;
            }
            await deleteWorkflowById(workflowId);
            break;
            
        case 'delete-sdk':
            const sdkWorkflowId = args[1];
            if (!sdkWorkflowId) {
                console.error('❌ Please provide a workflow ID: node manage-workflows.js delete-sdk <workflow-id>');
                return;
            }
            await deleteWorkflowBySDK(sdkWorkflowId);
            break;
            
        case 'delete-all':
            console.log('⚠️  This will delete ALL Abstract/Streamer workflows!');
            console.log('Press Ctrl+C to cancel, or wait 5 seconds to continue...');
            
            await new Promise(resolve => setTimeout(resolve, 5000));
            await deleteAllStreamerWorkflows();
            break;
            
        default:
            console.log('📖 Usage:');
            console.log('  node manage-workflows.js list                    - List all workflows');
            console.log('  node manage-workflows.js delete <id>             - Delete workflow by ID (API)');
            console.log('  node manage-workflows.js delete-sdk <id>         - Delete workflow by ID (SDK)');
            console.log('  node manage-workflows.js delete-all              - Delete all streamer workflows');
            console.log('\n💡 Examples:');
            console.log('  node manage-workflows.js list');
            console.log('  node manage-workflows.js delete 7ebd0b5c-76fb-4192-9c3e-e2a8b0f2fada');
            console.log('  node manage-workflows.js delete-sdk 7ebd0b5c-76fb-4192-9c3e-e2a8b0f2fada');
            console.log('  node manage-workflows.js delete-all');
    }
}

// Run the main function
main().catch(console.error);
