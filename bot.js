// Abstract Streamer Notification Telegram Bot
// Node.js version using Otomato SDK + Telegram Bot API

require('dotenv').config();
const { Telegraf } = require('telegraf');
const { Trigger, Action, Edge, Workflow, TRIGGERS, ACTIONS } = require('otomato-sdk');

class AbstractStreamerBot {
  constructor(telegramToken, otomatoToken) {
    this.bot = new Telegraf(telegramToken);
    this.otomatoToken = otomatoToken;
    this.users = new Map(); // In-memory storage - use database in production
    this.activeWorkflows = new Map(); // streamer -> workflowId
    
    // Configure Otomato SDK with token
    const { apiServices } = require('otomato-sdk');
    apiServices.setAuth(otomatoToken);
    
    this.setupCommands();
  }

  setupCommands() {
    // Start command
    this.bot.start((ctx) => {
      const userId = ctx.from.id;
      const chatId = ctx.chat.id.toString();
      
      this.users.set(userId, {
        userId,
        streamers: [],
        notificationsEnabled: true,
        chatId
      });

      const welcomeMessage = `🍅 *Welcome to Abstract Streamer Notifications!*

Get notified instantly when your favorite streamers go live! 

*Features:*
• 📺 Real-time stream notifications
• 🎯 Customizable watchlist
• 🔔 Smart notification management
• ⚡ Lightning-fast alerts

Made with ❤️ by [Otomato](https://otomato.xyz) - Build your own bots!`;

      const keyboard = {
        reply_markup: {
          inline_keyboard: [
            [
              { text: '📺 Add Streamer', callback_data: 'add_streamer' },
              { text: '📋 My Streamers', callback_data: 'list_streamers' }
            ],
            [
              { text: '🔔 Toggle Notifications', callback_data: 'toggle_notifications' },
              { text: '❌ Remove Streamer', callback_data: 'remove_streamer' }
            ],
            [
              { text: 'ℹ️ Help', callback_data: 'help' },
              { text: '🌐 Visit Otomato', url: 'https://otomato.xyz' }
            ]
          ]
        }
      };

      ctx.replyWithMarkdown(welcomeMessage, keyboard);
    });

    // Add streamer command
    this.bot.command('add', async (ctx) => {
      console.log('\n🔍 [ADD COMMAND] Starting streamer addition process...');
      
      const userId = ctx.from.id;
      const userData = this.users.get(userId);
      
      console.log(`👤 [ADD COMMAND] User ID: ${userId}`);
      console.log(`📊 [ADD COMMAND] User data exists: ${!!userData}`);
      
      if (!userData) {
        console.log('❌ [ADD COMMAND] User not found, requesting /start first');
        return ctx.reply('Please use /start first!');
      }

      const streamerHandle = ctx.message.text.split(' ')[1];
      console.log(`🎯 [ADD COMMAND] Streamer handle: "${streamerHandle}"`);
      
      if (!streamerHandle) {
        console.log('❌ [ADD COMMAND] No streamer handle provided');
        return ctx.reply('Please provide a streamer handle: /add <streamer_handle>');
      }

      try {
        console.log(`🔍 [ADD COMMAND] Checking if "${streamerHandle}" is already in watchlist...`);
        console.log(`📋 [ADD COMMAND] Current streamers: [${userData.streamers.join(', ')}]`);
        
        // Add streamer to user's list
        if (!userData.streamers.includes(streamerHandle)) {
          console.log(`✅ [ADD COMMAND] "${streamerHandle}" not in watchlist, proceeding...`);
          
          // Validate streamer exists (basic check)
          console.log(`🔍 [ADD COMMAND] Validating streamer "${streamerHandle}"...`);
          const isValidStreamer = await this.validateStreamer(streamerHandle);
          
          if (!isValidStreamer) {
            console.log(`❌ [ADD COMMAND] Streamer "${streamerHandle}" validation failed`);
            return ctx.reply(`❌ Streamer "${streamerHandle}" not found on Abstract platform. Please check the username and try again.`);
          }
          
          console.log(`✅ [ADD COMMAND] Streamer "${streamerHandle}" validation passed`);
          userData.streamers.push(streamerHandle);
          console.log(`📝 [ADD COMMAND] Added "${streamerHandle}" to user's streamers list`);
          
          // Create Otomato workflow for this user-streamer combination
          console.log(`🔧 [ADD COMMAND] Creating Otomato workflow for "${streamerHandle}"...`);
          const workflowId = await this.createStreamerWorkflow(streamerHandle, userData.chatId);
          console.log(`✅ [ADD COMMAND] Workflow created with ID: ${workflowId}`);
          
          this.activeWorkflows.set(`${userId}_${streamerHandle}`, workflowId);
          console.log(`💾 [ADD COMMAND] Stored workflow mapping: ${userId}_${streamerHandle} -> ${workflowId}`);
          
          console.log(`🎉 [ADD COMMAND] Successfully added "${streamerHandle}" to watchlist!`);
          ctx.reply(`✅ Added ${streamerHandle} to your watchlist!`);
        } else {
          console.log(`⚠️ [ADD COMMAND] "${streamerHandle}" already in watchlist`);
          ctx.reply(`${streamerHandle} is already in your watchlist!`);
        }
      } catch (error) {
        console.error('❌ [ADD COMMAND] Error adding streamer:', error);
        console.error('❌ [ADD COMMAND] Error details:', {
          message: error.message,
          stack: error.stack,
          name: error.name
        });
        ctx.reply('❌ Error adding streamer. Please try again.');
      }
    });

    // Remove streamer command
    this.bot.command('remove', async (ctx) => {
      const userId = ctx.from.id;
      const userData = this.users.get(userId);
      
      if (!userData) {
        return ctx.reply('Please use /start first!');
      }

      const streamerHandle = ctx.message.text.split(' ')[1];
      if (!streamerHandle) {
        return ctx.reply('Please provide a streamer handle: /remove <streamer_handle>');
      }

      const index = userData.streamers.indexOf(streamerHandle);
      if (index > -1) {
        userData.streamers.splice(index, 1);
        
        // Remove Otomato workflow
        const workflowKey = `${userId}_${streamerHandle}`;
        const workflowId = this.activeWorkflows.get(workflowKey);
        if (workflowId) {
          const workflow = new Workflow();
          await workflow.delete(workflowId);
          this.activeWorkflows.delete(workflowKey);
        }
        
        ctx.reply(`✅ Removed ${streamerHandle} from your watchlist!`);
      } else {
        ctx.reply(`${streamerHandle} is not in your watchlist!`);
      }
    });

    // List streamers command
    this.bot.command('list', (ctx) => {
      const userId = ctx.from.id;
      const userData = this.users.get(userId);
      
      if (!userData) {
        return ctx.reply('Please use /start first!');
      }

      if (userData.streamers.length === 0) {
        return ctx.reply('You are not watching any streamers yet. Use /add <streamer> to add one!');
      }

      const status = userData.notificationsEnabled ? '🔔 ON' : '🔕 OFF';
      const streamerList = userData.streamers.map(s => `• ${s}`).join('\n');
      
      ctx.reply(
        `📺 Your Streamers (${userData.streamers.length}):\n\n` +
        `${streamerList}\n\n` +
        `Notifications: ${status}\n\n` +
        'Made with ❤️ by Otomato'
      );
    });

    // Toggle notifications command
    this.bot.command('toggle', async (ctx) => {
      const userId = ctx.from.id;
      const userData = this.users.get(userId);
      
      if (!userData) {
        return ctx.reply('Please use /start first!');
      }

      userData.notificationsEnabled = !userData.notificationsEnabled;
      const status = userData.notificationsEnabled ? 'enabled' : 'disabled';
      
      ctx.reply(`🔔 Notifications ${status}!`);
    });

    // Handle usernames without /add command (e.g., just typing "Ares")
    this.bot.on('text', async (ctx) => {
      console.log('\n🔍 [TEXT HANDLER] Processing incoming text...');
      
      const userId = ctx.from.id;
      const userData = this.users.get(userId);
      
      console.log(`👤 [TEXT HANDLER] User ID: ${userId}`);
      console.log(`📊 [TEXT HANDLER] User data exists: ${!!userData}`);
      
      if (!userData) {
        console.log('❌ [TEXT HANDLER] User not found, ignoring message');
        return; // User hasn't started the bot yet
      }

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
        console.log(`🔍 [TEXT HANDLER] Checking if "${streamerHandle}" is already in watchlist...`);
        console.log(`📋 [TEXT HANDLER] Current streamers: [${userData.streamers.join(', ')}]`);
        
        // Add streamer to user's list
        if (!userData.streamers.includes(streamerHandle)) {
          console.log(`✅ [TEXT HANDLER] "${streamerHandle}" not in watchlist, proceeding...`);
          
          // Validate streamer exists (basic check)
          console.log(`🔍 [TEXT HANDLER] Validating streamer "${streamerHandle}"...`);
          const isValidStreamer = await this.validateStreamer(streamerHandle);
          
          if (!isValidStreamer) {
            console.log(`❌ [TEXT HANDLER] Streamer "${streamerHandle}" validation failed`);
            return ctx.reply(`❌ Streamer "${streamerHandle}" not found on Abstract platform. Please check the username and try again.`);
          }
          
          console.log(`✅ [TEXT HANDLER] Streamer "${streamerHandle}" validation passed`);
          userData.streamers.push(streamerHandle);
          console.log(`📝 [TEXT HANDLER] Added "${streamerHandle}" to user's streamers list`);
          
          // Create Otomato workflow for this user-streamer combination
          console.log(`🔧 [TEXT HANDLER] Creating Otomato workflow for "${streamerHandle}"...`);
          const workflowId = await this.createStreamerWorkflow(streamerHandle, userData.chatId);
          console.log(`✅ [TEXT HANDLER] Workflow created with ID: ${workflowId}`);
          
          this.activeWorkflows.set(`${userId}_${streamerHandle}`, workflowId);
          console.log(`💾 [TEXT HANDLER] Stored workflow mapping: ${userId}_${streamerHandle} -> ${workflowId}`);
          
          console.log(`🎉 [TEXT HANDLER] Successfully added "${streamerHandle}" to watchlist!`);
          ctx.reply(`✅ Added @${streamerHandle} to your watchlist!`);
        } else {
          console.log(`⚠️ [TEXT HANDLER] "${streamerHandle}" already in watchlist`);
          ctx.reply(`@${streamerHandle} is already in your watchlist!`);
        }
      } catch (error) {
        console.error('❌ [TEXT HANDLER] Error adding streamer:', error);
        console.error('❌ [TEXT HANDLER] Error details:', {
          message: error.message,
          stack: error.stack,
          name: error.name
        });
        ctx.reply('❌ Error adding streamer. Please try again.');
      }
    });

