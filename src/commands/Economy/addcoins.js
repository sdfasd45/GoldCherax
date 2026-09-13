import { SlashCommandBuilder } from 'discord.js';
import { addMoney } from '../../utils/economy.js';

const OWNER_ROLE_ID = '1541092291463090296';

export default {
    data: new SlashCommandBuilder()
        .setName('addcoins')
        .setDescription('Add coins to a user')
        .addUserOption(option =>
            option
                .setName('user')
                .setDescription('User to give coins to')
                .setRequired(true)
        )
        .addIntegerOption(option =>
            option
                .setName('amount')
                .setDescription('Amount of coins')
                .setRequired(true)
        )
        .setDMPermission(false),

    async execute(interaction, config, client) {
        const member = interaction.member;

        if (!member.roles.cache.has(OWNER_ROLE_ID)) {
            return interaction.reply({
                content: '❌ You do not have permission to use this command.',
                ephemeral: true
            });
        }

        const targetUser = interaction.options.getUser('user');
        const amount = interaction.options.getInteger('amount');

        if (amount <= 0) {
            return interaction.reply({
                content: '❌ Amount must be greater than 0.',
                ephemeral: true
            });
        }

        await addMoney(
            client,
            interaction.guildId,
            targetUser.id,
            amount,
            'wallet'
        );

        await interaction.reply({
            content: `✅ Added **${amount}** coins to ${targetUser}.`
        });
    }
};
