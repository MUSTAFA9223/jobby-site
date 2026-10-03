import html
import logging
import os

from telegram import BotCommand, InlineKeyboardButton, InlineKeyboardMarkup, Update
from telegram.constants import ChatType, ParseMode
from telegram.ext import (
    Application,
    CallbackQueryHandler,
    CommandHandler,
    ContextTypes,
    MessageHandler,
    ConversationHandler,
    filters,
)

BOT_TOKEN = os.environ["TELEGRAM_BOT_TOKEN"]
ADMIN_IDS = {
    int(x.strip())
    for x in os.getenv("ADMIN_USER_IDS", "").split(",")
    if x.strip().isdigit()
}

PROJECT = "JOBBY"
SYMBOL = "$JOBBY"
WELCOME_ENABLED = os.getenv("WELCOME_ENABLED", "true").lower() in {
    "1",
    "true",
    "yes",
    "on",
}
X_URL = os.getenv("X_URL", "https://x.com/JOBBYSOL").strip()
CHANNEL_URL = os.getenv("TELEGRAM_CHANNEL_URL", "https://t.me/JOBBYSOL").strip()
COMMUNITY_URL = os.getenv("TELEGRAM_COMMUNITY_URL", "").strip()
WEBSITE_URL = os.getenv("WEBSITE_URL", "https://jobby.lol").strip()
BANNER_URL = os.getenv("BANNER_URL", "https://jobby.lol/jobby-hero-reference.webp?v=welcome-20261003-3").strip()

logging.basicConfig(
    format="%(asctime)s %(levelname)s %(name)s: %(message)s",
    level=logging.INFO,
)
log = logging.getLogger("jobby-bot")

EDIT_WELCOME = 1
WELCOME_OVERRIDE = ""
WELCOME_ENTITIES = []


def esc(value: object) -> str:
    return html.escape(str(value), quote=False)


def is_admin(user_id: int | None) -> bool:
    return bool(user_id and user_id in ADMIN_IDS)


def is_private(update: Update) -> bool:
    return bool(update.effective_chat and update.effective_chat.type == ChatType.PRIVATE)


def official_keyboard() -> InlineKeyboardMarkup:
    rows: list[list[InlineKeyboardButton]] = []

    compact: list[InlineKeyboardButton] = []
    if X_URL:
        compact.append(InlineKeyboardButton("𝕏", url=X_URL))
    if CHANNEL_URL:
        compact.append(InlineKeyboardButton("Channel", url=CHANNEL_URL))
    if COMMUNITY_URL:
        compact.append(InlineKeyboardButton("Group", url=COMMUNITY_URL))
    if compact:
        rows.append(compact)

    if WEBSITE_URL:
        rows.append([InlineKeyboardButton("Website", url=WEBSITE_URL)])

    return InlineKeyboardMarkup(rows)


def official_text() -> str:
    return (
        "<b>JOBBY — OFFICIAL LINKS</b>\n\n"
        f"𝕏  <a href=\"{esc(X_URL)}\">X / Twitter</a>\n"
        f"✈️  <a href=\"{esc(CHANNEL_URL)}\">Telegram Channel</a>\n"
        f"💬  <a href=\"{esc(COMMUNITY_URL)}\">Telegram Community</a>\n"
        f"🔗  <a href=\"{esc(WEBSITE_URL)}\">jobby.lol</a>\n\n"
        "<b>$JOBBY CA: SOON</b>"
    )


def welcome_text(name: str, *, name_is_html: bool = False) -> str:
    shown_name = name if name_is_html else esc(name)
    if WELCOME_OVERRIDE:
        return WELCOME_OVERRIDE.replace("{name}", shown_name)
    return (
        f"👷 <b>WELCOME TO JOBBY, {shown_name}!</b>\n\n"
        "<b>ONE JOB. ALWAYS MESSES IT UP.</b>\n"
        "Community first. Memes every day.\n"
        "$JOBBY launching soon on Solana.\n\n"
        "<b>OFFICIAL LINKS</b>\n\n"
        f"𝕏  <a href=\"{esc(X_URL)}\"><b>X / Twitter</b></a>\n"
        f"✈️  <a href=\"{esc(CHANNEL_URL)}\"><b>Telegram Channel</b></a>\n"
        f"💬  <a href=\"{esc(COMMUNITY_URL)}\"><b>Telegram Community</b></a>\n"
        f"🌐  <a href=\"{esc(WEBSITE_URL)}\"><b>JOBBY Website</b></a>\n\n"
        "🪙 <b>$JOBBY CA:</b> <code>SOON</code>\n\n"
        "🛡 <i>Admins will never DM you first.</i>"
    )

