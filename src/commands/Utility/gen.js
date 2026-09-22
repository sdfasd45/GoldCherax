// src/commands/gen.js

import {
    SlashCommandBuilder,
    EmbedBuilder
} from "discord.js";
import crypto from "node:crypto";

const OWNER_ID = "1541092291463090296";
const COOLDOWN_MS = 3 * 60 * 60 * 1000;

const cooldowns = new Map();

// Use a domain/mail service you control.
const TEMP_MAIL_DOMAIN = "mail.example.com";

export const data = new SlashCommandBuilder()
    .setName("gen")
    .setDescription("Generate a temporary mailbox");

function generatePassword(length = 24) {
    const alphabet =
        "ABCDEFGHJKLMNPQRSTUVWXYZ" +
        "abcdefghijkmnopqrstuvwxyz" +
        "23456789!@#$%^&*";

    const bytes = crypto.randomBytes(length);

    return Array.from(bytes, byte => alphabet[byte % alphabet.length])
        .join("");
}

function generateUsername() {
    return crypto
        .randomBytes(10)
        .toString("hex")
        .toLowerCase();
}

function remainingTime(ms) {
    const totalSeconds = Math.ceil(ms / 1000);

    const hours = Math.floor(totalSeconds / 3600);
    const minutes = Math.floor((totalSeconds % 3600) / 60);
    const seconds = totalSeconds % 60;

    return `${hours}h ${minutes}m ${seconds}s`;
}

export async function execute(interaction) {
    const userId = interaction.user.id;
    const isOwner = userId === OWNER_ID;

    // Owner bypasses the cooldown.
    if (!isOwner) {
        const lastGenerated = cooldowns.get(userId);

        if (lastGenerated) {
            const elapsed = Date.now() - lastGenerated;
            const remaining = COOLDOWN_MS - elapsed;

            if (remaining > 0) {
                return interaction.reply({
                    content:
                        `⏳ You must wait **${remainingTime(remaining)}** before using \`/gen\` again.`,
                    ephemeral: true
                });
            }
        }

        cooldowns.set(userId, Date.now());
    }

    const username = generateUsername();
    const password = generatePassword();

    const email = `${username}@${TEMP_MAIL_DOMAIN}`;

    const embed = new EmbedBuilder()
        .setTitle("📧 Temporary Mailbox")
        .setDescription(
            "Your temporary mailbox has been generated."
        )
        .addFields(
            {
                name: "📨 Email",
                value: `\`${email}\``,
                inline: false
            },
            {
                name: "🔑 Password",
                value: `\`${password}\``,
                inline: false
            },
            {
                name: "⏱️ Access",
                value: isOwner
                    ? "Owner — unlimited `/gen`"
                    : "Next generation available in 3 hours",
                inline: false
            }
        )
        .setColor(0x5865f2)
        .setFooter({
            text: "Keep your credentials private."
        })
        .setTimestamp();

    try {
        await interaction.user.send({
            embeds: [embed]
        });

        await interaction.reply({
            content: "✅ Your email and password were sent to your DMs.",
            ephemeral: true
        });
    } catch {
        // Don't consume the cooldown if the DM failed.
        if (!isOwner) {
            cooldowns.delete(userId);
        }

        await interaction.reply({
            content:
                "❌ I couldn't DM you. Enable DMs from this server and try again.",
            ephemeral: true
        });
    }
}

export default {
    data,
    execute
};
