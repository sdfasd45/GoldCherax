// Safe workflow:
// /gen
//   ↓
// 3-hour cooldown (owner is unlimited)
//   ↓
// DM user
//   ↓
// User creates/verifies their own Epic account
//   ↓
// Bot can securely store non-sensitive generation status
//
// Owner: 1541092291463090296

import {
    SlashCommandBuilder,
    EmbedBuilder
} from "discord.js";

const OWNER_ID = "1541092291463090296";
const COOLDOWN_MS = 3 * 60 * 60 * 1000;

const cooldowns = new Map();

export const data = new SlashCommandBuilder()
    .setName("gen")
    .setDescription("Start an Epic Games account setup");

export async function execute(interaction) {
    const userId = interaction.user.id;
    const owner = userId === OWNER_ID;

    if (!owner) {
        const lastUsed = cooldowns.get(userId);

        if (lastUsed && Date.now() - lastUsed < COOLDOWN_MS) {
            const remaining =
                COOLDOWN_MS - (Date.now() - lastUsed);

            const hours = Math.floor(remaining / 3600000);
            const minutes = Math.floor(
                (remaining % 3600000) / 60000
            );

            return interaction.reply({
                content:
                    `⏳ Try again in ${hours}h ${minutes}m.`,
                ephemeral: true
            });
        }

        cooldowns.set(userId, Date.now());
    }

    const message = new EmbedBuilder()
        .setTitle("🎮 Epic Games Setup")
        .setDescription(
            "Your setup session has started.\n\n" +
            "1. Create an email account you control.\n" +
            "2. Create your Epic Games account using that email.\n" +
            "3. Complete Epic's verification yourself.\n" +
            "4. Keep your login credentials private."
        )
        .setColor(0x5865f2)
        .setFooter({
            text: owner
                ? "Owner — unlimited use"
                : "Cooldown — 3 hours"
        });

    try {
        await interaction.user.send({
            embeds: [message]
        });

        await interaction.reply({
            content: "✅ Setup instructions sent to your DMs.",
            ephemeral: true
        });
    } catch {
        await interaction.reply({
            content:
                "❌ I couldn't send you a DM. Enable DMs from this server and try again.",
            ephemeral: true
        });
    }
}

export default {
    data,
    execute
};
