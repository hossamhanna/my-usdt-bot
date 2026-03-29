import telebot
from telebot import types
from telebot.types import WebAppInfo
import firebase_admin
from firebase_admin import credentials, db

# --- الإعدادات (مأخوذة من صورك) ---
API_TOKEN = '8783102340:AAHsT6hQc2NZSd8hKJFrXwl0YGvwPNUFYK8'
ADMIN_ID = 1683002116 
DB_URL = 'https://novaton-bot-default-rtdb.firebaseio.com' # الرابط من صورتك
WEB_APP_URL = "https://hossamhanna.github.io/my-usdt-bot/"
BOT_LOGO_URL = "https://i.ibb.co/LzNfDqL/logo.jpg" 

# تهيئة Firebase بطريقة صحيحة تمنع الـ Crash
if not firebase_admin._apps:
    try:
        cred = credentials.Certificate("serviceAccountKey.json")
        firebase_admin.initialize_app(cred, {'databaseURL': DB_URL})
    except Exception as e:
        print(f"Firebase Init Error: {e}")

bot = telebot.TeleBot(API_TOKEN)

# --- القوائم ---
def get_main_menu():
    markup = types.ReplyKeyboardMarkup(row_width=2, resize_keyboard=True)
    markup.add("👤 Profile & Balance", "🔗 Referral Hub")
    markup.add("🎡 Bonus Spin", "📈 Statistics")
    markup.add("🎯 Missions & Tasks", "🎧 Support")
    return markup

# --- معالج أمر Start (المكان الذي كان يسبب الخطأ في الصورة) ---
@bot.message_handler(commands=['start'])
def start_handler(message):
    user_id = str(message.chat.id)
    
    try:
        # التأكد من وجود المستخدم أو إنشاؤه
        user_ref = db.reference(f'users/{user_id}')
        if not user_ref.get():
            user_ref.set({
                'balance': 0.0,
                'referrals': 0,
                'status': 'verified'
            })
        
        # إرسال رسالة الترحيب مع الأزرار كما في صورتك
        markup = types.InlineKeyboardMarkup(row_width=1)
        markup.add(
            types.InlineKeyboardButton("📢 Join Channel 1", url="https://t.me/YourChannel"),
            types.InlineKeyboardButton("✅ Done / Check", callback_data="check_join")
        )
        
        caption = "👋 **Welcome!**\n\n🏆 Join our channels to start earning."
        bot.send_photo(message.chat.id, BOT_LOGO_URL, caption=caption, parse_mode="Markdown", reply_markup=markup)
        
    except Exception as e:
        print(f"Error in Start: {e}")
        bot.send_message(message.chat.id, "Welcome! Please use the menu below.", reply_markup=get_main_menu())

@bot.callback_query_handler(func=lambda call: call.data == "check_join")
def check_join(call):
    # إرسال زر الويب آب (التحقق)
    markup = types.InlineKeyboardMarkup()
    markup.add(types.InlineKeyboardButton("🛡️ Verify Device", web_app=WebAppInfo(url=WEB_APP_URL)))
    bot.send_message(call.message.chat.id, "✅ Joined! Now verify your device:", reply_markup=markup)
    bot.send_message(call.message.chat.id, "Main Menu Unlocked:", reply_markup=get_main_menu())

# --- زر البروفايل (الذي ظهر في صورك) ---
@bot.message_handler(func=lambda m: m.text == "👤 Profile & Balance")
def profile_handler(message):
    user_id = str(message.chat.id)
    data = db.reference(f'users/{user_id}').get() or {'balance': 0.0, 'referrals': 0}
    
    profile_msg = (
        f"👤 **Profile Details**\n"
        f"━━━━━━━━━━━━━━\n"
        f"🆔 ID: `{user_id}`\n"
        f"💰 Balance: {data.get('balance', 0.0)} USDT\n"
        f"👥 Total Referrals: {data.get('referrals', 0)}"
    )
    bot.send_message(message.chat.id, profile_msg, parse_mode="Markdown")

if __name__ == "__main__":
    print("🚀 Bot is running...")
    bot.polling(none_stop=True)
