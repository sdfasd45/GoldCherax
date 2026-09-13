const OWNER_ROLE_ID = "1541092291463090296";

module.exports = {
    name: "addcoins",
    description: "Add coins to a user",

    async execute(client, message, args) {

        if (!message.member.roles.cache.has(OWNER_ROLE_ID)) {
            return message.reply("❌ You don't have permission to use this command.");
        }

        const user = message.mentions.users.first();
        const amount = parseInt(args[1]);

        if (!user) {
            return message.reply("Mention a user.");
        }

        if (isNaN(amount)) {
            return message.reply("Enter a valid amount.");
        }

        // Add your database code here
        message.channel.send(
            `✅ Added ${amount} coins to ${user.username}`
        );
    }
};
