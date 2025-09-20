
require('dotenv').config();
const { Telegraf } = require('telegraf');
const { Trigger, Action, Edge, Workflow, TRIGGERS, ACTIONS } = require('otomato-sdk');

class AbstractStreamerBot {
  constructor(telegramToken, otomatoToken) {
    this.bot = new Telegraf(telegramToken);
    this.otomatoToken = otomatoToken;
    
    // Configure Sprout Marketing SDK with token and URL
    const { apiServices } = require('otomato-sdk');
    const apiUrl = process.env.API_URL || 'https://api.otomato.xyz/api';
    console.log(`🔧 [SDK CONFIG] Setting API URL to: ${apiUrl}`);
    apiServices.setUrl(apiUrl);
    apiServices.setAuth(otomatoToken);
    console.log(`🔧 [SDK CONFIG] SDK configured with URL: ${apiUrl}`);
    
    this.setupCommands();
  }



  setupCommands() {
    // Start command
    this.bot.start(async (ctx) => {
      const userId = ctx.from.id;
      const chatId = ctx.chat.id.toString();
      
      console.log(`👤 [START] User ${userId} started the bot`);
      
      const welcomeMessage = `✳️ *Abstract Notifications*

Get notified instantly when your favourite streamers go live on Abstract! 

*Features:*
• ⚡ Lightning-fast alerts
• 🎯 Customizable watchlist
• ⏰ More features coming soon

*Quick Start:* Click "Add Streamer" then type in their AGW handle (Ex: Ares) to turn on reminders.

Made with ❤️ by Otomato - Build your own AI Agents!`;

      const keyboard = {
        reply_markup: {
          inline_keyboard: [
            [
              { text: '➕ Add Streamer', callback_data: 'add_streamer' },
              { text: '📋 My Workflows', callback_data: 'list_workflows' }
            ],
            [
              { text: '🗑️ Delete All', callback_data: 'delete_all_workflows' },
              { text: 'ℹ️ Help', callback_data: 'help' }
            ]
            // [
            //   { text: '🌐 Visit Otomato', url: 'https://otomato.xyz' }
            // ]
          ]
        }
      };

      // Send welcome message with banner image
      try {
        console.log('🖼️ [WELCOME] Attempting to send image...');
        // Try to send with image first
        await ctx.replyWithPhoto(
          'https://picsum.photos/400/200?random=1',
          {
            caption: welcomeMessage,
            parse_mode: 'Markdown',
            reply_markup: keyboard.reply_markup
          }
        );
        console.log('✅ [WELCOME] Image sent successfully!');
      } catch (imageError) {
        console.warn('⚠️ [WELCOME] Could not send image, falling back to text:', imageError.message);
        console.warn('⚠️ [WELCOME] Error details:', imageError.response?.data);
        // Fallback to text-only message
        ctx.replyWithMarkdown(welcomeMessage, keyboard);
      }
    });

    // Delete workflow command
    this.bot.command('delete', async (ctx) => {
      const workflowId = ctx.message.text.split(' ')[1];
      
      if (!workflowId) {
        return ctx.reply('❌ Please provide a workflow ID: /delete <workflow-id>\n\nUse "My Workflows" button to see your workflow IDs.');
      }

      try {
        await ctx.reply('🗑️ Deleting workflow...');
        
        const success = await this.deleteWorkflowById(workflowId);
        
        if (success) {
          ctx.reply(`✅ Successfully deleted workflow: ${workflowId}`);
        } else {
          ctx.reply(`❌ Failed to delete workflow: ${workflowId}`);
        }
      } catch (error) {
        console.error('❌ [DELETE COMMAND] Error:', error);
        ctx.reply(`❌ Error deleting workflow: ${error.message}`);
      }
    });

    // Handle usernames without /add command (e.g., just typing "Ares")
    this.bot.on('text', async (ctx) => {
      console.log('\n🔍 [TEXT HANDLER] Processing incoming text...');
      
      const userId = ctx.from.id;
      console.log(`👤 [TEXT HANDLER] User ID: ${userId}`);

      const text = ctx.message.text.trim();
      console.log(`📝 [TEXT HANDLER] Received text: "${text}"`);
      
      // Skip if it's a command
      if (text.startsWith('/')) {
        console.log('⏭️ [TEXT HANDLER] Skipping command message');
        return;
      }

      // Skip if it's too long (likely not a username)
      if (text.length > 50) {
        console.log(`⏭️ [TEXT HANDLER] Text too long (${text.length} chars), skipping`);
        return;
      }

      // Skip if it contains spaces (likely not a username)
      if (text.includes(' ')) {
        console.log('⏭️ [TEXT HANDLER] Text contains spaces, skipping');
        return;
      }

      // Skip if it's just emojis or special characters
      if (!/^[a-zA-Z0-9_@.-]+$/.test(text)) {
        console.log('⏭️ [TEXT HANDLER] Text contains invalid characters, skipping');
        return;
      }

      // Clean the username (remove @ if present)
      const streamerHandle = text.replace('@', '');
      console.log(`🎯 [TEXT HANDLER] Cleaned streamer handle: "${streamerHandle}"`);

      try {
        console.log(`🔧 [TEXT HANDLER] Creating Sprout Marketing workflow for "${streamerHandle}"...`);
        const chatId = ctx.chat.id.toString();
        
          let workflowId;
          try {
          workflowId = await this.createStreamerWorkflow(streamerHandle, chatId);
            console.log(`✅ [TEXT HANDLER] Workflow created with ID: ${workflowId}`);
          ctx.reply(`✅ Successfully created workflow for @${streamerHandle}!\n\nYou'll receive notifications when they go live!`);
          } catch (workflowError) {
            console.error(`❌ [TEXT HANDLER] Failed to create workflow for "${streamerHandle}":`, workflowError);
          ctx.reply(`❌ Failed to create notification workflow for ${streamerHandle}.\n\nError: ${workflowError.message}`);
        }
      } catch (error) {
        console.error('❌ [TEXT HANDLER] Error adding streamer:', error);
        ctx.reply('❌ Error creating workflow. Please try again.');
      }
    });

    // Inline keyboard callback handlers
    this.bot.action('add_streamer', async (ctx) => {
      try {
        // Answer callback query with error handling
      try {
        await ctx.answerCbQuery();
        } catch (cbError) {
          console.warn('⚠️ [CALLBACK] Could not answer callback query (likely timeout):', cbError.message);
        }
        
        ctx.reply('🔔 Enter any streamer\'s AGW handle to turn on reminders! (Ex: @Ares or Ares)', { parse_mode: 'Markdown' });
      } catch (error) {
        console.error('❌ [CALLBACK] Error handling add_streamer:', error);
        try {
          ctx.reply('❌ Sorry, something went wrong. Please try again.');
        } catch (replyError) {
          console.error('❌ [CALLBACK] Could not send error message:', replyError);
        }
      }
    });

    this.bot.action('list_workflows', async (ctx) => {
      try {
        // Answer callback query with error handling
      try {
        await ctx.answerCbQuery();
        } catch (cbError) {
          console.warn('⚠️ [CALLBACK] Could not answer callback query (likely timeout):', cbError.message);
        }
        
        // Check if this is a refresh (callback) or initial load
        const isRefresh = ctx.callbackQuery && ctx.callbackQuery.message;
        
        if (!isRefresh) {
          await ctx.reply('📋 Fetching your workflows...');
        }
        
        const workflows = await this.getUserWorkflows();
        
        if (workflows.length === 0) {
          if (isRefresh) {
            ctx.editMessageText('📭 No workflows found. Create one by typing a streamer name!');
          } else {
            ctx.reply('📭 No workflows found. Create one by typing a streamer name!');
          }
          return;
        }

        // Show workflows in a clean, organized list - single page at a time
        const workflowsPerPage = 8;
        const totalPages = Math.ceil(workflows.length / workflowsPerPage);
        const currentPage = 0; // Always start with page 0
        
        const startIndex = currentPage * workflowsPerPage;
        const endIndex = Math.min(startIndex + workflowsPerPage, workflows.length);
        const pageWorkflows = workflows.slice(startIndex, endIndex);
        
        let message = `📋 *Your Workflows (${workflows.length} total)*\n`;
        if (totalPages > 1) {
          message += `*Page ${currentPage + 1} of ${totalPages}*\n`;
        }
        message += `\n`;
        
        pageWorkflows.forEach((workflow, index) => {
          const globalIndex = startIndex + index + 1;
          const status = workflow.state === 'active' ? '🟢 Active' : '🔴 Inactive';
          const lastExec = workflow.lastExecution ? 
            `Last run: ${new Date(workflow.lastExecution.dateCreated).toLocaleDateString()}` : 
            'Never run';
          const created = workflow.dateCreated ? 
            `Created: ${new Date(workflow.dateCreated).toLocaleDateString()}` : 
            'Created: Unknown';
          
          message += `**${globalIndex}.** ${status} *${workflow.name}*\n`;
          message += `   🆔 \`${workflow.id}\`\n`;
          message += `   📅 ${created}\n`;
          message += `   ⚡ ${lastExec}\n\n`;
        });
        
        // Add navigation buttons if multiple pages
        const keyboard = [];
        if (totalPages > 1) {
          const navButtons = [];
          if (currentPage > 0) {
            navButtons.push({ text: '⬅️ Previous', callback_data: `workflows_page_${currentPage - 1}` });
          }
          if (currentPage < totalPages - 1) {
            navButtons.push({ text: 'Next ➡️', callback_data: `workflows_page_${currentPage + 1}` });
          }
          if (navButtons.length > 0) {
            keyboard.push(navButtons);
          }
        }
        
        // Add action buttons
        keyboard.push([
          { text: '🔄 Refresh', callback_data: 'list_workflows' },
          { text: '🏠 Back to Menu', callback_data: 'back_to_menu' }
        ]);
        
        // Add delete buttons
        keyboard.push([
          { text: '🗑️ Delete Workflow', callback_data: 'delete_workflow_prompt' },
          { text: '🗑️ Delete All', callback_data: 'delete_all_workflows' }
        ]);
        
        const replyMarkup = {
          reply_markup: {
            inline_keyboard: keyboard
          }
        };
        
        if (isRefresh) {
          ctx.editMessageText(message, { parse_mode: 'Markdown', ...replyMarkup });
        } else {
          ctx.reply(message, { parse_mode: 'Markdown', ...replyMarkup });
        }
      } catch (error) {
        console.error('❌ [CALLBACK] Error listing workflows:', error);
        try {
          ctx.reply('❌ Error fetching workflows. Please try again.');
        } catch (replyError) {
          console.error('❌ [CALLBACK] Could not send error message:', replyError);
        }
      }
    });

    this.bot.action('delete_all_workflows', async (ctx) => {
      try {
        // Answer callback query with error handling
      try {
        await ctx.answerCbQuery();
        } catch (cbError) {
          console.warn('⚠️ [CALLBACK] Could not answer callback query (likely timeout):', cbError.message);
        }
        
        const confirmKeyboard = {
          reply_markup: {
            inline_keyboard: [
              [
                { text: '✅ Yes, Delete All', callback_data: 'confirm_delete_all' },
                { text: '❌ Cancel', callback_data: 'cancel_delete' }
              ]
            ]
          }
        };
        
        ctx.reply('⚠️ *Delete All Workflows*\n\nThis will delete ALL your workflows!\n\nAre you sure?', { 
          parse_mode: 'Markdown',
          reply_markup: confirmKeyboard.reply_markup
        });
      } catch (error) {
        console.error('❌ [CALLBACK] Error handling delete_all_workflows:', error);
        try {
          ctx.reply('❌ Sorry, something went wrong. Please try again.');
        } catch (replyError) {
          console.error('❌ [CALLBACK] Could not send error message:', replyError);
        }
      }
    });

    this.bot.action('confirm_delete_all', async (ctx) => {
      try {
        // Answer callback query with error handling
        try {
          await ctx.answerCbQuery();
        } catch (cbError) {
          console.warn('⚠️ [CALLBACK] Could not answer callback query (likely timeout):', cbError.message);
        }
        await ctx.reply('🗑️ Deleting all workflows...');
        
        const deletedCount = await this.deleteAllWorkflows();
        
        ctx.reply(`✅ Successfully deleted ${deletedCount} workflow(s)!`);
      } catch (error) {
        console.error('❌ [CALLBACK] Error confirming delete all:', error);
        try {
          ctx.reply('❌ Error deleting workflows. Please try again.');
        } catch (replyError) {
          console.error('❌ [CALLBACK] Could not send error message:', replyError);
        }
      }
    });

    this.bot.action('cancel_delete', async (ctx) => {
      try {
        // Answer callback query with error handling
      try {
        await ctx.answerCbQuery();
        } catch (cbError) {
          console.warn('⚠️ [CALLBACK] Could not answer callback query (likely timeout):', cbError.message);
        }
        ctx.reply('❌ Deletion cancelled.');
      } catch (error) {
        console.error('❌ [CALLBACK] Error cancelling delete:', error);
        try {
          ctx.reply('❌ Sorry, something went wrong. Please try again.');
        } catch (replyError) {
          console.error('❌ [CALLBACK] Could not send error message:', replyError);
        }
      }
    });

    this.bot.action('help', async (ctx) => {
      try {
        // Answer callback query with error handling
      try {
        await ctx.answerCbQuery();
        } catch (cbError) {
          console.warn('⚠️ [CALLBACK] Could not answer callback query (likely timeout):', cbError.message);
        }
        const helpMessage = `ℹ️ Help & Instructions

How to Use:
• Click "Add Streamer" to add someone to your watchlist
• Enter in any streamer's handle (Ex: Ares or @Ares)
• You will receive notifications whenever they go live

Workflow Management:
• Use "My Watchlist" to see all the streamers you have added
• Use "Delete All" to remove all notifications at once
• Use /delete streamer-handle to delete a specific streamer

Support:
• If you encounter issues, check the error messages
• Contact support if problems persist 
• All workflows are monitored automatically

Need help? Visit Otomato for more info!
Contact: [Support](https://t.me/Ares_Sprout)`;

        ctx.replyWithMarkdown(helpMessage);
      } catch (error) {
        console.error('❌ [CALLBACK] Error handling help:', error);
        try {
          ctx.reply('❌ Sorry, something went wrong. Please try again.');
        } catch (replyError) {
          console.error('❌ [CALLBACK] Could not send error message:', replyError);
        }
      }
    });


    // Handle pagination for workflows
    this.bot.action(/^workflows_page_(\d+)$/, async (ctx) => {
      try {
        // Answer callback query with error handling
        try {
          await ctx.answerCbQuery();
        } catch (cbError) {
          console.warn('⚠️ [CALLBACK] Could not answer callback query (likely timeout):', cbError.message);
        }
        const page = parseInt(ctx.match[1]);
        
        console.log(`📄 [PAGINATION] User wants page ${page + 1} of workflows`);
        
        // Re-fetch workflows and show the requested page
        const workflows = await this.getUserWorkflows();
        
        if (workflows.length === 0) {
          ctx.reply('📭 No workflows found. Create one by typing a streamer name!');
          return;
        }

        const workflowsPerPage = 8;
        const totalPages = Math.ceil(workflows.length / workflowsPerPage);
        const startIndex = page * workflowsPerPage;
        const endIndex = Math.min(startIndex + workflowsPerPage, workflows.length);
        const pageWorkflows = workflows.slice(startIndex, endIndex);
        
        let message = `📋 *Your Workflows (${workflows.length} total)*\n`;
        if (totalPages > 1) {
          message += `*Page ${page + 1} of ${totalPages}*\n`;
        }
        message += `\n`;
        
        pageWorkflows.forEach((workflow, index) => {
          const globalIndex = startIndex + index + 1;
          const status = workflow.state === 'active' ? '🟢 Active' : '🔴 Inactive';
          const lastExec = workflow.lastExecution ? 
            `Last run: ${new Date(workflow.lastExecution.dateCreated).toLocaleDateString()}` : 
            'Never run';
          const created = workflow.dateCreated ? 
            `Created: ${new Date(workflow.dateCreated).toLocaleDateString()}` : 
            'Created: Unknown';
          
          message += `**${globalIndex}.** ${status} *${workflow.name}*\n`;
          message += `   🆔 \`${workflow.id}\`\n`;
          message += `   📅 ${created}\n`;
          message += `   ⚡ ${lastExec}\n\n`;
        });
        
        // Add navigation buttons if multiple pages
        const keyboard = [];
        if (totalPages > 1) {
          const navButtons = [];
          if (page > 0) {
            navButtons.push({ text: '⬅️ Previous', callback_data: `workflows_page_${page - 1}` });
          }
          if (page < totalPages - 1) {
            navButtons.push({ text: 'Next ➡️', callback_data: `workflows_page_${page + 1}` });
          }
          if (navButtons.length > 0) {
            keyboard.push(navButtons);
          }
        }
        
        // Add action buttons
        keyboard.push([
          { text: '🔄 Refresh', callback_data: 'list_workflows' },
          { text: '🏠 Back to Menu', callback_data: 'back_to_menu' }
        ]);
        
        // Add delete buttons
        keyboard.push([
          { text: '🗑️ Delete Workflow', callback_data: 'delete_workflow_prompt' },
          { text: '🗑️ Delete All', callback_data: 'delete_all_workflows' }
        ]);
        
        const replyMarkup = {
          reply_markup: {
            inline_keyboard: keyboard
          }
        };
        
        ctx.editMessageText(message, { parse_mode: 'Markdown', ...replyMarkup });
      } catch (error) {
        console.error('❌ [CALLBACK] Error handling pagination:', error);
        try {
          ctx.reply('❌ Error loading page. Please try again.');
        } catch (replyError) {
          console.error('❌ [CALLBACK] Could not send error message:', replyError);
        }
      }
    });

    // Handle delete workflow prompt
    this.bot.action('delete_workflow_prompt', async (ctx) => {
      try {
        // Answer callback query with error handling
        try {
          await ctx.answerCbQuery();
        } catch (cbError) {
          console.warn('⚠️ [CALLBACK] Could not answer callback query (likely timeout):', cbError.message);
        }
        
        const message = `🗑️ *Delete Individual Workflow*\n\nTo delete a specific workflow:\n\n1. Copy the workflow ID from the list above\n2. Use the command: \`/delete <workflow-id>\`\n\n*Example:*\n\`/delete 7ebd0b5c-76fb-4192-9c3e-e2a8b0f2fada\`\n\n*Or use the buttons below for quick actions:*`;

        const keyboard = {
          reply_markup: {
            inline_keyboard: [
              [
                { text: '📋 Back to Workflows', callback_data: 'list_workflows' },
                { text: '🏠 Main Menu', callback_data: 'back_to_menu' }
              ]
            ]
          }
        };

        ctx.editMessageText(message, { parse_mode: 'Markdown', ...keyboard });
      } catch (error) {
        console.error('❌ [CALLBACK] Error handling delete workflow prompt:', error);
        try {
          ctx.reply('❌ Error showing delete instructions. Please try again.');
        } catch (replyError) {
          console.error('❌ [CALLBACK] Could not send error message:', replyError);
        }
      }
    });

    // Handle back to menu
    this.bot.action('back_to_menu', async (ctx) => {
      try {
        // Answer callback query with error handling
        try {
          await ctx.answerCbQuery();
        } catch (cbError) {
          console.warn('⚠️ [CALLBACK] Could not answer callback query (likely timeout):', cbError.message);
        }
        
        const welcomeMessage = `✳️ *Abstract Notifications*\n\nGet notified instantly when your favourite streamers go live on Abstract!\n\n*Features:*\n• ⚡ Lightning-fast alerts\n• 🎯 Customizable watchlist\n• ⏰ More features coming soon\n\n*Quick Start:* Click "Add Streamer" then type in their AGW handle (Ex: Ares) to turn on reminders.\n\nMade with ❤️ by Otomato - Build your own AI Agents!`;

        const keyboard = {
          reply_markup: {
            inline_keyboard: [
              [
                { text: '➕ Add Streamer', callback_data: 'add_streamer' },
                { text: '📋 My Workflows', callback_data: 'list_workflows' }
              ],
              [
                { text: '🗑️ Delete All', callback_data: 'delete_all_workflows' },
                { text: 'ℹ️ Help', callback_data: 'help' }
              ]
              // [
              //   { text: '🌐 Visit Otomato', url: 'https://otomato.xyz' }
              // ]
            ]
          }
        };

        // Send welcome message with banner image
        try {
          // Try to send with image first
          await ctx.replyWithPhoto(
            'https://picsum.photos/400/200?random=1',
            {
              caption: welcomeMessage,
              parse_mode: 'Markdown',
              reply_markup: keyboard.reply_markup
            }
          );
        } catch (imageError) {
          console.warn('⚠️ [MENU] Could not send image, falling back to text:', imageError.message);
          // Fallback to text-only message
          ctx.replyWithMarkdown(welcomeMessage, keyboard);
        }
      } catch (error) {
        console.error('❌ [CALLBACK] Error handling back to menu:', error);
        try {
          ctx.reply('❌ Sorry, something went wrong. Please try again.');
        } catch (replyError) {
          console.error('❌ [CALLBACK] Could not send error message:', replyError);
        }
      }
    });

  }

