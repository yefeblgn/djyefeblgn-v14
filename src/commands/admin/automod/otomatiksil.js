const { ApplicationCommandOptionType } = require("discord.js");

/**
 * @type {import("@structures/Command")}
 */
module.exports = {
  name: "otomatiksil",
    description: "Sunucu için otomatik silme ayarlarını yönetin",
  category: "Otomatik Moderasyon",
  userPermissions: ["ManageGuild"],
  command: {
    enabled: true,
    minArgsCount: 2,
    subcommands: [
      {
            trigger: "ekler <Aç|Kapat>",
            description: "Mesajlardaki eklerin otomatik silinmesini aç veya kapat.",
      },
      {
          trigger: "davetler <Aç|Kapat>",
          description: "Mesajlardaki davetlerin otomatik silinmesini aç veya kapat.",
      },
      {
          trigger: "bağlantılar <Aç|Kapat>",
          description: "Mesajlardaki bağlantıların otomatik silinmesini aç veya kapat.",
      },
      {
        trigger: "satır <sayı>",
          description: "Mesaj başına izin verilen maksimum satırı ayarlar [Kapalı => 0]",
      },
    ],
  },
  slashCommand: {
    enabled: true,
    ephemeral: true,
    options: [
      {
        name: "ekler",
            description: "Mesajlardaki eklerin otomatik silinmesini aç veya kapat",
        type: ApplicationCommandOptionType.Subcommand,
        options: [
          {
            name: "Durum",
            description: "Ayarın Durumu",
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
        name: "davetler",
          description: "Mesajlardaki davetlerin otomatik silinmesini aç veya kapat",
        type: ApplicationCommandOptionType.Subcommand,
        options: [
          {
            name: "Durum",
            description: "Ayarın Durumu",
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
        name: "bağlantılar",
          description: "Mesajlardaki bağlantıların otomatik silinmesini aç veya kapat.",
        type: ApplicationCommandOptionType.Subcommand,
        options: [
          {
            name: "Durum",
            description: "Ayarın Durumu",
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
        name: "satır",
          description: "Mesaj başına izin verilen maksimum satırı ayarlar [Kapalı => 0]",
        type: ApplicationCommandOptionType.Subcommand,
        options: [
          {
            name: "sayı",
            description: "Ayar Sayısı [Kapalı => 0]",
            required: true,
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

    if (sub == "ekler") {
      const status = args[1].toLowerCase();
        if (!["on", "off"].includes(status)) return message.safeReply("Geçersiz değer! Değerler `aç veya kapalı` olmalıdır.");
      response = await antiAttachments(settings, status);
    }

    //
    else if (sub === "davetler") {
      const status = args[1].toLowerCase();
        if (!["on", "off"].includes(status)) return message.safeReply("Geçersiz değer! Değerler `aç veya kapalı` olmalıdır.");
      response = await antiInvites(settings, status);
    }

    //
    else if (sub == "bağlantılar") {
      const status = args[1].toLowerCase();
        if (!["on", "off"].includes(status)) return message.safeReply("Geçersiz değer! Değerler `aç veya kapalı` olmalıdır.");
      response = await antilinks(settings, status);
    }

    //
    else if (sub === "satır") {
      const max = args[1];
      if (isNaN(max) || Number.parseInt(max) < 1) {
          return message.safeReply("Maksimum Satır, 0'dan büyük geçerli bir sayı olmalıdır");
      }
      response = await maxLines(settings, max);
    }

    //
    else response = "Yanlış Kullanım!";
    await message.safeReply(response);
  },

  async interactionRun(interaction, data) {
    const sub = interaction.options.getSubcommand();
    const settings = data.settings;
    let response;

    if (sub == "ekler") {
      response = await antiAttachments(settings, interaction.options.getString("durum"));
    } else if (sub === "davetler") response = await antiInvites(settings, interaction.options.getString("durum"));
    else if (sub == "bağlantılar") response = await antilinks(settings, interaction.options.getString("durum"));
    else if (sub === "satır") response = await maxLines(settings, interaction.options.getInteger("sayı"));
    else response = "Geçersiz komut kullanımı!";

    await interaction.followUp(response);
  },
};

async function antiAttachments(settings, input) {
  const status = input.toUpperCase() === "ON" ? true : false;
  settings.automod.anti_attachments = status;
  await settings.save();
  return `Mesajlar, ${
      status ? "ekler olanlar için artık otomatik olarak silinecek" : "şimdi ekler için filtrelenmeyecek"
  }`;
}

async function antiInvites(settings, input) {
  const status = input.toUpperCase() === "ON" ? true : false;
  settings.automod.anti_invites = status;
  await settings.save();
  return `Mesajlar, ${
      status ? "sunucu daveti olanlar için artık otomatik olarak silinecek" : "şimdi sunucu davetleri için filtrelenmeyecek"
  }`;
}

async function antilinks(settings, input) {
  const status = input.toUpperCase() === "ON" ? true : false;
  settings.automod.anti_links = status;
  await settings.save();
    return `Mesajlar, ${status ? "bağlantı olanlar için artık otomatik olarak silinecek" : "şimdi bağlantıları için filtrelenmeyecek"}`;
}

async function maxLines(settings, input) {
  const lines = Number.parseInt(input);
    if (isNaN(lines)) return "Lütfen geçerli bir sayı girin";

  settings.automod.max_lines = lines;
  await settings.save();
  return `${
    input === 0
      ? "Maksimum satır devre dışı bırakıldı"
      : `\`${input}\` satırından uzun mesajlar artık otomatik olarak silinecek`
  }`;
}