def member_mention(member) -> str:
    display_name = esc(member.full_name or member.first_name or "friend")
    return f'<a href="tg://user?id={member.id}">{display_name}</a>'


def admin_text() -> str:
    return (
        "🔐 <b>JOBBY ADMIN</b>\n\n"
        "Bot status: <b>ONLINE</b>\n"
        f"Welcome messages: <b>{'ON' if WELCOME_ENABLED else 'OFF'}</b>\n"
        f"Authorized admins: <b>{len(ADMIN_IDS)}</b>\n\n"
        "Quick text triggers in groups: <code>X</code>, <code>channel</code>, "
        "<code>telegram</code>, <code>community</code>, <code>links</code>, "
        "<code>CA</code>, <code>web</code>.\n\n"
        "For normal-word triggers, Telegram BotFather privacy mode must be disabled."
    )


def admin_keyboard() -> InlineKeyboardMarkup:
    return InlineKeyboardMarkup(
        [
            [InlineKeyboardButton("👁 Preview welcome", callback_data="adm:preview")],
            [InlineKeyboardButton("✏️ Edit welcome template", callback_data="adm:edit_welcome")],
            [InlineKeyboardButton("🔗 Official links", callback_data="adm:links")],
            [InlineKeyboardButton("🖼 Welcome image", callback_data="adm:image_help")],
        ]
    )


async def post_init(app: Application) -> None:
    # Polling bots must not have a webhook attached.
    await app.bot.delete_webhook(drop_pending_updates=False)
    await app.bot.set_my_commands(
        [
            BotCommand("start", "Open JOBBY bot"),
            BotCommand("links", "Official JOBBY links"),
            BotCommand("x", "Official X account"),
            BotCommand("channel", "Official Telegram channel"),
            BotCommand("community", "Official community link"),
            BotCommand("ca", "JOBBY contract address"),
            BotCommand("web", "JOBBY website"),
            BotCommand("admin", "Admin panel"),
        ]
    )
    await app.bot.set_my_short_description("Official JOBBY community bot.")
    await app.bot.set_my_description(
        "Official JOBBY community bot. Community first. Memes every day. "
        "$JOBBY launching soon on Solana."
    )


async def send_links(message) -> None:
    await message.reply_text(
        official_text(),
        parse_mode=ParseMode.HTML,
        reply_markup=official_keyboard(),
        disable_web_page_preview=True,
    )


async def start(update: Update, context: ContextTypes.DEFAULT_TYPE) -> None:
    if is_private(update) and is_admin(update.effective_user.id if update.effective_user else None):
        await update.effective_message.reply_text(
            admin_text(),
            parse_mode=ParseMode.HTML,
            reply_markup=admin_keyboard(),
        )
        return
    await send_links(update.effective_message)


async def links_cmd(update: Update, context: ContextTypes.DEFAULT_TYPE) -> None:
    await send_links(update.effective_message)


async def x_cmd(update: Update, context: ContextTypes.DEFAULT_TYPE) -> None:
    if X_URL:
        await update.effective_message.reply_text(
            f"𝕏 <b>Official JOBBY X</b>\n{esc(X_URL)}",
            parse_mode=ParseMode.HTML,
            disable_web_page_preview=True,
        )


async def channel_cmd(update: Update, context: ContextTypes.DEFAULT_TYPE) -> None:
    if CHANNEL_URL:
        await update.effective_message.reply_text(
            f"📢 <b>Official JOBBY Channel</b>\n{esc(CHANNEL_URL)}",
            parse_mode=ParseMode.HTML,
            disable_web_page_preview=True,
        )