  // Get all workflows for the user
  async getUserWorkflows() {
    try {
      console.log('🔍 [WORKFLOWS] Fetching workflows...');
      const { apiServices } = require('otomato-sdk');
      // Set auth again to ensure it's properly configured
      apiServices.setAuth(this.otomatoToken);
      console.log('🔍 [WORKFLOWS] Making API request to /workflows');
      const response = await apiServices.get('/workflows');
      console.log('🔍 [WORKFLOWS] API response type:', typeof response);
      console.log('🔍 [WORKFLOWS] API response is array:', Array.isArray(response));
      console.log('🔍 [WORKFLOWS] API response length:', response?.length || 0);
      
      // The SDK returns the data directly as an array, not wrapped in a response object
      if (Array.isArray(response)) {
        console.log('✅ [WORKFLOWS] Successfully fetched workflows:', response.length);
        return response;
      }
      console.log('⚠️ [WORKFLOWS] No workflows found or invalid response');
      return [];
    } catch (error) {
      console.error('❌ [WORKFLOWS] Error fetching workflows:', error);
      console.error('❌ [WORKFLOWS] Error details:', error.response?.status, error.response?.data);
      
      // Handle specific error types
      if (error.response?.status === 401) {
        console.error('❌ [WORKFLOWS] Authentication failed - check OTOMATO_TOKEN');
      } else if (error.response?.status === 404) {
        console.error('❌ [WORKFLOWS] API endpoint not found - check API_URL');
      } else if (error.code === 'ENOTFOUND' || error.code === 'ECONNREFUSED') {
        console.error('❌ [WORKFLOWS] Network error - check internet connection and API_URL');
      }
      
      return [];
    }
  }

