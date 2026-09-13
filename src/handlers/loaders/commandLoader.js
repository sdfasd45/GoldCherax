import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { Collection } from 'discord.js';
import logger from '../../utils/logger.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const TARGET_GUILD_ID = '1541092100056027136';
const MAX_COMMANDS = 100;
const COMMAND_WARNING_THRESHOLD = 90;

async function getAllFiles(directory, fileList = []) {
    const entries = await fs.readdir(directory, {
        withFileTypes: true
    });

    for (const entry of entries) {
        const fullPath = path.join(directory, entry.name);

        if (entry.isDirectory()) {
            if (entry.name !== 'modules') {
                await getAllFiles(fullPath, fileList);
            }
        } else if (
            entry.isFile() &&
            entry.name.endsWith('.js')
        ) {
            fileList.push(fullPath);
        }
    }

    return fileList;
}

function getSubcommandInfo(commandData) {
    const options = commandData.options || [];

    const subcommands = options.filter(
        option => option.type === 1 || option.type === 2
    );

    return {
        count: subcommands.length,
        names: subcommands.map(option => option.name)
    };
}

export async function loadCommands(client) {
    client.commands = new Collection();

    const commandsPath = path.join(__dirname, '../../commands');
    const commandFiles = await getAllFiles(commandsPath);

    for (const filePath of commandFiles) {
        try {
            const fileUrl = pathToFileURL(filePath).href;
            const commandModule = await import(fileUrl);
            const command = commandModule.default || commandModule;

            if (!command?.data || !command?.execute) {
                logger.warn(`Skipping invalid command file: ${filePath}`);
                continue;
            }

            const commandData = command.data.toJSON();
            const commandName = commandData.name;

            if (!commandName) {
                logger.warn(`Skipping command without a name: ${filePath}`);
                continue;
            }

            if (client.commands.has(commandName)) {
                logger.warn(
                    `Duplicate command "${commandName}" found. Skipping.`
                );
                continue;
            }

            command.category =
                command.category ||
                path.basename(path.dirname(filePath));

            command.filePath = filePath;

            client.commands.set(commandName, command);

            const subcommandInfo = getSubcommandInfo(commandData);

            logger.info(
                `Loaded command: ${commandName}` +
                (
                    subcommandInfo.count
                        ? ` (${subcommandInfo.count} subcommands)`
                        : ''
                )
            );
        } catch (error) {
            logger.error(`Failed to load command file: ${filePath}`, error);
        }
    }

    logger.info(`Commands loaded: ${client.commands.size}`);

    return client.commands;
}

function collectCommandPayloads(client) {
    const commands = [];
    let totalSubcommands = 0;

    for (const command of client.commands.values()) {
        const commandData = command.data.toJSON();

        commands.push(commandData);

        const subcommandInfo = getSubcommandInfo(commandData);
        totalSubcommands += subcommandInfo.count;
    }

    return {
        commands,
        totalSubcommands
    };
}

function validateCommands(commands) {
    if (commands.length > MAX_COMMANDS) {
        throw new Error(
            `Too many commands. Discord allows ${MAX_COMMANDS} commands.`
        );
    }

    for (const command of commands) {
        if (!command.name) {
            throw new Error('A command is missing its name.');
        }

        if (!command.description) {
            throw new Error(
                `Command "${command.name}" is missing a description.`
            );
        }

        if (command.name.length > 32) {
            throw new Error(
                `Command "${command.name}" has a name longer than 32 characters.`
            );
        }

        if (command.description.length > 100) {
            throw new Error(
                `Command "${command.name}" has a description longer than 100 characters.`
            );
        }

        if (command.options?.length > 25) {
            throw new Error(
                `Command "${command.name}" has more than 25 options.`
            );
        }
    }
}

function prepareCommandsForRegistration(commands) {
    if (commands.length >= COMMAND_WARNING_THRESHOLD) {
        logger.warn(
            `Registering ${commands.length} commands. Discord allows ${MAX_COMMANDS}.`
        );
    }

    return commands.slice(0, MAX_COMMANDS);
}

async function registerGuildCommands(
    client,
    clientId,
    guildId,
    commands
) {
    if (!clientId) {
        throw new Error('CLIENT_ID is missing.');
    }

    if (!client.rest) {
        throw new Error('Discord REST client is missing.');
    }

    validateCommands(commands);

    const commandsToRegister =
        prepareCommandsForRegistration(commands);

    const route =
        `/applications/${clientId}/guilds/${guildId}/commands`;

    await client.rest.put(route, {
        body: commandsToRegister
    });

    logger.info(
        `Successfully registered ${commandsToRegister.length} commands to guild ${guildId}`
    );

    logger.info('Guild slash commands should appear immediately.');
}

export async function registerCommands(client, options = {}) {
    const clientId =
        options.clientId ||
        client.config?.bot?.clientId ||
        process.env.CLIENT_ID;

    const { commands } = collectCommandPayloads(client);

    await registerGuildCommands(
        client,
        clientId,
        TARGET_GUILD_ID,
        commands
    );
}

export async function reloadCommand(client, commandName) {
    const oldCommand = client.commands.get(commandName);

    if (!oldCommand?.filePath) {
        throw new Error(
            `Cannot reload "${commandName}": command file was not found.`
        );
    }

    const fileUrl = pathToFileURL(oldCommand.filePath).href;
    const reloadUrl = `${fileUrl}?reload=${Date.now()}`;

    const commandModule = await import(reloadUrl);
    const newCommand = commandModule.default || commandModule;

    if (!newCommand?.data || !newCommand?.execute) {
        throw new Error(
            `Reloaded command "${commandName}" is invalid.`
        );
    }

    newCommand.category =
        newCommand.category || oldCommand.category;

    newCommand.filePath = oldCommand.filePath;

    client.commands.set(commandName, newCommand);

    logger.info(`Reloaded command: ${commandName}`);

    return newCommand;
}
