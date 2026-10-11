"""Optional private-first JOBBY CHAOS game for the existing welcome bot.

All welcome messages, member events, admin controls and existing links stay
in bot.py. This module runs only when a member explicitly invokes the game.
"""

from __future__ import annotations

import html
import logging
import secrets
from urllib.parse import quote

from telegram import InlineKeyboardButton, InlineKeyboardMarkup, Update
from telegram.constants import ChatType, ParseMode
from telegram.ext import ContextTypes

log = logging.getLogger("jobby-chaos")

IMAGE_URL = "https://jobby.lol/jobby-official-20261005.png"
GAME_URL = "https://jobby.lol"
COMMUNITY_URL = "https://t.me/JOBBYChat"
STATE_KEY = "jobby_chaos_game"

EPISODES = (
    (
        "JOBBY finds a big red button marked DO NOT PRESS.",
        "The button looks suspiciously pleased with itself.",
        (
            ("Press it immediately", "The sky starts applauding. Even the clouds are confused.", 35),
            ("Put a tiny crown on it", "The button declares itself the king of all buttons.", 25),
            ("Stare until it gets nervous", "The button presses itself. JOBBY wins the staring contest.", 30),
        ),
    ),
    (
        "A hundred pigeons begin following JOBBY.",
        "They are moving in perfect formation.",
        (
            ("Challenge them to a dance-off", "The street becomes a dance floor. Nobody can copy JOBBY.", 40),
            ("Crown the smallest pigeon", "The smallest pigeon is now mayor. Nobody voted.", 30),
            ("Pretend nothing is happening", "The pigeons copy every step. The internet notices.", 25),
        ),
    ),
    (
        "A glowing purple portal appears beside JOBBY.",
        "It makes a sound like someone trying not to laugh.",
        (
            ("Jump through it", "Every person on the other side is dressed like JOBBY.", 40),
            ("Throw a rubber duck into it", "The duck returns as a famous television presenter.", 35),
            ("Ask it for directions", "The portal gets lost and leads to a bakery.", 20),
        ),
    ),
    (
        "The moon sends JOBBY a message: 'We need to talk.'",
        "The moon has been typing for three minutes.",
        (
            ("Reply with a completely random meme", "The moon laughs so hard the stars shake.", 40),
            ("Leave the moon on read", "Another moon appears to ask why JOBBY is ignoring it.", 30),
            ("Ask about the pigeons", "The moon admits it knows more than it should.", 35),
        ),
    ),
    (
        "The whole internet turns to look at JOBBY.",
        "It is very quiet. JOBBY has one last move.",
        (
            ("Start a ridiculous parade", "The internet joins in. No one knows what they're celebrating.", 40),
            ("Vanish in a cloud of purple glitter", "Only one purple footprint remains. Legendary.", 35),
            ("Act like this was the plan", "Everyone nods politely, even though nobody believes it.", 30),
        ),
    ),
)

def _safe(value: str) -> str:
    return html.escape(value, quote=False)

def _buttons_for_choices(uid: int, nonce: str, round_id: int) -> InlineKeyboardMarkup:
    return InlineKeyboardMarkup([
        [InlineKeyboardButton(label, callback_data=f"chaos:a:{uid}:{nonce}:{round_id}:{idx}")]
        for idx, (label, _, _) in enumerate(EPISODES[round_id][2])
    ])

def _round_caption(state: dict) -> str:
    idx = state["round"]
    title, subtitle, _ = EPISODES[idx]
    return (
        "<b>JOBBY CHAOS</b>\n"
        f"Round {idx + 1}/{len(EPISODES)} | Score: {state['score']}\n\n"
        f"<b>{_safe(title)}</b>\n"
        f"{_safe(subtitle)}\n\n"
        "<i>What should JOBBY do?</i>"
    )

def _result_caption(state: dict) -> str:
    idx, choice = state["round"], state["choice"]
    label, outcome, points = EPISODES[idx][2][choice]
    return (
        "<b>JOBBY CHAOS</b>\n"
        f"Round {idx + 1}/{len(EPISODES)} | Score: {state['score']}\n\n"
        f"<b>Your move:</b> {_safe(label)}\n\n"
        f"{_safe(outcome)}\n\n"
        f"<b>+{points} CHAOS POINTS</b>"
    )

def _rank(score: int) -> tuple[str, str]:
    if score >= 185:
        return "PURPLE CHAOS LEGEND", "JOBBY would probably ask you to stop. That's a compliment."
    if score >= 160:
        return "CERTIFIED CHAOS AGENT", "The universe is a little less predictable because of you."
    return "CHAOS APPRENTICE", "Excellent potential. JOBBY approves."

def _final_caption(state: dict) -> str:
    name, description = _rank(state["score"])
    return (
        "<b>JOBBY CHAOS — EPISODE COMPLETE</b>\n\n"
        f"<b>{_safe(name)}</b>\n"
        f"{_safe(description)}\n\n"
        f"<b>FINAL SCORE: {state['score']} CHAOS POINTS</b>\n\n"
        "No tokens or prizes are awarded. Just glorious chaos."
    )