  // Delete all workflows
  async deleteAllWorkflows() {
    try {
      const workflows = await this.getUserWorkflows();
      let deletedCount = 0;
      let errorCount = 0;
      
      console.log(`🗑️ [DELETE ALL] Starting deletion of ${workflows.length} workflows...`);
      
      for (const workflow of workflows) {
        try {
          const { Workflow } = require('otomato-sdk');
          const workflowObj = new Workflow('', [], []);
          workflowObj.id = workflow.id;
          
          const result = await workflowObj.delete();
          if (result.success) {
            deletedCount++;
            console.log(`✅ [DELETE ALL] Deleted workflow: ${workflow.name || workflow.id}`);
          } else {
            errorCount++;
            console.log(`⚠️ [DELETE ALL] Failed to delete workflow: ${workflow.name || workflow.id}`);
          }
        } catch (error) {
          errorCount++;
          console.error(`❌ [DELETE ALL] Error deleting workflow ${workflow.id}:`, error.message);
        }
      }
      
      console.log(`📊 [DELETE ALL] Completed: ${deletedCount} deleted, ${errorCount} errors`);
      return deletedCount;
    } catch (error) {
      console.error('❌ [DELETE ALL] Error in deleteAllWorkflows:', error);
      return 0;
    }
  }

  // Delete specific workflow by ID
  async deleteWorkflowById(workflowId) {
    try {
      console.log(`🗑️ [DELETE] Attempting to delete workflow: ${workflowId}`);
      const { Workflow } = require('otomato-sdk');
      const workflow = new Workflow('', [], []);
      workflow.id = workflowId;
      
      const result = await workflow.delete();
      if (result.success) {
        console.log(`✅ [DELETE] Successfully deleted workflow: ${workflowId}`);
      } else {
        console.log(`⚠️ [DELETE] Failed to delete workflow: ${workflowId} - ${result.error || 'Unknown error'}`);
      }
      return result.success;
    } catch (error) {
      console.error(`❌ [DELETE] Error deleting workflow ${workflowId}:`, error.message);
      
      // Handle specific error types
      if (error.response?.status === 401) {
        console.error('❌ [DELETE] Authentication failed - check OTOMATO_TOKEN');
      } else if (error.response?.status === 404) {
        console.error('❌ [DELETE] Workflow not found - may have been already deleted');
      } else if (error.code === 'ENOTFOUND' || error.code === 'ECONNREFUSED') {
        console.error('❌ [DELETE] Network error - check internet connection and API_URL');
      }
      
      return false;
    }
  }