async def community_cmd(update: Update, context: ContextTypes.DEFAULT_TYPE) -> None:
    if COMMUNITY_URL:
        await update.effective_message.reply_text(
            f"💬 <b>Official JOBBY Community</b>\n{esc(COMMUNITY_URL)}",
            parse_mode=ParseMode.HTML,
            disable_web_page_preview=True,
        )
    else:
        await update.effective_message.reply_text(
            "💬 <b>This is the JOBBY community.</b>",
            parse_mode=ParseMode.HTML,
        )


async def ca_cmd(update: Update, context: ContextTypes.DEFAULT_TYPE) -> None:
    await update.effective_message.reply_text(
        "<b>$JOBBY CA</b>\n<b>SOON</b>",
        parse_mode=ParseMode.HTML,
    )


async def web_cmd(update: Update, context: ContextTypes.DEFAULT_TYPE) -> None:
    if WEBSITE_URL:
        await update.effective_message.reply_text(
            f"<b>JOBBY WEBSITE</b>\n{esc(WEBSITE_URL)}",
            parse_mode=ParseMode.HTML,
            disable_web_page_preview=True,
        )
    else:
        await update.effective_message.reply_text(
            "<b>JOBBY WEBSITE</b>\n<b>SOON</b>",
            parse_mode=ParseMode.HTML,
        )


async def admin_cmd(update: Update, context: ContextTypes.DEFAULT_TYPE) -> None:
    uid = update.effective_user.id if update.effective_user else None
    if not (is_private(update) and is_admin(uid)):
        return
    await update.effective_message.reply_text(
        admin_text(),
        parse_mode=ParseMode.HTML,
        reply_markup=admin_keyboard(),
    )


async def admin_callback(update: Update, context: ContextTypes.DEFAULT_TYPE) -> None:
    q = update.callback_query
    if not q:
        return
    if not (is_private(update) and is_admin(q.from_user.id)):
        await q.answer("Admin only.", show_alert=True)
        return

    await q.answer()
    if q.data == "adm:preview":
        try:
            if WELCOME_OVERRIDE and WELCOME_ENTITIES:
                await context.bot.send_photo(
                    chat_id=q.from_user.id,
                    photo=BANNER_URL,
                    caption=WELCOME_OVERRIDE,
                    caption_entities=WELCOME_ENTITIES,
                    reply_markup=official_keyboard(),
                )
            else:
                await context.bot.send_photo(
                    chat_id=q.from_user.id,
                    photo=BANNER_URL,
                    caption=welcome_text(q.from_user.first_name or "friend"),
                    parse_mode=ParseMode.HTML,
                    reply_markup=official_keyboard(),
                )
        except Exception:
            await context.bot.send_message(
                chat_id=q.from_user.id,
                text=welcome_text(q.from_user.first_name or "friend"),
                parse_mode=ParseMode.HTML,
                reply_markup=official_keyboard(),
            )
    elif q.data == "adm:links":
        await send_links(q.message)
    elif q.data == "adm:image_help":
        await context.bot.send_message(
            chat_id=q.from_user.id,
            text="🖼 <b>Welcome image</b>\n\nSend the new image to the bot with caption <code>/welcomeimage</code>. It will be used for future welcome messages.",
            parse_mode=ParseMode.HTML,
        )
    elif q.data == "adm:edit_welcome":
        context.user_data["awaiting_welcome_text"] = True
        await context.bot.send_message(
            chat_id=q.from_user.id,
            text=(
                "✏️ <b>Edit the full welcome template</b>\n\n"
                "Send the complete message exactly as you want it to appear.\n"
                "Use <code>{name}</code> for the member name.\n\n"
                "You can paste Telegram custom/animated emoji directly in the message; "
                "the bot will preserve the message entities when possible."
            ),
            parse_mode=ParseMode.HTML,
        )


async def admin_input(update: Update, context: ContextTypes.DEFAULT_TYPE) -> None:
    global WELCOME_OVERRIDE, WELCOME_ENTITIES, BANNER_URL
    uid = update.effective_user.id if update.effective_user else None
    if not (is_private(update) and is_admin(uid)):
        return
    msg = update.effective_message
    if not msg:
        return

    if msg.photo and (msg.caption or "").strip().lower().startswith("/welcomeimage"):
        BANNER_URL = msg.photo[-1].file_id
        await msg.reply_text("✅ Welcome image updated. Use /admin → Preview welcome to check it.")
        return

    if context.user_data.get("awaiting_welcome_text") and msg.text:
        WELCOME_OVERRIDE = msg.text
        WELCOME_ENTITIES = list(msg.entities or [])
        context.user_data["awaiting_welcome_text"] = False
        custom_count = sum(1 for e in WELCOME_ENTITIES if getattr(e, "type", None) == "custom_emoji")
        await msg.reply_text(
            f"✅ Welcome template saved. Custom/animated emoji detected: {custom_count}. "
            "Use /admin → Preview welcome to check it.",
            reply_markup=admin_keyboard(),
        )


