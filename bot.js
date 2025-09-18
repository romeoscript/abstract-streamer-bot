// Abstract Streamer Notification Telegram Bot
// Node.js version using Otomato SDK + Telegram Bot API

require('dotenv').config();
const { Telegraf } = require('telegraf');
const { Trigger, Action, Edge, Workflow, TRIGGERS, ACTIONS } = require('otomato-sdk');
const { Pool } = require('pg');

class AbstractStreamerBot {
  constructor(telegramToken, otomatoToken, databaseUrl) {
    this.bot = new Telegraf(telegramToken);
    this.otomatoToken = otomatoToken;
    
    // Initialize PostgreSQL connection
    this.db = new Pool({
      connectionString: databaseUrl,
      ssl: {
        rejectUnauthorized: false
      }
    });
    
    // Configure Otomato SDK with token
    const { apiServices } = require('otomato-sdk');
    apiServices.setAuth(otomatoToken);
    
    this.setupCommands();
    // Don't call initializeDatabase here - it will be called in start()
  }

  // Initialize database tables
  async initializeDatabase() {
    console.log('🗄️ [DATABASE] Initializing database...');
    
    try {
      // Create users table
      await this.db.query(`
        CREATE TABLE IF NOT EXISTS users (
          user_id BIGINT PRIMARY KEY,
          chat_id VARCHAR(255) NOT NULL,
          notifications_enabled BOOLEAN DEFAULT true,
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )
      `);
      console.log('✅ [DATABASE] Users table created/verified');

      // Create streamers table
      await this.db.query(`
        CREATE TABLE IF NOT EXISTS streamers (
          id SERIAL PRIMARY KEY,
          user_id BIGINT REFERENCES users(user_id) ON DELETE CASCADE,
          streamer_handle VARCHAR(100) NOT NULL,
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          UNIQUE(user_id, streamer_handle)
        )
      `);
      console.log('✅ [DATABASE] Streamers table created/verified');

      // Create workflows table
      await this.db.query(`
        CREATE TABLE IF NOT EXISTS workflows (
          id SERIAL PRIMARY KEY,
          user_id BIGINT REFERENCES users(user_id) ON DELETE CASCADE,
          streamer_handle VARCHAR(100) NOT NULL,
          workflow_id VARCHAR(255) NOT NULL,
          status VARCHAR(50) DEFAULT 'active',
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          UNIQUE(user_id, streamer_handle)
        )
      `);
      console.log('✅ [DATABASE] Workflows table created/verified');

      console.log('🎉 [DATABASE] Database initialization completed successfully!');
    } catch (error) {
      console.error('❌ [DATABASE] Error initializing database:', error);
      throw error;
    }
  }

  // Database helper methods
  async getUser(userId) {
    const result = await this.db.query(
      'SELECT * FROM users WHERE user_id = $1',
      [userId]
    );
    return result.rows[0] || null;
  }

  async getUserStreamers(userId) {
    const result = await this.db.query(
      'SELECT streamer_handle FROM streamers WHERE user_id = $1 ORDER BY created_at',
      [userId]
    );
    return result.rows.map(row => row.streamer_handle);
  }

  async addStreamerToUser(userId, streamerHandle) {
    await this.db.query(
      'INSERT INTO streamers (user_id, streamer_handle) VALUES ($1, $2) ON CONFLICT (user_id, streamer_handle) DO NOTHING',
      [userId, streamerHandle]
    );
  }

  async removeStreamerFromUser(userId, streamerHandle) {
    await this.db.query(
      'DELETE FROM streamers WHERE user_id = $1 AND streamer_handle = $2',
      [userId, streamerHandle]
    );
  }

  async saveWorkflow(userId, streamerHandle, workflowId) {
    await this.db.query(
      'INSERT INTO workflows (user_id, streamer_handle, workflow_id) VALUES ($1, $2, $3) ON CONFLICT (user_id, streamer_handle) DO UPDATE SET workflow_id = $3, updated_at = CURRENT_TIMESTAMP',
      [userId, streamerHandle, workflowId]
    );
  }

  async getWorkflowId(userId, streamerHandle) {
    const result = await this.db.query(
      'SELECT workflow_id FROM workflows WHERE user_id = $1 AND streamer_handle = $2',
      [userId, streamerHandle]
    );
    return result.rows[0]?.workflow_id || null;
  }

  async deleteWorkflow(userId, streamerHandle) {
    await this.db.query(
      'DELETE FROM workflows WHERE user_id = $1 AND streamer_handle = $2',
      [userId, streamerHandle]
    );
  }