  // Create Sprout Marketing workflow for streamer notifications
  async createStreamerWorkflow(streamerHandle, chatId) {
    console.log(`🔧 [WORKFLOW] Starting workflow creation for "${streamerHandle}"`);
    console.log(`🔧 [WORKFLOW] Chat ID: ${chatId}`);
    
    try {
      console.log(`🔧 [WORKFLOW] Creating workflow object...`);
      const workflow = await this.abstractGetNotifiedWhenStreamerIsLive(streamerHandle, chatId);
      console.log(`🔧 [WORKFLOW] Workflow object created successfully`);
      
      console.log(`🔧 [WORKFLOW] Calling workflow.create()...`);
      const result = await workflow.create();
      console.log(`🔧 [WORKFLOW] Workflow created successfully with result:`, result);
      
      if (!result.success) {
        throw new Error(`Failed to create workflow: ${result.error}`);
      }
      
      console.log('✅ Workflow created successfully!');
      console.log('🆔 Workflow ID:', workflow.id);
      
      console.log(`🔧 [WORKFLOW] Starting workflow...`);
      const runResult = await workflow.run();
      console.log(`🔧 [WORKFLOW] Workflow started with result:`, runResult);
      
      if (!runResult.success) {
        throw new Error(`Failed to start workflow: ${runResult.error}`);
      }
      
      console.log('🎉 Success! Your custom Telegram bot notification system is now active.');
      console.log(`📱 You'll receive notifications in chat: ${chatId}`);
      console.log(`🔗 Stream link: https://portal.abs.xyz/stream/${streamerHandle}`);
      console.log('📊 Workflow state:', workflow.getState());
      
      return workflow.id;
    } catch (error) {
      console.error(`❌ [WORKFLOW] Error creating workflow for "${streamerHandle}":`, error);
      throw error;
    }
  }

