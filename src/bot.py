import discord
import random
import string
import time
import asyncio
from datetime import datetime, timedelta
from discord.ext import commands, tasks
from config import BOT_TOKEN, ROLE_ID_NO_COOLDOWN, COOLDOWN_SECONDS, GENERATION_INTERVAL

# ============================================
# 🎮 EPIC GAMES ACCOUNT GENERATOR BOT
# ============================================

intents = discord.Intents.default()
intents.messages = True
intents.message_content = True

client = commands.Bot(command_prefix='/', intents=intents)

# ── Storage ──
cooldown_tracker = {}       # user_id -> last_gen_time (timestamp)
generated_accounts = []     # list of generated account dicts

# ── Password helpers ──
def random_password(length=16):
    chars = string.ascii_letters + string.digits + "!@#$%&*"
    return ''.join(random.choice(chars) for _ in range(length))

def random_email():
    username = ''.join(random.choice(string.ascii_lowercase + string.digits) for _ in range(12))
    domains = ["gmail.com", "outlook.com", "yahoo.com", "tempmail.com", "mail.com"]
    return f"{username}@{random.choice(domains)}"

def random_username():
    adjectives = ["Epic", "Dark", "Shadow", "Storm", "Mystic", "Neon", "Cyber", "Hyper", "Ultra", "Mega"]
    nouns = ["Hunter", "Wolf", "Dragon", "Phoenix", "Knight", "Storm", "Blaze", "Frost", "Thunder", "Viper"]
    num = random.randint(1, 999)
    return f"{random.choice(adjectives)}{random.choice(nouns)}{num}"

def generate_epic_account():
    """Generate a fake Epic Games account."""
    username = random_username()
    email = random_email()
    password = random_password()
    return {
        'username': username,
        'email': email,
        'password': password,
        'timestamp': datetime.now()
    }

# ── Slash command /gen ──
@client.tree.command(name="gen", description="Generate an Epic Games account!")
async def gen_command(interaction: discord.Interaction):
    user_id = interaction.user.id
    role_id = int(ROLE_ID_NO_COOLDOWN)
    has_role = role_id in [r.id for r in interaction.user.roles]

    if not has_role:
        now = time.time()
        last_gen = cooldown_tracker.get(user_id, 0)
        elapsed = now - last_gen

        if elapsed < COOLDOWN_SECONDS:
            remaining = COOLDOWN_SECONDS - elapsed
            hours = int(remaining // 3600)
            mins = int((remaining % 3600) // 60)
            secs = int(remaining % 60)
            await interaction.response.send_message(
                f"⏳ **Cooldown active!**\n"
                f"Please wait `{hours}h {mins}m {secs}s` before using `/gen` again.",
                ephemeral=True
            )
            return

    # Generate the account
    account = generate_epic_account()
    cooldown_tracker[user_id] = time.time()

    # Send DM with details
    dm_content = (
        f"🎮 **Epic Games Account Details**\n\n"
        f"👤 **Username:** `{account['username']}`\n"
        f"📧 **Email:** `{account['email']}`\n"
        f"🔑 **Password:** `{account['password']}`\n\n"
        f"✅ Generated at {account['timestamp'].strftime('%H:%M:%S')}"
    )

    try:
        await interaction.user.send(dm_content)
        await interaction.response.send_message(
            f"📬 **Your Epic Games account has been sent to your DM!**\n"
            f"{'✅ No cooldown!' if has_role else '⏳ 5h cooldown started.'}",
            ephemeral=True
        )
    except discord.errors.Forbidden:
        await interaction.response.send_message(
            f"❌ Could not send DM. Make sure DMs are open!",
            ephemeral=True
        )

# ── Periodic background generation (every 10 seconds) ──
@tasks.loop(seconds=GENERATION_INTERVAL)
async def auto_generate():
    account = generate_epic_account()
    generated_accounts.append(account)
    print(f"[{account['timestamp']}] Generated: {account['username']} | {account['email']} | {account['password']}")

@auto_generate.before_loop
async def before_auto_generate():
    await client.wait_until_ready()

# ── Commands ──
@client.command(name="status", description="Check bot status")
async def status(ctx):
    total = len(generated_accounts)
    msg = f"📊 **Bot Status**\n\n"
    msg += f"✅ Generated accounts: `{total}`\n"
    msg += f"⏱ Generation interval: `{GENERATION_INTERVAL}s`\n"
    msg += f"👥 Online: `{client.user}`"
    await ctx.send(msg)

@client.command(name="view", description="View last generated accounts")
async def view_accounts(ctx):
    if not generated_accounts:
        return await ctx.send("No accounts generated yet.")
    
    msg = "📋 **Last Generated Accounts:**\n\n"
    for acc in reversed(generated_accounts[-5:]):
        msg += f"👤 {acc['username']} | {acc['email']} | 🔑 {acc['password']}\n"
    await ctx.send(msg)

# ── Startup ──
@client.event
async def on_ready():
    await client.tree.sync()
    auto_generate.start()
    print(f"✅ Bot online as {client.user}")
    print(f"🎯 Role ID (no cooldown): {ROLE_ID_NO_COOLDOWN}")

# ── Run ──
if __name__ == "__main__":
    client.run(BOT_TOKEN)
