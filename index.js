const { Telegraf, Markup } = require('telegraf');
const admin = require('firebase-admin');
const express = require('express');
const axios = require('axios');

// --- ⚙️ الإعدادات ---
const BOT_TOKEN = '8783102340:AAHsT6hQc2NZSd8hKJFrXwl0YGvwPNUFYK8';
const ADMIN_ID = 1683002116;
const bot = new Telegraf(BOT_TOKEN);

// --- 🌐 سيرفر الاستجابة السريعة ---
const app = express();
app.get('/', (req, res) => res.send('Novaton System is Running ✅'));
app.listen(process.env.PORT || 10000, () => console.log("📡 Server Ready"));

// --- 🔥 ربط Firebase بأمان ---
let db;
try {
    const serviceAccount = require("./serviceAccountKey.json");
    if (!admin.apps.length) {
        admin.initializeApp({
            credential: admin.credential.cert(serviceAccount),
            databaseURL: "https://novaton-bot-default-rtdb.firebaseio.com"
        });
    }
    db = admin.database();
    console.log("🔥 Firebase: Connected Successfully");
} catch (e) {
    console.log("❌ Firebase Error: Check your serviceAccountKey.json file!");
}

// --- 🛡️ وظيفة التحقق من الاشتراك ---
async function checkMembership(ctx, userId) {
    if (!db) return true; 
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

// --- 🤖 معالجة أمر البداية (Start) ---
bot.start(async (ctx) => {
    try {
        const userId = ctx.from.id;
        console.log(`👤 New Action: Start from ${userId}`);

        // 1. نظام الحماية الذكي (فحص الحظر)
        if (db) {
            const isBanned = await db.ref(`blacklist/${userId}`).once('value');
            if (isBanned.exists()) return ctx.reply("🚫 حسابك محظور نهائياً من النظام.");
        }

        // 2. فحص الاشتراك الإجباري (مع إظهار اللوجو)
        const hasJoined = await checkMembership(ctx, userId);
        if (!hasJoined) {
            const chSnap = await db.ref('settings/channels').once('value');
            const channels = chSnap.val() || [];
            const keyboard = channels.map(ch => [Markup.button.url(`📢 انضم للقناة: ${ch}`, `https://t.me/${ch.replace('@','')}`)]);
            keyboard.push([Markup.button.callback("✅ تم الاشتراك - دخول", "verify_now")]);

            return ctx.replyWithPhoto("https://image2url.com/r2/default/images/1774806219411-7438bf59-86d5-4352-9d9a-dd254c3f841d.jpg", {
                caption: "🛡️ **نظام الحماية والتحقق**\n\nيجب عليك الاشتراك في القنوات أدناه لتفعيل حسابك ومكافآت TON.\n\n⚠️ يمنع استخدام الـ VPN أو الحسابات الوهمية.",
                ...Markup.inlineKeyboard(keyboard)
            });
        }

        // 3. تسجيل المستخدم ومنح مكافأة الإحالة (0.03 TON)
        if (db) {
            const userRef = db.ref(`users/${userId}`);
            const userSnap = await userRef.once('value');
            if (!userSnap.exists()) {
                await userRef.set({ id: userId, name: ctx.from.first_name, balance: 0, joined: Date.now() });
                const refId = ctx.startPayload;
                if (refId && refId != userId) {
                    await db.ref(`users/${refId}/balance`).transaction(b => (b || 0) + 0.03);
                    bot.telegram.sendMessage(refId, "🎁 مبروك! حصلت على 0.03 TON من إحالة جديدة.").catch(()=>{});
                }
            }
        }

        // 4. الواجهة الرئيسية
        ctx.reply("🚀 **تم تفعيل نظام الحماية بنجاح!**\n\nأهلاً بك في النسخة النهائية من Novaton TON. استخدم الأزرار أدناه للتحكم:", 
        Markup.keyboard([
            ["👤 حسابي", "🔗 الإحالة"],
            ["📥 إيداع", "📤 سحب"],
            ["⚙️ الإدارة"]
        ]).resize());

    } catch (err) {
        console.log("❌ Error in Start Command:", err.message);
    }
});

// --- 📩 تفاعل زر التحقق ---
bot.action("verify_now", async (ctx) => {
    const isOk = await checkMembership(ctx, ctx.from.id);
    if (isOk) {
        await ctx.answerCbQuery("✅ تم التحقق! أرسل /start");
        await ctx.deleteMessage();
        ctx.reply("🌟 مبروك! اجتزت الفحص. اضغط /start للدخول.");
    } else {
        await ctx.answerCbQuery("❌ يجب الاشتراك في جميع القنوات!", { show_alert: true });
    }
});

// --- ⚙️ لوحة الأدمن ---
bot.on('text', async (ctx) => {
    if (ctx.from.id !== ADMIN_ID) return;
    const msg = ctx.message.text;

    if (msg.startsWith("اضف @")) {
        const ch = msg.split(" ")[1];
        await db.ref('settings/channels').transaction(a => { if(!a) a=[]; a.push(ch); return a; });
        ctx.reply(`✅ تمت إضافة ${ch}`);
    }
    if (msg.startsWith("شحن ")) {
        const [_, id, amt] = msg.split(" ");
        await db.ref(`users/${id}/balance`).transaction(b => (b || 0) + parseFloat(amt));
        ctx.reply(`✅ تم شحن ${amt} TON لـ ${id}`);
    }
});

// --- 📡 منع النوم (Anti-Sleep) ---
setInterval(() => {
    if (process.env.RENDER_EXTERNAL_HOSTNAME) {
        axios.get(`https://${process.env.RENDER_EXTERNAL_HOSTNAME}`).catch(() => {});
    }
}, 240000);

bot.launch().then(() => console.log("✅ Bot is Polling..."));
