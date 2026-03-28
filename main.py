import telebot
from telebot import types
from telebot.types import WebAppInfo
import firebase_admin
from firebase_admin import credentials, db

# --- الإعدادات (ضع التوكن الخاص بك هنا) ---
API_TOKEN = '8783102340:AAHsT6hQc2NZSd8hKJFrXwl0YGvwPNUFYK8'
# رابط صفحة الحماية التي سنرفعها على GitHub Pages
WEB_APP_URL = "https://hossamhanna.github.io/my-sdt-bot/" 

CHANNELS = ["@VaultoUSDT", "@CryptoEarnList", "@CryptoProfitHub15", "@E_G_58"]

cred = credentials.Certificate("serviceAccountKey.json")
firebase_admin.initialize_app(cred, {'databaseURL': 'https://novaton-bot-default-rtdb.firebaseio.com'})

bot = telebot.TeleBot(API_TOKEN)
users_ref = db.reference('users')

def main_menu():
    markup = types.ReplyKeyboardMarkup(row_width=2, resize_keyboard=True)
    markup.add("👤 Profile & Balance", "🔗 Referral Hub")
    markup.add("🎡 Bonus Spin", "📈 Statistics")
    markup.add("🎯 Missions & Tasks", "🎧 Support")
    return markup

@bot.message_handler(commands=['start'])
def start(message):
    user_id = str(message.chat.id)
    if not users_ref.child(user_id).get():
        users_ref.child(user_id).set({'balance': 0.0, 'referrals': 0})
    
    # رسالة الترحيب مع زر التحقق (مثل الصورة 115394)
    markup = types.InlineKeyboardMarkup()
    markup.add(types.InlineKeyboardButton("🛡️ Device Verification", web_app=WebAppInfo(url=WEB_APP_URL)))
    
    bot.send_message(message.chat.id, "👋 Hello!\n🏆 Join our all channels\n🤝 Click '✅ Done' after joining", reply_markup=markup)

@bot.message_handler(func=lambda m: m.text == "👤 Profile & Balance")
def profile(message):
    data = users_ref.child(str(message.chat.id)).get()
    text = f"👤 *Profile Details*\n\n🆔 ID: `{message.chat.id}`\n💰 Balance: {data['balance']} USDT\n👥 Total Referrals: {data['referrals']}"
    markup = types.InlineKeyboardMarkup()
    markup.add(types.InlineKeyboardButton("💸 Withdraw", callback_data="withdraw"))
    bot.send_message(message.chat.id, text, parse_mode="Markdown", reply_markup=markup)

bot.polling()
