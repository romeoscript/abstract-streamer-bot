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
      const userId = ctx.from.id;
      const userData = this.users.get(userId);
      
      if (!userData) {
        return ctx.reply('Please use /start first!');
      }

      const streamerHandle = ctx.message.text.split(' ')[1];
      if (!streamerHandle) {
        return ctx.reply('Please provide a streamer handle: /add <streamer_handle>');
      }

      try {
        // Add streamer to user's list
        if (!userData.streamers.includes(streamerHandle)) {
          userData.streamers.push(streamerHandle);
          
          // Create Otomato workflow for this user-streamer combination
          const workflowId = await this.createStreamerWorkflow(streamerHandle, userData.chatId);
          this.activeWorkflows.set(`${userId}_${streamerHandle}`, workflowId);
          
          ctx.reply(`✅ Added ${streamerHandle} to your watchlist!`);
        } else {
          ctx.reply(`${streamerHandle} is already in your watchlist!`);
        }
      } catch (error) {
        console.error('Error adding streamer:', error);
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

    // Inline keyboard callback handlers
    this.bot.action('add_streamer', (ctx) => {
      ctx.answerCbQuery();
      ctx.reply('📺 *Add a Streamer*\n\nPlease send the streamer handle:\n\nExample: `/add ninja`', { parse_mode: 'Markdown' });
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

*How it works:*
1. Add streamers using their handle (e.g., ninja, shroud)
2. Get instant notifications when they go live
3. Manage your watchlist anytime

*Need help?* Visit [Otomato.xyz](https://otomato.xyz) for more info!`;

      ctx.replyWithMarkdown(helpMessage);
    });
  }

  // Create Otomato workflow for streamer notifications
  async createStreamerWorkflow(streamerHandle, chatId) {
    const workflow = await this.abstractGetNotifiedWhenStreamerIsLive(streamerHandle, chatId);
    const result = await workflow.create();
    return result.id;
  }

  // Based on Clément's workflow code
  async abstractGetNotifiedWhenStreamerIsLive(streamerHandle, chatId) {
    const trigger = new Trigger(TRIGGERS.SOCIALS.ABSTRACT.ON_STREAMER_LIVE);
    trigger.setParams('streamer', streamerHandle);

    const telegramAction = new Action(ACTIONS.NOTIFICATIONS.TELEGRAM.SEND_MESSAGE);
    telegramAction.setParams('message', 
      `🔴 ${trigger.getParameterVariableName('streamer')} is live!\n\n` +
      `🎮 Watch now: https://portal.abs.xyz/stream/${trigger.getParameterVariableName('streamer')}\n\n` +
      `Made with ❤️ by Otomato`
    );
    telegramAction.setParam('chat_id', chatId);
    // You'll need to get webhook from Otomato when creating your script

    const edge = new Edge({ source: trigger, target: telegramAction });

    return new Workflow(
      `Abstract Streamer Notifications - ${streamerHandle}`, 
      [trigger, telegramAction], 
      [edge]
    );
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