  async updateUserNotifications(userId, enabled) {
    await this.db.query(
      'UPDATE users SET notifications_enabled = $1, updated_at = CURRENT_TIMESTAMP WHERE user_id = $2',
      [enabled, userId]
    );
  }

  setupCommands() {
    // Start command
    this.bot.start(async (ctx) => {
      const userId = ctx.from.id;
      const chatId = ctx.chat.id.toString();
      
      console.log(`👤 [START] User ${userId} started the bot`);
      
      try {
        // Check if user exists in database
        const userResult = await this.db.query(
          'SELECT * FROM users WHERE user_id = $1',
          [userId]
        );
        
        if (userResult.rows.length === 0) {
          // Create new user
          await this.db.query(
            'INSERT INTO users (user_id, chat_id, notifications_enabled) VALUES ($1, $2, $3)',
            [userId, chatId, true]
          );
          console.log(`✅ [START] Created new user ${userId}`);
        } else {
          // Update chat_id if changed
          await this.db.query(
            'UPDATE users SET chat_id = $1, updated_at = CURRENT_TIMESTAMP WHERE user_id = $2',
            [chatId, userId]
          );
          console.log(`✅ [START] Updated user ${userId} chat_id`);
        }
      } catch (error) {
        console.error('❌ [START] Error handling user start:', error);
      }

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
      const userData = await this.getUser(userId);
      
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
        const currentStreamers = await this.getUserStreamers(userId);
        console.log(`📋 [ADD COMMAND] Current streamers: [${currentStreamers.join(', ')}]`);
        
        // Add streamer to user's list
        if (!currentStreamers.includes(streamerHandle)) {
          console.log(`✅ [ADD COMMAND] "${streamerHandle}" not in watchlist, proceeding...`);
          
          // Validate streamer exists (basic check)
          console.log(`🔍 [ADD COMMAND] Validating streamer "${streamerHandle}"...`);
          const isValidStreamer = await this.validateStreamer(streamerHandle);
          
          if (!isValidStreamer) {
            console.log(`❌ [ADD COMMAND] Streamer "${streamerHandle}" validation failed`);
            return ctx.reply(`❌ Streamer "${streamerHandle}" not found on Abstract platform. Please check the username and try again.`);
          }
          
          console.log(`✅ [ADD COMMAND] Streamer "${streamerHandle}" validation passed`);
          
          // Add to database
          await this.addStreamerToUser(userId, streamerHandle);
          console.log(`📝 [ADD COMMAND] Added "${streamerHandle}" to user's streamers in database`);
          
          // Create Otomato workflow for this user-streamer combination
          console.log(`🔧 [ADD COMMAND] Creating Otomato workflow for "${streamerHandle}"...`);
          let workflowId;
          try {
            workflowId = await this.createStreamerWorkflow(streamerHandle, userData.chat_id);
            console.log(`✅ [ADD COMMAND] Workflow created with ID: ${workflowId}`);
          } catch (workflowError) {
            console.error(`❌ [ADD COMMAND] Failed to create workflow for "${streamerHandle}":`, workflowError);
            // Remove the streamer from database since workflow creation failed
            await this.removeStreamerFromUser(userId, streamerHandle);
            return ctx.reply(`❌ Failed to create notification workflow for ${streamerHandle}. Please check your Otomato token and try again.`);
          }
          
          // Save workflow to database
          try {
            await this.saveWorkflow(userId, streamerHandle, workflowId);
            console.log(`💾 [ADD COMMAND] Saved workflow to database: ${userId}_${streamerHandle} -> ${workflowId}`);
          } catch (dbError) {
            console.error(`❌ [ADD COMMAND] Failed to save workflow to database:`, dbError);
            return ctx.reply(`❌ Failed to save workflow configuration. Please try again.`);
          }
          
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
      console.log('\n🗑️ [REMOVE COMMAND] Starting streamer removal process...');
      
      const userId = ctx.from.id;
      const userData = await this.getUser(userId);
      
      console.log(`👤 [REMOVE COMMAND] User ID: ${userId}`);
      console.log(`📊 [REMOVE COMMAND] User data exists: ${!!userData}`);
      
      if (!userData) {
        console.log('❌ [REMOVE COMMAND] User not found, requesting /start first');
        return ctx.reply('Please use /start first!');
      }

      const streamerHandle = ctx.message.text.split(' ')[1];
      console.log(`🎯 [REMOVE COMMAND] Streamer handle: "${streamerHandle}"`);
      
      if (!streamerHandle) {
        console.log('❌ [REMOVE COMMAND] No streamer handle provided');
        return ctx.reply('Please provide a streamer handle: /remove <streamer_handle>');
      }

      try {
        const currentStreamers = await this.getUserStreamers(userId);
        console.log(`📋 [REMOVE COMMAND] Current streamers: [${currentStreamers.join(', ')}]`);
        
        if (currentStreamers.includes(streamerHandle)) {
          console.log(`✅ [REMOVE COMMAND] "${streamerHandle}" found in watchlist, proceeding...`);
          
          // Remove from database
          await this.removeStreamerFromUser(userId, streamerHandle);
          console.log(`📝 [REMOVE COMMAND] Removed "${streamerHandle}" from user's streamers in database`);
          
          // Get and delete Otomato workflow
          const workflowId = await this.getWorkflowId(userId, streamerHandle);
          if (workflowId) {
            console.log(`🔧 [REMOVE COMMAND] Deleting workflow ${workflowId} for "${streamerHandle}"...`);
            const workflow = new Workflow();
            await workflow.delete(workflowId);
            console.log(`✅ [REMOVE COMMAND] Workflow ${workflowId} deleted successfully`);
          }
          
          // Remove workflow from database
          await this.deleteWorkflow(userId, streamerHandle);
          console.log(`💾 [REMOVE COMMAND] Removed workflow from database`);
          
          console.log(`🎉 [REMOVE COMMAND] Successfully removed "${streamerHandle}" from watchlist!`);
          ctx.reply(`✅ Removed ${streamerHandle} from your watchlist!`);
        } else {
          console.log(`⚠️ [REMOVE COMMAND] "${streamerHandle}" not in watchlist`);
          ctx.reply(`${streamerHandle} is not in your watchlist!`);
        }
      } catch (error) {
        console.error('❌ [REMOVE COMMAND] Error removing streamer:', error);
        console.error('❌ [REMOVE COMMAND] Error details:', {
          message: error.message,
          stack: error.stack,
          name: error.name
        });
        ctx.reply('❌ Error removing streamer. Please try again.');
      }
    });

    // List streamers command
    this.bot.command('list', async (ctx) => {
      const userId = ctx.from.id;
      const userData = await this.getUser(userId);
      
      if (!userData) {
        return ctx.reply('Please use /start first!');
      }

      const streamers = await this.getUserStreamers(userId);
      if (streamers.length === 0) {
        return ctx.reply('You are not watching any streamers yet. Use /add <streamer> to add one!');
      }

      const status = userData.notifications_enabled ? '🔔 ON' : '🔕 OFF';
      const streamerList = streamers.map(s => `• ${s}`).join('\n');
      
      ctx.reply(
        `📺 Your Streamers (${streamers.length}):\n\n` +
        `${streamerList}\n\n` +
        `Notifications: ${status}\n\n` +
        'Made with ❤️ by Otomato'
      );
    });

    // Toggle notifications command
    this.bot.command('toggle', async (ctx) => {
      const userId = ctx.from.id;
      const userData = await this.getUser(userId);
      
      if (!userData) {
        return ctx.reply('Please use /start first!');
      }

      const newStatus = !userData.notifications_enabled;
      await this.updateUserNotifications(userId, newStatus);
      const status = newStatus ? 'enabled' : 'disabled';
      
      ctx.reply(`🔔 Notifications ${status}!`);
    });

    // Handle usernames without /add command (e.g., just typing "Ares")
    this.bot.on('text', async (ctx) => {
      console.log('\n🔍 [TEXT HANDLER] Processing incoming text...');
      
      const userId = ctx.from.id;
      const userData = await this.getUser(userId);
      
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
        const currentStreamers = await this.getUserStreamers(userId);
        console.log(`📋 [TEXT HANDLER] Current streamers: [${currentStreamers.join(', ')}]`);
        
        // Add streamer to user's list
        if (!currentStreamers.includes(streamerHandle)) {
          console.log(`✅ [TEXT HANDLER] "${streamerHandle}" not in watchlist, proceeding...`);
          
          // Validate streamer exists (basic check)
          console.log(`🔍 [TEXT HANDLER] Validating streamer "${streamerHandle}"...`);
          const isValidStreamer = await this.validateStreamer(streamerHandle);
          
          if (!isValidStreamer) {
            console.log(`❌ [TEXT HANDLER] Streamer "${streamerHandle}" validation failed`);
            return ctx.reply(`❌ Streamer "${streamerHandle}" not found on Abstract platform. Please check the username and try again.`);
          }
          
          console.log(`✅ [TEXT HANDLER] Streamer "${streamerHandle}" validation passed`);
          
          // Add to database
          await this.addStreamerToUser(userId, streamerHandle);
          console.log(`📝 [TEXT HANDLER] Added "${streamerHandle}" to user's streamers in database`);
          
          // Create Otomato workflow for this user-streamer combination
          console.log(`🔧 [TEXT HANDLER] Creating Otomato workflow for "${streamerHandle}"...`);
          let workflowId;
          try {
            workflowId = await this.createStreamerWorkflow(streamerHandle, userData.chat_id);
            console.log(`✅ [TEXT HANDLER] Workflow created with ID: ${workflowId}`);
          } catch (workflowError) {
            console.error(`❌ [TEXT HANDLER] Failed to create workflow for "${streamerHandle}":`, workflowError);
            // Remove the streamer from database since workflow creation failed
            await this.removeStreamerFromUser(userId, streamerHandle);
            return ctx.reply(`❌ Failed to create notification workflow for ${streamerHandle}. Please check your Otomato token and try again.`);
          }
          
          // Save workflow to database
          try {
            await this.saveWorkflow(userId, streamerHandle, workflowId);
            console.log(`💾 [TEXT HANDLER] Saved workflow to database: ${userId}_${streamerHandle} -> ${workflowId}`);
          } catch (dbError) {
            console.error(`❌ [TEXT HANDLER] Failed to save workflow to database:`, dbError);
            return ctx.reply(`❌ Failed to save workflow configuration. Please try again.`);
          }
          
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
    this.bot.action('add_streamer', async (ctx) => {
      try {
        await ctx.answerCbQuery();
        ctx.reply('📺 *Add a Streamer*\n\nPlease send the streamer handle:\n\nExample: `ninja`', { parse_mode: 'Markdown' });
      } catch (error) {
        console.error('❌ [CALLBACK] Error handling add_streamer:', error);
      }
    });

    this.bot.action('list_streamers', async (ctx) => {
      try {
        await ctx.answerCbQuery();
        const userId = ctx.from.id;
        const userData = await this.getUser(userId);
        
        if (!userData) {
          return ctx.reply('Please use /start first!');
        }

        const streamers = await this.getUserStreamers(userId);
        if (streamers.length === 0) {
          return ctx.reply('You are not watching any streamers yet. Use /add <streamer> to add one!');
        }

        const status = userData.notifications_enabled ? '🔔 ON' : '🔕 OFF';
        const streamerList = streamers.map(s => `• ${s}`).join('\n');
        
        ctx.reply(
          `📺 *Your Streamers (${streamers.length}):*\n\n` +
          `${streamerList}\n\n` +
          `Notifications: ${status}\n\n` +
          `Use /remove <streamer> to remove a streamer`,
          { parse_mode: 'Markdown' }
        );
      } catch (error) {
        console.error('❌ [CALLBACK] Error handling list_streamers:', error);
      }
    });

    this.bot.action('toggle_notifications', async (ctx) => {
      try {
        await ctx.answerCbQuery();
        const userId = ctx.from.id;
        const userData = await this.getUser(userId);
        
        if (!userData) {
          return ctx.reply('Please use /start first!');
        }

        const newStatus = !userData.notifications_enabled;
        await this.updateUserNotifications(userId, newStatus);
        const status = newStatus ? 'enabled' : 'disabled';
        const emoji = newStatus ? '🔔' : '🔕';
        
        ctx.reply(`${emoji} Notifications ${status}!`);
      } catch (error) {
        console.error('❌ [CALLBACK] Error handling toggle_notifications:', error);
      }
    });

    this.bot.action('remove_streamer', async (ctx) => {
      try {
        await ctx.answerCbQuery();
        ctx.reply('❌ *Remove a Streamer*\n\nPlease send the streamer handle:\n\nExample: `/remove ninja`', { parse_mode: 'Markdown' });
      } catch (error) {
        console.error('❌ [CALLBACK] Error handling remove_streamer:', error);
      }
    });

    this.bot.action('help', async (ctx) => {
      try {
        await ctx.answerCbQuery();
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
      } catch (error) {
        console.error('❌ [CALLBACK] Error handling help:', error);
      }
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
  async start() {
    try {
      // Initialize database first
      await this.initializeDatabase();
      
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
      console.log('🍅 Abstract Streamer Bot started!');
      
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
  const OTOMATO_TOKEN = process.env.OTOMATO_TOKEN;

  if (!TELEGRAM_BOT_TOKEN || !OTOMATO_TOKEN || !process.env.DATABASE_URL) {
    console.error('❌ Missing required environment variables!');
    console.error('Please set TELEGRAM_BOT_TOKEN, OTOMATO_TOKEN, and DATABASE_URL in your .env file');
    process.exit(1);
  }

  const bot = new AbstractStreamerBot(TELEGRAM_BOT_TOKEN, OTOMATO_TOKEN, process.env.DATABASE_URL);
  bot.start();
}

main().catch(console.error);