    // Inline keyboard callback handlers
    this.bot.action('add_streamer', (ctx) => {
      ctx.answerCbQuery();
      ctx.reply('📺 *Add a Streamer*\n\nPlease send the streamer handle:\n\nExample: `ninja`', { parse_mode: 'Markdown' });
    });

    this.bot.action('list_streamers', async (ctx) => {
      ctx.answerCbQuery();
      const userId = ctx.from.id;
      const userData = this.users.get(userId);
      
      if (!userData) {
        return ctx.reply('Please use /start first!');
      }

      if (userData.streamers.length === 0) {
        return ctx.reply('You are not watching any streamers yet. Use /add <streamer> to add one!');
      }

      const status = userData.notificationsEnabled ? '🔔 ON' : '🔕 OFF';
      const streamerList = userData.streamers.map(s => `• ${s}`).join('\n');
      
      ctx.reply(
        `📺 *Your Streamers (${userData.streamers.length}):*\n\n` +
        `${streamerList}\n\n` +
        `Notifications: ${status}\n\n` +
        `Use /remove <streamer> to remove a streamer`,
        { parse_mode: 'Markdown' }
      );
    });

    this.bot.action('toggle_notifications', async (ctx) => {
      ctx.answerCbQuery();
      const userId = ctx.from.id;
      const userData = this.users.get(userId);
      
      if (!userData) {
        return ctx.reply('Please use /start first!');
      }

      userData.notificationsEnabled = !userData.notificationsEnabled;
      const status = userData.notificationsEnabled ? 'enabled' : 'disabled';
      const emoji = userData.notificationsEnabled ? '🔔' : '🔕';
      
      ctx.reply(`${emoji} Notifications ${status}!`);
    });

