import telebot
from telebot import types
from telebot.types import WebAppInfo
import firebase_admin
from firebase_admin import credentials, db
from flask import Flask
from threading import Thread
import os

# ================= الإعدادات الشخصية =================
API_TOKEN = '8783102340:AAHsT6hQc2NZSd8hKJFrXwl0YGvwPNUFYK8'
ADMIN_ID = 1683002116
DB_URL = 'https://novaton-bot-default-rtdb.firebaseio.com'
WEB_APP_URL = "https://hossamhanna.github.io/my-usdt-bot/"
BOT_LOGO_URL = "https://image2url.com/r2/default/images/1774806219411-7438bf59-86d5-4352-9d9a-dd254c3f841d.jpg"

# قائمة القنوات (يجب أن يكون البوت آدمن في هذه القنوات)
# ضع يوزر القناة يبدأ بـ @
REQUIRED_CHANNELS = ["@YourChannel1", "@YourChannel2"] 
# ===================================================

app = Flask('')
@app.route('/')
def home(): return "Bot status: Active"
def run(): app.run(host='0.0.0.0', port=8080)
def keep_alive():
    t = Thread(target=run)
    t.daemon = True
    t.start()

if not firebase_admin._apps:
    try:
        cred = credentials.Certificate("serviceAccountKey.json")
        firebase_admin.initialize_app(cred, {'databaseURL': DB_URL})
    except Exception as e: print(f"Firebase Error: {e}")

bot = telebot.TeleBot(API_TOKEN)

# --- القوائم ---
def main_menu():
    markup = types.ReplyKeyboardMarkup(row_width=2, resize_keyboard=True)
    markup.add("👤 Profile & Balance", "🔗 Referral Hub")
    markup.add("🎡 Bonus Spin", "📈 Statistics")
    markup.add("🎯 Missions & Tasks", "🎧 Support")
    return markup

# --- دالة فحص الاشتراك الإجباري ---
def check_subscriptions(user_id):
    not_joined = []
    for channel in REQUIRED_CHANNELS:
        try:
            member = bot.get_chat_member(channel, user_id)
            if member.status in ['left', 'kicked']:
                not_joined.append(channel)
        except Exception:
            # إذا لم يستطع البوت الوصول للقناة (تأكد أنه آدمن فيها)
            not_joined.append(channel)
    return not_joined

# --- أوامر البوت ---
@bot.message_handler(commands=['start'])
def start(message):
    user_id = str(message.chat.id)
    if not db.reference(f'users/{user_id}').get():
        db.reference(f'users/{user_id}').set({'balance': 0.0, 'referrals': 0})

    markup = types.InlineKeyboardMarkup(row_width=1)
    for ch in REQUIRED_CHANNELS:
        markup.add(types.InlineKeyboardButton(f"📢 Join {ch}", url=f"https://t.me/{ch.replace('@', '')}"))
    
    markup.add(types.InlineKeyboardButton("✅ Done / Check", callback_data="verify_subs"))
    
    caption = "👋 **Welcome!**\n\n🏆 You must join our channels to start.\n🤝 Click 'Done' after joining all channels."
    try:
        bot.send_photo(message.chat.id, BOT_LOGO_URL, caption=caption, parse_mode="Markdown", reply_markup=markup)
    except:
        bot.send_message(message.chat.id, caption, parse_mode="Markdown", reply_markup=markup)

@bot.callback_query_handler(func=lambda call: call.data == "verify_subs")
def verify_subs(call):
    user_id = call.from_user.id
    missing_channels = check_subscriptions(user_id)
    
    if not missing_channels:
        # إذا اشترك في كل شيء -> يظهر نظام التحقق
        bot.answer_callback_query(call.id, "✅ Done! You joined all channels.")
        
        markup = types.InlineKeyboardMarkup()
        markup.add(types.InlineKeyboardButton("🛡️ Verify Device", web_app=WebAppInfo(url=WEB_APP_URL)))
        
        bot.send_message(call.message.chat.id, "🎯 Great! Now verify your device to unlock the bot:", reply_markup=markup)
        # ملاحظة: القائمة تظهر بعد أن يقوم بالتحقق أو يمكنك إظهارها هنا مباشرة
        bot.send_message(call.message.chat.id, "Main Menu Unlocked:", reply_markup=main_menu())
    else:
        # إذا نسي قناة -> يخبره بها
        channels_text = "\n".join(missing_channels)
        bot.answer_callback_query(call.id, f"⚠️ You missed: {channels_text}", show_alert=True)
        bot.send_message(call.message.chat.id, f"❌ You haven't joined these channels yet:\n{channels_text}\n\nPlease join and click 'Done' again.")

@bot.message_handler(func=lambda m: m.text == "👤 Profile & Balance")
def profile(message):
    data = db.reference(f'users/{message.chat.id}').get() or {'balance': 0.0}
    bot.send_message(message.chat.id, f"💰 Your Balance: {data['balance']} USDT")

if __name__ == "__main__":
    keep_alive()
    bot.polling(none_stop=True)
