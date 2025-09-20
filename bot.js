
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

      const welcomeMessage = `🍅 *Welcome to Abstract Streamer Notifications!*

Get notified instantly when your favorite streamers go live! 

*Features:*
• 📺 Real-time stream notifications
• 🎯 Customizable watchlist
• 🔔 Smart notification management
• ⚡ Lightning-fast alerts

*Test Mode:* Just type a streamer name to test workflow creation!

Made with ❤️ by [Sprout Marketing](https://sprout.marketing) - Build your own bots!`;

      const keyboard = {
        reply_markup: {
          inline_keyboard: [
            [
              { text: '📺 Test Streamer', callback_data: 'test_streamer' },
              { text: '📋 My Workflows', callback_data: 'list_workflows' }
            ],
            [
              { text: '🗑️ Delete All', callback_data: 'delete_all_workflows' },
              { text: 'ℹ️ Help', callback_data: 'help' }
            ],
            [
              { text: '🌐 Visit Sprout Marketing', url: 'https://sprout.marketing' }
            ]
          ]
        }
      };

      ctx.replyWithMarkdown(welcomeMessage, keyboard);
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
    this.bot.action('test_streamer', async (ctx) => {
      try {
        await ctx.answerCbQuery();
        ctx.reply('📺 *Test Streamer Workflow*\n\nJust type a streamer name to test workflow creation!\n\nExample: `Ares` or `@Ares`', { parse_mode: 'Markdown' });
      } catch (error) {
        console.error('❌ [CALLBACK] Error handling test_streamer:', error);
      }
    });

    this.bot.action('list_workflows', async (ctx) => {
      try {
        await ctx.answerCbQuery();
        
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
        ctx.reply('❌ Error fetching workflows. Please try again.');
      }
    });

    this.bot.action('delete_all_workflows', async (ctx) => {
      try {
        await ctx.answerCbQuery();
        
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
      }
    });

    this.bot.action('confirm_delete_all', async (ctx) => {
      try {
        await ctx.answerCbQuery();
        await ctx.reply('🗑️ Deleting all workflows...');
        
        const deletedCount = await this.deleteAllWorkflows();
        
        ctx.reply(`✅ Successfully deleted ${deletedCount} workflow(s)!`);
      } catch (error) {
        console.error('❌ [CALLBACK] Error confirming delete all:', error);
        ctx.reply('❌ Error deleting workflows. Please try again.');
      }
    });

    this.bot.action('cancel_delete', async (ctx) => {
      try {
        await ctx.answerCbQuery();
        ctx.reply('❌ Deletion cancelled.');
      } catch (error) {
        console.error('❌ [CALLBACK] Error cancelling delete:', error);
      }
    });

    this.bot.action('help', async (ctx) => {
      try {
        await ctx.answerCbQuery();
        const helpMessage = `ℹ️ *Help & Test Mode*

*How to Test:*
• Just type any streamer name: \`Ares\` or \`@Ares\`
• The bot will try to create a workflow for that streamer
• You'll see detailed logs and error messages

*Workflow Management:*
• Use "My Workflows" to see all your workflows in a clean list
• Use "Delete All" to remove all workflows at once
• Use /delete <workflow-id> to delete a specific workflow
• Copy workflow ID from the list and use it with /delete command

*What Happens:*
1. Bot validates the streamer name format
2. Creates a workflow with Abstract trigger + Telegram action
3. Calls Sprout Marketing API to create the workflow
4. Shows you the result (success or error)

*Debugging:*
• Check the console logs for detailed API call information
• Error messages will show exactly what went wrong
• This helps identify API endpoint or authentication issues

*Need help?* Visit [Sprout Marketing](https://sproutmarketing.xyz) for more info!`;

        ctx.replyWithMarkdown(helpMessage);
      } catch (error) {
        console.error('❌ [CALLBACK] Error handling help:', error);
      }
    });


    // Handle pagination for workflows
    this.bot.action(/^workflows_page_(\d+)$/, async (ctx) => {
      try {
        await ctx.answerCbQuery();
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
        ctx.reply('❌ Error loading page. Please try again.');
      }
    });

    // Handle delete workflow prompt
    this.bot.action('delete_workflow_prompt', async (ctx) => {
      try {
        await ctx.answerCbQuery();
        
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
        ctx.reply('❌ Error showing delete instructions. Please try again.');
      }
    });

    // Handle back to menu
    this.bot.action('back_to_menu', async (ctx) => {
      try {
        await ctx.answerCbQuery();
        
        const welcomeMessage = `🍅 *Welcome to Abstract Streamer Notifications!*\n\nGet notified instantly when your favorite streamers go live!\n\n*Features:*\n• 📺 Real-time stream notifications\n• 🎯 Customizable watchlist\n• 🔔 Smart notification management\n• ⚡ Lightning-fast alerts\n\nMade with ❤️ by [Sprout Marketing](https://sprout.marketing) - Build your own bots!`;

        const keyboard = {
          reply_markup: {
            inline_keyboard: [
              [
                { text: '🧪 Test Streamer', callback_data: 'test_streamer' },
                { text: '📋 My Workflows', callback_data: 'list_workflows' }
              ],
              [
                { text: '🗑️ Delete All', callback_data: 'delete_all_workflows' },
                { text: 'ℹ️ Help', callback_data: 'help' }
              ],
              [
                { text: '🌐 Visit Sprout Marketing', url: 'https://sprout.marketing' }
              ]
            ]
          }
        };

        ctx.replyWithMarkdown(welcomeMessage, keyboard);
      } catch (error) {
        console.error('❌ [CALLBACK] Error handling back to menu:', error);
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
      return [];
    }
  }

  // Delete all workflows
  async deleteAllWorkflows() {
    try {
      const workflows = await this.getUserWorkflows();
      let deletedCount = 0;
      
      for (const workflow of workflows) {
        try {
          const { Workflow } = require('otomato-sdk');
          const workflowObj = new Workflow('', [], []);
          workflowObj.id = workflow.id;
          
          const result = await workflowObj.delete();
          if (result.success) {
            deletedCount++;
            console.log(`✅ Deleted workflow: ${workflow.name} (${workflow.id})`);
          }
        } catch (error) {
          console.error(`❌ Failed to delete workflow ${workflow.id}:`, error);
        }
      }
      
      return deletedCount;
    } catch (error) {
      console.error('❌ [WORKFLOWS] Error deleting workflows:', error);
      throw error;
    }
  }

  // Delete specific workflow by ID
  async deleteWorkflowById(workflowId) {
    try {
      const { Workflow } = require('otomato-sdk');
      const workflow = new Workflow('', [], []);
      workflow.id = workflowId;
      
      const result = await workflow.delete();
      return result.success;
    } catch (error) {
      console.error(`❌ [WORKFLOWS] Error deleting workflow ${workflowId}:`, error);
      throw error;
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

      this.bot.launch();
      console.log('🍅 Abstract Streamer Bot started! (Test Mode - No Database)');
      
      // Graceful shutdown
      process.once('SIGINT', () => this.bot.stop('SIGINT'));
      process.once('SIGTERM', () => this.bot.stop('SIGTERM'));
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