  // Validate if streamer exists on Abstract platform
  async validateStreamer(streamerHandle) {
    console.log(`🔍 [VALIDATION] Starting validation for streamer: "${streamerHandle}"`);
    
    try {
      // Basic validation - check if it's a reasonable username format
      if (!streamerHandle || streamerHandle.length < 2 || streamerHandle.length > 30) {
        console.log(`❌ [VALIDATION] Invalid username length: ${streamerHandle?.length}`);
        return false;
      }

      // Check for valid characters only
      if (!/^[a-zA-Z0-9_-]+$/.test(streamerHandle)) {
        console.log(`❌ [VALIDATION] Invalid characters in username: "${streamerHandle}"`);
        return false;
      }

      // For now, we'll do a basic check by trying to access the Abstract profile URL
      // In a real implementation, you might want to use Abstract's API
      console.log(`🔍 [VALIDATION] Checking Abstract profile URL: https://portal.abs.xyz/profile/${streamerHandle}`);
      
      // Since we can't easily validate without Abstract's API, we'll assume valid for now
      // In production, you'd want to make an API call to Abstract to verify the user exists
      console.log(`✅ [VALIDATION] Streamer "${streamerHandle}" passed basic validation`);
      return true;
      
    } catch (error) {
      console.error(`❌ [VALIDATION] Error validating streamer "${streamerHandle}":`, error);
      return false;
    }
  }

