const { Telegraf, Markup } = require('telegraf');
const express = require('express');

// --- ⚙️ الإعدادات ---
const BOT_TOKEN = '8685057163:AAGT3o3Ad-MAYfrHQmxRkA6Py6pnKPnUzMk';
const ADMIN_ID = 1683002116; // آيدي المدير الخاص بك
const bot = new Telegraf(BOT_TOKEN);

// --- 🌐 نظام استمرار العمل ---
const app = express();
app.get('/', (req, res) => res.send('Novaton Admin Core: ACTIVE ✅'));
app.listen(process.env.PORT || 10000);

// --- 💾 تخزين مؤقت (بدل Firebase حالياً) ---
let botSettings = {
    channel: "@Novaton_Channel",
    minWithdraw: 0.10,
    referralBonus: 0.03,
    status: "ON"
};

// --- 🤖 القائمة الرئيسية للمستخدمين ---
const userKeyboard = Markup.keyboard([
    ["👤 حسابي", "🔗 الإحالة"],
    ["📥 إيداع", "📤 سحب الأرباح"],
    ["⚙️ الإدارة"] // ستظهر للكل لكن لا يفتحها إلا المدير
]).resize();

bot.start((ctx) => {
    return ctx.replyWithPhoto("https://image2url.com/r2/default/images/1774806219411-7438bf59-86d5-4352-9d9a-dd254c3f841d.jpg", {
        caption: `🛡️ **مرحباً بك في Novaton المطور**\n\nنظامنا يعتمد على عملة TON لتوزيع الأرباح والجوائز.\n\n📢 القناة الرسمية: ${botSettings.channel}`,
        ...Markup.inlineKeyboard([
            [Markup.button.url("📢 انضم للقناة", `https://t.me/${botSettings.channel.replace('@','')}`)],
            [Markup.button.callback("✅ دخول البوت", "main_menu")]
        ])
    });
});

bot.action('main_menu', (ctx) => {
    ctx.answerCbQuery();
    ctx.reply("🚀 تم الدخول بنجاح! اختر من القائمة أدناه:", userKeyboard);
});

// --- 👑 قسم لوحة التحكم (Admin Panel) ---
bot.hears("⚙️ الإدارة", (ctx) => {
    if (ctx.from.id !== ADMIN_ID) return ctx.reply("🚫 عذراً، هذا القسم مخصص للمدير فقط.");

    const adminText = `👑 **أهلاً بك يا مدير في لوحة التحكم**\n\n` +
                      `📍 القناة الحالية: ${botSettings.channel}\n` +
                      `💰 الحد الأدنى للسحب: ${botSettings.minWithdraw} TON\n` +
                      `🎁 مكافأة الإحالة: ${botSettings.referralBonus} TON\n` +
                      `🚦 حالة البوت: ${botSettings.status}`;

    ctx.reply(adminText, Markup.inlineKeyboard([
        [Markup.button.callback("📢 تغيير القناة", "edit_channel"), Markup.button.callback("💰 الحد الأدنى", "edit_withdraw")],
        [Markup.button.callback("🎁 مكافأة الإحالة", "edit_ref"), Markup.button.callback("🚦 تعطيل/تفعيل", "toggle_bot")],
        [Markup.button.callback("📢 إذاعة (للجميع)", "broadcast")]
    ]));
});

// --- 🛠️ معالجة أوامر الإدارة ---
bot.action("edit_channel", (ctx) => ctx.reply("أرسل معرف القناة الجديد الآن (مثال: @YourChannel)"));
bot.action("edit_withdraw", (ctx) => ctx.reply("أرسل الحد الأدنى الجديد للسحب (مثال: 0.5)"));

// تعامل مع النصوص المرسلة للمدير (لتغيير الإعدادات)
bot.on('text', (ctx) => {
    if (ctx.from.id !== ADMIN_ID) return;
    const txt = ctx.message.text;

    if (txt.startsWith("@")) {
        botSettings.channel = txt;
        ctx.reply(`✅ تم تغيير قناة الاشتراك الإجباري إلى: ${txt}`);
    } else if (!isNaN(txt)) {
        botSettings.minWithdraw = parseFloat(txt);
        ctx.reply(`✅ تم تحديث الحد الأدنى للسحب إلى: ${txt} TON`);
    }
});

// --- 🚀 التشغيل النهائي ---
bot.launch({ dropPendingUpdates: true }).then(() => console.log("🔥 BOT & ADMIN PANEL READY"));
