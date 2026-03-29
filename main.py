import telebot
from telebot import types
from telebot.types import WebAppInfo
import firebase_admin
from firebase_admin import credentials, db

# --- الإعدادات ---
API_TOKEN = '8783102340:AAHsT6hQc2NZSd8hKJFrXwl0YGvwPNUFYK8'
ADMIN_ID = 1683002116
DB_URL = 'https://novaton-bot-default-rtdb.firebaseio.com'
WEB_APP_URL = "https://hossamhanna.github.io/my-usdt-bot/" 
REQUIRED_CHANNELS = ["@VaultoUSDT", "@E_G_58"]

# اتصال Firebase
if not firebase_admin._apps:
    try:
        cred = credentials.Certificate("serviceAccountKey.json")
        firebase_admin.initialize_app(cred, {'databaseURL': DB_URL})
    except Exception as e:
        print(f"Firebase Init Error: {e}")

bot = telebot.TeleBot(API_TOKEN)

# --- القائمة الرئيسية ---
def main_menu():
    markup = types.ReplyKeyboardMarkup(row_width=2, resize_keyboard=True)
    markup.add("👤 Profile & Balance", "🔗 Referral Hub")
    markup.add("🎡 Bonus Spin", "📈 Statistics")
    markup.add("🎯 Missions & Tasks", "🎧 Support")
    return markup

# --- فحص حالة التحقق ---
def is_user_verified(user_id):
    try:
        user_data = db.reference(f'users/{user_id}').get()
        if user_data and user_data.get('is_verified') == True:
            return True
    except:
        return False
    return False

@bot.message_handler(commands=['start'])
def start(message):
    user_id = str(message.chat.id)
    user_ref = db.reference(f'users/{user_id}')
    data = user_ref.get()

    if not data:
        user_ref.set({'balance': 0.0, 'referrals': 0, 'is_verified': False, 'ip': None})
        data = {'is_verified': False}

    if data.get('is_verified'):
        bot.send_message(message.chat.id, "✅ Welcome back!", reply_markup=main_menu())
    else:
        markup = types.InlineKeyboardMarkup(row_width=1)
        for ch in REQUIRED_CHANNELS:
            markup.add(types.InlineKeyboardButton(f"➕ Join {ch}", url=f"https://t.me/{ch.strip('@')}"))
        
        markup.add(types.InlineKeyboardButton("🛡️ Verify & Start Earning", web_app=WebAppInfo(url=WEB_APP_URL)))
        
        welcome_text = (
            "👋 **Welcome to Vaulto USDT!**\n\n"
            "🛡️ To prevent cheating, you must complete the **Security Check**.\n\n"
            "1️⃣ Join Channels.\n"
            "2️⃣ Click the Verify button below.\n"
            "⚠️ **Note:** VPNs and multiple accounts are forbidden."
        )
        bot.send_message(message.chat.id, welcome_text, parse_mode="Markdown", reply_markup=markup)

# --- حماية كافة الرسائل الأخرى ---
@bot.message_handler(func=lambda m: True)
def handle_all(message):
    user_id = str(message.chat.id)
    if is_user_verified(user_id):
        # هنا يتم الرد على أزرار القائمة بعد التحقق
        if message.text == "👤 Profile & Balance":
            user_data = db.reference(f'users/{user_id}').get()
            bot.send_message(message.chat.id, f"💰 Balance: {user_data.get('balance', 0.0)} USDT")
        # يمكنك إضافة بقية الأزرار هنا بنفس الطريقة
        else:
            bot.send_message(message.chat.id, "Main Menu:", reply_markup=main_menu())
    else:
        bot.send_message(message.chat.id, "⚠️ Access Denied! Please complete the security verification first using /start")

if __name__ == "__main__":
    print("🚀 Bot is starting with Security Lock...")
    bot.polling(none_stop=True)