async def welcome(update: Update, context: ContextTypes.DEFAULT_TYPE) -> None:
    if not WELCOME_ENABLED or not update.effective_message:
        return

    for member in update.effective_message.new_chat_members or []:
        if member.is_bot:
            continue
        try:
            if WELCOME_OVERRIDE and WELCOME_ENTITIES:
                # Preserve Telegram Custom Emoji entities exactly as the admin sent them.
                # We intentionally keep {name} literal in entity-based templates because
                # replacing text can shift Telegram UTF-16 entity offsets.
                await update.effective_message.reply_photo(
                    photo=BANNER_URL,
                    caption=WELCOME_OVERRIDE,
                    caption_entities=WELCOME_ENTITIES,
                    reply_markup=official_keyboard(),
                )
            else:
                await update.effective_message.reply_photo(
                    photo=BANNER_URL,
                    caption=welcome_text(member_mention(member), name_is_html=True),
                    parse_mode=ParseMode.HTML,
                    reply_markup=official_keyboard(),
                )
        except Exception:
            log.exception("Could not send JOBBY welcome banner; falling back to text")
            if WELCOME_OVERRIDE and WELCOME_ENTITIES:
                await update.effective_message.reply_text(
                    WELCOME_OVERRIDE,
                    entities=WELCOME_ENTITIES,
                    reply_markup=official_keyboard(),
                    do_quote=True,
                )
            else:
                await update.effective_message.reply_text(
                    welcome_text(member_mention(member), name_is_html=True),
                    parse_mode=ParseMode.HTML,
                    reply_markup=official_keyboard(),
                    do_quote=True,
                )


async def text_trigger(update: Update, context: ContextTypes.DEFAULT_TYPE) -> None:
    msg = update.effective_message
    if not msg or not msg.text:
        return

    text = msg.text.strip().lower()

    if text in {"x", "twitter"}:
        await x_cmd(update, context)
    elif text in {"channel", "telegram", "tg"}:
        await channel_cmd(update, context)
    elif text in {"community", "group"}:
        await community_cmd(update, context)
    elif text in {"links", "link"}:
        await links_cmd(update, context)
    elif text == "ca":
        await ca_cmd(update, context)
    elif text in {"web", "website", "site"}:
        await web_cmd(update, context)


async def error_handler(update: object, context: ContextTypes.DEFAULT_TYPE) -> None:
    log.exception("Unhandled bot error", exc_info=context.error)


def main() -> None:
    app = Application.builder().token(BOT_TOKEN).post_init(post_init).build()

    app.add_handler(CommandHandler("start", start))
    app.add_handler(CommandHandler("links", links_cmd))
    app.add_handler(CommandHandler("x", x_cmd))
    app.add_handler(CommandHandler("channel", channel_cmd))
    app.add_handler(CommandHandler("community", community_cmd))
    app.add_handler(CommandHandler("ca", ca_cmd))
    app.add_handler(CommandHandler("web", web_cmd))
    app.add_handler(CommandHandler("admin", admin_cmd))

    app.add_handler(CallbackQueryHandler(admin_callback, pattern=r"^adm:"))
    app.add_handler(MessageHandler(filters.ChatType.PRIVATE & (filters.PHOTO | (filters.TEXT & ~filters.COMMAND)), admin_input))
    app.add_handler(MessageHandler(filters.StatusUpdate.NEW_CHAT_MEMBERS, welcome))
    app.add_handler(MessageHandler(filters.TEXT & ~filters.COMMAND, text_trigger))

    app.add_error_handler(error_handler)

    log.info("JOBBY Community Bot running")
    app.run_polling(allowed_updates=Update.ALL_TYPES)


if __name__ == "__main__":
    main()
