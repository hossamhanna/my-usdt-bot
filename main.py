import telebot
from telebot import types
from telebot.types import WebAppInfo
import firebase_admin
from firebase_admin import credentials, db
import os

# --- الإعدادات ---
API_TOKEN = '8783102340:AAHsT6hQc2NZSd8hKJFrXwl0YGvwPNUFYK8'
ADMIN_ID = 1683002116 
DB_URL = 'https://novaton-bot-default-rtdb.firebaseio.com'
WEB_APP_URL = "https://hossamhanna.github.io/my-usdt-bot/"
# رابط الصورة الجديد الذي أرسلته
BOT_LOGO_URL = "https://image2url.com/r2/default/images/1774806219411-7438bf59-86d5-4352-9d9a-dd254c3f841d.jpg"

# تهيئة Firebase مع معالجة الأخطاء لضمان عدم توقف البوت
if not firebase_admin._apps:
    try:
        # التأكد من وجود الملف قبل محاولة تحميله
        if os.path.exists("serviceAccountKey.json"):
            cred = credentials.Certificate("serviceAccountKey.json")
            firebase_admin.initialize_app(cred, {'databaseURL': DB_URL})
            print("✅ Firebase connected successfully")
        else:
            print("❌ Error: serviceAccountKey.json not found!")
    except Exception as e:
        print(f"❌ Firebase Initialization Error: {e}")

bot = telebot.TeleBot(API_TOKEN)

# --- القوائم ---
def get_main_menu():
    markup = types.ReplyKeyboardMarkup(row_width=2, resize_keyboard=True)
    markup.add("👤 Profile & Balance", "🔗 Referral Hub")
    markup.add("🎡 Bonus Spin", "📈 Statistics")
    markup.add("🎯 Missions & Tasks", "🎧 Support")
    return markup

# --- الأوامر ---
@bot.message_handler(commands=['start'])
def start_handler(message):
    user_id = str(message.chat.id)
    
    # محاولة تسجيل المستخدم في Firebase دون أن يتسبب فشلها في توقف البوت
    try:
        user_ref = db.reference(f'users/{user_id}')
        if not user_ref.get():
            user_ref.set({'balance': 0.0, 'referrals': 0})
    except Exception as e:
        print(f"Database error during start: {e}")

    markup = types.InlineKeyboardMarkup(row_width=1)
    markup.add(
        types.InlineKeyboardButton("📢 Join Channel", url="https://t.me/YourChannel"),
        types.InlineKeyboardButton("✅ I Have Joined", callback_data="check_join")
    )
    
    caption = "👋 **Welcome!**\n\n🏆 Join our channel to start earning USDT easily."
    try:
        bot.send_photo(message.chat.id, BOT_LOGO_URL, caption=caption, parse_mode="Markdown", reply_markup=markup)
    except Exception:
        # إذا فشلت الصورة لأي سبب، أرسل نصاً فقط
        bot.send_message(message.chat.id, caption, parse_mode="Markdown", reply_markup=markup)

@bot.callback_query_handler(func=lambda call: call.data == "check_join")
def check_join(call):
    markup = types.InlineKeyboardMarkup()
    markup.add(types.InlineKeyboardButton("🛡️ Verify Device", web_app=WebAppInfo(url=WEB_APP_URL)))
    bot.send_message(call.message.chat.id, "✅ Verified! Now verify your device to unlock withdrawal:", reply_markup=markup)
    bot.send_message(call.message.chat.id, "🏠 Main Menu:", reply_markup=get_main_menu())

@bot.message_handler(func=lambda m: m.text == "👤 Profile & Balance")
def profile_handler(message):
    user_id = str(message.chat.id)
    try:
        data = db.reference(f'users/{user_id}').get() or {'balance': 0.0, 'referrals': 0}
        balance = data.get('balance', 0.0)
    except:
        balance = "Error loading"
    
    bot.send_message(message.chat.id, f"👤 **Profile Details**\n\n💰 Balance: {balance} USDT", parse_mode="Markdown")

if __name__ == "__main__":
    print("🚀 Bot starting...")
    bot.polling(none_stop=True)
