const { ApplicationCommandOptionType } = require("discord.js");

/**
 * @type {import("@structures/Command")}
 */
module.exports = {
  name: "anti",
  description: "Sunucu için çeşitli otomatik mod ayarlarını yönetin.",
  category: "Otomatik Moderasyon",
  userPermissions: ["ManageGuild"],
  command: {
    enabled: true,
    minArgsCount: 2,
    subcommands: [
      {
        trigger: "etiketkoruması <Aç|Kapat>",
        description: "Sunucunuzdaki atılıp silinen etiketleri algılar ve not alır.",
      },
      {
        trigger: "spamkoruması <Aç|Kapat>",
          description: "Anti-Spam tespitini etkinleştirin veya devre dışı bırakın",
      },
      {
        trigger: "baskınkoruması <Aç|Kapat> [Değer]",
        description: "Toplu Baskın Algılamayı Etkinleştirir. [Varsayılan Değer 3'tür]",
      },
    ],
  },
  slashCommand: {
    enabled: true,
    ephemeral: true,
    options: [
      {
        name: "etiketkoruması",
            description: "Sunucunuzdaki atılıp silinen etiketleri algılar ve not alır.",
        type: ApplicationCommandOptionType.Subcommand,
        options: [
          {
            name: "Durumu",
            description: "Ayar Durumu",
            required: true,
            type: ApplicationCommandOptionType.String,
            choices: [
              {
                name: "Aç",
                value: "ON",
              },
              {
                name: "Kapat",
                value: "OFF",
              },
            ],
          },
        ],
      },
      {
        name: "spamkoruması",
          description: "Anti-Spam tespitini etkinleştirin veya devre dışı bırakın",
        type: ApplicationCommandOptionType.Subcommand,
        options: [
          {
            name: "Durumu",
            description: "Ayar Durumu",
            required: true,
            type: ApplicationCommandOptionType.String,
            choices: [
              {
                name: "Aç",
                value: "ON",
              },
              {
                name: "Kapat",
                value: "OFF",
              },
            ],
          },
        ],
      },
      {
        name: "baskınkoruması",
          description: "Toplu Baskın Algılamayı Etkinleştirir. [Varsayılan Değer 3'tür]",
        type: ApplicationCommandOptionType.Subcommand,
        options: [
          {
            name: "Durumu",
            description: "Ayar Durumu",
            required: true,
            type: ApplicationCommandOptionType.String,
            choices: [
              {
                name: "Aç",
                value: "ON",
              },
              {
                name: "Kapat",
                value: "OFF",
              },
            ],
          },
          {
            name: "Değer",
            description: "Belirleme Değeri (Varsayılan Değer 3'tür)",
            required: false,
            type: ApplicationCommandOptionType.Integer,
          },
        ],
      },
    ],
  },

  async messageRun(message, args, data) {
    const settings = data.settings;
    const sub = args[0].toLowerCase();

    let response;
    if (sub == "etiketkoruması") {
      const status = args[1].toLowerCase();
      if (!["on", "off"].includes(status)) return message.safeReply("Geçersiz değer! Değerler `aç veya kapalı` olmalıdır.");
      response = await antiGhostPing(settings, status);
    }

    //
    else if (sub == "spamkoruması") {
      const status = args[1].toLowerCase();
        if (!["on", "off"].includes(status)) return message.safeReply("Geçersiz değer! Değerler `aç veya kapalı` olmalıdır.");
      response = await antiSpam(settings, status);
    }

    //
    else if (sub === "baskınkoruması") {
      const status = args[1].toLowerCase();
      const threshold = args[2] || 3;
        if (!["on", "off"].includes(status)) return message.safeReply("Geçersiz değer! Değerler `aç veya kapalı` olmalıdır.");
      response = await antiMassMention(settings, status, threshold);
    }

    //
    else response = "Yanlış Kullanım!";
    await message.safeReply(response);
  },

  async interactionRun(interaction, data) {
    const sub = interaction.options.getSubcommand();
    const settings = data.settings;

    let response;
    if (sub == "etiketkoruması") response = await antiGhostPing(settings, interaction.options.getString("durum"));
    else if (sub == "spamkoruması") response = await antiSpam(settings, interaction.options.getString("durum"));
    else if (sub === "baskınkoruması") {
      response = await antiMassMention(
        settings,
        interaction.options.getString("durum"),
        interaction.options.getInteger("deger")
      );
    } else response = "Yanlış Kullanım!";

    await interaction.followUp(response);
  },
};

async function antiGhostPing(settings, input) {
  const status = input.toUpperCase() === "ON" ? true : false;
  settings.automod.anti_ghostping = status;
  await settings.save();
    return `Yapılandırma kaydedildi! Etiket Koruması Şu An ${status ? "Aktif" : "Deaktif"}.`;
}

async function antiSpam(settings, input) {
  const status = input.toUpperCase() === "ON" ? true : false;
  settings.automod.anti_spam = status;
  await settings.save();
  return `Spam Koruması Şu An ${status ? "Aktif" : "Deaktif"}.`;
}

async function antiMassMention(settings, input, threshold) {
  const status = input.toUpperCase() === "ON" ? true : false;
  if (!status) {
    settings.automod.anti_massmention = 0;
  } else {
    settings.automod.anti_massmention = threshold;
  }
  await settings.save();
  return `Baskın Koruması Şu An ${status ? "Aktif" : "Deaktif"}.`;
}
