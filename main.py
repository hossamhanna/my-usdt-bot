import telebot
from telebot import types
from telebot.types import WebAppInfo
import firebase_admin
from firebase_admin import credentials, db

# --- الإعدادات (تأكد من صحتها) ---
API_TOKEN = '8783102340:AAHsT6hQc2NZSd8hKJFrXwl0YGvwPNUFYK8'
ADMIN_ID = 1683002116 
DB_URL = 'https://novaton-bot-default-rtdb.firebaseio.com'
WEB_APP_URL = "https://hossamhanna.github.io/my-usdt-bot/"
# ضع هنا رابط لوجو حقيقي (ينتهي بـ .jpg أو .png)
BOT_LOGO_URL = "https://i.ibb.co/LzNfDqL/logo.jpg" 

# تهيئة Firebase
if not firebase_admin._apps:
    cred = credentials.Certificate("serviceAccountKey.json")
    firebase_admin.initialize_app(cred, {'databaseURL': DB_URL})

bot = telebot.TeleBot(API_TOKEN)

# --- الدوال المساعدة (القوائم) ---
def get_main_menu():
    markup = types.ReplyKeyboardMarkup(row_width=2, resize_keyboard=True)
    markup.add("👤 Profile & Balance", "🔗 Referral Hub")
    markup.add("🎡 Bonus Spin", "📈 Statistics")
    markup.add("🎯 Missions & Tasks", "🎧 Support")
    return markup

def get_admin_menu():
    markup = types.ReplyKeyboardMarkup(row_width=2, resize_keyboard=True)
    markup.add("📊 Total Users", "💰 Edit Balance")
    markup.add("📢 Broadcast", "🏠 Back to User Menu")
    return markup

# --- أوامر الإدارة ---
@bot.message_handler(commands=['admin'])
def admin_handler(message):
    if message.from_user.id == ADMIN_ID:
        bot.send_message(message.chat.id, "🛠 Welcome BOSS! Admin Panel active.", reply_markup=get_admin_menu())

@bot.message_handler(func=lambda m: m.text == "📊 Total Users")
def count_handler(message):
    if message.from_user.id == ADMIN_ID:
        users = db.reference('users').get()
        count = len(users) if users else 0
        bot.send_message(message.chat.id, f"👥 Total Users: {count}")

# --- أوامر المستخدم الأساسية ---
@bot.message_handler(commands=['start'])
def start_handler(message):
    user_id = str(message.chat.id)
    
    # حفظ المستخدم في القاعدة
    if not db.reference(f'users/{user_id}').get():
        db.reference(f'users/{user_id}').set({'balance': 0.0, 'referrals': 0})

    # أزرار الاشتراك الإجباري
    markup = types.InlineKeyboardMarkup(row_width=1)
    markup.add(
        types.InlineKeyboardButton("📢 Join Our Channel", url="https://t.me/YourChannelLink"),
        types.InlineKeyboardButton("✅ Done / Check", callback_data="check_and_verify")
    )
    
    caption_text = "👋 **Welcome to Novaton Bot!**\n\n🏆 Join the channel above to start earning.\n🤝 Click 'Done' after joining."
    
    try:
        bot.send_photo(message.chat.id, BOT_LOGO_URL, caption=caption_text, parse_mode="Markdown", reply_markup=markup)
    except:
        bot.send_message(message.chat.id, caption_text, parse_mode="Markdown", reply_markup=markup)

@bot.callback_query_handler(func=lambda call: call.data == "check_and_verify")
def verify_handler(call):
    # إرسال زر نظام التحقق (Web App)
    markup = types.InlineKeyboardMarkup()
    markup.add(types.InlineKeyboardButton("🛡️ Device Verification", web_app=WebAppInfo(url=WEB_APP_URL)))
    
    bot.send_message(call.message.chat.id, "✅ Channels Verified! Now verify your device to unlock withdrawal.", reply_markup=markup)
    bot.send_message(call.message.chat.id, "🏠 Main Menu unlocked:", reply_markup=get_main_menu())

# --- أزرار القائمة الرئيسية ---
@bot.message_handler(func=lambda m: m.text == "👤 Profile & Balance")
def profile_handler(message):
    user_data = db.reference(f'users/{message.chat.id}').get() or {'balance': 0.0}
    bot.send_message(message.chat.id, f"👤 **Profile**\n\n💰 Balance: {user_data['balance']} USDT")

@bot.message_handler(func=lambda m: m.text == "🏠 Back to User Menu")
def back_handler(message):
    bot.send_message(message.chat.id, "Switching...", reply_markup=get_main_menu())

# تشغيل البوت
if __name__ == "__main__":
    print("Bot is starting...")
    bot.polling(none_stop=True)
