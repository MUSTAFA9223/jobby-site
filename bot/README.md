# JOBBY Community Bot

Official Telegram community bot for JOBBY.

## Features
- Automatic welcome message for new members.
- Official-link buttons for X, Telegram channel, community and website.
- Commands: `/start`, `/links`, `/x`, `/channel`, `/community`, `/admin`.
- Group keyword triggers: `X`, `twitter`, `channel`, `telegram`, `community`, `links`.
- Private admin panel restricted by `ADMIN_USER_IDS`.
- Bot commands and description are configured automatically at startup.

## Railway environment variables
- `TELEGRAM_BOT_TOKEN`
- `ADMIN_USER_IDS`
- `X_URL`
- `TELEGRAM_CHANNEL_URL`
- `TELEGRAM_COMMUNITY_URL` (optional)
- `WEBSITE_URL` (optional)
- `WELCOME_ENABLED=true`

## Telegram setup
To make normal text triggers such as `X` work inside a group:
1. Open @BotFather.
2. Use `/setprivacy`.
3. Select the JOBBY bot.
4. Choose **Disable**.

Never commit Telegram bot tokens to GitHub.
