const {
  Client,
  Collection,
  GatewayIntentBits,
  Partials,
  WebhookClient,
  ApplicationCommandType,
} = require("discord.js");
const path = require("path");
const { table } = require("table");
const Logger = require("../helpers/Logger");
const { recursiveReadDirSync } = require("../helpers/Utils");
const { validateCommand, validateContext } = require("../helpers/Validator");
const { schemas } = require("@src/database/mongoose");
const CommandCategory = require("./CommandCategory");
const lavaclient = require("../handlers/lavaclient");
const giveawaysHandler = require("../handlers/giveaway");
const { DiscordTogether } = require("discord-together");

module.exports = class BotClient extends Client {
  constructor() {
    super({
      intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildMessages,
        GatewayIntentBits.MessageContent,
        GatewayIntentBits.GuildInvites,
        GatewayIntentBits.GuildMembers,
        GatewayIntentBits.GuildPresences,
        GatewayIntentBits.GuildMessageReactions,
        GatewayIntentBits.GuildVoiceStates,
      ],
      partials: [Partials.User, Partials.Message, Partials.Reaction],
      allowedMentions: {
        repliedUser: false,
      },
      restRequestTimeout: 20000,
    });

    this.wait = require("util").promisify(setTimeout); // await client.wait(1000) - Wait 1 second
    this.config = require("@root/config"); // load the config file

    /**
     * @type {import('@structures/Command')[]}
     */
    this.commands = []; // store actual command
    this.commandIndex = new Collection(); // store (alias, arrayIndex) pair

    /**
     * @type {Collection<string, import('@structures/Command')>}
     */
    this.slashCommands = new Collection(); // store slash commands

    /**
     * @type {Collection<string, import('@structures/BaseContext')>}
     */
    this.contextMenus = new Collection(); // store contextMenus
    this.counterUpdateQueue = []; // store guildId's that needs counter update

    // initialize webhook for sending guild join/leave details
    this.joinLeaveWebhook = process.env.JOIN_LEAVE_LOGS
      ? new WebhookClient({ url: process.env.JOIN_LEAVE_LOGS })
      : undefined;

    // Music Player
    if (this.config.MUSIC.ENABLED) this.musicManager = lavaclient(this);

    // Giveaways
    if (this.config.GIVEAWAYS.ENABLED) this.giveawaysManager = giveawaysHandler(this);

    // Logger
    this.logger = Logger;

    // Database
    this.database = schemas;

    // Discord Together
    this.discordTogether = new DiscordTogether(this);
  }

  /**
   * Load all events from the specified directory
   * @param {string} directory directory containing the event files
   */
  loadEvents(directory) {
      this.logger.log(`Etkinlikler y??kleniyor...`);
    let success = 0;
    let failed = 0;
    const clientEvents = [];

    recursiveReadDirSync(directory).forEach((filePath) => {
      const file = path.basename(filePath);
      try {
        const eventName = path.basename(file, ".js");
        const event = require(filePath);

        this.on(eventName, event.bind(null, this));
        clientEvents.push([file, "???"]);

        delete require.cache[require.resolve(filePath)];
        success += 1;
      } catch (ex) {
        failed += 1;
          this.logger.error(`y??k olay?? - ${file}`, ex);
      }
    });

    console.log(
      table(clientEvents, {
        header: {
          alignment: "center",
          content: "Bot Etkinlikleri",
        },
        singleLine: true,
        columns: [{ width: 25 }, { width: 5, alignment: "center" }],
      })
    );

      this.logger.log(`${success + failed} olay y??klendi. Ba??ar??l?? (${success}) Ba??ar??s??z (${failed})`);
  }

  /**
   * Find command matching the invoke
   * @param {string} invoke
   * @returns {import('@structures/Command')|undefined}
   */
  getCommand(invoke) {
    const index = this.commandIndex.get(invoke.toLowerCase());
    return index !== undefined ? this.commands[index] : undefined;
  }

  /**
   * Register command file in the client
   * @param {import("@structures/Command")} cmd
   */
  loadCommand(cmd) {
    // Check if category is disabled
    if (cmd.category && CommandCategory[cmd.category]?.enabled === false) {
        this.logger.debug(`${cmd.name} Komut Atlan??yor. ${cmd.category} kategorisi devre d?????? b??rak??ld??`);
      return;
    }
    // Prefix Command
    if (cmd.command?.enabled) {
      const index = this.commands.length;
      if (this.commandIndex.has(cmd.name)) {
          throw new Error(`Komut ${cmd.name} zaten kay??tl??`);
      }
      if (Array.isArray(cmd.command.aliases)) {
        cmd.command.aliases.forEach((alias) => {
            if (this.commandIndex.has(alias)) throw new Error(`${alias} takma ad?? zaten kay??tl??`);
          this.commandIndex.set(alias.toLowerCase(), index);
        });
      }
      this.commandIndex.set(cmd.name.toLowerCase(), index);
      this.commands.push(cmd);
    } else {
        this.logger.debug(`${cmd.name} komutu atlan??yor. Devre D??????!`);
    }

    // Slash Command
    if (cmd.slashCommand?.enabled) {
        if (this.slashCommands.has(cmd.name)) throw new Error(`${cmd.name} Slash Komutu zaten kay??tl??`);
      this.slashCommands.set(cmd.name, cmd);
    } else {
        this.logger.debug(`${cmd.name} e??ik ??izgi komutu atlan??yor. Engelli!`);
    }
  }

  /**
   * Load all commands from the specified directory
   * @param {string} directory
   */
  loadCommands(directory) {
    this.logger.log(`Komutlar Y??kleniyor...`);
    const files = recursiveReadDirSync(directory);
    for (const file of files) {
      try {
        const cmd = require(file);
        if (typeof cmd !== "object") continue;
        validateCommand(cmd);
        this.loadCommand(cmd);
      } catch (ex) {
          this.logger.error(`${file} y??klenemedi Neden: ${ex.message}`);
      }
    }

      this.logger.success(`${this.commands.length} komut y??klendi`);
      this.logger.success(`${this.slashCommands.size} slash komutlar?? y??klendi`);
      if (this.slashCommands.size > 100) throw new Error("En fazla 100 slash komutu etkinle??tirilebilir");
  }

  /**
   * Load all contexts from the specified directory
   * @param {string} directory
   */
  loadContexts(directory) {
      this.logger.log(`Ba??lamlar y??kleniyor...`);
    const files = recursiveReadDirSync(directory);
    for (const file of files) {
      try {
        const ctx = require(file);
        if (typeof ctx !== "object") continue;
        validateContext(ctx);
          if (!ctx.enabled) return this.logger.debug(`${ctx.name} ba??lam?? atlan??yor. Engelli!`);
          if (this.contextMenus.has(ctx.name)) throw new Error(`Ba??lam zaten bu ada sahip`);
        this.contextMenus.set(ctx.name, ctx);
      } catch (ex) {
          this.logger.error(`${file} y??klenemedi Neden: ${ex.message}`);
      }
    }

    const userContexts = this.contextMenus.filter((ctx) => ctx.type === "USER").size;
    const messageContexts = this.contextMenus.filter((ctx) => ctx.type === "MESSAGE").size;

      if (userContexts > 3) throw new Error("En fazla 3 KULLANICI ba??lam?? etkinle??tirilebilir");
      if (messageContexts > 3) throw new Error("En fazla 3 MESAJ ba??lam?? etkinle??tirilebilir");

      this.logger.success(`${userContexts} USER i??eri??i y??klendi`);
      this.logger.success(`${messageContexts} MESSAGE ba??lam?? y??klendi`);
  }

  /**
   * Register slash command on startup
   * @param {string} [guildId]
   */
  async registerInteractions(guildId) {
    const toRegister = [];

    // filter slash commands
    if (this.config.INTERACTIONS.SLASH) {
      this.slashCommands
        .map((cmd) => ({
          name: cmd.name,
          description: cmd.description,
          type: ApplicationCommandType.ChatInput,
          options: cmd.slashCommand.options,
        }))
        .forEach((s) => toRegister.push(s));
    }

    // filter contexts
    if (this.config.INTERACTIONS.CONTEXT) {
      this.contextMenus
        .map((ctx) => ({
          name: ctx.name,
          type: ctx.type,
        }))
        .forEach((c) => toRegister.push(c));
    }

    // Register GLobally
    if (!guildId) {
      await this.application.commands.set(toRegister);
    }

    // Register for a specific guild
    else if (guildId && typeof guildId === "string") {
      const guild = this.guilds.cache.get(guildId);
      if (!guild) {
          this.logger.error(`Loncadaki etkile??imler kaydedilemedi ${guildId}`, new Error("E??le??en lonca yok"));
        return;
      }
      await guild.commands.set(toRegister);
    }

    // Throw an error
    else {
        throw new Error("Etkile??imleri kaydetmek i??in ge??erli bir lonca kimli??i sa??lad??n??z m???");
    }

      this.logger.success("Ba??ar??yla kaydedilen etkile??imler");
  }

  /**
   * @param {string} search
   * @param {Boolean} exact
   */
  async resolveUsers(search, exact = false) {
    if (!search || typeof search !== "string") return [];
    const users = [];

    // check if userId is passed
    const patternMatch = search.match(/(\d{17,20})/);
    if (patternMatch) {
      const id = patternMatch[1];
      const fetched = await this.users.fetch(id, { cache: true }).catch(() => {}); // check if mentions contains the ID
      if (fetched) {
        users.push(fetched);
        return users;
      }
    }

    // check if exact tag is matched in cache
    const matchingTags = this.users.cache.filter((user) => user.tag === search);
    if (exact && matchingTags.size === 1) users.push(matchingTags.first());
    else matchingTags.forEach((match) => users.push(match));

    // check matching username
    if (!exact) {
      this.users.cache
        .filter(
          (x) =>
            x.username === search ||
            x.username.toLowerCase().includes(search.toLowerCase()) ||
            x.tag.toLowerCase().includes(search.toLowerCase())
        )
        .forEach((user) => users.push(user));
    }

    return users;
  }

  /**
   * Get bot's invite
   */
  getInvite() {
    return this.generateInvite({
      scopes: ["bot", "applications.commands"],
      permissions: [
        "AddReactions",
        "AttachFiles",
        "BanMembers",
        "ChangeNickname",
        "Connect",
        "DeafenMembers",
        "EmbedLinks",
        "KickMembers",
        "ManageChannels",
        "ManageGuild",
        "ManageMessages",
        "ManageNicknames",
        "ManageRoles",
        "ModerateMembers",
        "MoveMembers",
        "MuteMembers",
        "PrioritySpeaker",
        "ReadMessageHistory",
        "SendMessages",
        "SendMessagesInThreads",
        "Speak",
        "ViewChannel",
      ],
    });
  }
};
