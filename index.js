const { Telegraf, Markup } = require('telegraf');
const express = require('express');
const path = require('path');

const BOT_TOKEN = '8685057163:AAGT3o3Ad-MAYfrHQmxRkA6Py6pnKPnUzMk';
const ADMIN_ID = 1683002116;
const bot = new Telegraf(BOT_TOKEN);
const app = express();

// --- إعدادات البوت ---
const REFERRAL_BONUS = 0.02; 
const MIN_WITHDRAW = 0.10;
const CHANNEL_URL = "https://t.me/VaultoUSDT";

// تخزين البيانات (مؤقت)
let users = new Map(); 
let deviceRegistry = new Map();

app.use(express.static(path.join(__dirname)));
app.get('/validate', (req, res) => res.sendFile(path.join(__dirname, 'validate.html')));
app.listen(process.env.PORT || 10000);

// نصوص اللغات
const strings = {
    en: {
        welcome: "✅ Verified! Welcome to Novaton Official Bot.",
        main_menu: "Main Menu",
        btns: ["👤 Account", "👥 Referral", "📥 Deposit", "📤 Withdraw", "🌐 Language", "📢 Channel"],
        acc_info: (bal) => `👤 **Account Info**\n\n💰 Balance: ${bal.toFixed(2)} TON\n🎁 Daily Bonus: Active`,
        ref_info: (id, count) => `👥 **Referral Program**\n\n🔗 Link: https://t.me/novaton_bot?start=${id}\n\n🎁 Reward: ${REFERRAL_BONUS} TON per friend\n📈 Invited: ${count} users`,
        withdraw_err: `❌ Minimum withdrawal is ${MIN_WITHDRAW} TON.`,
        lang_set: "🌐 Language set to English."
    },
    ar: {
        welcome: "✅ تم التحقق! أهلاً بك في بوت Novaton الرسمي.",
        main_menu: "القائمة الرئيسية",
        btns: ["👤 حسابي", "👥 الإحالة", "📥 إيداع", "📤 سحب", "🌐 تغيير اللغة", "📢 القناة الرسمية"],
        acc_info: (bal) => `👤 **معلومات الحساب**\n\n💰 الرصيد: ${bal.toFixed(2)} TON\n🎁 المكافأة اليومية: نشطة`,
        ref_info: (id, count) => `👥 **نظام الإحالة**\n\n🔗 الرابط: https://t.me/novaton_bot?start=${id}\n\n🎁 المكافأة: ${REFERRAL_BONUS} TON لكل صديق\n📈 المدعوين: ${count} عضو`,
        withdraw_err: `❌ الحد الأدنى للسحب هو ${MIN_WITHDRAW} TON.`,
        lang_set: "🌐 تم تغيير اللغة إلى العربية."
    }
};

// إنشاء الأزرار بناءً على اللغة
const getKeyboard = (lang) => {
    const b = strings[lang].btns;
    return Markup.keyboard([
        [b[0], b[1]],
        [b[2], b[3]],
        [b[4], b[5]]
    ]).resize();
};

bot.start(async (ctx) => {
    const userId = ctx.from.id;
    if (!users.has(userId)) {
        users.set(userId, { balance: 0, lang: 'en', invited: 0, verified: false });
    }
    
    // واجهة التحقق (Web App)
    const webAppUrl = `https://${process.env.RENDER_EXTERNAL_HOSTNAME || 'novaton-bot.onrender.com'}/validate`;
    ctx.reply(`🛡️ **Hardware Security Scan**\nPlease scan your device to start earning.`, 
    Markup.inlineKeyboard([[Markup.button.webApp("🔍 Scan Device Fingerprint", webAppUrl)]]));
});

// استقبال بيانات الحماية وكشف التعدد
bot.on('web_app_data', (ctx) => {
    const data = JSON.parse(ctx.webAppData.data);
    const userId = ctx.from.id;
    const user = users.get(userId);

    if (deviceRegistry.has(data.hwid) && deviceRegistry.get(data.hwid) !== userId) {
        return ctx.reply("🚨 **Security Alert:** Multi-account detected. Device blocked.");
    }

    deviceRegistry.set(data.hwid, userId);
    user.verified = true;
    ctx.reply(strings[user.lang].welcome, getKeyboard(user.lang));
});

// معالجة الأزرار
bot.on('text', async (ctx) => {
    const userId = ctx.from.id;
    const user = users.get(userId);
    if (!user || !user.verified) return;

    const txt = ctx.message.text;

    if (txt === "👤 Account" || txt === "👤 حسابي") {
        ctx.reply(strings[user.lang].acc_info(user.balance));
    } 
    else if (txt === "👥 Referral" || txt === "👥 الإحالة") {
        ctx.reply(strings[user.lang].ref_info(userId, user.invited));
    }
    else if (txt === "📤 Withdraw" || txt === "📤 سحب") {
        ctx.reply(strings[user.lang].withdraw_err);
    }
    else if (txt === "🌐 Language" || txt === "🌐 تغيير اللغة") {
        ctx.reply("Choose your language / اختر لغتك:", Markup.inlineKeyboard([
            [Markup.button.callback("🇺🇸 English", "set_en"), Markup.button.callback("🇸🇦 العربية", "set_ar")]
        ]));
    }
    else if (txt === "📢 Channel" || txt === "📢 القناة الرسمية") {
        ctx.reply("📢 Join our official channel for updates:", Markup.inlineKeyboard([
            [Markup.button.url("Channel / القناة", CHANNEL_URL)]
        ]));
    }
});

// تغيير اللغة
bot.action(/set_(en|ar)/, (ctx) => {
    const lang = ctx.match[1];
    const user = users.get(ctx.from.id);
    user.lang = lang;
    ctx.answerCbQuery();
    ctx.reply(strings[lang].lang_set, getKeyboard(lang));
});

bot.launch();