  // Based on Clément's workflow code
  async abstractGetNotifiedWhenStreamerIsLive(streamerHandle, chatId) {
    console.log(`🔧 [WORKFLOW BUILD] Building workflow for streamer: "${streamerHandle}"`);
    
    console.log(`🔧 [WORKFLOW BUILD] Creating trigger...`);
    const trigger = new Trigger(TRIGGERS.SOCIALS.ABSTRACT.ON_STREAMER_LIVE);
    trigger.setParams('streamer', streamerHandle);
    trigger.setPosition(400, 120);
    console.log(`🔧 [WORKFLOW BUILD] Trigger created with streamer parameter: "${streamerHandle}"`);

    console.log(`🔧 [WORKFLOW BUILD] Creating Telegram action...`);
    const telegramAction = new Action(ACTIONS.NOTIFICATIONS.TELEGRAM.SEND_MESSAGE);
    const message = `🎥 ${streamerHandle} is live on Abstract!\n\n🔗 Watch here: https://portal.abs.xyz/stream/${streamerHandle}\n\n⏰ Time: {{timestamp}}`;
    
    console.log(`🔧 [WORKFLOW BUILD] Message template:`, message);
    telegramAction.setParams('message', message);
    telegramAction.setParams('webhook', `https://api.telegram.org/bot${process.env.TELEGRAM_BOT_TOKEN}/sendMessage`);
    telegramAction.setParams('chat_id', chatId);
    telegramAction.setPosition(400, 240);
    console.log(`🔧 [WORKFLOW BUILD] Telegram action created with chat_id: ${chatId}`);

    console.log(`🔧 [WORKFLOW BUILD] Creating edge...`);
    const edge = new Edge({ source: trigger, target: telegramAction });
    console.log(`🔧 [WORKFLOW BUILD] Edge created connecting trigger to action`);

    console.log(`🔧 [WORKFLOW BUILD] Creating workflow object...`);
    const workflow = new Workflow(
      `Abstract Streamer Notifications - ${streamerHandle}`, 
      [trigger, telegramAction], 
      [edge]
    );
    console.log(`🔧 [WORKFLOW BUILD] Workflow object created successfully`);
    
    return workflow;
  }


