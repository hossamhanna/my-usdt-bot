const { Telegraf, Markup } = require('telegraf');
const admin = require('firebase-admin');
const express = require('express');

// --- ⚙️ الإعدادات ---
const bot = new Telegraf('8783102340:AAHsT6hQc2NZSd8hKJFrXwl0YGvwPNUFYK8');
const ADMIN_ID = 1683002116;
const LOGO_URL = "https://image2url.com/r2/default/images/1774806219411-7438bf59-86d5-4352-9d9a-dd254c3f841d.jpg";
const CHANNELS = ["@VaultoUSDT", "@E_G_58"];

// --- 🔥 الربط بـ Firebase ---
const serviceAccount = require("./serviceAccountKey.json");
admin.initializeApp({
  credential: admin.credential.cert(serviceAccount),
  databaseURL: "https://novaton-bot-default-rtdb.firebaseio.com"
});
const db = admin.database();

// --- 🌐 سيرفر الويب (حل مشكلة Render Port) ---
const app = express();
app.get('/', (req, res) => res.send('Bot is Active! ✅'));
const PORT = process.env.PORT || 10000;
app.listen(PORT, () => console.log(`Listening on ${PORT}`));

// --- 🛡️ نظام الحماية القوي (Anti-Clone) ---
async function checkSecurity(ctx) {
  if (!ctx.from.username) {
    await ctx.reply("⚠️ حماية: يجب تعيين 'اسم مستخدم' (Username) لحسابك أولاً لتتمكن من استخدام البوت.");
    return false;
  }
  return true;
}

// --- 📢 فحص الاشتراك ---
async function isSubscribed(ctx) {
  if (ctx.from.id === ADMIN_ID) return true;
  for (const ch of CHANNELS) {
    try {
      const chatMember = await ctx.telegram.getChatMember(ch, ctx.from.id);
      if (['left', 'kicked'].includes(chatMember.status)) return false;
    } catch (e) { continue; }
  }
  return true;
}

// --- 🤖 الأوامر ---
bot.start(async (ctx) => {
  if (!(await checkSecurity(ctx))) return;

  const userId = ctx.from.id;
  const userRef = db.ref(`users/${userId}`);
  
  // حفظ البيانات
  const snapshot = await userRef.once('value');
  if (!snapshot.exists()) {
    await userRef.set({ balance: 0.0, referrals: 0, username: ctx.from.username });
  }

  // فحص القنوات
  if (!(await isSubscribed(ctx))) {
    const buttons = CHANNELS.map(ch => Markup.button.url(`📢 اشترك في ${ch}`, `https://t.me/${ch.slice(1)}`));
    buttons.push(Markup.button.callback("✅ تم الاشتراك", "verify_sub"));
    
    return ctx.replyWithPhoto(LOGO_URL, {
      caption: "👋 أهلاً بك!\nيجب عليك الاشتراك في القنوات أدناه أولاً.",
      ...Markup.inlineKeyboard(buttons, { columns: 1 })
    });
  }

  // لوحة التحكم
  const keyboard = Markup.keyboard([
    ["👤 حسابي", "🔗 رابط الإحالة"],
    ["🎡 عجلة الحظ", "🎯 المهام"]
  ]).resize();

  ctx.replyWithPhoto(LOGO_URL, {
    caption: "مرحباً بك في Earn Master Bot! 🚀",
    ...keyboard
  });
});

bot.action('verify_sub', async (ctx) => {
  if (await isSubscribed(ctx)) {
    await ctx.deleteMessage();
    ctx.reply("✅ تم التحقق! أهلاً بك.", Markup.keyboard([["👤 حسابي", "🔗 رابط الإحالة"]]).resize());
  } else {
    ctx.answerCbQuery("❌ لم تشترك في كل القنوات بعد!", { show_alert: true });
  }
});

bot.hears("👤 حسابي", async (ctx) => {
  const snapshot = await db.ref(`users/${ctx.from.id}`).once('value');
  const data = snapshot.val() || { balance: 0 };
  ctx.reply(`💰 رصيدك الحالي: ${data.balance} USDT`);
});

// تشغيل البوت
bot.launch();
console.log("🚀 JS Bot Started Successfully");
