# Abstract Streamer Notification Bot

A professional Telegram bot that provides real-time notifications when Abstract streamers go live. Built with the Otomato SDK for seamless workflow automation and powered by modern Node.js technologies.

## 🚀 Features

- **Real-time Notifications**: Instant alerts when followed streamers go live
- **Interactive Interface**: Beautiful inline keyboard buttons for easy navigation
- **Smart Management**: Add/remove streamers with simple commands
- **Notification Control**: Toggle notifications on/off as needed
- **Scalable Architecture**: Built with Otomato SDK for enterprise-grade automation
- **User-friendly**: Intuitive commands and responsive design

## 📋 Prerequisites

- Node.js 16+ 
- npm or yarn package manager
- Telegram Bot Token (from [@BotFather](https://t.me/BotFather))
- Otomato API Token

## 🛠️ Installation

### 1. Clone the Repository

```bash
git clone <repository-url>
cd otomato_bot
```

### 2. Install Dependencies

```bash
npm install
# or
yarn install
```

### 3. Environment Configuration

```bash
cp .env.example .env
```

Edit `.env` with your credentials:

```env
TELEGRAM_BOT_TOKEN=your_telegram_bot_token_here
OTOMATO_TOKEN=your_otomato_token_here
```

### 4. Get Required Tokens

#### Telegram Bot Token
1. Message [@BotFather](https://t.me/BotFather) on Telegram
2. Send `/newbot` and follow the instructions
3. Copy the provided bot token

#### Otomato API Token
1. Visit the [Otomato SDK Documentation](https://secret-echinodon-f5b.notion.site/How-to-use-the-SDK-Somnia-edition-20f268c3f22980ba8452caea7d377b2c)
2. Follow the guide to generate your API token

## 🚀 Usage

### Start the Bot

```bash
# Production
npm start

# Development (with auto-restart)
npm run dev
```

### Bot Commands

| Command | Description |
|---------|-------------|
| `/start` | Initialize the bot and show welcome message |
| `/add <streamer>` | Add a streamer to your watchlist |
| `/remove <streamer>` | Remove a streamer from your watchlist |
| `/list` | Display your current streamers |
| `/toggle` | Toggle notifications on/off |

### Interactive Interface

The bot features an intuitive inline keyboard with the following options:

- **📺 Add Streamer** - Quick access to add new streamers
- **📋 My Streamers** - View your current watchlist
- **🔔 Toggle Notifications** - Enable/disable notifications
- **❌ Remove Streamer** - Remove streamers from watchlist
- **ℹ️ Help** - Display help information
- **🌐 Visit Otomato** - Link to Otomato platform

## 📁 Project Structure

```
otomato_bot/
├── bot.js              # Main bot implementation
├── package.json        # Dependencies and scripts
├── .env.example       # Environment variables template
├── .env               # Your environment variables (create this)
├── .gitignore         # Git ignore rules
└── README.md          # Project documentation
```

## 🔧 Technical Details

### Dependencies

- **telegraf**: Modern Telegram Bot API framework
- **otomato-sdk**: Workflow automation SDK
- **dotenv**: Environment variable management
- **nodemon**: Development auto-restart (dev dependency)

### Architecture

The bot uses a clean, modular architecture:

- **Class-based Design**: `AbstractStreamerBot` class for organized code
- **Workflow Integration**: Otomato SDK for streamer monitoring
- **Memory Storage**: In-memory user data (upgrade to database for production)
- **Error Handling**: Comprehensive error management
- **Graceful Shutdown**: Proper cleanup on termination

## 🚀 Deployment

### Railway

1. Connect your GitHub repository to Railway
2. Add environment variables in the Railway dashboard
3. Deploy automatically

### Heroku

```bash
# Create Heroku app
heroku create your-bot-name

# Set environment variables
heroku config:set TELEGRAM_BOT_TOKEN=your_token
heroku config:set OTOMATO_TOKEN=your_token

# Deploy
git push heroku main
```

### Docker (Optional)

```dockerfile
FROM node:18-alpine
WORKDIR /app
COPY package*.json ./
RUN npm install --production
COPY . .
CMD ["npm", "start"]
```

## 📊 Example Usage Flow

```
User: /start
Bot: 🍅 Welcome to Abstract Streamer Notifications!
     [Interactive buttons appear]

User: [Clicks "📺 Add Streamer"]
Bot: 📺 Add a Streamer
     Please send the streamer handle:
     Example: /add ninja

User: /add ninja
Bot: ✅ Added ninja to your watchlist!

User: [Clicks "📋 My Streamers"]
Bot: 📺 Your Streamers (1):
     • ninja
     Notifications: 🔔 ON
```

When `ninja` goes live:
```
Bot: 🔴 ninja is live! 🎮 
     Watch now: https://portal.abs.xyz/stream/ninja
```

## 🔒 Security Considerations

- Store sensitive tokens in environment variables
- Never commit `.env` files to version control
- Use HTTPS for webhook endpoints in production
- Implement rate limiting for production use
- Consider database storage for user data persistence

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

## 📄 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## 🆘 Support

- **Documentation**: [Otomato.xyz](https://otomato.xyz)
- **Issues**: Create an issue in this repository
- **Community**: Join the Otomato community

---

**Built with ❤️ by [Otomato](https://otomato.xyz)** - The platform for building powerful automation workflows.
