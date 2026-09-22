// src/commands/tempMail.js

import {
    SlashCommandBuilder,
    EmbedBuilder
} from "discord.js";
import crypto from "node:crypto";

const OWNER_ID = "1541092291463090296";
const COOLDOWN_MS = 3 * 60 * 60 * 1000;

// Example temporary-mail domain.
// Replace this with a domain you control.
const TEMP_DOMAIN = "mail.example.com";

const cooldowns = new Map();
const mailboxes = new Map();

export const data = new SlashCommandBuilder()
    .setName("tempmail")
    .setDescription("Create a temporary email address");

function randomLocalPart() {
    return crypto
        .randomBytes(9)
        .toString("base64url")
        .toLowerCase();
}

function formatRemaining(ms) {
    const totalMinutes = Math.ceil(ms / 60000);
    const hours = Math.floor(totalMinutes / 60);
    const minutes = totalMinutes % 60;

    return `${hours}h ${minutes}m`;
}

export async function execute(interaction) {
    const userId = interaction.user.id;
    const isOwner = userId === OWNER_ID;

    if (!isOwner) {
        const previous = cooldowns.get(userId);

        if (previous) {
            const elapsed = Date.now() - previous;
            const remaining = COOLDOWN_MS - elapsed;

            if (remaining > 0) {
                return interaction.reply({
                    content:
                        `⏳ You can create another temporary mailbox in **${formatRemaining(remaining)}**.`,
                    ephemeral: true
                });
            }
        }

        cooldowns.set(userId, Date.now());
    }

    const address =
        `${randomLocalPart()}@${TEMP_DOMAIN}`;

    const mailbox = {
        id: crypto.randomUUID(),
        ownerId: userId,
        address,
        createdAt: Date.now(),
        expiresAt: Date.now() + 60 * 60 * 1000,
        messages: []
    };

    mailboxes.set(mailbox.id, mailbox);

    const embed = new EmbedBuilder()
        .setTitle("📧 Temporary Mailbox")
        .setDescription(
            `Your temporary mailbox has been created.\n\n` +
            `**Address:** \`${address}\`\n\n` +
            `This mailbox expires in **1 hour**.`
        )
        .addFields(
            {
                name: "Mailbox ID",
                value: `\`${mailbox.id}\``
            },
            {
                name: "Owner",
                value: `<@${userId}>`
            }
        )
        .setColor(0x5865f2)
        .setTimestamp();

    await interaction.user.send({
        embeds: [embed]
    });

    await interaction.reply({
        content: "✅ Your temporary mailbox was sent to your DMs.",
        ephemeral: true
    });
}

// Automatically remove expired mailboxes.
setInterval(() => {
    const now = Date.now();

    for (const [id, mailbox] of mailboxes) {
        if (mailbox.expiresAt <= now) {
            mailboxes.delete(id);
        }
    }
}, 60_000);

export default {
    data,
    execute
};
