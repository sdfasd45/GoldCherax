// src/commands/gen.js
//
// /gen
// - Creates a real temporary inbox through your own mail service
// - Generates a strong random password
// - DMs the credentials to the requester
// - 3-hour cooldown for normal users
// - Owner can generate without a cooldown
//
// Required environment variables:
//
// TEMPMAIL_API_URL=https://your-tempmail-api.example
// TEMPMAIL_API_KEY=your_api_key
//
// Your mail API needs an endpoint such as:
// POST /mailboxes
// {
//   "username": "...",
//   "password": "...",
//   "expiresIn": 3600
// }
//
// Response:
// {
//   "address": "random@yourdomain.com",
//   "password": "...",
//   "expiresAt": "..."
// }

import {
    SlashCommandBuilder,
    EmbedBuilder
} from "discord.js";
import crypto from "node:crypto";

const OWNER_ID = "1541092291463090296";
const COOLDOWN_MS = 3 * 60 * 60 * 1000;

const cooldowns = new Map();

const API_URL = process.env.TEMPMAIL_API_URL;
const API_KEY = process.env.TEMPMAIL_API_KEY;

export const data = new SlashCommandBuilder()
    .setName("gen")
    .setDescription("Generate a temporary email inbox");

function generatePassword(length = 32) {
    const chars =
        "ABCDEFGHIJKLMNOPQRSTUVWXYZ" +
        "abcdefghijklmnopqrstuvwxyz" +
        "0123456789" +
        "!@#$%^&*_-+=";

    const bytes = crypto.randomBytes(length);

    return [...bytes]
        .map(byte => chars[byte % chars.length])
        .join("");
}

function generateUsername() {
    return `user_${crypto.randomBytes(10).toString("hex")}`;
}

function formatRemaining(ms) {
    const totalSeconds = Math.ceil(ms / 1000);

    const hours = Math.floor(totalSeconds / 3600);
    const minutes = Math.floor((totalSeconds % 3600) / 60);

    return `${hours}h ${minutes}m`;
}

async function createMailbox() {
    if (!API_URL || !API_KEY) {
        throw new Error(
            "TEMPMAIL_API_URL and TEMPMAIL_API_KEY are missing."
        );
    }

    const username = generateUsername();
    const password = generatePassword();

    const response = await fetch(
        `${API_URL.replace(/\/$/, "")}/mailboxes`,
        {
            method: "POST",
            headers: {
                "Authorization": `Bearer ${API_KEY}`,
                "Content-Type": "application/json"
            },
            body: JSON.stringify({
                username,
                password,
                expiresIn: 60 * 60
            }),
            signal: AbortSignal.timeout(15000)
        }
    );

    if (!response.ok) {
        const body = await response.text();

        throw new Error(
            `Mailbox API returned ${response.status}: ${body}`
        );
    }

    const result = await response.json();

    if (!result.address) {
        throw new Error("Mailbox API did not return an address.");
    }

    return {
        address: result.address,
        password: result.password ?? password,
        expiresAt: result.expiresAt ?? null
    };
}

export async function execute(interaction) {
    const userId = interaction.user.id;
    const isOwner = userId === OWNER_ID;

    if (!isOwner) {
        const lastUsed = cooldowns.get(userId);

        if (lastUsed) {
            const elapsed = Date.now() - lastUsed;
            const remaining = COOLDOWN_MS - elapsed;

            if (remaining > 0) {
                return interaction.reply({
                    content:
                        `⏳ You can use \`/gen\` again in **${formatRemaining(remaining)}**.`,
                    ephemeral: true
                });
            }
        }
    }

    await interaction.deferReply({
        ephemeral: true
    });

    try {
        const mailbox = await createMailbox();

        // Only start the cooldown after successful mailbox creation.
        if (!isOwner) {
            cooldowns.set(userId, Date.now());
        }

        const embed = new EmbedBuilder()
            .setTitle("📬 Temporary Email Created")
            .setDescription(
                "Your temporary inbox is ready."
            )
            .addFields(
                {
                    name: "📧 Email",
                    value: `\`${mailbox.address}\``
                },
                {
                    name: "🔐 Password",
                    value: `\`${mailbox.password}\``
                },
                {
                    name: "⏱️ Expiration",
                    value: mailbox.expiresAt
                        ? `<t:${Math.floor(
                            new Date(mailbox.expiresAt).getTime() / 1000
                        )}:R>`
                        : "1 hour"
                }
            )
            .setColor(0x5865f2)
            .setFooter({
                text: "Keep these credentials private."
            })
            .setTimestamp();

        try {
            await interaction.user.send({
                embeds: [embed]
            });

            await interaction.editReply({
                content: "✅ Your temporary email credentials were sent to your DMs."
            });
        } catch {
            if (!isOwner) {
                cooldowns.delete(userId);
            }

            await interaction.editReply({
                content:
                    "❌ I couldn't send the credentials to your DMs."
            });
        }
    } catch (error) {
        console.error("[GEN] Mailbox creation failed:", error);

        await interaction.editReply({
            content:
                "❌ The temporary-mail service is currently unavailable."
        });
    }
}

export default {
    data,
    execute
};
