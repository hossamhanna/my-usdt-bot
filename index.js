const { Telegraf, Markup } = require('telegraf');
const axios = require('axios');
// ... (أكواد Firebase الخاصة بك)

const bot = new Telegraf('8783102340:AAHsT6hQc2NZSd8hKJFrXwl0YGvwPNUFYK8');

// نظام منع النوم (Anti-Sleep) لضمان العمل 24/7
setInterval(() => {
    const url = `https://${process.env.RENDER_EXTERNAL_HOSTNAME}`;
    if (process.env.RENDER_EXTERNAL_HOSTNAME) {
        axios.get(url).then(() => console.log('Self-Check: Active ✅')).catch(() => {});
    }
}, 240000); // تنبيه كل 4 دقائق

bot.start(async (ctx) => {
    // نظام الحماية الحديدي (التعرف على الحساب وليس الجهاز)
    const userId = ctx.from.id;
    
    // فحص الحظر (حتى لو غير النسخة أو استخدم VPN، الآيدي ثابت)
    const isBanned = await db.ref(`blacklist/${userId}`).once('value');
    if (isBanned.exists()) {
        return ctx.reply("🚫 عذراً، حسابك محظور من النظام لأسباب أمنية.");
    }

    // عرض القنوات (الاشتراك الإجباري)
    const snap = await db.ref('settings/channels').once('value');
    const channels = snap.val() || [];
    
    if (channels.length > 0) {
        // فحص سريع للاشتراك
        let keyboard = channels.map(ch => [Markup.button.url(`📢 انضم هنا: ${ch}`, `https://t.me/${ch.replace('@','')}`)]);
        keyboard.push([Markup.button.callback("✅ تم الاشتراك - دخول", "verify")]);
        
        return ctx.replyWithPhoto("https://image2url.com/r2/default/images/1774806219411-7438bf59-86d5-4352-9d9a-dd254c3f841d.jpg", {
            caption: "🛡️ **نظام التحقق من الهوية**\n\nيجب عليك الاشتراك في القنوات أدناه لتفعيل حسابك ومكافآت TON.",
            ...Markup.inlineKeyboard(keyboard)
        });
    }

    ctx.reply("🚀 أهلاً بك! تم التحقق من حسابك بنجاح.");
});

bot.launch();
