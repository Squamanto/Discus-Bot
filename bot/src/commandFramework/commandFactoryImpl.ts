import "reflect-metadata";
import { Message } from "discord.js";
import { injectable } from "inversify";
import {Command, CommandInfo} from "."
import { PluginDependencies } from "../dependencyInjection/pluginDependencies";
import * as Logging from "../logging";
import { CommandFactory } from "./commandFactory";
import { CommandConstructor, getCommandConstructors } from "./pluginLoader";

let logger = Logging.buildLogger("CommandFactoryImpl");

/**
 * Implementation of a command factory that creates command instances based on the command string and discord message received.
 * The list of available commands and the class constructors is taken from the command conctructor registry.
 */
@injectable()
export class CommandFactoryImpl implements CommandFactory {
    readonly commandMap : Map<string, CommandConstructor> = new Map<string, CommandConstructor>()
    readonly commandInfoMap : Map<string, CommandInfo> = new Map<string, CommandInfo>()

    /**
     * Constructs a new CommandFactory.
     * This should probably not be called directly, as creation of this object should be handled by the dependency inversion framework.
     * @param repository The repository used for persistance.
     * @param spotifyApi The spotify API wrapper used.
     */
    constructor() {
        this.registerAllCommands();
    }

    reload() {
        this.registerAllCommands();
    }

    build(command : string, message : Message, dependencies : PluginDependencies) : Command|undefined {
        let lowerCaseCommand = command.toLowerCase();
        
        let ctor = this.commandMap.get(lowerCaseCommand);
        if (ctor) {
            let command = new ctor(message, dependencies.clone());
            return command;
        } else {
            return undefined;
        }
    }

    private registerAllCommands() {
        let commandConstructors = getCommandConstructors()
        for (let i = 0; i < commandConstructors.length; i++) {
            let ctor = commandConstructors[i]
            let commandInfo = ctor.prototype.getCommandInfo()
            this.registerCommand(commandInfo, ctor)
        }
    }

    private registerCommand(commandInfo : CommandInfo, ctor : CommandConstructor) {
        let conflicts = this.getConflictingCommands(commandInfo);
            
        if (conflicts.length > 0) {
            conflicts.forEach(conflict => {
                logger.error(`ERROR: COMMAND COULD NOT BE ADDED: Command/alias ${conflict} of Command ${commandInfo.command} (aliases: ${commandInfo.aliases.toString()}) is conflicting with command ${conflict.conflictingInfo?.command} (aliase: ${conflict.conflictingInfo?.aliases.toString()})
                            Please make sure all commands and aliases are unique!`);
            })
            return;
        }

        this.commandMap.set(commandInfo.command.toLowerCase(), ctor);
        this.commandInfoMap.set(commandInfo.command.toLowerCase(), commandInfo);

        commandInfo.aliases.forEach(alias => {
            this.commandMap.set(alias.toLowerCase(), ctor);
            this.commandInfoMap.set(alias.toLowerCase(), commandInfo);
        })

        logger.info(`Registered command ${commandInfo.command} with aliases ${commandInfo.aliases.toString()}`);
    }

    private getConflictingCommands(commandInfo : CommandInfo) {
        let conflicts = []

        let commandAliases = commandInfo.aliases;
        let command = commandInfo.command;

        if (this.commandMap.has(command.toLowerCase())) {
            conflicts.push({
                command : command,
                conflictingInfo : this.commandInfoMap.get(command.toLowerCase())
            })
        }

        for (let aliasIndex in commandAliases) {
            let alias = commandAliases[aliasIndex]
            if (this.commandMap.has(alias.toLowerCase())) {
                conflicts.push({
                    command : alias,
                    conflictingInfo : this.commandInfoMap.get(alias.toLowerCase())
                })
            }
        }
        return conflicts;
    }
}
