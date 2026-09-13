import { SlashCommandBuilder } from 'discord.js';
import { addMoney } from '../../utils/economy.js';
import { withErrorHandling } from '../../utils/errorHandler.js';
import { InteractionHelper } from '../../utils/interactionHelper.js';

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
        ),

    execute: withErrorHandling(async (interaction, config, client) => {

        const deferred = await InteractionHelper.safeDefer(interaction);
        if (!deferred) return;

        if (!interaction.member.roles.cache.has(OWNER_ROLE_ID)) {
            return InteractionHelper.safeEditReply(interaction, {
                content: '❌ You do not have permission to use this command.'
            });
        }

        const targetUser = interaction.options.getUser('user');
        const amount = interaction.options.getInteger('amount');

        if (amount <= 0) {
            return InteractionHelper.safeEditReply(interaction, {
                content: '❌ Amount must be greater than 0.'
            });
        }

        await addMoney(
            client,
            interaction.guildId,
            targetUser.id,
            amount,
            'wallet'
        );

        await InteractionHelper.safeEditReply(interaction, {
            content: `✅ Added $${amount.toLocaleString()} to ${targetUser}.`
        });

    }, { command: 'addcoins' })
};