  async start() {
    try {
      // Add global error handler
      this.bot.catch((err, ctx) => {
        console.error('❌ [GLOBAL ERROR] Unhandled error:', err);
        console.error('❌ [GLOBAL ERROR] Context:', {
          updateType: ctx.updateType,
          userId: ctx.from?.id,
          chatId: ctx.chat?.id,
          messageId: ctx.message?.message_id
        });
        
        // Try to send error message to user if possible
        try {
          if (ctx.reply) {
            ctx.reply('❌ An unexpected error occurred. Please try again later.');
          }
        } catch (replyError) {
          console.error('❌ [GLOBAL ERROR] Failed to send error message:', replyError);
        }
      });

      // Add process error handlers
      process.on('uncaughtException', (error) => {
        console.error('❌ [UNCAUGHT EXCEPTION]', error);
        // Don't exit the process, just log the error
      });

      process.on('unhandledRejection', (reason, promise) => {
        console.error('❌ [UNHANDLED REJECTION]', reason);
        console.error('❌ [UNHANDLED REJECTION] Promise:', promise);
      });

      this.bot.launch();
      console.log('🍅 Abstract Streamer Bot started!');
      
      // Graceful shutdown
      process.once('SIGINT', () => {
        console.log('🛑 [SHUTDOWN] Received SIGINT, shutting down gracefully...');
        this.bot.stop('SIGINT');
        process.exit(0);
      });
      
      process.once('SIGTERM', () => {
        console.log('🛑 [SHUTDOWN] Received SIGTERM, shutting down gracefully...');
        this.bot.stop('SIGTERM');
        process.exit(0);
      });
    } catch (error) {
      console.error('❌ [STARTUP] Failed to start bot:', error);
      process.exit(1);
    }
  }
}

// Start the bot
async function main() {
  const TELEGRAM_BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN;
  const OTOMATO_TOKEN = process.env.OTOMATO_TOKEN || process.env.AUTH_TOKEN;

  if (!TELEGRAM_BOT_TOKEN || !OTOMATO_TOKEN) {
    console.error('❌ Missing required environment variables!');
    console.error('Please set TELEGRAM_BOT_TOKEN and OTOMATO_TOKEN (or AUTH_TOKEN) in your .env file');
    process.exit(1);
  }

  if (!process.env.API_URL) {
    console.log('⚠️  API_URL not set, using default: https://api.otomato.xyz/api/v1');
  }

  const bot = new AbstractStreamerBot(TELEGRAM_BOT_TOKEN, OTOMATO_TOKEN);
  bot.start();
}

main().catch(console.error);