def _final_keyboard(state: dict, uid: int) -> InlineKeyboardMarkup:
    name, _ = _rank(state["score"])
    message = (
        f"I scored {state['score']} CHAOS points in JOBBY CHAOS and earned "
        f"{name}. Can you beat me? Play in Telegram!"
    )
    link = state.get("start_url", GAME_URL)
    telegram_share = "https://t.me/share/url?url=" + quote(link, safe="") + "&text=" + quote(message, safe="")
    x_share = "https://x.com/intent/post?text=" + quote(message + " " + link + " #JOBBY", safe="")
    return InlineKeyboardMarkup([
        [InlineKeyboardButton("Play again", callback_data=f"chaos:r:{uid}:{state['nonce']}")],
        [InlineKeyboardButton("Share on Telegram", url=telegram_share),
         InlineKeyboardButton("Share on X", url=x_share)],
        [InlineKeyboardButton("JOBBY community", url=COMMUNITY_URL)],
    ])

async def _render(query, caption: str, keyboard: InlineKeyboardMarkup) -> None:
    if query.message and query.message.photo:
        await query.edit_message_caption(caption=caption, parse_mode=ParseMode.HTML, reply_markup=keyboard)
    else:
        await query.edit_message_text(text=caption, parse_mode=ParseMode.HTML,
                                      reply_markup=keyboard, disable_web_page_preview=True)

async def play_command(update: Update, context: ContextTypes.DEFAULT_TYPE) -> None:
    """In a group offer a direct private link; in private start the game."""
    chat, message, user = update.effective_chat, update.effective_message, update.effective_user
    if not chat or not message or not user:
        return
    username = context.bot.username
    if not username:
        username = (await context.bot.get_me()).username
    start_url = f"https://t.me/{username}?start=chaos" if username else None
    if chat.type != ChatType.PRIVATE:
        if start_url:
            await message.reply_text(
                "JOBBY CHAOS is ready. Play privately to keep the group chat clean.",
                reply_markup=InlineKeyboardMarkup([
                    [InlineKeyboardButton("Play JOBBY CHAOS", url=start_url)]
                ]),
            )
        else:
            await message.reply_text("Open a private chat with this bot and send /chaos to play.")
        return

    state = {
        "nonce": secrets.token_hex(4),
        "round": 0,
        "score": 0,
        "phase": "question",
        "start_url": start_url or GAME_URL,
    }
    context.user_data[STATE_KEY] = state
    caption = _round_caption(state)
    buttons = _buttons_for_choices(user.id, state["nonce"], 0)
    try:
        await message.reply_photo(
            photo=IMAGE_URL, caption=caption,
            parse_mode=ParseMode.HTML, reply_markup=buttons,
        )
    except Exception:
        log.warning("JOBBY game image unavailable; using text game", exc_info=True)
        await message.reply_text(
            caption, parse_mode=ParseMode.HTML,
            reply_markup=buttons, disable_web_page_preview=True,
        )

async def play_callback(update: Update, context: ContextTypes.DEFAULT_TYPE) -> None:
    query = update.callback_query
    if not query or not query.data:
        return
    parts = query.data.split(":")
    if len(parts) not in (4, 5, 6) or parts[0] != "chaos":
        await query.answer("This game action is unavailable.", show_alert=True)
        return
    action = parts[1]
    if action not in {"a", "n", "r"}:
        await query.answer("This game action is unavailable.", show_alert=True)
        return
    expected_count = 6 if action == "a" else 5 if action == "n" else 4
    if len(parts) != expected_count:
        await query.answer("This game action is unavailable.", show_alert=True)
        return
    try:
        owner = int(parts[2])
        rid = int(parts[4]) if action in {"a", "n"} else None
        choice = int(parts[5]) if action == "a" else None
    except (ValueError, IndexError):
        await query.answer("This game action is unavailable.", show_alert=True)
        return
    if query.from_user.id != owner:
        await query.answer("Start your own game with /chaos.", show_alert=True)
        return
    state = context.user_data.get(STATE_KEY)
    if not state or parts[3] != state["nonce"]:
        await query.answer("This game has expired. Send /chaos to restart.", show_alert=True)
        return

    if action == "a":
        if state["phase"] != "question" or rid != state["round"] or choice not in range(3):
            await query.answer("That round has already been played.", show_alert=True)
            return
        state["score"] += EPISODES[rid][2][choice][2]
        state["phase"] = "result"
        state["choice"] = choice
        keyboard = InlineKeyboardMarkup([
            [InlineKeyboardButton("See my results" if rid == len(EPISODES)-1 else "Next round",
                                  callback_data=f"chaos:n:{owner}:{state['nonce']}:{rid}")]
        ])
        caption = _result_caption(state)
    elif action == "n":
        if state["phase"] != "result" or rid != state["round"]:
            await query.answer("That round has already advanced.", show_alert=True)
            return
        state["round"] += 1
        if state["round"] == len(EPISODES):
            state["phase"] = "done"
            caption = _final_caption(state)
            keyboard = _final_keyboard(state, owner)
        else:
            state["phase"] = "question"
            caption = _round_caption(state)
            keyboard = _buttons_for_choices(owner, state["nonce"], state["round"])
    else:
        if state["phase"] != "done":
            await query.answer("Finish your game first.", show_alert=True)
            return
        state.update(nonce=secrets.token_hex(4), round=0, score=0, phase="question")
        caption = _round_caption(state)
        keyboard = _buttons_for_choices(owner, state["nonce"], 0)

    await query.answer()
    try:
        await _render(query, caption, keyboard)
    except Exception:
        log.exception("Failed to update JOBBY CHAOS game screen")
        if query.message:
            await query.message.reply_text(caption, parse_mode=ParseMode.HTML,
                                           reply_markup=keyboard, disable_web_page_preview=True)
