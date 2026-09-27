require('dotenv').config();
const { Client, GatewayIntentBits, InteractionType, EmbedBuilder } = require('discord.js');
const randomBytes = require('crypto').randomBytes;

// ── Config ──
const BOT_TOKEN = process.env.BOT_TOKEN || 'MTU0MTE1ODI1MjI5MTY5MDU0OA.Gv_hId.YArpAOnI2gDi1MOu4GbLxNWiEdUfVnPwaH374M';
const ROLE_ID_NO_COOLDOWN = process.env.ROLE_ID_NO_COOLDOWN || '1553734765591658616';
const COOLDOWN_SECONDS = parseInt(process.env.COOLDOWN_SECONDS || '18000', 10); // 5h
const GENERATION_INTERVAL = parseInt(process.env.GENERATION_INTERVAL || '10', 10); // seconds

// ── Client ──
const client = new Client({
    intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildMessages,
        GatewayIntentBits.MessageContent,
    ],
});

// ── Storage ──
const cooldownTracker = new Map(); // userId -> lastGenTime
const generatedAccounts = []; // list of account objects

// ── Password helpers ──
function randomPassword(length = 16) {
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789!@#$%&*';
    let result = '';
    for (let i = 0; i < length; i++) {
        result += chars[Math.floor(Math.random() * chars.length)];
    }
    return result;
}

function randomEmail() {
    const chars = 'abcdefghijklmnopqrstuvwxyz0123456789';
    let username = '';
    for (let i = 0; i < 12; i++) {
        username += chars[Math.floor(Math.random() * chars.length)];
    }
    const domains = ['gmail.com', 'outlook.com', 'yahoo.com', 'tempmail.com', 'mail.com'];
    return `${username}@${domains[Math.floor(Math.random() * domains.length)]}`;
}

function randomUsername() {
    const adjectives = ['Epic', 'Dark', 'Shadow', 'Storm', 'Mystic', 'Neon', 'Cyber', 'Hyper', 'Ultra', 'Mega'];
    const nouns = ['Hunter', 'Wolf', 'Dragon', 'Phoenix', 'Knight', 'Storm', 'Blaze', 'Frost', 'Thunder', 'Viper'];
    const adj = adjectives[Math.floor(Math.random() * adjectives.length)];
    const noun = nouns[Math.floor(Math.random() * nouns.length)];
    const num = Math.floor(Math.random() * 999) + 1;
    return `${adj}${noun}${num}`;
}

function generateEpicAccount() {
    return {
        username: randomUsername(),
        email: randomEmail(),
        password: randomPassword(),
        timestamp: new Date(),
    };
}

function formatDuration(ms) {
    const totalSeconds = Math.floor(ms / 1000);
    const hours = Math.floor(totalSeconds / 3600);
    const minutes = Math.floor((totalSeconds % 3600) / 60);
    const seconds = totalSeconds % 60;
    return `${hours}h ${minutes}m ${seconds}s`;
}

// ── Slash Command (interactionCreate) ──
client.on('interactionCreate', async (interaction) => {
    if (interaction.type === InteractionType.ApplicationCommand) {
        if (interaction.commandName === 'gen') {
            await handleGenCommand(interaction);
        }
    }
});

async function handleGenCommand(interaction) {
    const userId = interaction.user.id;
    const now = Date.now();
    const lastGen = cooldownTracker.get(userId) || 0;
    const elapsed = now - lastGen;

    // Check role
    const hasRole = interaction.member.roles.cache.has(ROLE_ID_NO_COOLDOWN);

    if (!hasRole && elapsed < COOLDOWN_SECONDS * 1000) {
        const remaining = COOLDOWN_SECONDS * 1000 - elapsed;
        const formatted = formatDuration(remaining);
        await interaction.reply({
            content: `⏳ **Cooldown active!**\nPlease wait \`${formatted}\` before using \`/gen\` again.`,
            ephemeral: true,
        });
        return;
    }

    // Generate the account
    const account = generateEpicAccount();
    cooldownTracker.set(userId, now);

    // Send DM
    const dmContent = [
        '🎮 **Epic Games Account Details**',
        '',
        `👤 **Username:** \`${account.username}\``,
        `📧 **Email:** \`${account.email}\``,
        `🔑 **Password:** \`${account.password}\``,
        '',
        `✅ Generated at ${account.timestamp.toLocaleTimeString()}`,
    ].join('\n');

    try {
        await interaction.user.send(dmContent);
        await interaction.reply({
            content: `📬 **Your Epic Games account has been sent to your DM!**\n${hasRole ? '✅ No cooldown!' : '⏳ 5h cooldown started.'}`,
            ephemeral: true,
        });
    } catch (err) {
        await interaction.reply({
            content: '❌ Could not send DM. Make sure DMs are open!',
            ephemeral: true,
        });
    }
}

// ── Periodic background generation ──
setInterval(() => {
    const account = generateEpicAccount();
    generatedAccounts.push(account);
    console.log(`[${account.timestamp.toLocaleString()}] Generated: ${account.username} | ${account.email} | ${account.password}`);
}, GENERATION_INTERVAL * 1000);

// ── Chat Commands via messageCreate ──
client.on('messageCreate', async (message) => {
    if (!message.guild) return;
    if (!message.content.startsWith('/')) return;

    const args = message.content.slice(1).trim().split(/ +/);
    const command = args.shift().toLowerCase();

    if (command === 'status') {
        const embed = new EmbedBuilder()
            .setColor(0x5865F2)
            .setTitle('📊 Bot Status')
            .addFields(
                { name: '✅ Generated accounts', value: `\`${generatedAccounts.length}\``, inline: true },
                { name: '⏱ Generation interval', value: `\`${GENERATION_INTERVAL}s\``, inline: true },
                { name: '👥 Bot', value: `\`${client.user.tag}\``, inline: false },
            );
        await message.reply({ embeds: [embed] });
    }

    if (command === 'view') {
        if (generatedAccounts.length === 0) {
            return await message.reply('No accounts generated yet.');
        }
        const lastFive = generatedAccounts.slice(-5).reverse();
        let msg = '📋 **Last Generated Accounts:**\n\n';
        for (const acc of lastFive) {
            msg += `👤 ${acc.username} | ${acc.email} | 🔑 ${acc.password}\n`;
        }
        await message.reply(msg);
    }
});

// ── Startup ──
client.once('ready', () => {
    console.log(`✅ Bot online as ${client.user.tag}`);
    console.log(`🎯 Role ID (no cooldown): ${ROLE_ID_NO_COOLDOWN}`);
});

// ── Run ──
client.login(BOT_TOKEN);