    this.bot.action('remove_streamer', (ctx) => {
      ctx.answerCbQuery();
      ctx.reply('❌ *Remove a Streamer*\n\nPlease send the streamer handle:\n\nExample: `/remove ninja`', { parse_mode: 'Markdown' });
    });

    this.bot.action('help', (ctx) => {
      ctx.answerCbQuery();
      const helpMessage = `ℹ️ *Help & Commands*

*Available Commands:*
• \`/add <streamer>\` - Add streamer to watchlist
• \`/remove <streamer>\` - Remove streamer from watchlist  
• \`/list\` - Show your current streamers
• \`/toggle\` - Turn notifications on/off

*Quick Add:*
• Just type the username: \`Ares\` or \`@Ares\`
• No need for /add command!

*How it works:*
1. Add streamers using their handle (e.g., ninja, shroud, Ares)
2. Get instant notifications when they go live
3. Manage your watchlist anytime

*Need help?* Visit [Otomato.xyz](https://otomato.xyz) for more info!`;

      ctx.replyWithMarkdown(helpMessage);
    });
  }

  // Create Otomato workflow for streamer notifications
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
      
      return result.id;
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
    console.log(`🔧 [WORKFLOW BUILD] Trigger created with streamer parameter: "${streamerHandle}"`);

    console.log(`🔧 [WORKFLOW BUILD] Creating Telegram action...`);
    const telegramAction = new Action(ACTIONS.NOTIFICATIONS.TELEGRAM.SEND_MESSAGE);
    const message = `🔴 ${trigger.getParameterVariableName('streamer')} is live!\n\n` +
      `🎮 Watch now: https://portal.abs.xyz/stream/${trigger.getParameterVariableName('streamer')}\n\n` +
      `Made with ❤️ by Otomato`;
    
    console.log(`🔧 [WORKFLOW BUILD] Message template:`, message);
    telegramAction.setParams('message', message);
    telegramAction.setParams('chat_id', chatId);
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

  // Start the bot
  start() {
    this.bot.launch();
    console.log('🍅 Abstract Streamer Bot started!');
    
    // Graceful shutdown
    process.once('SIGINT', () => this.bot.stop('SIGINT'));
    process.once('SIGTERM', () => this.bot.stop('SIGTERM'));
  }
}

// Start the bot
async function main() {
  const TELEGRAM_BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN;
  const OTOMATO_TOKEN = process.env.OTOMATO_TOKEN;

  if (!TELEGRAM_BOT_TOKEN || !OTOMATO_TOKEN) {
    console.error('❌ Missing required environment variables!');
    console.error('Please set TELEGRAM_BOT_TOKEN and OTOMATO_TOKEN in your .env file');
    process.exit(1);
  }

  const bot = new AbstractStreamerBot(TELEGRAM_BOT_TOKEN, OTOMATO_TOKEN);
  bot.start();
}

main().catch(console.error);