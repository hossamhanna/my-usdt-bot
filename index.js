const { Telegraf, Markup } = require('telegraf');
const express = require('express');
const path = require('path');

const BOT_TOKEN = '8685057163:AAGT3o3Ad-MAYfrHQmxRkA6Py6pnKPnUzMk';
const ADMIN_ID = 1683002116;
const CHANNEL_ID = '@VaultoUSDT'; // معرف قناتك

const bot = new Telegraf(BOT_TOKEN);
const app = express();

// إعدادات البيانات
let users = new Map();
let deviceRegistry = new Map();
let forceChannels = [CHANNEL_ID];

app.use(express.static(path.join(__dirname)));
app.get('/validate', (req, res) => res.sendFile(path.join(__dirname, 'validate.html')));
app.listen(process.env.PORT || 10000);

const strings = {
    en: {
        welcome: "✅ Access Granted! Dashboard ready.",
        btns: ["👤 Account", "👥 Referral", "📥 Deposit", "📤 Withdraw", "🌐 Language", "📢 Channel"],
        acc: (bal) => `👤 **Account Info**\n\nBalance: ${bal.toFixed(2)} TON`,
        ref: (id) => `👥 **Referral**\n\nLink: https://t.me/novaton_bot?start=${id}\nReward: 0.02 TON`,
        withdraw: "❌ Minimum withdrawal is 0.10 TON."
    },
    ar: {
        welcome: "✅ تم التحقق! لوحة التحكم جاهزة.",
        btns: ["👤 حسابي", "👥 الإحالة", "📥 إيداع", "📤 سحب", "🌐 اللغة", "📢 القناة"],
        acc: (bal) => `👤 **معلومات الحساب**\n\nالرصيد: ${bal.toFixed(2)} TON`,
        ref: (id) => `👥 **الإحالة**\n\nالرابط: https://t.me/novaton_bot?start=${id}\nالمكافأة: 0.02 TON`,
        withdraw: "❌ الحد الأدنى للسحب هو 0.10 TON."
    }
};

async function isSubscribed(ctx) {
    try {
        const res = await ctx.telegram.getChatMember(CHANNEL_ID, ctx.from.id);
        return ['member', 'administrator', 'creator'].includes(res.status);
    } catch { return false; }
}

bot.start(async (ctx) => {
    const userId = ctx.from.id;
    if (!users.has(userId)) users.set(userId, { balance: 0, lang: 'en', verified: false });

    if (!(await isSubscribed(ctx))) {
        return ctx.replyWithPhoto("https://image2url.com/r2/default/images/1774806219411-7438bf59-86d5-4352-9d9a-dd254c3f841d.jpg", {
            caption: `🛡️ **Novaton System**\n\nPlease join our channel and click verify.`,
            ...Markup.inlineKeyboard([
                [Markup.button.url("📢 Join Channel", `https://t.me/${CHANNEL_ID.replace('@','')}`)],
                [Markup.button.callback("✅ Check Subscription", "verify_sub")]
            ])
        });
    }
    sendSecurity(ctx);
});

bot.action('verify_sub', async (ctx) => {
    if (await isSubscribed(ctx)) {
        await ctx.deleteMessage();
        sendSecurity(ctx);
    } else {
        await ctx.answerCbQuery("❌ Not joined yet!", { show_alert: true });
    }
});

function sendSecurity(ctx) {
    const domain = process.env.RENDER_EXTERNAL_HOSTNAME || 'novaton-bot.onrender.com';
    ctx.reply(`🛡️ **Device Scan**\nPlease scan your device hardware to unlock features.`, 
    Markup.inlineKeyboard([[Markup.button.webApp("🔍 Start Scan", `https://${domain}/validate`)]]));
}

bot.on('web_app_data', (ctx) => {
    const data = JSON.parse(ctx.webAppData.data);
    const userId = ctx.from.id;

    if (deviceRegistry.has(data.hwid) && deviceRegistry.get(data.hwid) !== userId) {
        return ctx.reply("🚨 **Multi-Account Detected!** Your device is blocked.");
    }

    deviceRegistry.set(data.hwid, userId);
    users.get(userId).verified = true;

    const lang = users.get(userId).lang;
    const b = strings[lang].btns;
    ctx.reply(strings[lang].welcome, Markup.keyboard([[b[0], b[1]], [b[2], b[3]], [b[4], b[5]]]).resize());
});

bot.on('text', (ctx) => {
    const userId = ctx.from.id;
    const user = users.get(userId);
    if (!user || !user.verified) return;

    const txt = ctx.message.text;
    const s = strings[user.lang];

    if (txt === s.btns[0]) ctx.reply(s.acc(user.balance));
    if (txt === s.btns[1]) ctx.reply(s.ref(userId));
    if (txt === s.btns[3]) ctx.reply(s.withdraw);
    if (txt === s.btns[4]) {
        ctx.reply("Change Language / اختر اللغة:", Markup.inlineKeyboard([
            [Markup.button.callback("🇺🇸 English", "set_en"), Markup.button.callback("🇸🇦 العربية", "set_ar")]
        ]));
    }
    if (txt === s.btns[5]) ctx.reply(`📢 Channel: ${CHANNEL_ID}`);
});

bot.action(/set_(en|ar)/, (ctx) => {
    const lang = ctx.match[1];
    users.get(ctx.from.id).lang = lang;
    ctx.answerCbQuery();
    const b = strings[lang].btns;
    ctx.reply(lang === 'ar' ? "تم التغيير للعربية" : "Language set to English", Markup.keyboard([[b[0], b[1]], [b[2], b[3]], [b[4], b[5]]]).resize());
});

// لوحة الإدارة
bot.command('admin', (ctx) => {
    if (ctx.from.id !== ADMIN_ID) return;
    ctx.reply("👑 **Admin Panel**", Markup.inlineKeyboard([
        [Markup.button.callback("📢 Broadcast", "adm_bc"), Markup.button.callback("🚫 Ban User", "adm_ban")]
    ]));
});

bot.launch();
