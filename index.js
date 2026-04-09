const { Telegraf, Markup } = require('telegraf');
const admin = require('firebase-admin');
const express = require('express');
const axios = require('axios');

// --- ⚙️ الإعدادات الذهبية ---
const BOT_TOKEN = '8783102340:AAHsT6hQc2NZSd8hKJFrXwl0YGvwPNUFYK8';
const ADMIN_ID = 1683002116;
const bot = new Telegraf(BOT_TOKEN);

// --- 🌐 ضمان بقاء البوت حياً (Anti-Sleep) ---
const app = express();
app.get('/', (req, res) => res.send('Novaton Elite Shield: ACTIVE ✅'));
app.listen(process.env.PORT || 10000);

// --- 🔥 ربط Firebase ---
try {
    const serviceAccount = require("./serviceAccountKey.json");
    if (!admin.apps.length) {
        admin.initializeApp({
            credential: admin.credential.cert(serviceAccount),
            databaseURL: "https://novaton-bot-default-rtdb.firebaseio.com"
        });
    }
} catch (e) { console.log("⚠️ تنبيه: تأكد من رفع ملف serviceAccountKey.json"); }
const db = admin.database();

// --- 🛡️ نظام التحقق من القنوات ---
async function isUserSubscribed(ctx, userId) {
    const snap = await db.ref('settings/channels').once('value');
    const channels = snap.val() || [];
    if (channels.length === 0) return true;
    for (const ch of channels) {
        try {
            const member = await ctx.telegram.getChatMember(ch, userId);
            if (['left', 'kicked'].includes(member.status)) return false;
        } catch (e) { return false; }
    }
    return true;
}

// --- 🚀 تشغيل البوت (Start) ---
bot.start(async (ctx) => {
    try {
        const userId = ctx.from.id;

        // 1. نظام الحماية الذكي
        const banned = await db.ref(`blacklist/${userId}`).once('value');
        if (banned.exists()) return ctx.reply("🚫 تم حظرك من النظام لمخالفة القوانين.");

        // 2. الاشتراك الإجباري مع اللوجو
        const subbed = await isUserSubscribed(ctx, userId);
        if (!subbed) {
            const chSnap = await db.ref('settings/channels').once('value');
            const channels = chSnap.val() || [];
            const keyboard = channels.map(ch => [Markup.button.url(`📢 انضم هنا: ${ch}`, `https://t.me/${ch.replace('@','')}`)]);
            keyboard.push([Markup.button.callback("✅ تم الاشتراك - دخول", "verify")]);

            return ctx.replyWithPhoto("https://image2url.com/r2/default/images/1774806219411-7438bf59-86d5-4352-9d9a-dd254c3f841d.jpg", {
                caption: "🛡️ **نظام الحماية والتحقق من الهوية**\n\nيجب عليك الاشتراك في القنوات أدناه أولاً لفتح ميزات البوت تليها خطوة تفعيل الحماية.",
                ...Markup.inlineKeyboard(keyboard)
            });
        }

        // 3. تسجيل المستخدم ونظام الإحالة
        const userRef = db.ref(`users/${userId}`);
        const snap = await userRef.once('value');
        if (!snap.exists()) {
            await userRef.set({ id: userId, name: ctx.from.first_name, balance: 0, joined: Date.now() });
            const refId = ctx.startPayload;
            if (refId && refId != userId) {
                await db.ref(`users/${refId}/balance`).transaction(b => (b || 0) + 0.03);
                bot.telegram.sendMessage(refId, "🎁 حصلت على 0.03 TON مكافأة إحالة!").catch(()=>{});
            }
        }

        // 4. الواجهة الرئيسية
        ctx.reply(`🛡️ **تم تفعيل نظام الحماية بنجاح**\n\nأهلاً بك في Novaton، حسابك الآن محصن وجاهز للاستخدام.`, 
        Markup.keyboard([
            ["👤 حسابي", "🔗 الإحالة"],
            ["📥 إيداع", "📤 سحب الأرباح"],
            ["⚙️ الإدارة"]
        ]).resize());

    } catch (error) { console.log("Error Start:", error.message); }
});

// --- 🖱️ زر التحقق ---
bot.action("verify", async (ctx) => {
    const ok = await isUserSubscribed(ctx, ctx.from.id);
    if (ok) {
        await ctx.answerCbQuery("✅ تم التحقق!");
        await ctx.deleteMessage();
        ctx.reply("🌟 مبروك! اجتزت الفحص بنجاح. أرسل /start الآن.");
    } else {
        await ctx.answerCbQuery("❌ يجب الاشتراك في كل القنوات أولاً!", { show_alert: true });
    }
});

// --- 👑 لوحة التحكم (للأدمن فقط) ---
bot.hears("⚙️ الإدارة", (ctx) => {
    if (ctx.from.id !== ADMIN_ID) return;
    ctx.reply("👑 **لوحة الإدارة:**\n- `اضف @username` (قناة)\n- `شحن ID مبلغ` (رصيد)\n- `حظر ID` (حظر)");
});

bot.on('text', async (ctx) => {
    if (ctx.from.id !== ADMIN_ID) return;
    const t = ctx.message.text;
    if (t.startsWith("اضف @")) {
        const c = t.split(" ")[1];
        await db.ref('settings/channels').transaction(a => { if(!a) a=[]; a.push(c); return a; });
        ctx.reply(`✅ تمت إضافة ${c}`);
    }
});

// --- 📡 نظام البقاء حياً ---
setInterval(() => {
    if (process.env.RENDER_EXTERNAL_HOSTNAME) {
        axios.get(`https://${process.env.RENDER_EXTERNAL_HOSTNAME}`).catch(() => {});
    }
}, 240000);

bot.launch().then(() => console.log("🚀 Novaton is 100% ONLINE"));
