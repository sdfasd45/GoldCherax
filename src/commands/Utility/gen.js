// src/commands/Utilities/gen.js
// Discord.js v14
//
// /gen
// - Normal users: once every 3 hours
// - Owner: unlimited
// - Opens the official Epic Games account-creation page
// - Does not attempt to bypass CAPTCHA, email verification, or other account protections.

import {
    SlashCommandBuilder,
    EmbedBuilder,
    ActionRowBuilder,
    ButtonBuilder,
    ButtonStyle
} from "discord.js";

const OWNER_ID = "1541092291463090296";
const COOLDOWN_MS = 3 * 60 * 60 * 1000;

// In-memory cooldown storage.
// For production, move this to your existing database/DataStore.
const cooldowns = new Map();

const EPIC_SIGNUP_URL = "https://www.epicgames.com/id/register";

export const data = new SlashCommandBuilder()
    .setName("gen")
    .setDescription("Generate an Epic Games account signup session");

function getRemaining(ms) {
    const totalSeconds = Math.ceil(ms / 1000);

    const hours = Math.floor(totalSeconds / 3600);
    const minutes = Math.floor((totalSeconds % 3600) / 60);
    const seconds = totalSeconds % 60;

    const parts = [];

    if (hours > 0) parts.push(`${hours}h`);
    if (minutes > 0) parts.push(`${minutes}m`);
    if (seconds > 0 || parts.length === 0) parts.push(`${seconds}s`);

    return parts.join(" ");
}

export async function execute(interaction) {
    const userId = interaction.user.id;

    const isOwner = userId === OWNER_ID;

    if (!isOwner) {
        const previousGeneration = cooldowns.get(userId);

        if (previousGeneration) {
            const elapsed = Date.now() - previousGeneration;

            if (elapsed < COOLDOWN_MS) {
                const remaining = COOLDOWN_MS - elapsed;

                return interaction.reply({
                    embeds: [
                        new EmbedBuilder()
                            .setTitle("⏳ Cooldown")
                            .setDescription(
                                `You can use \`/gen\` again in **${getRemaining(remaining)}**.`
                            )
                            .setColor(0xff9900)
                            .setTimestamp()
                    ],
                    ephemeral: true
                });
            }

            cooldowns.delete(userId);
        }

        cooldowns.set(userId, Date.now());
    }

    const embed = new EmbedBuilder()
        .setTitle("🎮 Epic Games")
        .setDescription(
            "Your Epic Games account setup is ready.\n\n" +
            "Click the button below to open Epic Games and create your account."
        )
        .addFields(
            {
                name: "Account",
                value: "Create your account directly through Epic Games."
            },
            {
                name: "Cooldown",
                value: isOwner
                    ? "Owner — unlimited generations"
                    : "3 hours"
            }
        )
        .setColor(0x5865f2)
        .setFooter({
            text: `Requested by ${interaction.user.tag}`
        })
        .setTimestamp();

    const row = new ActionRowBuilder().addComponents(
        new ButtonBuilder()
            .setLabel("Create Epic Games Account")
            .setStyle(ButtonStyle.Link)
            .setURL(EPIC_SIGNUP_URL)
            .setEmoji("🎮")
    );

    await interaction.reply({
        embeds: [embed],
        components: [row],
        ephemeral: true
    });
}

// Support loaders that expect either execute() or a default export.
export default {
    data,
    execute
};
