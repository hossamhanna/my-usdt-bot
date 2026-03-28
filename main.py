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
WEB_APP_URL = "https://hossamhanna.github.io/my-usdt-bot/" 
DB_URL = 'https://novaton-bot-default-rtdb.firebaseio.com'
BOT_LOGO_URL = "رابط_صورة_اللوجو_هنا" 

# قنوات الاشتراك الإجباري
CHANNELS = [
    {"name": "📢 Join Channel 1", "url": "https://t.me/YourChannel1"},
    {"name": "📢 Join Channel 2", "url": "https://t.me/YourChannel2"},
]
# ===================================================

server = Flask('')
@server.route('/')
def home(): return "Bot is Alive!"
def run(): server.run(host='0.0.0.0', port=8080)
def keep_alive():
    t = Thread(target=run)
    t.daemon = True
    t.start()

try:
    if not firebase_admin._apps:
        cred = credentials.Certificate("serviceAccountKey.json")
        firebase_admin.initialize_app(cred, {'databaseURL': DB_URL})
    users_ref = db.reference('users')
except Exception as e: print(f"Firebase Error: {e}")

bot = telebot.TeleBot(API_TOKEN)

# --- تصميم القوائم (مثل الصور تماماً) ---
def main_menu():
    markup = types.ReplyKeyboardMarkup(row_width=2, resize_keyboard=True)
    # الصف الأول
    markup.add(types.KeyboardButton("👤 Profile & Balance"), types.KeyboardButton("🔗 Referral Hub"))
    # الصف الثاني
    markup.add(types.KeyboardButton("🎡 Bonus Spin"), types.KeyboardButton("📈 Statistics"))
    # الصف الثالث
    markup.add(types.KeyboardButton("🎯 Missions & Tasks"), types.KeyboardButton("🎧 Support"))
    return markup

def admin_menu():
    markup = types.ReplyKeyboardMarkup(row_width=2, resize_keyboard=True)
    markup.add("📊 Users Count", "💰 Give Balance")
    markup.add("📢 Broadcast", "🏠 Back to User Menu")
    return markup

# --- أوامر الإدارة ---
@bot.message_handler(commands=['admin'])
def admin_panel(message):
    if message.from_user.id == ADMIN_ID:
        bot.send_message(message.chat.id, "🛠️ Welcome Back, BOSS!", reply_markup=admin_menu())

@bot.message_handler(func=lambda m: m.text == "📊 Users Count")
def users_count(message):
    if message.from_user.id == ADMIN_ID:
        count = len(users_ref.get() or {})
        bot.send_message(message.chat.id, f"👥 Total Users: {count}")

# --- معالجة البوت الأساسية ---
@bot.message_handler(commands=['start'])
def start(message):
    user_id = str(message.chat.id)
    if not users_ref.child(user_id).get():
        users_ref.child(user_id).set({'balance': 0.0, 'referrals': 0})

    markup = types.InlineKeyboardMarkup(row_width=1)
    for ch in CHANNELS:
        markup.add(types.InlineKeyboardButton(ch['name'], url=ch['url']))
    markup.add(types.InlineKeyboardButton("✅ Done / Check", callback_data="check_subs"))
    
    welcome_msg = "👋 **Welcome to Novaton Bot!**\n\n🏆 Join our channels to start earning.\n🤝 After joining, click 'Done' below."
    
    try:
        bot.send_photo(message.chat.id, BOT_LOGO_URL, caption=welcome_msg, parse_mode="Markdown", reply_markup=markup)
    except:
        bot.send_message(message.chat.id, welcome_msg, parse_mode="Markdown", reply_markup=markup)

@bot.callback_query_handler(func=lambda call: call.data == "check_subs")
def check_subs(call):
    # الانتقال لنظام التحقق
    markup = types.InlineKeyboardMarkup()
    markup.add(types.InlineKeyboardButton("🛡️ Device Verification", web_app=WebAppInfo(url=WEB_APP_URL)))
    
    bot.send_message(call.message.chat.id, "✅ Channels Verified! Please verify your device to unlock features.", reply_markup=markup)
    bot.send_message(call.message.chat.id, "Main Menu Unlocked:", reply_markup=main_menu())

# --- أزرار القائمة الرئيسية ---
@bot.message_handler(func=lambda m: m.text == "👤 Profile & Balance")
def profile(message):
    data = users_ref.child(str(message.chat.id)).get() or {'balance': 0.0, 'referrals': 0}
    text = f"👤 *Your Profile*\n\n🆔 ID: `{message.chat.id}`\n💰 Balance: *{data['balance']} USDT*\n👥 Referrals: *{data['referrals']}*"
    bot.send_message(message.chat.id, text, parse_mode="Markdown")

@bot.message_handler(func=lambda m: m.text == "🔗 Referral Hub")
def referral(message):
    ref_link = f"https://t.me/{(bot.get_me()).username}?start={message.chat.id}"
    bot.send_message(message.chat.id, f"🔗 **Your Referral Link:**\n{ref_link}\n\n🎁 Earn 0.03 USDT per referral!")

@bot.message_handler(func=lambda m: m.text == "🏠 Back to User Menu")
def back_home(message):
    bot.send_message(message.chat.id, "Returning...", reply_markup=main_menu())

if __name__ == "__main__":
    keep_alive()
    bot.polling(none_stop=True)
